# METNMAT — Production Readiness Checklist

**Legend:** ✅ done (this wave) · ⚠️ partial · ⛔ to do · 🔒 manual (needs human/provider access)
Updated 2026-06-19. Cross-reference IDs live in `PRODUCTION_AUDIT_REPORT.md`.

---

## Security

- ✅ Admin overview no longer leaks counts/PII to anonymous users *(AUTH-01)*
- ✅ Admin service returns `X-Robots-Tag: noindex` *(AUTH-08)*
- ✅ Public `create-first-user` link removed from overview *(AUTH-02)*
- ⛔ Super-admin/first-user bootstrap gated behind a prod env flag (`ALLOW_FIRST_USER_BOOTSTRAP`) *(AUTH-02)*
- ⛔ Replace shared 4-digit PIN login with email/password in production *(AUTH-05/07)*
- ⛔ Structure for MFA/2FA on high-privilege accounts
- ⛔ PINs not stored in plaintext (store only the derived hash) *(AUTH-07)*
- ⛔ Strong random `PAYLOAD_PIN_PEPPER` (not a 4-digit number); remove `"metnmat-dev-pepper"` fallback *(SEC-07)*
- ⛔ Field-level access so only accounts/admin can change Order `status`/`total`/`razorpay*` *(AUTH-03)*
- ⛔ Full 9-role RBAC (super-admin, admin, operations-manager, sales, technical, inventory, accounts, support, read-only-auditor) *(AUTH-04)*
- ⛔ Brute-force protection in a shared store (Redis), keyed on trusted IP not raw XFF *(AUTH-06)*
- ⛔ Auth cookie: always `Secure`, consider `__Host-`/`SameSite=Strict` *(AUTH-09)*
- 🔒 Rotate all secrets that touched OneDrive `.env`; move to GCP Secret Manager *(SEC-01)*
- 🔒 Delete `apps/dashboard/.env.supabase.bak` + revoke that Supabase S3 key *(SEC-02)*
- ⛔ Fail-fast in production when `PAYLOAD_SECRET`/`MONGODB_URI`/`JWT_SECRET` are missing; remove empty fallbacks *(SEC-03/04)*
- ⛔ Split `INTERNAL_API_KEY` into purpose-scoped keys + HMAC/timestamp/replay protection; constant-time compare *(SEC-06, KEY-01)*

## Rate limiting

- ⛔ Shared (Redis/Upstash/Memorystore) limiter for: login, register, reset, forgot *(RL-01)*
- ⛔ …contact, quote, support, ticket-lookup *(RL-01, TKT-01)*
- ⛔ …checkout, payment verify, file upload *(UPLOAD-06)*
- ⛔ …all chatbot/webhook endpoints *(BOT-07)*
- ℹ️ Current in-memory limiter is per-instance only — **ineffective on multi-instance Cloud Run**.

## File uploads

- ✅ Server-side allowlist (PDF + images) *(pre-existing)* + ✅ magic-byte signature check *(UPLOAD-01)*
- ✅ Block SVG/HTML/JS/EXE/ZIP (declared + sniffed) *(UPLOAD-01/02)*
- ✅ Per-file (10 MB) + total (5 file / 20 MB) caps *(pre-existing)*
- ✅ Filenames sanitized *(UPLOAD-04)*; ✅ storage URL not leaked to client *(UPLOAD-07)*
- ✅ Files in cloud storage (GCS), not app runtime *(pre-existing)*
- 🔒 Verify GCS bucket is private (UBLA, no `allUsers`); pass `acl:'Private'`; signed URLs for private files *(UPLOAD-03)*
- ⛔ Ownership binding on `attachmentIds` (stop IDOR) *(UPLOAD-08)*
- ⛔ `scanStatus` (pending/safe/rejected); don't email raw unscanned attachments *(UPLOAD-05)*

## CMS workflow

