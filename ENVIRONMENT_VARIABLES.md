# METNMAT — Environment Variables Reference

Consolidated reference for all three services. **Never commit real secrets.** Per-app templates live at:
`apps/website/.env.example`, `apps/dashboard/.env.example` *(new)*, and `Metnmat-customer-agent-main/.env.example`.

> 🔒 In production these should come from **GCP Secret Manager** (`--set-secrets` on Cloud Run), not on-disk `.env` files. Every value that has lived in an OneDrive-synced `.env` must be **rotated** (see `PRODUCTION_AUDIT_REPORT.md` §10).

---

## Website (`apps/website` → `.env.local`)

| Variable | Required | Purpose |
|---|:--:|---|
| `NEXT_PUBLIC_SITE_URL` | ✅ | Canonical/sitemap/OG/email base. Prod: `https://www.metnmat.com` |
| `NEXT_PUBLIC_CMS_URL` | ✅ | Payload CMS REST base the website reads catalog/content from. Prod: `https://admin.metnmat.com` |
| `NEXT_PUBLIC_CHATBOT_URL` | — | Chat widget base URL. Optional. |
| `INTERNAL_API_KEY` | ✅ (prod) | `x-internal-key` for order writes / private reads / revalidate. **Must match the dashboard.** *(Split per-purpose — SEC-06.)* |
| `RAZORPAY_KEY_ID` | ✅ (checkout) | `rzp_live_…` / `rzp_test_…`. Checkout disabled if unset. |
| `RAZORPAY_KEY_SECRET` | ✅ (checkout) | Server-side order creation + signature verify. |
| `RAZORPAY_WEBHOOK_SECRET` | ⛔ **no consumer yet** | Documented but **the webhook route doesn't exist** (SEC-05). Add the route or this is dead config. |
| `RESEND_API_KEY` | — | Order/quote/support emails (no-op if unset). |
| `QUOTE_FROM_EMAIL` | — | Sender (must be Resend-verified, e.g. `noreply@metnmat.com`). |
| `QUOTE_NOTIFY_EMAIL` | — | Internal inbox for order/quote/support notifications. |
| `OPEN_EXCHANGE_RATES_APP_ID` | — | Live ₹/$ display rate (USD is display-only; charges are INR). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | ⛔ **recommended** | Shared (cross-instance) rate-limit store via Upstash Redis REST. **Both** must be set; without them the limiter is per-instance in-memory only and resets on cold start (RL-01). *(The code reads these, NOT `REDIS_URL`.)* |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | — | Bot protection on public forms (optional). |
| `GOOGLE_CLIENT_ID` | ✅ (Google sign-in) | Google OAuth 2.0 **Web** client id. Server-side only. Redirect URI = `${NEXT_PUBLIC_SITE_URL}/api/account/google/callback`. Button is hidden-by-error if unset. |
| `GOOGLE_CLIENT_SECRET` | ✅ (Google sign-in) | Google OAuth client secret. Server-side only; never sent to the browser. |
| `CMS_OAUTH_KEY` | ✅ (recommended) | Dedicated key for the website→CMS `POST /api/customers/oauth` **session-minting** call. **When set, the dashboard accepts ONLY this key** (a leaked shared `INTERNAL_API_KEY` then can't mint customer sessions). Must be the **same** value on website **and** dashboard. Generate: `openssl rand -hex 32`. If unset, falls back to `INTERNAL_API_KEY` (works, wider blast radius — logged). |

## Dashboard (`apps/dashboard` → `.env`) — template newly added (SEC-08)

| Variable | Required | Purpose |
|---|:--:|---|
| `PAYLOAD_SECRET` | ✅ | JWT + admin-cookie signing. **Must be set in prod** — should fail fast (currently falls back to `""`, SEC-04). Generate: `openssl rand -hex 32`. |
| `MONGODB_URI` | ✅ | CMS database (`metnmat_cms`). |
| `MONGODB_DB` | — | Explicit DB name override. |
| `PAYLOAD_PIN_PEPPER` | ✅ (prod) | HMAC pepper for PIN→password derivation. **Must be long & random** (currently `5970`, SEC-07). Rotating it invalidates existing PIN logins — coordinate a PIN re-save. |
| `CMS_URL` | ✅ (prod) | The dashboard's **own** public origin — required for the admin auth cookie (CSRF/CORS). Prod: `https://admin.metnmat.com` |
| `NEXT_PUBLIC_SERVER_URL` | ✅ (prod) | Fallback for the self origin if `CMS_URL` unset. |
| `WEBSITE_URL` | ✅ | Public website origin (allowed to read the CMS cross-origin). |
| `INTERNAL_API_KEY` | ✅ (prod) | Must match the website's value. |
| `CHATBOT_DB_NAME` | ✅ (sync) | Mongo DB the chatbot product sync writes to (`metnmat`). |
| `GCS_BUCKET` / `GCS_PROJECT_ID` | ✅ (prod storage) | Enables GCS object storage. **Bucket must be private** (UBLA, no `allUsers`, UPLOAD-03). |
| `GCS_KEY_FILENAME` | — | Local key file; leave unset on Cloud Run (uses attached SA / ADC). |
| `OPEN_EXCHANGE_RATES_APP_ID` | — | ₹/$ rate for staff. |
| `RESEND_API_KEY` / `EMAIL_FROM` | — | Outbound CMS email (ticket replies, etc.). |

**Recommended new keys (staged):** split `INTERNAL_API_KEY` → `CMS_ORDER_WRITE_KEY`, `CMS_TICKET_WRITE_KEY`, `CMS_REVALIDATE_KEY`, `CHATBOT_READ_KEY`; add `ALLOW_FIRST_USER_BOOTSTRAP` (default off in prod, AUTH-02).
**Delete:** `apps/dashboard/.env.supabase.bak` (contains a live Supabase S3 secret — SEC-02).

## Chatbot (`Metnmat-customer-agent-main` → `.env`) — template hardened (BOT-10)

| Variable | Required | Purpose |
|---|:--:|---|
| `MONGODB_URI` | ✅ | Chatbot DB (`metnmat`). |
| `MONGODB_DNS_SERVERS` | — | Custom DNS for the Mongo SRV lookup (some networks need it). |
| `GROQ_API_KEY` | ✅ | LLM inference. |
| `PORT` / `PUBLIC_URL` | ✅ | Server bind + public base. |
| `JWT_SECRET` | ✅ | Signs widget session JWTs. **Must be long & random and set in prod** — remove the `metnmat-change-me-in-production` fallback + fail fast (SEC-03/BOT-04). Generate: `openssl rand -hex 32`. |
| `ALLOWED_ORIGINS` | ✅ (prod) | **Exact** comma-separated origins (no `*`, BOT-05). e.g. `https://www.metnmat.com,https://metnmat.com` |
| `META_APP_SECRET` / `FACEBOOK_APP_SECRET` / `INSTAGRAM_APP_SECRET` | ⛔ **add** | App Secrets to verify the `X-Hub-Signature-256` HMAC on inbound webhooks (BOT-01). Currently no signature check exists. |
| `Meta_WA_accessToken`, `Meta_WA_SenderPhoneNumberId`, `Meta_WA_wabaId`, `Meta_WA_VerfyToken`, `WHATSAPP_WEBHOOK_URL` | ✅ (WhatsApp) | WhatsApp Cloud API. |
| `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_VERIFY_TOKEN`, `FACEBOOK_GRAPH_API_VERSION` | — | Messenger. |
| `Meta_IG_VerifyToken`, `Meta_IG_AccessToken` | — | Instagram DM. |
| `PINECONE_API_KEY` / `PINECONE_INDEX_NAME` / `PINECONE_NAMESPACE` | — | Optional; not required for Metnmat. |

---

## Secrets that must be rotated (touched OneDrive-synced files — SEC-01/02)

`MONGODB_URI` (Atlas user password) · `GROQ_API_KEY` · `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` · `RESEND_API_KEY` · `Meta_WA_accessToken` (+ FB/IG tokens) · `JWT_SECRET` · `PAYLOAD_SECRET` · `PAYLOAD_PIN_PEPPER` · `INTERNAL_API_KEY` · Supabase S3 access key (in `.env.supabase.bak`).

## Generating strong secrets

```bash
openssl rand -hex 32          # PAYLOAD_SECRET, JWT_SECRET, PAYLOAD_PIN_PEPPER, INTERNAL_API_KEY
```
