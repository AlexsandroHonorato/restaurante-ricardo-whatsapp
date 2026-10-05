#!/usr/bin/env bash
# Publica o commit atual (HEAD) numa empresa já preparada por nova-empresa.sh, sem passar pelo GitHub Actions.
# Roda NO SEU COMPUTADOR (Git Bash), na raiz do repositório. Usa o mesmo pacote e o mesmo deploy.sh do Actions:
# backup, migrations, troca de versão, reinício do bot, health check e volta automática se falhar.
#
#   deploy/cyberpanel/publicar.sh <empresa>
#
# O perfil fica em ~/.botclient/empresas/<empresa>.env (criado por nova-empresa.sh).
set -Eeuo pipefail
log() { printf '\n[BotClient] %s\n' "$*"; }
fail() { printf '\n[BotClient] ERRO: %s\n' "$*" >&2; exit 1; }

name="${1:-}"
profile="$HOME/.botclient/empresas/$name.env"
[[ "$name" =~ ^[a-z][a-z0-9-]*$ && -f "$profile" ]] || fail "uso: publicar.sh <empresa>; perfis em ~/.botclient/empresas/"
declare -A S=()
while IFS='=' read -r key value; do [[ "$key" =~ ^[A-Z_]+$ ]] && S[$key]="${value%$'\r'}"; done < "$profile"
for key in HOST PORT DOMAIN SITE_USER SSH_KEY BOT_PORT; do [[ -n "${S[$key]:-}" ]] || fail "falta $key em $profile"; done

cd "$(git rev-parse --show-toplevel)"
sha="$(git rev-parse HEAD)"
# O pacote leva o SHA do commit: código não commitado ficaria publicado sem registro.
git diff --quiet HEAD -- backend frontend deploy .github agente.js cerebro.js pedidos.js lib negocio.md package.json \
    || [[ "${PUBLICAR_SEM_COMMIT:-}" == 1 ]] \
    || fail 'há alterações sem commit no código publicado. Faça o commit antes de publicar.'

app_dir="/home/${S[DOMAIN]}/botclient"
ssh_options=(-i "${S[SSH_KEY]}" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 -o LogLevel=ERROR)
remote() { ssh "${ssh_options[@]}" -p "${S[PORT]}" "${S[SITE_USER]}@${S[HOST]}" "$@"; }
upload() { scp "${ssh_options[@]}" -P "${S[PORT]}" -r "${@:1:$#-1}" "${S[SITE_USER]}@${S[HOST]}:${*: -1}"; }

log "Publicando ${sha:0:12} em ${S[DOMAIN]}"
work=runtime/publicar
rm -rf "$work" runtime/pacote
mkdir -p "$work"

log 'API: dependências de produção (cópia limpa do commit)'
git archive HEAD backend | tar -x -C "$work"
(cd "$work/backend" && composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction --no-progress)

log 'Painel: build do Angular'
[[ -d frontend/node_modules ]] || npm ci --prefix frontend
(cd frontend && npx ng build)

log 'Pacote da versão'
python_bin="$(command -v python3 || command -v python)"
SHA="$sha" BUILD="$(date +%s)" API_SOURCE="$work/backend" "$python_bin" .github/scripts/empacotar.py

log 'Envio e ativação no servidor'
pacote="runtime/pacote/botclient-$sha.tar.gz"
incoming="$app_dir/incoming/$sha-local-$(date +%s)"
remote "mkdir -m 750 -p '$incoming'"
trap 'remote "rm -rf -- '"'$incoming'"'" || true' EXIT
upload "$pacote" "$pacote.sha256" runtime/pacote/ops "$incoming/"
remote "env APP_DIR='$app_dir' RELEASE_ID='$sha' PACKAGE_PATH='$incoming/botclient-$sha.tar.gz' \
    HEALTH_URL='https://${S[DOMAIN]}/api/health' BOT_PORT='${S[BOT_PORT]}' SEED_CARDAPIO='${S[SEED_CARDAPIO]:-false}' \
    BACKUP_HOOK=/usr/local/bin/botclient-backup RELOAD_HOOK=/usr/local/bin/botclient-reload KEEP_RELEASES=5 \
    bash '$incoming/ops/deploy.sh'"

log 'Conferência'
curl --silent --show-error --max-time 20 "https://${S[DOMAIN]}/api/health" || echo "(não consegui conferir daqui; o servidor já validou o health check)"; echo
log "Publicado: $sha"
