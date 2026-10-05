#!/usr/bin/env bash
# Prepara a VPS com CyberPanel (AlmaLinux + OpenLiteSpeed + MariaDB) para receber o BotClient de UMA empresa.
# Roda NO SERVIDOR, como root. Pode ser repetido: cada etapa só faz o que ainda falta e nunca troca
# senhas, chaves ou .env já criados. Não mexe nos sites do PropoClient.
#
#   preparar-empresa.sh <pasta-com-empresa.env>
#
# A pasta (enviada por nova-empresa.sh) contém: empresa.env (respostas), env.example (backend/.env.example),
# spa.htaccess (deploy/web) e deploy.pub (chaves públicas que podem publicar).
set -Eeuo pipefail
umask 077
HERE="$(cd -- "${1:?informe a pasta com empresa.env}" && pwd)"
log() { printf '\n[BotClient] %s\n' "$*"; }
fail() { printf '\n[BotClient] ERRO: %s\n' "$*" >&2; exit 1; }
trap 'fail "falhou na linha $LINENO: $BASH_COMMAND"' ERR

[[ "$(id -u)" == 0 ]] || fail 'rode como root.'
command -v cyberpanel >/dev/null || fail 'CyberPanel não encontrado neste servidor.'
PHP=/usr/local/lsws/lsphp85/bin/php
[[ -x "$PHP" ]] || fail 'PHP 8.5 do LiteSpeed (lsphp85) não encontrado; instale pelo CyberPanel.'

declare -A CFG=()
while IFS='=' read -r key value; do
    [[ "$key" =~ ^[A-Z0-9_]+$ ]] && CFG[$key]="${value%$'\r'}"
done < "$HERE/empresa.env"
cfg() { printf '%s' "${CFG[$1]:-}"; }
check() { [[ "$(cfg "$1")" =~ $2 ]] || fail "valor inválido em empresa.env: $1"; }
check SLUG '^[a-z][a-z0-9-]{1,30}$'
check DOMAIN '^[a-z0-9]([a-z0-9-]*\.)+[a-z]{2,}$'
check ADMIN_EMAIL '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$'
check ALERTA_EMAIL '^([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+)?$'
check BOT_PORT '^(3[1-9][0-9]{2}|[4-9][0-9]{3})$'
check EMPRESA_NOME '^[^"\\$`]{3,120}$'
check EMPRESA_TELEFONE '^[0-9 ()+-]{0,25}$'
check EMPRESA_TELEFONE_2 '^[0-9 ()+-]{0,25}$'
for key in WHATSAPP_TOKEN WHATSAPP_PHONE_NUMBER_ID WHATSAPP_VERIFY_TOKEN WHATSAPP_APP_SECRET OPENROUTER_API_KEY MODELO; do
    check "$key" '^[A-Za-z0-9_.:/-]*$'
done

SLUG="$(cfg SLUG)"
DOMAIN="$(cfg DOMAIN)"
BOT_PORT="$(cfg BOT_PORT)"
H="/home/$DOMAIN"
BASE="$H/botclient"
STATE="/root/.botclient-$SLUG"   # senha do banco e token interno, gerados uma única vez
secret() { openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | head -c "$1"; }
site_user() { stat -c %U "$H/public_html"; }
as_user() { sudo -u "$(site_user)" env HOME="$H" PATH="$H/.local/bin:/usr/bin:/bin" "$@"; }

create_site() {
    log "Site $DOMAIN no CyberPanel"
    if [[ ! -d "$H/public_html" ]]; then
        cyberpanel createWebsite --package Default --owner admin --domainName "$DOMAIN" --email "$(cfg ADMIN_EMAIL)" \
            --php 8.5 --ssl 0 --dkim 0 --openBasedir 1 | tail -1
    fi
    [[ -d "$H/public_html" && -d "/usr/local/lsws/conf/vhosts/$DOMAIN" ]] || fail 'o CyberPanel não criou o site.'
}

create_state() {
    [[ -f "$STATE" ]] && return
    log 'Senha do banco e token interno bot ↔ API (gerados uma vez)'
    # Nome curto (o CyberPanel pode limitar a 16 caracteres); confira colisão ao usar slugs parecidos.
    local banco="bc_${SLUG//-/_}"
    banco="${banco:0:16}"
    printf 'DB_DATABASE=%s\nDB_USERNAME=%s\nDB_PASSWORD=%s\nNOTIFICACAO_TOKEN=%s\n' \
        "$banco" "$banco" "$(secret 30)" "$(secret 48)" > "$STATE"
    chmod 600 "$STATE"
}

