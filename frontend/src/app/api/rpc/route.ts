import { CHAIN } from '@/lib/contracts';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const res = await fetch(CHAIN.rpcUrls.default.http[0], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await req.text(),
  });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
