# Changelog — Production Hardening (Wave 1)

**Date:** 2026-06-19
**Author:** Automated production audit + safe-fix pass.
**Status:** Applied to the working tree, **not deployed**. Push to `main` to deploy (auto-deploy via Cloud Build).
**Verification:** `pnpm --filter website typecheck` ✅ · `pnpm --filter dashboard typecheck` ✅ · `pnpm --filter website lint` ✅ · `pnpm install --frozen-lockfile` ✅.

Every change below is **additive / non-breaking** and was chosen because it cannot lock out staff, drop orders, or change money flow. Higher-risk items are listed in `PRODUCTION_AUDIT_REPORT.md` §10 as **staged** (not applied).

---

## Security — dashboard (Payload CMS)

| Finding | File | Change |
|---|---|---|
| **AUTH-01** (P0) | `apps/dashboard/src/app/(overview)/page.tsx` | Added an auth gate: `payload.auth({ headers })` at the top of the page; redirects unauthenticated visitors to `/admin/login` **before** any data is fetched. Stops the unauthenticated leak of live counts + recent enquiry PII on the admin root. `getStats()` now receives the already-created `payload` instance. |
| **AUTH-02** (P0, partial) | `apps/dashboard/src/app/(overview)/page.tsx` | Removed the publicly-rendered "Create your Super Admin at `/admin/create-first-user`" link. *(Env-gating of the bootstrap itself is staged.)* |
| **AUTH-08** (P2) | `apps/dashboard/next.config.mjs` | Added a global `X-Robots-Tag: noindex, nofollow, noarchive` response header for the entire admin service. |
| **AUTH-08** (P2) | `apps/dashboard/src/app/(overview)/layout.tsx` | Added `robots: { index:false, follow:false, nocache:true }` to the overview metadata. |
| **AUD-02** (P3) | `apps/dashboard/src/hooks/audit.ts` | Audit hooks no longer swallow errors silently — failures are now logged via `req.payload.logger.error(...)` (still non-blocking, so a write never fails on an audit error, but a dark audit trail is now visible). |
| **UPLOAD-02** (P1) | `apps/dashboard/src/collections/Media.ts` | Removed `image/svg+xml` from the public Media collection's `mimeTypes` (SVG can carry `<script>` → stored XSS on a `publicRead`, public-served collection). |

## Security — website (Next.js)

| Finding | File | Change |
|---|---|---|
| **UPLOAD-01** (P1) | `apps/website/src/backend/lib/file-signature.ts` *(new)* | Dependency-free **magic-byte** validator: sniffs the real leading bytes and only accepts PDF / PNG / JPEG / GIF / WEBP / ISO-BMFF (HEIC/HEIF/AVIF). A renamed HTML/EXE/ZIP with a spoofed `Content-Type` is now rejected. |
| **UPLOAD-01 / 04 / 07** | `apps/website/src/app/api/quote/upload/route.ts` | (1) Buffers the file and rejects it unless `isAllowedUploadSignature()` passes — no longer trusts `file.type`. (2) Sanitizes the filename via `safeFilename()` (strips path separators, control/bidi chars, caps length). (3) Stops returning the raw GCS `url` in the JSON response (the client never used it; it leaked the private storage path). |
| **PAY-03** (P2) | `apps/website/src/app/api/checkout/create-order/route.ts` | Rejects any line item whose catalog `inStock === false` **before** creating the Razorpay order, so we never charge for something we can't fulfil. |
| **SEO-02 / SEO-03** (P2) | `apps/website/src/app/robots.ts` | Added `disallow` for `/login, /forgot, /reset, /cart, /checkout, /wishlist, /account, /search, /api/` — keeps thin/transactional/private routes out of the index and off the crawl budget. |

## Security / hygiene — chatbot (customer-agent)

