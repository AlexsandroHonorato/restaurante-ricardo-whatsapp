import test from 'node:test';
import assert from 'node:assert/strict';
import { criarMensageiro } from '../lib/mensageiro.js';
test('mostra digitando antes de enviar e mantém envio se indicador falhar', async () => {
  const eventos = [];
  const m = criarMensageiro(async corpo => { eventos.push(corpo); if (corpo.typing_indicator) throw new Error('offline'); }, { pausa: async ms => eventos.push(ms) });
  m.registrar('5511999999999', 'wamid.teste');
  await m.enviar('5511999999999', 'Olá! Como posso ajudar?');
  assert.equal(eventos[0].typing_indicator.type, 'text');
  assert.equal(eventos[0].message_id, 'wamid.teste');
  assert.equal(eventos[1], 700);
  assert.equal(eventos[2].text.body, 'Olá! Como posso ajudar?');
});
test('sem mensagem recebida não inventa message_id', async () => {
  const eventos = [];
  const m = criarMensageiro(async corpo => eventos.push(corpo), { pausa: async () => {} });
  await m.enviar('5511999999999', 'Olá!');
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].type, 'text');
});
