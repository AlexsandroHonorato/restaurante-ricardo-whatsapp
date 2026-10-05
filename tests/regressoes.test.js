import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarNotificador } from '../lib/notificacoes.js';

const pasta = mkdtempSync(join(tmpdir(), 'ricardo-test-'));
process.env.ARQ_LOG = join(pasta, 'conversas.log');
// Cada empresa tem a própria ficha fora do código publicado.
process.env.ARQ_NEGOCIO = join(pasta, 'negocio.md');
writeFileSync(process.env.ARQ_NEGOCIO, readFileSync(new URL('../negocio.md', import.meta.url), 'utf8') + '\nMARCADOR-FICHA-DA-EMPRESA\n');
const agendaAberta = { fuso: 'America/Sao_Paulo', horarios: Array.from({ length: 7 }, (_, i) => ({ dia_semana: i + 1, ativo: true, hora_inicio: '00:00:00', hora_fim: '23:59:59' })) };
globalThis.fetch = async () => ({ ok: true, json: async () => ({}) });
const cerebro = await import('../cerebro.js');
const pedidos = await import('../pedidos.js');
test.after(async () => {
  await new Promise(resolve => setTimeout(resolve, 350));
  rmSync(pasta, { recursive: true, force: true });
});

// Prompt de sistema enviado ao modelo: parte fixa (em cache) + estado do cliente.
const textoDoSistema = opcoes => JSON.parse(opcoes.body).messages[0].content.map(parte => parte.text).join('');

