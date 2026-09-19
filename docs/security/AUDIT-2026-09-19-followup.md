# METNMAT security — final remediation report, 2026-09-19

Follow-up to [`AUDIT-2026-09-17.md`](./AUDIT-2026-09-17.md). Same method: read-only
review of the four apps, the AWS account `976134557584` and the shared v2 host,
plus production-dependency and git-history scans and safe live probes. No
production data was changed. Secret **names** only, never values. Nothing was
merged or deployed in this pass; code fixes are on branches / open PRs awaiting
explicit confirmation.

## 1. Overall status — PARTIALLY SAFE, improving

No public, unauthenticated, exploitable-right-now vulnerability was found in this
pass. The four P1 application holes from 2026-09-17 are fixed and verified live
again today (webhooks 401, headers present, PII collections 403, tool identity
session-bound). What keeps the rating at "partially safe" is **infrastructure
blast radius**, not a live app exploit: a compromised administrator role still
exists on the account, ~31 burned secrets are still stored, root and a laptop
admin key are still in daily use, and a real database credential sits in the
**public** website repo's git history. Each turns one stolen credential into a
much larger incident — which is exactly how the August compromise escalated.

## 2. Verified fixed (re-checked live 2026-09-19)

| Vulnerability | Sev | System | Verification |
|---|---|---|---|
| Meta webhook forgery (unsigned POST ran the LLM) | P1 | chatbot | `POST /api/webhook/{instagram,facebook}` empty body → 401 |
| Model-supplied identity in tools (read/alter any customer) | P1 | chatbot | spoofed-number lookup returns "no tickets under your session" |
| Cross-customer orders/invoices via email change | P1 | CMS | verified fix in code + live PII collections 403 |
| Admin → super-admin takeover | P1 | CMS | `staff-account-guard` present on `Users.beforeChange` |
| Guessable ticket ids | P2 | web+CMS | new ids ~49 bits; status/reply per-email limited |
| Public `enquiry-uploads` create | P2 | CMS | anon `POST /api/enquiry-uploads` → 403 |
| Missing CMS headers / framework banner | P2 | CMS | HSTS/nosniff/frame present; no `X-Powered-By` |
| Chatbot listened on all interfaces | P2 | host | binds `127.0.0.1:3002` |
| CAPTCHA/2FA env-bypass; OTP brute-force | P2 | Command Center | fixed in PR (see §11) |

New scans this pass, all clean: **command injection** (no `child_process`,
`eval`, `Function`, `vm`, or dynamic `import()` of user input in any of the four
codebases — every `exec` hit is a regex or Mongoose query); **CI/CD** (all
deploy workflows use GitHub OIDC, no SSH/`appleboy`, and every repo's Actions
secrets are exactly `AWS_DEPLOY_ROLE_ARN` + vars `ARTIFACT_BUCKET`,
`PROD_INSTANCE_ID` — no stale `VM_*`/`GCP_*`/`DASHBOARD_*`); **public surface**
(`.env`, `.git/config`, `server-status`, source maps all 404; health endpoints
leak only booleans; CC APIs redirect anonymous callers to login).

## 3. Remaining vulnerabilities (in the code/app layer)

| Id | Sev | System | Exploitability | Remediation |
|---|---|---|---|---|
| CC-4 | P1→ | Command Center | Holder of the WhatsApp-worker key could read the business DB via `assistant/debug` | Debug route now gated behind an admin session (PR, §11). Remaining: split an ingest-only key, drop `assistantOwnerPhone` from `/config`, scope ack/attachment actions — **needs worker-env testing (owner)** |
| CMS-7 | P2 | CMS | A leaked `INTERNAL_API_KEY` reads most operational PII | Provision the per-purpose keys and stop the shared-key fallback; return `where` on the single-row reads. Coordinated env change (owner window) |
| CC-5 | P2 | Command Center | Login is a username oracle + anonymous account-lockout | Uniform message; time-boxed auto-unlock |
| CC-6 | P2 | Command Center | Any authed role can list/download the whole media library | Enforce the asset's module on `/api/media*` |
| CMS-8 | P2 | CMS | `/api/users/login` unthrottled → director lockout | Rate-limit at Caddy |
| WEB-2..11, CHAT-3-tail | P3 | web/chatbot | Defence-in-depth (session revoke on logout, CSRF header check, log hygiene, nonce CSP, session token in query string) | Batched follow-up PRs |
| DEP-2 | P3 | CMS/chatbot | `sharp` 0.33.5; `whatsappcloudapi_wrapper` old `form-data`/`request` (WhatsApp not live) | Bump when convenient / before WhatsApp go-live |