create_database() {
    log 'Banco de dados'
    # shellcheck disable=SC1090
    source "$STATE"
    if ! mariadb -Nse "SHOW DATABASES LIKE '$DB_DATABASE'" | grep -qx "$DB_DATABASE"; then
        cyberpanel createDatabase --databaseWebsite "$DOMAIN" --dbName "$DB_DATABASE" --dbUsername "$DB_USERNAME" \
            --dbPassword "$DB_PASSWORD" | tail -1
    fi
    # O CyberPanel cria o banco em latin1; o BotClient precisa de utf8mb4 (acentos e emojis do WhatsApp).
    mariadb -e "ALTER DATABASE \`$DB_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
}

install_node() {
    # O bot exige Node >= 20.6 (--env-file). AlmaLinux 9: módulo nodejs:22 do AppStream.
    if command -v node >/dev/null && node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>20||(a==20&&b>=6)?0:1)'; then return; fi
    log 'Node.js 22'
    dnf -y -q module reset nodejs
    dnf -y -q module enable nodejs:22
    dnf -y -q install nodejs
    node --version
}

create_layout() {
    log 'Pastas das versões (releases/current/shared) e usuário de publicação'
    local user; user="$(site_user)"
    command -v python3.12 >/dev/null || dnf -y -q install python3.12
    # Grupo "nobody" + setgid: o OpenLiteSpeed lê os arquivos públicos de cada versão sem abrir para "outros".
    install -d -o "$user" -g nobody -m 2750 "$BASE" "$BASE/releases" "$BASE/shared" \
        "$BASE/shared/storage"{,/app,/app/private,/app/public,/framework,/framework/cache,/framework/cache/data,/framework/sessions,/framework/views,/logs}
    # Dados do bot (conversas, pedidos locais, ficha do negócio): só o usuário do site.
    install -d -o "$user" -g "$user" -m 700 "$BASE/shared/bot" "$BASE/shared/backups"
    # Os scripts de deploy chamam "php" e "python3": PHP 8.5 e Python 3.12 só para este usuário.
    as_user mkdir -p "$H/.local/bin" "$H/.ssh"
    as_user ln -sfn "$PHP" "$H/.local/bin/php"
    as_user ln -sfn "$(command -v python3.12)" "$H/.local/bin/python3"
    grep -qs 'BotClient deploy' "$H/.bashrc" || printf '# BotClient deploy\nexport PATH="$HOME/.local/bin:$PATH"\n' | as_user tee -a "$H/.bashrc" >/dev/null
    [[ -f "$H/.bash_profile" ]] || printf '[ -f ~/.bashrc ] && . ~/.bashrc\n' | as_user tee "$H/.bash_profile" >/dev/null
    chmod 700 "$H/.ssh"
    touch "$H/.ssh/authorized_keys"
    while read -r line; do
        [[ "$line" == ssh-* ]] || continue
        grep -qxF "$line" "$H/.ssh/authorized_keys" || printf '%s\n' "$line" >> "$H/.ssh/authorized_keys"
    done < "$HERE/deploy.pub"
    chown "$user:$user" "$H/.ssh/authorized_keys"
    chmod 600 "$H/.ssh/authorized_keys"
}