- ✅ Audit failures are logged (not silently swallowed) *(AUD-02)*
- ⛔ Audit hooks on Enquiries (RFQ) and Customers *(ENQ-01, AUD-01)*
- ⛔ Order state machine + immutable post-paid snapshot + no hard delete *(ORD-01/02)*
- ⛔ RFQ workflow: full status enum + required-file/required-reason/technical-note gates *(ENQ-02)*
- ⛔ Quotation collection (draft→…→sent, only-approved-can-send, revisions) *(QUOTE-01)*
- ⛔ Payment Events collection (append-only, raw payload, signature-verified flag, idempotency key) *(PAY-01)*
- ⛔ Stock Ledger + product stock quantities/reserved/threshold; ledger entry per change *(STOCK-01, PROD-01)*
- ⛔ Tasks collection with completion-note + type-specific gates *(TASK-01)*
- ⛔ Shipments, Invoices, Returns/Replacements, Leads, Notifications, Integration Logs *(SHIP-01, RET-01, TASK-01)*
- ⛔ Products: unique+required SKU, GST/HSN, productType, status enum, price-approval *(PROD-01/02/03)*
- ⛔ Ticket cannot resolve/close without a resolution note *(TKT-01)*

## Website

- ✅ Private/utility routes disallowed in robots.txt *(SEO-02/03)*
- ✅ Out-of-stock items rejected at checkout *(PAY-03)*
- ⛔ `/quote` form wired to the enquiries API + labelled inputs *(UX-01, A11Y-01)*
- ⛔ Single legal entity name = `METNMAT INNOVATIONS PRIVATE LIMITED` everywhere (JSON-LD/OG/footer/**Razorpay modal**) *(SEO-01)*
- ⛔ `next/image` for product/catalog images *(PERF-01)*
- ⛔ Product OG/Twitter image; lightbox modal a11y; remove placeholder TODO copy *(SEO-06, A11Y-02, UX-02)*
- ✅ sitemap.xml + robots.txt + per-page canonicals + Org/Product/FAQ/Breadcrumb JSON-LD *(pre-existing, strong)*

## Payment

- ✅ Server-side amount calculation (never trust client price) *(pre-existing)*
- ✅ Server-side Razorpay signature verification (constant-time) *(pre-existing)*
- ✅ Price snapshot at order time *(pre-existing)*
- ⛔ Webhook endpoint (raw-body signature, idempotent, source of truth) *(PAY-01, SEC-05)*
- ⛔ Cross-check captured amount/status with Razorpay in verify+webhook *(PAY-02)*
- ⛔ Idempotent compare-and-set on paid transition; email only on real transition *(PAY-04)*
- ⛔ Reconcile abandoned/failed payments (webhook + stale-pending sweep) *(PAY-05)*
- ⛔ Immutable order timeline events *(ORD-01)*

## Deployment / DevOps

- ✅ Dashboard deps pinned (no `latest`); lockfile reproducible *(DEVOPS-02)*
- ✅ Chatbot `.dockerignore` excludes secrets from build context *(DEVOPS-03)*
- ✅ Dashboard `typecheck` script in CI; ✅ CI Node 22 matches Docker *(DEVOPS-04/05)*
- ✅ `*.tsbuildinfo` ignored + untracked *(DEVOPS-08)*
- 🔒 `git init` the chatbot repo (verify `.env`/`deploy/secrets.env` ignored first) *(DEVOPS-01)*
- ⛔ Secrets from Secret Manager only (no committed `.env`) *(SEC-01)* — Cloud Run path already uses `--set-secrets`
- ⛔ SHA-tagged images for instant rollback *(DEVOPS-06)*
- ⛔ Dashboard container runs as non-root *(DEVOPS-07)*
- ⛔ Dashboard `/api/health` route *(DEVOPS-10)*; chatbot CI *(DEVOPS-09)*
- ⛔ `apps/dashboard/.eslintrc.json` so `next lint` is deterministic in CI *(new finding)*

## Testing (none exist yet — add incrementally)

- ⛔ Unauthenticated user cannot read admin data (overview, collections)
- ⛔ Role permissions (sales cannot change payment status)
- ⛔ First-user bootstrap disabled once an admin exists
- ⛔ SKU uniqueness; published-product required fields
- ⛔ RFQ creation + status-transition validation
- ⛔ Upload: reject spoofed-MIME / oversize / disallowed type *(file-signature.ts is unit-testable now)*
- ⛔ Checkout server-side price calc; invalid-quantity / out-of-stock rejection
- ⛔ Payment signature verification; duplicate-webhook idempotency
- ⛔ Ticket cannot close without note; task cannot complete without note/quotation ref
- ⛔ Admin noindex header present; rate-limit behaviour
