#!/usr/bin/env bash
# Funções compartilhadas por deploy.sh e rollback.sh (rodam NO SERVIDOR, como usuário do site).
# Adaptado do fluxo do PropoClient: release imutável por SHA, troca atômica de "current" e volta automática.
set -Eeuo pipefail
# shellcheck disable=SC2034  # usado por deploy.sh e rollback.sh, que fazem source deste arquivo
RELEASE_TOOLS="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
log_release() { printf '[BotClient] %s\n' "$*"; }
fail_release() { log_release "$*" >&2; exit 1; }
valid_sha() { [[ "$1" =~ ^[a-f0-9]{40}$ ]]; }
resolve_path() { python3 -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).resolve(strict=True))' "$1"; }

prepare_release() {
    : "${APP_DIR:?Informe APP_DIR}" "${HEALTH_URL:?Informe HEALTH_URL HTTPS terminado em /api/health}" "${BOT_PORT:?Informe BOT_PORT}"
    [[ "$APP_DIR" =~ ^/[a-zA-Z0-9_./-]+$ && "$APP_DIR" != / && "$APP_DIR" != *..* ]] || fail_release 'APP_DIR inválido.'
    [[ "$HEALTH_URL" == https://*/api/health ]] || fail_release 'Health check exige HTTPS e /api/health.'
    [[ "$BOT_PORT" =~ ^[0-9]{4,5}$ ]] || fail_release 'BOT_PORT inválido.'
    for command in php python3 curl flock; do command -v "$command" >/dev/null || fail_release "Dependência ausente: $command"; done
    [[ -f "$APP_DIR/shared/.env" && -f "$APP_DIR/shared/bot/bot.env" ]] || fail_release 'Prepare shared/.env e shared/bot/bot.env antes do deploy (preparar-empresa.sh).'
    APP_DIR="$(resolve_path "$APP_DIR")"
    mkdir -p "$APP_DIR/releases"
    [[ ! -L "$APP_DIR/releases" ]] || fail_release 'releases não pode ser symlink.'
    exec 9>"$APP_DIR/.release.lock"
    flock -n 9 || fail_release 'Outro deploy está em andamento neste servidor.'
    if [[ -e "$APP_DIR/current" && ! -L "$APP_DIR/current" ]]; then fail_release 'current deve ser symlink.'; fi
    KEEP_RELEASES="${KEEP_RELEASES:-5}"
    [[ "$KEEP_RELEASES" =~ ^[0-9]+$ ]] && (( KEEP_RELEASES >= 2 && KEEP_RELEASES <= 100 )) || fail_release 'KEEP_RELEASES deve estar entre 2 e 100.'
    umask 0027
}

active_release() {
    local resolved
    if [[ -L "$APP_DIR/current" ]]; then
        resolved="$(resolve_path "$APP_DIR/current")" || return 1
        [[ "$(dirname -- "$resolved")" == "$APP_DIR/releases" ]] || return 1
        valid_sha "$(basename -- "$resolved")" || return 1
        basename -- "$resolved"
    fi
}
artisan_release() {
    log_release "Laravel: $2 ($1)"
    php "$APP_DIR/releases/$1/artisan" "${@:2}" --no-interaction >> "$APP_DIR/shared/storage/logs/deployment.log" 2>&1 || {
        log_release 'Comando Laravel falhou; consulte shared/storage/logs/deployment.log no servidor.' >&2
        return 1
    }
}
cache_release() {
    artisan_release "$1" optimize:clear || return 1
    artisan_release "$1" config:cache || return 1
    artisan_release "$1" route:cache || return 1
    artisan_release "$1" view:cache || return 1
}
activate_release() {
    local temporary="$APP_DIR/.current-$$"
    ln -s "releases/$1" "$temporary" || return 1
    mv -Tf -- "$temporary" "$APP_DIR/current" || { rm -f -- "$temporary"; return 1; }
}
restart_release() {
    # O OpenLiteSpeed guarda o caminho da release antiga e o bot Node roda o código de "current":
    # o hook (via sudo) reinicia o PHP do site, recarrega o servidor web e reinicia o serviço do bot.
    if [[ -n "${RELOAD_HOOK:-}" ]]; then
        [[ "$RELOAD_HOOK" == /* ]] || return 1
        log_release 'Recarregando servidor web e bot.'
        sudo -n -- "$RELOAD_HOOK" || return 1
    fi
}
health_release() {
    local expected="$1" body attempt
    for attempt in {1..5}; do
        if body="$(curl --fail --silent --show-error --proto '=https' --connect-timeout 5 --max-time 15 \
            -w '\n%{http_code}' -H 'Cache-Control: no-cache' "$HEALTH_URL?release=$expected&attempt=$attempt")" && \
            printf '%s' "$body" | python3 -c 'import json,sys; body,code=sys.stdin.read().rsplit("\n",1); d=json.loads(body); sys.exit(0 if code=="200" and d.get("application")=="BotClient" and d.get("status")=="healthy" and d.get("version")==sys.argv[1] else 1)' "$expected" && \
            [[ "$(curl --silent --max-time 5 "http://127.0.0.1:$BOT_PORT/")" == 'agente no ar' ]]; then
            log_release "Health check OK (API e bot): $expected"; return 0
        fi
        log_release "Health check falhou ($attempt/5)."
        if (( attempt < 5 )); then sleep "${HEALTH_INTERVAL:-10}"; fi
    done
    return 1
}
restore_release() {
    local target="$1"
    log_release "Restaurando aplicação $target; banco NÃO será revertido."
    activate_release "$target" || return 1
    cache_release "$target" || return 1
    artisan_release "$target" up || return 1
    restart_release "$target" || return 1
    health_release "$target"
}
