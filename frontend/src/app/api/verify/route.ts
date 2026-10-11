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

function isVideo(file: File) {
  return file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
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
      try {
        return NextResponse.json(await verifyVideo(file));
      } catch (err) {
        console.error('[/api/verify] video', err);
        return NextResponse.json({ tier: null, label: 'Could not fingerprint this video.' }, { status: 200 });
      }
    }

    // ── Forward to Python gateway for watermark decode + pHash ───────────────
    const gwForm = new FormData();
    gwForm.append('image', file);

    let gwResult: {
      tier: 'A' | 'B' | 'C' | null;
      stampId?: string;
      bands?: string[];
      distance?: number;
      label: string;
    };

    try {
      const gwRes = await fetch(`${GATEWAY_URL}/verify`, {
        method: 'POST',
        body: gwForm,
        signal: AbortSignal.timeout(15000),
      });
      if (!gwRes.ok) throw new Error(`Gateway ${gwRes.status}`);
      gwResult = await gwRes.json();
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
      const record = await queryEnvioById(gwResult.stampId);
      return NextResponse.json({
        tier: 'A',
        stampId: gwResult.stampId,
        record,
        label: record ? 'Verified: stamped content found on Monad' : 'Watermark decoded but stamp not yet indexed',
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
