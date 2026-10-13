import os
import io
import json
import base64
import random
import hashlib
import urllib.parse
import urllib.request
import urllib.error
from fastapi import FastAPI, Request, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import imagehash
from web3 import Web3
from dotenv import load_dotenv

# Try importing the trustmark library
try:
    from trustmark import TrustMark
    _tm = TrustMark(verbose=False, model_type='Q', encoding_type=TrustMark.Encoding.BCH_SUPER)
    HAS_TRUSTMARK = True
except ImportError:
    HAS_TRUSTMARK = False
    print("Warning: trustmark not installed. Running in mock mode for watermark.")

load_dotenv()

app = FastAPI(title="STAMP Gateway")

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Web3 Configuration
RPC_URL = os.getenv("RPC_URL", "https://testnet-rpc.monad.xyz")
PRIVATE_KEY = os.getenv("GATEWAY_PRIVATE_KEY", "0x0")
REGISTRY_ADDRESS = os.getenv("PROVENANCE_REGISTRY_ADDRESS", "0x0")
JOB_ESCROW_ADDRESS = os.getenv("JOB_ESCROW_ADDRESS", "0x0")

w3 = Web3(Web3.HTTPProvider(RPC_URL))
PROVIDERS: dict[str, str] = {}
STAMP_DIR = os.path.join(os.path.dirname(__file__), "stamps")
os.makedirs(STAMP_DIR, exist_ok=True)
# For demo, load a generic ABI (just the attest function)
ATTEST_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "id", "type": "string"},
            {"internalType": "string", "name": "contentHash", "type": "string"},
            {"internalType": "string", "name": "band0", "type": "string"},
            {"internalType": "string", "name": "band1", "type": "string"},
            {"internalType": "string", "name": "band2", "type": "string"},
            {"internalType": "string", "name": "band3", "type": "string"},
            {"internalType": "string", "name": "band4", "type": "string"},
            {"internalType": "string", "name": "band5", "type": "string"},
            {"internalType": "string", "name": "band6", "type": "string"},
            {"internalType": "string", "name": "band7", "type": "string"},
            {"internalType": "string", "name": "model", "type": "string"},
            {"internalType": "address", "name": "agent", "type": "address"},
            {"internalType": "address", "name": "creator", "type": "address"}
        ],
        "name": "attest",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

SETTLE_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "_jobId", "type": "uint256"},
            {"internalType": "string", "name": "_stampId", "type": "string"},
        ],
        "name": "settleJob",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]

def send(fn):
    account = w3.eth.account.from_key(PRIVATE_KEY)
    tx = fn.build_transaction({
        'from': account.address,
        'nonce': w3.eth.get_transaction_count(account.address),
        'gas': 800000,
        'gasPrice': w3.eth.gas_price,
        'chainId': w3.eth.chain_id,
    })
    signed = w3.eth.account.sign_transaction(tx, private_key=PRIVATE_KEY)
    raw = getattr(signed, 'raw_transaction', None)
    if raw is None:
        raw = signed.rawTransaction
    sent = w3.eth.send_raw_transaction(raw)
    receipt = w3.eth.wait_for_transaction_receipt(sent)
    if receipt.status != 1:
        raise RuntimeError('chain transaction reverted')
    tx_hash = sent.hex()
    return tx_hash if tx_hash.startswith('0x') else f'0x{tx_hash}'

MAX_HAM = 7

def _band_keys(h, n=8):
    bits = h.hash.flatten().astype(int)
    k = 64 // n
    return [f"{int(''.join(map(str, bits[i*k:(i+1)*k])), 2):02x}" for i in range(n)]

