import { memberPrice, setMemberPrice } from '@/lib/member-price';

export async function GET(request: Request) {
  const creator = new URL(request.url).searchParams.get('creator') || '';
  return Response.json({ monthly: memberPrice(creator) });
}

export async function POST(request: Request) {
  const body = await request.json();
  try {
    setMemberPrice(String(body.creator ?? ''), String(body.monthly ?? ''));
    return Response.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not save this price';
    return Response.json({ error: message }, { status: 400 });
  }
}
