import { NextRequest, NextResponse } from 'next/server';
import {
  authenticate,
  createSession,
  sameOrigin,
  SESSION_COOKIE,
  SESSION_SECONDS,
} from '@/lib/auth';
export const runtime = 'nodejs';
export async function POST(request: NextRequest) {
  const origin = sameOrigin(request);
  if (!origin) return NextResponse.json({ error: 'Origem inválida' }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 4096)
      return NextResponse.json({ error: 'Dados de acesso inválidos.' }, { status: 400 });
    let body;
    try {
      body = JSON.parse(raw);
      if (!body || typeof body !== 'object') throw new Error('Invalid input');
    } catch {
      return NextResponse.json({ error: 'Dados de acesso inválidos.' }, { status: 400 });
    }
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
  } catch (error) {
    // Configuration/storage failures are not bad credentials. Keep diagnostic
    // details in server logs and never log the submitted username/password.
    console.error('Sign-in session storage failure:', error);
    return NextResponse.json(
      { error: 'Falha no armazenamento de sessão do servidor. Verifique os logs da implantação.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
