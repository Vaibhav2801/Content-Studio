#!/bin/bash
set -e

echo "[run_web.sh] Applying database migrations..."
python manage.py migrate --noinput
echo "[run_web.sh] Migrations complete."

echo "[run_web.sh] Collecting Django and Unfold static assets..."
python manage.py collectstatic --noinput
echo "[run_web.sh] Static assets collected."

WORKER_PID=""
BEAT_PID=""

cleanup() {
    echo "[run_web.sh] Shutting down background processes..."
    if [ -n "$WORKER_PID" ] && kill -0 "$WORKER_PID" 2>/dev/null; then
        kill -TERM "$WORKER_PID" 2>/dev/null || true
    fi
    if [ -n "$BEAT_PID" ] && kill -0 "$BEAT_PID" 2>/dev/null; then
        kill -TERM "$BEAT_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

# Start embedded Celery worker on single-service deployments (e.g. Render Free web service)
if [ "${RUN_EMBEDDED_CELERY:-True}" = "True" ] && [ "${DISABLE_EMBEDDED_CELERY:-False}" != "True" ]; then
    echo "[run_web.sh] Starting embedded Celery worker (threads pool)..."
    celery -A config worker --loglevel=INFO --concurrency="${CELERY_CONCURRENCY:-2}" --pool=threads &
    WORKER_PID=$!
    if [ "${RUN_CELERY_BEAT:-False}" = "True" ]; then
        echo "[run_web.sh] Starting embedded Celery beat..."
        celery -A config beat --loglevel=INFO &
        BEAT_PID=$!
    fi
fi

echo "[run_web.sh] Starting Daphne ASGI server on port ${PORT:-10000}..."
daphne -b 0.0.0.0 -p "${PORT:-10000}" config.asgi:application &
WEB_PID=$!

wait "$WEB_PID"
