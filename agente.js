// agente.js: passo 2 e passo 8. O servidor que a Meta chama (webhook) e que responde pelo WhatsApp.
// Rode com:  npm start   (lê o .env pelo --env-file do Node 20.6+)
import { createServer } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { responderNaFila } from './cerebro.js';


const PORTA = Number(process.env.PORTA || 3000);
const GRAPH = `https://graph.facebook.com/${process.env.GRAPH_VERSAO || 'v25.0'}`;
const { WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET } = process.env;

for (const k of ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN']) {
  if (!process.env[k]) console.warn(`⚠ falta ${k} no .env`);
}
if (!WHATSAPP_APP_SECRET) console.warn('⚠ sem WHATSAPP_APP_SECRET: a assinatura do webhook NÃO está sendo conferida (obrigatório em produção)');

// ---------------------------------------------------------------- enviar pelo WhatsApp
async function graph(corpo) {
  const r = await fetch(`${GRAPH}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...corpo }),
  });
  if (!r.ok) console.error('WhatsApp', r.status, await r.text());
}
const enviarTexto = (para, texto) => graph({ recipient_type: 'individual', to: para, type: 'text', text: { preview_url: false, body: texto } });
// marca como lida na Meta Cloud API
const marcarComoLida = (id) => graph({ status: 'read', message_id: id });


// ---------------------------------------------------------------- segurança: a URL é pública, então confira quem mandou
function assinaturaValida(bruto, cabecalho) {
  if (!WHATSAPP_APP_SECRET || WHATSAPP_APP_SECRET.includes('cole-aqui')) return true;
  const esperado = 'sha256=' + createHmac('sha256', WHATSAPP_APP_SECRET).update(bruto).digest('hex');
  const a = Buffer.from(esperado), b = Buffer.from(cabecalho || '');
  const valida = a.length === b.length && timingSafeEqual(a, b);
  if (!valida) console.warn('⚠️ Assinatura HMAC do webhook inválida. Verifique o WHATSAPP_APP_SECRET no .env');
  return valida;
}


// ---------------------------------------------------------------- mensagens: sem duplicar
const vistas = new Set(); // a Meta pode reenviar a mesma mensagem: guarda os ids já tratados

async function tratar(msg) {
  if (vistas.has(msg.id)) return;
  vistas.add(msg.id);
  if (vistas.size > 5000) vistas.delete(vistas.values().next().value);
  const tel = msg.from;
  try {
    try { await marcarComoLida(msg.id); } catch { /* silencia erro de read receipt */ }
    if (msg.type !== 'text') return await enviarTexto(tel, 'Por enquanto eu só consigo ler mensagens de texto. Pode escrever pra mim? 🙂');
    const resposta = await responderNaFila(tel, msg.text.body); // uma de cada vez por pessoa
    await enviarTexto(tel, resposta);
    console.log(`💬 ${tel}: ${msg.text.body}\n🤖 ${resposta}\n`);
  } catch (e) {
    console.error('erro ao responder', tel, e);
  }

}

// ---------------------------------------------------------------- idempotência de notificações
const notificacoesEnviadas = new Map(); // key -> timestamp (expira em 10 minutos)
const LIMPAR_NOTIFICACOES_MS = 10 * 60 * 1000;

function verificarIdempotencia(chave) {
  const agora = Date.now();
  // Limpeza periódica
  for (const [k, exp] of notificacoesEnviadas.entries()) {
    if (agora - exp > LIMPAR_NOTIFICACOES_MS) notificacoesEnviadas.delete(k);
  }
  if (notificacoesEnviadas.has(chave)) {
    return false; // Já foi enviada recentemente (duplicada)
  }
  notificacoesEnviadas.set(chave, agora);
  return true; // Primeira vez (permitida)
}

// ---------------------------------------------------------------- o servidor
createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // a Meta confere o seu webhook uma vez, com um GET
  if (req.method === 'GET' && url.pathname === '/webhook') {
    const ok = url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === WHATSAPP_VERIFY_TOKEN;
    res.writeHead(ok ? 200 : 403).end(ok ? url.searchParams.get('hub.challenge') : 'token errado');
    return;
  }

  // cada mensagem nova chega num POST
  if (req.method === 'POST' && url.pathname === '/webhook') {
    const partes = [];
    req.on('data', (p) => partes.push(p));
    req.on('end', () => {
      const bruto = Buffer.concat(partes);
      if (!assinaturaValida(bruto, req.headers['x-hub-signature-256'])) {
        res.writeHead(401).end();
        return;
      }
      res.writeHead(200).end(); // responde já: a Meta reenvia se você demorar
      let corpo;
      try { corpo = JSON.parse(bruto); } catch { return; }
      for (const e of corpo.entry ?? []) {
        for (const c of e.changes ?? []) {
          for (const m of c.value?.messages ?? []) {
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
    const partes = [];
    req.on('data', (p) => partes.push(p));
    req.on('end', async () => {
      try {
        const dados = JSON.parse(Buffer.concat(partes).toString('utf8'));
        const { para, texto, idempotency_key } = dados;
        if (!para || !texto) {
          res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ erro: 'Informe "para" e "texto"' }));
          return;
        }

        // Chave de idempotência (fornecida ou gerada a partir do destinatário + texto)
        const chaveUnica = idempotency_key || `notif_${para}_${texto.substring(0, 30)}`;
        if (!verificarIdempotencia(chaveUnica)) {
          console.log(`🛡️ [IDEMPOTÊNCIA] Notificação duplicada bloqueada para ${para} (chave: ${chaveUnica})`);
          res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, repetido: true, mensagem: 'Notificação já enviada anteriormente' }));
          return;
        }

        await enviarTexto(para, texto);
        console.log(`📢 [NOTIFICAÇÃO DISPARADA] WhatsApp: ${para}\nTexto: ${texto}\n`);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true, enviado: true, para }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ erro: err.message }));
      }
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('agente no ar');
}).listen(PORTA, () => console.log(`✅ Agente Restaurante Família Ricardo ouvindo na porta ${PORTA}`));


