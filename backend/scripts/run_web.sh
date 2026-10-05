#!/bin/bash
set -euo pipefail

start_render_keepalive() {
    if [[ "${RENDER_SELF_KEEPALIVE_ENABLED:-False}" != "True" ]]; then
        return
    fi

    local keepalive_url="${RENDER_EXTERNAL_URL:-${PUBLIC_BACKEND_URL:-}}"
    if [[ -z "${keepalive_url}" ]]; then
        echo "[run_web.sh] Render keep-alive disabled: no public service URL is available."
        return
    fi

    local interval="${RENDER_SELF_KEEPALIVE_INTERVAL_SECONDS:-600}"
    if [[ ! "${interval}" =~ ^[0-9]+$ ]] || (( interval < 60 || interval > 840 )); then
        echo "[run_web.sh] Invalid keep-alive interval '${interval}'; using 600 seconds."
        interval=600
    fi

    keepalive_url="${keepalive_url%/}/health"
    echo "[run_web.sh] Starting Render keep-alive every ${interval} seconds."
    (
        while sleep "${interval}"; do
            if ! wget --quiet --timeout=30 --tries=1 --output-document=/dev/null "${keepalive_url}"; then
                echo "[run_web.sh] Keep-alive request failed; the external monitor will retry."
            fi
        done
    ) &
}

echo "[run_web.sh] Applying database migrations..."
python manage.py migrate --noinput
echo "[run_web.sh] Migrations complete."

start_render_keepalive

echo "[run_web.sh] Starting Daphne ASGI server on port ${PORT:-10000}..."
exec daphne -b 0.0.0.0 -p "${PORT:-10000}" config.asgi:application
