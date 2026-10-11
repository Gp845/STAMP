import Link from 'next/link';
import { formatCount, getCreator, type Post } from '@/lib/feed';
import Avatar from './Avatar';
import OriginBadge from './OriginBadge';
import { LockIcon } from './icons';

export function Thumbnail({ post, className = '' }: { post: Post; className?: string }) {
  return (
    <div
      className={`relative aspect-video rounded-xl overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${post.colors[0]}, ${post.colors[1]})` }}
    >
      <div className="absolute top-2 left-2">
        <OriginBadge post={post} />
      </div>
      {post.membersOnly && (
        <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 text-[11px] text-white">
          <LockIcon className="w-3 h-3" /> Members
        </div>
      )}
      {post.videoSrc && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="w-11 h-11 rounded-full bg-black/70 flex items-center justify-center">
            <span className="ml-1 border-y-8 border-y-transparent border-l-[14px] border-l-white" />
          </span>
        </span>
      )}
      <span className={`absolute bottom-2 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[11px] text-white ${post.duration ? 'left-2' : 'right-2'}`}>
        #{post.stampId.slice(0, 8)}
      </span>
      {post.duration && (
        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-medium text-white">
          {post.duration}
        </span>
      )}
    </div>
  );
}

export function Player({ post, className = '' }: { post: Post; className?: string }) {
  if (!post.videoSrc) return <Thumbnail post={post} className={className} />;
  return (
    <video controls playsInline preload="metadata" src={post.videoSrc} className={`w-full aspect-video bg-black ${className}`} />
  );
}

export default function PostCard({ post, hideAvatar = false }: { post: Post; hideAvatar?: boolean }) {
  const creator = getCreator(post.creator)!;

  return (
    <div className="flex flex-col gap-3">
      <Link href={`/post/${post.id}`} className="block hover:opacity-90 transition-opacity">
        <Thumbnail post={post} />
      </Link>
      <div className="flex gap-3">
        {!hideAvatar && (
          <Link href={`/c/${creator.handle}`}>
            <Avatar creator={creator} />
          </Link>
        )}
        <div className="min-w-0">
          <Link href={`/post/${post.id}`}>
            <h3 className="text-[15px] font-medium leading-snug line-clamp-2">
              {post.title}
            </h3>
          </Link>
          {!hideAvatar && (
            <Link
              href={`/c/${creator.handle}`}
              className="block mt-1 text-sm text-[#606060] hover:text-black transition-colors"
            >
              {creator.name}
            </Link>
          )}
          <p className="text-sm text-[#606060]">
            {formatCount(post.views)} views · {post.postedAt}
          </p>
        </div>
      </div>
    </div>
  );
}
