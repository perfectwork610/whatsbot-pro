import assert from 'node:assert/strict';
import { reserveOutreach, outreachAckStatus } from '../lib/outreach-engine.ts';
import { dispatchOutreach } from '../lib/outreach-dispatch.ts';
const now = Date.now();
function fixture() {
  return {
    contacts: [{ id: 'c', name: 'Alice', phone: '12025550101', consent: true, optedOut: false }],
    accounts: [],
    campaigns: [],
    messages: [],
    jobs: [],
    events: [],
    nextSend: {},
    settings: { botEnabled: false, greeting: 'Hello' },
    audit: [],
    outreachRuns: [
      {
        id: 'r',
        name: 'Robot',
        connector: 'whatsapp-web',
        senderIds: ['s'],
        message: 'Hi {{name}} from {{business}}',
        delay: 30,
        status: 'running',
        simulated: true,
        saveContacts: true,
        createdAt: new Date().toISOString(),
      },
    ],
    outreachTasks: [{ id: 'j', runId: 'r', contactId: 'c', senderId: 's', status: 'pending' }],
    outreachSessions: [
      {
        id: 's',
        name: 'Web',
        enabled: true,
        testOnly: true,
        desiredConnected: true,
        status: 'ready',
        generation: 1,
        dailyLimit: 2,
        updatedAt: now,
      },
    ],
    outreachMessages: [],
    workspace: { name: 'Test business' },
  };
}
function memory(initial) {
  let value = initial;
  return { read: () => structuredClone(value), update: (fn) => fn(value), value: () => value };
}
let state = fixture();
let job = reserveOutreach(state, true, now);
assert.equal(job.task.status, 'processing');
assert.equal(reserveOutreach(state, true, now), null, 'no duplicate reservation');
assert.equal(state.campaigns.length, 0);
assert.equal(state.jobs.length, 0);
state = fixture();
state.contacts[0].optedOut = true;
assert.equal(reserveOutreach(state, true, now), null);
assert.equal(state.outreachTasks[0].status, 'skipped');
state = fixture();
state.outreachSessions[0].dailyLimit = 1;
state.outreachMessages = [
  {
    accountId: 's',
    direction: 'out',
    status: 'sent',
    createdAt: new Date(now - 1000).toISOString(),
  },
];
assert.equal(reserveOutreach(state, true, now), null, 'per-session 24h cap');
state = fixture();
state.outreachNextSend = { s: now + 5000 };
assert.equal(reserveOutreach(state, true, now), null, 'shared interval across runs');
state = fixture();
state.outreachRuns[0].simulated = false;
assert.equal(reserveOutreach(state, false, now), null, 'test sessions cannot send in live mode');
state = fixture();
const store = memory(state);
await dispatchOutreach(store, true, () => {
  throw Error('dry run must not call an external sender');
});
assert.equal(store.value().outreachTasks[0].status, 'sent');
assert.equal(store.value().outreachTasks[0].savedContact, undefined);
assert.equal(store.value().outreachMessages[0].simulated, true);
assert.equal(store.value().outreachMessages[0].text, 'Hi Alice from Test business');
state = fixture();
state.outreachRuns[0].simulated = false;
state.outreachSessions[0].testOnly = false;
const live = memory(state);
const calls = [];
await dispatchOutreach(live, false, () => ({
  numberId: async () => {
    calls.push('lookup');
    return 'number@c.us';
  },
  saveContact: async () => {
    calls.push('save');
  },
  send: async () => {
    calls.push('send');
    return 'provider-id';
  },
}));
assert.deepEqual(calls, ['lookup', 'save', 'send']);
assert.equal(live.value().outreachTasks[0].savedContact, true);
assert.equal(live.value().outreachMessages[0].providerId, 'provider-id');
state = fixture();
state.outreachRuns[0].simulated = false;
state.outreachSessions[0].testOnly = false;
const suppressed = memory(state);
await dispatchOutreach(suppressed, false, () => ({
  numberId: async () => 'number@c.us',
  saveContact: async () => {
    suppressed.update((s) => {
      s.contacts[0].optedOut = true;
    });
  },
  send: async () => {
    throw Error('must not send after opt-out');
  },
}));
assert.equal(suppressed.value().outreachTasks[0].status, 'skipped');
assert.equal(suppressed.value().outreachMessages.length, 0);
state = fixture();
state.outreachRuns[0].simulated = false;
state.outreachSessions[0].testOnly = false;
const uncertain = memory(state);
await dispatchOutreach(uncertain, false, () => ({
  numberId: async () => 'number@c.us',
  saveContact: async () => {},
  send: async () => {
    throw Error('timeout after dispatch');
  },
}));
assert.equal(uncertain.value().outreachTasks[0].status, 'needs-review');
assert.equal(uncertain.value().outreachRuns[0].status, 'paused');
assert.equal(
  reserveOutreach(uncertain.value(), false, now + 100000),
  null,
  'uncertain sends never retry',
);
console.log(
  'Outreach queue isolation, pacing, quotas, contact saving, suppression and uncertain-delivery tests passed.',
);

assert.equal(outreachAckStatus('read', -1), 'read');
assert.equal(outreachAckStatus('delivered', 1), 'delivered');
assert.equal(outreachAckStatus('sent', 2), 'delivered');
assert.equal(outreachAckStatus('sent', -1), 'failed');
console.log('Outreach receipt ordering checks passed.');
