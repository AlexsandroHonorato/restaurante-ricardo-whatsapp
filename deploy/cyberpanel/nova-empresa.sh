#!/usr/bin/env bash
# Instala o BotClient de UMA empresa na VPS do CyberPanel (a mesma do PropoClient) e publica a primeira versão.
# Roda NO SEU COMPUTADOR (Git Bash), na raiz do repositório. Pode ser repetido para a mesma empresa.
#
#   deploy/cyberpanel/nova-empresa.sh
#
# Antes de rodar: no Registro.br, a zona de propoclient.com.br precisa do registro A
# "<empresa>.botclient" apontando para o IP da VPS (o certificado HTTPS depende disso). Ver docs/DEPLOY.md.
# shellcheck disable=SC2154  # as respostas são atribuídas por ask()/ask_secret() com printf -v
set -Eeuo pipefail
umask 077
log() { printf '\n[BotClient] %s\n' "$*"; }
fail() { printf '\n[BotClient] ERRO: %s\n' "$*" >&2; exit 1; }
ask() { local answer; read -r -p "$2${3:+ [$3]}: " answer; printf -v "$1" '%s' "${answer:-${3:-}}"; }
ask_secret() { local answer; read -r -s -p "$2 (não aparece ao digitar; Enter = preencher depois): " answer; echo; printf -v "$1" '%s' "$answer"; }

cd "$(git rev-parse --show-toplevel)"
here=deploy/cyberpanel

echo 'Instalação do BotClient para uma empresa (CyberPanel). Enter aceita o valor entre colchetes.'
ask slug 'Identificador da empresa: letras minúsculas, números e hífen (ex.: familiaricardo)'
[[ "$slug" =~ ^[a-z][a-z0-9-]{1,30}$ ]] || fail 'identificador inválido.'
ask host 'IP da VPS' '129.121.47.198'
ask port 'Porta do SSH' '22022'
ask domain 'Endereço do painel desta empresa' "$slug.botclient.propoclient.com.br"
[[ "$domain" =~ ^[a-z0-9]([a-z0-9-]*\.)+[a-z]{2,}$ ]] || fail 'endereço inválido.'
ask admin_email 'E-mail do responsável técnico (avisos do certificado)' 'administrador@propoclient.com.br'
ask alerta_email 'E-mail que recebe alertas (bot fora do ar, token da Meta, mensagens sem envio)' "$admin_email"
ask bot_port 'Porta interna do bot (uma diferente por empresa, 3100-9999)' '3101'
ask empresa_nome 'Nome da empresa (aparece nas mensagens do WhatsApp)'
ask empresa_tel 'Telefone principal de contato da empresa' ''
ask empresa_tel2 'Telefone alternativo (opcional)' ''
ask seed 'Carregar o cardápio inicial da Família Ricardo? (s/n)' 'n'
ask modelo 'Modelo de IA no OpenRouter' 'google/gemini-3.7-flash'
ask_secret openrouter 'OpenRouter: chave (sk-or-...)'
ask whatsapp_phone 'Meta: Phone Number ID (Enter = preencher depois)' ''
ask_secret whatsapp_token 'Meta: token de acesso permanente (System User)'
ask_secret whatsapp_secret 'Meta: App Secret'
ask actions_key 'Arquivo .pub da chave do GitHub Actions (vazio = só publicação manual)'
[[ -z "$actions_key" || -f "$actions_key" ]] || fail "arquivo não encontrado: $actions_key"

log 'Conferindo o DNS'
nslookup "$domain" 8.8.8.8 2>/dev/null | awk '/^Address/ && NR>2 {print $2}' | grep -qxF "$host" \
    || fail "$domain ainda não aponta para $host. Crie o registro A no Registro.br (docs/DEPLOY.md) e rode de novo."

key="$HOME/.ssh/id_ed25519_botclient"
[[ -f "$key" ]] || ssh-keygen -q -t ed25519 -N '' -C 'botclient-publicacao' -f "$key"
ssh_options=(-i "$key" -o IdentitiesOnly=yes -o ConnectTimeout=15 -o LogLevel=ERROR)
root() { ssh "${ssh_options[@]}" -o BatchMode=yes -p "$port" "root@$host" "$@"; }

