#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

PORT="${PORT:-5173}"
HOST="${HOST:-0.0.0.0}"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to launch Project ICE." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Launching Project ICE hockey game..."
echo "Local URL:   http://localhost:${PORT}"
echo "Network URL: http://${HOST}:${PORT}"

npm run dev -- --host "${HOST}" --port "${PORT}"
