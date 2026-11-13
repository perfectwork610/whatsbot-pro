import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const SESSION_COOKIE = 'whatsbot_session';
export const SESSION_SECONDS = 12 * 60 * 60;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
let database: DatabaseSync | undefined;
function db() {
  if (database) return database;
  const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  mkdirSync(dir, { recursive: true });
  database = new DatabaseSync(path.join(dir, 'auth.sqlite'));
  database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, credential_hash TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS login_attempts (id INTEGER PRIMARY KEY, failures INTEGER NOT NULL, reset_at INTEGER NOT NULL);`);
  return database;
}
export function validSession(token?: string): boolean {
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !process.env.ADMIN_PASSWORD) return false;
  return !!db()
    .prepare('SELECT 1 FROM sessions WHERE token_hash=? AND credential_hash=? AND expires_at>?')
    .get(hash(token), hash(process.env.ADMIN_PASSWORD), Date.now());
}
export function authenticate(
  username: unknown,
  password: unknown,
): 'ok' | 'invalid' | 'limited' | 'unconfigured' {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return 'unconfigured';
  const database = db();
  database.exec('BEGIN IMMEDIATE');
  try {
    const now = Date.now();
    const attempts = database
      .prepare('SELECT failures, reset_at FROM login_attempts WHERE id=1')
      .get() as { failures: number; reset_at: number } | undefined;
    if (attempts && attempts.reset_at > now && attempts.failures >= 10) {
      database.exec('COMMIT');
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
      database.prepare('DELETE FROM login_attempts WHERE id=1').run();
      database.exec('COMMIT');
      return 'ok';
    }
    const failures = attempts && attempts.reset_at > now ? attempts.failures + 1 : 1;
    const reset = attempts && attempts.reset_at > now ? attempts.reset_at : now + 5 * 60 * 1000;
    database
      .prepare('INSERT OR REPLACE INTO login_attempts(id,failures,reset_at) VALUES(1,?,?)')
      .run(failures, reset);
    database.exec('COMMIT');
    return 'invalid';
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}
export function createSession(): string {
  if (!process.env.ADMIN_PASSWORD) throw new Error('Authentication not configured');
  const token = randomBytes(32).toString('hex');
  db()
    .prepare('DELETE FROM sessions WHERE expires_at<=? OR credential_hash!=?')
    .run(Date.now(), hash(process.env.ADMIN_PASSWORD));
  db()
    .prepare('INSERT INTO sessions(token_hash,credential_hash,expires_at) VALUES(?,?,?)')
    .run(hash(token), hash(process.env.ADMIN_PASSWORD), Date.now() + SESSION_SECONDS * 1000);
  return token;
}
export function revokeSession(token?: string) {
  if (token) db().prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));
}
