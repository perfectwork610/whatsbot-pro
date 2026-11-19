import path from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import pkg from 'whatsapp-web.js';
import QRCode from 'qrcode';
import { read, update, migrateLegacyOutreach } from '../lib/store.ts';
import { dispatchOutreach } from '../lib/outreach-dispatch.ts';
import { OutreachClient } from '../lib/outreach-client.mjs';
import { outreachAckStatus } from '../lib/outreach-engine.ts';
import { closeOutreachClient } from '../lib/outreach-lifecycle.mjs';
const { Client, LocalAuth } = pkg;
const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const owner = randomUUID();
const clients = new Map();
let stopping = false;
const simulated = process.env.WHATSAPP_MODE !== 'live';
function errorText(error) {
  return error instanceof Error ? error.message : String(error);
}
function patch(id, generation, fields) {
  update((state) => {
    const session = state.outreachSessions?.find((s) => s.id === id);
    if (session && session.generation === generation)
      Object.assign(session, fields, { updatedAt: Date.now() });
  });
}
function browserPath() {
  return (
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    [
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
    ].find(existsSync)
  );
}
function acquire() {
  return update((state) => {
    const current = state.outreachWorker;
    if (current && current.owner !== owner && current.expiresAt > Date.now()) return false;
    const newOwner = current?.owner !== owner;
    if (newOwner) {
      for (const task of state.outreachTasks || []) {
        if (task.status === 'processing') {
          task.status = 'needs-review';
          task.error =
            'Worker interrompido. Verifique se a mensagem foi enviada antes de continuar.';
          const run = state.outreachRuns?.find((r) => r.id === task.runId);
          if (run) run.status = 'paused';
        }
      }
    }
    state.outreachWorker = { owner, heartbeat: Date.now(), expiresAt: Date.now() + 30000 };
    return true;
  });
}
function heartbeat() {
  update((state) => {
    if (state.outreachWorker?.owner !== owner) {
      stopping = true;
      return;
    }
    state.outreachWorker.heartbeat = Date.now();
    state.outreachWorker.expiresAt = Date.now() + 30000;
  });
}
async function inbound(session, client, message) {
  if (message.fromMe || message.isStatus || message.from?.endsWith('@g.us') || !message.body)
    return;
  let phone = message.from?.endsWith('@c.us') ? message.from.split('@')[0] : undefined;
  if (!phone && message.from?.endsWith('@lid')) {
    const found = await client.getContactLidAndPhone([message.from]);
    const pn = found?.[0]?.pn;
    if (pn?.endsWith('@c.us')) phone = pn.split('@')[0];
  }
  if (!phone || !/^[1-9]\d{7,14}$/.test(phone)) return;
  update((state) => {
    if (
      !state.outreachSessions?.some(
        (s) => s.id === session.id && s.generation === session.generation && s.desiredConnected,
      )
    )
      return;
    state.outreachMessages ||= [];
    if (
      state.outreachMessages.some(
        (m) => m.providerId === message.id._serialized && m.accountId === session.id,
      )
    )
      return;
    let contact = state.contacts.find((c) => c.phone === phone);
    if (!contact) {
      contact = {
        id: randomUUID(),
        name: phone,
        phone,
        consent: false,
        source: '',
        optedOut: false,
        createdAt: new Date().toISOString(),
      };
      state.contacts.push(contact);
    }
    if (/^(sair|parar|stop|cancelar)$/i.test(message.body.trim())) {
      contact.consent = false;
      contact.optedOut = true;
    }
    state.outreachMessages.push({
      id: randomUUID(),
      providerId: message.id._serialized,
      accountId: session.id,
      contactId: contact.id,
      direction: 'in',
      text: message.body.slice(0, 4000),
      status: 'received',
      simulated: false,
      createdAt: new Date(message.timestamp * 1000).toISOString(),
    });
  });
}
async function connectionCycle() {
  const sessions = read().outreachSessions || [];
  for (const [id, entry] of clients) {
    const session = sessions.find((s) => s.id === id);
    if (!session?.desiredConnected || session.generation !== entry.generation) {
      await closeOutreachClient(entry);
      if (clients.get(id) === entry) clients.delete(id);
    }
  }
  for (const session of sessions) {
    if (!session.desiredConnected) continue;
    if (session.testOnly) {
      if (simulated)
        patch(session.id, session.generation, { status: 'ready', qr: undefined, error: undefined });
      else
        patch(session.id, session.generation, {
          status: 'error',
          error: 'Conexão de teste indisponível no modo live.',
          desiredConnected: false,
        });
      continue;
    }
    if (clients.has(session.id)) continue;
    const executablePath = browserPath();
    const usePairing =
      session.authMethod === 'pairing' &&
      typeof session.pairingPhone === 'string' &&
      /^[1-9]\d{7,14}$/.test(session.pairingPhone);
    const client = new OutreachClient({
      authStrategy: new LocalAuth({
        clientId: session.id,
        dataPath: path.join(dataDir, 'outreach-auth'),
      }),
      webVersionCache: { type: 'none' },
      qrMaxRetries: 5,
      authTimeoutMs: 60000,
      deviceName: 'WhatsBot Individual Outreach',
      userAgent: false,
      puppeteer: { headless: true, ...(executablePath ? { executablePath } : {}) },
      ...(usePairing
        ? {
            pairWithPhoneNumber: {
              phoneNumber: session.pairingPhone,
              showNotification: true,
              intervalMs: 180000,
            },
          }
        : {}),
    });
    const entry = { client, generation: session.generation };
    clients.set(session.id, entry);
    client.on('connector_error', (error) => {
      patch(session.id, session.generation, {
        status: 'error',
        error: errorText(error),
        desiredConnected: false,
        qr: undefined,
        pairingCode: undefined,
        pairingCodeExpiresAt: undefined,
      });
    });
    patch(session.id, session.generation, {
      status: 'connecting',
      qr: undefined,
      pairingCode: undefined,
      pairingCodeExpiresAt: undefined,
      error: undefined,
    });
    client.on('qr', async (qr) => {
      if (usePairing) return;
      try {
        const png = await QRCode.toDataURL(qr, {
          width: 280,
          margin: 2,
          errorCorrectionLevel: 'M',
        });
        const current = read().outreachSessions?.find((s) => s.id === session.id);
        if (current?.desiredConnected && current.generation === session.generation)
          patch(session.id, session.generation, {
            status: 'qr',
            qr: png,
            qrExpiresAt: Date.now() + 55000,
            pairingCode: undefined,
            pairingCodeExpiresAt: undefined,
          });
      } catch (error) {
        patch(session.id, session.generation, {
          status: 'error',
          error: errorText(error),
          desiredConnected: false,
        });
      }
    });
    client.on('code', (code) => {
      const current = read().outreachSessions?.find((s) => s.id === session.id);
      if (!current?.desiredConnected || current.generation !== session.generation) return;
      const normalized = String(code || '')
        .replace(/\s+/g, '')
        .toUpperCase();
      if (!normalized) return;
      patch(session.id, session.generation, {
        status: 'pairing',
        pairingCode: normalized,
        pairingCodeExpiresAt: Date.now() + 170000,
        qr: undefined,
        qrExpiresAt: undefined,
      });
    });
    client.on('authenticated', () =>
      patch(session.id, session.generation, {
        status: 'authenticated',
        qr: undefined,
        qrExpiresAt: undefined,
        pairingCode: undefined,
        pairingCodeExpiresAt: undefined,
      }),
    );
    client.on('ready', () =>
      patch(session.id, session.generation, {
        status: 'ready',
        phone: client.info?.wid?._serialized?.endsWith('@c.us') ? client.info.wid.user : undefined,
        qr: undefined,
        pairingCode: undefined,
        pairingCodeExpiresAt: undefined,
        error: undefined,
      }),
    );
    client.on('auth_failure', () =>
      patch(session.id, session.generation, {
        status: 'error',
        error: 'Falha na autenticação. Conecte novamente.',
        desiredConnected: false,
        qr: undefined,
        pairingCode: undefined,
        pairingCodeExpiresAt: undefined,
      }),
    );
    client.on('disconnected', () =>
      patch(session.id, session.generation, {
        status: 'disconnected',
        desiredConnected: false,
        qr: undefined,
        pairingCode: undefined,
        pairingCodeExpiresAt: undefined,
      }),
    );
    client.on('message', (message) => {
      inbound(session, client, message).catch(() => {});
    });
    client.on('message_ack', (message, ack) =>
      update((state) => {
        const found = state.outreachMessages?.find(
          (m) => m.accountId === session.id && m.providerId === message.id._serialized,
        );
        if (!found) return;
        found.status = outreachAckStatus(found.status, ack);
      }),
    );
    entry.initializing = client.initialize().catch((error) => {
      patch(session.id, session.generation, {
        status: 'error',
        error: errorText(error),
        desiredConnected: false,
        qr: undefined,
      });
      // connectionCycle owns shutdown; do not release the profile while the
      // failing browser is still closing.
    });
  }
}
function sender(session) {
  const entry = clients.get(session.id);
  if (!entry || entry.generation !== session.generation) return undefined;
  return {
    numberId: async (phone) => (await entry.client.getNumberId(phone))?._serialized || null,
    saveContact: async (phone, name, sync) => {
      const [first, ...rest] = name.split(/\s+/);
      await entry.client.saveOrEditAddressbookContact(phone, first, rest.join(' '), sync);
    },
    send: async (id, text) => {
      let timer;
      try {
        return await Promise.race([
          entry.client
            .sendMessage(id, text, { sendSeen: false })
            .then((message) => message.id?._serialized),
          new Promise((_, reject) => {
            timer = setTimeout(
              () => reject(new Error('Tempo esgotado. Verifique a entrega antes de continuar.')),
              60000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
export function stopOutreachWorker() {
  stopping = true;
}
export async function runOutreachWorker({ once = false } = {}) {
  migrateLegacyOutreach();
  if (!acquire()) throw new Error('Outro worker do robô já está em execução.');
  console.log('Individual outreach worker started. Mode: ' + (simulated ? 'simulation' : 'live'));
  const timer = setInterval(heartbeat, 5000);
  timer.unref();
  try {
    do {
      if (stopping) break;
      await connectionCycle();
      await dispatchOutreach({ read, update }, simulated, sender);
      if (once) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } while (!stopping);
  } finally {
    clearInterval(timer);
    for (const entry of clients.values()) await closeOutreachClient(entry);
    update((state) => {
      if (state.outreachWorker?.owner === owner) state.outreachWorker.expiresAt = 0;
    });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.on('SIGINT', () => {
    stopping = true;
  });
  process.on('SIGTERM', () => {
    stopping = true;
  });
  runOutreachWorker({ once: process.argv.includes('--once') }).catch((error) => {
    console.error(errorText(error));
    process.exitCode = 1;
  });
}
