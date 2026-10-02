# Agente de IA no WhatsApp

Guia completo, passo a passo: https://marcondes-whatsapp.vercel.app

## Arquivos
- `agente.js`: o servidor do webhook (recebe do WhatsApp e responde)
- `cerebro.js`: memória, ficha do negócio, modelo e ferramentas
- `agenda.js`: Cal.com (ou agenda de demonstração, sem conta)
- `negocio.md`: a ficha do SEU negócio. É o arquivo que você mais vai editar
- `simular.js`: converse com o agente no terminal, sem WhatsApp
- `testar.js`: a bateria de testes que tenta quebrar o agente

## Rodar (Node 22 ou 24)
1. Copie `.env.exemplo` para `.env` e preencha (para o simulador basta a OPENROUTER_API_KEY)
2. `npm run simular`   converse no terminal
3. `npm run testar`    rode a bateria de testes
4. `npm start`         liga o servidor do webhook (porta 3000)

Não precisa de `npm install`: o projeto não tem dependências.
