import assert from 'node:assert/strict';
import { separateLegacyOutreach } from '../lib/outreach-migration.ts';
const campaign = (id, mode, status = 'running') => ({
  id,
  mode,
  status,
  name: id,
  accountId: 'sender',
  template: 'hello_world',
  language: 'en_US',
  parameters: [],
  delay: 30,
  createdAt: '2026-11-13T12:00:00Z',
});
const state = {
  campaigns: [campaign('bulk', 'bulk'), campaign('individual', 'sequential')],
  jobs: [
    { id: 'bulk-job', campaignId: 'bulk', contactId: 'c', status: 'pending' },
    ...['sent', 'pending', 'failed', 'processing', 'skipped'].map((status) => ({
      id: status,
      campaignId: 'individual',
      contactId: status,
      status,
    })),
  ],
  messages: [
    {
      id: 'history',
      campaignId: 'individual',
      providerId: 'provider-original',
      status: 'accepted',
    },
  ],
  contacts: [],
  accounts: [],
  settings: { botEnabled: false, greeting: 'Hello' },
  events: [],
  nextSend: { sender: 123 },
  audit: [],
};
const original = structuredClone(state);
const next = separateLegacyOutreach(state);
assert.deepEqual(state, original, 'preparation does not mutate live state');
assert.equal(next.campaigns.length, 1);
assert.equal(next.campaigns[0].id, 'bulk');
assert.equal(next.jobs.length, 1);
assert.equal(next.outreachRuns[0].status, 'paused', 'running sequences require explicit resume');
assert.equal(
  next.outreachTasks.find((task) => task.id === 'sent').status,
  'sent',
  'sent contacts never become pending',
);
assert.equal(
  next.outreachTasks.find((task) => task.id === 'processing').status,
  'needs-review',
  'uncertain deliveries are never retried automatically',
);
assert.equal(
  next.outreachRuns[0].connector,
  'official-api',
  'legacy API sends are never silently converted to WhatsApp Web',
);
assert.deepEqual(next.messages, original.messages);
assert.deepEqual(next.nextSend, original.nextSend);
assert.deepEqual(separateLegacyOutreach(next), next, 'migration preparation is idempotent');
console.log('Outreach migration preservation and idempotency checks passed.');
