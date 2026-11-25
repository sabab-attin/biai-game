#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"
LOG_DIR="$ROOT_DIR/.logs"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"

mkdir -p "$PID_DIR" "$LOG_DIR"

is_running() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file" 2>/dev/null || true)"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      return 0
    fi
    rm -f "$pid_file"
  fi
  return 1
}

if is_running "$BACKEND_PID_FILE" && is_running "$FRONTEND_PID_FILE"; then
  echo "BIAI Prize Wheel is already running."
  echo "  Frontend: http://localhost:5173"
  echo "  Backend:  http://localhost:4000/api"
  echo "Run ./stop.sh to stop it."
  exit 0
fi

# Stop partial state cleanly before starting fresh
if is_running "$BACKEND_PID_FILE" || is_running "$FRONTEND_PID_FILE"; then
  "$ROOT_DIR/stop.sh" >/dev/null 2>&1 || true
fi

# Install dependencies automatically if missing
if [[ ! -d "$ROOT_DIR/backend/node_modules" ]]; then
  echo "Installing backend dependencies..."
  npm --prefix "$ROOT_DIR/backend" install
fi
if [[ ! -d "$ROOT_DIR/frontend/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  npm --prefix "$ROOT_DIR/frontend" install
fi

# Ensure backend/.env exists
if [[ ! -f "$ROOT_DIR/backend/.env" ]] && [[ -f "$ROOT_DIR/backend/.env.example" ]]; then
  cp "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"
fi

# Ensure MongoDB is running locally if Homebrew mongodb-community is installed
if command -v nc >/dev/null 2>&1 && ! nc -z 127.0.0.1 27017 >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Starting MongoDB via Homebrew..."
    brew services start mongodb-community >/dev/null 2>&1 || true
    sleep 2
  fi
fi

echo "Starting BIAI Prize Wheel backend..."
(
  cd "$ROOT_DIR/backend"
  nohup node src/index.js </dev/null > "$LOG_DIR/backend.log" 2>&1 &
  echo $! > "$BACKEND_PID_FILE"
)

echo "Starting BIAI Prize Wheel frontend..."
(
  cd "$ROOT_DIR/frontend"
  nohup node ./node_modules/.bin/vite --port 5173 --host </dev/null > "$LOG_DIR/frontend.log" 2>&1 &
  echo $! > "$FRONTEND_PID_FILE"
)

# Wait for both services to become ready
BACKEND_READY=0
FRONTEND_READY=0
for _ in $(seq 1 30); do
  if ! is_running "$BACKEND_PID_FILE"; then
    echo "Backend failed to start. Last log lines:"
    tail -n 20 "$LOG_DIR/backend.log" || true
    "$ROOT_DIR/stop.sh" >/dev/null 2>&1 || true
    exit 1
  fi
  if ! is_running "$FRONTEND_PID_FILE"; then
    echo "Frontend failed to start. Last log lines:"
    tail -n 20 "$LOG_DIR/frontend.log" || true
    "$ROOT_DIR/stop.sh" >/dev/null 2>&1 || true
    exit 1
  fi

  if curl -fsS http://127.0.0.1:4000/api/health >/dev/null 2>&1; then
    BACKEND_READY=1
  fi
  if curl -fsS http://127.0.0.1:5173/ >/dev/null 2>&1; then
    FRONTEND_READY=1
  fi

  if [[ "$BACKEND_READY" -eq 1 && "$FRONTEND_READY" -eq 1 ]]; then
    break
  fi
  sleep 0.5
done

if [[ "$BACKEND_READY" -ne 1 || "$FRONTEND_READY" -ne 1 ]]; then
  echo "Timed out waiting for services to respond."
  echo "Check logs in $LOG_DIR/backend.log and $LOG_DIR/frontend.log"
  "$ROOT_DIR/stop.sh" >/dev/null 2>&1 || true
  exit 1
fi

echo ""
echo "BIAI Prize Wheel is running."
echo "  App URL:  http://localhost:5173"
echo "  API URL:  http://localhost:4000/api"
echo "  CSV File: $ROOT_DIR/backend/data/records.csv"
echo "  Backups:  $ROOT_DIR/backend/backups"
echo "  Logs:     $LOG_DIR/backend.log, $LOG_DIR/frontend.log"
echo ""
echo "To stop: ./stop.sh"
