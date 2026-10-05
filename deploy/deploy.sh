#!/usr/bin/env bash
# Publica um pacote botclient-<SHA>.tar.gz NO SERVIDOR (chamado pelo GitHub Actions ou por publicar.sh).
# Ordem: confere pacote → extrai release → liga .env/storage/dados do bot → manutenção → backup →
# migrations → caches → troca "current" → reinicia web e bot → health check. Se falhar, volta à release anterior.
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/release-common.sh"
: "${RELEASE_ID:?Informe o SHA completo}" "${PACKAGE_PATH:?Informe o pacote}"
valid_sha "$RELEASE_ID" || fail_release 'RELEASE_ID deve ser um SHA completo.'
prepare_release
previous="$(active_release)" || fail_release 'Release atual inválida.'
if [[ "$previous" == "$RELEASE_ID" ]]; then health_release "$RELEASE_ID"; exit; fi
[[ -f "$PACKAGE_PATH" && -f "$PACKAGE_PATH.sha256" ]] || fail_release 'Pacote ou checksum ausente.'
target="$APP_DIR/releases/$RELEASE_ID"
[[ ! -e "$target" ]] || fail_release 'Release já existe. Use rollback para reativá-la, ou investigue a tentativa anterior.'
python3 "$RELEASE_TOOLS/release-files.py" extract "$PACKAGE_PATH" "$target" "$RELEASE_ID"
mkdir -p "$APP_DIR/shared/storage/"{app/private,app/public,framework/cache/data,framework/sessions,framework/views,logs} "$target/bootstrap/cache"
ln -s "$APP_DIR/shared/.env" "$target/.env"
ln -s "$APP_DIR/shared/storage" "$target/storage"
ln -s "$APP_DIR/shared/storage/app/public" "$target/public/storage"
# Ficha do negócio é da empresa: na primeira publicação copia o modelo do pacote; depois nunca sobrescreve.
[[ -f "$APP_DIR/shared/bot/negocio.md" ]] || cp "$target/bot/negocio.md" "$APP_DIR/shared/bot/negocio.md"
chmod -R ug+rwX,o-rwx "$target/bootstrap/cache"
php "$RELEASE_TOOLS/release-preflight.php" "$target" >> "$APP_DIR/shared/storage/logs/deployment.log" 2>&1 || fail_release 'Preflight falhou; consulte shared/storage/logs/deployment.log.'
changed=0
paused=0
finished=0
on_exit() {
    local code=$?
    trap - EXIT
    if (( code != 0 && finished == 0 )); then
        if [[ -n "$previous" ]] && (( changed || paused )); then
            restore_release "$previous" || log_release 'ERRO: recuperação também falhou. Intervenção manual necessária.'
        elif (( changed )); then
            artisan_release "$RELEASE_ID" down || true
            log_release 'Primeiro deploy falhou: não há release anterior; aplicação em manutenção.'
        fi
        log_release "DEPLOY FAILED: $RELEASE_ID. Verifique migrations e logs; nenhum dado foi revertido."
    fi
    exit "$code"
}
trap on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
if [[ -n "$previous" ]]; then
    paused=1
    artisan_release "$previous" down
fi
: "${BACKUP_HOOK:?Configure BACKUP_HOOK absoluto para backup antes das migrations}"
[[ "$BACKUP_HOOK" == /* && -x "$BACKUP_HOOK" && ! -L "$BACKUP_HOOK" ]] || fail_release 'BACKUP_HOOK deve ser um executável local absoluto.'
"$BACKUP_HOOK" "$APP_DIR" "$RELEASE_ID"
log_release "Migrations: $RELEASE_ID"
artisan_release "$RELEASE_ID" migrate --force
# Banco novo: cardápio inicial (nunca os dados fictícios do dashboard).
if [[ -z "$previous" && "${SEED_CARDAPIO:-false}" == true ]]; then
    artisan_release "$RELEASE_ID" db:seed --class='Database\Seeders\CardapioSeeder' --force
fi
cache_release "$RELEASE_ID"
changed=1
activate_release "$RELEASE_ID"
artisan_release "$RELEASE_ID" up
restart_release "$RELEASE_ID"
health_release "$RELEASE_ID"
if [[ -n "$previous" ]]; then printf '%s\n' "$previous" > "$APP_DIR/.previous-release"; fi
touch "$target/.deployed"
finished=1
python3 "$RELEASE_TOOLS/release-files.py" prune "$APP_DIR" "$KEEP_RELEASES"
log_release "DEPLOY OK: $RELEASE_ID"
