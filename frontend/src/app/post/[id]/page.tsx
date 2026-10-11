import Link from 'next/link';
import { notFound } from 'next/navigation';
import Avatar from '@/components/Avatar';
import JoinButton from '@/components/JoinButton';
import MemberGate from '@/components/MemberGate';
import { originLabel } from '@/components/OriginBadge';
import { Player, Thumbnail } from '@/components/PostCard';
import { ShieldIcon } from '@/components/icons';
import { formatCount, getCreator, getPost, POSTS, shortAddr } from '@/lib/feed';

const EXPLORER = 'https://testnet.monadexplorer.com';

export function generateStaticParams() {
  return POSTS.map((p) => ({ id: p.id }));
}

function Row({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-sm">
      <span className="text-[#606060]">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" className="font-mono text-[#3ea6ff] hover:underline">
          {value}
        </a>
      ) : (
        <span className="font-mono text-right">{value}</span>
      )}
    </div>
  );
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = getPost(id);
  if (!post) notFound();
  const creator = getCreator(post.creator)!;
  const more = POSTS.filter((p) => p.id !== post.id);

  return (
    <div className="max-w-[1700px] mx-auto px-6 py-6 flex flex-col xl:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <MemberGate handle={creator.handle} monthly={Number(creator.memberPrice)} locked={post.membersOnly}>
          <Player post={post} className="rounded-xl" />
        </MemberGate>

        <h1 className="mt-3 text-xl font-semibold leading-snug">{post.title}</h1>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href={`/c/${creator.handle}`}>
              <Avatar creator={creator} size={40} />
            </Link>
            <div>
              <Link href={`/c/${creator.handle}`} className="font-medium hover:underline">
                {creator.name}
              </Link>
              <p className="text-xs text-[#606060]">{formatCount(creator.subscribers)} members</p>
            </div>
            <div className="ml-3">
              <JoinButton handle={creator.handle} monthly={Number(creator.memberPrice)} />
            </div>
          </div>
          <Link
            href="/verify"
            className="flex items-center gap-2 h-9 px-4 rounded-full bg-[#f2f2f2] hover:bg-[#e5e5e5] text-sm font-medium"
          >
            <ShieldIcon className="w-5 h-5" /> Verify a copy
          </Link>
        </div>

        <div className="mt-4 rounded-xl bg-[#f2f2f2] p-3 text-sm">
          <p className="font-medium">
            {formatCount(post.views)} views · {post.postedAt}
          </p>
          <p className="mt-1 text-[#3f3f3f]">{post.description}</p>
        </div>

        <section className="mt-6 rounded-xl border border-black/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldIcon className="w-5 h-5 text-[#836EF9]" />
            <h2 className="font-semibold">Provenance</h2>
          </div>
          <div className="divide-y divide-white/10">
            <Row label="Origin" value={originLabel(post)} />
            <Row label="Stamp ID" value={`#${post.stampId}`} />
            {post.agent && <Row label="Agent" value={shortAddr(post.agent)} href={`${EXPLORER}/address/${post.agent}`} />}
            <Row label="Creator" value={shortAddr(creator.address)} href={`${EXPLORER}/address/${creator.address}`} />
            {post.txHash ? (
              <Row label="Anchored on Monad" value={post.txHash} href={`${EXPLORER}/tx/${post.txHash}`} />
            ) : (
              <Row label="Anchored on Monad" value="Not stamped by STAMP" />
            )}
          </div>
        </section>
      </div>

      <aside className="xl:w-[400px] shrink-0 flex flex-col gap-3">
        {more.map((p) => {
          const c = getCreator(p.creator)!;
          return (
            <Link key={p.id} href={`/post/${p.id}`} className="flex gap-2 group">
              <Thumbnail post={p} className="w-44 shrink-0 rounded-lg" />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug line-clamp-2">{p.title}</p>
                <p className="mt-1 text-xs text-[#606060]">{c.name}</p>
                <p className="text-xs text-[#606060]">
                  {formatCount(p.views)} views · {p.postedAt}
                </p>
              </div>
            </Link>
          );
        })}
      </aside>
    </div>
  );
}