| Finding | File | Change |
|---|---|---|
| **DEVOPS-03** (P1) | `Metnmat-customer-agent-main/.dockerignore` | Added `.env.*`, `deploy/`, `*-key.json`, `*.pem`, `dist`, `logs` so a local `docker build .` can never bake `deploy/secrets.env` (live Mongo/Razorpay/JWT) into an image layer. |
| **BOT-10** (P3) | `Metnmat-customer-agent-main/.env.example` | Replaced insecure defaults: `JWT_SECRET=` now empty with an `openssl rand -hex 32` hint; `ALLOWED_ORIGINS` is a real placeholder domain (not `*`); added `META_APP_SECRET` / `FACEBOOK_APP_SECRET` / `INSTAGRAM_APP_SECRET` and `MONGODB_DNS_SERVERS` placeholders. |

## DevOps / CI / config

| Finding | File | Change |
|---|---|---|
| **DEVOPS-02** (P1) | `apps/dashboard/package.json` + `pnpm-lock.yaml` | Pinned the 6 `@payloadcms/*` + `payload` deps from `latest` → `3.85.1` (the already-resolved version). Regenerated the lockfile (specifier-only diff) and verified `--frozen-lockfile` still passes → Docker/CI builds stay reproducible. |
| **DEVOPS-04** (P2) | `apps/dashboard/package.json` | Added `"typecheck": "tsc --noEmit"` so CI's `turbo run typecheck` now actually covers the CMS (previously skipped). Verified clean. |
| **DEVOPS-05** (P2) | `.github/workflows/ci.yml` | CI Node `20` → `22` to match the `node:22-slim` Docker base images. |
| **DEVOPS-08** (P3) | `.gitignore` (+ `git rm --cached`) | Added `*.tsbuildinfo`; untracked `apps/website/tsconfig.tsbuildinfo` and `apps/dashboard/tsconfig.tsbuildinfo` (kept on disk). |
| **SEC-08** (P2) | `apps/dashboard/.env.example` *(new)* | Created the missing dashboard env template documenting every var the CMS reads (`PAYLOAD_SECRET`, `PAYLOAD_PIN_PEPPER`, `CMS_URL`, `CHATBOT_DB_NAME`, GCS vars, etc.) with empty values + hardening notes. |

---

## Files changed (15)

```
apps/dashboard/src/app/(overview)/page.tsx        (auth gate, bootstrap link removed)
apps/dashboard/src/app/(overview)/layout.tsx      (robots noindex)
apps/dashboard/next.config.mjs                    (X-Robots-Tag header)
apps/dashboard/src/collections/Media.ts           (SVG removed)
apps/dashboard/src/hooks/audit.ts                 (log audit failures)
apps/dashboard/package.json                        (deps pinned, typecheck script)
apps/dashboard/.env.example                        (NEW)
apps/website/src/backend/lib/file-signature.ts     (NEW)
apps/website/src/app/api/quote/upload/route.ts    (magic-byte, filename, url leak)
apps/website/src/app/api/checkout/create-order/route.ts  (out-of-stock guard)
apps/website/src/app/robots.ts                    (disallow private routes)
.github/workflows/ci.yml                           (Node 22)
.gitignore                                          (*.tsbuildinfo)
pnpm-lock.yaml                                      (specifier pin)
Metnmat-customer-agent-main/.dockerignore          (secret exclusion)
Metnmat-customer-agent-main/.env.example           (secure defaults)
```
Plus untracked: `apps/website/tsconfig.tsbuildinfo`, `apps/dashboard/tsconfig.tsbuildinfo`.

---

# Wave 2 — Auth, RBAC, order integrity, payment webhook (2026-06-19)

**Verification:** dashboard `tsc` ✅ · website `tsc` ✅ · website lint ✅. All additive / build-safe.

