// agente.js: passo 2 e passo 8. O servidor que a Meta chama (webhook) e que responde pelo WhatsApp.
// Rode com:  npm start   (lê o .env pelo --env-file do Node 20.6+)
import { createServer } from 'node:http';
import { assinaturaValida, criarFiltroDeAtrasadas, mensagemAntiga, notificacaoAutorizada } from './lib/webhook.js';
import { EMPRESA, definirFicha } from './lib/empresa.js';
import { criarFilaPorChave } from './lib/fila.js';
import { criarMensageiro } from './lib/mensageiro.js';
import { criarNotificador } from './lib/notificacoes.js';
import { criarCaixaPostal } from './lib/caixa-postal.js';
import { apiBot } from './lib/api-bot.js';
import { responderNaFila } from './cerebro.js';


const PORTA = Number(process.env.PORTA || 3000);
// GRAPH_URL só é trocado no teste ponta a ponta (tests/e2e), que simula a Meta localmente.
const GRAPH = process.env.GRAPH_URL || `https://graph.facebook.com/${process.env.GRAPH_VERSAO || 'v25.0'}`;
const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET } = process.env;

process.on('uncaughtException', (erro) => console.error('🚨 [ERRO NÃO TRATADO NO PROCESSO]:', erro));
process.on('unhandledRejection', (motivo) => console.error('🚨 [PROMISE REJEITADA NÃO TRATADA]:', motivo));

for (const k of ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN']) {
  if (!process.env[k]) console.warn(`⚠ falta ${k} no .env`);
}
if (!WHATSAPP_APP_SECRET) console.warn('⚠ sem WHATSAPP_APP_SECRET: webhooks serão rejeitados até configurar a assinatura');
if (!process.env.NOTIFICACAO_TOKEN) console.warn('⚠ sem NOTIFICACAO_TOKEN: /api/notificar recusará todas as chamadas');

// ---------------------------------------------------------------- enviar pelo WhatsApp
async function graph(corpo) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const r = await fetch(`${GRAPH}/${phoneId}/messages`, {
    signal: AbortSignal.timeout(15000),
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...corpo }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    if (r.status === 401 || data?.error?.code === 190) {
      console.error('🚨 [TOKEN META EXPIRADO] O WHATSAPP_TOKEN expirou no .env! Por favor, gere um novo token de 24h ou crie um System User Token permanente no Meta Developers.');
    } else {
      console.error(`❌ [ERRO WHATSAPP HTTP ${r.status}]:`, JSON.stringify(data));
    }
    throw new Error(`WhatsApp HTTP ${r.status}: ${data?.error?.message || 'Erro de envio'}`);
  }
  return data;
}
const mensageiro = criarMensageiro(graph);

// ---------------------------------------------------------------- mensagens duráveis (tabela mensagens_whatsapp)
// Toda entrada é gravada antes de responder 200 à Meta e toda saída antes de enviar: reinício ou falha não perde nada.
const caixa = criarCaixaPostal({ api: apiBot, responder: responderNaFila, enviarTexto: mensageiro.enviar });
const enfileirarMensagem = criarFilaPorChave();
// Uma mensagem por vez por telefone, na ordem de chegada.
const tratar = entrada => enfileirarMensagem(entrada.telefone, async () => {
  await mensageiro.digitando(entrada.telefone);
  await caixa.processar(entrada);
}).catch(erro => console.error(JSON.stringify({ evento: 'processamento_falhou', mensagem: entrada.id, erro: erro.message })));

// Retransmissão dupla da rede (mesmo texto do mesmo telefone em até 3s, com IDs diferentes) é descartada.
const ultimasMensagensTexto = new Map();
function repetidaPelaRede(msg) {
  if (msg.type !== 'text' || typeof msg.text?.body !== 'string') return false;
  const agora = Date.now();
  if (ultimasMensagensTexto.size > 2000) {
    for (const [chave, tempo] of ultimasMensagensTexto) if (agora - tempo > 10000) ultimasMensagensTexto.delete(chave);
  }
  const chave = `${msg.from}:${msg.text.body.trim().toLowerCase()}`;
  const anterior = ultimasMensagensTexto.get(chave);
  ultimasMensagensTexto.set(chave, agora);
  return anterior !== undefined && agora - anterior < 3000;
}

const atrasadaRepetida = criarFiltroDeAtrasadas();
// Tempos configurados no painel já valem para a fila que a Meta entrega logo após o bot subir.
apiBot.empresa().then(definirFicha).catch(erro => console.warn(JSON.stringify({ evento: 'ficha_empresa_indisponivel', erro: erro.message })));

// Notificações do painel também passam pela saída durável (reenvio automático se falhar).
const notificar = criarNotificador(async (para, texto, chave) => {
  const { mensagem } = await apiBot.criarSaida({ telefone: para, texto, chave });
  if (mensagem.status === 'enviada') return { repetido: true };
  return { enviado: await caixa.enviar(mensagem) };
});

// Retoma entradas paradas e reenvia saídas vencidas (bot reiniciado, IA, API ou Meta fora do ar).
const retomar = () => caixa.retomar().catch(erro => console.error(JSON.stringify({ evento: 'retomada_indisponivel', erro: erro.message })));
setTimeout(retomar, 5000).unref();
setInterval(retomar, 15000).unref();

