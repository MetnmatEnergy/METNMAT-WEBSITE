# Live credential checklist

Status values: **Pending** (old value burned, new one not yet provided) · **Provided** (in Secrets
Manager, not yet verified) · **Verified** (unit restarted, safe check passed) · **Generated** (created
fresh by the platform, nothing to do) · **n/a**.

Updated: 2026-09-16 07:40 UTC. I update this file each time a credential lands.

**New host:** `i-0b446863ec28109b0`, EIP `52.66.54.7` (t3.large, AL2023, encrypted, IMDSv2, no SSH).
**Website:** LIVE PUBLICLY — Cloudflare A records for `metnmat.com` and `www` now → `52.66.54.7` (DNS only); Let's Encrypt certs for both; verified from outside: apex 308→www, www 200, /shop 200, 404 correct. `admin`/`chat`/`command-center` records still → old IP until those apps are released.
**CMS:** LIVE PUBLICLY — `admin` A record → `52.66.54.7`, Let's Encrypt cert, `https://admin.metnmat.com/admin/login` 200 from outside; website product grids populated again (verified publicly).
**Command Center:** LIVE PUBLICLY — `command-center` A record → `52.66.54.7`, cert issued, `/login` 200 verified from an independent host (Mongo pool connected).
**Chatbot:** `chat` DNS moved, cert issued; artifact STAGED in S3 (sha256-verified on release); each releases the moment its boot credentials exist.

| App | Release command (root over SSM on the new host) |
|---|---|
| CMS | **LIVE** `metnmat-release cms f70abf31403b37494b8ee9351a6c13ce7bd3b1b7` (webpack build; the Turbopack artifact 6075200 500s in the pnpm-deploy bundle — do not release it) |
| Chatbot | `metnmat-release chat 625eede942c035c9df2833d51f01f6e98ea13c96` |
| Command Center | **LIVE** `metnmat-release cc 7ece63d792d2146b3947086b3d721de4a7ea7c0a` |
| Website (live) | `metnmat-release web 60752009cf6a69f0d7aac28a5106b98f9c822b77` |

