import assert from 'node:assert/strict';
import { removeContacts } from '../lib/contact-removal.ts';
const state = {
  contacts: ['a', 'b', 'c'].map(id => ({id, consent: true, optedOut: id === 'b'})),
  jobs: [{contactId: 'a', status: 'pending'}, {contactId: 'b', status: 'sent'}, {contactId: 'c', status: 'pending'}],
  outreachTasks: [{contactId: 'a', status: 'pending'}],
  messages: [{contactId: 'b', text: 'History'}],
};
assert.throws(() => removeContacts(state, []), /válidos/);
assert.throws(() => removeContacts(state, ['a', 'missing']), /inexistente/);
assert.equal(state.contacts[0].deletedAt, undefined);
state.outreachTasks[0].status = 'processing';
assert.throws(() => removeContacts(state, ['a', 'b']), /processamento/);
assert.equal(state.contacts[1].deletedAt, undefined, 'bulk rejection is atomic');
state.outreachTasks[0].status = 'pending';
assert.equal(removeContacts(state, ['a', 'b', 'a']).count, 2);
assert.ok(state.contacts[0].deletedAt);
assert.equal(state.contacts[0].consent, false);
assert.equal(state.jobs[0].status, 'skipped');
assert.equal(state.outreachTasks[0].status, 'skipped');
assert.equal(state.jobs[1].status, 'sent');
assert.equal(state.jobs[2].status, 'pending');
assert.equal(state.messages[0].text, 'History');
removeContacts(state, ['a', 'b'], true);
assert.equal(state.contacts[0].deletedAt, undefined);
assert.equal(state.contacts[0].consent, false, 'undo cannot reauthorize sends');
assert.equal(state.contacts[1].optedOut, true, 'undo preserves opt-out');
assert.equal(state.jobs[0].status, 'skipped', 'undo cannot resume queued sends');
console.log('Contact removal: bulk atomicity, active-send guard, cancellation, history, and undo checks passed.');
