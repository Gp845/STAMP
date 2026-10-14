#!/usr/bin/env bash
# One-shot server setup for Ubuntu 24.04 x64. Run as the login user (needs sudo) from the repo root,
# after copying in the untracked files (.env files, provider/test-model.pt, frontend/data, gateway/stamps).
# Optional env: ENVIO_URL (Envio Cloud GraphQL URL), CRE_API_KEY (enables the CRE check on Verify).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$PWD
USER_NAME=$(id -un)
IP=$(curl -fsS https://api.ipify.org)
HOST="${IP//./-}.sslip.io"
NODE_VERSION=v24.21.0

sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3-venv python3-pip git curl caddy unzip

# 4 GB RAM is tight when a video verify loads a second TrustMark next to the gateway's.
if [ ! -f /swapfile ]; then
  sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
fi

if [ ! -x /opt/node/bin/node ]; then
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz" | sudo tar xJ -C /opt
  sudo ln -sfn "/opt/node-$NODE_VERSION-linux-x64" /opt/node
fi
export PATH="$ROOT/.venv/bin:/opt/node/bin:$HOME/.bun/bin:$HOME/.cre/bin:$PATH"

python3 -m venv .venv
pip install -q --upgrade pip
pip install -q torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -q -r gateway/requirements.txt -r worker/requirements.txt -r provider/requirements.txt
# Fetches TrustMark's model files once, so the first request isn't the slow one.
python -c "from trustmark import TrustMark; TrustMark(verbose=False, model_type='Q', encoding_type=TrustMark.Encoding.BCH_SUPER)"

if [ -n "${ENVIO_URL:-}" ]; then
  sed -i "s#^NEXT_PUBLIC_ENVIO_URL=.*#NEXT_PUBLIC_ENVIO_URL=$ENVIO_URL#" frontend/.env.local
fi
(cd frontend && npm ci --no-audit --no-fund && npx next build)

CRE_ENV=""
if [ -n "${CRE_API_KEY:-}" ]; then
  [ -x "$HOME/.bun/bin/bun" ] || curl -fsSL https://bun.sh/install | bash
  [ -x "$HOME/.cre/bin/cre" ] || curl -sSL https://cre.chain.link/install.sh | bash
  (cd cre/stamp-verify && "$HOME/.bun/bin/bun" install)
  CRE_ENV="Environment=CRE_API_KEY=$CRE_API_KEY
Environment=CRE_BIN=$HOME/.cre/bin/cre"
fi

unit() {
  sudo tee "/etc/systemd/system/$1.service" > /dev/null
}

unit stamp-gateway <<EOF
[Unit]
Description=STAMP gateway
After=network-online.target
[Service]
User=$USER_NAME
WorkingDirectory=$ROOT/gateway
ExecStart=$ROOT/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
[Install]
WantedBy=multi-user.target
EOF

# The gateway keeps providers in memory, so the provider restarts with it and re-announces once it is up.
unit stamp-provider <<EOF
[Unit]
Description=STAMP provider
After=stamp-gateway.service
PartOf=stamp-gateway.service
[Service]
User=$USER_NAME
WorkingDirectory=$ROOT/provider
Environment=AGENT_ADDRESS=0x95e229a7dbbcd1a066956cd6f48204570a34e5eb
Environment=WEIGHTS_PATH=test-model.pt
Environment=MODEL_PROFILE_ADDRESS=0x5DB23062e917c4770C8De8c216e53677d7Af1A8D
TimeoutStartSec=300
ExecStartPre=/bin/sh -c 'until curl -sf -o /dev/null http://127.0.0.1:8000/stamps; do sleep 2; done'
ExecStart=$ROOT/.venv/bin/python server.py
Restart=always
[Install]
WantedBy=stamp-gateway.service
EOF

unit stamp-frontend <<EOF
[Unit]
Description=STAMP frontend
After=stamp-gateway.service
[Service]
User=$USER_NAME
WorkingDirectory=$ROOT/frontend
Environment=PATH=$ROOT/.venv/bin:/opt/node/bin:$HOME/.bun/bin:/usr/bin:/bin
$CRE_ENV
ExecStart=/opt/node/bin/npx next start -H 127.0.0.1 -p 3000
Restart=always
[Install]
WantedBy=multi-user.target
EOF

echo "$HOST {
	reverse_proxy 127.0.0.1:3000
}" | sudo tee /etc/caddy/Caddyfile > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable --now stamp-gateway stamp-provider stamp-frontend
sudo systemctl restart caddy
echo "https://$HOST"
