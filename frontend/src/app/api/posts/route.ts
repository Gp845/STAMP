import { insertPost, listPosts } from '@/lib/posts-db';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:8000';

export async function GET() {
  return Response.json(listPosts());
}

async function c2paGenerator(file: File) {
  try {
    const body = new FormData();
    body.append('image', file, file.name);
    const res = await fetch(`${GATEWAY}/verify`, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.tier === 'C' && data.generator ? String(data.generator).slice(0, 80) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const form = await request.formData();
  const title = String(form.get('title') ?? '');
  const creator = String(form.get('creator') ?? '');
  const file = form.get('file') ?? form.get('image');
  if (!(file instanceof File)) return Response.json({ error: 'Choose an image or a video.' }, { status: 400 });
  try {
    const generator = await c2paGenerator(file);
    const id = insertPost(title, creator, new Uint8Array(await file.arrayBuffer()), generator);
    return Response.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save this post';
    return Response.json({ error: message }, { status: 400 });
  }
}