@app.post("/generate")
async def generate_and_stamp(
    prompt: str = Form(...),
    agent_address: str = Form(...),
    creator_address: str = Form(...),
    model: str = Form('Mock Agent Gen'),
    job_id: str = Form(''),
):
    """
    1. Calls AI Model to generate image
    2. Embeds Watermark & gets pHash
    3. Anchors on Monad
    4. Returns Image URL & Stamp info
    """
    remote = provider_png(agent_address, prompt)
    if remote:
        img = Image.open(io.BytesIO(remote)).convert("RGB")
    else:
        img = Image.new('RGB', (1024, 1024), color = (random.randint(0,255), random.randint(0,255), random.randint(0,255)))
    
    stamp_id = random.getrandbits(40)
    stamp_id_hex = f"{stamp_id:010x}"
    
    if HAS_TRUSTMARK:
        stamped = _tm.encode(img, format(stamp_id, '040b'), MODE='binary').convert('RGB')
    else:
        # Mock stamping
        stamped = img

    buf = io.BytesIO()
    stamped.save(buf, format='PNG')
    img_bytes = buf.getvalue()
    content_hash = hashlib.sha256(img_bytes).hexdigest()
    
    h = imagehash.phash(stamped)
    bands = _band_keys(h, 8)
    
    model_name = model or "Mock Agent Gen"
    with open(os.path.join(STAMP_DIR, f"{stamp_id_hex}.png"), "wb") as stamp_file:
        stamp_file.write(img_bytes)
    with open(os.path.join(STAMP_DIR, f"{stamp_id_hex}.json"), "w", encoding="utf-8") as meta_file:
        json.dump({
            "stampId": stamp_id_hex,
            "prompt": prompt,
            "model": model_name,
            "agent": agent_address,
            "creator": creator_address,
            "jobId": job_id,
            "contentHash": content_hash,
        }, meta_file)
    tx_hash = "0xmocktxhash"
    settle_tx = None
    if PRIVATE_KEY != "0x0" and REGISTRY_ADDRESS != "0x0":
        try:
            registry = w3.eth.contract(address=w3.to_checksum_address(REGISTRY_ADDRESS), abi=ATTEST_ABI)
            tx_hash = send(registry.functions.attest(
                stamp_id_hex,
                content_hash,
                bands[0], bands[1], bands[2], bands[3],
                bands[4], bands[5], bands[6], bands[7],
                model_name,
                w3.to_checksum_address(agent_address),
                w3.to_checksum_address(creator_address),
            ))
            if job_id and JOB_ESCROW_ADDRESS != "0x0":
                escrow = w3.eth.contract(address=w3.to_checksum_address(JOB_ESCROW_ADDRESS), abi=SETTLE_ABI)
                settle_tx = send(escrow.functions.settleJob(int(job_id), stamp_id_hex))
        except Exception as e:
            print(f"Error anchoring stamp: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    return JSONResponse({
        "status": "success",
        "stampId": stamp_id_hex,
        "contentHash": content_hash,
        "txHash": tx_hash,
        "settleTx": settle_tx,
        "bands": bands,
        "image": base64.b64encode(img_bytes).decode(),
    })

STAMPS_ABI = [
    {
        "inputs": [{"internalType": "string", "name": "id", "type": "string"}],
        "name": "stamps",
        "outputs": [
            {"internalType": "string", "name": "contentHash", "type": "string"},
            {"internalType": "string", "name": "model", "type": "string"},
            {"internalType": "address", "name": "agent", "type": "address"},
            {"internalType": "address", "name": "creator", "type": "address"},
            {"internalType": "uint8", "name": "kind", "type": "uint8"},
            {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
            {"internalType": "bool", "name": "revoked", "type": "bool"},
        ],
        "stateMutability": "view",
        "type": "function",
    }
]

def provider_png(agent: str, prompt: str):
    url = PROVIDERS.get(agent.lower())
    if not url:
        print(f"no provider online for {agent}")
        return None
    data = urllib.parse.urlencode({"prompt": prompt}).encode()
    req = urllib.request.Request(url + "/generate", data=data)
    try:
        with urllib.request.urlopen(req, timeout=120) as res:
            return res.read()
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")[:400]
        raise HTTPException(status_code=502, detail=body or "provider refused the job") from exc


@app.post("/providers")
def register_provider(request: Request, agent: str = Form(...), url: str = Form(...)):
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1"):
        raise HTTPException(status_code=403, detail="only a local provider can register")
    if not (url.startswith("http://127.0.0.1:") or url.startswith("http://localhost:")):
        raise HTTPException(status_code=400, detail="provider URL must be on this machine")
    PROVIDERS[agent.lower()] = url.rstrip("/")
    return {"ok": True}


@app.get("/providers")
def list_providers():
    return PROVIDERS


@app.get("/stamps")
def list_stamps():
    rows = []
    for name in os.listdir(STAMP_DIR):
        if not name.endswith(".json"):
            continue
        with open(os.path.join(STAMP_DIR, name), encoding="utf-8") as meta_file:
            rows.append(json.load(meta_file))
    rows.reverse()
    return rows

@app.get("/stamps/{stamp_id}.png")
def stamp_png(stamp_id: str):
    if not stamp_id.isalnum():
        raise HTTPException(status_code=404, detail="unknown stamp")
    path = os.path.join(STAMP_DIR, f"{stamp_id}.png")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="image was not kept")
    return FileResponse(path, media_type="image/png")

