import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarLimitador } from '../lib/limite-mensagens.js';

test('dentro do limite libera; ao estourar avisa uma vez e depois fica em silêncio', () => {
  let agora = 0;
  const limite = criarLimitador({ porMinuto: 3, porHora: 100, agora: () => agora });
  assert.deepEqual([1, 2, 3].map(() => limite.verificar('a')), ['ok', 'ok', 'ok']);
  assert.equal(limite.verificar('a'), 'avisar');
  assert.equal(limite.verificar('a'), 'silencio');
  assert.equal(limite.verificar('b'), 'ok', 'cada telefone tem a própria contagem');
  agora += 61000;
  assert.equal(limite.verificar('a'), 'ok', 'a janela de um minuto libera de novo');
});

test('limite por hora vale mesmo com mensagens espaçadas', () => {
  let agora = 0;
  const limite = criarLimitador({ porMinuto: 100, porHora: 4, agora: () => agora });
  const resultados = [];
  for (let i = 0; i < 6; i++) { resultados.push(limite.verificar('a')); agora += 5 * 60000; }
  assert.deepEqual(resultados, ['ok', 'ok', 'ok', 'ok', 'avisar', 'silencio']);
  agora += 60 * 60000;
  assert.equal(limite.verificar('a'), 'ok');
});

test('memória não cresce sem limite com muitos telefones', () => {
  let agora = 0;
  const limite = criarLimitador({ porMinuto: 5, porHora: 50, agora: () => agora, maxTelefones: 100 });
  for (let i = 0; i < 500; i++) limite.verificar(String(i));
  assert.ok(limite.tamanho() <= 100);
});
