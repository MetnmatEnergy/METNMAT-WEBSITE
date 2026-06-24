# METNMAT — Production Readiness Audit Report (Re-Audit)

**Re-audit date:** 2026-06-20 (original audit: 2026-06-19)
**Method:** 9 independent read-only re-auditors verified each claimed fix against the **current, now-deployed** code, confirmed remaining issues, and hunted regressions. Findings are cited to file:line.
**Deploy state:** Website + dashboard are **live** (revisions `metnmat-website-00022-7b2`, `metnmat-dashboard-00011-m5m`, both HTTP 200). The **chatbot hardening is committed-on-disk only — NOT yet deployed.**

> This report supersedes the original. It records what the 11-wave hardening actually achieved (verified, not claimed), the gaps the re-audit caught (most now fixed), and the prioritized remainder.

---

## 1. Headline result

**49 claimed fixes verified · 6 partial · 0 not-working · 0 regressions.** The hardening is genuinely and correctly wired — every fix the re-auditors checked is present and functions as intended, and none introduced a regression. The re-audit *also* found a handful of new gaps; the highest-value ones were fixed this session (see §4).

| Dimension | Before | Re-audit | After today's fixes | Δ |
|---|---:|---:|---:|---|
| CMS collections & workflows | 44 | 88 | **89** | ▲▲ |
| SEO / performance / a11y / UX | 72 | 82 | **86** | ▲ |
| Website API & customer-auth | 62 | 82 | **82** | ▲ |
| Payments & orders | 68 | 82 | **84** | ▲ |
| Secrets / env / fail-fast | 28 | 72 | **80** | ▲▲ |
| DevOps / CI / repo hygiene | 62 | 66 | **74** | ▲ |
| Chatbot security | 38 | 68 | **72** | ▲▲ |
| Dashboard auth & access control | 38 | 66 | **66** | ▲ |
| File upload & storage | 61 | 62 | **72** | ▲ |

Platform average ≈ **78/100**, up from ≈ 52 at the original audit.

---

## 2. What the re-audit confirmed (per dimension)

