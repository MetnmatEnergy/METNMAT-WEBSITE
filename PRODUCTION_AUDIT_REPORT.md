# METNMAT — Production Readiness Audit Report

**Date:** 2026-06-19
**Scope:** `apps/website` (Next.js storefront), `apps/dashboard` (Payload CMS ops console), and the separate `Metnmat-customer-agent-main` chatbot (Bun/Express/Mastra).
**Method:** Read-only multi-dimensional audit of the actual source across 9 dimensions (89 findings, each cited to file:line). A first wave of **safe, verified fixes has already been applied** — see `CHANGELOG_PRODUCTION_FIXES.md`. Higher-risk items are staged with precise specs rather than blind-applied to a live system.

> ⚠️ All three apps are **live in production**. Nothing in this report has been deployed; source edits sit in the working tree for review. The most dangerous changes (PIN-login removal, payment webhook, schema/collection additions, secret rotation) are intentionally **staged**, not auto-applied.

---

## 1. Platform health summary

| Dimension | Score /100 | One-line verdict |
|---|---:|---|
| Dashboard auth & access control | **38** | PIN-only login, unauthenticated overview PII leak, ungated super-admin bootstrap, sales can edit payment status. |
| CMS collections & workflows | **44** | Solid content store; the order-to-cash / RFQ-to-quote operational backbone is largely absent and unguarded (no state machines). |
| Website API & customer auth | **62** | Sensible CMS proxy; **rate limiting is in-memory → bypassable on Cloud Run**; some enumeration & validation gaps. |
| Payments & orders (Razorpay) | **68** | Money-safety fundamentals correct (server-side pricing + signature verify); **no webhook = paid orders can strand as pending**. |
| File upload & storage | **61** | Good allowlist/size caps; no magic-byte check, public SVG, storage ACL unverified, IDOR on attachment ids. |
| SEO / performance / a11y | **72** | Strong SEO foundation; inconsistent legal name on the payment screen; `/quote` form is a dead end. |
| DevOps / deploy / CI | **62** | Cloud Run + Secret Manager mostly sound; chatbot repo not in git; `latest`-pinned CMS deps; CI gaps. |
| Chatbot security & scope | **38** | Tools are correctly write-limited, but webhooks unsigned, two unauthenticated widget endpoints, weak JWT default, no rate limiting. |
| Secrets / env / fail-fast | **28** | Real secrets in OneDrive-synced `.env` files; weak/empty fallbacks; no fail-fast; one broad internal key. |

**Findings by severity:** P0 = 9 · P1 = 30 · P2 = 30 · P3 = 20 (total **89**).

---

## 2. Critical issues (P0) — fix before anything else

| ID | Issue | Where | Status |
|---|---|---|---|
| **AUTH-01** | `/(overview)` renders live counts + recent enquiry **PII with no auth** on the admin domain root. | `dashboard .../(overview)/page.tsx` | ✅ **FIXED** (gated behind `payload.auth`, redirects to `/admin/login`). |
| **AUTH-02** | Super-admin bootstrap not gated by env; `/admin/create-first-user` publicly advertised. | `dashboard Users.ts`, `seed.ts`, `(overview)/page.tsx` | ⚠️ **PARTIAL** — public link removed ✅; env-gating of bootstrap **staged** (see §10). |
| **AUTH-03** | `sales`/`marketing` can flip Order **payment status / total** (no field-level access; `readOnly` is UI-only). | `dashboard Orders.ts`, `access/index.ts` | ⛔ **STAGED** (RBAC field-access; §10). |
| **BOT-01** | Meta/WhatsApp/FB/IG webhooks have **no `x-hub-signature-256` verification** — forged inbound messages drive the LLM, create tickets, send WhatsApp. | `chatbot routes/controllers` | ⛔ **STAGED** (§10). |
| **BOT-02** | `/widget/conversations` **dumps all visitor chats** unauthenticated. | `chatbot widget-controller.ts:74` | ⛔ **STAGED** (§10). |
| **BOT-03** | `/widget/session/agent` mints an **`agent`-role JWT with no auth**. | `chatbot widget-controller.ts:63` | ⛔ **STAGED** (§10). |
| **SEC-01** | Live production secrets (Mongo, Razorpay, Resend, WhatsApp, JWT) in plaintext `.env` inside **cloud-synced OneDrive**. | both repos | ⛔ **MANUAL** — move to Secret Manager + **rotate** (§10, §12). |
| **SEC-02** | Stale **Supabase S3 secret** in `apps/dashboard/.env.supabase.bak`. | `dashboard/.env.supabase.bak` | ⛔ **MANUAL** — delete file + revoke key (§10). |
| **SEC-03** | Hard-coded `JWT_SECRET` fallback signs widget tokens (`metnmat-change-me-in-production`). | `chatbot config/env.ts:18` | ⚠️ `.env.example` hardened ✅; **fail-fast staged** (§10). |

