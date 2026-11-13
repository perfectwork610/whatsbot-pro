import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { closeOutreachClient } from '../lib/outreach-lifecycle.mjs';

const require = createRequire(import.meta.url);
const puppeteer = createRequire(require.resolve('whatsapp-web.js'))('puppeteer');
const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(existsSync);
const userDataDir = path.resolve('.test-data', 'browser-reconnect-' + randomUUID());
for (let attempt = 0; attempt < 3; attempt++) {
  const browser = await puppeteer.launch({ executablePath, headless: true, userDataDir });
  const child = browser.process();
  try {
    await closeOutreachClient({
      client: {
        pupBrowser: browser,
        // Also cover a lost protocol connection, not just normal shutdown.
        destroy: attempt === 1 ? async () => { throw Error('protocol disconnected'); } : () => browser.close(),
      },
      initializing: Promise.resolve(),
    });
    assert.ok(child.exitCode !== null || child.signalCode !== null, 'profile owner must exit before reconnect');
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
}
console.log('PASS: real Chromium reused the same profile three times, including failed shutdown recovery.');
