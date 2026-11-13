import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const port = process.env.TEST_PORT || '3102';
const url = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  NODE_ENV: 'production',
  WHATSAPP_MODE: 'simulation',
  APP_URL: url,
  ADMIN_PASSWORD: 'integration-admin-password',
  WORKER_SECRET: 'integration-worker-secret',
  META_APP_SECRET: 'integration-app-secret',
  META_VERIFY_TOKEN: 'integration-verify-token',
  DATA_DIR: mkdtempSync(path.join(tmpdir(), 'whatsbot-test-')),
  TEST_URL: url,
};
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port],
  { env, stdio: ['ignore', 'pipe', 'pipe'] },
);
let output = '';
server.stdout.on('data', (c) => (output += c));
server.stderr.on('data', (c) => (output += c));
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(url + '/login');
      if (r.status === 200) {
        ready = true;
        break;
      }
    } catch {}
    if (server.exitCode !== null) throw new Error(output);
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!ready) throw new Error(`Test server did not become ready. ${output}`);
  const test = spawn(process.execPath, ['scripts/integration-test.mjs'], { env, stdio: 'inherit' });
  process.exitCode = await new Promise((resolve) => test.on('exit', (code) => resolve(code ?? 1)));
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  server.kill();
}
