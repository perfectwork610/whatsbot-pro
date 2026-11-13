# WhatsBot Pro

Portuguese WhatsApp operations app built from the client conversation: persistent contacts, campaign queues, individual outreach sequences, inbox, manual replies, official Cloud API adapter, signed webhooks, and CSV reports. Defaults to **simulation**, which never sends WhatsApp messages.

## Start

Requires **Node.js 24.15+** for built-in `node:sqlite`.

```powershell
npm install
npm run setup
npm run dev
```

Open http://localhost:3000. Sign in as **admin** using **ADMIN_PASSWORD** from the generated `.env.local`. In a second terminal run:

```powershell
npm run worker
```

The worker operates independently of the browser. Set APP_URL to the exact browser origin if changing hostname or port, without a trailing slash. Restart both processes after environment changes. Setup preserves existing `.env.local` files. Webpack is selected because Turbopack's CSS subprocess failed in the original Windows environment.

## Interface languages

The workspace uses the same emerald design as the login page: grouped navigation, responsive cards, message activity charts, a conversation inbox, and consistent dialogs and controls. Overview, Contacts, Campaigns, Outreach bot, Inbox, WhatsApp accounts, Reports, and Settings share this styling. Charts use stored message activity; no sample totals are inserted into the workspace.

Use the **English / Português** selector in the top bar. The app uses the browser language on the first visit and remembers your selection on that browser. Navigation, forms, statuses, application notifications/errors, operation history, dates, numbers, and CSV column names follow the selection. Both English and Portuguese CSV headers can be imported in either interface language. Changing the interface language does not translate or modify customer messages, campaign content, account names, or approved template language codes.

## Login and logout

Unauthenticated visits go to `/login`, available in English and Portuguese. Use username **admin** and ADMIN_PASSWORD from `.env.local`. The browser's native Basic Authentication popup is no longer used. The **Log out / Sair** button in the dashboard header revokes the server session and returns to the login page; remembered Basic credentials cannot bypass it.

Sessions expire after 12 hours and use opaque random tokens in HttpOnly, SameSite=Lax cookies. Only token hashes are stored in `data/auth.sqlite` (or DATA_DIR). Cookies use Secure when APP_URL is HTTPS; HTTP loopback development remains supported. Ten failed login attempts temporarily block administrator login for five minutes. This is a single-administrator limit. Both login and logout reject cross-origin writes. Changing ADMIN_PASSWORD and restarting invalidates existing sessions. ADMIN_PASSWORD is required in development and production. Login does not stop the independent campaign worker, and logging out leaves running campaigns active.

The login page follows the supplied emerald/white design, with responsive layouts and bilingual HTML text. Remember me retains the session cookie for 12 hours; unchecking it uses a browser-session cookie (still limited to 12 hours on the server). Social login is not displayed; recovery and contact actions provide administrator guidance. See [login design notes](docs/login-design.md) for artwork provenance and implementation scope.

## Test the workflow

1. **Contas WhatsApp**: click **Add account**, enter a name, optionally add a phone number as a label, and click **Create test account**. Simulation generates test identifiers and supplies `hello_world` / `en_US` automatically; no Meta IDs or token are needed. This does not connect a real number. Test-only accounts cannot be used for live sending.
2. **Contatos → Import list**: upload CSV or TXT, or paste a list. A phone-only file with one international number per line is accepted without a header, name, consent, or source. The first number is preserved. Names default to the normalized phone number; missing consent is left pending. Existing English/Portuguese CSV headers and optional name/consent/source columns still work, including quoted fields, semicolon delimiters, and UTF-8 BOM. Duplicate numbers are ignored and invalid entries reported. Maximum 2 MB / 100,000 rows per file; large files are sent in batches of up to 5,000 records, with progress and aggregated totals. Interrupted imports retain completed batches and can be retried without duplicating contacts or restoring opt-outs. XLSX is not supported.
3. Record recipient consent and its source/date. A missing source leaves the contact ineligible. Reimporting a number never restores an unsubscribe.
4. **Campanhas** creates an official-API bulk campaign. Choose an explicit API sender account, approved template, recipients, and interval. **Robô de envio** is now a separate WhatsApp Web workflow: connect numbers by QR, import contacts, write plain text, and process a separate one-by-one queue. Text body parameters go one per line; `{{nome}}` personalizes the name. Media, header, and button template parameters are not included in this version.
5. Review and start the draft. Keep the worker running. Pause/resume controls affect pending sends; an already reserved send may finish. Simulated messages never appear as real deliveries.
6. **Conversas**: select a contact/account and simulate an inbound message. Reply within its service window. Use SAIR to test suppression.
7. **Relatórios** exports messages. **Configurações** includes the operation history.