---

## 3. Security issues (auth, RBAC, keys, rate limiting)

**Authentication (dashboard).** The primary sign-in is a **4-digit PIN** (10,000-key space) whose strong Payload password is *deterministically HMAC-derived* from the PIN (`pin.ts`, `Users.ts:99`). The pepper falls back to `PAYLOAD_SECRET` then to the public literal `"metnmat-dev-pepper"`, and the configured value is itself `5970` (a 4-digit number) — so an attacker with DB/backup read can brute-force PINs offline (**AUTH-05/AUTH-07/SEC-07**). PINs are stored **in plaintext** (`Users.ts:23`). Brute-force lockout is **in-memory, per-instance, and keyed on a spoofable `X-Forwarded-For`** (**AUTH-06**) — defeated by Cloud Run autoscaling and header rotation.

**RBAC (dashboard).** Only **4 roles** exist (`super-admin/admin/marketing/sales`) vs the 9 required; there is **no field-level lock on payment fields** (AUTH-03), and no `accounts`, `inventory`, `technical`, `support`, `operations-manager`, or `read-only-auditor` separation (**AUTH-04**).

**Internal keys.** A **single `INTERNAL_API_KEY`** is the trust anchor for order writes, ticket writes, private customer-file reads, revalidation, and support-notify (**SEC-06 / KEY-01**). Comparison is non-constant-time, there's no nonce/timestamp (replayable), and one leak exposes every capability. Should be split into `CMS_ORDER_WRITE_KEY`, `CMS_TICKET_WRITE_KEY`, `CMS_REVALIDATE_KEY`, `CHATBOT_READ_KEY`, `WEBHOOK_SECRET`, `RAZORPAY_WEBHOOK_SECRET` with HMAC+timestamp.

**Rate limiting (website + chatbot).** **All** rate limiting is an in-memory `Map` (`rate-limit.ts`, `pin.ts`) — explicitly TODO'd to move to Redis. On multi-instance Cloud Run this is **effectively decorative**, leaving login/register/reset/forgot/ticket-lookup/upload/checkout and every chatbot endpoint open to brute force, enumeration, and cost-amplification (**RL-01, UPLOAD-06, BOT-07**). Requires a shared store (Redis/Upstash/Memorystore).

**Admin hardening.** No `noindex`/`X-Robots-Tag` on the admin (**AUTH-08** ✅ fixed). Auth cookie `Secure` is `NODE_ENV`-conditional with no `__Host-`/`__Secure-` prefix (**AUTH-09**, P2).

---

## 4. CMS / admin (collections & workflow) issues

The content side (products/media/categories/posts) is production-grade with audit hooks and clean access. The **operational backbone is missing or unguarded**:

- **No state-machine enforcement anywhere** — every `status` is a free select. Orders can jump `pending → delivered` or `refunded → paid`; RFQs can be `quoted` with no quotation, `closed` with no reason; tickets `resolved` with no note (**ORD-01, ENQ-02, TKT-01**).
- **Orders are hard-deletable and the price snapshot is editable post-payment** (**ORD-02**) — breaks GST reconciliation and dispute defence.
- **Missing collections (~14):** Product Variants, Product Documents, Leads, **Quotations**, **Payment Events**, Shipments, Invoices, Returns/Replacements, **Tasks**, Notifications, **Stock Ledger**, Integration Logs (**QUOTE-01, PAY-01, SHIP-01, RET-01, TASK-01, STOCK-01**).
- **Products** lack `gstRate`, `hsnSac`, `productType`, stock quantities/`reservedStock`/`lowStockThreshold`, weight/dims, `countryOfOrigin`, a managed `status` enum, and price-approval/last-reviewed (**PROD-01/03**). `sku` is not unique/required — the chatbot sync silently de-dups (**PROD-02**).
- **Inventory is a single boolean** — no quantity, no reservation at checkout, no ledger; overselling is unpreventable (**STOCK-01**).
- **Enquiries (RFQ) and Customers fire no audit hook** (**ENQ-01, AUD-01**) — RFQ progression and customer-PII edits are invisible in the trail. The audit hook itself silently swallowed errors (**AUD-02** ✅ fixed — now logs).

