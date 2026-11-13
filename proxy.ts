import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, validSession } from '@/lib/auth';
export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (['/api/webhook','/api/worker','/api/auth/login','/api/auth/logout','/images/login-hero.webp'].includes(pathname)) return NextResponse.next();
  const authenticated = validSession(request.cookies.get(SESSION_COOKIE)?.value);
  let response: NextResponse;
  if (pathname === '/login') response = authenticated ? NextResponse.redirect(new URL('/',request.url)) : NextResponse.next();
  else if (!authenticated) response = pathname.startsWith('/api/') ? NextResponse.json({error:'Sessão expirada. Entre novamente.'},{status:401}) : NextResponse.redirect(new URL('/login',request.url));
  else response = NextResponse.next();
  response.headers.set('Cache-Control','private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
