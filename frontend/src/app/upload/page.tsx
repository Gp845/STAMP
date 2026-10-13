'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { connectWallet } from '@/lib/wallet';

export default function UploadPage() {
  const router = useRouter();
  const [account, setAccount] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!account || !file || !title.trim()) return;
    setBusy(true);
    setStatus(null);
    try {
      const body = new FormData();
      body.set('title', title.trim());
      body.set('creator', account);
      body.set('file', file);
      const res = await fetch('/api/posts', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not save this post');
      router.push(`/post/${json.id}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save this post');
      setBusy(false);
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="max-w-md mx-auto rounded-xl border border-black/10 bg-white p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Upload</h1>
        <p className="mt-1 mb-6 text-sm text-[#606060]">
          The wallet you connect is the creator. The image or video is saved and shown on the home feed.
        </p>
        <div className="space-y-3">
          <button
            type="button"
            onClick={async () => {
              try {
                setStatus(null);
                setAccount(await connectWallet());
              } catch (err) {
                setStatus(err instanceof Error ? err.message : 'Could not connect');
              }
            }}
            className="w-full py-2.5 rounded-xl border border-black/10 bg-white text-sm font-medium"
          >
            {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect wallet'}
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full h-10 px-3 rounded-xl border border-black/10 bg-white text-sm"
          />
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm text-[#606060]"
          />
          <button
            type="button"
            disabled={busy || !account || !file || !title.trim()}
            onClick={submit}
            className="w-full py-3 rounded-xl bg-[#0f0f0f] hover:bg-[#272727] disabled:opacity-40 text-white font-bold text-sm"
          >
            {busy ? 'Saving…' : 'Publish'}
          </button>
          {status && <p className="text-sm text-[#3f3f3f]">{status}</p>}
        </div>
      </div>
    </div>
  );
}
