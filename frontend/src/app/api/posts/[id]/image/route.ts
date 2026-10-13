import { postImage } from '@/lib/posts-db';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = postImage(id);
  if (!row) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(row.image), {
    headers: { 'Content-Type': row.mime, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}
