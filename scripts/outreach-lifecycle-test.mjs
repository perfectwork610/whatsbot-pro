import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { closeOutreachClient } from '../lib/outreach-lifecycle.mjs';

let finishLaunch;
let opened = false;
let closes = 0;
const entry = {
  client: { async destroy() { if (opened) { opened = false; closes++; } } },
  initializing: new Promise(resolve => { finishLaunch = () => { opened = true; resolve(); }; }),
};
const closing = closeOutreachClient(entry);
const repeated = closeOutreachClient(entry);
await Promise.resolve();
finishLaunch();
await Promise.all([closing, repeated]);
assert.equal(opened, false, 'a late browser launch must be closed before releasing the profile');
assert.equal(closes, 1, 'concurrent shutdowns share one cleanup');
let attempts = 0;
await closeOutreachClient({client: {async destroy() { attempts++; throw Error('already closed'); }}, initializing: Promise.reject(Error('launch failed'))});
assert.equal(attempts, 2, 'failed initialization still performs final browser cleanup');
const child = new EventEmitter();
child.exitCode = null;
child.signalCode = null;
let kills = 0;
child.kill = () => { kills++; child.signalCode = 'SIGKILL'; child.emit('exit'); };
await closeOutreachClient({
  client: { pupBrowser: { process: () => child }, async destroy() { throw Error('protocol connection lost'); } },
  initializing: Promise.resolve(),
});
assert.equal(kills, 1, 'failed protocol shutdown terminates only the owned browser process');
console.log('Outreach browser lifecycle race checks passed.');
