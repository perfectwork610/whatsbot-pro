import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { State } from './types';

const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(path.join(dir, 'whatsbot.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
const initial: State = { contacts: [], accounts: [], campaigns: [], messages: [], jobs: [], events: [], nextSend: {}, settings: { botEnabled: false, greeting: 'Olá! Obrigado pelo contato. Nossa equipe já vai atender você.' }, audit: [] };
db.prepare('INSERT OR IGNORE INTO app_state(id,value) VALUES(1,?)').run(JSON.stringify(initial));
export function read(): State { return JSON.parse((db.prepare('SELECT value FROM app_state WHERE id=1').get() as { value: string }).value); }
export function update<T>(fn: (state: State) => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const state = read(); const result = fn(state); db.prepare('UPDATE app_state SET value=? WHERE id=1').run(JSON.stringify(state)); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}
export function audit(state: State, text: string) { state.audit.unshift({ at: new Date().toISOString(), text }); state.audit = state.audit.slice(0, 1000); }