test('parte em cache do prompt é igual para clientes em etapas diferentes; o estado vai por último', async () => {
  const original = globalThis.fetch;
  const sistemas = [];
  globalThis.fetch = async (url, opcoes) => {
    if (String(url).includes('openrouter')) sistemas.push(JSON.parse(opcoes.body).messages[0].content);
    return { ok: true, json: async () => {
      if (String(url).includes('horarios-atendimento')) return agendaAberta;
      if (String(url).includes('/bot/conversas/5512999992020')) return { status: 'coletando_endereco', historico: [], ultimo_pedido: { codigo_pedido: 'PED-X', status: 'em_preparo', nome: 'Ana', created_at: new Date().toISOString() } };
      if (String(url).includes('/bot/conversas/')) return { status: 'conversa_iniciada', historico: [] };
      if (String(url).includes('openrouter')) return { choices: [{ message: { content: 'ok' } }] };
      return {};
    } };
  };
  try {
    cerebro.limparMemoria('5512999992020');
    cerebro.limparMemoria('5512999992121');
    await cerebro.responderNaFila('5512999992020', 'Rua A, 10');
    await cerebro.responderNaFila('5512999992121', 'oi');
    const [a, b] = sistemas;
    assert.deepEqual(a[0].cache_control, { type: 'ephemeral' });
    assert.equal(a[0].text, b[0].text);
    assert.doesNotMatch(a[0].text, /PED-X|coletando_endereco"|STATUS ATUAL: /);
    assert.match(a[1].text, /STATUS ATUAL: "coletando_endereco"/);
    assert.match(b[1].text, /STATUS ATUAL: "conversa_iniciada"/);
  } finally { globalThis.fetch = original; }
});

// Resposta da API Laravel a POST /pedidos: código, preços e total calculados pelo servidor.
function apiPedidos(chamadas = []) {
  return async (url, opcoes = {}) => {
    if (!String(url).endsWith('/pedidos') || opcoes.method !== 'POST') return { ok: true, status: 200, json: async () => ({}) };
    const corpo = JSON.parse(opcoes.body);
    chamadas.push(corpo);
    return { ok: true, status: 201, json: async () => ({ pedido: {
      codigo_pedido: 'PED-261002-123', created_at: new Date().toISOString(), valor_total: '60.00', troco_para: null,
      cliente: { nome: corpo.nome, telefone: corpo.telefone }, endereco: { logradouro: corpo.endereco },
      itens: corpo.itens.map(i => ({ nome_snapshot: 'Frango', tamanho_snapshot: 'Grande', quantidade: i.quantidade, preco_unitario: '30.00' })),
    } }) };
  };
}

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

test('após reiniciar, a conversa é recarregada do banco (etapa, rascunho, histórico e último pedido)', async () => {
  const original = globalThis.fetch;
  let prompt;
  globalThis.fetch = async (url, opcoes) => {
    if (String(url).includes('openrouter')) prompt = JSON.parse(opcoes.body).messages;
    return { ok: true, json: async () => {
      if (String(url).includes('horarios-atendimento')) return agendaAberta;
      if (String(url).includes('/bot/conversas/5512999990202')) return {
        status: 'coletando_endereco', rascunho: { pratos: ['Frango'] }, ultimo_contato_em: new Date().toISOString(),
        historico: [{ role: 'user', content: 'quero frango' }, { role: 'assistant', content: 'Anotado! Qual o endereço?' }],
        ultimo_pedido: { codigo_pedido: 'PED-261001-555', status: 'em_preparo', created_at: new Date().toISOString(), nome: 'Bia' },
      };
      if (String(url).includes('openrouter')) return { choices: [{ message: { content: 'ok' } }] };
      return {};
    } };
  };
  try {
    cerebro.limparMemoria('5512999990202');
    await cerebro.responderNaFila('5512999990202', 'Rua A, 10');
    assert.match(prompt[0].content[1].text, /STATUS ATUAL: "coletando_endereco"/);
    assert.match(prompt[0].content[1].text, /PED-261001-555/);
    assert.deepEqual(prompt.slice(1, 3).map(m => m.content), ['quero frango', 'Anotado! Qual o endereço?']);
    assert.deepEqual(cerebro.obterEstadoCliente('5512999990202').rascunho.pratos, ['Frango']);
  } finally { globalThis.fetch = original; }
});

test('cliente novo recebe o aviso de privacidade só na primeira resposta', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, json: async () => {
    if (String(url).includes('horarios-atendimento')) return agendaAberta;
    if (String(url).includes('/bot/conversas/')) return { status: null, rascunho: null, historico: [], ultimo_pedido: null };
    if (String(url).includes('openrouter')) return { choices: [{ message: { content: 'Olá! Como posso ajudar?' } }] };
    return {};
  } });
  try {
    cerebro.limparMemoria('5512999990404');
    const primeira = await cerebro.responderNaFila('5512999990404', 'oi');
    assert.match(primeira, /^🔒 .*apagados/s);
    assert.match(primeira, /Olá! Como posso ajudar\?$/);
    assert.doesNotMatch(await cerebro.responderNaFila('5512999990404', 'cardápio?'), /🔒/);
  } finally { globalThis.fetch = original; }
});

test('cliente que já conversou não recebe o aviso de novo após reiniciar', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, json: async () => {
    if (String(url).includes('horarios-atendimento')) return agendaAberta;
    if (String(url).includes('/bot/conversas/')) return { status: 'conversa_iniciada', historico: [{ role: 'user', content: 'oi' }] };
    if (String(url).includes('openrouter')) return { choices: [{ message: { content: 'De novo por aqui!' } }] };
    return {};
  } });
  try {
    cerebro.limparMemoria('5512999990505');
    assert.equal(await cerebro.responderNaFila('5512999990505', 'oi'), 'De novo por aqui!');
  } finally { globalThis.fetch = original; }
});

test('conversa parada há 30 minutos é recarregada do banco (dados apagados pela equipe não ficam na memória)', async () => {
  const original = globalThis.fetch;
  let consultas = 0;
  globalThis.fetch = async url => ({ ok: true, json: async () => {
    if (String(url).includes('horarios-atendimento')) return agendaAberta;
    if (String(url).endsWith('/pausa')) return { pausado: false };
    if (String(url).includes('/bot/conversas/')) { consultas++; return { status: 'conversa_iniciada', historico: [] }; }
    if (String(url).includes('openrouter')) return { choices: [{ message: { content: 'ok' } }] };
    return {};
  } });
  try {
    cerebro.limparMemoria('5512999990606');
    await cerebro.responderNaFila('5512999990606', 'oi');
    await cerebro.responderNaFila('5512999990606', 'tudo bem?');
    assert.equal(consultas, 1);
    cerebro.memoria['5512999990606'].msgs.push({ role: 'user', content: 'Sou a Maria, Rua das Flores 25' });
    cerebro.memoria['5512999990606'].atualizado = Date.now() - 30 * 60000;
    await cerebro.responderNaFila('5512999990606', 'voltei');
    assert.equal(consultas, 2);
    assert.equal(cerebro.memoria['5512999990606'].msgs.some(m => m.content.includes('Maria')), false);
  } finally { globalThis.fetch = original; }
});

