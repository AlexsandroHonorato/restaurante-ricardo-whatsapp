# Impressão automática da comanda (Bematech MP-4200 TH em rede)

Quando o cliente fecha o pedido no WhatsApp, a comanda sai sozinha na térmica da cozinha, em até 5 segundos.
Quem imprime é o **agente de impressão** (`impressora/agente-impressao.mjs`), que roda no computador da cozinha:
ele consulta a API, pega cada pedido novo e manda direto para a impressora pela rede (ESC/POS, porta 9100),
com acentos e corte do papel. Não precisa do painel aberto.

- Cada pedido sai **uma vez**. Se a impressora estiver desligada ou sem papel, o pedido volta para a fila e sai
  quando ela voltar.
- Só entram pedidos das **últimas 12 horas**: ao instalar, o histórico antigo não é impresso.
- Reimpressão continua no painel: Pedidos → botão "🖨️ Comanda".
- Se a "Impressão automática" do navegador também estiver ligada, não duplica (quem pegar primeiro imprime),
  mas o recomendado é deixá-la **desligada** e usar só o agente.

## 1. Impressora (uma vez)

1. Ligue a MP-4200 TH na rede do restaurante (cabo Ethernet).
2. Instale no Windows o **Bematech User Software** (site da Bematech/Elgin) e, nele:
   - **Conjunto de comandos: ESC/POS** (se ficar em ESC/Bema, a comanda sai com caracteres estranhos);
   - **Página de código: 850** (padrão de fábrica no modo ESC/POS);
   - **IP fixo** na rede (ex.: `192.168.0.50`). Peça ao técnico de rede para reservar esse IP no roteador.
3. Para ver a configuração atual: com a impressora desligada, segure o botão de avanço do papel e ligue
   (autoteste; mostra o IP e o modo de comandos).

## 2. API (uma vez por empresa, na VPS)

1. Gere um token: `php -r "echo bin2hex(random_bytes(24));"`
2. Coloque no `.env` da API da empresa (`/home/<dominio>/botclient/shared/.env`):
   `IMPRESSORA_TOKEN=<token gerado>`
3. Recarregue a configuração: `php artisan config:cache` na pasta `/home/<dominio>/botclient/current`
   (com o usuário do site, como nos outros comandos do docs/DEPLOY.md).

O token só dá acesso às rotas da impressora (lista de pedidos sem comanda e marcar como impresso), nada mais.

## 3. Computador da cozinha

1. Instale o **Node.js 20 ou mais novo** (nodejs.org, versão LTS).
2. Copie a pasta `impressora/` do projeto para `C:\BotClient\impressora`.
3. Copie `.env.exemplo` para `.env` e preencha:
   - `API_URL` = endereço da empresa terminando em `/api` (ex.: `https://ricardo.botclient.propoclient.com.br/api`);
   - `IMPRESSORA_TOKEN` = o mesmo token da etapa 2;
   - `IMPRESSORA_IP` = IP da impressora.
4. Teste a impressora (abra o Prompt de Comando na pasta):
   `node --env-file=.env agente-impressao.mjs --teste`
   Deve sair uma página com acentos certos e uma régua de 48 números numa linha só, e o papel deve ser cortado.
5. Rode `iniciar.cmd` e faça um pedido de teste pelo WhatsApp: a comanda sai em até 5 s.
6. Início automático com o Windows (Prompt de Comando **como administrador**):

   ```bat
   schtasks /Create /TN "BotClient Impressora" /SC ONSTART /RU SYSTEM /RL HIGHEST /TR "C:\BotClient\impressora\iniciar.cmd"
   ```

   Para parar: `schtasks /End /TN "BotClient Impressora"`. Para remover: `schtasks /Delete /TN "BotClient Impressora"`.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Nada sai e `impressao.log` mostra `impressora_falhou` | IP errado, impressora desligada ou em outra rede. Confira com o autoteste. |
| `api_indisponivel` com `401` | `IMPRESSORA_TOKEN` diferente entre o `.env` da API e o do agente, ou faltou `config:cache`. |
| Sai, mas com símbolos no lugar dos acentos | Impressora em ESC/Bema ou página de código diferente de 850. |
| Linhas quebradas no meio / valores fora da margem | Ajuste `IMPRESSORA_COLUNAS` (48 na bobina de 80 mm; use 42 se a fonte estiver maior). |
| O papel não é cortado | Guilhotina desativada no Bematech User Software. |

O log fica em `C:\BotClient\impressora\impressao.log` (uma linha por comanda impressa ou erro).