create_env() {
    local user; user="$(site_user)"
    if [[ ! -f "$BASE/shared/.env" ]]; then
        log 'Arquivo .env da API (Laravel)'
        # shellcheck disable=SC1090
        ( set -a; source "$STATE"; set +a
          DOMAIN="$DOMAIN" BOT_PORT="$BOT_PORT" EMPRESA_NOME="$(cfg EMPRESA_NOME)" ALERTA_EMAIL="$(cfg ALERTA_EMAIL)" TARGET="$BASE/shared/.env" \
          EXAMPLE="$HERE/env.example" python3 - <<'PY'
import base64, os
e = os.environ
values = {
    'APP_NAME': 'BotClient', 'APP_ENV': 'production', 'APP_DEBUG': 'false',
    'APP_KEY': 'base64:' + base64.b64encode(os.urandom(32)).decode(), 'APP_URL': 'https://' + e['DOMAIN'],
    'APP_LOCALE': 'pt_BR', 'APP_FALLBACK_LOCALE': 'pt_BR', 'LOG_LEVEL': 'warning',
    'DB_CONNECTION': 'mysql', 'DB_HOST': '127.0.0.1', 'DB_PORT': '3306',
    'DB_DATABASE': e['DB_DATABASE'], 'DB_USERNAME': e['DB_USERNAME'], 'DB_PASSWORD': e['DB_PASSWORD'],
    'SESSION_DRIVER': 'database', 'SESSION_SECURE_COOKIE': 'true', 'SESSION_ENCRYPT': 'true',
    'CACHE_STORE': 'file', 'QUEUE_CONNECTION': 'sync',
    'BOT_URL': 'http://127.0.0.1:' + e['BOT_PORT'], 'NOTIFICACAO_TOKEN': e['NOTIFICACAO_TOKEN'],
    'CORS_ALLOWED_ORIGINS': 'https://' + e['DOMAIN'], 'EMPRESA_NOME': '"%s"' % e['EMPRESA_NOME'],
    # Alertas por e-mail pelo Postfix local da VPS (o mesmo do PropoClient), remetente do domínio com SPF/DKIM.
    'ALERTA_EMAIL': e['ALERTA_EMAIL'], 'MAIL_MAILER': 'smtp', 'MAIL_URL': '"smtp://127.0.0.1:25?auto_tls=false"',
    'MAIL_HOST': '127.0.0.1', 'MAIL_PORT': '25', 'MAIL_FROM_ADDRESS': '"noreply@propoclient.com.br"', 'MAIL_FROM_NAME': '"BotClient"',
}
lines, seen = open(e['EXAMPLE'], encoding='utf-8').read().splitlines(), set()
for i, line in enumerate(lines):
    name = line.split('=', 1)[0] if '=' in line and not line.startswith('#') else None
    if name in values:
        lines[i] = name + '=' + values[name]
        seen.add(name)
lines += [name + '=' + values[name] for name in sorted(set(values) - seen)]
open(e['TARGET'], 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
PY
        )
        chown "$user:$user" "$BASE/shared/.env"
        chmod 600 "$BASE/shared/.env"
    fi
    if [[ ! -f "$BASE/shared/bot/bot.env" ]]; then
        log 'Arquivo bot.env (WhatsApp, OpenRouter, empresa)'
        # shellcheck disable=SC1090
        ( source "$STATE"
          verify="$(cfg WHATSAPP_VERIFY_TOKEN)"; [[ -n "$verify" ]] || verify="$(secret 40)"
          cat > "$BASE/shared/bot/bot.env" <<EOF
NODE_ENV=production
PORTA=$BOT_PORT
ESCUTAR_EM=127.0.0.1
FUSO=America/Sao_Paulo
GRAPH_VERSAO=v25.0
WHATSAPP_TOKEN=$(cfg WHATSAPP_TOKEN)
WHATSAPP_PHONE_NUMBER_ID=$(cfg WHATSAPP_PHONE_NUMBER_ID)
WHATSAPP_VERIFY_TOKEN=$verify
WHATSAPP_APP_SECRET=$(cfg WHATSAPP_APP_SECRET)
OPENROUTER_API_KEY=$(cfg OPENROUTER_API_KEY)
MODELO=$(cfg MODELO)
API_BASE_URL=https://$DOMAIN/api
NOTIFICACAO_TOKEN=$NOTIFICACAO_TOKEN
EMPRESA_NOME="$(cfg EMPRESA_NOME)"
EMPRESA_TELEFONE="$(cfg EMPRESA_TELEFONE)"
EMPRESA_TELEFONE_2="$(cfg EMPRESA_TELEFONE_2)"
ARQ_LOG=$BASE/shared/bot/conversas.log
ARQ_NEGOCIO=$BASE/shared/bot/negocio.md
LOG_RETENCAO_DIAS=30
EOF
        )
        chown "$user:$user" "$BASE/shared/bot/bot.env"
        chmod 600 "$BASE/shared/bot/bot.env"
    fi
}

create_service_and_hooks() {
    local user; user="$(site_user)"
    log "Serviço do bot (botclient-$user) e ganchos de publicação"
    cat > "/etc/systemd/system/botclient-$user.service" <<EOF
[Unit]
Description=BotClient WhatsApp - $DOMAIN
After=network-online.target
Wants=network-online.target
# Até a primeira publicação não há código: o serviço só sobe quando existir current/bot.
ConditionPathExists=$BASE/current/bot/agente.js

[Service]
User=$user
Group=$user
WorkingDirectory=$BASE/current/bot
ExecStart=/usr/bin/node --env-file=$BASE/shared/bot/bot.env agente.js
Restart=always
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
# Log no journal (com rotação): journalctl -u botclient-$user

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload
    systemctl enable "botclient-$user.service" >/dev/null

    # Backup antes das migrations: banco + uploads + dados do bot, em shared/backups (mantém 10).
    cat > /usr/local/bin/botclient-backup <<'HOOK'
#!/usr/bin/env bash
set -Eeuo pipefail
umask 0077
app_dir="${1:?APP_DIR}"
sha="${2:?SHA}"
[[ "$app_dir" == /* && "$sha" =~ ^[a-f0-9]{40}$ ]] || exit 1
database="$(cat "$app_dir/shared/backup-database")"
[[ "$database" =~ ^[a-zA-Z0-9_]+$ && -f "$app_dir/shared/backup.cnf" ]] || exit 1
directory="$app_dir/shared/backups/$(date -u +%Y%m%dT%H%M%SZ)-$sha"
mkdir -m 700 -p "$directory"
mariadb-dump --defaults-extra-file="$app_dir/shared/backup.cnf" --single-transaction --quick --triggers \
    --no-tablespaces --databases "$database" 2>"$directory/mysql-error.log" | gzip > "$directory/database.sql.gz"
gzip -t "$directory/database.sql.gz"
tar -czf "$directory/uploads.tar.gz" -C "$app_dir/shared/storage" app
tar -czf "$directory/bot.tar.gz" -C "$app_dir/shared" bot
ls -1dt "$app_dir/shared/backups"/*/ | tail -n +11 | xargs -r rm -rf --
printf 'Backup concluído em %s\n' "$directory"
HOOK
    chmod 755 /usr/local/bin/botclient-backup
    # shellcheck disable=SC1090
    ( source "$STATE"
      printf '%s\n' "$DB_DATABASE" > "$BASE/shared/backup-database"
      printf '[client]\nhost=127.0.0.1\nuser=%s\npassword=%s\n' "$DB_USERNAME" "$DB_PASSWORD" > "$BASE/shared/backup.cnf" )
    chown "$user:$user" "$BASE/shared/backup-database" "$BASE/shared/backup.cnf"
    chmod 600 "$BASE/shared/backup-database" "$BASE/shared/backup.cnf"

    # Depois da troca de versão: encerra o PHP do site que chamou, recarrega o OpenLiteSpeed e
    # reinicia SOMENTE o bot desse mesmo usuário (cada empresa tem o próprio usuário do CyberPanel).
    cat > /usr/local/bin/botclient-reload <<'HOOK'
#!/bin/sh
set -eu
user="${SUDO_USER:?}"
pkill -x -u "$user" lsphp || true
/usr/local/lsws/bin/lswsctrl restart >/dev/null
systemctl restart "botclient-$user.service"
HOOK
    chmod 755 /usr/local/bin/botclient-reload
    printf '%s ALL=(root) NOPASSWD: /usr/local/bin/botclient-reload\n' "$user" > "/etc/sudoers.d/botclient-$user"
    chmod 440 "/etc/sudoers.d/botclient-$user"
    visudo -cq -f "/etc/sudoers.d/botclient-$user"
}

configure_cron() {
    log 'Agendador do Laravel (verificação de saúde e alertas a cada 5 minutos)'
    # flock na mesma trava do deploy: não roda no meio de uma publicação.
    printf '%s\n' "* * * * * flock -n $BASE/.release.lock sh -c 'cd $BASE/current && $PHP artisan schedule:run' >> $BASE/shared/storage/logs/scheduler.log 2>&1" \
        | crontab -u "$(site_user)" -
}

issue_certificate() {
    log "Certificado HTTPS (Let's Encrypt) de $DOMAIN"
    local live="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    [[ -f "$live" ]] || cyberpanel issueSSL --domainName "$DOMAIN" | tail -1
    [[ -f "$live" ]] || fail "certificado de $DOMAIN não foi emitido; confira o DNS (registro A no Registro.br)."
}

configure_web() {
    log 'OpenLiteSpeed: painel+API na versão ativa, /webhook para o bot, HTTPS e cabeçalhos'
    cat > "$H/public_html/index.html" <<'EOF'
<!doctype html><meta charset="utf-8"><title>BotClient</title><p>BotClient em preparação.</p>
EOF
    chown "$(site_user):$(site_user)" "$H/public_html/index.html"
    DOMAIN="$DOMAIN" BOT_PORT="$BOT_PORT" SLUG="${SLUG//-/_}" SPA="$HERE/spa.htaccess" python3 - <<'PY'
"""Ajusta só o vhost desta empresa e o mapeamento no listener SSL (com cópia .bak de cada arquivo alterado)."""
import os, re, shutil, time
conf = '/usr/local/lsws/conf'
site, port, slug = os.environ['DOMAIN'], os.environ['BOT_PORT'], os.environ['SLUG']
stamp = time.strftime('%Y%m%d%H%M%S')

def save(path, text):
    if text != open(path).read():
        shutil.copy2(path, f'{path}.bak-{stamp}')
        open(path, 'w').write(text)

main = f'{conf}/httpd_config.conf'
def listener(match):
    block = match.group(0)
    if not re.search(rf'^\s*map\s+{re.escape(site)}\s', block, re.M):
        block = block[:-1] + f'  map                     {site} {site}\n' + '}'
    return block
text, found = re.subn(r'listener SSL( IPv6)? \{[^}]*\}', listener, open(main).read())
assert found >= 1, 'listener SSL não encontrado'
save(main, text)

csp = re.search(r'Content-Security-Policy "([^"]+)"', open(os.environ['SPA']).read()).group(1)
path = f'{conf}/vhosts/{site}/vhost.conf'
text = open(path).read()
if 'vhssl' not in text:
    text = text.rstrip('\n') + f"""

vhssl  {{
  keyFile                 /etc/letsencrypt/live/{site}/privkey.pem
  certFile                /etc/letsencrypt/live/{site}/fullchain.pem
  certChain               1
  sslProtocol             24
  enableECDHE             1
  renegProtection         1
  sslSessionCache         1
  enableSpdy              15
  enableStapling          1
  ocspRespMaxAge          86400
}}
"""
# Painel Angular + Laravel servidos da versão ativa; raiz abre o index.html do painel.
text = re.sub(r'(?m)^docRoot\s.*$', 'docRoot                   $VH_ROOT/botclient/current/public', text, count=1)
text = re.sub(r'(?m)^(\s*indexFiles\s+).*$', r'\1index.html', text, count=1)
if 'BotClient: sempre HTTPS' not in text:
    text = text.replace('  END_rules', '# BotClient: sempre HTTPS\nRewriteCond %{HTTPS} !on\n'
                        'RewriteRule ^(.*)$ https://%{HTTP_HOST}$1 [R=301,L]\n  END_rules', 1)
if 'BotClient: bot WhatsApp' not in text:
    text = text.rstrip('\n') + f"""

# BotClient: bot WhatsApp (Node em 127.0.0.1:{port}); só /webhook chega a ele, /api/notificar fica interno.
extprocessor botclient_{slug} {{
  type                    proxy
  address                 127.0.0.1:{port}
  maxConns                20
  initTimeout             30
  retryTimeout            0
  respBuffer              0
}}

context /webhook {{
  type                    proxy
  handler                 botclient_{slug}
  addDefaultCharset       off
}}

# BotClient: cabecalhos de seguranca do painel (o .htaccess do OpenLiteSpeed nao aceita Header).
context / {{
  location                $DOC_ROOT/
  allowBrowse             1
  extraHeaders            <<<END_extraHeaders
Content-Security-Policy: {csp}
Strict-Transport-Security: max-age=31536000
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
  END_extraHeaders

  rewrite  {{
    enable                  1
    inherit                 1
  }}
  addDefaultCharset       off
}}
"""
save(path, text)
PY
    /usr/local/lsws/bin/lswsctrl restart >/dev/null
}

create_site
create_state
create_database
install_node
create_layout
create_env
create_service_and_hooks
configure_cron
issue_certificate
configure_web
log "Base pronta. Usuário de publicação: $(site_user)"
