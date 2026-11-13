import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
const base = process.env.TEST_URL || 'http://127.0.0.1:3101';
const password = process.env.TEST_ADMIN_PASSWORD || 'integration-admin-password';
const workerSecret = process.env.TEST_WORKER_SECRET || 'integration-worker-secret';
const appSecret = process.env.TEST_APP_SECRET || 'integration-app-secret';
let auth = '';
const legacyAuth = `Basic ${Buffer.from(`admin:${password}`).toString('base64')}`;
let checks = 0;
function check(condition, label) {
  assert.ok(condition, label);
  checks++;
  console.log(`PASS ${label}`);
}
async function state() {
  const r = await fetch(`${base}/api/manage`, { headers: { Cookie: auth } });
  assert.equal(r.status, 200);
  return r.json();
}
async function action(body, expected = 200) {
  const r = await fetch(`${base}/api/manage`, {
    method: 'POST',
    headers: { Cookie: auth, Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(r.status, expected, await r.clone().text());
  return r.json();
}
async function tick() {
  const r = await fetch(`${base}/api/worker`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${workerSecret}` },
  });
  assert.equal(r.status, 200);
  return r.json();
}
async function webhook(body, signed = true) {
  const raw = JSON.stringify(body);
  const r = await fetch(`${base}/api/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signed
        ? {
            'x-hub-signature-256': `sha256=${createHmac('sha256', appSecret).update(raw).digest('hex')}`,
          }
        : {}),
    },
    body: raw,
  });
  return r;
}
const anonymous = await fetch(base, { redirect: 'manual' });
check(
  anonymous.status === 307 && anonymous.headers.get('location').endsWith('/login'),
  'anonymous dashboard redirects to login page',
);
check(
  !anonymous.headers.has('www-authenticate'),
  'browser Basic Auth popup is no longer requested',
);
check((await fetch(base + '/login')).status === 200, 'login page is publicly accessible');
const art = await fetch(base + '/images/login-hero.webp');
check(
  art.status === 200 && art.headers.get('content-type').includes('image/webp'),
  'login artwork is publicly accessible without a session',
);
check(
  (await fetch(base + '/api/manage', { headers: { Authorization: legacyAuth } })).status === 401,
  'old browser Basic credentials cannot bypass login',
);
async function login(body, origin = base) {
  return fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const temporaryLogin = await login({ username: 'admin', password, remember: false });
check(
  temporaryLogin.status === 200 && !temporaryLogin.headers.get('set-cookie').includes('Max-Age='),
  'remember-me unchecked uses a browser-session cookie',
);
await fetch(base + '/api/auth/logout', {
  method: 'POST',
  headers: { Cookie: temporaryLogin.headers.get('set-cookie').split(';')[0], Origin: base },
});
check(
  (await login({ username: 'admin', password }, 'https://evil.example')).status === 403,
  'cross-origin login rejected',
);
check(
  (await login({ username: 'admin', password: 'incorrect' })).status === 401,
  'incorrect password rejected',
);
check(
  (await login({ username: 'someone', password })).status === 401,
  'incorrect username rejected',
);
const signedIn = await login({ username: 'admin', password });
const cookie = signedIn.headers.get('set-cookie');
check(
  signedIn.status === 200 &&
    cookie?.includes('HttpOnly') &&
    cookie?.includes('SameSite=lax') &&
    cookie?.includes('Max-Age=43200'),
  'login sets protected twelve-hour session cookie',
);
auth = cookie.split(';')[0];
check(
  (await fetch(base, { headers: { Cookie: auth } })).status === 200,
  'session grants dashboard access',
);
check(
  (await fetch(base + '/login', { headers: { Cookie: auth }, redirect: 'manual' })).status === 307,
  'signed-in visitor is redirected away from login',
);
check(
  (await fetch(base + '/api/manage', { headers: { Cookie: auth.slice(0, -1) + 'z' } })).status ===
    401,
  'tampered session rejected',
);
const s0 = await state();
check(s0.simulation, 'test server is simulation-only');
check((await fetch(`${base}/api/manage`)).status === 401, 'dashboard API requires authentication');
check(
  (await fetch(`${base}/api/worker`, { method: 'POST' })).status === 401,
  'worker requires separate secret',
);
check(
  (
    await fetch(`${base}/api/manage`, {
      method: 'POST',
      headers: { Cookie: auth, Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: '{}',
    })
  ).status === 403,
  'cross-origin writes rejected',
);
const seed = String(Date.now()).slice(-9);
const phone1 = `5511${seed}1`;
const phone2 = `5511${seed}2`;
const phone3 = `5511${seed}3`;
const result = await action({
  action: 'contacts',
  rows: [
    { name: 'Test Authorized', phone: phone1, consent: true, source: 'Integration opt-in' },
    { name: 'Test No Proof', phone: phone2, consent: true, source: '' },
    { name: 'Test Unsubscribe', phone: phone3, consent: true, source: 'Integration opt-in' },
    { phone: 'invalid' },
    { phone: phone1 },
  ],
});
check(
  result.result.added === 3 && result.result.invalid === 1 && result.result.duplicates === 1,
  'import validates and deduplicates phone numbers',
);
let s = await state();
const c1 = s.contacts.find((c) => c.phone === phone1);
const c2 = s.contacts.find((c) => c.phone === phone2);
const c3 = s.contacts.find((c) => c.phone === phone3);
check(!c2.consent, 'consent cannot be granted without evidence');
const { parseContactList } = await import('../lib/csv.ts');
const phoneOnly = `5511${seed}4`;
await action({
  action: 'contacts',
  rows: parseContactList(phoneOnly + '\n' + phoneOnly + '\ninvalid'),
});
const phoneOnlyContact = (await state()).contacts.find((contact) => contact.phone === phoneOnly);
check(
  phoneOnlyContact.name === phoneOnly && !phoneOnlyContact.consent && !phoneOnlyContact.source,
  'phone-only import uses phone as label and leaves permission pending',
);
await action({ action: 'consent', id: phoneOnlyContact.id, consent: false });
const reimport = await action({ action: 'contacts', rows: parseContactList(phoneOnly) });
check(
  reimport.result.duplicates === 1 &&
    (await state()).contacts.find((contact) => contact.id === phoneOnlyContact.id).optedOut,
  'phone-only reimport does not restore an unsubscribe',
);
const phoneId = `99${seed}`;
await action(
  {
    action: 'account',
    name: 'Invalid phone as ID',
    phoneId: '+5511999999999',
    wabaId: '123456',
    tokenEnv: 'WA_TOKEN_TEST',
    dailyLimit: 250,
  },
  400,
);
check(true, 'actual phone number is not accepted as a Meta Phone Number ID');
await action({
  action: 'account',
  name: `Quick test ${seed}`,
  testAccount: true,
  displayPhone: '+55 (11) 99999-9999',
  dailyLimit: 250,
});
const quickAccount = (await state()).accounts.find((a) => a.name === `Quick test ${seed}`);
check(
  quickAccount.simulationOnly &&
    /^\d+$/.test(quickAccount.phoneId) &&
    quickAccount.templates[0].name === 'hello_world',
  'test account needs no Meta IDs or token and includes its template',
);
check(
  quickAccount.displayPhone === '5511999999999',
  'optional test phone is normalized and stored as a label',
);
await action(
  {
    action: 'account',
    name: 'Invalid test phone',
    testAccount: true,
    displayPhone: 'invalid',
    dailyLimit: 250,
  },
  400,
);
check(true, 'invalid optional phone is rejected');
await action({
  action: 'account',
  name: `Test ${seed}`,
  phoneId,
  wabaId: '123456',
  tokenEnv: 'WA_TOKEN_TEST',
  dailyLimit: 1,
});
s = await state();
const account = s.accounts.find((a) => a.phoneId === phoneId);
check(account.templates[0].name === 'hello_world', 'simulation account has a test template');
check(!('token' in account), 'access tokens are not exposed by API');
await action({
  action: 'account-update',
  id: account.id,
  name: 'Updated test account',
  displayPhone: '+55 11 99999-9999',
  dailyLimit: 1,
});
let updatedAccount = (await state()).accounts.find((a) => a.id === account.id);
check(
  updatedAccount.name === 'Updated test account' &&
    updatedAccount.displayPhone === '5511999999999' &&
    updatedAccount.dailyLimit === 1,
  'account settings persist and normalize the display phone',
);
await action(
  { action: 'account-update', id: account.id, name: 'Invalid update', dailyLimit: 0 },
  400,
);
check(
  (await state()).accounts.find((a) => a.id === account.id).name === 'Updated test account',
  'invalid account settings roll back without partial changes',
);
await action(
  {
    action: 'campaign',
    name: `Rejected ${seed}`,
    accountId: account.id,
    template: 'hello_world',
    language: 'en_US',
    delay: 5,
    contactIds: [c2.id],
  },
  400,
);
check(true, 'campaign rejects recipients without consent');
await action({
  action: 'campaign',
  name: `Queue ${seed}`,
  accountId: account.id,
  template: 'hello_world',
  language: 'en_US',
  delay: 5,
  contactIds: [c1.id, c3.id],
  mode: 'bulk',
  parameters: ['{{nome}}'],
});
s = await state();
const campaign = s.campaigns.find((c) => c.name === `Queue ${seed}`);
await action({ action: 'campaign-remove', id: campaign.id });
check(!(await state()).campaigns.some((c) => c.id === campaign.id), 'removed campaign is hidden from management');
await action({ action: 'campaign-status', id: campaign.id, status: 'running' }, 400);
await action({ action: 'campaign-restore', id: campaign.id });
check((await state()).jobs.some((j) => j.campaignId === campaign.id && j.status === 'pending'), 'campaign undo preserves queued recipients');
await action({ action: 'consent', id: c3.id, consent: false });
await action({ action: 'campaign-status', id: campaign.id, status: 'running' });
await action({ action: 'account-update', id: account.id, enabled: false });
await tick();
let disabledState = await state();
check(
  disabledState.accounts.find((a) => a.id === account.id).enabled === false &&
    disabledState.campaigns.find((c) => c.id === campaign.id).status === 'paused' &&
    !disabledState.messages.some((m) => m.campaignId === campaign.id),
  'disabling an account pauses campaigns and prevents queued sends',
);
await action({ action: 'campaign-status', id: campaign.id, status: 'running' }, 400);
check(true, 'campaigns cannot start on inactive accounts');
await action({ action: 'account-update', id: account.id, enabled: true });
await action({ action: 'campaign-status', id: campaign.id, status: 'running' });
await Promise.all([tick(), tick(), tick()]);
s = await state();
check(
  s.messages.filter((m) => m.campaignId === campaign.id).length === 1,
  'concurrent worker ticks reserve a job once',
);
check(
  s.messages.find((m) => m.campaignId === campaign.id).simulated,
  'simulation records do not pretend to be real deliveries',
);
check(
  s.messages.find((m) => m.campaignId === campaign.id).text.includes('Test Authorized'),
  'template parameters personalize contact name',
);
await action({ action: 'consent', id: c3.id, consent: true, source: 'Renewed test consent' });
await new Promise((resolve) => setTimeout(resolve, 5100));
await tick();
s = await state();
check(
  s.jobs.find((j) => j.campaignId === campaign.id && j.contactId === c3.id).status === 'pending' &&
    s.messages.filter((m) => m.campaignId === campaign.id).length === 1,
  'daily ceiling blocks an authorized recipient after interval expires',
);
await action({ action: 'consent', id: c3.id, consent: false });
await action({ action: 'reply', contactId: c1.id, accountId: account.id, text: 'No window' }, 400);
check(true, 'free-form reply requires recent inbound message');
await action({ action: 'settings', botEnabled: true, greeting: 'Integration greeting' });
const inboundId = `wamid.test.${seed}`;
const inbound = {
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: phoneId },
            contacts: [{ wa_id: phone1, profile: { name: 'Test' } }],
            messages: [
              {
                id: inboundId,
                from: phone1,
                type: 'text',
                text: { body: 'Hello' },
                timestamp: String(Math.floor(Date.now() / 1000)),
              },
            ],
          },
        },
      ],
    },
  ],
};
check((await webhook(inbound, false)).status === 401, 'unsigned webhooks rejected');
check((await webhook(inbound)).status === 200, 'valid signed webhook accepted');
await webhook(inbound);
s = await state();
check(
  s.messages.filter((m) => m.providerId === inboundId).length === 1,
  'webhook retries do not duplicate inbound messages',
);
check(
  s.messages.filter((m) => m.contactId === c1.id && m.text === 'Integration greeting').length === 1,
  'automatic greeting is sent once per window',
);
const sentId = s.messages.find((m) => m.campaignId === campaign.id).providerId;
await webhook({
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: phoneId },
            statuses: [{ id: sentId, status: 'read' }],
          },
        },
      ],
    },
  ],
});
await webhook({
  entry: [
    {
      changes: [
        {
          value: {
            metadata: { phone_number_id: phoneId },
            statuses: [{ id: sentId, status: 'sent' }],
          },
        },
      ],
    },
  ],
});
check(
  (await state()).messages.find((m) => m.providerId === sentId).status === 'read',
  'out-of-order delivery events do not downgrade read status',
);
await action({
  action: 'reply',
  contactId: c1.id,
  accountId: account.id,
  text: 'Manual test reply',
});
check(
  (await state()).messages.some((m) => m.text === 'Manual test reply' && m.status === 'simulated'),
  'manual reply works inside customer service window',
);
inbound.entry[0].changes[0].value.messages[0] = {
  id: `stop.${seed}`,
  from: phone1,
  type: 'text',
  text: { body: 'SAIR' },
  timestamp: String(Math.floor(Date.now() / 1000)),
};
await webhook(inbound);
s = await state();
check(s.contacts.find((c) => c.id === c1.id).optedOut, 'inbound SAIR suppresses further messages');
await action(
  { action: 'reply', contactId: c1.id, accountId: account.id, text: 'Should not send' },
  400,
);
check(true, 'reply to opted-out contact rejected');
const verify = await fetch(
  `${base}/api/webhook?hub.mode=subscribe&hub.verify_token=integration-verify-token&hub.challenge=challenge123`,
);
check(
  verify.status === 200 && (await verify.text()) === 'challenge123',
  'webhook verification handshake',
);
// A separate account verifies suppression at send time, without waiting on a daily cap.
await action({
  action: 'account',
  name: `Suppression ${seed}`,
  phoneId: `98${seed}`,
  wabaId: '123456',
  tokenEnv: 'WA_TOKEN_TEST',
  dailyLimit: 10,
});
s = await state();
const a2 = s.accounts.find((a) => a.phoneId === `98${seed}`);
await action({ action: 'consent', id: c3.id, consent: true, source: 'New permission' });
await action({
  action: 'campaign',
  name: `Suppression ${seed}`,
  accountId: a2.id,
  template: 'hello_world',
  language: 'en_US',
  delay: 5,
  contactIds: [c3.id],
});
s = await state();
const c4 = s.campaigns.find((c) => c.name === `Suppression ${seed}`);
await action({ action: 'campaign-status', id: c4.id, status: 'running' });
await action({ action: 'consent', id: c3.id, consent: false });
await tick();
s = await state();
check(
  s.jobs.find((j) => j.campaignId === c4.id).status === 'skipped',
  'queued recipient is rechecked after unsubscribe',
);
await tick();
check(
  (await state()).campaigns.find((c) => c.id === c4.id).status === 'completed',
  'queue completes after suppressed jobs are processed',
);

