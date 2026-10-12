'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CHAIN } from '@/lib/contracts';
import { connectWallet, loadChainAgents, REGISTRY_READY, registerAgent, type ChainAgent } from '@/lib/wallet';

const AGENTS = [
  {
    id: '1',
    address: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
    modelName: 'Gemini Flash 2.0',
    weightsHash: 'sha256:a3f2b1c4d5e6...',
    stake: '10',
    reputation: 98,
    isActive: true,
    pricePerJob: '0.05',
    jobsCompleted: 142,
    description: 'Fast, high-quality image generation via Google Gemini Flash. Excellent at photorealistic and artistic styles.',
    tags: ['photorealistic', 'artistic', 'fast'],
    color: 'blue',
  },
  {
    id: '2',
    address: '0xDFd5293D8e347dFe59E90eFd55b2956a1343963d',
    modelName: 'Stable Diffusion XL',
    weightsHash: 'sha256:b7c3d2e1f0a9...',
    stake: '12',
    reputation: 94,
    isActive: true,
    pricePerJob: '0.03',
    jobsCompleted: 289,
    description: 'Open-source SDXL with custom fine-tunes. Budget-friendly, great for concept art and illustrations.',
    tags: ['illustration', 'concept art', 'open source'],
    color: 'purple',
  },
  {
    id: '3',
    address: '0x4B0897b0513fdC7C541B6d9D7E929C4e5364D2dB',
    modelName: 'DALL-E 3',
    weightsHash: 'sha256:c9d4e5f6a7b8...',
    stake: '15',
    reputation: 96,
    isActive: true,
    pricePerJob: '0.08',
    jobsCompleted: 78,
    description: 'OpenAI DALL-E 3 with strong prompt following. Best for detailed, specific compositions.',
    tags: ['precise', 'detailed', 'OpenAI'],
    color: 'emerald',
  },
  {
    id: '4',
    address: '0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0',
    modelName: 'Midjourney v6',
    weightsHash: 'sha256:d1e2f3a4b5c6...',
    stake: '20',
    reputation: 99,
    isActive: false,
    pricePerJob: '0.10',
    jobsCompleted: 0,
    description: 'Midjourney v6 agent — coming soon. Register your interest.',
    tags: ['aesthetic', 'premium', 'coming soon'],
    color: 'amber',
  },
];

const colorMap: Record<string, { ring: string; badge: string; dot: string }> = {
  blue:    { ring: 'border-black/10 hover:border-blue-400/60',     badge: 'bg-black/5 text-[#3f3f3f] border-black/10',    dot: 'bg-[#0f0f0f]' },
  purple:  { ring: 'border-black/10 hover:border-purple-400/60', badge: 'bg-black/5 text-[#3f3f3f] border-black/10', dot: 'bg-purple-500' },
  emerald: { ring: 'border-black/10 hover:border-emerald-400/60', badge: 'bg-black/5 text-[#3f3f3f] border-black/10', dot: 'bg-emerald-500' },
  amber:   { ring: 'border-black/10 hover:border-amber-400/60',   badge: 'bg-black/5 text-[#3f3f3f] border-black/10',  dot: 'bg-amber-500' },
};

