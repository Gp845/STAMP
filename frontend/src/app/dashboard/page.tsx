'use client';

import { useEffect, useState } from 'react';
import Memberships from '@/components/Memberships';
import Earnings from '@/components/Earnings';
import Link from 'next/link';
import { createJob, loadChainAgents, loadChainJobs, type ChainAgent, type ChainJob } from '@/lib/wallet';

type SavedStamp = { stampId: string; prompt: string; model: string; media?: 'image' | 'video' };

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
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
  const [kind, setKind] = useState<'image' | 'video'>('image');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedStamp[]>([]);
  const [jobs, setJobs] = useState<ChainJob[]>([]);

  function refreshWork() {
    fetch(`${GATEWAY}/stamps`).then((res) => res.json()).then(setSaved).catch(() => setSaved([]));
    loadChainJobs().then(setJobs).catch(() => setJobs([]));
  }

  useEffect(() => {
    refreshWork();
  }, []);

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
      setNote(kind === 'video' ? 'Paid. Stamping every frame, this takes about a minute.' : 'Paid. Stamping the image.');
      const body = new FormData();
      body.set('prompt', prompt.trim());
      body.set('agent_address', chosen.address);
      body.set('creator_address', job.from);
      body.set('job_id', job.jobId);
      body.set('model', chosen.modelName);
      body.set('kind', kind);
      const res = await fetch(`${GATEWAY}/generate`, { method: 'POST', body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || 'The gateway could not stamp this job');
      setNote(`Stamped #${json.stampId}. The agent was paid.`);
      setPrompt('');
      setNewJobOpen(false);
      setActiveTab('stamps');
      refreshWork();
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not fund this job');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Studio</h1>
            <p className="mt-1 text-sm text-[#606060]">Fund a job, then the gateway stamps it and pays the agent.</p>
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
            { label: 'Jobs', value: String(jobs.length) },
            { label: 'Images kept', value: String(saved.length) },
            { label: 'Spent', value: `${jobs.reduce((sum, job) => sum + Number(job.payment), 0)} MON` },
            { label: 'Completed', value: String(jobs.filter((job) => job.status === 'Completed').length) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-black/10 bg-white p-4">
              <div className="text-2xl font-semibold tracking-tight mb-1">{s.value}</div>
              <div className="text-xs text-[#606060]">{s.label}</div>
            </div>
          ))}
        </div>

        <Memberships />
        <Earnings />

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
            {saved.map((stamp) => (
              <div key={stamp.stampId} className="rounded-xl border border-black/10 bg-white overflow-hidden">
                {stamp.media === 'video' ? (
                  <video
                    src={`${GATEWAY}/stamps/${stamp.stampId}.mp4`}
                    controls
                    loop
                    muted
                    className="h-40 w-full object-cover bg-[#f6f7f8]"
                  />
                ) : (
                  <a href={`${GATEWAY}/stamps/${stamp.stampId}.png`} download={`${stamp.stampId}.png`}>
                    <img src={`${GATEWAY}/stamps/${stamp.stampId}.png`} alt="" className="h-40 w-full object-cover bg-[#f6f7f8]" />
                  </a>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <ModelBadge model={stamp.model} />
                    <span className="text-xs font-mono text-[#606060]">#{stamp.stampId}</span>
                  </div>
                  <p className="text-xs text-[#606060] line-clamp-2 mb-3 leading-relaxed">{stamp.prompt}</p>
                  <Link href="/verify" className="text-xs text-[#065fd4] hover:underline">
                    Verify this {stamp.media === 'video' ? 'video' : 'image'}
                  </Link>
                </div>
              </div>
            ))}
            {jobs.filter((job) => job.stampId && !saved.some((stamp) => stamp.stampId === job.stampId)).map((job) => (
              <div key={job.id} className="rounded-xl border border-black/10 bg-white p-4">
                <p className="text-sm font-medium">{job.prompt}</p>
                <p className="mt-2 text-xs font-mono text-[#606060]">#{job.stampId}</p>
                <p className="mt-2 text-xs text-[#606060]">This stamp is on chain. The image file was not kept, so it cannot be downloaded.</p>
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
                  <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-widest font-medium">Prompt</th>
                  <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-widest font-medium">Agent</th>
                  <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-widest font-medium">Paid</th>
                  <th className="text-left px-5 py-3 text-xs text-zinc-500 uppercase tracking-widest font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/10">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-[#f2f2f2] transition-colors">
                    <td className="px-5 py-4 font-mono text-xs text-[#606060]">#{job.id}</td>
                    <td className="px-5 py-4 text-xs text-[#3f3f3f]">{job.prompt}</td>
                    <td className="px-5 py-4 font-mono text-xs text-[#606060]">{shortAddr(job.agent)}</td>
                    <td className="px-5 py-4 text-xs text-[#3f3f3f]">{job.payment} MON</td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded-full bg-black/5 border border-black/10 text-[#3f3f3f] text-xs">
                        {job.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-sm text-[#606060]">No jobs yet.</td>
                  </tr>
                )}
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
                <label className="block text-xs text-zinc-500 mb-2">Output</label>
                <div className="flex gap-2">
                  {(['image', 'video'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={kind === option}
                      onClick={() => setKind(option)}
                      className={`h-8 px-4 rounded-full text-sm font-medium capitalize ${
                        kind === option ? 'bg-[#0f0f0f] text-white' : 'bg-black/5 text-[#3f3f3f]'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-2">Prompt</label>
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={`Describe the ${kind} you want to generate...`}
                  className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-2.5 text-sm text-[#0f0f0f] placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-400"
                />
              </div>

              <div className="rounded-xl border border-zinc-400/20 bg-black/5 p-3 text-xs text-zinc-400">
                <span className="text-[#3f3f3f] font-medium">Payment flow: </span>
                0.05 MON is locked in JobEscrow. The gateway stamps the {kind}, writes provenance, then pays the agent.
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