await action({
  action: 'contact-update',
  id: c2.id,
  name: 'Updated contact',
  phone: c2.phone,
  lists: ['Customers', 'Promotion', 'Customers'],
});
let edited = (await state()).contacts.find((c) => c.id === c2.id);
check(
  edited.name === 'Updated contact' &&
    edited.lists.length === 2 &&
    edited.lists.includes('Customers'),
  'contact edits and list memberships persist and deduplicate',
);
await action(
  { action: 'contact-update', id: c2.id, name: 'Duplicate number', phone: c1.phone, lists: [] },
  400,
);
check(
  (await state()).contacts.find((c) => c.id === c2.id).phone === c2.phone,
  'duplicate phone edits are rejected without changing the contact',
);
await action(
  { action: 'contact-update', id: c2.id, name: 'Invalid list', phone: c2.phone, lists: [42] },
  400,
);
check(
  (await state()).contacts.find((c) => c.id === c2.id).name === 'Updated contact',
  'invalid lists are rejected without changing the contact',
);
await action({ action: 'consent', id: c2.id, consent: true, source: 'Test evidence' });
await action({
  action: 'contact-update',
  id: c2.id,
  name: 'New number',
  phone: '1999' + seed.slice(-8),
  lists: [],
});
edited = (await state()).contacts.find((c) => c.id === c2.id);
check(
  !edited.consent && !edited.source,
  'changing a phone never transfers consent evidence to a different number',
);