## 4. AWS / IAM status

- **Old compromised admin role still exists (P1, owner).** `metnmat-dashboard-role`
  (inline `Action:* Resource:*`, reads `metnmat/prod/*` + `metnmat/chatbot/*`,
  both media buckets, Bedrock) via profile `metnmat-dashboard-profile`. **Only
  reference is the stopped, quarantined host `i-0b7f49ca3e9852d4b`** — verified
  no running instance and not the new host (which uses `metnmat-prod-host-role`).
  Safe to remove; exact commands in §12. Last used 2026-09-16.
- **`metnmat-migration` (P1, owner).** AdministratorAccess, no MFA, one active
  long-lived key (used from the laptop for SSM + Secrets Manager, including this
  audit) and one inactive key. This is also the credential this session runs on,
  which is itself the problem. Move to short-lived MFA/OIDC; delete the inactive
  key.
- **Root used for daily ops (P1, owner).** GuardDuty `RootCredentialUsage` on
  2026-09-17. Create a personal IAM/Identity Center admin with MFA; reserve root
  for billing.
- **Legacy deploy role `metnmat-dashboard-deploy` (P2, owner).** Still used by
  `deploy-whatsapp-worker.yml` (hardcoded ARN, push to master), with
  `ssm:SendCommand` on the old host + worker and `s3:PutObject *`. Cannot just be
  deleted; narrow its resources (drop the old host, scope S3 to a `worker/*`
  prefix) or migrate the worker deploy onto `metnmat-github-deploy` extended to
  the worker instance.
- **Good (verified):** prod SG 80/443 only; new-host role least-privilege;
  IMDSv2 required (hop 1) and nftables blocks IMDS for app users; every bucket
  blocks public access except the CC media bucket (public-read by design, SSE on);
  CloudTrail multi-region + validation; GuardDuty on. Worker SG still allows SSH
  from one IP and its root volume is unencrypted (P3).

## 5. Secrets / credential status (names only)

- **`energy_db_user` Atlas connection string is in git history of the PUBLIC
  website repo** (incident-response backup/inventory commits) and the private CC
  repo. Not in either current tree. **Action (owner): confirm this Atlas DB user
  is deleted or its password rotated; treat it as public.** History rewrite of a
  public repo is optional and disruptive; rotation is the real fix.