| Finding | File | Change |
|---|---|---|
| **AUTH-04** (P1) | `apps/dashboard/src/access/index.ts` | Expanded RBAC from 4 → **10 roles** (added operations-manager, technical, inventory, accounts, support, read-only-auditor; kept marketing). New access helpers: `canManageAccounts`, `canManageInventory`, `canManageSupport`, `canReadAudit`, `isAdminOrOps`, `fieldAccountsOrInternal`. `Users.ts` now uses the shared `ROLE_OPTIONS`. |
| **AUTH-02** (P0) | `access/index.ts` + `collections/Users.ts` | **Env-gated the super-admin bootstrap** via `bootstrapAllowed()` (`ALLOW_FIRST_USER_BOOTSTRAP==="true"` or non-prod). An empty users collection in prod no longer mints a super-admin to an anonymous visitor. `ensureSuperAdmin` (existing-user lockout recovery) is untouched. |
| **AUTH-03** (P0) | `apps/dashboard/src/hooks/order-workflow.ts` *(new)* + `Orders.ts` | **Sales/marketing can no longer touch payment.** A `beforeChange` hook gates payment states (paid/failed/refunded) to Accounts/Admin (or the internal-key server), fulfilment states (shipped/delivered/cancelled) to Ops/Inventory/Accounts/Admin. Razorpay id/paidAt fields got real `fieldAccountsOrInternal` access (not just UI `readOnly`). |
| **ORD-01** (P1) | `order-workflow.ts` | **Order state machine** — only legal transitions allowed (no pending→delivered, refunded→paid). |
| **ORD-02** (P1) | `order-workflow.ts` + `Orders.ts` | Price snapshot (amounts + items) **immutable** except Accounts/Admin; `delete` tightened to super-admin; `beforeDelete` **blocks deleting paid/shipped/delivered/refunded** orders (cancel instead). |
| **SEC-04 / SEC-07** (P1) | `apps/dashboard/src/payload.config.ts` | **Fail-fast** in `onInit` (runtime, with a `NEXT_PHASE` build guard so Docker build is unaffected): throws if `PAYLOAD_SECRET`/`MONGODB_URI`/`PAYLOAD_PIN_PEPPER` missing in production; warns on a short pepper. |
| **SEO-01** (P1) | `seed.ts`, `site.ts`, `checkout/page.tsx`, `cms.ts`, `email.ts` | **Legal entity unified to `METNMAT INNOVATIONS PRIVATE LIMITED`** — the CMS `company.legalName` seed (authoritative), `site.legalName`, the **live Razorpay payment modal** (now `site.legalName`), the JSON-LD fallback, and the email legal footer. (Marketing prose left in brand voice.) |
| **PAY-01 / SEC-05** (P1) | `apps/website/src/app/api/checkout/webhook/route.ts` *(new)* + `razorpay.ts` | **Razorpay webhook** — verifies `x-razorpay-signature` HMAC over the **raw body** (`verifyWebhookSignature`), handles `payment.captured`/`order.paid`/`payment.failed`, looks up by `razorpayOrderId`, **idempotent** (no-op if already paid), and **cross-checks the captured amount** (PAY-02) against the server total before marking paid. Inert (503) until `RAZORPAY_WEBHOOK_SECRET` is set, so deploying it can't break the current flow. |

**Wave 2 files:** `access/index.ts`, `collections/Users.ts`, `collections/Orders.ts`, `hooks/order-workflow.ts` (new), `payload.config.ts`, `seed.ts`, `site.ts`, `checkout/page.tsx`, `frontend/lib/cms.ts`, `backend/lib/email.ts`, `backend/lib/razorpay.ts`, `app/api/checkout/webhook/route.ts` (new).

---

---

# Wave 3 — Distributed rate limiting (2026-06-19)

**Verification:** website `tsc` ✅ · website lint ✅ · Upstash pipeline live-tested ✅ (SET-NX/INCR/TTL behaves as designed).

