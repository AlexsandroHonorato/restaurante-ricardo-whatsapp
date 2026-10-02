// simular.js: converse com o agente no terminal, SEM WhatsApp. É o mesmo cérebro do agente.js.
// Rode com:  npm run simular      (precisa só da OPENROUTER_API_KEY no .env)
import { createInterface } from 'node:readline/promises';
import { responder, chaveOk } from './cerebro.js';

if (!chaveOk()) {
  console.error('Preencha a OPENROUTER_API_KEY no arquivo .env (passo 3).');
  process.exit(1);
}
const tel = '5511900000000'; // um número de mentira só para a memória do simulador
const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log(`\n======================================================`);
console.log(`🤖 Simulador · Restaurante Família Ricardo (Delivery)`);
console.log(`Digite suas mensagens ou "sair" para fechar.`);
console.log(`======================================================\n`);

for (;;) {
  let texto;
  try { texto = (await rl.question('você › ')).trim(); } catch { break; } // a entrada acabou (Ctrl+C ou arquivo)
  if (!texto) continue;
  if (texto.toLowerCase() === 'sair') break;
  try {
    console.log(`agente › ${await responder(tel, texto)}\n`);
  } catch (e) {
    console.error(`⚠ ${e.message}\n`);
  }
}
rl.close();