test('acima do limite por minuto avisa uma vez sem chamar a IA e depois silencia', async () => {
  const original = globalThis.fetch;
  let modelos = 0;
  globalThis.fetch = async url => ({ ok: true, json: async () => {
    if (String(url).includes('horarios-atendimento')) return agendaAberta;
    if (String(url).includes('/bot/conversas/')) return { status: 'conversa_iniciada', historico: [{ role: 'user', content: 'oi' }] };
    if (String(url).includes('openrouter')) { modelos++; return { choices: [{ message: { content: 'ok' } }] }; }
    return {};
  } });
  try {
    cerebro.limparMemoria('5512999990707');
    for (let i = 0; i < 8; i++) assert.equal(await cerebro.responderNaFila('5512999990707', `msg ${i}`), 'ok');
    assert.match(await cerebro.responderNaFila('5512999990707', 'msg 9'), /muitas mensagens seguidas/);
    assert.equal(await cerebro.responderNaFila('5512999990707', 'msg 10'), null);
    assert.equal(modelos, 8);
  } finally { globalThis.fetch = original; }
});

test('ficha editada no painel entra no prompt e muda nome/telefone das mensagens', async () => {
  const original = globalThis.fetch;
  let prompt = '';
  const fichaPainel = { nome: 'Pizzaria Bella', telefone: '(12) 3333-4444', telefone_2: null, texto: '## Quem somos\nPizzas artesanais desde 2010.' };
  globalThis.fetch = async (url, opcoes) => {
    if (String(url).includes('openrouter')) prompt = textoDoSistema(opcoes);
    return { ok: true, json: async () => {
      if (String(url).includes('horarios-atendimento')) return agendaAberta;
      if (String(url).includes('/bot/empresa')) return fichaPainel;
      if (String(url).includes('/bot/conversas/')) return { status: 'conversa_iniciada', historico: [{ role: 'user', content: 'oi' }] };
      if (String(url).includes('openrouter')) return { choices: [{ message: { content: 'ok' } }] };
      return {};
    } };
  };
  try {
    cerebro.limparMemoria('5512999990808');
    await cerebro.responderNaFila('5512999990808', 'quem são vocês?');
    assert.match(prompt, /atendente virtual do Pizzaria Bella/);
    assert.match(prompt, /Pizzas artesanais desde 2010/);
    assert.doesNotMatch(prompt, /Martim de Sá/, 'a ficha do painel substitui o arquivo padrão');
    const { EMPRESA } = await import('../lib/empresa.js');
    assert.equal(EMPRESA.telefone, '(12) 3333-4444');
    assert.equal(EMPRESA.telefoneAlternativo, '', 'telefone 2 vazio no painel não herda o do .env');
  } finally { globalThis.fetch = original; }
});

