import type { Post } from '@/lib/feed';

const STYLES = {
  agent: 'bg-[#836EF9]/90 text-white',
  human: 'bg-emerald-500/90 text-black',
  external: 'bg-amber-400/90 text-black',
};

export function originLabel(post: Post) {
  if (post.origin === 'human') return 'Human-made';
  if (post.origin === 'external') return `Detected · ${post.model}`;
  return `AI · ${post.model}`;
}

export default function OriginBadge({ post }: { post: Post }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[11px] font-medium ${STYLES[post.origin]}`}>
      {originLabel(post)}
    </span>
  );
}