log 'Acesso por chave (a senha de root da VPS é pedida uma única vez)'
root true 2>/dev/null || ssh-copy-id -i "$key.pub" -p "$port" "root@$host"
root true || fail 'não consegui entrar por chave como root.'

log 'Enviando os arquivos de preparação'
temporary="$(mktemp -d)"
remote_dir="/root/botclient-preparo-$slug"
trap 'rm -rf "$temporary"; root "rm -f $remote_dir/empresa.env" 2>/dev/null || true' EXIT
cat > "$temporary/empresa.env" <<EOF
SLUG=$slug
DOMAIN=$domain
ADMIN_EMAIL=$admin_email
ALERTA_EMAIL=$alerta_email
BOT_PORT=$bot_port
EMPRESA_NOME=$empresa_nome
EMPRESA_TELEFONE=$empresa_tel
EMPRESA_TELEFONE_2=$empresa_tel2
MODELO=$modelo
OPENROUTER_API_KEY=$openrouter
WHATSAPP_PHONE_NUMBER_ID=$whatsapp_phone
WHATSAPP_TOKEN=$whatsapp_token
WHATSAPP_APP_SECRET=$whatsapp_secret
WHATSAPP_VERIFY_TOKEN=
EOF
cat "$key.pub" ${actions_key:+"$actions_key"} > "$temporary/deploy.pub"
cp backend/.env.example "$temporary/env.example"
cp deploy/web/spa.htaccess "$here/preparar-empresa.sh" "$temporary/"
root "mkdir -m 700 -p '$remote_dir'"
scp "${ssh_options[@]}" -P "$port" "$temporary"/* "root@$host:$remote_dir/"

log 'Preparando o servidor (site, banco, Node, pastas, .env, serviço do bot, HTTPS)'
root "bash '$remote_dir/preparar-empresa.sh' '$remote_dir'"

mkdir -p "$HOME/.botclient/empresas"
site_user="$(root "stat -c %U /home/$domain/public_html")"
[[ "$seed" == s ]] && seed_flag=true || seed_flag=false
cat > "$HOME/.botclient/empresas/$slug.env" <<EOF
HOST=$host
PORT=$port
DOMAIN=$domain
SITE_USER=$site_user
SSH_KEY=$key
BOT_PORT=$bot_port
SEED_CARDAPIO=$seed_flag
EOF

bash "$here/publicar.sh" "$slug"

log 'Primeiro administrador do painel (a senha não aparece ao digitar)'
ssh "${ssh_options[@]}" -t -p "$port" "root@$host" \
    "cd /home/$domain/botclient/current && sudo -u $site_user /usr/local/lsws/lsphp85/bin/php artisan app:criar-admin"

verify_token="$(root "grep '^WHATSAPP_VERIFY_TOKEN=' /home/$domain/botclient/shared/bot/bot.env | cut -d= -f2")"
cat <<EOF

Pronto. Painel: https://$domain

Meta (developers.facebook.com > seu app > WhatsApp > Configuration > Webhook):
  Callback URL:  https://$domain/webhook
  Verify token:  $verify_token
  Assine o campo "messages".
Chaves que ficaram em branco: edite /home/$domain/botclient/shared/bot/bot.env no servidor e rode
  systemctl restart botclient-$site_user

Para publicar atualizações manualmente:  bash $here/publicar.sh $slug
Para o GitHub Actions publicar nesta empresa (docs/DEPLOY.md), acrescente em SERVERS_CONFIG:
  "$slug": {"host": "$host", "user": "$site_user", "port": $port, "bot_port": $bot_port,
    "app_dir": "/home/$domain/botclient", "health_url": "https://$domain/api/health",
    "backup_hook": "/usr/local/bin/botclient-backup", "reload_hook": "/usr/local/bin/botclient-reload"}
em EMPRESAS (variável do repositório): "$slug"
e em SSH_KNOWN_HOSTS:
$(ssh-keyscan -p "$port" -t ed25519 "$host" 2>/dev/null)
EOF