function lerCorpo(req, res, tratarCorpo) {
  const partes = [];
  let tamanho = 0;
  let excedeu = false;
  req.on('data', parte => {
    tamanho += parte.length;
    if (tamanho > 1024 * 1024) {
      if (!excedeu) res.writeHead(413).end();
      excedeu = true;
      partes.length = 0;
    } else if (!excedeu) partes.push(parte);
  });
  req.on('error', () => { if (!res.writableEnded) res.writeHead(400).end(); });
  req.on('end', () => { if (!excedeu) tratarCorpo(Buffer.concat(partes)); });
}

// ---------------------------------------------------------------- o servidor
createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // a Meta confere o seu webhook uma vez, com um GET
  if (req.method === 'GET' && url.pathname === '/webhook') {
    const ok = Boolean(WHATSAPP_VERIFY_TOKEN) && url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === WHATSAPP_VERIFY_TOKEN;
    res.writeHead(ok ? 200 : 403).end(ok ? url.searchParams.get('hub.challenge') : 'token errado');
    return;
  }

  // cada mensagem nova chega num POST
  if (req.method === 'POST' && url.pathname === '/webhook') {
    lerCorpo(req, res, async (bruto) => {
      if (!assinaturaValida(bruto, req.headers['x-hub-signature-256'], WHATSAPP_APP_SECRET)) {
        res.writeHead(401).end();
        return;
      }
      let corpo;
      try { corpo = JSON.parse(bruto); } catch { res.writeHead(400).end(); return; }
      if (!corpo || typeof corpo !== 'object' || (corpo.entry !== undefined && !Array.isArray(corpo.entry))) { res.writeHead(400).end(); return; }
      const mensagens = (corpo.entry ?? [])
        .flatMap(e => (Array.isArray(e?.changes) ? e.changes : []))
        .flatMap(c => (Array.isArray(c?.value?.messages) ? c.value.messages : []))
        .filter(m => m && typeof m.id === 'string' && /^\d{10,15}$/.test(m.from ?? '') && !repetidaPelaRede(m));
      // c.value.statuses (enviada, entregue, lida) chega aqui também e é ignorado de propósito
      let novas;
      try {
        novas = await caixa.receber(mensagens);
      } catch (erro) {
        // Sem gravar não confirmamos: a Meta reenvia o webhook mais tarde.
        console.error(JSON.stringify({ evento: 'webhook_nao_gravado', erro: erro.message }));
        res.writeHead(503).end();
        return;
      }
      res.writeHead(200).end();
      const novasIds = new Set(novas.map(entrada => entrada.wa_message_id));
      const agora = Date.now();
      // Sem resposta do bot: "ignorada" = chegou tarde demais, o cliente ficou sem resposta e a equipe é avisada no painel;
      // "processada" = repetição da fila acumulada, o cliente já recebeu a resposta da primeira mensagem.
      const semResposta = new Map();
      for (const m of mensagens) {
        if (!novasIds.has(m.id)) continue;
        if (mensagemAntiga(m, agora, EMPRESA.minutosMensagemAntiga * 60000)) semResposta.set(m.id, 'ignorada');
        else if (atrasadaRepetida(m, agora, EMPRESA.minutosFilaAcumulada * 60000)) semResposta.set(m.id, 'processada');
      }
      for (const entrada of novas) {
        // Fica no histórico da conversa, mas o bot não responde nem muda a etapa.
        const status = semResposta.get(entrada.wa_message_id);
        if (status) {
          console.warn(JSON.stringify({ evento: 'mensagem_antiga_ignorada', mensagem: entrada.id, telefone: entrada.telefone, status }));
          apiBot.atualizar(entrada.id, { status }).catch(erro => console.error(JSON.stringify({ evento: 'mensagem_antiga_nao_marcada', mensagem: entrada.id, erro: erro.message })));
          continue;
        }
        mensageiro.registrar(entrada.telefone, entrada.wa_message_id);
        console.log(`📩 [WhatsApp] Mensagem recebida de ${entrada.telefone}: "${entrada.texto ?? entrada.tipo}"`);
        tratar(entrada);
      }
    });
    return;
  }

  // rota interna para envio de notificações automáticas pelo Dashboard/API com idempotência
  if (req.method === 'POST' && url.pathname === '/api/notificar') {
    if (!notificacaoAutorizada(req.headers.authorization, process.env.NOTIFICACAO_TOKEN)) {
      res.writeHead(401).end();
      return;
    }
    lerCorpo(req, res, async bruto => {
      try {
        let dados;
        try { dados = JSON.parse(bruto); } catch { throw new TypeError('JSON inválido'); }
        if (!dados || Array.isArray(dados) || typeof dados !== 'object') throw new TypeError('Payload inválido');
        const resultado = await notificar(dados);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(resultado));
      } catch (err) {
        const codigo = err instanceof TypeError ? 400 : 502;
        console.error('Falha de notificação:', err.message);
        res.writeHead(codigo, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: false, erro: err.message }));
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('agente no ar');
  // Em produção ESCUTAR_EM=127.0.0.1: só o servidor web (proxy de /webhook) e a API local alcançam o bot.
}).listen(PORTA, process.env.ESCUTAR_EM || undefined, () => console.log(`✅ Agente ${EMPRESA.nome} ouvindo na porta ${PORTA}`));



