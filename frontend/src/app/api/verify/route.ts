import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { unlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';
import { NextRequest, NextResponse } from 'next/server';

const execFileAsync = promisify(execFile);

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/verify
// Body: multipart/form-data with field "image"
// Returns: { tier, stampId?, record?, distance?, label, bands? }
// ─────────────────────────────────────────────────────────────────────────────

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000';
const ENVIO_URL   = process.env.NEXT_PUBLIC_ENVIO_URL   || 'http://localhost:8080/v1/graphql';

async function queryEnvioByBands(bands: string[]) {
  const [b0, b1, b2, b3] = bands;
  const query = `
    query LookupByBands($b0: String!, $b1: String!, $b2: String!, $b3: String!) {
      ProvenanceRegistry_Stamped(
        where: {
          _or: [
            { band0: { _eq: $b0 } }
            { band1: { _eq: $b1 } }
            { band2: { _eq: $b2 } }
            { band3: { _eq: $b3 } }
          ]
        }
        limit: 10
        order_by: { timestamp: desc }
      ) {
        id stampId contentHash model agent creator kind timestamp
        band0 band1 band2 band3 txHash blockNumber
      }
    }
  `;
  try {
    const res = await fetch(ENVIO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { b0, b1, b2, b3 } }),
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json();
    return json?.data?.ProvenanceRegistry_Stamped ?? [];
  } catch {
    return [];
  }
}

async function queryEnvioById(stampId: string) {
  const query = `
    query LookupById($id: String!) {
      ProvenanceRegistry_Stamped(where: { stampId: { _eq: $id } } limit: 1) {
        id stampId contentHash model agent creator kind timestamp
        band0 band1 band2 band3 txHash blockNumber
      }
    }
  `;
  try {
    const res = await fetch(ENVIO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { id: stampId } }),
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json();
    return json?.data?.ProvenanceRegistry_Stamped?.[0] ?? null;
  } catch {
    return null;
  }
}

const ZERO = '0x0000000000000000000000000000000000000000';
const STAMPS = 'a9481e91';

function encodeString(value: string) {
  const bytes = new TextEncoder().encode(value);
  const length = bytes.length.toString(16).padStart(64, '0');
  let data = '';
  for (const byte of bytes) data += byte.toString(16).padStart(2, '0');
  return length + data + '0'.repeat((64 - (data.length % 64)) % 64);
}

function decodeString(data: string, offsetBytes: number) {
  const start = 2 + offsetBytes * 2;
  const length = Number.parseInt(data.slice(start, start + 64), 16);
  const hex = data.slice(start + 64, start + 64 + length * 2);
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return new TextDecoder().decode(bytes);
}

async function readOnChain(stampId: string) {
  const rpc = process.env.NEXT_PUBLIC_RPC_URL;
  const registry = process.env.NEXT_PUBLIC_PROVENANCE_REGISTRY_ADDRESS;
  if (!rpc || !registry || registry === ZERO) return null;
  const data = `0x${STAMPS}${(32).toString(16).padStart(64, '0')}${encodeString(stampId)}`;
  try {
    const res = await fetch(rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [{ to: registry, data }, 'latest'],
      }),
      signal: AbortSignal.timeout(5000),
    });
    const raw = (await res.json())?.result as string | undefined;
    if (!raw || raw.length < 2 + 7 * 64) return null;
    const word = (i: number) => BigInt(`0x${raw.slice(2 + i * 64, 2 + (i + 1) * 64)}`);
    const timestamp = Number(word(5));
    if (!timestamp) return null;
    const addr = (i: number) => `0x${raw.slice(2 + i * 64 + 24, 2 + (i + 1) * 64)}`;
    return {
      id: stampId,
      stampId,
      contentHash: decodeString(raw, Number(word(0))),
      model: decodeString(raw, Number(word(1))),
      agent: addr(2),
      creator: addr(3),
      kind: word(4) === BigInt(0) ? 'ATTESTED' : 'CLAIMED',
      timestamp,
      txHash: '',
      blockNumber: 0,
    };
  } catch {
    return null;
  }
}

type CreAnswer = {
  match?: boolean;
  record?: {
    id: string;
    stampId: string;
    contentHash: string;
    model: string;
    agent: string;
    creator: string;
    kind: 'ATTESTED' | 'CLAIMED';
    timestamp: number;
    txHash: string;
    blockNumber: number;
  };
};

function parseCreResult(stdout: string): CreAnswer | null {
  const marker = 'Workflow Simulation Result:';
  const at = stdout.indexOf(marker);
  if (at < 0) return null;
  const line = stdout
    .slice(at + marker.length)
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part.startsWith('"') || part.startsWith('{'));
  if (!line) return null;
  const parsed = JSON.parse(line);
  return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
}

function checkCreParser() {
  const sample =
    'Workflow Simulation Result:\n"{\\"match\\":true,\\"record\\":{\\"stampId\\":\\"abc\\"}}"\n';
  const parsed = parseCreResult(sample);
  if (!parsed?.match || parsed.record?.stampId !== 'abc') throw new Error('CRE result parser failed');
}
checkCreParser();