await action({
  action: 'conversation',
  accountId: account.id,
  contactId: c1.id,
  status: 'progress',
  starred: true,
  tags: ['Customer', 'Priority', 'Customer'],
  read: true,
});
let conversationMeta = (await state()).conversations[account.id + ':' + c1.id];
check(
  conversationMeta.status === 'progress' &&
    conversationMeta.starred &&
    conversationMeta.tags.length === 2 &&
    Date.parse(conversationMeta.readAt) > 0,
  'conversation status, star, tags, and read state persist',
);
await action({ action: 'conversation', accountId: a2.id, contactId: c1.id, status: 'resolved' });
check(
  (await state()).conversations[account.id + ':' + c1.id].status === 'progress',
  'conversation state is isolated by WhatsApp account',
);
await action(
  {
    action: 'conversation',
    accountId: account.id,
    contactId: c1.id,
    status: 'invalid',
    starred: false,
  },
  400,
);
check(
  (await state()).conversations[account.id + ':' + c1.id].starred,
  'invalid conversation updates leave saved metadata unchanged',
);
await action({ action: 'conversation', accountId: account.id, contactId: c1.id, tags: [42] }, 400);
await action({ action: 'conversation', accountId: account.id, contactId: c1.id, read: false });
check(
  (await state()).conversations[account.id + ':' + c1.id].readAt === '1970-01-01T00:00:00.000Z',
  'marking unread resets only the read marker',
);

