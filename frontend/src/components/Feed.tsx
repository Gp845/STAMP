'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getCreator, POSTS, uploadedPost, type Post } from '@/lib/feed';
import PostCard from './PostCard';

const CHIPS: { label: string; match: (p: Post) => boolean }[] = [
  { label: 'All', match: () => true },
  { label: 'Videos', match: (p) => !!p.videoSrc },
  { label: 'AI-made', match: (p) => p.origin === 'agent' },
  { label: 'Human-made', match: (p) => p.origin === 'human' },
  { label: 'Detected elsewhere', match: (p) => p.origin === 'external' },
  { label: 'Members only', match: (p) => p.membersOnly },
  { label: 'Gemini', match: (p) => !!p.model?.includes('Gemini') },
  { label: 'Stable Diffusion', match: (p) => !!p.model?.includes('Stable') },
  { label: 'DALL-E', match: (p) => !!p.model?.includes('DALL') },
];

export default function Feed() {
  const q = (useSearchParams().get('q') ?? '').toLowerCase();
  const [chip, setChip] = useState('All');
  const [uploaded, setUploaded] = useState<Post[]>([]);

  useEffect(() => {
    fetch('/api/posts')
      .then((res) => res.json())
      .then((rows: { id: string; title: string; creator: string; createdAt: number; mime: string }[]) => {
        setUploaded(rows.map(uploadedPost));
      })
      .catch(() => setUploaded([]));
  }, []);

  const active = CHIPS.find((c) => c.label === chip)!;
  const posts = [...uploaded, ...POSTS].filter(active.match).filter((p) => {
    if (!q) return true;
    const creator = getCreator(p.creator);
    return [p.title, p.model, creator?.name, creator?.handle].some((s) => s?.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="sticky top-14 z-30 bg-[#f6f7f8]/95 backdrop-blur px-6 py-3 flex gap-2 overflow-x-auto no-scrollbar">
        {CHIPS.map((c) => (
          <button
            key={c.label}
            onClick={() => setChip(c.label)}
            className={`shrink-0 h-8 px-3 rounded-lg text-sm font-medium transition-colors ${
              chip === c.label ? 'bg-[#0f0f0f] text-white' : 'bg-[#f2f2f2] hover:bg-[#e5e5e5]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {q && (
        <p className="px-6 pt-2 text-sm text-[#606060]">
          Results for <span className="text-[#0f0f0f]">&ldquo;{q}&rdquo;</span>
        </p>
      )}

      {posts.length === 0 ? (
        <p className="px-6 py-24 text-center text-[#606060]">No posts match.</p>
      ) : (
        <div className="px-6 pt-4 pb-12 grid gap-x-4 gap-y-10 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