| Finding | File | Change |
|---|---|---|
| **RL-01 / UPLOAD-06** (P1) | `apps/website/src/backend/lib/rate-limit.ts` | Added `limitRate()` — **distributed** rate limiting via **Upstash Redis REST** (fixed window: `SET key 0 EX ttl NX` → `INCR` → `TTL`), with an **in-memory fallback** that fails *open* if Upstash is unreachable (a Redis blip never takes the site down). Enabled by `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`; zero new deps (plain `fetch`). |
| **RL-01** | 12 route files (login, register, reset, forgot×2, contact, quote, quote/upload, checkout/create-order, checkout/verify, support, support/reply, support/status) | Migrated all **13 call sites** from the per-instance `rateLimit()` to `await limitRate()`. Limits now hold across Cloud Run replicas. |
| config | `apps/website/.env.example` | Documented `UPSTASH_REDIS_REST_URL` / `_TOKEN` (replaced the stale `REDIS_URL` note). |

Local gitignored env files updated with the provided keys: dashboard `PAYLOAD_PIN_PEPPER` rotated to the strong value; website `RAZORPAY_WEBHOOK_SECRET` + Upstash creds added. **These do not affect production** — set them in Cloud Run (see deployment notes).

---

---

# Wave 4 — Chatbot perimeter (2026-06-19)

**Repo:** `Metnmat-customer-agent-main` (Bun/Express/Mastra). **Verification:** chatbot `tsc --noEmit` on `src/` stayed at the 6 pre-existing errors — **zero new errors** in any edited/new file.

| Finding | File | Change |
|---|---|---|
| **BOT-02 / BOT-03** (P0) | `src/routes/widget.routes.ts` + `src/middlewares/require-agent-key.middleware.ts` *(new)* | The two wide-open endpoints — `POST /widget/session/agent` (minted an `agent`-role JWT for anyone) and `GET /widget/conversations` (dumped all visitor chats) — now require the **`AGENT_API_KEY`** (`x-agent-key` header). Unset key → endpoints **disabled** (fail closed). |
| **BOT-01** (P0) | `src/middlewares/verify-meta-signature.middleware.ts` *(new)* + `whatsapp.routes.ts`, `meta-social.routes.ts`, `server.ts` | **Meta webhook signature verification** — `X-Hub-Signature-256` HMAC over the **raw body** (captured via `express.json({ verify })`) using the App Secret. Forged webhooks → 401. **Rollout-safe**: if `META_APP_SECRET` is unset it warns-and-allows, so deploying can't break the live bot before the secret is set. |
| **BOT-04 / SEC-03** (P1) | `src/config/env.ts` + `server.ts` | Removed the public `JWT_SECRET` fallback (`metnmat-change-me-in-production` → a clearly-dev value); added `assertConfig()` **fail-fast** (called at startup) that throws in production if `JWT_SECRET`/`ALLOWED_ORIGINS`/`MONGODB_URI`/`GROQ_API_KEY` are missing/insecure. |
| **BOT-05** (P1) | `src/config/env.ts` + `server.ts` | `ALLOWED_ORIGINS` no longer defaults to `*` in production (empty → blocked, and `assertConfig` requires it). CSP `frame-ancestors *` → scoped to the METNMAT domains (configurable via `WIDGET_FRAME_ANCESTORS`). |
| **BOT-07** (P1) | `src/lib/rate-limit.ts` *(new)* + `widget.routes.ts` | **Rate limiting** on the unauthenticated LLM-driving endpoints (`/widget/session`, `/widget/message`) — 20/min/IP — via the shared **Upstash** instance (in-memory fallback, fail-open). Protects Groq/WhatsApp spend + DoS. |
| config | `.env.example` + local `.env` | Documented `AGENT_API_KEY`, `WIDGET_FRAME_ANCESTORS`, `UPSTASH_REDIS_REST_URL/_TOKEN`, `META_APP_SECRET`; wired Upstash creds into the local `.env`. |

