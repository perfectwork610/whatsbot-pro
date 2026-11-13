import assert from 'node:assert/strict';
import { removeAccount } from '../lib/account-removal.ts';
const state = {
  accounts: [{id: 'a', enabled: true}, {id: 'b', enabled: true}],
  campaigns: [{id: 'c', accountId: 'a', status: 'running'}, {id: 'd', accountId: 'b', status: 'running'}],
  jobs: [{campaignId: 'c', status: 'processing'}],
  messages: [{accountId: 'a', status: 'sent', providerId: 'preserved'}],
};
assert.throws(() => removeAccount(state, 'missing'), /inexistente/);
assert.throws(() => removeAccount(state, 'a'), /envio atual/);
assert.equal(state.accounts[0].enabled, true);
state.jobs[0].status = 'sent';
state.messages.push({accountId: 'a', status: 'processing'});
assert.throws(() => removeAccount(state, 'a'), /envio atual/);
state.messages.pop();
removeAccount(state, 'a');
assert.ok(state.accounts[0].deletedAt);
assert.equal(state.accounts[0].enabled, false);
assert.equal(state.campaigns[0].status, 'paused');
assert.equal(state.campaigns[1].status, 'running');
assert.equal(state.messages[0].providerId, 'preserved');
removeAccount(state, 'a', true);
assert.equal(state.accounts[0].deletedAt, undefined);
assert.equal(state.accounts[0].enabled, false);
assert.equal(state.campaigns[0].status, 'paused');
console.log('Account deletion: active-send guards, isolation, history, and inactive Undo checks passed.');
