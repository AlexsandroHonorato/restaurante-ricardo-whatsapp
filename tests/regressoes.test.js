import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarNotificador } from '../lib/notificacoes.js';
import { lerJson, gravarJson } from '../lib/persistencia.js';

const pasta = mkdtempSync(join(tmpdir(), 'ricardo-test-'));
process.env.ARQ_MEMORIA = join(pasta, 'memoria.json');
process.env.ARQ_LOG = join(pasta, 'conversas.log');
process.env.ARQ_PEDIDOS = join(pasta, 'pedidos.json');
const requisicoes = [];
globalThis.fetch = async (url, options) => {
  requisicoes.push({ url, options });
  return { ok: true, json: async () => ({}) };
};
const cerebro = await import('../cerebro.js');
const pedidos = await import('../pedidos.js');
test.after(async () => {
  await new Promise(resolve => setTimeout(resolve, 350));
  rmSync(pasta, { recursive: true, force: true });
});

test('atualização parcial mantém pratos e endereço; null limpa explicitamente', () => {
  cerebro.atualizarStatusCliente('5512999991111', cerebro.STATUS_CONVERSA.PRATOS, { pratos: ['Frango'], endereco: 'Rua A' });
  const estado = cerebro.atualizarStatusCliente('5512999991111', cerebro.STATUS_CONVERSA.BEBIDAS, { pratos: undefined, endereco: undefined });
  assert.deepEqual(estado.rascunho.pratos, ['Frango']);
  assert.equal(estado.rascunho.endereco, 'Rua A');
  cerebro.atualizarStatusCliente('5512999991111', cerebro.STATUS_CONVERSA.ENDERECO, { endereco: null });
  assert.equal(estado.rascunho.endereco, null);
  assert.throws(() => cerebro.atualizarStatusCliente('5512999991111', 'inventado'));
});

test('rascunho expira no limite de 30 minutos e retorna ao início', () => {
  const estado = cerebro.atualizarStatusCliente('5512999992222', cerebro.STATUS_CONVERSA.PAGAMENTO, { pratos: ['Frango'] });
  estado.atualizado = Date.now() - 30 * 60000;
  assert.equal(cerebro.obterEstadoCliente('5512999992222').status, cerebro.STATUS_CONVERSA.INICIADA);
  assert.deepEqual(estado.rascunho.pratos, []);
});

test('pedido antes de 30 minutos continua no mesmo estágio', () => {
  const estado = cerebro.atualizarStatusCliente('5512999993333', cerebro.STATUS_CONVERSA.BEBIDAS);
  estado.atualizado = Date.now() - 10 * 60000;
  assert.equal(cerebro.obterEstadoCliente('5512999993333').status, cerebro.STATUS_CONVERSA.BEBIDAS);
});

test('busca por telefone é exata e consulta não expõe pedido de outro cliente', async () => {
  pedidos.salvarPedidos({ 'PED-A': { id: 'PED-A', telefone: '5512999991111', dataHora: new Date().toISOString(), itens: [] } });
  assert.equal(pedidos.obterUltimoPedidoPorTelefone('1111'), null);
  assert.equal((await pedidos.consultarStatusPedido('PED-A', '5512999992222')).ok, undefined);
  assert.equal((await pedidos.consultarStatusPedido('PED-A', '5512999991111')).ok, true);
});

test('total e troco brasileiros são interpretados e pedido incompleto é recusado', async () => {
  assert.equal(pedidos.converterValor('R$ 1.234,56'), 1234.56);
  assert.equal(pedidos.converterValor('30.00'), 30);
  assert.throws(() => pedidos.converterValor('A calcular'));
  await assert.rejects(pedidos.registrarPedido({ telefone: '5512999991111', nome: 'Ana', itens: ['1x Frango - R$ 30,00'], endereco: 'Rua A', formaPagamento: 'dinheiro', total: '30,00', trocoPara: '20,00' }));
  await assert.rejects(pedidos.registrarPedido({}));
});

test('notificações simultâneas com a mesma chave enviam uma vez', async () => {
  let chamadas = 0;
  const enviar = criarNotificador(async () => { chamadas++; await new Promise(resolve => setTimeout(resolve, 10)); });
  const payload = { para: '5512999991111', texto: 'Saiu para entrega', idempotency_key: 'pedido-1' };
  const resultados = await Promise.all([enviar(payload), enviar(payload)]);
  assert.equal(chamadas, 1);
  assert.equal(resultados[1].repetido, true);
});

test('falha de envio permite nova tentativa com a mesma chave', async () => {
  let chamadas = 0;
  const enviar = criarNotificador(async () => { if (++chamadas === 1) throw new Error('HTTP 503'); });
  const payload = { para: '5512999991111', texto: 'Entrega', idempotency_key: 'retry' };
  await assert.rejects(enviar(payload));
  assert.equal((await enviar(payload)).enviado, true);
  assert.equal(chamadas, 2);
  await assert.rejects(enviar({ para: 'abc', texto: 'teste' }));
});