test('perfil loja: vocabulário de loja e fluxo sem a etapa de bebidas', async () => {
  const original = globalThis.fetch;
  let prompt = '';
  globalThis.fetch = async (url, opcoes) => {
    if (String(url).includes('openrouter')) prompt = textoDoSistema(opcoes);
    return { ok: true, json: async () => {
      if (String(url).includes('horarios-atendimento')) return agendaAberta;
      if (String(url).includes('/bot/empresa')) return { nome: 'Loja Bela', telefone: '(12) 3333-4444', tipo_negocio: 'loja', texto: '## Quem somos\nRoupas.' };
      if (String(url).includes('/bot/conversas/')) return { status: 'conversa_iniciada', historico: [{ role: 'user', content: 'oi' }] };
      if (String(url).includes('openrouter')) return { choices: [{ message: { content: 'ok' } }] };
      return {};
    } };
  };
  try {
    cerebro.limparMemoria('5512999991010');
    await cerebro.responderNaFila('5512999991010', 'oi');
    assert.match(prompt, /INFORMAÇÕES DA LOJA:/);
    assert.match(prompt, /CATÁLOGO OFICIAL ATIVO/);
    assert.match(prompt, /relação com a loja/);
    // Códigos de etapa e o rascunho em JSON (lido pelo painel) são iguais em todos os perfis; o texto não fala em cozinha/bebidas.
    const texto = prompt.replaceAll('preparando_na_cozinha', '').replace(/ITENS REGISTRADOS NO RASCUNHO: .*/, '');
    assert.doesNotMatch(texto, /fazendo_pedido_bebidas|bebidas|cozinha|🍽️/);
    assert.match(prompt, /2\. Se status for 'fazendo_pedido_pratos'[\s\S]*'coletando_endereco'[\s\S]*3\. Se status for 'coletando_endereco'/);
  } finally { globalThis.fetch = original; }
});

test('sem ficha no painel continua usando o arquivo e o .env', async () => {
  const original = globalThis.fetch;
  let prompt = '';
  globalThis.fetch = async (url, opcoes) => {
    if (String(url).includes('openrouter')) prompt = textoDoSistema(opcoes);
    return { ok: true, json: async () => {
      if (String(url).includes('horarios-atendimento')) return agendaAberta;
      if (String(url).includes('/bot/empresa')) return { nome: null, telefone: null, telefone_2: null, texto: '' };
      if (String(url).includes('/bot/conversas/')) return { status: 'conversa_iniciada', historico: [{ role: 'user', content: 'oi' }] };
      if (String(url).includes('openrouter')) return { choices: [{ message: { content: 'ok' } }] };
      return {};
    } };
  };
  try {
    cerebro.limparMemoria('5512999990909');
    await cerebro.responderNaFila('5512999990909', 'onde fica?');
    assert.match(prompt, /atendente virtual do Restaurante Família Ricardo/);
    assert.match(prompt, /Martim de Sá/);
  } finally { globalThis.fetch = original; }
});

test('conversa assumida pela equipe no painel: bot fica em silêncio e não chama a IA', async () => {
  const original = globalThis.fetch;
  let modelos = 0;
  let pausado = true;
  globalThis.fetch = async url => ({ ok: true, json: async () => {
    if (String(url).includes('horarios-atendimento')) return agendaAberta;
    if (String(url).endsWith('/pausa')) return { pausado };
    if (String(url).includes('/bot/conversas/')) return { status: 'transbordo_humano', historico: [{ role: 'user', content: 'oi' }] };
    if (String(url).includes('openrouter')) { modelos++; return { choices: [{ message: { content: 'resposta do bot' } }] }; }
    return {};
  } });
  try {
    cerebro.limparMemoria('5512999991111');
    assert.equal(await cerebro.responderNaFila('5512999991111', 'obrigado, Ana!'), null);
    assert.equal(modelos, 0);
    pausado = false;
    assert.equal(await cerebro.responderNaFila('5512999991111', 'oi de novo'), 'resposta do bot');
  } finally { globalThis.fetch = original; }
});

test('transbordo encerrado pela equipe no painel: bot recarrega do banco e volta ao início', async () => {
  const original = globalThis.fetch;
  const tel = '5512999992222';
  let statusBanco = 'transbordo_humano';
  globalThis.fetch = async url => ({ ok: true, json: async () => {
    if (String(url).includes('horarios-atendimento')) return agendaAberta;
    if (String(url).endsWith('/pausa')) return { pausado: false, status: statusBanco };
    if (String(url).includes('/bot/conversas/')) return { status: statusBanco, historico: [] };
    if (String(url).includes('openrouter')) return { choices: [{ message: { content: 'ok' } }] };
    return {};
  } });
  try {
    cerebro.limparMemoria(tel);
    await cerebro.responderNaFila(tel, 'oi');
    assert.equal(cerebro.memoria[tel].status, 'transbordo_humano');
    statusBanco = 'conversa_iniciada';
    await cerebro.responderNaFila(tel, 'oi');
    assert.equal(cerebro.memoria[tel].status, 'conversa_iniciada');
  } finally { globalThis.fetch = original; }
});