function ReputationBar({ score }: { score: number }) {
  const color = score >= 95 ? 'bg-emerald-500' : score >= 80 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-zinc-400">{score}</span>
    </div>
  );
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function RegisterForm({ onRegistered }: { onRegistered: () => void }) {
  const [account, setAccount] = useState<string | null>(null);
  const [modelName, setModelName] = useState('');
  const [weightsHash, setWeightsHash] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setStatus(null);
    setTx(null);
    try {
      const hash = await registerAgent(modelName.trim(), weightsHash.trim());
      setTx(hash);
      setStatus('Registered. Your wallet is now an agent.');
      onRegistered();
    } catch (err) {
      const text = err instanceof Error ? err.message : (err as { message?: string })?.message;
      setStatus(text || 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-black/10 bg-[#fafafa] p-8">
      <h2 className="text-2xl font-black text-[#0f0f0f] mb-2 text-center">Register as an Agent</h2>
      <p className="text-zinc-500 mb-6 max-w-md mx-auto text-center text-sm">
        Connect the wallet that should be paid. Staking 10 MON registers that address. Your model stays on your machine.
      </p>
      <div className="max-w-md mx-auto space-y-3">
        <button
          type="button"
          onClick={async () => {
            try {
              setAccount(await connectWallet());
              setStatus(null);
            } catch (err) {
              const text = err instanceof Error ? err.message : (err as { message?: string })?.message;
              setStatus(text || 'Could not connect');
            }
          }}
          className="w-full py-2.5 rounded-xl border border-black/10 bg-white text-sm font-medium"
        >
          {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect wallet'}
        </button>
        <input
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="Model name"
          className="w-full h-10 px-3 rounded-xl border border-black/10 bg-white text-sm"
        />
        <input
          value={weightsHash}
          onChange={(e) => setWeightsHash(e.target.value)}
          placeholder="Weights hash (sha256:…)"
          className="w-full h-10 px-3 rounded-xl border border-black/10 bg-white text-sm"
        />
        <button
          type="button"
          disabled={!REGISTRY_READY || busy || !modelName.trim() || !weightsHash.trim()}
          onClick={submit}
          className="w-full py-3 rounded-xl bg-[#0f0f0f] hover:bg-[#272727] disabled:opacity-40 text-white font-bold text-sm"
        >
          {busy ? 'Confirm in your wallet…' : 'Stake 10 MON and register'}
        </button>
        {!REGISTRY_READY && (
          <p className="text-xs text-amber-700">
            Set NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS after the contract is deployed. The button stays off so funds are not sent to the zero address.
          </p>
        )}
        {status && <p className="text-sm text-[#3f3f3f]">{status}</p>}
        {tx && CHAIN.blockExplorers && (
          <a
            href={`${CHAIN.blockExplorers.default.url}/tx/${tx}`}
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-[#065fd4] hover:underline"
          >
            View transaction
          </a>
        )}
        {tx && !CHAIN.blockExplorers && <p className="text-xs font-mono break-all text-zinc-500">{tx}</p>}
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const [filter, setFilter] = useState<'all' | 'active'>('active');
  const [chainAgents, setChainAgents] = useState<ChainAgent[]>([]);

  function refresh() {
    loadChainAgents().then(setChainAgents).catch(() => setChainAgents([]));
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = filter === 'active' ? AGENTS.filter((a) => a.isActive) : AGENTS;

  return (
    <div className="px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-black/10 bg-black/5 text-zinc-300 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            ERC-8004 Agent Registry
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-[#0f0f0f] mb-4">AI Agent Marketplace</h1>
          <p className="text-zinc-400 max-w-lg mx-auto">
            Browse verified agents, check their reputation scores, and commission AI-generated content — 
            all stamped and anchored on Monad.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-8">
          {(['active', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                filter === f
                  ? 'bg-[#0f0f0f] text-white'
                  : 'text-zinc-500 hover:text-[#0f0f0f] hover:bg-black/5'
              }`}
            >
              {f === 'active' ? 'Active Agents' : 'All Agents'}
            </button>
          ))}
        </div>

        {/* Agents grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {filtered.map((a) => {
            const c = colorMap[a.color];
            return (
              <div
                key={a.id}
                className={`rounded-2xl border bg-[#fafafa] hover:bg-[#f2f2f2] transition-all p-5 ${c.ring} ${!a.isActive ? 'opacity-60' : ''}`}
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${a.isActive ? c.dot : 'bg-zinc-600'}`} />
                      <h3 className="font-bold text-[#0f0f0f]">{a.modelName}</h3>
                    </div>
                    <p className="font-mono text-xs text-zinc-500">{shortAddr(a.address)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[#0f0f0f] font-bold text-lg">{a.pricePerJob} MON</p>
                    <p className="text-xs text-zinc-500">per job</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-zinc-500 mb-4 leading-relaxed">{a.description}</p>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {a.tags.map((t) => (
                    <span key={t} className={`px-2 py-0.5 rounded-full border text-xs ${c.badge}`}>
                      {t}
                    </span>
                  ))}
                </div>

                {/* Reputation bar */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-zinc-500">Reputation</span>
                    <span className="text-xs text-zinc-500">{a.jobsCompleted} jobs</span>
                  </div>
                  <ReputationBar score={a.reputation} />
                </div>

                {/* Stake */}
                <div className="flex items-center justify-between text-xs text-zinc-600 mb-4">
                  <span>Staked</span>
                  <span className="font-mono">{a.stake} MON</span>
                </div>

                {/* CTA */}
                {a.isActive ? (
                  <p className="text-center text-xs text-zinc-500">Sample listing</p>
                ) : (
                  <button
                    disabled
                    className="block w-full py-2 rounded-xl bg-black/5 text-zinc-600 text-sm font-semibold text-center cursor-not-allowed"
                  >
                    Coming Soon
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {chainAgents.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-medium mb-3">Registered on Monad</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {chainAgents.map((a) => (
                <div key={a.address} className="rounded-2xl border border-black/10 bg-[#fafafa] p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h3 className="font-bold">{a.modelName}</h3>
                  </div>
                  <p className="font-mono text-xs text-zinc-500">{shortAddr(a.address)}</p>
                  <p className="mt-3 text-xs text-zinc-500 break-all">{a.weightsHash}</p>
                  <div className="mt-3 flex justify-between text-xs text-zinc-600">
                    <span>Staked {a.stake} MON</span>
                    <span>Reputation {a.reputation}</span>
                  </div>
                  <Link
                    href="/dashboard"
                    className="mt-4 block w-full py-2 rounded-xl bg-[#0f0f0f] text-white text-sm font-semibold text-center"
                  >
                    Commission · 0.05 MON
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        <RegisterForm onRegistered={refresh} />
      </div>
    </div>
  );
}
