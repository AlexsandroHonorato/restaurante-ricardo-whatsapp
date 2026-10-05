# BotClient — publicação na VPS (CyberPanel)

Guia para colocar o BotClient no ar na **mesma VPS do PropoClient** (CyberPanel, AlmaLinux, OpenLiteSpeed, MariaDB), com um endereço, banco, bot e dados próprios **por empresa**. O fluxo copia o do PropoClient: pacote único por commit, backup antes das migrations, troca atômica de versão, health check e volta automática se algo falhar.

> Nada foi publicado ainda. Este guia e os scripts deixam tudo pronto; a primeira execução real acontece quando você rodar `nova-empresa.sh`.

## 1. Como fica cada empresa

```text
https://<empresa>.botclient.propoclient.com.br
   ├── /            painel Angular (login, dashboard, pedidos…)
   ├── /api/...     API Laravel (mesmo domínio, cookie de sessão seguro)
   └── /webhook     bot Node (Meta → WhatsApp); o resto do bot só escuta em 127.0.0.1

/home/<empresa>.botclient.propoclient.com.br/botclient/
   releases/<SHA>/        código de uma versão (Laravel + painel em public/ + bot/)
   current -> releases/<SHA>
   shared/.env            configuração da API (preservada entre versões)
   shared/storage/        uploads e logs do Laravel
   shared/bot/            bot.env, negocio.md, conversas.log (conversas, mensagens e pedidos ficam no MySQL)
   shared/backups/        banco + uploads + dados do bot antes de cada publicação (10 mais recentes)
```

| Peça | Onde roda |
|---|---|
| Painel + API | OpenLiteSpeed (site próprio no CyberPanel), PHP 8.5 `lsphp85` |
| Banco | MariaDB, banco `bc_<empresa>` (até 16 caracteres) |
| Bot | serviço systemd `botclient-<usuário do site>`, Node 22, porta interna própria (ex.: 3101) |

Cada empresa tem o próprio usuário Linux do CyberPanel. O PropoClient não é alterado; o único efeito compartilhado é o `lswsctrl restart` do OpenLiteSpeed após cada publicação (reinício gracioso, o mesmo que o PropoClient já faz).

## 2. DNS no Registro.br

O domínio `propoclient.com.br` usa o DNS do Registro.br (`e.sec.dns.br` / `f.sec.dns.br`). Para cada empresa crie **um registro A**:

1. Entre em <https://registro.br> → **Painel** → domínio **propoclient.com.br**.
2. Abra **DNS** → **Editar zona** (modo avançado).
3. **Nova entrada**:

   | Tipo | Nome | Dados |
   |---|---|---|
   | A | `familiaricardo.botclient` | `129.121.47.198` |

   O Registro.br completa o nome com `.propoclient.com.br`. Para outra empresa, repita trocando `familiaricardo`.
4. **Salvar alterações**. A propagação costuma levar alguns minutos.
5. Confira antes de instalar (o certificado HTTPS depende disso):

   ```bash
   nslookup familiaricardo.botclient.propoclient.com.br 8.8.8.8
   # deve responder 129.121.47.198
   ```

Não é preciso registro MX, SPF ou DKIM: o BotClient não envia e-mail.

## 3. Instalar uma empresa

Pré-requisitos no seu computador (Git Bash): `git`, `ssh`, `composer`, `node`/`npm`, `python`, e o código **commitado** (o pacote leva o SHA do commit).

```bash
bash deploy/cyberpanel/nova-empresa.sh
```

O script pergunta identificador (`familiaricardo`), IP (`129.121.47.198`), porta SSH (`22022`), endereço, porta interna do bot (**uma diferente por empresa**: 3101, 3102…), nome e telefones da empresa, chaves da Meta/OpenRouter (pode deixar em branco e preencher depois) e se deve carregar o cardápio inicial. Em seguida ele:

1. confere o DNS e cria a chave `~/.ssh/id_ed25519_botclient` (pede a senha de root da VPS uma única vez);
2. roda `preparar-empresa.sh` no servidor: site no CyberPanel, banco utf8mb4, Node 22, pastas, `shared/.env`, `shared/bot/bot.env`, serviço do bot, ganchos de backup/reload, certificado Let's Encrypt, vhost (docRoot na versão ativa, `/webhook` → bot, HTTPS e cabeçalhos de segurança);
3. publica a primeira versão (`publicar.sh`) e cria o **primeiro administrador** do painel (senha digitada de forma oculta);
4. mostra a URL e o verify token do webhook da Meta e o trecho de configuração do GitHub Actions.