@app.get("/cre/stamp/{stamp_id}")
def cre_stamp(stamp_id: str):
    """Registry row for the CRE workflow. The workflow calls this, then reads the same function onchain."""
    if REGISTRY_ADDRESS in ("0x0", "0x0000000000000000000000000000000000000000"):
        raise HTTPException(status_code=404, detail="registry address is not set")
    registry = w3.eth.contract(address=w3.to_checksum_address(REGISTRY_ADDRESS), abi=STAMPS_ABI)
    content_hash, model, agent, creator, kind, timestamp, revoked = registry.functions.stamps(stamp_id).call()
    return {
        "found": timestamp > 0 and not revoked,
        "stampId": stamp_id,
        "contentHash": content_hash,
        "model": model,
        "agent": agent,
        "creator": creator,
        "kind": "ATTESTED" if kind == 0 else "CLAIMED",
        "timestamp": timestamp,
        "revoked": revoked,
    }

def _mime(data: bytes):
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return "image/gif"
    if len(data) >= 12 and data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    if len(data) >= 12 and data[4:8] == b"ftyp":
        return "video/quicktime" if data[8:12] == b"qt  " else "video/mp4"
    if data.startswith(b"\x1aE\xdf\xa3"):
        return "video/webm"
    return None


def _c2pa(data: bytes):
    """A parsed C2PA manifest, or None. The letters c2pa in the file are not a manifest."""
    mime = _mime(data)
    if not mime:
        return None
    try:
        from c2pa import Reader
        with Reader(mime, io.BytesIO(data)) as reader:
            raw = reader.json()
    except Exception:
        return None
    if not raw:
        return None
    store = json.loads(raw)
    manifest = (store.get("manifests") or {}).get(store.get("active_manifest"))
    if not manifest:
        return None
    generator = manifest.get("claim_generator") or "C2PA"
    for assertion in manifest.get("assertions") or []:
        if "actions" not in (assertion.get("label") or ""):
            continue
        actions = (assertion.get("data") or {}).get("actions") or []
        if actions and actions[0].get("softwareAgent"):
            generator = actions[0]["softwareAgent"]
        break
    issuer = (manifest.get("signature_info") or {}).get("issuer")
    label = f"C2PA manifest from {generator}"
    if issuer:
        label += f", signed by {issuer}"
    return {"generator": generator, "label": label}


@app.post("/verify")
async def verify(image: UploadFile = File(...)):
    """
    Decodes the watermark (Tier A) and calculates pHash (Tier B).
    Returns bands and stampId if found so the frontend can query Envio.
    """
    contents = await image.read()
    claim = _c2pa(contents)
    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        if claim:
            return JSONResponse({
                "tier": "C",
                "stampId": None,
                "bands": [],
                "generator": claim["generator"],
                "label": claim["label"],
            })
        return JSONResponse({
            "tier": None,
            "stampId": None,
            "bands": [],
            "generator": None,
            "label": "No stamp detected",
        })

    tier = None
    stamp_id_hex = None
    label = "No stamp detected"

    # Tier A
    if HAS_TRUSTMARK:
        try:
            secret, present, _ = _tm.decode(img, MODE='binary')
            if present and len(secret) == 40:
                stamp_id_hex = f"{int(secret, 2):010x}"
                tier = "A"
                label = "Watermark decoded successfully"
        except Exception as e:
            print("Watermark decode failed:", e)

    # Tier B
    h = imagehash.phash(img)
    bands = _band_keys(h, 8)

    # Tier C only when a real manifest parses. Watermark still wins.
    if not tier:
        if claim:
            tier = "C"
            label = claim["label"]
        else:
            tier = "B"
            label = "pHash bands calculated"

    return JSONResponse({
        "tier": tier,
        "stampId": stamp_id_hex,
        "bands": bands,
        "generator": claim["generator"] if claim else None,
        "label": label,
    })