test('persistência inválida causa erro sem apagar o arquivo', () => {
  const arquivo = join(pasta, 'atomic.json');
  gravarJson(arquivo, { a: 1 });
  assert.deepEqual(lerJson(arquivo), { a: 1 });
  writeFileSync(arquivo, '{quebrado');
  assert.throws(() => lerJson(arquivo));
});


test('consulta de status não inicia um novo pedido automaticamente', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, json: async () => String(url).includes('openrouter') ? { choices: [{ message: { content: 'Seu pedido está em preparo.' } }] } : {} });
  try {
    await cerebro.responderNaFila('5512999994444', 'quero saber o status do meu pedido');
    assert.equal(cerebro.obterEstadoCliente('5512999994444').status, cerebro.STATUS_CONVERSA.INICIADA);
  } finally { globalThis.fetch = original; }
});

test('fechamento usa comprovante direto e para de chamar modelo após gravação', async () => {
  const original = globalThis.fetch;
  let modelos = 0;
  globalThis.fetch = async url => ({ ok: true, json: async () => {
    if (!String(url).includes('openrouter')) return {};
    modelos++;
    return { choices: [{ message: { content: '', tool_calls: [{ id: 'call-1', function: {
      name: 'fechar_pedido', arguments: JSON.stringify({ nome: 'Ana', itens: ['1x Frango (Grande) - R$ 30,00'], endereco: 'Rua A, 10', formaPagamento: 'Pix', total: 'R$ 30,00' }),
    } }] } }] };
  } });
  try {
    const resposta = await cerebro.responderNaFila('5512999995555', 'confirmo meu pedido');
    assert.match(resposta, /PEDIDO CONFIRMADO COM SUCESSO/);
    assert.equal(modelos, 1);
    assert.equal(cerebro.obterEstadoCliente('5512999995555').status, cerebro.STATUS_CONVERSA.INICIADA);
    assert.deepEqual(cerebro.obterEstadoCliente('5512999995555').rascunho.pratos, []);
    assert.equal(pedidos.obterUltimoPedidoPorTelefone('5512999995555').sincronizado, true);
  } finally { globalThis.fetch = original; }
});

test('status atualizado no painel tem prioridade sobre o registro local', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ pedido: {
    codigo_pedido: 'PED-A', cliente: { telefone: '5512999991111', nome: 'Ana' },
    status: 'entregue', created_at: new Date().toISOString(), endereco: { logradouro: 'Rua A' }, valor_total: '30.00', itens: [],
  } }) });
  try {
    const resposta = await pedidos.consultarStatusPedido('PED-A', '5512999991111');
    assert.equal(resposta.status, 'entregue');
  } finally { globalThis.fetch = original; }
});


test('assinatura HMAC exige segredo válido e rejeita alterações no corpo', async () => {
  const { assinaturaValida } = await import('../lib/webhook.js');
  const { createHmac } = await import('node:crypto');
  const bruto = Buffer.from('{"entry":[]}');
  const assinatura = 'sha256=' + createHmac('sha256', 'segredo-teste').update(bruto).digest('hex');
  assert.equal(assinaturaValida(bruto, assinatura, 'segredo-teste'), true);
  assert.equal(assinaturaValida(Buffer.from('{}'), assinatura, 'segredo-teste'), false);
  assert.equal(assinaturaValida(bruto, assinatura, undefined), false);
  assert.equal(assinaturaValida(bruto, undefined, 'segredo-teste'), false);
});

test('fila preserva ordem e continua após uma tarefa falhar', async () => {
  const { criarFilaPorChave } = await import('../lib/fila.js');
  const fila = criarFilaPorChave();
  const ordem = [];
  const primeira = fila('cliente', async () => {
    await new Promise(resolve => setTimeout(resolve, 10));
    ordem.push(1);
    throw new Error('falha esperada');
  });
  const segunda = fila('cliente', async () => ordem.push(2));
  await assert.rejects(primeira);
  await segunda;
  assert.deepEqual(ordem, [1, 2]);
});


test('pedido pendente é preservado e sincronizado após recuperação da API', async () => {
  const original = globalThis.fetch;
  let disponivel = false;
  globalThis.fetch = async () => ({ ok: disponivel, status: disponivel ? 200 : 503 });
  try {
    const resultado = await pedidos.registrarPedido({ telefone: '5512999996666', nome: 'Ana', itens: ['1x Frango - R$ 30,00'], endereco: 'Rua A', formaPagamento: 'Pix', total: '30,00' });
    assert.equal(pedidos.obterPedidoPorId(resultado.id).sincronizado, false);
    disponivel = true;
    await pedidos.sincronizarPedidosPendentes();
    assert.equal(pedidos.obterPedidoPorId(resultado.id).sincronizado, true);
  } finally { globalThis.fetch = original; }
});


test('pedido abaixo do mínimo de entrega não é registrado', async () => {
  await assert.rejects(pedidos.registrarPedido({ telefone: '5512999997777', nome: 'Ana', itens: ['1x Bebida - R$ 20,00'], endereco: 'Rua A', formaPagamento: 'Pix', total: '20,00' }), /mínimo/);
  assert.equal(pedidos.obterUltimoPedidoPorTelefone('5512999997777'), null);
});
