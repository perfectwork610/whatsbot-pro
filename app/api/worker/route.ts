import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { tick } from '@/lib/queue';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  const expected = Buffer.from(`Bearer ${process.env.WORKER_SECRET || ''}`);
  const actual = Buffer.from(req.headers.get('authorization') || '');
  if (
    !process.env.WORKER_SECRET ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await tick());
}