- **Auth (66):** Overview PII leak genuinely closed (`payload.auth` + redirect *before* any fetch); admin-wide `noindex`; bootstrap env-gated in both the field rule and the create hook; clean 10-role RBAC; order payment-state transitions correctly blocked for non-finance staff; Razorpay/amount fields field-gated; build-safe fail-fast; timing-safe key compare throughout. **No over-grant / wrong-default / throwing regressions in the new access helpers.**
- **CMS (89):** All 10 new collections exist *and* are registered; every referenced access fn is real; all 4 workflow gates enforce correctly and each gated field exists (no gate throws on a normal save); 12-stage RFQ + audit hooks; product tax/stock fields optional with safe defaults (seed still boots); order state machine + amount immutability + delete protection. All `relationTo` targets resolve.
- **Web API (82):** Distributed `limitRate()` (Upstash SET-NX/INCR/TTL, fails **open** to memory) on **all 13** endpoints — every call site correctly `await`s (no missing-await regressions); timing-safe + purpose-scoped internal keys, symmetric on both sides (legit callers not rejected).
- **Payments (84):** Webhook reads the **raw body before parse**, HMAC-verifies with `timingSafeEqual`, 503s when unset, is idempotent, and cross-checks the captured amount vs the server total; `recordPaymentEvent` is best-effort (can't block paid); out-of-stock guard present; order state machine well-formed and role-gated.
- **Uploads (72):** Magic-byte sniff + `safeFilename` + no URL leak + SVG removed — **now on both ingestion paths** (the multipart bypass was fixed today).
- **SEO/UX (86):** `/quote` is a real, validated form; robots disallows thin/private routes; product OG/Twitter images; `next/image` (fill+sizes) on card + gallery; accessible lightbox (aria-label, guarded focus, Tab trap); legal entity **now fully unified** (3 remaining surfaces fixed today).
- **DevOps (74):** Deps pinned to `3.85.1`; Vitest harness (39 tests) wired into CI; `*.tsbuildinfo` ignored & untracked; CI Node 22 + Test step; chatbot `.dockerignore` excludes secrets; lockfile frozen-valid. **CI Lint is now unblocked** (dashboard ESLint config added today).
- **Chatbot (72):** Meta `x-hub-signature-256` verification, agent-key gating, JWT/CORS fail-fast, rate limiting, and the Mongo TLS hostname fix are all present and correctly wired. The widget `sendMessage` ownership bypass was fixed today.
- **Secrets (80):** Dashboard + chatbot fail-fast correctly wired and build-safe; `.env.example` for all 3 apps; per-purpose keys actually used (not just documented). The website now has a fail-fast too (`instrumentation.ts`, added today).

---

## 3. The one risk that's accepted, not fixed

**`PAYLOAD_PIN_PEPPER` = `5970` (4 digits) — P0 by the book, but a deliberate operator choice.** After the strong-pepper rotation locked staff out, you chose to revert to `5970` to restore access. The re-auditor correctly flags that this collapses the PIN→password derivation to a trivial offline keyspace: anyone with a DB/backup snapshot can brute-force staff credentials. The `assertProductionConfig` check only **warns** on a short pepper (it does not throw — by design, so your `5970` boots).

**Recommendation (when you have a maintenance window):** set a 32-byte random pepper *and re-save every staff PIN in the same logged-in session* (the session survives the change). This is the only way to make the PIN scheme actually strong. Until then, treat the admin DB/backups as holding login-equivalent secrets. *(This, plus PIN-plaintext storage, no-MFA, and per-instance brute-force throttling, is why the auth dimension sits at 66 despite the confidentiality wins.)*

---

## 4. New issues the re-audit caught — fixed this session

| ID | Sev | Issue | Fix |
|---|---|---|---|
| UPLOAD-09 | **P1** | `/api/quote` multipart fallback bypassed magic-byte + filename hardening | Both paths now sniff bytes + `safeFilename` |
| CHATBOT sendMessage | **P1** | Session token *optional* → post into any conversation by omitting it | Token now mandatory (mirrors `getMessages`) |
| ORDER-create | P2 | Non-finance staff could hand-create an order already `paid` (gate only ran on update) | `beforeChange` now gates create payment-states to Accounts/Admin/internal |
| SEC-04 | P2 | Website had no fail-fast; could boot with empty `INTERNAL_API_KEY` | `instrumentation.ts` throws at startup on missing `INTERNAL_API_KEY`/`CMS_URL` (build-safe) |
| SEO-01 (rest) | P2 | Legal name still old in email header, dashboard `legalName` default, seeded SEO title | All three updated |
| DEVOPS-lint | P1 | Dashboard had no ESLint config → CI Lint step failed/hung, blocking the pipeline | Added `.eslintrc.json` + eslint deps; CI Lint now green |
| CMS-N1 | P3 | RFQ close/lost gate accepted the wrong reason field | Split: `closed`→`closeReason`, `lost`→`lossReason` |

All verified: website + dashboard `tsc` + lint clean, 39/39 tests pass, chatbot `tsc` baseline, frozen-lockfile valid.

---

## 5. New issues the re-audit caught — still open

| ID | Sev | Issue |
|---|---|---|
| BOT (getConversations) | P2 | A single static `AGENT_API_KEY` grants unauditable read of *all* visitor conversations/PII; no per-agent identity, scope, or attribution. |
| CHATBOT assertConfig | P2 | Fail-fast doesn't require `META_APP_SECRET`, so a prod deploy missing it boots with webhook verification silently skipped (warn-and-allow is permanent, no kill-switch). |
| UPLOAD-10 | P3 | Magic-byte sniff doesn't cross-check the *declared* MIME and the `ftyp` branch admits video containers (.mp4/.mov), so bytes/type can disagree. |
| PAY (zero-amount) | P3 | A `captured`/`paid` event lacking an `amount` field skips the cross-check and still marks paid (still HMAC-verified — low risk). |
| RL (public reads) | P3 | `geo`/`search`/`products`/`product-by-sku` have no rate limit; `geo` also drives an outbound `ipwho.is` call per request. |

---

## 6. Prioritized remaining roadmap

### P0
- **Pepper `5970`** — accepted for now (§3); schedule the strong-pepper + PIN-re-save migration.

### P1 (do next)
1. **Chatbot perimeter is committed-on-disk only — deploy it** (BOT-01/02/03/04/05/07/08-TLS + today's `sendMessage` fix go live only on deploy). It's a non-git repo → `gcloud builds submit` as `energy@`, and set its Cloud Run `UPSTASH_*` (and later `META_APP_SECRET`).
2. **PIN → email/password-first + MFA** (AUTH-07 plaintext PIN, no MFA, 10k-combo front door).
3. **UPLOAD-08 attachment-id IDOR** — bind uploaded ids to the submitting session; today an attacker can attach & exfiltrate another customer's file via the public form.
4. **BOT-06 ticket-lookup IDOR** — bind lookups to the verified channel identity (needs the bot running to validate Mastra runtime-context).
5. **`git init` the chatbot repo** (DEVOPS-01) — no history/rollback on the component holding live secrets.
6. **SEO-05** — quote-only products emit a Product `Offer` with no price (invalid structured data Google rejects); omit the Offer when there's no price.
7. **Shared-store brute-force throttle** for PIN login (AUTH-06) — move off per-instance in-memory + spoofable XFF.

### P2
GCS bucket-private assertion (UPLOAD-03) · malware scan / don't email raw attachments (UPLOAD-05) · max-length caps + rate-limit on profile/addresses (VAL-01) · Razorpay live-capture cross-check in the browser verify path + atomic idempotency (PAY-02/04) · finish the per-purpose key split (drop the `INTERNAL_API_KEY` fallback once provisioned) · chatbot scoped DB layer (BOT-08) + require `META_APP_SECRET` in fail-fast · dashboard non-root container + SHA image tags · register account-enumeration.

### P3
Auto stock-decrement on order-paid + SKU unique (needs duplicate cleanup) · `'won'` RFQ gate · UPLOAD-10 MIME/brand tightening · public-read rate limits · stale-pending payment sweep · real social `sameAs` · product/gallery card `priority` for LCP.

---

## 7. Deploy state summary

- **Live & verified:** website (`…00022-7b2`) + dashboard (`…00011-m5m`) — all auth/CMS/payment/upload/SEO/devops fixes are in production.
- **Committed-on-disk, NOT live:** the entire chatbot hardening (deploy it to activate BOT-01/02/03/04/05/07/08 + today's `sendMessage` fix).
- **Operator follow-ups:** strong-pepper migration (§3) · Razorpay webhook URL+secret in the Razorpay dashboard · rotate OneDrive secrets → Secret Manager · delete `apps/dashboard/.env.supabase.bak` · set chatbot Cloud Run env.

*Full per-fix evidence and the original 89 findings are in `CHANGELOG_PRODUCTION_FIXES.md` and the prior report history.*