---

## 5. Public website issues

- **Legal-name inconsistency** (**SEO-01**, P1): `site.ts` `legalName = "METNMAT Research & Innovations"` feeds Organization JSON-LD, OG, footer, Product `seller`, **and the live Razorpay payment modal**, while About says "METNMAT Innovations Private Limited" and the registered entity is **METNMAT INNOVATIONS PRIVATE LIMITED**. Three names across structured data + the payment screen. **Staged** (touches the live money screen + CMS `company.legalName` global — change deliberately, §10).
- **`/quote` is a dead end** (**UX-01**, P1): the form has no `onSubmit`, `type="button"`, and a `TODO` — a primary B2B lead path silently drops every submission. Also has unlabeled inputs (**A11Y-01**). **Staged** (wire to the existing enquiries API).
- Private/utility routes (login/cart/checkout/wishlist/forgot/reset/account/search) were indexable — **SEO-02/03** ✅ fixed (robots disallow).
- Product/catalog images use raw `<img>` not `next/image` → no optimization, CLS risk (**PERF-01**, P2). Product OG image not set (**SEO-06**, P3). Lightbox modal a11y gaps (**A11Y-02**, P3). Placeholder TODO copy on home CTA / product description tab (**UX-02**, P3).

---

## 6. Payment / order issues

- **No Razorpay webhook** (**PAY-01 / SEC-05**, P1): orders are marked paid **only** by the browser-driven `/api/checkout/verify`. If the buyer's tab/network dies after Razorpay captures, money is taken but the order stays `pending` forever, no confirmation email, no reconciliation. `.env.example` even documents a `RAZORPAY_WEBHOOK_SECRET` that **has no consumer**. **Staged** — precise spec in §10 (highest-value payment fix).
- `verify` never cross-checks the **captured amount/status** with Razorpay (**PAY-02**, P2). No `inStock`/availability check at checkout — ✅ **fixed (PAY-03)**. Idempotency is a read-then-write race (**PAY-04**, P3). Abandoned/failed payments are never reconciled (**PAY-05**, P3).
- **What's already correct:** order amount is recomputed **server-side** from the CMS (tier breaks + GST), the client only sends slug+qty, prices are snapshotted at order time, and the HMAC signature is verified with a constant-time compare. A tampered client cannot change what is charged.

---

## 7. File upload / storage issues

- **No magic-byte validation** — type trusted the client `Content-Type` (**UPLOAD-01**) → ✅ **fixed** (server-side signature sniff). Filenames passed verbatim (**UPLOAD-04**) → ✅ **fixed** (sanitized). Storage URL leaked in the JSON response (**UPLOAD-07**) → ✅ **fixed** (removed).
- **Public SVG on the Media collection** = stored XSS (**UPLOAD-02**) → ✅ **fixed** (SVG removed from `mimeTypes`).
- **GCS ACL not asserted private** (**UPLOAD-03**, P1): `gcsStorage()` sets no `acl`; the adapter returns a predictable `publicUrl()`. If the bucket isn't strictly private, customer RFQ attachments are world-readable at a guessable path. **Manual** — verify bucket is UBLA + no `allUsers`, pass `acl: 'Private'` (§10).
- **IDOR on attachment ids** (**UPLOAD-08**, P2): public forms accept arbitrary `attachmentIds` and the server reads+emails them with the internal key — no ownership binding. **Staged.**
- No malware scanning; raw attachments base64-emailed to staff (**UPLOAD-05**, P2). Upload endpoint public + per-instance rate limit (**UPLOAD-06**, P2).

