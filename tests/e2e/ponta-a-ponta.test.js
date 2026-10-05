// Teste ponta a ponta: API Laravel de verdade (SQLite temporário) + bot de verdade (agente.js),
// com Meta e OpenRouter simulados num servidor local. Rode com: npm run test:e2e (precisa de PHP e do backend instalado).
// Cobre: webhook assinado -> mensagem gravada -> IA fecha o pedido por código -> API calcula preço -> comprovante
// no WhatsApp -> webhook repetido não duplica -> agente da cozinha imprime a comanda (ESC/POS) uma vez
// -> painel (login + CSRF) despacha -> cliente é notificado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createHmac, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import net from 'node:net';
import { criarAgente, enviarParaImpressora } from '../../impressora/agente-impressao.mjs';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const BACKEND = join(RAIZ, 'backend');
const TELEFONE = '5512999990001';
const SEGREDO_META = 'segredo-e2e';
const TOKEN_BOT = randomBytes(24).toString('hex'); // BotAccess exige 32+ caracteres
const TOKEN_IMPRESSORA = randomBytes(24).toString('hex');
const SENHA = 'Senha#E2e123';

const pasta = mkdtempSync(join(tmpdir(), 'botclient-e2e-'));
const banco = join(pasta, 'e2e.sqlite');
writeFileSync(banco, '');
const processos = [];

// Sem pdo_sqlite carregado por padrão (PHP do Windows), carrega pela linha de comando.
const extensoesPhp = execFileSync('php', ['-m'], { encoding: 'utf8' });
const php = (...args) => [...(/pdo_sqlite/i.test(extensoesPhp) ? [] : ['-d', 'extension=pdo_sqlite']), ...args];

const portaLivre = () => new Promise(resolve => {
  const s = createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
});

// Sempre lê o corpo inteiro: o `php -S` fecha a conexão e o fetch do Node falha com resposta não lida.
async function http(url, opcoes) {
  const r = await fetch(url, opcoes);
  const texto = await r.text();
  let corpo = texto;
  try { corpo = JSON.parse(texto); } catch { /* não é JSON */ }
  return { status: r.status, corpo, cookies: r.headers.getSetCookie() };
}

