# Live credential checklist

Status values: **Pending** (old value burned, new one not yet provided) · **Provided** (in Secrets
Manager, not yet verified) · **Verified** (unit restarted, safe check passed) · **Generated** (created
fresh by the platform, nothing to do) · **n/a**.

Updated: 2026-09-16 07:40 UTC. I update this file each time a credential lands.

**New host:** `i-0b446863ec28109b0`, EIP `52.66.54.7` (t3.large, AL2023, encrypted, IMDSv2, no SSH).
**Website:** LIVE PUBLICLY — Cloudflare A records for `metnmat.com` and `www` now → `52.66.54.7` (DNS only); Let's Encrypt certs for both; verified from outside: apex 308→www, www 200, /shop 200, 404 correct. `admin`/`chat`/`command-center` records still → old IP until those apps are released.
**CMS / Chatbot / Command Center:** artifacts STAGED in S3 (sha256-verified on release); each releases the moment its boot credentials exist.

| App | Release command (root over SSM on the new host) |
|---|---|
| CMS | `metnmat-release cms 60752009cf6a69f0d7aac28a5106b98f9c822b77` |
| Chatbot | `metnmat-release chat 625eede942c035c9df2833d51f01f6e98ea13c96` |
| Command Center | `metnmat-release cc 7ece63d792d2146b3947086b3d721de4a7ea7c0a` |
| Website (live) | `metnmat-release web 60752009cf6a69f0d7aac28a5106b98f9c822b77` |

| Service | Credential (secret → key) | Status | Needed by | Blocks |
|---|---|---|---|---|
| MongoDB Atlas | `metnmat/cms/env → MONGODB_URI` (db `metnmat_cms`) | **Pending** | CMS | CMS boot |
| MongoDB Atlas | `metnmat/chat/env → MONGODB_URI` (db `metnmat`) | **Pending** | Chatbot | chatbot boot |
| MongoDB Atlas | `metnmat/cc/env → DATABASE_URL` | **Pending** | Command Center | CC boot |
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
| CMS | `MONGODB_URI`, `PAYLOAD_SECRET`, `PAYLOAD_PIN_PEPPER`, `S3_*` | waiting on **MongoDB Atlas** only |
| Chatbot | `MONGODB_URI`, `OPENAI_API_KEY`, `PINECONE_API_KEY`, `AGENT_API_KEY`, `JWT_SECRET` | waiting on **Atlas, OpenAI, Pinecone** |
| Command Center | `DATABASE_URL`, `NEXTAUTH_SECRET` | waiting on **MongoDB Atlas** only |

## Next 3 credentials to provide (in this order)

1. **MongoDB Atlas** — three users/URIs → unblocks CMS + Command Center boot, and one third of the chatbot.
2. **OpenAI API key** → chatbot.
3. **Pinecone API key** (+ index/namespace) → chatbot.
