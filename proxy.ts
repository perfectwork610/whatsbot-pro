import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/api/webhook' || pathname === '/api/worker') return NextResponse.next();
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV === 'production') return new NextResponse('Configure ADMIN_PASSWORD before starting production.', { status: 503 });
    return NextResponse.next();
  }
  const auth = request.headers.get('authorization') || '';
  let supplied = '';
  try { supplied = Buffer.from(auth.replace(/^Basic /, ''), 'base64').toString(); } catch { /* unauthorized */ }
  const expected = Buffer.from(`admin:${password}`); const actual = Buffer.from(supplied);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new NextResponse('Autenticação necessária', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="WhatsBot Pro", charset="UTF-8"' } });
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
