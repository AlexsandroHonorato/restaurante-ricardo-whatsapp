// agente.js: passo 2 e passo 8. O servidor que a Meta chama (webhook) e que responde pelo WhatsApp.
// Rode com:  npm start   (lê o .env pelo --env-file do Node 20.6+)
import { createServer } from 'node:http';
import { assinaturaValida } from './lib/webhook.js';
import { criarFilaPorChave } from './lib/fila.js';
import { sincronizarPedidosPendentes } from './pedidos.js';
import { criarMensageiro } from './lib/mensageiro.js';
import { criarNotificador } from './lib/notificacoes.js';
import { responderNaFila } from './cerebro.js';


const PORTA = Number(process.env.PORTA || 3000);
const GRAPH = `https://graph.facebook.com/${process.env.GRAPH_VERSAO || 'v25.0'}`;
const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET } = process.env;

for (const k of ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN']) {
  if (!process.env[k]) console.warn(`⚠ falta ${k} no .env`);
}
if (!WHATSAPP_APP_SECRET) console.warn('⚠ sem WHATSAPP_APP_SECRET: webhooks serão rejeitados até configurar a assinatura');

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
const enviarTexto = mensageiro.enviar;
// marca como lida na Meta Cloud API



// ---------------------------------------------------------------- segurança: a URL é pública, então confira quem mandou
// ---------------------------------------------------------------- mensagens: sem duplicar (idempotência rigorosa)
const enfileirarMensagem = criarFilaPorChave();
const tratar = msg => enfileirarMensagem(msg?.from, () => processarMensagem(msg)).catch(erro => console.error('Falha no processamento:', erro.message));

// Cache de deduplicação com expiração automática
const mensagensTratadas = new Map(); // id -> timestamp
const ultimasMensagensTexto = new Map(); // `${tel}:${texto}` -> timestamp

function jaProcessada(msg) {
  if (!msg || typeof msg.id !== 'string' || typeof msg.from !== 'string') return true;
  const agora = Date.now();

  // Limpa entradas com mais de 10 minutos
  if (mensagensTratadas.size > 2000) {
    for (const [id, tempo] of mensagensTratadas.entries()) {
      if (agora - tempo > 600000) mensagensTratadas.delete(id);
    }
  }
  if (ultimasMensagensTexto.size > 2000) {
    for (const [chave, tempo] of ultimasMensagensTexto.entries()) {
      if (agora - tempo > 10000) ultimasMensagensTexto.delete(chave);
    }
  }

  // 1. Deduplicação por ID oficial da Meta
  if (mensagensTratadas.has(msg.id)) return true;
  mensagensTratadas.set(msg.id, agora);

  // 2. Deduplicação por texto recente do mesmo telefone (janela de 3 segundos para evitar retransmissões duplas da rede)
  if (msg.type === 'text' && typeof msg.text?.body === 'string') {
    const chaveTexto = `${msg.from}:${msg.text.body.trim().toLowerCase()}`;
    const ultimoEnvio = ultimasMensagensTexto.get(chaveTexto);
    if (ultimoEnvio && agora - ultimoEnvio < 3000) {
      console.log(`🛡️ [DEDUPLICAÇÃO] Mensagem repetida ignorada de ${msg.from}: "${msg.text.body}"`);
      return true;
    }
    ultimasMensagensTexto.set(chaveTexto, agora);
  }

  return false;
}

async function processarMensagem(msg) {
  const tel = msg.from;
  try {
    mensageiro.registrar(tel, msg.id);
    await mensageiro.digitando(tel);
    if (msg.type !== 'text') return await enviarTexto(tel, 'Por enquanto eu só consigo ler mensagens de texto. Pode escrever pra mim? 🙂');
    const resposta = await responderNaFila(tel, msg.text.body); // uma de cada vez por pessoa
    await enviarTexto(tel, resposta);
    console.log(`💬 ${tel}: ${msg.text.body}\n🤖 ${resposta}\n`);
  } catch (e) {
    console.error('erro ao responder', tel, e);
  }
}

// ---------------------------------------------------------------- idempotência de notificações
const notificar = criarNotificador(enviarTexto);

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
    lerCorpo(req, res, (bruto) => {
      const deveValidarAssinatura = WHATSAPP_APP_SECRET && !WHATSAPP_APP_SECRET.includes('cole-aqui');
      if (deveValidarAssinatura && !assinaturaValida(bruto, req.headers['x-hub-signature-256'], WHATSAPP_APP_SECRET)) {
        res.writeHead(401).end();
        return;
      }
      let corpo;
      try { corpo = JSON.parse(bruto); } catch { res.writeHead(400).end(); return; }
      if (!corpo || typeof corpo !== 'object' || (corpo.entry !== undefined && !Array.isArray(corpo.entry))) { res.writeHead(400).end(); return; }
      res.writeHead(200).end();
      for (const e of corpo.entry ?? []) {
        for (const c of (Array.isArray(e?.changes) ? e.changes : [])) {
          for (const m of (Array.isArray(c?.value?.messages) ? c.value.messages : [])) {
            if (!m) continue;
            // Deduplica IMEDIATAMENTE antes de enfileirar qualquer processamento
            if (jaProcessada(m)) continue;
            console.log(`📩 [WhatsApp] Mensagem recebida de ${m.from}: "${m.text?.body || m.type}"`);
            tratar(m);
          }
        }
      }
      // c.value.statuses (enviada, entregue, lida) chega aqui também e é ignorado de propósito
    });
    return;
  }

  // rota interna para envio de notificações automáticas pelo Dashboard/API com idempotência
  if (req.method === 'POST' && url.pathname === '/api/notificar') {
    const remoto = req.socket.remoteAddress;
    const token = process.env.NOTIFICACAO_TOKEN;
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remoto);
    if ((!token && process.env.NODE_ENV === 'production') || (token ? req.headers.authorization !== `Bearer ${token}` : !local)) {
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
}).listen(PORTA, () => console.log(`✅ Agente Restaurante Família Ricardo ouvindo na porta ${PORTA}`));



const reconciliarPedidos = () => sincronizarPedidosPendentes().catch(erro => console.error('Falha na reconciliação de pedidos:', erro.message));
reconciliarPedidos();
setInterval(reconciliarPedidos, 60000).unref();
