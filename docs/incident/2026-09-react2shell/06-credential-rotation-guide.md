# Credential rotation guide — one card per credential

How to hand a new value over: **never** paste it into chat, a commit, a `.env` in the repo, or a
ticket. Put it directly into the right Secrets Manager entry in the AWS console:

> AWS Console → Secrets Manager (ap-south-1) → `metnmat/<app>/env` → **Retrieve secret value** →
> **Edit** → find the key (currently `SET_ME`) → paste the new value → **Save**.

Then tell me only the **secret name and key name** (e.g. "`metnmat/cms/env` → `MONGODB_URI` is set").
I restart the affected unit (`systemctl restart metnmat-<app>`, which re-reads the secret) and run
the safe check listed on the card. I never print the value.

Live status table: `07-credential-checklist.md`.

---

## MongoDB Atlas — three new database users  ← **NEEDED FIRST** (unblocks CMS, chatbot, Command Center)

- **Why:** the old URIs (users for `metnmat_cms`, `metnmat`, and the Command Center DB) were in the
  leaked process environment and were read directly through the instance role.
- **Where:** cloud.mongodb.com → project → **Database Access** and **Network Access**.
- **What to click:**
  1. Database Access → **Add New Database User** → Password auth → name e.g. `cms-prod-2026`,
     autogenerate password → Built-in role **readWrite** restricted to database `metnmat_cms` →
     *Restrict Access to Specific Clusters* → Add User. Repeat for `chat-prod-2026` (db `metnmat`)
     and `cc-prod-2026` (the Command Center's own database).
  2. Network Access → **Add IP Address** → `52.66.54.7/32` (the new host) → Confirm.
     **Delete** the entry for `15.206.25.71`.
  3. Database Access → **Delete** the three old users.
  4. Clusters → Connect → Drivers → copy the `mongodb+srv://` URI, substitute the new user/password,
     and make sure the path is `/metnmat_cms` for the CMS and `/metnmat` for the chatbot
     (**never** point the CMS at `/metnmat` — CLAUDE.md gotcha 1).
- **New value:** three connection strings.
- **Used by:** CMS (`metnmat/cms/env` → `MONGODB_URI`), chatbot (`metnmat/chat/env` → `MONGODB_URI`),
  Command Center (`metnmat/cc/env` → `DATABASE_URL`).
- **Verify:** unit starts; CMS `GET /api/health` and `GET /api/products?limit=1&depth=1` → 200 on
  loopback; chatbot boots and logs a Mongo connection; Command Center `/login` → 200 and
  `[instrumentation] index ensure` no longer errors.
- **After:** old users deleted, old IP removed → **revoked**. Also check Atlas → Project → Activity
  Feed / Database Access History for logins from any IP other than 15.206.25.71 since 2026-08-13.

## OpenAI

- **Why:** `OPENAI_API_KEY` was **read by the attacker** via the instance role (CloudTrail 2026-09-15).
- **Where:** platform.openai.com → Settings → **API keys**.
- **What to click:** identify the old key (created before Aug 2026) → **Revoke**. **Create new secret
  key** → name `metnmat-chatbot-prod-2026` → project-scoped if you use projects → copy.
  Then **Usage** → check for spend after 2026-08-22 you don't recognise.
- **New value:** `sk-…` key. **Used by:** chatbot (`metnmat/chat/env` → `OPENAI_API_KEY`).
- **Verify:** chatbot unit starts; a widget message gets an answer.
- **After:** old key revoked → new active.

## Pinecone

- **Why:** `PINECONE_API_KEY` read by the attacker via the instance role.
- **Where:** app.pinecone.io → project → **API Keys**.
- **What to click:** **Create API key** → name `metnmat-chatbot-2026` → copy; then delete the old key.
  Note the **index name** and **namespace** you use (they go in too).
- **New value:** API key (+ index name, namespace). **Used by:** chatbot (`PINECONE_API_KEY`,
  `PINECONE_INDEX_NAME`, `PINECONE_NAMESPACE`).
- **Verify:** chatbot logs a successful index describe; a product question returns retrieved context.

## Supabase (Command Center)  ← **highest-impact third-party key**

- **Why:** `SUPABASE_SERVICE_ROLE_KEY` was in the leaked `.env`. The service-role key bypasses
  row-level security entirely.
- **Where:** supabase.com → project → **Project Settings → API**.
- **What to click:** under *JWT Settings* → **Generate a new JWT secret** (this invalidates BOTH the
  anon and service-role keys at once; any other client using them must be updated) → confirm →
  copy the new **anon** and **service_role** keys from the same page. Then **Logs → API** and look
  for requests after 2026-08-28 from unfamiliar IPs.
- **New value:** anon key, service-role key (URL unchanged). **Used by:** Command Center
  (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`).
- **Verify:** Command Center media/thumbnail pages load; server log shows no 401 from Supabase.
- **After:** rotating the JWT secret is the revocation.

## Gmail OAuth (two mailboxes: operations + enquiry)

- **Why:** `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `ENQUIRY_GMAIL_REFRESH_TOKEN` leaked. A
  refresh token is a standing login to the mailbox.
- **Where (revoke access):** myaccount.google.com → **Security → Third-party apps & services** (for
  EACH of the two Google accounts) → find the METNMAT dashboard app → **Remove access**.
- **Where (new client secret):** console.cloud.google.com → APIs & Services → **Credentials** → the
  OAuth 2.0 Client used by the dashboard → **Add secret** → then **Disable/Delete** the old secret.
- **New tokens:** after the secret is in `metnmat/cc/env`, run the dashboard's own helpers once
  (`npm run gmail:token:operations` / `gmail:token:enquiry` — they print the refresh token to your
  terminal only; paste it straight into the secret).
- **New value:** client secret + two refresh tokens. **Used by:** Command Center (`GMAIL_CLIENT_ID`,
  `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`, `ENQUIRY_GMAIL_REFRESH_TOKEN`).
- **Verify:** Command Center → Settings → Integrations shows Gmail connected; a test sync pulls mail.
- **After:** old access removed + old secret disabled → revoked.

## Zoho Books

- **Why:** `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` leaked (standing access to invoices/customers).
- **Where:** api-console.zoho.com → the Self Client / app → **Client Secret → Regenerate**; then
  accounts.zoho.com → **Security → Connected Apps** → revoke the old grant.
- **What to click:** regenerate secret → re-run the authorisation flow to get a **new refresh token**
  (Self Client → Generate Code with scope `ZohoBooks.fullaccess.all` → exchange via the dashboard's
  documented flow).
- **New value:** client secret + refresh token. **Used by:** Command Center (`ZOHO_CLIENT_SECRET`,
  `ZOHO_REFRESH_TOKEN`; `ZOHO_CLIENT_ID`/org ids unchanged).
- **Verify:** `npm run zoho:orgs` lists your organisation (safe read-only call), or Sync Center shows
  a green Zoho status.
- **After:** old grant revoked → new active.

## Amazon Selling Partner API

- **Why:** `AMAZON_SP_API_CLIENT_SECRET`, `AMAZON_SP_API_REFRESH_TOKEN` leaked (order + buyer PII access).
- **Where:** sellercentral.amazon.in → **Apps and Services → Develop Apps** → your app → **Edit App**
  → LWA credentials → **Rotate client secret**. Then **Authorize** again to obtain a fresh
  **refresh token** (this invalidates the old one).
- **Also:** Seller Central → Settings → **Login Settings / Account activity** for unfamiliar sessions.
- **New value:** client secret + refresh token. **Used by:** Command Center (`AMAZON_SP_API_CLIENT_SECRET`,
  `AMAZON_SP_API_REFRESH_TOKEN`; client id / seller id / marketplace ids unchanged).
- **Verify:** `npm run amazon:dry-run` (read-only) succeeds.

## Razorpay

- **Why:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` leaked.
- **Where:** dashboard.razorpay.com → **Account & Settings → API Keys** → **Regenerate Live Key**
  (choose "deactivate old key immediately"). Then **Webhooks** → edit the metnmat.com webhook → set a
  new secret → save.
- **New value:** key id, key secret, webhook secret. **Used by:** website (`metnmat/web/env`).
- **Verify:** website `/api/payments/...` order-create returns a Razorpay order id (test mode first if
  you have it); webhook signature check passes on a Razorpay test event.
- **After:** old key deactivated → revoked.

## Resend

- **Why:** `RESEND_API_KEY` leaked (can send mail as metnmat.com).
- **Where:** resend.com → **API Keys** → find old → **Delete**; **Create API Key** → *Sending access*
  only, restrict to domain `metnmat.com`.
- **New value:** `re_…` key. **Used by:** website and CMS (`RESEND_API_KEY` in both `metnmat/web/env`
  and `metnmat/cms/env`; also set `QUOTE_FROM_EMAIL`, `QUOTE_NOTIFY_EMAIL`, `EMAIL_FROM` addresses).
- **Verify:** submit a test enquiry on the site → notification mail arrives; Resend → Emails shows it.

## Google OAuth (website sign-in) + Google Maps + Google Site Verification

- **Why:** `GOOGLE_CLIENT_SECRET` (website login) and `GOOGLE_MAPS_GEOCODING_API_KEY` (Command
  Center) leaked.
- **Where:** console.cloud.google.com → **Credentials** → website OAuth client → **Add secret**,
  delete old. Maps: the API key → **Regenerate key**; set *Application restrictions* to the new
  server IP `52.66.54.7` (server-side geocoding) and *API restrictions* to Geocoding API only.
- **New value:** OAuth client secret; Maps key. **Used by:** website (`GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`), Command Center (`GOOGLE_MAPS_GEOCODING_API_KEY`).
- **Verify:** "Sign in with Google" on the site completes; a geocode call in the dashboard works.

## Upstash Redis

- **Why:** `UPSTASH_REDIS_REST_TOKEN` leaked (rate-limit store; attacker could read/poison it).
- **Where:** console.upstash.com → database → **REST API** → **Reset Token** (or **Rotate**).
- **New value:** REST token (URL unchanged). **Used by:** website (`UPSTASH_REDIS_REST_URL`,
  `UPSTASH_REDIS_REST_TOKEN`).
- **Verify:** website boots without rate-limit warnings; `INCR` test via the app's own health path.

## WhatsApp Cloud API (Meta) — used by both the chatbot and the Command Center

- **Why:** `WHATSAPP_TOKEN`/`Meta_WA_accessToken`, `WHATSAPP_APP_SECRET`, verify tokens leaked.
- **Where:** business.facebook.com → **Settings → Users → System users** → the system user →
  **Generate new token** (assets: the WABA; permissions `whatsapp_business_messaging`,
  `whatsapp_business_management`) → copy; **revoke** the old token. developers.facebook.com → app →
  **Settings → Basic → App Secret → Reset**. Webhook verify tokens are already regenerated by me
  (`WHATSAPP_WEBHOOK_VERIFY_TOKEN` in `metnmat/cc/env`); re-enter that value in the app's Webhooks
  config when re-subscribing.
- **New value:** system-user token, app secret. **Used by:** Command Center (`WHATSAPP_TOKEN`,
  `WHATSAPP_APP_SECRET`), chatbot (`Meta_WA_accessToken`, `META_APP_SECRET`).
- **Verify:** Graph API `GET /<phone-number-id>` with the new token returns the number (I run this
  read-only check from the host); webhook verification handshake succeeds.

## AI provider keys (Gemini, DeepSeek, Groq) and Open Exchange Rates

- **Why:** leaked in the Command Center `.env` / prod env.
- **Where:** aistudio.google.com → API keys; platform.deepseek.com → API keys; console.groq.com →
  API Keys; openexchangerates.org → App IDs. Delete old, create new; check each usage page.
- **Used by:** Command Center (`GEMINI_API_KEY`, `DEEPSEEK_API_KEY`), website + CMS
  (`OPEN_EXCHANGE_RATES_APP_ID`).
- **Verify:** dashboard AI reply preview works; website currency conversion shows a live rate.

## Google Cloud (Vertex AI, backup service account, GCS)

- **Why:** `BACKUP_OIDC_SERVICE_ACCOUNT` / WIF binding and project ids were in the `.env`.
- **Where:** console.cloud.google.com → IAM → Service Accounts → the backup SA → **Keys** (delete any
  user-managed key) and **Workload Identity** bindings → remove any binding to the old AWS role
  `metnmat-dashboard-role`; re-bind to `metnmat-prod-host-role` if backups must keep working.
- **Verify:** `npm run backup:local` dry-run succeeds from the dashboard.

## Director PIN and staff PINs (CMS)

- **Why:** `DIRECTOR_PIN` leaked; `PAYLOAD_PIN_PEPPER` was rotated by me, which **invalidates every
  staff PIN**.
- **What to do:** choose a new director PIN → put it in `metnmat/cms/env` → `DIRECTOR_PIN` (and
  `DIRECTOR_EMAIL`). After the CMS is up, staff re-enrol PINs through the director account.

## Company constants (not secret, but the site needs them)

`COMPANY_GSTIN`, `COMPANY_GST_STATE`, `COMPANY_CIN`, `GOOGLE_SITE_VERIFICATION`, `ANALYTICS_GEO_TOKEN`
in `metnmat/web/env` — fill from your records; the site renders without them but invoices/SEO
features won't.

---

## Already rotated by me (generated fresh, never seen by a human)

`INTERNAL_API_KEY`, `CMS_BLOG_KEY`, `BLOG_SIGNING_SECRET`, `ATTACHMENT_SIGNING_SECRET`,
`PAYLOAD_SECRET`, `PAYLOAD_PIN_PEPPER`, `CMS_OAUTH_KEY`, `JWT_SECRET` (chatbot), `AGENT_API_KEY`,
`NEXTAUTH_SECRET`, `CRON_SECRET`, `SYNC_JOB_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, and the CMS
S3 media access key (IAM user `metnmat-cms-media`, bucket-scoped).

## AWS-side, already done

Old instance-role sessions revoked; CI static key `AKIA…UJ63` deactivated; deploy key 159774699
deleted. **Still to do (Phase 8):** rotate the operator key `AKIA…2EVH` and shrink
`metnmat-migration` from AdministratorAccess to an operator policy.