await action({ action: 'account-update', id: a2.id, enabled: false });
await action({ action: 'settings', botEnabled: true, greeting: 'Disabled account greeting' });
const beforeInactive = (await state()).messages.filter(
  (m) => m.accountId === a2.id && m.direction === 'out',
).length;
await action({
  action: 'simulate-inbound',
  accountId: a2.id,
  contactId: c2.id,
  text: 'Test inbound on inactive account',
});
check(
  (await state()).messages.filter((m) => m.accountId === a2.id && m.direction === 'out').length ===
    beforeInactive,
  'inactive accounts receive messages without sending automatic greetings',
);
await action({ action: 'reply', accountId: a2.id, contactId: c2.id, text: 'Must not send' }, 400);
check(true, 'inactive accounts reject manual replies');
await action({ action: 'account-update', id: a2.id, enabled: true });
const originalSimulation = (await state()).simulation;
await action({
  action: 'workspace-settings',
  name: 'Integration workspace',
  timeZone: 'America/Sao_Paulo',
  language: 'pt-BR',
  keepCampaignLogs: false,
  notifyActivity: false,
});
const workspacePrefs = (await state()).workspace;
check(
  workspacePrefs.name === 'Integration workspace' &&
    workspacePrefs.timeZone === 'America/Sao_Paulo' &&
    workspacePrefs.language === 'pt-BR' &&
    !workspacePrefs.keepCampaignLogs &&
    !workspacePrefs.notifyActivity,
  'workspace preferences persist including locale, zone, logs, and notification choice',
);
await action(
  {
    action: 'workspace-settings',
    name: 'Invalid zone',
    timeZone: 'Invalid/Zone',
    language: 'pt-BR',
    keepCampaignLogs: true,
    notifyActivity: true,
  },
  400,
);
check(
  (await state()).workspace.name === 'Integration workspace',
  'invalid time zones cannot partially overwrite workspace settings',
);
check(
  (await state()).simulation === originalSimulation,
  'workspace settings cannot switch the server sending mode',
);
const { reportData } = await import('../lib/reports-data.ts');
const reportNow = new Date('2026-11-13T15:00:00Z');
const reportMessage = (id, status, createdAt, simulated = false, direction = 'out') => ({
  id,
  status,
  createdAt,
  simulated,
  direction,
  campaignId: 'report-campaign',
  accountId: 'report-account',
  contactId: 'report-contact',
  text: id,
});
const reportFixture = {
  messages: [
    reportMessage('read', 'read', '2026-11-13T12:00:00Z'),
    reportMessage('delivered', 'delivered', '2026-11-12T12:00:00Z'),
    reportMessage('accepted', 'accepted', '2026-11-07T12:00:00Z'),
    reportMessage('boundary', 'sent', '2026-11-07T01:00:00Z'),
    reportMessage('failed', 'failed', '2026-11-13T12:00:00Z'),
    reportMessage('previous', 'sent', '2026-11-06T12:00:00Z'),
    reportMessage('simulation', 'simulated', '2026-11-13T12:00:00Z', true),
    reportMessage('future', 'accepted', '2026-11-14T12:00:00Z'),
    reportMessage('inbound', 'received', '2026-11-13T12:00:00Z', false, 'in'),
  ],
  campaigns: [{ id: 'report-campaign', createdAt: '2026-11-01T12:00:00Z' }],
};
const utcReport = reportData(reportFixture, false, 7, 'UTC', reportNow);
check(
  utcReport.summary.sent === 4 &&
    utcReport.summary.delivered === 2 &&
    utcReport.summary.read === 1 &&
    utcReport.summary.failed === 1 &&
    utcReport.summary.failureRate === 20,
  'report totals count read as delivered and sent while excluding failed and future sends',
);
check(
  utcReport.previous === 1 &&
    utcReport.change === 300 &&
    utcReport.chart.length === 7 &&
    utcReport.chart.reduce((sum, day) => sum + day.sent, 0) === 4,
  'report comparison and chart share the same calendar-day range',
);
check(
  reportData(reportFixture, false, 7, 'America/Sao_Paulo', reportNow).summary.sent === 3 &&
    reportData(reportFixture, true, 7, 'UTC', reportNow).summary.sent === 1,
  'reports respect workspace time zone and isolate simulation records',
);
check(
  utcReport.campaigns[0].sent === 4 && utcReport.campaigns[0].failed === 1,
  'campaign performance matches filtered report messages',
);
const { greetingText } = await import('../lib/greeting-text.ts');
check(
  greetingText('Olá {{nome}}, {{empresa}} / {{name}} / {{business}}', 'Ana', 'Business') ===
    'Olá Ana, Business / Ana / Business',
  'automatic greeting variables work in Portuguese and English',
);
check(
  greetingText('{{unknown}} {{name}}', 'A $& B', 'Business') === '{{unknown}} A $& B',
  'unknown greeting variables stay literal and customer names are inserted safely',
);
await action({
  action: 'settings',
  botEnabled: true,
  greeting: 'Hello {{name}} from {{business}}',
});
await action({
  action: 'simulate-inbound',
  accountId: a2.id,
  contactId: c2.id,
  text: 'Personalized greeting test',
});
check(
  (await state()).messages
    .filter((m) => m.accountId === a2.id && m.contactId === c2.id && m.direction === 'out')
    .at(-1).text === 'Hello New number from Integration workspace',
  'saved greeting variables personalize actual simulated replies',
);
async function outreachAction(body, expected = 200) {
  const response = await fetch(base + '/api/outreach', {
    method: 'POST',
    headers: { Cookie: auth, Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, expected, await response.clone().text());
  return response.json();
}
async function outreachState() {
  const response = await fetch(base + '/api/outreach', { headers: { Cookie: auth } });
  assert.equal(response.status, 200);
  return response.json();
}
async function awaitOutreach(predicate) {
  for (let i = 0; i < 80; i++) {
    const value = await outreachState();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw Error('Outreach worker did not reach expected state.');
}
check(
  (await fetch(base + '/api/outreach')).status === 401,
  'QR connections require a signed-in session',
);
check(
  (
    await fetch(base + '/api/outreach', {
      method: 'POST',
      headers: { Cookie: auth, Origin: 'https://evil.example', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'worker-start' }),
    })
  ).status === 403,
  'outreach writes reject cross-origin requests',
);
const webPhone = '1888' + seed.slice(-8);
await action({
  action: 'contacts',
  rows: [{ name: 'Web recipient', phone: webPhone, consent: true, source: 'Test permission' }],
});
const webContact = (await state()).contacts.find((c) => c.phone === webPhone);
const createdWeb = await outreachAction({
  action: 'session-create',
  name: 'QR test connection',
  dailyLimit: 1,
  testOnly: true,
});
const webId = createdWeb.result.id;
check(
  !(await state()).accounts.some((a) => a.id === webId),
  'QR sessions are stored separately from official API accounts',
);
await outreachAction({ action: 'session-connect', id: webId });
await awaitOutreach(
  (s) => s.workerLive && s.sessions.some((s) => s.id === webId && s.status === 'ready'),
);
const officialBefore = await state();
await outreachAction(
  {
    action: 'run-create',
    name: 'Reject API sender',
    message: 'Hello',
    delay: 5,
    senderIds: [account.id],
    contactIds: [webContact.id],
    saveContacts: true,
    syncToPhone: false,
  },
  400,
);
const createdRun = await outreachAction({
  action: 'run-create',
  name: 'Independent robot queue',
  message: 'Hello {{name}}',
  delay: 5,
  senderIds: [webId],
  contactIds: [webContact.id],
  saveContacts: true,
  syncToPhone: false,
});
const webRun = createdRun.result.id;
await outreachAction({ action: 'run-status', id: webRun, status: 'running' });
const webSent = await awaitOutreach((s) =>
  s.tasks.some((j) => j.runId === webRun && j.status === 'sent'),
);
check(
  webSent.messages.some(
    (m) => m.outreachId === webRun && m.text === 'Hello Web recipient' && m.simulated,
  ),
  'QR robot sends personalized text without Meta templates in its own simulated queue',
);
await outreachAction({ action: 'run-delete', id: webRun });
check(!(await outreachState()).runs.some((r) => r.id === webRun), 'deleted queue is hidden');
await outreachAction({ action: 'run-status', id: webRun, status: 'running' }, 400);
await outreachAction({ action: 'run-restore', id: webRun });
check((await outreachState()).tasks.some((j) => j.runId === webRun && j.status === 'sent'), 'undo restores delivery history');
const officialAfter = await state();
check(
  officialAfter.campaigns.length === officialBefore.campaigns.length &&
    officialAfter.jobs.length === officialBefore.jobs.length &&
    officialAfter.messages.length === officialBefore.messages.length,
  'outreach processing never creates campaign jobs or official API messages',
);
check(
  !webSent.tasks.find((j) => j.runId === webRun).savedContact,
  'simulation never claims an external address-book change',
);
await outreachAction({ action: 'session-disconnect', id: webId });
check(
  !(await outreachState()).sessions.find((s) => s.id === webId).desiredConnected,
  'disconnect stops the QR session independently',
);
await action({ action: 'campaign', mode: 'sequential' }, 400);
check(true, 'legacy sequential creation no longer duplicates bulk campaigns');
await action({ action: 'contacts-remove', ids: [c1.id, 'missing-contact'] }, 400);
check((await state()).contacts.some(c => c.id === c1.id), 'invalid bulk removal leaves contacts unchanged');
await action({ action: 'contacts-remove', ids: [c1.id, webContact.id] });
const afterContactRemoval = await state();
check(!afterContactRemoval.contacts.some(c => [c1.id, webContact.id].includes(c.id)), 'bulk removal hides selected contacts');
await action({ action: 'contacts-restore', ids: [c1.id, webContact.id] });
check((await state()).contacts.filter(c => [c1.id, webContact.id].includes(c.id)).every(c => !c.consent), 'contact undo does not restore sending permission');
const csrfLogout = await fetch(base + '/api/auth/logout', {
  method: 'POST',
  headers: { Cookie: auth, Origin: 'https://evil.example' },
});
check(csrfLogout.status === 403, 'cross-origin logout rejected');
check(
  (await fetch(base + '/api/manage', { headers: { Cookie: auth } })).status === 200,
  'rejected logout leaves session valid',
);
const loggedOut = await fetch(base + '/api/auth/logout', {
  method: 'POST',
  headers: { Cookie: auth, Origin: base },
});
check(
  loggedOut.status === 200 && loggedOut.headers.get('set-cookie').includes('Max-Age=0'),
  'logout clears browser cookie',
);
check(
  (await fetch(base + '/api/manage', { headers: { Cookie: auth } })).status === 401,
  'logout revokes the old token on the server',
);
check(
  (await fetch(base, { headers: { Cookie: auth }, redirect: 'manual' })).status === 307,
  'logged-out visitor must sign in again',
);
const second = await login({ username: 'admin', password });
auth = second.headers.get('set-cookie').split(';')[0];
check(second.status === 200, 'user can sign in again after logout');
const { DatabaseSync } = await import('node:sqlite');
const { default: path } = await import('node:path');
const database = new DatabaseSync(path.join(process.env.DATA_DIR, 'auth.sqlite'));
database.prepare('UPDATE sessions SET expires_at=0').run();
database.close();
check(
  (await fetch(base + '/api/manage', { headers: { Cookie: auth } })).status === 401,
  'expired server session rejected',
);
for (let i = 0; i < 10; i++) await login({ username: 'admin', password: 'incorrect' });
check(
  (await login({ username: 'admin', password })).status === 429,
  'repeated login failures temporarily rate limited',
);
console.log('\n' + checks + ' integration checks passed.');
