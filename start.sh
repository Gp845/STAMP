#!/usr/bin/env bash
# Starts gateway (:8000), provider (:8001) and frontend (:3000) in the background. Logs go to logs/.
# Needs .venv with gateway/worker/provider requirements, and a built frontend (cd frontend && npm ci && npx next build).
set -euo pipefail
cd "$(dirname "$0")"
ROOT=$PWD
mkdir -p logs
export PATH="$ROOT/.venv/bin:$HOME/.local/opt/node/bin:$HOME/.bun/bin:$HOME/.cre/bin:$PATH"
export CRE_BIN="${CRE_BIN:-$(command -v cre || true)}"

pkill -f "uvicorn main:app|python server.py|next start|next-server" || true
sleep 2

wait_for() { for _ in $(seq 1 120); do curl -sf -o /dev/null "$1" && return 0; sleep 2; done; echo "timed out: $1" >&2; return 1; }

(cd gateway && setsid nohup uvicorn main:app --host 127.0.0.1 --port 8000 > "$ROOT/logs/gateway.log" 2>&1 < /dev/null &)
wait_for http://127.0.0.1:8000/stamps

(cd provider && AGENT_ADDRESS="${AGENT_ADDRESS:-0x95e229a7dbbcd1a066956cd6f48204570a34e5eb}" \
  WEIGHTS_PATH="${WEIGHTS_PATH:-test-model.pt}" \
  MODEL_PROFILE_ADDRESS="${MODEL_PROFILE_ADDRESS:-0x5DB23062e917c4770C8De8c216e53677d7Af1A8D}" \
  setsid nohup python server.py > "$ROOT/logs/provider.log" 2>&1 < /dev/null &)

(cd frontend && setsid nohup npx next start -p 3000 > "$ROOT/logs/frontend.log" 2>&1 < /dev/null &)
wait_for http://127.0.0.1:3000/
echo "up: gateway :8000, provider :8001, frontend :3000"