**Still open for the chatbot (need your input):** `META_APP_SECRET` (Meta dashboard) to *enforce* webhook signatures; `AGENT_API_KEY` if the human-agent console is used. Until set, signatures are skipped-with-warning and agent endpoints are disabled (both fail-safe). Staged separately: BOT-06 (ticket-lookup IDOR), BOT-08 (scoped DB API + re-enable Mongo TLS verify), BOT-09 (durable action audit log).

---

---

# Wave 5 — CMS operational collections (2026-06-19)

**Verification:** dashboard `tsc` ✅ · website `tsc` ✅ · website lint ✅. All additive (no required new fields → seed + existing products unaffected). New collections use only built-in field types, so the committed admin importMap stays valid (no regeneration needed).

| Finding | File(s) | Change |
|---|---|---|
| **QUOTE-01** (P1) | `collections/Quotations.ts` *(new)* + `hooks/workflow-gates.ts` *(new)* | **Quotations** module — line items, amounts, validity, terms, PDF, revisions, RFQ + customer links, prepared/approved-by. Workflow gates: commercial **approval requires Accounts/Admin**; only an **approved** quote with a **PDF** can be marked **Sent**; `sentAt` auto-stamped. `approvedBy` locked to Accounts/Admin via field access. |
| **PAY-01** (P1) | `collections/PaymentEvents.ts` *(new)* + `webhook/route.ts` + `orders.service.ts` | **Payment Events** — append-only (create via internal key only; no update/delete) log of provider/order/payment ids, event type, amount, `signatureVerified`, idempotency key, raw payload. The **Razorpay webhook now writes an event for every verified callback** (incl. unknown-order cases), via best-effort `recordPaymentEvent()`. |
| **STOCK-01** (P1) | `collections/StockLedger.ts` *(new)* | **Stock Ledger** — append-only stock movements (in/out/reserved/released/adjustment/damaged/returned) with before/after quantities and order/RFQ links. Read = any staff; create = Inventory/Admin; no update/delete. |
| **TASK-01** (P2) | `collections/Tasks.ts` *(new)* + `workflow-gates.ts` | **Tasks** — type, priority, status, assignee, due date, entity links, completion note + evidence, approval fields. Gate: **cannot mark Done without a completion note** (and a quotation task needs a linked quotation). |
| **PROD-01** (P1) | `collections/Products.ts` | Added (optional, defaulted) **GST rate, HSN/SAC, country of origin, productType (in-stock/made-to-order/quote-only/discontinued), stockQty/reservedStock/lowStockThreshold, package weight, priceApprovalStatus (Accounts-locked), lastReviewedAt** under a "Tax, stock & fulfilment" group. |
| audit | `hooks/audit.ts` | Audit-log labels now recognise `orderNumber`/`quotationNumber`/`ticketNumber` (not just title/name). |
| register | `payload.config.ts` | Registered the 4 new collections. |

**Note:** the new collections appear in the admin only after the **dashboard is deployed**. No importMap change and no schema migration is required (Mongo is schemaless; new optional fields/collections materialise on write).

**Still staged (CMS):** Shipments, Invoices, Returns/Replacements, Leads, Notifications, Integration Logs; auto stock-decrement on order-paid; RFQ status-enum expansion + gates; SKU unique constraint (needs a duplicate-cleanup first).

---

---

# Wave 6 — Website conversion & SEO (2026-06-19)

**Verification:** website `tsc` ✅ · website lint ✅.

| Finding | File(s) | Change |
|---|---|---|
| **UX-01** (P1) + **A11Y-01** | `frontend/components/commerce/quote-form.tsx` *(new)* + `app/quote/page.tsx` | The **dead `/quote` form** (which posted nowhere and silently dropped every lead) is now a real client component that POSTs to `/api/quote` with validation, loading/success/error states, and proper `htmlFor`/`id` labels. Mirrors the working ContactForm pattern. |
| **SEO-06** (P3) | `app/shop/p/[slug]/page.tsx` | Product pages now emit `openGraph` + `twitter` (`summary_large_image`) metadata **with the product image**, so shared product links show the product, not the generic site card. |

