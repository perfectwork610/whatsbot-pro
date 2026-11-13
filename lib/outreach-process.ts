import { spawn } from 'node:child_process';
import { openSync, closeSync, mkdirSync } from 'node:fs';
import path from 'node:path';
export function startOutreachWorker() {
  if (process.env.OUTREACH_DISABLE_AUTOSTART === 'true') return;
  const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  mkdirSync(dir, { recursive: true });
  const log = openSync(path.join(dir, 'outreach-worker.log'), 'a');
  try {
    const child = spawn(
      process.execPath,
      ['--env-file-if-exists=.env.local', 'scripts/outreach-worker.mjs'],
      {
        cwd: process.cwd(),
        env: process.env,
        detached: true,
        windowsHide: true,
        stdio: ['ignore', log, log],
      },
    );
    child.on('error', () => {});
    child.unref();
  } finally {
    closeSync(log);
  }
}