test('sem a API a conversa não é processada (a mensagem fica pendente para nova tentativa)', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async url => (String(url).includes('horarios-atendimento')
    ? { ok: true, json: async () => agendaAberta }
    : { ok: false, status: 503, json: async () => ({}) });
  try {
    cerebro.limparMemoria('5512999990303');
    await assert.rejects(cerebro.responderNaFila('5512999990303', 'oi'));
  } finally { globalThis.fetch = original; }
});

test('pedido incompleto ou com itens fora do formato é recusado sem chamar a API', async () => {
  const original = globalThis.fetch;
  const chamadas = [];
  globalThis.fetch = apiPedidos(chamadas);
  try {
    await assert.rejects(pedidos.registrarPedido({}));
    await assert.rejects(pedidos.registrarPedido({ telefone: '5512999991111', nome: 'Ana', itens: ['1x Frango - R$ 30,00'], endereco: 'Rua A', formaPagamento: 'Pix' }));
    await assert.rejects(pedidos.registrarPedido({ telefone: '5512999991111', nome: 'Ana', itens: [{ codigo: 12, quantidade: 0 }], endereco: 'Rua A', formaPagamento: 'Pix' }));
    assert.equal(chamadas.length, 0);
  } finally { globalThis.fetch = original; }
});

test('preço, total e código do comprovante vêm da API, não da IA', async () => {
  const original = globalThis.fetch;
  const chamadas = [];
  globalThis.fetch = apiPedidos(chamadas);
  try {
    const resultado = await pedidos.registrarPedido({ telefone: '5512999993131', nome: 'Ana', itens: [{ codigo: 12, quantidade: 2 }], endereco: 'Rua A, 10', formaPagamento: 'Pix', total: 'R$ 1,00', chave: 'pedido:wamid.9' });
    assert.deepEqual(chamadas[0].itens, [{ variacao_id: 12, quantidade: 2 }]);
    assert.equal(chamadas[0].chave_idempotencia, 'pedido:wamid.9');
    assert.equal('total' in chamadas[0], false);
    assert.equal(resultado.id, 'PED-261002-123');
    assert.match(resultado.mensagemCliente, /2x Frango \(Grande\) - R\$ 30,00/);
    assert.match(resultado.mensagemCliente, /Valor Total:\* R\$ 60,00/);
  } finally { globalThis.fetch = original; }
});

test('API fora do ar: pedido não é confirmado', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  try {
    await assert.rejects(pedidos.registrarPedido({ telefone: '5512999996666', nome: 'Ana', itens: [{ codigo: 12, quantidade: 1 }], endereco: 'Rua A', formaPagamento: 'Pix' }), /indisponível/);
  } finally { globalThis.fetch = original; }
});

test('recusa da API (mínimo, item pausado ou fora do dia) chega com o motivo', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 422, json: async () => ({ message: 'Pedido mínimo para entrega: R$ 25,00.', errors: { total: ['Pedido mínimo para entrega: R$ 25,00.'] } }) });
  try {
    await assert.rejects(pedidos.registrarPedido({ telefone: '5512999997777', nome: 'Ana', itens: [{ codigo: 13, quantidade: 1 }], endereco: 'Rua A', formaPagamento: 'Pix' }), /mínimo para entrega: R\$ 25,00/);
  } finally { globalThis.fetch = original; }
});

