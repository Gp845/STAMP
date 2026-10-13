"""Runs on the provider's machine. Hashes the local weights file, checks the agent registry, then returns a PNG."""

import hashlib
import os
import re
import urllib.parse
import urllib.request

from fastapi import FastAPI, Form, HTTPException
from fastapi.responses import Response
from web3 import Web3
from test_model import render

AGENT = os.environ["AGENT_ADDRESS"]
WEIGHTS = os.environ["WEIGHTS_PATH"]
RPC = os.getenv("RPC_URL", "https://testnet-rpc.monad.xyz")
REGISTRY = os.getenv("AGENT_REGISTRY_ADDRESS", "0x03457d1A96F59DE34A47Bf655113C37E6CD49dD9")
PROFILE = os.getenv("MODEL_PROFILE_ADDRESS", "")
GATEWAY = os.getenv("GATEWAY_URL", "http://127.0.0.1:8000")
PORT = int(os.getenv("PORT", "8001"))

AGENTS_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "agentAddress", "type": "address"}],
        "name": "agents",
        "outputs": [
            {"internalType": "string", "name": "modelName", "type": "string"},
            {"internalType": "string", "name": "modelWeightsHash", "type": "string"},
            {"internalType": "uint256", "name": "stake", "type": "uint256"},
            {"internalType": "uint256", "name": "reputation", "type": "uint256"},
            {"internalType": "bool", "name": "isActive", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    }
]


def sha256_file(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def committed_digest(stored: str) -> str:
    found = re.findall(r"[0-9a-fA-F]{64}", stored or "")
    if len(found) != 1:
        raise ValueError("registry weights hash is not one sha256 digest")
    return found[0].lower()


def _self_check() -> None:
    sample = "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855."
    if committed_digest(sample) != "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855":
        raise SystemExit("digest check failed")
    try:
        committed_digest("no hash here")
    except ValueError:
        return
    raise SystemExit("digest check failed")


_self_check()

PROFILE_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "", "type": "address"}],
        "name": "profiles",
        "outputs": [
            {"internalType": "string", "name": "modelName", "type": "string"},
            {"internalType": "string", "name": "weightsHash", "type": "string"},
            {"internalType": "bool", "name": "set", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    }
]

w3 = Web3(Web3.HTTPProvider(RPC))
registry = w3.eth.contract(address=w3.to_checksum_address(REGISTRY), abi=AGENTS_ABI)
profile = (
    w3.eth.contract(address=w3.to_checksum_address(PROFILE), abi=PROFILE_ABI) if PROFILE else None
)
app = FastAPI(title="STAMP Provider")


def assert_weights() -> None:
    if not os.path.isfile(WEIGHTS):
        raise HTTPException(status_code=403, detail="weights file is missing")
    local = sha256_file(WEIGHTS)
    agent = w3.to_checksum_address(AGENT)
    _name, stored, _stake, _rep, active = registry.functions.agents(agent).call()
    if not active:
        raise HTTPException(status_code=403, detail="agent is not active")
    if profile is not None:
        _model, updated, set_ = profile.functions.profiles(agent).call()
        if set_:
            stored = updated
    try:
        chain = committed_digest(stored)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    if local != chain:
        raise HTTPException(status_code=403, detail=f"weights hash {local} does not match the registry")


def generate_image(prompt: str) -> bytes:
    return render(WEIGHTS, prompt)


@app.post("/generate")
def generate(prompt: str = Form(...)):
    assert_weights()
    return Response(generate_image(prompt), media_type="image/png")


def announce() -> None:
    url = f"http://127.0.0.1:{PORT}"
    data = urllib.parse.urlencode({"agent": AGENT, "url": url}).encode()
    req = urllib.request.Request(GATEWAY.rstrip("/") + "/providers", data=data)
    urllib.request.urlopen(req, timeout=5)


if __name__ == "__main__":
    try:
        announce()
        print(f"registered {AGENT} at http://127.0.0.1:{PORT}")
    except Exception as exc:
        print(f"gateway was not told: {exc}")
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=PORT)