Contacts are stored in the shared database. The QR robot can additionally save a contact in the linked WhatsApp address book before sending, with an explicit option to sync to the phone address book. This depends on the linked WhatsApp Web client supporting that operation; a save failure pauses the queue before sending. The app does not scrape business directories or extract phone numbers from screenshots. Both workflows require recorded permission and honor opt-outs. Each robot recipient is assigned a fixed sender; hitting a local ceiling does not switch the recipient to another number.

## Connect real accounts

Account verification, approved templates, billing, sending eligibility, and actual daily limits are controlled by Meta. Software cannot provide verified accounts or guarantee 3,000–5,000 daily sends.

1. The account owner configures a Meta business portfolio, WhatsApp Business Account (WABA), app, registered number, and access token with WhatsApp permissions.
2. Set META_GRAPH_VERSION to the active version supported by the Meta app. Set WA_TOKEN_PRIMARY to the actual token in `.env.local`. Use additional WA_TOKEN_SALES, etc., for other authorized numbers. Never put actual tokens in the account form or NEXT_PUBLIC_ variables.
3. Configure META_APP_SECRET and a long random META_VERIFY_TOKEN. Expose the app over HTTPS. Set the Meta callback to `https://your-domain/api/webhook` and subscribe to message events. GET verifies the challenge token; POST requires the signed original body.
4. Set APP_URL to `https://your-domain`, WHATSAPP_MODE to `live`, and restart the server and worker.
5. Add real account IDs and **Sincronizar modelos**. This retrieves the first 100 templates; pagination beyond 100 and template creation are not included. Campaigns require APPROVED templates.

   **Phone Number ID is not your actual phone number.** Use the numeric identifier from WhatsApp → API Setup in the Meta app, along with the WhatsApp Business Account ID (WABA ID). Entering a number such as `+5511999999999` into Phone Number ID is invalid; removing the `+` does not turn a telephone number into a Meta API identifier.
6. Test one authorized recipient and verify replies/delivery events before broader use. Configure a conservative local ceiling within the actual Meta allowance. This version does not automatically retrieve Meta account quality or messaging-limit eligibility.