test('consulta de status usa a API e não expõe pedido de outro telefone', async () => {
  const original = globalThis.fetch;
  const pedidoApi = { codigo_pedido: 'PED-A', cliente: { telefone: '5512999991111', nome: 'Ana' }, status: 'entregue', created_at: new Date().toISOString(), endereco: { logradouro: 'Rua A' }, valor_total: '30.00', itens: [] };
  globalThis.fetch = async url => (new URL(url).searchParams.get('telefone') === '5512999991111'
    ? { ok: true, status: 200, json: async () => ({ pedido: pedidoApi }) }
    : { ok: false, status: 404, json: async () => ({ pedido: null }) });
  try {
    const dono = await pedidos.consultarStatusPedido('PED-A', '5512999991111');
    assert.equal(dono.status, 'entregue');
    assert.equal((await pedidos.consultarStatusPedido('PED-A', '5512999992222')).ok, undefined);
  } finally { globalThis.fetch = original; }
});

test('consulta de status com a API fora do ar avisa sem inventar situação', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
  try {
    const resposta = await pedidos.consultarStatusPedido('PED-A', '5512999991111');
    assert.equal(resposta.ok, undefined);
    assert.match(resposta.mensagemStatus, /não consegui consultar/i);
  } finally { globalThis.fetch = original; }
});

test('notificações simultâneas com a mesma chave enviam uma vez', async () => {
  let chamadas = 0;
  const enviar = criarNotificador(async () => { chamadas++; await new Promise(resolve => setTimeout(resolve, 10)); return { enviado: true }; });
  const payload = { para: '5512999991111', texto: 'Saiu para entrega', idempotency_key: 'pedido-1' };
  const resultados = await Promise.all([enviar(payload), enviar(payload)]);
  assert.equal(chamadas, 1);
  assert.equal(resultados[1].repetido, true);
});

test('envio que não confirma fica pendente na fila e pode ser tentado de novo', async () => {
  let chamadas = 0;
  const enviar = criarNotificador(async (para, texto, chave) => {
    assert.equal(chave, 'retry');
    return { enviado: ++chamadas > 1 };
  });
  const payload = { para: '5512999991111', texto: 'Entrega', idempotency_key: 'retry' };
  assert.deepEqual(await enviar(payload), { ok: false, pendente: true });
  assert.equal((await enviar(payload)).enviado, true);
  assert.equal(chamadas, 2);
  await assert.rejects(enviar({ para: 'abc', texto: 'teste' }));
});

test('consulta de status não inicia um novo pedido automaticamente', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-02T15:00:00Z') });
  const original = globalThis.fetch;
  globalThis.fetch = async url => ({ ok: true, json: async () => String(url).includes('horarios-atendimento') ? agendaAberta : String(url).includes('openrouter') ? { choices: [{ message: { content: 'Seu pedido está em preparo.' } }] } : {} });
  try {
    await cerebro.responderNaFila('5512999994444', 'quero saber o status do meu pedido');
    assert.equal(cerebro.obterEstadoCliente('5512999994444').status, cerebro.STATUS_CONVERSA.INICIADA);
  } finally { globalThis.fetch = original; }
});

test('prompt enviado ao modelo contém a regra para mensagem fora de contexto', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-02T15:00:00Z') });
  const original = globalThis.fetch;
  let prompt = '';
  globalThis.fetch = async (url, opcoes) => {
    if (String(url).includes('openrouter')) prompt = textoDoSistema(opcoes);
    return { ok: true, json: async () => String(url).includes('horarios-atendimento') ? agendaAberta : String(url).includes('openrouter') ? { choices: [{ message: { content: 'ok' } }] } : {} };
  };
  try {
    await cerebro.responderNaFila('5512999990101', 'quem ganhou o jogo ontem?');
    assert.match(prompt, /MENSAGEM FORA DO CONTEXTO/);
    assert.match(prompt, /MARCADOR-FICHA-DA-EMPRESA/);
    assert.match(prompt, /Desculpe, não entendi\. 😅 Por favor, escolha uma das opções acima\./);
  } finally { globalThis.fetch = original; }
});

