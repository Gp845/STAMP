import { notFound } from 'next/navigation';
import Avatar from '@/components/Avatar';
import JoinButton from '@/components/JoinButton';
import PostCard from '@/components/PostCard';
import { CREATORS, formatCount, getCreator, POSTS } from '@/lib/feed';

export function generateStaticParams() {
  return CREATORS.map((c) => ({ handle: c.handle }));
}

export default async function ChannelPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const creator = getCreator(handle);
  if (!creator) notFound();
  const posts = POSTS.filter((p) => p.creator === creator.handle);
  const aiCount = posts.filter((p) => p.origin === 'agent').length;

  const tiers = [
    { name: 'Follower', price: 'Free', perks: ['Public posts', 'Provenance on every post'] },
    {
      name: 'Member',
      price: `${creator.memberPrice} MON/mo`,
      perks: [
        'Billed every second, not once a month',
        'Stop anytime and the unused amount comes back',
        'Members-only posts',
      ],
    },
  ];

  return (
    <div className="max-w-[1280px] mx-auto px-6 py-4">
      <div
        className="h-40 sm:h-52 rounded-2xl"
        style={{ background: `linear-gradient(120deg, ${creator.colors[0]}, ${creator.colors[1]})` }}
      />

      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <Avatar creator={creator} size={120} />
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{creator.name}</h1>
          <p className="mt-1 text-sm text-[#606060]">
            @{creator.handle} · {formatCount(creator.subscribers)} members · {posts.length} posts · {aiCount} AI-made
          </p>
          <p className="mt-2 text-sm text-[#3f3f3f] max-w-2xl">{creator.bio}</p>
          <div className="mt-4">
            <JoinButton handle={creator.handle} monthly={Number(creator.memberPrice)} large />
          </div>
        </div>
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold">Membership</h2>
      <div className="grid sm:grid-cols-2 gap-4 max-w-3xl">
        {tiers.map((t) => (
          <div key={t.name} className="rounded-xl bg-[#f7f7f7] border border-black/10 p-5">
            <p className="text-sm text-[#606060]">{t.name}</p>
            <p className="text-2xl font-bold mt-1">{t.price}</p>
            <ul className="mt-3 space-y-1.5 text-sm text-[#3f3f3f]">
              {t.perks.map((perk) => (
                <li key={perk}>· {perk}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold">Posts</h2>
      <div className="grid gap-x-4 gap-y-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-12">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} hideAvatar />
        ))}
      </div>
    </div>
  );
}
