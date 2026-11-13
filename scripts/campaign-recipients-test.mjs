import assert from 'node:assert/strict';
import { campaignRecipients } from '../lib/campaign-recipients.ts';
const jobs = [
  {id: 'j1', campaignId: 'c', contactId: 'a', status: 'sent'},
  {id: 'j2', campaignId: 'c', contactId: 'b', status: 'failed', error: 'Meta 401: Authentication Error'},
  {id: 'j3', campaignId: 'c', contactId: 'removed', status: 'pending'},
  {id: 'other', campaignId: 'other', contactId: 'a', status: 'sent'},
];
const people = [{id: 'a', name: 'Alice', phone: '12025550101'}, {id: 'b', name: 'Bruno', phone: '12025550102'}];
const messages = [
  {campaignId: 'c', contactId: 'a', direction: 'out', status: 'accepted', createdAt: '2026-11-14T00:00:00Z'},
  {campaignId: 'other', contactId: 'a', direction: 'out', status: 'failed', error: 'Unrelated failure', createdAt: '2026-11-14T01:00:00Z'},
];
const rows = campaignRecipients('c', jobs, people, messages);
assert.equal(rows.length, 3);
assert.equal(rows[0].phone, '12025550101');
assert.equal(rows[0].status, 'sent');
assert.equal(rows[0].delivery, 'accepted', 'API acceptance is not delivery confirmation');
assert.equal(rows[1].phone, '12025550102');
assert.equal(rows[1].error, 'Meta 401: Authentication Error');
assert.equal(rows[2].name, undefined, 'missing contacts do not drop job records');
messages.push({campaignId: 'c', contactId: 'a', direction: 'out', status: 'failed', error: 'Delivery rejected', createdAt: '2026-11-14T02:00:00Z'});
const updated = campaignRecipients('c', jobs, people, messages);
assert.equal(updated[0].status, 'failed');
assert.equal(updated[0].error, 'Delivery rejected');
console.log('Campaign recipient phone, failure detail, delivery state, and campaign isolation checks passed.');