test('fechamento usa comprovante direto, chave da mensagem e para de chamar modelo após gravação', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-02T15:00:00Z') });
  const original = globalThis.fetch;
  let modelos = 0;
  const chamadas = [];
  const api = apiPedidos(chamadas);
  globalThis.fetch = async (url, opcoes) => {
    if (String(url).endsWith('/pedidos')) return api(url, opcoes);
    return { ok: true, json: async () => {
      if (String(url).includes('horarios-atendimento')) return agendaAberta;
      if (!String(url).includes('openrouter')) return {};
      modelos++;
      return { choices: [{ message: { content: '', tool_calls: [{ id: 'call-1', function: {
        name: 'fechar_pedido', arguments: JSON.stringify({ nome: 'Ana', itens: [{ codigo: 12, quantidade: 1 }], endereco: 'Rua A, 10', formaPagamento: 'Pix' }),
      } }] } }] };
    } };
  };
  try {
    const resposta = await cerebro.responderNaFila('5512999995555', 'confirmo meu pedido', { chave: 'wamid.77' });
    assert.match(resposta, /PEDIDO CONFIRMADO COM SUCESSO/);
    assert.equal(modelos, 1);
    assert.equal(chamadas[0].chave_idempotencia, 'pedido:wamid.77');
    assert.equal(cerebro.obterEstadoCliente('5512999995555').status, cerebro.STATUS_CONVERSA.INICIADA);
    assert.deepEqual(cerebro.obterEstadoCliente('5512999995555').rascunho.pratos, []);
    assert.equal(cerebro.memoria['5512999995555'].ultimoPedido.codigo_pedido, 'PED-261002-123');
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

test('mensagem enviada há mais de 10 minutos (reentrega tardia da Meta) é reconhecida como antiga', async () => {
  const { mensagemAntiga } = await import('../lib/webhook.js');
  const agora = Date.parse('2026-10-05T12:00:00Z');
  const ha = minutos => ({ timestamp: String(agora / 1000 - minutos * 60) });
  assert.equal(mensagemAntiga(ha(0), agora), false);
  assert.equal(mensagemAntiga(ha(9), agora), false);
  assert.equal(mensagemAntiga(ha(11), agora), true);
  assert.equal(mensagemAntiga(ha(55), agora), true);
  assert.equal(mensagemAntiga({}, agora), false);
  assert.equal(mensagemAntiga({ timestamp: 'x' }, agora), false);
});

test('rota de notificação exige token configurado, mesmo para chamadas locais', async () => {
  const { notificacaoAutorizada } = await import('../lib/webhook.js');
  assert.equal(notificacaoAutorizada(undefined, undefined), false);
  assert.equal(notificacaoAutorizada('Bearer ', ''), false);
  assert.equal(notificacaoAutorizada('Bearer errado', 'token-certo'), false);
  assert.equal(notificacaoAutorizada('token-certo', 'token-certo'), false);
  assert.equal(notificacaoAutorizada('Bearer token-certo', 'token-certo'), true);
});

test('dados da empresa vêm da configuração e mantêm os textos atuais por padrão', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404, json: async () => ({ pedido: null }) });
  try {
    const resposta = await pedidos.consultarStatusPedido('PED-INEXISTENTE', '5512999990000');
    assert.equal(resposta.mensagemStatus, 'Não encontrei nenhum pedido em andamento com os dados informados. 🔍\nPara falar com nossa equipe, ligue para (12) 99750-0045.');
    assert.match(pedidos.formatarComanda({ id: 'PED-1', dataHora: new Date().toISOString(), itens: [] }), /RESTAURANTE FAMÍLIA RICARDO/);
  } finally { globalThis.fetch = original; }
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

test('fora do atendimento responde sem consultar cardápio ou chamar modelo', async () => {
  const original = globalThis.fetch;
  const chamadas = [];
  globalThis.fetch = async url => {
    chamadas.push(String(url));
    return { ok: true, json: async () => ({ ...agendaAberta, horarios: agendaAberta.horarios.map(h => ({ ...h, ativo: false })) }) };
  };
  try {
    const resposta = await cerebro.responderNaFila('5512999998888', 'quero pedir');
    assert.match(resposta, /fora do horário de atendimento/);
    assert.equal(chamadas.length, 1);
    assert.match(chamadas[0], /horarios-atendimento$/);
  } finally { globalThis.fetch = original; }
});
