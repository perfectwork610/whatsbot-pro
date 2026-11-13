import { NextRequest, NextResponse } from 'next/server';
import { authenticate, createSession, SESSION_COOKIE, SESSION_SECONDS } from '@/lib/auth';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const origin =
    process.env.APP_URL || `${request.nextUrl.protocol}//${request.headers.get('host')}`;
  if (request.headers.get('origin') !== origin)
    return NextResponse.json({ error: 'Origem inválida' }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 4096)
      return NextResponse.json({ error: 'Dados de acesso inválidos.' }, { status: 400 });
    const body = JSON.parse(raw);
    const result = authenticate(body.username, body.password);
    if (result !== 'ok') {
      const status = result === 'limited' ? 429 : result === 'unconfigured' ? 503 : 401;
      const error =
        result === 'limited'
          ? 'Muitas tentativas. Aguarde 5 minutos e tente novamente.'
          : result === 'unconfigured'
            ? 'Configure ADMIN_PASSWORD no servidor antes de entrar.'
            : 'Usuário ou senha incorretos.';
      return NextResponse.json(
        { error },
        {
          status,
          headers: {
            'Cache-Control': 'no-store',
            ...(result === 'limited' ? { 'Retry-After': '300' } : {}),
          },
        },
      );
    }
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(SESSION_COOKIE, createSession(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: new URL(origin).protocol === 'https:',
      path: '/',
      ...(body.remember === false ? {} : { maxAge: SESSION_SECONDS }),
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Dados de acesso inválidos.' }, { status: 400 });
  }
}
