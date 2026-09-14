#!/usr/bin/env bash
set -euo pipefail

# Render Free has no pre-deploy command, so migrate before starting the service.
python manage.py migrate --noinput

# Run one worker and the scheduler alongside the HTTP server on one instance.
celery -A config worker --loglevel=INFO --concurrency=1 --pool=solo &
worker_pid=$!
celery -A config beat --loglevel=INFO &
beat_pid=$!
daphne -b 0.0.0.0 -p "${PORT:-10000}" config.asgi:application &
web_pid=$!

stop_children() {
    trap - TERM INT
    kill "$worker_pid" "$beat_pid" "$web_pid" 2>/dev/null || true
    wait "$worker_pid" "$beat_pid" "$web_pid" 2>/dev/null || true
}
trap stop_children TERM INT

# If any component exits, stop the others so Render can restart the service.
wait -n "$worker_pid" "$beat_pid" "$web_pid" || status=$?
stop_children
exit "${status:-1}"