**Deferred (need visual QA in a preview session — not blind-edited on a live store):** PERF-01 (`next/image` migration of product gallery + catalog cards) and A11Y-02 (lightbox focus trap).

---

# Wave 7 — Internal-key hardening (2026-06-19)

**Verification:** website `tsc` + lint ✅ · dashboard `tsc` ✅.

| Finding | File(s) | Change |
|---|---|---|
| **KEY-01** (P2) | `apps/website/src/backend/lib/internal-key.ts` *(new)*, `apps/dashboard/src/lib/internal-key.ts` *(new)* | Added `safeKeyEqual()` — **constant-time** secret comparison (a plain `===`/`!==` leaks length + matching-prefix length via timing). |
| **KEY-01** | website `revalidate/route.ts`, `support/notify/route.ts`; dashboard `access/index.ts` (`internalOrCanManageCatalog`, `fieldAccountsOrInternal`), `hooks/order-workflow.ts` | All `x-internal-key` checks now use the timing-safe compare. |

**Staged (deliberate, needs coordinated env rollout):** SEC-06 full per-purpose key split (`CMS_ORDER_WRITE_KEY`/`CMS_TICKET_WRITE_KEY`/`CMS_REVALIDATE_KEY`/`CHATBOT_READ_KEY`) — requires per-collection access helpers on the CMS + matching send-side keys, with `INTERNAL_API_KEY` fallback; best done as its own change. **BOT-06** (chatbot ticket-lookup IDOR) needs Mastra `runtimeContext` plumbing to bind lookups to the verified channel identity — do with the bot running.

---

---

# Wave 8 — Remaining CMS collections + RFQ workflow (2026-06-19)

**Verification:** dashboard `tsc` ✅. All additive (new collections + optional Enquiry fields → seed/existing data unaffected); built-in field types only (no importMap change).

| Finding | File(s) | Change |
|---|---|---|
| **SHIP-01** (P2) | `collections/Shipments.ts` *(new)* | Carrier, tracking number/URL, dispatch/delivery dates, items, status; linked to order. Inventory-managed. |
| **SHIP-01** (P2) | `collections/Invoices.ts` *(new)* | GST tax invoices — number, order/customer, dates, subtotal/GST/total, **GST breakup** array, PDF, status. Accounts-managed; super-admin delete only. |
| **RET-01** (P2) | `collections/ReturnRequests.ts` *(new)* + `workflow-gates.ts` | RMA lifecycle — reason, action (replace/refund/repair), items, refund amount, linked replacement order. **Gate: cannot Resolve/Close without a resolution note.** |
| **TASK-01** (P2) | `collections/Leads.ts` *(new)* | Top-of-funnel leads (separate from RFQs) — channel source, status, owner, follow-up. |
| **TASK-01** (P2) | `collections/Notifications.ts` *(new)* | Staff notifications — type, message, recipient, read flag, related entity. |
| **TASK-01** (P3) | `collections/IntegrationLogs.ts` *(new)* | Append-only log of outbound integration attempts (chatbot-sync/revalidate/webhook) — status, summary, error, duration, payload. |
| **ENQ-01 + ENQ-02** (P1) | `collections/Enquiries.ts` + `workflow-gates.ts` | RFQ status enum expanded from 4 → the full **12-stage workflow** (new → file-verification → technical-review → feasible/not-feasible → pricing → quotation-approval → quotation-sent → follow-up → won/lost/closed; legacy values kept). Added owners, priority, expected/quote value, quotation link/ref/file, follow-up dates, technical note, close/loss reasons, internal/customer notes. **Gates: can't mark Quotation-sent without a quotation, Not-feasible without a technical note, or Closed/Lost without a reason.** **Audit hooks added** (RFQ changes were previously untracked). |
| register | `payload.config.ts` | Registered all 6 new collections. |

