'use client';

import { useEffect, useState } from 'react';
import Memberships from '@/components/Memberships';
import Link from 'next/link';
import { createJob, loadChainAgents, type ChainAgent } from '@/lib/wallet';

/* ── Demo data (replace with real wallet + Envio queries) ────────────────── */
const DEMO_STAMPS = [
  {
    id: '1',
    stampId: '3fa72c91aa',
    model: 'Gemini Flash 2.0',
    agent: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    creator: '0x1f9090aaE28b8a3dCeaDf281B0F12828e676c326',
    kind: 'ATTESTED',
    timestamp: 1728370000,
    txHash: '0xabc123',
    blockNumber: 4521000,
    contentHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    thumbnail: null,
    prompt: 'A cyberpunk city at night with neon lights reflected in rain puddles',
  },
  {
    id: '2',
    stampId: '7b1d4e82ff',
    model: 'Stable Diffusion XL',
    agent: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d',
    creator: '0x1f9090aaE28b8a3dCeaDf281B0F12828e676c326',
    kind: 'ATTESTED',
    timestamp: 1728290000,
    txHash: '0xdef456',
    blockNumber: 4510000,
    contentHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    thumbnail: null,
    prompt: 'Portrait of a samurai warrior in a cherry blossom forest',
  },
  {
    id: '3',
    stampId: 'c4a91f3b22',
    model: 'DALL-E 3',
    agent: '0x4B0897b0513fdC7C541B6d9D7E929C4e5364D2dB',
    creator: '0x1f9090aaE28b8a3dCeaDf281B0F12828e676c326',
    kind: 'ATTESTED',
    timestamp: 1728210000,
    txHash: '0xghi789',
    blockNumber: 4500000,
    contentHash: '2c624232cdd221771294dfbb310acbc8b96173c7b19dfed5a',
    thumbnail: null,
    prompt: 'Abstract geometric patterns in the style of Mondrian, ultra-HD',
  },
];

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function ModelBadge({ model }: { model: string }) {
  const color =
    model.includes('Gemini') ? 'text-[#3f3f3f] bg-black/5 border-black/10' :
    model.includes('Stable') ? 'text-[#3f3f3f] bg-black/5 border-black/10' :
    model.includes('DALL') ? 'text-[#3f3f3f] bg-black/5 border-black/10' :
    'text-[#3f3f3f] bg-black/5 border-black/10';

  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${color}`}>
      {model}
    </span>
  );
}

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'stamps' | 'jobs'>('stamps');
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [agents, setAgents] = useState<ChainAgent[]>([]);
  const [agent, setAgent] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [made, setMade] = useState<{ stampId: string; image: string; prompt: string; model: string }[]>([]);

  useEffect(() => {
    if (!newJobOpen) return;
    loadChainAgents().then(setAgents).catch(() => setAgents([]));
  }, [newJobOpen]);

  async function fundJob() {
    const chosen = agents.find((item) => item.address === agent);
    if (!chosen || !prompt.trim()) return;
    setBusy(true);
    setNote(null);
    try {
      setNote('Confirm the payment in your wallet.');
      const job = await createJob(chosen.address, prompt.trim());
      setNote('Paid. Stamping the image.');
      const body = new FormData();
      body.set('prompt', prompt.trim());
      body.set('agent_address', chosen.address);
      body.set('creator_address', job.from);
      body.set('job_id', job.jobId);
      body.set('model', chosen.modelName);
      const res = await fetch(`${GATEWAY}/generate`, { method: 'POST', body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'The gateway could not stamp this job');
      setMade((items) => [
        { stampId: json.stampId, image: json.image, prompt: prompt.trim(), model: chosen.modelName },
        ...items,
      ]);
      setNote(`Stamped #${json.stampId}. The agent was paid.`);
      setPrompt('');
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not fund this job');
    } finally {
      setBusy(false);
    }
  }

  const creatorAddr = '0x1f9090aaE28b8a3dCeaDf281B0F12828e676c326';

  return (
    <div className="px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#0f0f0f] flex items-center justify-center text-white text-xs font-bold">
                C
              </div>
              <span className="font-mono text-sm text-zinc-400">{shortAddr(creatorAddr)}</span>
              <span className="px-2 py-0.5 rounded-full bg-black/5 border border-black/10 text-[#3f3f3f] text-xs">
                Creator
              </span>
            </div>
            <h1 className="text-3xl font-black text-[#0f0f0f]">Dashboard</h1>
          </div>

          <button
            onClick={() => setNewJobOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-[#0f0f0f] hover:bg-[#272727] text-white font-semibold text-sm transition-all hover:shadow-md flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            New Job
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Stamps Created', value: DEMO_STAMPS.length.toString() },
            { label: 'Total Spent', value: '0.3 MON' },
            { label: 'Agents Used', value: '3' },
            { label: 'Avg Confidence', value: 'Tier A' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-black/10 bg-[#fafafa] p-4">
              <div className="text-2xl font-black text-[#0f0f0f] mb-1">{s.value}</div>
              <div className="text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>

        <Memberships />

        {/* Tabs */}
        <div className="flex gap-1 border-b border-black/10 mb-6">
          {(['stamps', 'jobs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-medium capitalize transition-all border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-zinc-400 text-[#3f3f3f]'
                  : 'border-transparent text-zinc-500 hover:text-[#3f3f3f]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Stamps grid */}
        {activeTab === 'stamps' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...made.map((stamp) => ({
              id: stamp.stampId,
              stampId: stamp.stampId,
              model: stamp.model,
              prompt: stamp.prompt,
              timestamp: Math.floor(Date.now() / 1000),
              image: stamp.image,
              txHash: '',
            })), ...DEMO_STAMPS.map((stamp) => ({ ...stamp, image: '' }))].map((stamp) => (
              <div
                key={stamp.id}
                className="rounded-2xl border border-black/10 bg-[#fafafa] hover:bg-[#f2f2f2] transition-all overflow-hidden group"
              >
                {/* Thumbnail placeholder */}
                <div className="h-40 bg-zinc-900/50 flex items-center justify-center relative overflow-hidden">
                  {stamp.image ? (
                    <img src={`data:image/png;base64,${stamp.image}`} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 grid-bg opacity-30" />
                  )}
                  <div className="relative z-10 text-center px-4">
                    <p className="text-xs text-zinc-300 font-mono">#{stamp.stampId}</p>
                    {!stamp.image && <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{stamp.prompt}</p>}
                  </div>
                  {/* Verified badge */}
                  <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5l2.5 2.5 4-4" stroke="#10b981" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <ModelBadge model={stamp.model} />
                    <span className="text-xs text-zinc-600">{fmtDate(stamp.timestamp)}</span>
                  </div>

                  <p className="text-xs text-zinc-500 line-clamp-2 mb-3 leading-relaxed">
                    {stamp.prompt}
                  </p>

                  <div className="flex items-center justify-between">
                    {stamp.txHash && process.env.NEXT_PUBLIC_EXPLORER_URL ? (
                      <a
                        href={`${process.env.NEXT_PUBLIC_EXPLORER_URL}/tx/${stamp.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-zinc-400 hover:text-[#3f3f3f] transition-colors"
                      >
                        View on Explorer ↗
                      </a>
                    ) : <span />}
                    <Link
                      href={`/verify`}
                      className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
                    >
                      Verify
                    </Link>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty slot */}
            <button
              onClick={() => setNewJobOpen(true)}
              className="rounded-2xl border-2 border-dashed border-black/10 hover:border-black/10 bg-transparent hover:bg-black/5 flex flex-col items-center justify-center gap-2 min-h-[200px] transition-all text-zinc-600 hover:text-zinc-400"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="text-sm font-medium">Commission new art</span>
            </button>
          </div>
        )}

        {/* Jobs tab */}
        {activeTab === 'jobs' && (
          <div className="rounded-2xl border border-black/10 bg-[#fafafa] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10">
                  <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-widest font-medium">Job ID</th>
                  <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-widest font-medium">Agent</th>
                  <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-widest font-medium">Paid</th>
                  <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-widest font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {DEMO_STAMPS.map((s, i) => (
                  <tr key={s.id} className="hover:bg-[#f2f2f2] transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-zinc-400">#{i + 1}</td>
                    <td className="px-5 py-4 font-mono text-xs text-zinc-400">{shortAddr(s.agent)}</td>
                    <td className="px-5 py-4 text-xs text-[#3f3f3f]">0.1 MON</td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded-full bg-black/5 border border-black/10 text-[#3f3f3f] text-xs">
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Job Modal */}
      {newJobOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setNewJobOpen(false)} />
          <div className="relative w-full max-w-md rounded-3xl border border-black/10 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-[#0f0f0f]">Commission AI Art</h2>
              <button onClick={() => setNewJobOpen(false)} className="text-zinc-500 hover:text-[#0f0f0f] transition-colors">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 4l12 12M4 16L16 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-2">Select Agent</label>
                <select
                  value={agent}
                  onChange={(e) => setAgent(e.target.value)}
                  className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-2.5 text-sm text-[#0f0f0f] focus:outline-none focus:border-zinc-400"
                >
                  <option value="">{agents.length ? 'Choose an AI agent...' : 'No agents registered yet'}</option>
                  {agents.map((item) => (
                    <option key={item.address} value={item.address}>
                      {item.modelName} — 0.05 MON/job
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-2">Prompt</label>
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe the image you want to generate..."
                  className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-2.5 text-sm text-[#0f0f0f] placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-400"
                />
              </div>

              <div className="rounded-xl border border-zinc-400/20 bg-black/5 p-3 text-xs text-zinc-400">
                <span className="text-[#3f3f3f] font-medium">Payment flow: </span>
                0.05 MON is locked in JobEscrow. The gateway stamps the image, writes provenance, then pays the agent.
              </div>

              <button
                type="button"
                disabled={busy || !agent || !prompt.trim()}
                onClick={fundJob}
                className="w-full py-3 rounded-xl bg-[#0f0f0f] hover:bg-[#272727] disabled:opacity-40 text-white font-bold text-sm transition-all"
              >
                {busy ? 'Working…' : 'Fund job · 0.05 MON'}
              </button>
              {note && <p className="text-sm text-[#3f3f3f]">{note}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
