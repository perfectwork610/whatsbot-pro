import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE = 'whatsbot_session';
export const SESSION_SECONDS = 12 * 60 * 60;

/** Public browser origin used for CSRF checks. Prefer APP_URL; otherwise derive from proxy headers. */
export function appOrigin(request: NextRequest): string {
  const configured = process.env.APP_URL?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  const proto =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    request.nextUrl.protocol.replace(/:$/, '') ||
    'https';
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host') ||
    request.nextUrl.host;
  return `${proto}://${host}`;
}

/** Returns the allowed origin when the request Origin matches; otherwise null. */
export function sameOrigin(request: NextRequest): string | null {
  const allowed = appOrigin(request);
  const origin = request.headers.get('origin')?.trim().replace(/\/+$/, '');
  if (!origin || origin !== allowed) return null;
  return allowed;
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function signingSecret(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) throw new Error('Authentication not configured');
  return hash(`whatsbot-session:${password}`);
}

function sign(body: string): string {
  return createHmac('sha256', signingSecret()).update(body).digest('hex');
}

function safeEqualHex(left: string, right: string): boolean {
  try {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Process-local revoke list. Enough for single-instance; Vercel instances do not share it. */
const revoked = new Set<string>();
/** Process-local login throttle for the single admin account. */
let loginAttempts: { failures: number; resetAt: number } | undefined;

export function validSession(token?: string): boolean {
  if (!token || !process.env.ADMIN_PASSWORD) return false;
  const parts = token.split('.');
  if (parts.length !== 4) return false;
  const [expiresAt, credentialHash, nonce, signature] = parts;
  if (
    !/^\d+$/.test(expiresAt) ||
    !/^[a-f0-9]{64}$/.test(credentialHash) ||
    !/^[a-f0-9]{32}$/.test(nonce) ||
    !/^[a-f0-9]{64}$/.test(signature)
  )
    return false;
  const payload = `${expiresAt}.${credentialHash}.${nonce}`;
  if (!safeEqualHex(signature, sign(payload))) return false;
  if (Number(expiresAt) <= Date.now()) return false;
  if (!safeEqualHex(credentialHash, hash(process.env.ADMIN_PASSWORD))) return false;
  if (revoked.has(hash(token))) return false;
  return true;
}

export function authenticate(
  username: unknown,
  password: unknown,
): 'ok' | 'invalid' | 'limited' | 'unconfigured' {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return 'unconfigured';
  const now = Date.now();
  if (loginAttempts && loginAttempts.resetAt > now && loginAttempts.failures >= 10) {
    return 'limited';
  }
  const userMatches = timingSafeEqual(
    Buffer.from(hash(typeof username === 'string' ? username : '')),
    Buffer.from(hash('admin')),
  );
  const passwordMatches = timingSafeEqual(
    Buffer.from(hash(typeof password === 'string' ? password : '')),
    Buffer.from(hash(expected)),
  );
  if (userMatches && passwordMatches) {
    loginAttempts = undefined;
    return 'ok';
  }
  const failures =
    loginAttempts && loginAttempts.resetAt > now ? loginAttempts.failures + 1 : 1;
  const resetAt =
    loginAttempts && loginAttempts.resetAt > now ? loginAttempts.resetAt : now + 5 * 60 * 1000;
  loginAttempts = { failures, resetAt };
  return 'invalid';
}

export function createSession(): string {
  if (!process.env.ADMIN_PASSWORD) throw new Error('Authentication not configured');
  const expiresAt = String(Date.now() + SESSION_SECONDS * 1000);
  const credentialHash = hash(process.env.ADMIN_PASSWORD);
  const body = `${expiresAt}.${credentialHash}`;
  // Random nonce keeps tokens unique so logout can revoke one cookie without killing others.
  const nonce = randomBytes(16).toString('hex');
  const payload = `${body}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}

export function revokeSession(token?: string) {
  if (token && /^[0-9]+\.[a-f0-9]{64}\.[a-f0-9]{32}\.[a-f0-9]{64}$/.test(token)) {
    revoked.add(hash(token));
  }
}

/** Build an expired signed token for tests. */
export function expiredSessionForTests(): string {
  if (!process.env.ADMIN_PASSWORD) throw new Error('Authentication not configured');
  const expiresAt = String(Date.now() - 1000);
  const credentialHash = hash(process.env.ADMIN_PASSWORD);
  const nonce = randomBytes(16).toString('hex');
  const payload = `${expiresAt}.${credentialHash}.${nonce}`;
  return `${payload}.${sign(payload)}`;
}