| Service | Credential (secret → key) | Status | Needed by | Blocks |
|---|---|---|---|---|
| MongoDB Atlas | `metnmat/cms/env → MONGODB_URI` (db `metnmat_cms`) | **Verified** — `cms-prod-2026`, CMS live, 133 products readable | CMS | — |
| MongoDB Atlas | `metnmat/chat/env → MONGODB_URI` (db `metnmat`) | **Provided** (`chat-prod-2026`) — verified on release | Chatbot | — |
| MongoDB Atlas | `metnmat/cc/env → DATABASE_URL` (db **`metnmat`**) | **Verified** — `cc-prod-2026`, CC live | Command Center | — |
| OpenAI | `metnmat/chat/env → OPENAI_API_KEY` | **Pending** | Chatbot | chatbot boot |
| Pinecone | `metnmat/chat/env → PINECONE_API_KEY / _INDEX_NAME / _NAMESPACE` | **Pending** | Chatbot | chatbot boot |
| Supabase | `metnmat/cc/env → SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL` | **Pending** | Command Center | media features |
| Gmail OAuth | `metnmat/cc/env → GMAIL_CLIENT_ID/SECRET, GMAIL_REFRESH_TOKEN, ENQUIRY_GMAIL_REFRESH_TOKEN, sender emails` | **Pending** | Command Center | mail sync |
| Zoho Books | `metnmat/cc/env → ZOHO_CLIENT_ID/SECRET, ZOHO_REFRESH_TOKEN, org ids, base URLs` | **Pending** | Command Center | Zoho sync |
| WhatsApp Cloud API | `metnmat/cc/env → WHATSAPP_TOKEN, WHATSAPP_APP_SECRET, phone/WABA ids`; `metnmat/chat/env → Meta_WA_*, META_APP_SECRET` | **Pending** | Command Center, Chatbot | WA messaging |
| Amazon SP-API | `metnmat/cc/env → AMAZON_SP_API_CLIENT_ID/SECRET, REFRESH_TOKEN, SELLER_ID, MARKETPLACE_IDS, REGION` | **Pending** | Command Center | order sync |
| Razorpay | `metnmat/web/env → RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET` | **Pending** | Website | checkout |
| Resend | `metnmat/web/env` + `metnmat/cms/env → RESEND_API_KEY` (+ `QUOTE_FROM_EMAIL`, `QUOTE_NOTIFY_EMAIL`, `BLOG_NOTIFY_EMAIL`, `EMAIL_FROM`) | **Pending** | Website, CMS | enquiry mail |
| Google OAuth | `metnmat/web/env → GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET` | **Pending** | Website | Google sign-in |
| Google Maps | `metnmat/cc/env → GOOGLE_MAPS_GEOCODING_API_KEY` | **Pending** | Command Center | geocoding |
| Upstash Redis | `metnmat/web/env → UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN` | **Pending** | Website | rate limiting |
| Open Exchange Rates | `metnmat/web/env` + `metnmat/cms/env → OPEN_EXCHANGE_RATES_APP_ID` | **Pending** | Website, CMS | currency |
| Gemini / DeepSeek / Groq | `metnmat/cc/env → GEMINI_API_KEY, DEEPSEEK_API_KEY (+ models)` | **Pending** | Command Center | AI replies |
| Google Cloud (Vertex, backup SA, GCS) | `metnmat/cc/env → GOOGLE_CLOUD_PROJECT, VERTEX_AI_*, BACKUP_OIDC_*, GCS_MEDIA_BUCKET` | **Pending** | Command Center | backups/Vertex |
| Director PIN | `metnmat/cms/env → DIRECTOR_PIN, DIRECTOR_EMAIL` | **Pending** | CMS | director login |
| Company constants | `metnmat/web/env → COMPANY_GSTIN, COMPANY_GST_STATE, COMPANY_CIN, GOOGLE_SITE_VERIFICATION, ANALYTICS_GEO_TOKEN` | **Pending** (not secret) | Website | invoices/SEO |
| Website ↔ CMS internal key | `INTERNAL_API_KEY`, `CMS_BLOG_KEY` (same value in web + cms) | **Generated** | Website, CMS | — |
| Website signing | `BLOG_SIGNING_SECRET`, `ATTACHMENT_SIGNING_SECRET` | **Generated** | Website | — |
| CMS core | `PAYLOAD_SECRET`, `PAYLOAD_PIN_PEPPER`, `CMS_OAUTH_KEY` | **Generated** | CMS | — |
| CMS S3 media | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (IAM user `metnmat-cms-media`) | **Generated** | CMS | — |
| Chatbot core | `JWT_SECRET`, `AGENT_API_KEY` | **Generated** | Chatbot | — |
| Command Center core | `NEXTAUTH_SECRET`, `CRON_SECRET`, `SYNC_JOB_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | **Generated** | Command Center | — |
| AWS instance role (old) | `metnmat-dashboard-role` sessions | **Revoked** | — | — |
| GitHub deploy key | id 159774699 (`Metnmat_Dashboard`) | **Revoked** | — | — |
| AWS CI static key | `AKIA…UJ63` (`metnmat-migration`) | **Deactivated** (delete after 7 days) | — | — |
| AWS operator key | `AKIA…2EVH` (`metnmat-migration`, AdministratorAccess) | **Pending** — rotate + downscope after recovery | — | — |
| Old Secrets Manager entries | `metnmat/prod/*`, `metnmat/chatbot/*` | **Pending delete** (Phase 7; values burned, nothing reads them) | — | — |

## What each app needs to BOOT (the rest can arrive later)

| App | Boot requirement | Status |
|---|---|---|
| Website | `INTERNAL_API_KEY` | **satisfied → DEPLOYED, health 200** |
| CMS | `MONGODB_URI`, `PAYLOAD_SECRET`, `PAYLOAD_PIN_PEPPER`, `S3_*` | **satisfied → DEPLOYED, health 200, 133 products** (director PIN login needs `DIRECTOR_PIN`/`DIRECTOR_EMAIL`) |
| Chatbot | `MONGODB_URI`, `OPENAI_API_KEY`, `PINECONE_API_KEY`, `AGENT_API_KEY`, `JWT_SECRET` | waiting on **Atlas, OpenAI, Pinecone** |
| Command Center | `DATABASE_URL`, `NEXTAUTH_SECRET` | **satisfied → DEPLOYED, /login 200 public** |

## Next credentials to provide

All three sites (website, CMS, Command Center) are LIVE. Remaining, in order:
1. **`metnmat/chat/env`** — `MONGODB_URI` (user `chat-prod-2026`, db `metnmat`), `OPENAI_API_KEY`, `PINECONE_API_KEY`/`_INDEX_NAME`/`_NAMESPACE` → then release chatbot + move `chat` DNS. Last app.
2. **Supabase** → Command Center media.
3. **Gmail / Zoho / WhatsApp / Amazon** → Command Center integrations.
4. **Resend + Razorpay + Upstash + Google OAuth** → website email/checkout.
5. **`metnmat/cms/env → DIRECTOR_PIN` + `DIRECTOR_EMAIL`** → CMS director login (staff re-enrol PINs once).

## Atlas housekeeping (after recovery)
- Free tier M0 at **84% of 512 MB**; writes stop at the cap. Drop `sample_mflix` (101 MB demo data, safe) and confirm whether `metnmat_ris` (113 MB) is still used.
- M0 has **no backups** — consider Flex (~$8-30/mo) or M10 (~$58/mo, point-in-time restore). Same hostname, no secret changes.

## Config imported from old env (2026-09-16, non-secret only)
- From the old website/CMS env (file mislabeled `old-cc.env.txt`): imported QUOTE_FROM_EMAIL, QUOTE_NOTIFY_EMAIL, UPSTASH_REDIS_REST_URL → `metnmat/web/env`; DIRECTOR_EMAIL, EMAIL_FROM → `metnmat/cms/env`. Units restarted; web/cms 200. Every credential in that file was SKIPPED (rotate at provider).
- `env` / `env.bak.*` in Downloads are MetAI/RIS — a separate app not on this host — not imported.
- The REAL Command Center env (Supabase/Zoho/Gmail/Amazon/WhatsApp) and the chatbot's OpenAI/Pinecone were not among the provided files — still pending.

## Command Center config imported from the laptop `.env` (2026-09-16 12:49 UTC, non-secret only)
- Source: `Metnmat_Dashboard/.env` (untracked, dev copy). Imported **61 config keys** (ids, URLs, toggles, model names,
  template names, sender emails, UPI payee, Zoho org ids, WhatsApp ids, public OAuth client ids) → `metnmat/cc/env`.
- Set for the v2 host as the code requires (`lib/storage/s3.ts`): `STORAGE_PROVIDER=s3`, `S3_MEDIA_BUCKET`,
  `S3_MEDIA_REGION`, `AWS_EC2_METADATA_DISABLED=true`, `UPLOAD_SECURITY_MODE=enforce`.
- **New IAM user `metnmat-cc-media`** (inline policy `deploy/v2/aws/cc-media-user-policy.json`: Get/Put/Delete/List on
  `metnmat-media-976134557584` only). Its access key was generated and placed straight into the secret, never displayed.
  Verified from the host: put+delete on its bucket OK; `metnmat-media-prod` → AccessDenied; Secrets Manager → AccessDenied.
- Deliberately NOT imported: every credential (Supabase keys, Gmail/Zoho/Amazon secrets + refresh tokens, WhatsApp
  token/app secret, Gemini/DeepSeek/Maps keys — all burned); `MEDIA_STORAGE=drive`, `STORAGE_PROVIDER=gcs`,
  `CDN_BASE_URL` (Google storage — no Google credentials exist on this host by design); `GMAIL_REDIRECT_URI`
  (laptop value is localhost; the code derives `https://command-center.metnmat.com/oauth2callback` from NEXTAUTH_URL).
- Restarted `metnmat-cc`: fetcher wrote 74 vars, Mongo pool ready, 487 indexes present, 0 errors, `/login` 200 public.
- ⚠ **Login OTP is sent through the operations Gmail mailbox** (`TWO_FACTOR_AUTH_ENABLED` defaults on). Until
  `GMAIL_CLIENT_SECRET` + `GMAIL_REFRESH_TOKEN` are rotated, nobody can complete a Command Center login. Rotating Gmail
  is therefore the first Command Center credential. (Setting `TWO_FACTOR_AUTH_ENABLED=false` would bypass this — not done;
  owner's call.)
- Remaining placeholders in `metnmat/cc/env` (26): AMAZON_SP_API_CLIENT_SECRET AMAZON_SP_API_REFRESH_TOKEN BACKUP_ALERT_EMAIL BACKUP_DRIVE_FOLDER_ID BACKUP_DRIVE_TEST_FOLDER_ID BACKUP_ENABLED BACKUP_MIN_DOC_RATIO BACKUP_OIDC_AUDIENCE BACKUP_OIDC_SERVICE_ACCOUNT DEEPSEEK_API_KEY ENQUIRY_GMAIL_REFRESH_TOKEN GCS_MEDIA_BUCKET GEMINI_API_KEY GMAIL_CLIENT_SECRET GMAIL_REDIRECT_URI GMAIL_REFRESH_TOKEN GOOGLE_MAPS_GEOCODING_API_KEY MEDIA_STORAGE NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY UPLOAD_SECURITY_ENFORCE_SOURCES WHATSAPP_APP_SECRET WHATSAPP_TOKEN WHATSAPP_WEB_API_KEY ZOHO_CLIENT_SECRET ZOHO_REFRESH_TOKEN

## 2026-09-17 — cutover to CI, and what the rotation broke on the worker

**Done today (owner-instructed):** the three recovery PRs are merged (`Metnmat_Dashboard#26` → master,
`METNMAT-WEBSITE#4` + `#5` → main, `METNMAT-chatbot#1` → main). GitHub Actions (OIDC role `metnmat-github-deploy`,
trust now main/master only) built and released **website `e049b34`** and **Command Center `e1a6f4d`** (login throttle +
CAPTCHA fix + SSRF/traversal guards) — both verified on the host and publicly. `main` on the two public repos blocks
force-push and deletion. Retired secrets deleted: dashboard `VM_*`, `DASHBOARD_*`, `GCP_SERVICE_ACCOUNT_KEY`; website
`ARTIFACT_BUCKET`, `EC2_INSTANCE_ID`. Repo variable `ARTIFACT_BUCKET` set on all three. The chatbot repo issues an
*immutable* OIDC subject (GitHub refuses to switch it off) — that form is now in the role trust as well.

**Broken by the rotation — needs two console copy-pastes (values never pass through me):**
1. Worker cron → Command Center: every `/api/cron/*` call from the worker gets **HTTP 401** because SSM parameter
   `/metnmat/prod/CRON_SECRET` still holds the pre-incident value. Fix: Secrets Manager → `metnmat/cc/env` → copy
   `CRON_SECRET` → Systems Manager → Parameter Store → `/metnmat/prod/CRON_SECRET` → Edit → paste → Save. No restart
   needed (the cron wrapper reads SSM on every run).
2. WhatsApp worker (pm2 `whatsapp-worker` on the worker host) → Command Center: **Unauthorized**, because
   `WHATSAPP_WEB_API_KEY` is `SET_ME` on the Command Center and the worker still has the burned value. Fix: generate a
   long random value; paste it as `WHATSAPP_WEB_API_KEY` in `metnmat/cc/env` AND create SSM SecureString
   `/metnmat/prod/WHATSAPP_WEB_API_KEY` with the same value; then tell me — I restart `metnmat-cc` and, on the worker,
   pull the parameter into the monitor's `.env` and restart pm2 (values stay on the hosts).

**Not done (guardrail refused, all low-risk, all yours):** copy `GOOGLE_CLIENT_ID` from `metnmat/prod/GOOGLE_CLIENT_ID`
into `metnmat/web/env` (public client id); create IAM group `metnmat-admins` (AdministratorAccess + MFA-required) and
user `metnmat-admin` so daily console work stops using root; rotate the operator key `AKIA…2EVH` (day 7 with the
cleanup). Nothing else in the account needs a third-party credential to be reached by me.