Official references: [Meta Cloud API examples](https://github.com/fbsamples/whatsapp-api-examples), [Meta webhook signature example](https://github.com/fbsamples/whatsapp-api-examples/tree/main/signature-validation-with-webhooks-payloads), [Cloud API documentation](https://developers.facebook.com/docs/whatsapp/cloud-api/).

## Production and data

```powershell
npm run build
npm run start
# Separate supervised process:
npm run worker
```

Deploy as a **single persistent Node.js instance** with durable local disk, an HTTPS reverse proxy, and a process supervisor. This is a single-operator pilot, not a multi-tenant SaaS. Server-side sessions protect the dashboard and management API; ADMIN_PASSWORD must be configured. Use HTTPS and set APP_URL to the public HTTPS origin. Worker requests require a separate WORKER_SECRET. Webhook authentication uses the Meta app secret. Management writes validate the browser origin. Do not expose development mode publicly.

SQLite is stored in `data/whatsbot.sqlite`, overridable with DATA_DIR. Transactions reserve work before the external send. Concurrent worker requests cannot reserve the same job. The queue enforces an interval shared by campaigns on each account and a rolling 24-hour local ceiling. Permission is checked again immediately before dispatch. Manual replies require a recent inbound message on that account.

The inbox distinguishes API acceptance from sent/delivered/read webhook statuses. Signed inbound IDs are deduplicated. SAIR, PARAR, STOP, and CANCELAR suppress outbound messages. An inbound inquiry alone never grants consent for campaigns.

Failures pause the campaign without automatic retries. A timeout may mean Meta accepted a message without returning its ID. If the process stops after reservation, the job remains `processing` and blocks the account queue: verify the provider outcome before an operator reconciles the database. The UI flags uncertain jobs; a reconciliation UI is not included. Interrupted manual sends can likewise need review. Do not blindly recreate campaigns after a timeout.

Webhooks persist inbound messages and delivery updates without sending automatic replies. This pilot stores state in one transactional JSON row and returns the full dataset to the operator. Before sustained high-volume or multi-operator use, add normalized tables, paginated APIs, a dedicated queue, per-user access control, and retention rules. Real Meta delivery and a 5,000-recipient load test remain unverified without client credentials.

Back up with SQLite's online backup API, or stop both processes before copying the databases. Do not copy only the `.sqlite` files during WAL writes. Both the application database and auth.sqlite use WAL. Protect backups because contacts and conversations contain personal data.

## Verification

```powershell
npm run typecheck
npm run build
npm test
```

The integration suite starts a local production server on port 3102 (override TEST_PORT), uses a fresh temporary SQLite directory, and forces simulation. It checks authentication, origin protection, imports, consent, concurrent reservation, personalization, service windows, signed and duplicate webhooks, absence of automatic replies, opt-outs, queue completion, and send ceilings. It never modifies the normal app database. Temporary databases remain in the OS temp directory for inspection.

## Individual outreach robot — WhatsApp Web / QR

This is independent of official-API bulk campaigns. It uses whatsapp-web.js with one persistent browser profile per linked number. No Meta template is needed for the QR workflow. It supports up to 20 configured connections, per-connection limits, a delay between contacts, contact saving, personalized plain text ({{name}}/{{nome}}, {{business}}/{{empresa}}), pause/resume, and incoming reply/opt-out records.

1. Open **Outreach bot → QR connections → Link WhatsApp by QR**. Name the connection and set its local 24-hour ceiling.
2. Click **Connect**. This starts the dedicated robot worker when necessary. Scan the QR in WhatsApp → Linked devices → Link a device. Credentials stay in DATA_DIR/outreach-auth, never in public assets. QR codes expire and are shown only to authenticated administrators.
3. Import contacts through the existing CSV/TXT importer and record permission in Contacts. Create a **New outreach queue**, select linked sender numbers and authorized contacts, enter text, and set the delay. Review before pressing Start.
4. **Save contact in WhatsApp** is explicit; syncing to the phone address book is a separate opt-in. Simulation skips both external contact saving and actual sends. Live sending requires server WHATSAPP_MODE=live. QR linking itself can be tested while sending remains simulated.
5. **View contacts and replies** shows statuses, saved-contact evidence, errors, and recent replies. Failed or uncertain sends pause the queue. Uncertain deliveries never retry automatically: verify the actual conversation, then skip the item after review.

The worker can also be supervised explicitly with **npm run outreach:worker**. Only one worker lease may own the robot queue. Official bulk campaigns continue to use **npm run worker**; the workers and queues do not process each other's jobs. The robot supports auto-start from a Connect action on a persistent Node installation with the full project available. For supervised deployments, start the worker yourself and set OUTREACH_DISABLE_AUTOSTART=true.

Install a current system Chrome/Chromium/Edge browser, or set PUPPETEER_EXECUTABLE_PATH to its executable. Puppeteer Chromium download is skipped in this workspace because system Chrome/Edge is already installed. Run the browser as an unprivileged user with its sandbox enabled. Keep DATA_DIR durable and private; serverless/ephemeral hosting cannot preserve linked sessions. Pairing and address-book support depend on WhatsApp Web, and real-phone sending needs a linked device; automated tests use isolated simulation and injected senders.

Existing sequential API records migrate into read-only robot history. A complete pre-migration JSON backup is saved under DATA_DIR/backups. Completed sends stay completed, active sequences are paused, and in-flight deliveries become needs-review. Original messages/provider IDs are preserved. Legacy API sequences are not silently converted into QR/plain-text sends; create and review a new QR queue explicitly.

Tests: npm run test:outreach covers migration idempotency, independent reservations, timing, per-session ceilings, opt-outs, contact-save order, dry-run isolation, and uncertain delivery. npm test includes authenticated QR/session endpoints and full simulated robot processing alongside existing API workflows.

Connector references: [Client API](https://docs.wwebjs.dev/Client.html), [LocalAuth and multiple sessions](https://wwebjs.dev/guide/creating-your-bot/authentication.html).
