import type { Creator } from '@/lib/feed';

export default function Avatar({ creator, size = 36 }: { creator: Creator; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${creator.colors[0]}, ${creator.colors[1]})`,
      }}
    >
      {creator.name[0]}
    </div>
  );
}