- **~31 legacy secrets** under `metnmat/prod/*` + `metnmat/chatbot/*` still
  stored (incl. `INTERNAL_API_KEY`, `PAYLOAD_SECRET`, `JWT_SECRET`,
  `RAZORPAY_KEY_SECRET`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`,
  `OPENAI_API_KEY`). Confirm the live values live in `metnmat/{web,cms,chat,cc}/env`
  then delete.
- No live AWS keys, private keys, or provider tokens found hardcoded in any
  current tree or in the chatbot history. Website/CC history otherwise shows only
  placeholders (`rzp_live_xxx`, `sk_live_9f3a2b` test fixture).
- Method limit: the history scan matches known key patterns (AWS/Stripe/Google/
  GitHub/Slack/Mongo/PEM); a bespoke secret format could be missed.

## 6. MongoDB Atlas status

- CMS connects to `cluster0.muhlfqf.mongodb.net`, db `metnmat_cms`, over SRV; the
  URI carries no `0.0.0.0`. Chatbot uses db `metnmat` (separate, correct).
- **Not verifiable from here (owner):** the Atlas **network-access allow-list**
  (confirm no `0.0.0.0/0`, only the EIP `52.66.54.7` and any needed admin IPs),
  the **DB users and their scopes** (per-app least privilege, no leftover
  `atlasAdmin`, and that `energy_db_user` above is gone), and backup posture.
  These need the Atlas console/API, for which no credential is present in this
  environment.

## 7. CI/CD status — good

All three repos deploy via GitHub OIDC to `metnmat-github-deploy`, artifact to
S3, release over SSM. No SSH deploy path remains. No stale GitHub secrets. The
only exception is the worker-deploy role (§4, AWS-5).

## 8. Public attack surface

Five hostnames on `52.66.54.7`, 80/443 only. `www` (site), `admin` (CMS),
`chat` (chatbot; `/demo` and `/integrate` are intentionally public, webhooks
require a signature), `command-center` (all APIs behind session). No debug/config
leak, no directory listing, no source maps, no exposed internal ports.

## 9. WhatsApp worker authorization — traced

Contract: the worker (EC2 `i-001a2ec37cab94a96`) authenticates to the CC with
`WHATSAPP_WEB_API_KEY` (timing-safe check, fails closed) and calls exactly six
endpoints: `assistant`, `config`, `enquiry`, `group-history`, `roster`,
`status`. It does **not** call `assistant/debug`. That debug route took
`senderPhone` from the request body and resolved it to a caller tier, so a
key-holder (or anyone who obtained the worker key) could impersonate the owner
and read AI answers plus the executed Mongo query over the business DB. **Fixed
this pass:** the debug route now requires an admin session (PR, §11); since
neither the worker nor the app calls it, nothing breaks. **Still open for the
owner** (need worker-side env + a live test to change safely): split an
ingestion-only key from the assistant key, stop `/config` disclosing the owner
phone (the worker already derives it from its own env), and add a second
authorization scope to the ack/attachment actions.

## 10. Razorpay / payment security — sound (re-confirmed)

Server-side order creation; amount recomputed from the CMS, never trusted from
the client; payment and webhook signatures verified with `timingSafeEqual` over
the raw body; captured amount cross-checked against the order; idempotent on
repeat webhooks; status never taken from the browser. `RAZORPAY_KEY_SECRET` and
`RAZORPAY_WEBHOOK_SECRET` are server-only. The live key pair predates the
compromise and is shared with metnmat.in; it was never on the burned host, but
rotating it is cheap insurance (owner).

## 11. Command Center PR #27 and the new debug-route fix

- **PR #27** (2FA/CAPTCHA prod-enforce, atomic OTP counter, verify throttling)
  is open, typechecks clean against the repo baseline, and is **not merged**. It
  is ready for human merge **after** a normal production OTP login is confirmed
  to still work. Merging auto-deploys the Command Center.
- **The `assistant/debug` admin-session fix** is a new branch/PR this pass, also
  not merged, pending the same confirmation.

## 12. Manual actions that require the owner (no secrets in chat)

1. **Delete the compromised admin role** (after a final look):
   ```
   aws iam remove-role-from-instance-profile --instance-profile-name metnmat-dashboard-profile --role-name metnmat-dashboard-role
   aws iam delete-role-policy --role-name metnmat-dashboard-role --policy-name <each inline policy>
   # detach any managed policies, then:
   aws iam delete-role --role-name metnmat-dashboard-role
   aws iam delete-instance-profile --instance-profile-name metnmat-dashboard-profile
   ```
   (Keep the forensic EBS snapshot of `i-0b7f49ca3e9852d4b`.)
2. **Rotate/confirm the `energy_db_user` Atlas credential** (it is in public git
   history) and review the Atlas network allow-list + DB users (§6).
3. **Retire `metnmat-migration`'s long-lived keys**; move to short-lived MFA
   credentials. Delete its inactive key now.
4. **Stop using account root** for daily work; personal IAM admin + MFA.
5. **Delete the ~31 legacy secrets** once confirmed unused (§5).
6. **Narrow or migrate `metnmat-dashboard-deploy`** (§4).
7. **Merge PR #27 and the debug-route PR** after confirming OTP login.
8. Lower-priority: worker SG SSH rule + EBS encryption; Caddy rate-limit on
   `/api/users/login`; rotate the shared Razorpay pair.

## 13. Changes made this pass

| Repo | Branch | Change | State |
|---|---|---|---|
| Metnmat_Dashboard | `fix/whatsapp-debug-admin-only` | `assistant/debug` requires an admin session | PR open, not merged |
| METNMAT-WEBSITE | `docs/security-audit-2026-09-19` | this report | PR open, not merged |

No merges, no deployments, no data or infrastructure changes were made.

## 14. Test results

- Live re-probes (2026-09-19): all fixed items still enforced (§2).
- Command-injection, CI/CD, public-surface, git-history scans: as above.
- Debug-route fix: typecheck result recorded on the PR.
- Not tested here (stated plainly): the live WhatsApp worker against the changed
  contract; Atlas console settings; any change behind PR #27 in a running CC.

**Not a claim of "no vulnerabilities."** This covers what was reviewed and
tested above; the owner-side infrastructure items in §4/§5/§12 remain the main
residual risk until closed.
