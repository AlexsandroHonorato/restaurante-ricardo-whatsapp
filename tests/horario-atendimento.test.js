import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avaliarHorario, consultarAtendimento } from '../lib/horario-atendimento.js';

const agenda = { fuso: 'America/Sao_Paulo', horarios: Array.from({ length: 7 }, (_, i) => ({ dia_semana: i + 1, ativo: i < 6, hora_inicio: '11:00:00', hora_fim: '14:30:00' })) };
test('início inclusivo, fim exclusivo e domingo fechado no fuso da agenda', () => {
  assert.equal(avaliarHorario(agenda, new Date('2026-10-02T13:59:59Z')).aberto, false);
  assert.equal(avaliarHorario(agenda, new Date('2026-10-02T14:00:00Z')).aberto, true);
  assert.equal(avaliarHorario(agenda, new Date('2026-10-02T17:30:00Z')).aberto, false);
  assert.match(avaliarHorario(agenda, new Date('2026-10-04T15:00:00Z')).mensagem, /segunda-feira.*11:00/);
  assert.equal(avaliarHorario(agenda, new Date('2026-10-03T02:00:00Z')).aberto, false);
});
test('agenda incompleta é rejeitada e semana desativada não promete horário', () => {
  assert.throws(() => avaliarHorario({ ...agenda, horarios: agenda.horarios.slice(1) }));
  assert.match(avaliarHorario({ ...agenda, horarios: agenda.horarios.map(h => ({ ...h, ativo: false })) }).mensagem, /sem horários/);
});
test('API indisponível retorna mensagem sem liberar IA', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('offline'); };
  try { assert.equal((await consultarAtendimento()).aberto, false); }
  finally { globalThis.fetch = original; }
});
