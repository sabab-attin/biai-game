#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_DIR="$ROOT_DIR/.pids"

stop_service() {
  local name="$1"
  local pid_file="$PID_DIR/$2"

  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    rm -f "$pid_file"
    return 1
  fi

  kill "$pid" 2>/dev/null || true
  for _ in $(seq 1 20); do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f "$pid_file"
      echo "Stopped $name (PID $pid)."
      return 0
    fi
    sleep 0.25
  done

  kill -9 "$pid" 2>/dev/null || true
  rm -f "$pid_file"
  echo "Force stopped $name (PID $pid)."
  return 0
}

STOPPED_ANY=0
if stop_service "frontend" "frontend.pid"; then
  STOPPED_ANY=1
fi
if stop_service "backend" "backend.pid"; then
  STOPPED_ANY=1
fi

if [[ "$STOPPED_ANY" -eq 0 ]]; then
  echo "BIAI Prize Wheel is not running."
else
  echo "All BIAI Prize Wheel services stopped."
fi
