import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (existsSync('.env.local')) console.log('.env.local already exists; kept your configuration.');
else {
  writeFileSync('.env.local', `WHATSAPP_MODE=simulation\nADMIN_PASSWORD=${randomBytes(24).toString('hex')}\nWORKER_SECRET=${randomBytes(32).toString('hex')}\nAPP_URL=http://localhost:3000\nMETA_GRAPH_VERSION=\nMETA_APP_SECRET=\nMETA_VERIFY_TOKEN=${randomBytes(24).toString('hex')}\nWA_TOKEN_PRIMARY=\n`, { flag: 'wx' });
  console.log('Created .env.local with unique secrets. Sign in as admin using ADMIN_PASSWORD from that file.');
}