Pode ser repetido: nenhuma etapa troca senhas, chaves ou `.env` já criados. Senha do banco e token interno ficam só no servidor (`/root/.botclient-<empresa>` e `shared/.env`).

### Webhook da Meta

developers.facebook.com → seu app → **WhatsApp → Configuration → Webhook**:

- **Callback URL**: `https://<empresa>.botclient.propoclient.com.br/webhook`
- **Verify token**: o que o `nova-empresa.sh` mostrou (está em `shared/bot/bot.env`)
- Assine o campo **messages**.

Use um token de **System User** permanente (o token de 24h expira e o bot para de responder). Chaves deixadas em branco: edite `shared/bot/bot.env` no servidor e rode `systemctl restart botclient-<usuário>`.

### Ficha do negócio

Na primeira publicação, `negocio.md` do repositório é copiado para `shared/bot/negocio.md`. Daí em diante a ficha é da empresa: edite no servidor; publicações novas nunca a sobrescrevem.

## 4. Publicação automática (GitHub Actions)

Workflow: `.github/workflows/producao.yml`.

- **Pull request para `main`**: testes do bot (Node), painel (Angular), API (Laravel) e dos scripts de deploy. Nada é publicado.
- **Push/merge em `main`** ou **Run workflow**: testes → pacote único `botclient-<SHA>.tar.gz` → publicação em cada empresa de `EMPRESAS` (até 2 ao mesmo tempo; uma falha não interrompe as outras).
- **Sem a variável `EMPRESAS`**, o workflow testa e empacota, mas não publica em lugar nenhum. É o estado atual: pode fazer push com segurança.

### Configurar (uma vez)

1. Gere uma chave só para o Actions, no seu computador:

   ```bash
   ssh-keygen -t ed25519 -N '' -C github-actions-botclient -f ~/.ssh/botclient-actions
   ```

   Informe `~/.ssh/botclient-actions.pub` no `nova-empresa.sh` (ou acrescente a linha ao `~/.ssh/authorized_keys` do usuário do site).
2. No GitHub (`AlexsandroHonorato/restaurante-ricardo-whatsapp`) → **Settings → Environments → New environment**: `production`. Restrinja à branch `main` e, se quiser aprovar cada publicação, ative **Required reviewers**.
3. Em **Environments → production → Secrets**:

   | Secret | Conteúdo |
   |---|---|
   | `SSH_PRIVATE_KEY` | conteúdo de `~/.ssh/botclient-actions` (privada) |
   | `SSH_KNOWN_HOSTS` | linha mostrada no fim do `nova-empresa.sh` (`ssh-keyscan -p 22022 -t ed25519 129.121.47.198`). Confira o fingerprint pelo console da VPS: `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub` |
   | `SERVERS_CONFIG` | JSON com uma entrada por empresa (abaixo) |

   ```json
   {
     "familiaricardo": {
       "host": "129.121.47.198", "user": "<usuário do site>", "port": 22022, "bot_port": 3101,
       "app_dir": "/home/familiaricardo.botclient.propoclient.com.br/botclient",
       "health_url": "https://familiaricardo.botclient.propoclient.com.br/api/health",
       "backup_hook": "/usr/local/bin/botclient-backup",
       "reload_hook": "/usr/local/bin/botclient-reload"
     }
   }
   ```

   O `nova-empresa.sh` imprime essa entrada pronta, com o usuário real do site. Opcionais: `"keep_releases": 5`, `"seed_cardapio": false`.
4. Em **Settings → Secrets and variables → Actions → Variables** (do repositório): `EMPRESAS` = `["familiaricardo"]`. A partir daí cada merge em `main` publica.
5. Recomendado: **Settings → Rules** protegendo `main` (exigir PR com aprovação).

## 5. Monitoramento e alertas

Três camadas, para nada cair sem alguém saber:

1. **Monitor externo (configure uma vez, grátis):** em <https://uptimerobot.com> crie um monitor **Keyword** para `https://<empresa>.botclient.propoclient.com.br/api/health`, palavra-chave `healthy`, intervalo de 5 minutos, com alerta no app do celular/e-mail. Ele avisa se a VPS, a API, o banco **ou o bot** pararem (o health responde 503 e `"bot":"error"` quando o bot não responde).
2. **E-mail automático:** a cada 5 minutos o servidor verifica bot fora do ar, token da Meta recusado (expirado), mensagens que não puderam ser enviadas, fila de reenvio atrasada e clientes sem resposta. Um conjunto novo de problemas gera **um** e-mail para `ALERTA_EMAIL` (perguntado no `nova-empresa.sh`; fica em `shared/.env`). Enviado pelo Postfix local da VPS, remetente `noreply@propoclient.com.br`.
3. **Painel:** os mesmos problemas aparecem numa faixa vermelha no topo de todas as telas, atualizada a cada minuto.