**CMS collection coverage is now complete** vs the required model (27 collections). **Still staged:** auto stock-decrement + reservation on order-paid (writes product stock + a ledger entry — needs testing against live stock); Product Variants/Specifications as dedicated collections (currently arrays on Products); SKU unique constraint (needs duplicate cleanup first).

---

---

# Wave 9 — Automated tests (2026-06-19)

**Verification:** `pnpm test` → **39 tests, 6 suites, all passing** (393ms). Apps still `tsc`/lint clean; `--frozen-lockfile` valid.

Set up **Vitest** at the workspace root (tests live in `test/`, importing source via relative paths so the apps' own `tsc`/`next build` never see them — no test-type pollution). Added `pnpm test` and a **CI test step**. Coverage of the security-critical pure logic the audit asked for:

| Suite | Covers |
|---|---|
| `file-signature.test.ts` | Magic-byte detection (PDF/PNG/JPEG/GIF/WEBP/HEIC), rejection of spoofed HTML/EXE/ZIP, `safeFilename` path/control-char stripping + length cap |
| `internal-key.test.ts` | `safeKeyEqual` constant-time compare (match / mismatch / length-mismatch / falsy) — both website + dashboard impls |
| `rate-limit.test.ts` | In-memory limiter: allow-up-to-limit then block w/ retryAfter, per-key isolation, window reset |
| `workflow-gates.test.ts` | Quotation (approve→send + PDF + Accounts-only), Task (completion-note + quotation gate), Return (resolution gate), RFQ (quotation/technical-note/reason gates) |
| `order-workflow.test.ts` | Sales blocked from marking paid / changing total, illegal transition blocked, Accounts allowed, internal-key server bypass |
| `access.test.ts` | `hasRole` matching; `bootstrapAllowed` **blocked in prod without the flag**, allowed with it |

**Files:** `vitest.config.ts`, `test/*.test.ts` (6), root `package.json` (`test` script + vitest dep), `.github/workflows/ci.yml` (test step).

---

---

# Wave 9 — Chatbot DB TLS + internal-key segregation (2026-06-19)

**Verification:** dashboard `tsc` ✅ · website `tsc` + lint ✅ · chatbot `src/` `tsc` (6 pre-existing, none in edited files) ✅.

### BOT-08 — restore MongoDB TLS hostname verification
| File | Change |
|---|---|
| `Metnmat-customer-agent-main/src/lib/connect-to-db.ts` | The Mongo connection bypassed hostname verification entirely (`checkServerIdentity: () => undefined`, a MITM gap). Now runs the **standard `tls.checkServerIdentity`** when a cert is present (rejecting a valid-CA-but-wrong-host cert), and only skips on the null-cert edge case that triggered the original Bun shim crash — strictly safer, and a no-op in the path that was crashing. *(The broader "route tools through a scoped DB API instead of raw mongoose" remains staged.)* |

### SEC-06 — split the one broad INTERNAL_API_KEY into purpose-scoped keys
Backward-compatible: each sender sends `<purpose key> || INTERNAL_API_KEY`; each verifier accepts `<purpose key> || INTERNAL_API_KEY`. **With no purpose keys set, behaviour is byte-for-byte identical to before.** Set a purpose key on BOTH apps to use it; once all callers are migrated, the `INTERNAL_API_KEY` fallback can be dropped for true isolation.

| Key | Flow | Files |
|---|---|---|
| `CMS_ORDER_WRITE_KEY` | website → CMS order/payment writes | website `orders.service.ts`; dashboard `Orders`/`PaymentEvents` access, `order-workflow.ts`, `fieldAccountsOrInternal` (new `internalOrderOrManage`) |
| `CMS_TICKET_WRITE_KEY` | website ↔ CMS ticket writes + ticket-notify | website `tickets.service.ts`, `support/notify` route; dashboard `Tickets` access (new `internalTicketOrManage`), `ticket-notify.ts` hook |
| `CMS_REVALIDATE_KEY` | dashboard → website cache revalidate | dashboard `revalidate.ts` hook; website `revalidate` route |
| helpers | — | `internal-key.ts` on both apps gained `outboundKey()` / `inboundKeyMatches()` / `verifyKey()` (all timing-safe). Reads (customer account pages, enquiry-file reads) intentionally stay on `INTERNAL_API_KEY`. |

**Test infra:** Vitest installed at the workspace root + `vitest.config.ts` added; the actual test suites were deferred (you redirected to BOT-08/SEC-06) and remain a ready next step.

---

---

# Wave 10 — Automated tests (2026-06-19)

**Verification:** `pnpm test` → **39 tests across 6 suites, all passing**; `--frozen-lockfile` validates (CI install gate).

| File | Covers |
|---|---|
| `test/file-signature.test.ts` | Magic-byte detection (PDF/PNG/JPEG/GIF/WEBP/HEIC), rejection of HTML/EXE/ZIP + spoofed types, `safeFilename` path-traversal / control-char / length handling. |
| `test/internal-key.test.ts` | `safeKeyEqual` (timing-safe), purpose-key resolution + fallback (`outboundKey`/`verifyKey`). |
| `test/rate-limit.test.ts` | `limitRate` fixed-window math (allows up to limit, blocks over, independent keys, `retryAfter`). |
| `test/workflow-gates.test.ts` | Quotation (approve→send gate + PDF), task (completion-note gate), return (resolution gate), RFQ (quotation/technical-note/reason gates). |
| `test/order-workflow.test.ts` | Order payment-state role gate, illegal-transition rejection, amount immutability, internal-key bypass. |
| `test/access.test.ts` | `hasRole`, `bootstrapAllowed` (production gate). |

Infra: Vitest at the workspace root (`vitest.config.ts` — tests import source via relative paths, so the apps' own `tsc`/`next build` never see them). Root `test` script + a **Test step in CI** (`.github/workflows/ci.yml`), so the suite runs on every push between typecheck and build.

---

---

# Wave 11 — Image optimization + lightbox a11y (2026-06-19)

**Verification:** website `tsc` ✅ · lint ✅ · `remotePatterns` confirmed to cover every image host (`mediaUrl` returns only the CMS origin or `storage.googleapis.com`, both configured) → no `next/image` runtime host-crash. **Recommend a quick visual pass on a product page post-deploy** (pixel-level layout can't be verified headless without the live CMS data).

| Finding | File | Change |
|---|---|---|
| **PERF-01** (P2) | `frontend/components/commerce/catalog-product-card.tsx` | Catalog card image migrated from raw `<img>` to **`next/image`** (`fill` + `sizes`, layout-equivalent `relative` wrapper) → responsive `srcset`, WebP/AVIF, no CLS. |
| **PERF-01** (P2) | `frontend/components/commerce/product-gallery.tsx` | Main gallery crossfade images + thumbnails migrated to `next/image` (`fill` + `sizes`, `priority` on the first slide for LCP). The full-screen lightbox image stays a raw `<img>` (free-size, no fixed dimensions). |
| **A11Y-02** (P3) | `product-gallery.tsx` | Lightbox now has an accessible name (`aria-label`), **moves focus to the close button on open and restores it to the trigger on close**, and **traps Tab** within the dialog. Close button got an explicit handler. |

---

## Not applied (intentionally staged — see PRODUCTION_AUDIT_REPORT.md §10)

Secret rotation/move to Secret Manager · super-admin bootstrap env-gate · chatbot webhook signatures & widget auth · Razorpay webhook · Redis rate limiting · 9-role RBAC + field-level payment access · order/RFQ state machines · new collections (Quotations/PaymentEvents/StockLedger/Tasks/etc.) · PIN-login replacement · legal-name reconciliation · `/quote` wiring · GCS ACL verification · chatbot `git init`.