async function askCre(stampId: string): Promise<CreAnswer | null> {
  const cre = process.env.CRE_BIN || path.join(process.env.LOCALAPPDATA || '', 'Programs', 'cre', 'cre.exe');
  const project = path.resolve(process.cwd(), '..', 'cre');
  const payload = path.join(os.tmpdir(), `cre-${stampId}.json`);
  await writeFile(payload, JSON.stringify({ stampId }));
  try {
    const { stdout } = await execFileAsync(
      cre,
      ['workflow', 'simulate', 'stamp-verify', '--target', 'staging-settings', '--non-interactive', '--trigger-index', '0', '--http-payload', payload],
      { cwd: project, timeout: 45000 },
    );
    return parseCreResult(stdout);
  } catch {
    return null;
  } finally {
    await unlink(payload).catch(() => {});
  }
}

function isVideo(file: File) {
  return file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
}

async function readGateway(file: File) {
  const gwForm = new FormData();
  gwForm.append('image', file);
  const gwRes = await fetch(`${GATEWAY_URL}/verify`, {
    method: 'POST',
    body: gwForm,
    signal: AbortSignal.timeout(20000),
  });
  if (!gwRes.ok) throw new Error(`Gateway ${gwRes.status}`);
  return gwRes.json() as Promise<{
    tier: 'A' | 'B' | 'C' | null;
    stampId?: string;
    bands?: string[];
    distance?: number;
    generator?: string;
    label: string;
  }>;
}

async function verifyVideo(file: File) {
  const tmp = path.join(os.tmpdir(), `stamp-${randomUUID()}.mp4`);
  const script = path.resolve(process.cwd(), '..', 'worker', 'videostamp.py');
  await writeFile(tmp, Buffer.from(await file.arrayBuffer()));
  try {
    const { stdout } = await execFileAsync('python', [script, 'verify', tmp], {
      env: { ...process.env, PYTHONUTF8: '1' },
      timeout: 60000,
    });
    const line = stdout.trim().split('\n').pop();
    return JSON.parse(line || '{}');
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get('image') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    if (isVideo(file)) {
      let video: { tier: string | null; label: string } = { tier: null, label: 'No stamp record found' };
      try {
        video = await verifyVideo(file);
      } catch (err) {
        console.error('[/api/verify] video', err);
        video = { tier: null, label: 'Could not fingerprint this video.' };
      }
      if (video.tier) return NextResponse.json(video);
      try {
        const claim = await readGateway(file);
        if (claim.tier === 'C') return NextResponse.json({ tier: 'C', label: claim.label });
      } catch (err) {
        console.error('[/api/verify] video c2pa', err);
      }
      return NextResponse.json(video);
    }

    // ── Forward to Python gateway for watermark decode + pHash ───────────────
    let gwResult: {
      tier: 'A' | 'B' | 'C' | null;
      stampId?: string;
      bands?: string[];
      distance?: number;
      label: string;
    };

    try {
      gwResult = await readGateway(file);
    } catch {
      // ── Demo mode: gateway offline — return a mock result for UI testing ──
      gwResult = {
        tier: null,
        label: 'Gateway offline — running in demo mode',
        bands: ['3f', 'a7', '2c', '91'],
      };
    }

    // ── Tier A: exact stampId match ──────────────────────────────────────────
    if (gwResult.tier === 'A' && gwResult.stampId) {
      const cre = await askCre(gwResult.stampId);
      if (cre?.match && cre.record) {
        return NextResponse.json({
          tier: 'A',
          stampId: gwResult.stampId,
          record: cre.record,
          cre: true,
          label: 'Verified by Chainlink CRE: watermark matches the onchain stamp',
        });
      }
      const record = (await queryEnvioById(gwResult.stampId)) ?? (await readOnChain(gwResult.stampId));
      return NextResponse.json({
        tier: 'A',
        stampId: gwResult.stampId,
        record,
        label: record ? 'Verified: stamped content found on chain' : 'Watermark decoded but stamp not yet indexed',
      });
    }

    // ── Tier C: External AI Detection ──────────────────────────────────────────
    if (gwResult.tier === 'C') {
      return NextResponse.json({
        tier: 'C',
        label: gwResult.label,
      });
    }

    // ── Tier B: pHash band lookup ────────────────────────────────────────────
    if (gwResult.bands && gwResult.bands.length >= 4) {
      const candidates = await queryEnvioByBands(gwResult.bands);
      if (candidates.length > 0) {
        return NextResponse.json({
          tier: 'B',
          distance: gwResult.distance,
          record: candidates[0],
          candidates,
          label: 'Likely derived from stamped work',
        });
      }
    }

    // ── No match ─────────────────────────────────────────────────────────────
    return NextResponse.json({
      tier: null,
      label: gwResult.label ?? 'No stamp record found',
    });
  } catch (err) {
    console.error('[/api/verify]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
