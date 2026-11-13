import { NextRequest, NextResponse } from 'next/server';
import { revokeSession, SESSION_COOKIE } from '@/lib/auth';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const origin =
    process.env.APP_URL || `${request.nextUrl.protocol}//${request.headers.get('host')}`;
  if (request.headers.get('origin') !== origin)
    return NextResponse.json({ error: 'Origem inválida' }, { status: 403 });
  revokeSession(request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: new URL(origin).protocol === 'https:',
    path: '/',
    maxAge: 0,
  });
  return response;
}
