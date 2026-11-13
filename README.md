# WhatsBot Pro

Portuguese WhatsApp operations app built from the client conversation: persistent contacts, campaign queues, individual outreach sequences, inbox, automatic greeting, official Cloud API adapter, signed webhooks, and CSV reports. Defaults to **simulation**, which never sends WhatsApp messages.

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

The workspace uses the same emerald design as the login page: grouped navigation, responsive cards, message activity charts, a conversation inbox, live greeting preview, and consistent dialogs and controls. Overview, Contacts, Campaigns, Outreach bot, Inbox, WhatsApp accounts, Customer service, Reports, and Settings share this styling. Charts use stored message activity; no sample totals are inserted into the workspace.

Use the **English / Português** selector in the top bar. The app uses the browser language on the first visit and remembers your selection on that browser. Navigation, forms, statuses, application notifications/errors, operation history, dates, numbers, and CSV column names follow the selection. Both English and Portuguese CSV headers can be imported in either interface language. Changing the interface language does not translate or modify customer messages, campaign content, saved greetings, account names, or approved template language codes.

## Login and logout

Unauthenticated visits go to `/login`, available in English and Portuguese. Use username **admin** and ADMIN_PASSWORD from `.env.local`. The browser's native Basic Authentication popup is no longer used. The **Log out / Sair** button in the dashboard header revokes the server session and returns to the login page; remembered Basic credentials cannot bypass it.

Sessions expire after 12 hours and use opaque random tokens in HttpOnly, SameSite=Lax cookies. Only token hashes are stored in `data/auth.sqlite` (or DATA_DIR). Cookies use Secure when APP_URL is HTTPS; HTTP loopback development remains supported. Ten failed login attempts temporarily block administrator login for five minutes. This is a single-administrator limit. Both login and logout reject cross-origin writes. Changing ADMIN_PASSWORD and restarting invalidates existing sessions. ADMIN_PASSWORD is required in development and production. Login does not stop the independent campaign worker, and logging out leaves running campaigns active.

The login page follows the supplied emerald/white design, with responsive layouts and bilingual HTML text. Remember me retains the session cookie for 12 hours; unchecking it uses a browser-session cookie (still limited to 12 hours on the server). Social login is not displayed; recovery and contact actions provide administrator guidance. See [login design notes](docs/login-design.md) for artwork provenance and implementation scope.

## Test the workflow

1. **Contas WhatsApp**: click **Add account**, enter a name, optionally add a phone number as a label, and click **Create test account**. Simulation generates test identifiers and supplies `hello_world` / `en_US` automatically; no Meta IDs or token are needed. This does not connect a real number. Test-only accounts cannot be used for live sending.
2. **Contatos**: add a contact or download the CSV example. CSV supports comma/semicolon delimiters, quoted fields, and BOM. Include international phone numbers with country codes. Duplicate numbers are ignored and invalid numbers reported. Maximum 2 MB / 10,000 rows per import; XLSX is not supported.
3. Record recipient consent and its source/date. A missing source leaves the contact ineligible. Reimporting a number never restores an unsubscribe.
4. **Campanhas** creates a bulk campaign; **Robô de envio** creates a one-by-one sequence. Choose an explicit sender account, approved template, recipients, and interval. Text body parameters go one per line; `{{nome}}` personalizes the name. Media, header, and button template parameters are not included in this version.
5. Review and start the draft. Keep the worker running. Pause/resume controls affect pending sends; an already reserved send may finish. Simulated messages never appear as real deliveries.
6. **Conversas**: select a contact/account and simulate an inbound message. Reply within its service window. Use SAIR to test suppression. **Atendimento** enables a first-message greeting, not an AI sales agent.
7. **Relatórios** exports messages. **Configurações** includes the operation history.

The app stores contacts in its database; it does not modify a phone's address book, scrape business directories, extract phone numbers from screenshots, or control personal WhatsApp Web sessions. The tiny embedded screenshots in the chat do not establish a reliable extraction workflow. Neither workflow rotates accounts to evade restrictions or supports unsolicited spam.

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

SQLite is stored in `data/whatsbot.sqlite`, overridable with DATA_DIR. Transactions reserve work before the external send. Concurrent worker requests cannot reserve the same job. The queue enforces an interval shared by campaigns on each account and a rolling 24-hour local ceiling. Permission is checked again immediately before dispatch. Manual service replies and greetings require a recent inbound message on that account.

The inbox distinguishes API acceptance from sent/delivered/read webhook statuses. Signed inbound IDs are deduplicated. SAIR, PARAR, STOP, and CANCELAR suppress outbound messages. An inbound inquiry alone never grants consent for campaigns.

Failures pause the campaign without automatic retries. A timeout may mean Meta accepted a message without returning its ID. If the process stops after reservation, the job remains `processing` and blocks the account queue: verify the provider outcome before an operator reconciles the database. The UI flags uncertain jobs; a reconciliation UI is not included. Interrupted manual/greeting sends can likewise need review. Do not blindly recreate campaigns after a timeout.

Webhooks persist inbound events before responding but await greeting delivery; move greetings to a separate durable reply queue for larger webhook volume. This pilot stores state in one transactional JSON row and returns the full dataset to the operator. Before sustained high-volume or multi-operator use, add normalized tables, paginated APIs, a dedicated queue, per-user access control, and retention rules. Real Meta delivery and a 5,000-recipient load test remain unverified without client credentials.

Back up with SQLite's online backup API, or stop both processes before copying the databases. Do not copy only the `.sqlite` files during WAL writes. Both the application database and auth.sqlite use WAL. Protect backups because contacts and conversations contain personal data.

## Verification

```powershell
npm run typecheck
npm run build
npm test
```

The integration suite starts a local production server on port 3102 (override TEST_PORT), uses a fresh temporary SQLite directory, and forces simulation. It checks authentication, origin protection, imports, consent, concurrent reservation, personalization, service windows, signed and duplicate webhooks, greetings, opt-outs, queue completion, and send ceilings. It never modifies the normal app database. Temporary databases remain in the OS temp directory for inspection.