---

## 8. DevOps / deployment issues

- **Chatbot repo is not under git** (**DEVOPS-01**, P1) — no history/rollback/review on the component holding live Mongo/Razorpay/JWT secrets. **Manual** (`git init` after verifying `.env`/`deploy/secrets.env` are ignored).
- Dashboard pins 6 core Payload deps to **`latest`** (**DEVOPS-02**, P1) → ✅ **fixed** (pinned to `3.85.1`, lockfile regenerated, `--frozen-lockfile` verified).
- Chatbot `Dockerfile` `COPY . .` + `.dockerignore` missing `deploy/secrets.env` → local `docker build` bakes secrets (**DEVOPS-03**, P1) → ✅ **fixed** (`.dockerignore` hardened).
- CI `typecheck` skipped the dashboard (no script) (**DEVOPS-04**) → ✅ **fixed** (script added; verified). CI Node 20 vs Docker Node 22 (**DEVOPS-05**) → ✅ **fixed** (CI → 22). Tracked `tsbuildinfo` (**DEVOPS-08**) → ✅ **fixed** (ignored + untracked).
- Images tagged only `:latest`, no SHA tags → hard rollbacks (**DEVOPS-06**, P2). Dashboard container runs as **root** (**DEVOPS-07**, P2). No chatbot CI (**DEVOPS-09**, P3). No dashboard health route (**DEVOPS-10**, P3). **Also found:** dashboard has **no ESLint config**, so `next lint` is interactive/non-deterministic in CI — add `apps/dashboard/.eslintrc.json` after reviewing for violations.

---

## 9. Chatbot issues

Tools are correctly **write-limited** (only create-ticket and update-own-profile; no mark-done / pay / delete / edit-price) — a vague "mark my task done" **cannot** mutate anything. But the perimeter is weak: unsigned webhooks (**BOT-01**), two unauthenticated widget endpoints (**BOT-02/03**), weak `JWT_SECRET` default (**BOT-04**), `ALLOWED_ORIGINS=*` default + `frame-ancestors *` (**BOT-05**), ticket-lookup IDOR by phone/ID with no ownership binding (**BOT-06**), no rate limiting (**BOT-07**), tools talk **directly to Mongo** with TLS hostname verification disabled (**BOT-08**), and no real audit log (**BOT-09**). `.env.example` insecure defaults (**BOT-10**) → ✅ **fixed**.

---

## 10. Priority roadmap

### P0 — do immediately
1. **Rotate every secret** that has touched the OneDrive `.env` files (Mongo, Razorpay, Resend, WhatsApp/Meta tokens, Groq, `JWT_SECRET`, `PAYLOAD_SECRET`, `PAYLOAD_PIN_PEPPER`, `INTERNAL_API_KEY`) and move them to GCP Secret Manager. Delete `apps/dashboard/.env.supabase.bak` and revoke that Supabase S3 key. *(SEC-01/02, manual)*
2. **Chatbot perimeter:** add `x-hub-signature-256` HMAC verification on all Meta webhooks; require a real staff credential before `/widget/session/agent` issues an agent token; authenticate `/widget/conversations`. *(BOT-01/02/03)*
3. **Env-gate the super-admin bootstrap** (`ALLOW_FIRST_USER_BOOTSTRAP !== "true"` ⇒ no unauthenticated roles-create, no `create-first-user`); make `ensureSuperAdmin` one-shot. *(AUTH-02 remainder)*
4. ✅ Done: unauthenticated overview leak (AUTH-01), admin noindex (AUTH-08), public SVG (UPLOAD-02), upload magic-byte/filename/URL-leak (UPLOAD-01/04/07).