async function esperar(condicao, descricao, limiteMs = 20000) {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    const valor = await condicao().catch(() => null);
    if (valor) return valor;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Tempo esgotado esperando: ${descricao}`);
}

function iniciar(comando, args, opcoes) {
  const filho = spawn(comando, args, { ...opcoes, stdio: ['ignore', 'pipe', 'pipe'] });
  filho.saida = '';
  filho.stdout.on('data', d => { filho.saida += d; });
  filho.stderr.on('data', d => { filho.saida += d; });
  processos.push(filho);
  return filho;
}

// ---------------------------------------------------------------- Meta e OpenRouter simulados
const enviadasMeta = [];
const pedidosAoModelo = [];
const falso = createServer((req, res) => {
  const partes = [];
  req.on('data', p => partes.push(p));
  req.on('end', () => {
    const corpo = JSON.parse(Buffer.concat(partes).toString() || '{}');
    if (req.url.startsWith('/graph/')) {
      enviadasMeta.push(corpo);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ messages: [{ id: `wamid.saida.${enviadasMeta.length}` }] }));
      return;
    }
    // Modelo: fecha o pedido com o código do tamanho Grande do frango, lido do cardápio que a API mandou no prompt.
    pedidosAoModelo.push(corpo);
    const sistema = corpo.messages[0].content.map(p => p.text).join('');
    const codigo = Number(/Filé de Frango Acebolado[^\n]*Grande: R\$ [\d,]+ \[cod (\d+)\]/.exec(sistema)?.[1]);
    const mensagem = { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: {
      name: 'fechar_pedido',
      arguments: JSON.stringify({ nome: 'Ana Teste', itens: [{ codigo, quantidade: 2 }], endereco: 'Rua das Flores, 10 - Centro', formaPagamento: 'Pix' }),
    } }] };
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ choices: [{ message: mensagem }] }));
  });
});

test.after(async () => {
  for (const p of processos) p.kill();
  await new Promise(resolve => falso.close(resolve));
  await new Promise(resolve => setTimeout(resolve, 500)); // Windows libera o arquivo do banco depois que o PHP sai
  rmSync(pasta, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test('mensagem no WhatsApp vira pedido com preço do servidor e o despacho pelo painel avisa o cliente', { timeout: 120000 }, async () => {
  const [portaFalso, portaPainel, portaApiBot, portaBot] = await Promise.all([portaLivre(), portaLivre(), portaLivre(), portaLivre()]);
  await new Promise(resolve => falso.listen(portaFalso, '127.0.0.1', resolve));

  // ------------------------------------------------ API: banco novo, cardápio de exemplo, sempre aberto, um admin
  const envApi = {
    ...process.env,
    APP_ENV: 'testing', APP_DEBUG: 'true', APP_KEY: 'base64:' + randomBytes(32).toString('base64'),
    DB_CONNECTION: 'sqlite', DB_DATABASE: banco, DB_URL: '',
    SESSION_DRIVER: 'database', SESSION_SECURE_COOKIE: 'false', CACHE_STORE: 'array', QUEUE_CONNECTION: 'sync',
    LOG_CHANNEL: 'stderr', MAIL_MAILER: 'array',
    NOTIFICACAO_TOKEN: TOKEN_BOT, BOT_URL: `http://127.0.0.1:${portaBot}`, IMPRESSORA_TOKEN: TOKEN_IMPRESSORA,
  };
  execFileSync('php', php('artisan', 'migrate', '--force'), { cwd: BACKEND, env: envApi, stdio: 'pipe' });
  execFileSync('php', php('artisan', 'db:seed', '--class=CardapioSeeder', '--force'), { cwd: BACKEND, env: envApi, stdio: 'pipe' });
  const hash = execFileSync('php', ['-r', `echo password_hash(${JSON.stringify(SENHA)}, PASSWORD_BCRYPT);`], { encoding: 'utf8' });
  const db = new DatabaseSync(banco);
  db.prepare("UPDATE horarios_atendimento SET ativo = 1, hora_inicio = '00:00:00', hora_fim = '23:59:59'").run();
  db.prepare("INSERT INTO users (name, email, password, role, active, created_at, updated_at) VALUES ('Admin E2E', 'admin@e2e.test', ?, 'admin', 1, datetime('now'), datetime('now'))").run(hash);
  db.close();

  // `php -S` atende uma requisição por vez no Windows: painel e bot usam servidores separados no mesmo banco,
  // senão o despacho (API -> bot -> API) travaria esperando a si mesmo.
  const roteador = join(BACKEND, 'vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php');
  for (const porta of [portaPainel, portaApiBot]) {
    // O roteador do Laravel procura o index.php na pasta atual (como o `artisan serve`).
    iniciar('php', php('-S', `127.0.0.1:${porta}`, roteador), { cwd: join(BACKEND, 'public'), env: envApi });
    await esperar(async () => typeof (await http(`http://127.0.0.1:${porta}/api/health`)).corpo === 'object', `API na porta ${porta}`);
  }

  // ------------------------------------------------ bot apontando para a API e para os simuladores
  const bot = iniciar(process.execPath, ['agente.js'], {
    cwd: RAIZ,
    env: {
      ...process.env,
      PORTA: String(portaBot), ESCUTAR_EM: '127.0.0.1',
      API_BASE_URL: `http://127.0.0.1:${portaApiBot}/api`, NOTIFICACAO_TOKEN: TOKEN_BOT,
      GRAPH_URL: `http://127.0.0.1:${portaFalso}/graph`, OPENROUTER_URL: `http://127.0.0.1:${portaFalso}/openrouter`,
      OPENROUTER_API_KEY: 'sk-or-e2e', WHATSAPP_TOKEN: 'token-e2e', WHATSAPP_PHONE_NUMBER_ID: '123',
      WHATSAPP_VERIFY_TOKEN: 'verifica-e2e', WHATSAPP_APP_SECRET: SEGREDO_META,
      ARQ_LOG: join(pasta, 'conversas.log'),
    },
  });
  await esperar(async () => bot.saida.includes('ouvindo na porta'), 'bot no ar');

  // ------------------------------------------------ cliente manda mensagem (webhook assinado como a Meta)
  const webhook = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{
    id: 'wamid.entrada.1', from: TELEFONE, type: 'text', timestamp: String(Math.floor(Date.now() / 1000)),
    text: { body: 'Quero 2 frangos acebolados grandes, Rua das Flores 10, Centro, pago no Pix. Ana Teste' },
  }] } }] }] });
  const enviarWebhook = () => http(`http://127.0.0.1:${portaBot}/webhook`, {
    method: 'POST', body: webhook,
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': 'sha256=' + createHmac('sha256', SEGREDO_META).update(webhook).digest('hex') },
  });
  const semAssinatura = await http(`http://127.0.0.1:${portaBot}/webhook`, { method: 'POST', body: webhook });
  assert.equal(semAssinatura.status, 401, 'webhook sem assinatura da Meta é recusado');
  assert.equal((await enviarWebhook()).status, 200, processos.map(p => p.saida).join('\n'));

  const textos = () => enviadasMeta.filter(m => m.type === 'text' && m.to === TELEFONE).map(m => m.text.body);
  const comprovante = await esperar(async () => textos().find(t => /PED-/.test(t)), `comprovante no WhatsApp\n${bot.saida}`);

  // Preço vem do banco (Grande = R$ 30,00 no seed), não da IA, que só mandou código e quantidade.
  assert.match(comprovante, /2x Filé de Frango Acebolado \(Grande\)/);
  assert.match(comprovante, /R\$ 60,00/);
  assert.equal(pedidosAoModelo.length, 1, 'pedido gravado: o bot não chama o modelo de novo');
  const codigoPedido = /PED-[\w-]+/.exec(comprovante)[0];

  // Meta reenvia o mesmo webhook: nada é processado de novo.
  assert.equal((await enviarWebhook()).status, 200);
  await new Promise(resolve => setTimeout(resolve, 1500));
  assert.equal(textos().filter(t => /PED-/.test(t)).length, 1);
  assert.equal(pedidosAoModelo.length, 1);

  // ------------------------------------------------ cozinha: agente de impressão pega o pedido e manda para a térmica
  const recebidoImpressora = [];
  const impressora = net.createServer(s => s.on('data', d => recebidoImpressora.push(d)));
  await new Promise(resolve => impressora.listen(0, '127.0.0.1', resolve));
  const cicloImpressao = criarAgente({
    apiUrl: `http://127.0.0.1:${portaPainel}/api`, token: TOKEN_IMPRESSORA, log: () => {},
    imprimir: bytes => enviarParaImpressora(bytes, { ip: '127.0.0.1', porta: impressora.address().port }),
  });
  await cicloImpressao();
  await cicloImpressao(); // segunda passada não imprime de novo
  await new Promise(resolve => impressora.close(resolve));
  const impresso = Buffer.concat(recebidoImpressora).toString('latin1');
  assert.equal(impresso.split(`COMANDA ${codigoPedido}`).length - 1, 1, 'comanda impressa uma vez');
  assert.match(impresso, /2x Fil\x82 de Frango Acebolado \(Grande\) +R\$ 60,00/); // "é" em PC850

  // ------------------------------------------------ painel: login com CSRF e despacho do pedido
  const cookies = new Map();
  const chamarPainel = async (caminho, { csrf, ...opcoes } = {}) => {
    const r = await http(`http://127.0.0.1:${portaPainel}/api${caminho}`, { ...opcoes, headers: {
      Accept: 'application/json', 'Content-Type': 'application/json',
      Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; '), ...(csrf ? { 'X-CSRF-TOKEN': csrf } : {}),
    } });
    for (const c of r.cookies) { const [par] = c.split(';'); const i = par.indexOf('='); cookies.set(par.slice(0, i), par.slice(i + 1)); }
    return r;
  };
  const { csrf } = (await chamarPainel('/auth/csrf')).corpo;
  const login = await chamarPainel('/auth/login', { method: 'POST', csrf, body: JSON.stringify({ email: 'admin@e2e.test', password: SENHA }) });
  assert.equal(login.status, 200, JSON.stringify(login.corpo));
  const csrfSessao = login.corpo.csrf;

  const lista = (await chamarPainel(`/pedidos?busca=${codigoPedido}`)).corpo;
  const pedido = lista.data.find(p => p.codigo_pedido === codigoPedido);
  assert.equal(pedido.status, 'em_preparo');
  assert.equal(Number(pedido.valor_total), 60);

  const semCsrf = await chamarPainel(`/pedidos/${pedido.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'saiu_para_entrega' }) });
  assert.equal(semCsrf.status, 419, 'alteração sem token CSRF é recusada');

  const despacho = await chamarPainel(`/pedidos/${pedido.id}/status`, { method: 'PATCH', csrf: csrfSessao, body: JSON.stringify({ status: 'saiu_para_entrega' }) });
  assert.equal(despacho.status, 200, JSON.stringify(despacho.corpo));
  assert.equal(despacho.corpo.notificacao_enviada, true, `${JSON.stringify(despacho.corpo)}\n${bot.saida}`);
  assert.ok(textos().some(t => t.includes(`${codigoPedido} acabou de sair para entrega`)), 'cliente recebe o aviso de despacho');
});
