import path from 'node:path';

/** Durable local data directory. On Vercel, falls back to ephemeral /tmp. */
export function dataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR;
  if (process.env.VERCEL) return '/tmp/whatsbot-data';
  return path.join(process.cwd(), 'data');
}