O WhatsApp não é usado para alertas porque o problema mais comum (token expirado) derruba justamente ele.

## 6. Publicar à mão, voltar versão, diagnosticar

```bash
# Publicar o commit atual numa empresa, sem o Actions
bash deploy/cyberpanel/publicar.sh familiaricardo
```

No servidor, como usuário do site (`su - <usuário>` ou SSH com a chave do site):

```bash
cd /home/familiaricardo.botclient.propoclient.com.br/botclient
# Voltar para a versão anterior (não desfaz migrations)
APP_DIR=$PWD HEALTH_URL=https://familiaricardo.botclient.propoclient.com.br/api/health BOT_PORT=3101 \
  RELOAD_HOOK=/usr/local/bin/botclient-reload bash current/.ops/rollback.sh
# Ou para um SHA específico já publicado: ... rollback.sh <SHA completo>

tail -n 100 shared/storage/logs/deployment.log   # migrations/caches de cada publicação
tail -n 100 shared/storage/logs/laravel.log      # erros da API
ls shared/backups/                               # backups antes de cada publicação
```

Como root: `journalctl -u botclient-<usuário> -n 100` (log do bot) e `systemctl status botclient-<usuário>`.

Saúde: `https://<empresa>.botclient.propoclient.com.br/api/health` deve mostrar `"application":"BotClient","status":"healthy"` e o SHA do commit publicado.

**Nenhum script desfaz migrations nem restaura banco automaticamente.** Restaurar um backup é decisão manual (`shared/backups/<data>-<SHA>/database.sql.gz`, `uploads.tar.gz`, `bot.tar.gz`) e pode perder o que foi gravado depois dele.

## 7. Arquivos

| Arquivo | Papel |
|---|---|
| `.github/workflows/producao.yml` | testes, pacote e publicação por empresa |
| `.github/scripts/empacotar.py` | monta `botclient-<SHA>.tar.gz` (Laravel sem dev + painel + bot) |
| `.github/scripts/publicar-empresa.py` | envia o pacote por SSH (host key fixa) e chama `deploy.sh` |
| `deploy/deploy.sh`, `rollback.sh`, `release-common.sh` | publicação/volta no servidor, com trava, backup e health |
| `deploy/release-files.py` | confere checksum/manifesto, extrai com segurança e limpa versões antigas |
| `deploy/release-preflight.php` | recusa `.env` sem produção, debug ligado, sem MySQL ou sem token do bot |
| `deploy/web/spa.htaccess` | rotas `/api` × painel, HTTPS e política de segurança (CSP) |
| `deploy/cyberpanel/nova-empresa.sh` | instalação guiada (seu computador) |
| `deploy/cyberpanel/preparar-empresa.sh` | preparação idempotente do servidor (root) |
| `deploy/cyberpanel/publicar.sh` | publicação manual (seu computador) |
| `deploy/tests/` | testes dos scripts (rodam no CI em Linux) |

## 8. O que já foi verificado e o que falta

Verificado localmente (04/10/2026):

- pacote real gerado (5,2 MB) com Composer sem dev e build do Angular; extraído pelo `release-files.py`; `config:cache`, `route:cache`, `view:cache` e migrations rodaram na versão extraída; `/api/health` respondeu 200 com o SHA do pacote;
- `deploy.sh`/`rollback.sh` executados em Linux (container) com PHP/HTTP simulados: primeira publicação, volta automática por health e por migration com falha, pacote adulterado recusado, rollback e retenção (8 testes);
- `shellcheck` sem avisos e `actionlint` sem erros no workflow;
- bot sobe, responde `agente no ar` e recusa webhook sem assinatura e `/api/notificar` sem token (HTTP 401).

**Ainda não executado** (depende da VPS real): `preparar-empresa.sh` (comandos do CyberPanel, edição do vhost do OpenLiteSpeed, proxy de `/webhook`, Node 22 via `dnf`), certificado, MariaDB real, serviço systemd e o primeiro run do Actions. Na primeira instalação, acompanhe a saída do `nova-empresa.sh`; o `preparar-empresa.sh` guarda cópia `.bak-<data>` de cada arquivo de configuração do OpenLiteSpeed que altera.
