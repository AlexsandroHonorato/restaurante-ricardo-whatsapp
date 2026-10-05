import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCaixaPostal } from '../lib/caixa-postal.js';

// API falsa com o mesmo contrato das rotas /api/bot/mensagens do Laravel.
function apiFalsa({ falharEntrada = false } = {}) {
  const linhas = [];
  let id = 0;
  const api = {
    linhas,
    async registrarEntrada(m) {
      if (falharEntrada) throw new Error('API 503');
      const existente = linhas.find(l => l.wa_message_id === m.wa_message_id);
      if (existente) return { mensagem: existente, duplicada: true };
      const nova = { id: ++id, direcao: 'entrada', status: 'pendente', ...m };
      linhas.push(nova);
      return { mensagem: nova, duplicada: false };
    },
    async criarSaida(s) {
      const existente = linhas.find(l => l.chave === s.chave);
      if (existente) return { mensagem: existente };
      const nova = { id: ++id, direcao: 'saida', status: 'pendente', ...s };
      linhas.push(nova);
      return { mensagem: nova };
    },
    async atualizar(idLinha, dados) {
      Object.assign(linhas.find(l => l.id === idLinha), dados);
      return {};
    },
    async pendentes() {
      return {
        entradas: linhas.filter(l => l.direcao === 'entrada' && ['pendente', 'processando'].includes(l.status))
          .map(l => ({ ...l, respondida: linhas.some(s => s.chave === `resp:${l.wa_message_id}`) })),
        saidas: linhas.filter(l => l.direcao === 'saida' && l.status === 'pendente'),
      };
    },
  };
  return api;
}

const mensagemMeta = (id, texto = 'oi') => ({ id, from: '5512999990001', type: 'text', text: { body: texto } });

test('grava antes de confirmar e devolve só mensagens novas', async () => {
  const api = apiFalsa();
  const caixa = criarCaixaPostal({ api, responder: async () => 'ok', enviarTexto: async () => ({}) });
  assert.equal((await caixa.receber([mensagemMeta('wamid.1'), mensagemMeta('wamid.2')])).length, 2);
  assert.equal((await caixa.receber([mensagemMeta('wamid.1')])).length, 0);
  assert.equal(api.linhas.length, 2);
});

test('falha ao gravar propaga erro para o webhook responder 503 (a Meta reenvia)', async () => {
  const caixa = criarCaixaPostal({ api: apiFalsa({ falharEntrada: true }), responder: async () => 'ok', enviarTexto: async () => ({}) });
  await assert.rejects(caixa.receber([mensagemMeta('wamid.1')]));
});

test('processa: responde, grava a saída, marca processada e confirma o envio com o id da Meta', async () => {
  const api = apiFalsa();
  const contextos = [];
  const caixa = criarCaixaPostal({
    api,
    responder: async (tel, texto, contexto) => { contextos.push(contexto); return `eco: ${texto}`; },
    enviarTexto: async () => ({ messages: [{ id: 'wamid.saida' }] }),
  });
  const [entrada] = await caixa.receber([mensagemMeta('wamid.1', 'cardápio')]);
  await caixa.processar(entrada);
  const saida = api.linhas.find(l => l.direcao === 'saida');
  assert.deepEqual(contextos, [{ chave: 'wamid.1' }]);
  assert.equal(saida.chave, 'resp:wamid.1');
  assert.equal(saida.texto, 'eco: cardápio');
  assert.equal(saida.status, 'enviada');
  assert.equal(saida.meta_message_id, 'wamid.saida');
  assert.equal(api.linhas.find(l => l.direcao === 'entrada').status, 'processada');
});

test('mensagem que não é texto recebe aviso sem chamar a IA', async () => {
  const api = apiFalsa();
  let chamadas = 0;
  const caixa = criarCaixaPostal({ api, responder: async () => { chamadas++; return 'x'; }, enviarTexto: async () => ({}) });
  const [entrada] = await caixa.receber([{ id: 'wamid.audio', from: '5512999990001', type: 'audio' }]);
  await caixa.processar(entrada);
  assert.equal(chamadas, 0);
  assert.match(api.linhas.find(l => l.direcao === 'saida').texto, /só consigo ler mensagens de texto/);
});

test('resposta vazia (limite de mensagens) marca processada sem enviar nada', async () => {
  const api = apiFalsa();
  let envios = 0;
  const caixa = criarCaixaPostal({ api, responder: async () => null, enviarTexto: async () => { envios++; return {}; } });
  const [entrada] = await caixa.receber([mensagemMeta('wamid.spam')]);
  await caixa.processar(entrada);
  assert.equal(envios, 0);
  assert.equal(api.linhas.filter(l => l.direcao === 'saida').length, 0);
  assert.equal(api.linhas.find(l => l.id === entrada.id).status, 'processada');
});

test('falha no envio deixa a saída pendente para reenvio', async () => {
  const api = apiFalsa();
  const caixa = criarCaixaPostal({ api, responder: async () => 'ok', enviarTexto: async () => { throw new Error('WhatsApp HTTP 500'); }, log: { error() {} } });
  const [entrada] = await caixa.receber([mensagemMeta('wamid.1')]);
  await caixa.processar(entrada);
  const saida = api.linhas.find(l => l.direcao === 'saida');
  assert.equal(saida.status, 'pendente');
  assert.match(saida.erro, /HTTP 500/);
});

test('retomada: entrada já respondida não chama a IA de novo; não respondida é processada; saídas são reenviadas', async () => {
  const api = apiFalsa();
  let respostas = 0;
  let envios = 0;
  const caixa = criarCaixaPostal({ api, responder: async () => { respostas++; return 'ok'; }, enviarTexto: async () => { envios++; return {}; } });
  const [ja, nova] = await caixa.receber([mensagemMeta('wamid.ja'), mensagemMeta('wamid.nova')]);
  await api.criarSaida({ telefone: ja.telefone, texto: 'resposta anterior', chave: 'resp:wamid.ja' });
  await caixa.retomar();
  assert.equal(respostas, 1);
  assert.equal(envios, 2);
  assert.equal(api.linhas.find(l => l.id === ja.id).status, 'processada');
  assert.equal(api.linhas.find(l => l.id === nova.id).status, 'processada');
});

test('retomada ignora entrada que ainda está sendo processada neste processo', async () => {
  const api = apiFalsa();
  let liberar;
  let respostas = 0;
  const caixa = criarCaixaPostal({ api, responder: () => { respostas++; return new Promise(r => { liberar = () => r('ok'); }); }, enviarTexto: async () => ({}) });
  const [entrada] = await caixa.receber([mensagemMeta('wamid.lenta')]);
  const emAndamento = caixa.processar(entrada);
  await new Promise(r => setImmediate(r));
  await caixa.retomar();
  liberar();
  await emAndamento;
  assert.equal(respostas, 1);
});
