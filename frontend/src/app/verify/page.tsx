'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';

/* ── Types ─────────────────────────────────────────────────────────────────── */
interface StampRecord {
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
}

interface VerifyResult {
  tier: 'A' | 'B' | 'C' | null;
  stampId?: string;
  record?: StampRecord;
  candidates?: StampRecord[];
  distance?: number;
  label: string;
  error?: string;
}

type Phase = 'idle' | 'dragging' | 'loading' | 'done';

/* ── Helpers ───────────────────────────────────────────────────────────────── */
function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleString();
}

/* ── Sub-components ────────────────────────────────────────────────────────── */
function ConfidenceBadge({ tier }: { tier: 'A' | 'B' | 'C' | null }) {
  if (tier === 'A')
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 border border-black/10 text-[#3f3f3f] text-xs font-mono font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-[#0f0f0f]" />
        Tier A · Watermark Match
      </span>
    );
  if (tier === 'B')
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 border border-black/10 text-[#3f3f3f] text-xs font-mono font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-[#0f0f0f]" />
        Tier B · pHash Match
      </span>
    );
  if (tier === 'C')
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 border border-black/10 text-[#3f3f3f] text-xs font-mono font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-[#0f0f0f]" />
        Tier C · External AI Detected
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 border border-black/10 text-red-700 text-xs font-mono font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-[#0f0f0f]" />
      No Stamp Found
    </span>
  );
}

function StampResultCard({ result }: { result: VerifyResult }) {
  const record = result.record;
  const explorerBase = process.env.NEXT_PUBLIC_EXPLORER_URL || '';

  return (
    <div className="stamp-animate w-full max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <ConfidenceBadge tier={result.tier} />
          <p className="mt-3 text-sm text-[#606060]">{result.label}</p>
        </div>
        {result.tier && (
          <div className="text-right">
            {result.tier === 'A' && <div className="text-[#0f0f0f] text-3xl">✓</div>}
            {result.tier === 'B' && <div className="text-[#0f0f0f] text-3xl">~</div>}
            {result.tier === 'C' && <div className="text-[#0f0f0f] text-3xl">ℹ</div>}
          </div>
        )}
      </div>

      {/* No match */}
      {!result.tier && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-[#606060] text-sm">
            This file has no STAMP record. It may be human-created, an unstamped AI image, or from
            before STAMP was deployed.
          </p>
        </div>
      )}

      {/* Match found */}
      {result.tier && record && (
        <div className="rounded-2xl border border-black/10 bg-[#f7f7f7] overflow-hidden">
          {/* Stamp ID bar */}
          <div className="px-5 py-3 border-b border-black/10 bg-black/5 flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-widest">Stamp ID</span>
            <span className="font-mono text-[#3f3f3f] text-sm">#{record.stampId}</span>
          </div>

          {/* Data rows */}
          <div className="divide-y divide-white/5">
            <Row label="Model / AI Agent" value={record.model || '—'} />
            <Row
              label="Agent Address"
              value={shortAddr(record.agent)}
              link={explorerBase ? `${explorerBase}/address/${record.agent}` : undefined}
            />
            <Row
              label="Creator Address"
              value={shortAddr(record.creator)}
              link={explorerBase ? `${explorerBase}/address/${record.creator}` : undefined}
            />
            <Row label="Kind" value={record.kind} />
            <Row label="Stamped At" value={fmtDate(record.timestamp)} />
            {record.blockNumber > 0 && <Row label="Block" value={`#${record.blockNumber.toLocaleString()}`} />}
            {result.distance !== undefined && (
              <Row label="pHash Distance" value={`${result.distance} (threshold ≤ 7)`} />
            )}
          </div>

          {/* Content hash */}
          <div className="px-5 py-4 bg-[#f7f7f7]">
            <p className="text-xs text-zinc-500 mb-1">Content Hash (SHA-256)</p>
            <p className="font-mono text-xs text-[#606060] break-all">{record.contentHash}</p>
          </div>

          {/* Tx link */}
          {record.txHash && (
            <div className="px-5 py-3 border-t border-black/10 flex justify-end">
              <a
                href={`${explorerBase}/tx/${record.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#606060] hover:text-[#3f3f3f] transition-colors flex items-center gap-1"
              >
                View on Monad Explorer ↗
              </a>
            </div>
          )}
        </div>
      )}

      {/* Tier B candidates */}
      {result.tier === 'B' && result.candidates && result.candidates.length > 1 && (
        <div className="mt-4">
          <p className="text-xs text-zinc-500 mb-2">{result.candidates.length - 1} other possible matches:</p>
          <div className="flex flex-col gap-2">
            {result.candidates.slice(1, 4).map((c) => (
              <div key={c.id} className="rounded-lg border border-black/10 bg-[#f7f7f7] px-4 py-2 flex items-center justify-between">
                <span className="font-mono text-xs text-zinc-500">#{c.stampId}</span>
                <span className="text-xs text-zinc-600">{c.model}</span>
                <span className="text-xs text-zinc-700">{shortAddr(c.creator)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <span className="text-xs text-zinc-500">{label}</span>
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-[#606060] hover:text-[#3f3f3f] transition-colors"
        >
          {value} ↗
        </a>
      ) : (
        <span className="font-mono text-xs text-[#3f3f3f]">{value}</span>
      )}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────────── */
export default function VerifyPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    const video = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
    if (!video && !file.type.startsWith('image/')) {
      alert('Please upload an image or a video.');
      return;
    }

    setPreviewVideo(video);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setPhase('loading');
    setResult(null);

    try {
      const form = new FormData();
      form.append('image', file);
      const res = await fetch('/api/verify', { method: 'POST', body: form });
      const data: VerifyResult = await res.json();
      setResult(data);
    } catch {
      setResult({ tier: null, label: 'Network error — please try again.' });
    } finally {
      setPhase('done');
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setPhase('dragging');
  };
  const onDragLeave = () => {
    if (phase === 'dragging') setPhase('idle');
  };

  const reset = () => {
    setPhase('idle');
    setPreview(null);
    setPreviewVideo(false);
    setResult(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="px-6 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Verify</h1>
          <p className="mt-1 text-sm text-[#606060]">
            Drop a screenshot, repost, or crop. If it carries a stamp, this shows the model, the agent, and the creator.
          </p>
        </div>

        {/* Drop Zone */}
        {phase !== 'done' && (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileRef.current?.click()}
            className={`
              relative cursor-pointer rounded-3xl border-2 border-dashed
              flex flex-col items-center justify-center
              transition-all duration-300 select-none
              ${phase === 'loading' ? 'pointer-events-none opacity-70' : ''}
              ${
                phase === 'dragging'
                  ? 'border-zinc-400 bg-black/5  drop-active'
                  : 'border-black/10 bg-[#fafafa] hover:border-black/30 hover:bg-black/5'
              }
            `}
            style={{ minHeight: preview ? 'auto' : '320px' }}
          >
            {/* Hidden file input */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) processFile(file);
              }}
            />

            {/* Preview */}
            {preview && phase !== 'loading' ? (
              <div className="relative w-full rounded-3xl overflow-hidden">
                {previewVideo ? (
                  <video src={preview} className="w-full max-h-64" muted />
                ) : (
                  <Image src={preview} alt="Preview" width={600} height={400} className="w-full h-auto object-contain max-h-64" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-[#606060]">
                  Click to choose a different image
                </p>
              </div>
            ) : phase === 'loading' ? (
              <div className="py-16 flex flex-col items-center gap-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-zinc-400/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
                  <div className="absolute inset-3 rounded-full bg-black/5" />
                </div>
                <div className="text-center">
                  <p className="text-[#0f0f0f] font-semibold">Analysing…</p>
                  <p className="text-xs text-zinc-500 mt-1">Decoding watermark → checking the fingerprint</p>
                </div>
              </div>
            ) : (
              <div className="py-16 flex flex-col items-center gap-4 px-8">
                {/* Upload icon */}
                <div className="w-16 h-16 rounded-2xl border border-black/10 bg-black/5 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path d="M14 4v14M8 10l6-6 6 6" stroke="#0f0f0f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M4 22h20" stroke="#888888" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-[#0f0f0f] font-semibold text-lg">
                    {phase === 'dragging' ? 'Release to verify' : 'Drop an image or video'}
                  </p>
                  <p className="text-zinc-500 text-sm mt-1">or click to browse · PNG, JPG, WEBP, MP4</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {['Screenshot', 'Repost', 'Cropped', 'Re-encoded video'].map((t) => (
                    <span key={t} className="px-2.5 py-1 rounded-full bg-black/5 border border-black/10 text-zinc-600 text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {phase === 'done' && result && (
          <div className="space-y-6">
            {/* Preview + reset row */}
            <div className="flex items-center gap-4">
              {preview && (
                <div className="flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-black/10">
                  {previewVideo ? (
                    <video src={preview} className="w-full h-full object-cover" muted />
                  ) : (
                    <Image src={preview} alt="Uploaded" width={80} height={80} className="w-full h-full object-cover" />
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[#0f0f0f] font-semibold">Analysis complete</p>
                <p className="text-xs text-zinc-500 truncate">
                  Tier {result.tier ?? 'none'} · {result.label}
                </p>
              </div>
              <button
                onClick={reset}
                className="flex-shrink-0 px-4 py-2 rounded-lg border border-black/10 hover:border-black/10 bg-black/5 hover:bg-black/5 text-sm text-[#3f3f3f] transition-all"
              >
                Verify another
              </button>
            </div>

            {/* Result card */}
            <StampResultCard result={result} />
          </div>
        )}

        {/* How verification works */}
        <div className="mt-16 rounded-2xl border border-black/10 bg-[#f7f7f7] p-6">
          <h2 className="text-[#0f0f0f] font-bold mb-4">How verification works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-zinc-500">
            <div className="flex gap-3">
              <span className="text-[#606060] font-mono text-xs mt-0.5">A</span>
              <div>
                <p className="text-[#3f3f3f] font-medium mb-1">Watermark Decode</p>
                <p>Reads the invisible TrustMark in an image, or in frames sampled from a video.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-[#0f0f0f] font-mono text-xs mt-0.5">B</span>
              <div>
                <p className="text-[#3f3f3f] font-medium mb-1">pHash Band Lookup</p>
                <p>Computes perceptual hash and queries 4 bands against Envio GraphQL. Matches within Hamming distance 7.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
