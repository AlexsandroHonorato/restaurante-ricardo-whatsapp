#!/usr/bin/env bash
# Volta para a release anterior (ou para um SHA já publicado) NO SERVIDOR. Não desfaz migrations.
#   APP_DIR=... HEALTH_URL=... BOT_PORT=... RELOAD_HOOK=... bash current/.ops/rollback.sh [SHA]
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/release-common.sh"
[[ $# -le 1 ]] || fail_release 'Uso: rollback.sh [SHA]'
prepare_release
previous="$(active_release)" || fail_release 'Release atual inválida.'
target="${1:-}"
if [[ -z "$target" ]]; then
    [[ -f "$APP_DIR/.previous-release" ]] || fail_release 'Não há release anterior registrada.'
    target="$(cat "$APP_DIR/.previous-release")"
fi
valid_sha "$target" || fail_release 'Informe o SHA completo da release.'
[[ -d "$APP_DIR/releases/$target" && ! -L "$APP_DIR/releases/$target" && -f "$APP_DIR/releases/$target/.deployed" ]] || fail_release 'Release validada não encontrada.'
[[ "$previous" != "$target" ]] || { health_release "$target"; exit; }
# shellcheck disable=SC2154  # "code" é atribuída dentro do próprio trap
trap 'code=$?; trap - EXIT; if (( code != 0 )) && [[ -n "$previous" ]]; then restore_release "$previous" || log_release "Recuperação falhou; intervenção manual necessária."; fi; exit "$code"' EXIT
if [[ -n "$previous" ]]; then artisan_release "$previous" down; fi
restore_release "$target"
printf '%s\n' "$previous" > "$APP_DIR/.previous-release"
log_release "ROLLBACK OK: $target. Nenhuma migration foi desfeita."
