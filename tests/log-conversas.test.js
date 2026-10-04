import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarLogConversas } from '../lib/log-conversas.js';

const DIA = 86400000;
const agora = Date.parse('2026-10-04T12:00:00Z');
const linhas = arquivo => readFileSync(arquivo, 'utf8').trim().split('\n').map(l => JSON.parse(l));

test('remove conversas mais antigas que a retenção e mantém as recentes', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'log-'));
  const arquivo = join(pasta, 'conversas.log');
  try {
    writeFileSync(arquivo, [
      JSON.stringify({ quando: new Date(agora - 31 * DIA).toISOString(), tel: 'antigo' }),
      '{quebrado',
      JSON.stringify({ quando: new Date(agora - 2 * DIA).toISOString(), tel: 'recente' }),
    ].join('\n') + '\n');
    const registrar = criarLogConversas(arquivo, { retencaoDias: 30, agora: () => agora });
    registrar({ quando: new Date(agora).toISOString(), tel: 'novo' });
    assert.deepEqual(linhas(arquivo).map(l => l.tel), ['recente', 'novo']);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('poda no máximo uma vez por hora', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'log-'));
  const arquivo = join(pasta, 'conversas.log');
  let relogio = agora;
  try {
    const registrar = criarLogConversas(arquivo, { retencaoDias: 1, agora: () => relogio });
    registrar({ quando: new Date(relogio - 2 * DIA).toISOString(), tel: 'velho' });
    relogio += 30 * 60000;
    registrar({ quando: new Date(relogio).toISOString(), tel: 'meia-hora' });
    assert.equal(linhas(arquivo).length, 2);
    relogio += 31 * 60000;
    registrar({ quando: new Date(relogio).toISOString(), tel: 'uma-hora' });
    assert.deepEqual(linhas(arquivo).map(l => l.tel), ['meia-hora', 'uma-hora']);
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});

test('falha ao gravar o log não interrompe o atendimento', () => {
  const registrar = criarLogConversas(join(tmpdir(), 'pasta-que-nao-existe', 'x', 'conversas.log'));
  assert.doesNotThrow(() => registrar({ quando: new Date().toISOString(), tel: '1' }));
});
