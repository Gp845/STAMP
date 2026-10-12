import os
import io
import base64
import random
import hashlib
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
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
    # MOCK AI GENERATION
    # In a real app, you would call OpenAI, Midjourney, etc.
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

@app.post("/verify")
async def verify(image: UploadFile = File(...)):
    """
    Decodes the watermark (Tier A) and calculates pHash (Tier B).
    Returns bands and stampId if found so the frontend can query Envio.
    """
    contents = await image.read()
    img = Image.open(io.BytesIO(contents)).convert('RGB')
    
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
    
    # Tier C: External AI Detection (C2PA)
    if not tier:
        # Check raw bytes for C2PA manifest signatures (common in DALL-E and Adobe AI)
        if b"c2pa" in contents.lower() or b"xmp" in contents.lower():
            tier = "C"
            label = "External AI Detected (C2PA / XMP Metadata)"
        else:
            tier = "B"
            label = "pHash bands calculated"
            
    return JSONResponse({
        "tier": tier,
        "stampId": stamp_id_hex,
        "bands": bands,
        "label": label
    })
