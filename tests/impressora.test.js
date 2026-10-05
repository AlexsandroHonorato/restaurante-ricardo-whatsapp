import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {
  codificarCp850, criarAgente, enviarParaImpressora, formatarComanda, montarImpressao,
} from '../impressora/agente-impressao.mjs';

const PEDIDO = {
  id: 7, codigo_pedido: 'PED-261005-001', created_at: '2026-10-05T15:30:00Z', status: 'em_preparo',
  cliente: { nome: 'Ana Lima', telefone: '5512999990001' },
  endereco: { logradouro: 'Rua das Flores', numero: '10', bairro: 'Centro', complemento: 'Casa 2', ponto_referencia: null },
  itens: [
    { quantidade: 2, nome_snapshot: 'Filé de Frango Acebolado', tamanho_snapshot: 'Grande', subtotal: '60.00', adicionais: [{ quantidade: 1, nome_snapshot: 'Ovo frito' }], observacao: 'sem cebola 🙏' },
  ],
  valor_subtotal: '60.00', taxa_entrega: '5.00', valor_desconto: '0', valor_total: '65.00',
  forma_pagamento: 'dinheiro', troco_para: '100.00', observacoes: 'Interfone quebrado',
};

test('comanda de 80 mm: 48 colunas, valores alinhados e dados do pedido', () => {
  const texto = formatarComanda(PEDIDO, 48);
  const linhas = texto.split('\n');
  assert.equal(linhas[0], 'COMANDA PED-261005-001');
  assert.match(texto, /05\/10\/2026,? 12:30/); // horário de Brasília
  const linhasDeValor = linhas.filter(l => /^(\d+x |Subtotal|Entrega |TOTAL)/.test(l));
  assert.equal(linhasDeValor.length, 4);
  assert.ok(linhasDeValor.every(l => l.length === 48 && /R\$ [\d.,]+$/.test(l)), 'valores encostados na margem direita');
  assert.ok(linhas.every(l => l.length <= 48 || l.startsWith('Entrega:')));
  for (const trecho of ['2x Filé de Frango Acebolado (Grande)', '+ 1x Ovo frito', 'obs: sem cebola', 'Entrega: Rua das Flores, 10 - Centro', 'Compl.: Casa 2', 'TOTAL', 'R$ 65,00', 'Pagamento: DINHEIRO', 'Troco para R$ 100,00', 'OBS: Interfone quebrado']) {
    assert.ok(texto.includes(trecho), trecho);
  }
});

test('acentos em PC850; emoji some; caractere sem equivalente vira letra sem acento', () => {
  assert.deepEqual(codificarCp850('ção'), [0x87, 0xc6, 0x6f]);
  assert.deepEqual(codificarCp850('ÁÉÍÓÚ âêô Ãõ'), [0xb5, 0x90, 0xd6, 0xe0, 0xe9, 0x20, 0x83, 0x88, 0x93, 0x20, 0xc7, 0xe4]);
  assert.deepEqual(codificarCp850('ok 🙏👍🏽'), [0x6f, 0x6b, 0x20]);
  assert.deepEqual(codificarCp850('ñ€'), [0x6e, 0x3f]);
});

test('impressão ESC/POS: inicializa, escolhe PC850, título em destaque e corta o papel', () => {
  const bytes = [...montarImpressao('COMANDA PED-1\nlinha')];
  assert.deepEqual(bytes.slice(0, 11), [0x1b, 0x40, 0x1b, 0x74, 0x02, 0x1b, 0x45, 0x01, 0x1d, 0x21, 0x01]);
  assert.deepEqual(bytes.slice(-6), [0x1b, 0x64, 0x05, 0x1d, 0x56, 0x01]);
  assert.ok(Buffer.from(bytes).includes(Buffer.from('COMANDA PED-1\n')));
});

test('envia pela rede para a porta da impressora; impressora desligada vira erro', async () => {
  const recebidos = [];
  const impressora = net.createServer(s => s.on('data', d => recebidos.push(d)));
  await new Promise(r => impressora.listen(0, '127.0.0.1', r));
  const { port } = impressora.address();
  await enviarParaImpressora(Buffer.from([1, 2, 3]), { ip: '127.0.0.1', porta: port });
  await new Promise(r => setTimeout(r, 50));
  assert.deepEqual([...Buffer.concat(recebidos)], [1, 2, 3]);
  await new Promise(r => impressora.close(r));
  await assert.rejects(enviarParaImpressora(Buffer.from([1]), { ip: '127.0.0.1', porta: port, limiteMs: 2000 }));
});

/** API falsa: pendentes + pegar (só a primeira vez) + devolver. */
function apiFalsa(pedidos) {
  const chamadas = [];
  const pegos = new Set();
  const original = globalThis.fetch;
  globalThis.fetch = async (url, opcoes) => {
    const caminho = new URL(url).pathname.replace('/api/impressora', '');
    chamadas.push(`${opcoes.method} ${caminho}`);
    assert.equal(opcoes.headers.Authorization, 'Bearer token-impressora');
    const id = Number(caminho.match(/pedidos\/(\d+)/)?.[1]);
    let corpo = {};
    if (caminho === '/pendentes') corpo = { pedidos: pedidos.filter(p => !pegos.has(p.id)) };
    else if (opcoes.method === 'POST') { corpo = { primeira: !pegos.has(id) }; pegos.add(id); }
    else if (opcoes.method === 'DELETE') pegos.delete(id);
    return { ok: true, status: 200, json: async () => corpo };
  };
  return { chamadas, pegos, restaurar: () => { globalThis.fetch = original; } };
}

test('agente: imprime pedidos novos uma vez; se a impressora falhar, devolve e tenta no próximo ciclo', async () => {
  const api = apiFalsa([PEDIDO, { ...PEDIDO, id: 8, codigo_pedido: 'PED-261005-002' }]);
  const impressos = [];
  let impressoraLigada = false;
  const eventos = [];
  const ciclo = criarAgente({
    apiUrl: 'https://loja.test/api/', token: 'token-impressora', log: e => eventos.push(e.evento),
    imprimir: async bytes => { if (!impressoraLigada) throw new Error('sem papel'); impressos.push(bytes.toString('latin1')); },
  });
  try {
    await ciclo();
    assert.deepEqual(api.chamadas, ['GET /pendentes', 'POST /pedidos/7/comanda', 'DELETE /pedidos/7/comanda']);
    assert.deepEqual(eventos, ['impressora_falhou']);
    assert.equal(api.pegos.size, 0, 'pedido volta para a fila');

    impressoraLigada = true;
    await ciclo();
    assert.equal(impressos.length, 2);
    assert.match(impressos[0], /COMANDA PED-261005-001/);
    assert.match(impressos[1], /COMANDA PED-261005-002/);
    await ciclo();
    assert.equal(impressos.length, 2, 'não imprime de novo');
  } finally { api.restaurar(); }
});

test('agente: pedido já pego por outro aparelho não é impresso; API fora do ar só registra', async () => {
  const original = globalThis.fetch;
  const impressos = [];
  const eventos = [];
  const ciclo = criarAgente({ apiUrl: 'https://loja.test/api', token: 't', imprimir: async b => impressos.push(b), log: e => eventos.push(e.evento) });
  try {
    globalThis.fetch = async url => ({ ok: true, json: async () => (String(url).endsWith('/pendentes') ? { pedidos: [PEDIDO] } : { primeira: false }) });
    await ciclo();
    assert.equal(impressos.length, 0);
    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
    await ciclo();
    assert.deepEqual(eventos, ['api_indisponivel']);
  } finally { globalThis.fetch = original; }
});