### P1 — next
5. **Razorpay webhook** — `POST /api/checkout/webhook`: verify `X-Razorpay-Signature` HMAC over the **raw body** with `RAZORPAY_WEBHOOK_SECRET`; on `payment.captured`/`order.paid` look up by `razorpay_order_id`, GET the payment to confirm `status==captured` && `amount==order.total*100`, then `markOrderPaid` **idempotently** (compare-and-set on `status != paid`). Webhook = source of truth; browser `verify` becomes a UX fast-path. *(PAY-01/02/04/05, SEC-05)*
6. **Shared rate limiting** (Redis) for login/register/reset/forgot/checkout/upload/ticket-lookup and all chatbot endpoints; derive client IP from the trusted LB hop, not raw XFF. *(RL-01, AUTH-06, UPLOAD-06, BOT-07)*
7. **Expand RBAC to 9 roles + field-level access** so only `accounts`/`admin`/`super-admin` (or the internal server) can change payment status/total/`razorpay*`; add `inventory`/`technical`/`support`/`read-only-auditor`. *(AUTH-03/04)*
8. **Order & RFQ state machines + immutability** (allowed-transition maps, required-file/required-reason gates, `delete:false`, post-paid readonly). *(ORD-01/02, ENQ-02, TKT-01)*
9. **Fail-fast on missing secrets** in all three apps; remove empty/weak fallbacks (`PAYLOAD_SECRET || ""`, PIN pepper literal, chatbot `JWT_SECRET` default); set a strong random `PAYLOAD_PIN_PEPPER`. *(SEC-03/04/07, AUTH-05)*
10. **Split the internal key** into purpose-scoped, HMAC-signed keys with timestamp/replay protection. *(SEC-06, KEY-01)*
11. **Verify GCS bucket is private** (UBLA, no `allUsers`), pass `acl:'Private'`, serve private collections only through access-controlled routes/signed URLs. *(UPLOAD-03)*
12. **Wire `/quote` to the enquiries API**; fix labels. Reconcile the **legal entity name** to `METNMAT INNOVATIONS PRIVATE LIMITED` once (in `site.legalName` + the CMS `company.legalName` global) — verify on checkout. *(UX-01, A11Y-01, SEO-01)*
13. **Put the chatbot repo under git**; stop PIN plaintext storage; harden chatbot CORS (no `*`) and scope `frame-ancestors`. *(DEVOPS-01, AUTH-07, BOT-05)*

### P2 / P3 — hardening & polish
New collections (Quotations, PaymentEvents, StockLedger, Tasks, Shipments, Invoices, Returns, Leads, Notifications, IntegrationLogs); product GST/HSN/stock fields + unique SKU; `next/image` migration; webhook amount cross-check; attachment-id ownership binding; malware scanning; SHA image tags + non-root dashboard container + dashboard health route + chatbot CI; OG product images; modal a11y; constant-time key compares; bigger ticket-number entropy. *(see the full findings table for IDs)*

---

## 11. The 9 already-fixed items (this wave)

`AUTH-01` overview auth gate · `AUTH-08` admin noindex · `AUD-02` audit error logging · `UPLOAD-01` magic-byte validation · `UPLOAD-04` filename sanitization · `UPLOAD-07` storage-URL leak · `UPLOAD-02` public SVG removed · `PAY-03` out-of-stock checkout guard · `SEO-02/03` robots disallow · `DEVOPS-02` dep pinning · `DEVOPS-03` chatbot `.dockerignore` · `DEVOPS-04` dashboard typecheck · `DEVOPS-05` CI Node 22 · `DEVOPS-08` tsbuildinfo untracked · `SEC-08` dashboard `.env.example` · `BOT-10` chatbot `.env.example`. Plus the public `create-first-user` link removed (AUTH-02 partial). All verified by typecheck (both apps) + website lint + `--frozen-lockfile`. Details in `CHANGELOG_PRODUCTION_FIXES.md`.

---

## 12. Risky areas requiring manual review

- **Secret rotation (SEC-01/02/03/07):** must be done by a human with provider access; rotating `PAYLOAD_PIN_PEPPER` invalidates existing PIN logins (coordinate a PIN re-save). Cannot be automated safely.
- **GCS bucket ACL (UPLOAD-03):** requires checking the actual bucket IAM in GCP — code cannot prove the bucket is private.
- **Legal name on the Razorpay modal (SEO-01):** appears on the live payment screen and may be CMS-overridden by the `company` global — change deliberately and verify in a real checkout.
- **PIN-login → email/password + MFA (AUTH whole):** removing PIN login from a console staff use *right now* must be a coordinated migration, not a blind edit.
- **New collections / schema changes:** additive but change the admin and the chatbot product sync; stage and test against a non-prod DB first.
