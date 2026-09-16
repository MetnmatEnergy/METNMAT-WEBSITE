# METNMAT security + cost audit — 2026-09-16 (post-recovery)

Scope: whole AWS account 976134557584 (all regions), both EC2 hosts, IAM, Secrets Manager, SSM
Parameter Store, S3, network, GitHub (3 repos + full git history), MongoDB Atlas (from console
evidence), Cloudflare (from DNS evidence), and the running applications. No secret values appear
here. Actions marked **[done]** were applied during the audit; everything else is a recommendation.

## 1. Inventory (ap-south-1 only — every other region is empty)

| Resource | Purpose | State | Public? | Risk | Cost/mo | Action |
|---|---|---|---|---|---|---|
| EC2 `i-0b446863ec28109b0` metnmat-prod-2 (t3.large) | website, CMS, chatbot, Command Center | running, 3/3 checks | 80/443 only | low | $65.41 | see sizing (§3) |
| EC2 `i-0b7f49ca3e9852d4b` metnmat-website (t3.medium) | **compromised host** | **stopped**, quarantine SG (0 in/0 out) | no | contained | $0 compute, $2.74 EBS | terminate day 7 |
| EC2 `i-001a2ec37cab94a96` whatsapp-worker (t3.small) | WhatsApp web worker (separate service) | running, clean | 22 from one office IP | low | $16.35 | keep; move to v2 pattern later |
| EIP 52.66.54.7 / 15.206.25.71 / 13.232.132.186 | prod-2 / old (Spamhaus-listed) / worker | attached | — | — | $3.65 each | release the old one day 7 |
| EBS 30 GB enc (prod-2), 30 GB **unencrypted** (old), 16 GB unencrypted (worker) | roots | in-use | — | old: forensic only | ~$6.94 total | old goes with the instance |
| Snapshot `snap-0d28d630743a401d3` (30 GB) | **forensic evidence** | complete | — | — | ~$1.20 | keep ≥ 1 year |
| SG metnmat-prod-web-sg | prod-2 | 80/443 world | by design | low | — | keep |
| SG metnmat-quarantine | old host | none | — | — | — | delete with old host |
| SG metnmat-dashboard-sg | old host (detached) | 80/443/22 | — | unattached | — | delete day 7 |
| SG launch-wizard-2 (22/80/443 from 0.0.0.0/0), metnmat-alb, metnmat-tasks | dead ECS/ALB era | **[done] deleted** (all unattached) | — | — | — | — |
| VPC vpc-0257d62d479ad76de 10.20.0.0/16 + IGW | dead ECS/Fargate path | empty | — | clutter | $0 | delete at leisure |
| NACL acl-014c521d84af0da21 | default VPC | denies C2 IPs 193.32.162.134 / 45.86.86.23 | — | — | — | keep |
| S3 metnmat-media-prod (68 MB) | CMS media | private, PAB all-on, enc, versioned, lifecycle | no | low | ~$0.02 | keep |
| S3 metnmat-media-976134557584 (4.4 MB, 214 obj) | Command Center media | policy grants **public GetObject** (by design: CC builds plain object URLs); listing blocked | read-only public | low-medium | ~$0.01 | keep; future: CloudFront/signed URLs |
| S3 metnmat-deploy-artifacts (6.8 GB) | build artifacts | private, lifecycle rule present | no | low | ~$0.16 | keep |
| S3 metnmat-deploy-artifacts-website-…-an (empty) | unknown origin | empty, versioned | no | clutter | $0 | delete |
| S3 metnmat-forensics (77 MB) | evidence | private, enc, versioned | no | — | ~$0.01 | keep ≥ 1 year |
| S3 metnmat-cloudtrail (0.5 MB) | trail logs | private, enc, 400-day lifecycle | no | — | grows slowly | keep |
| S3 metnmat-tfstate (0.1 MB) | dead Terraform state | private | no | clutter | $0 | delete when terraform files are removed |
| Secrets Manager: 4 new `metnmat/{web,cms,chat,cc}/env` | app secrets | in use | — | — | $1.60 | keep |
| Secrets Manager: 31 old `metnmat/prod/*`, `metnmat/chatbot/*` | burned values | unused since 09-15 | — | **exposed values still stored** | **$12.40** | delete (7-day recovery window) |
| SSM params `/metnmat/prod/CRON_SECRET`, `/metnmat/prod/GEMINI_API_KEY` | worker | in use by worker role | — | values were in the leaked CC .env | $0 | rotate |
| IAM users: metnmat-cms-media (bucket-only), metnmat-migration (**AdministratorAccess**, key on laptop) | CMS S3; operator | active | — | admin key = account takeover if laptop lost | — | rotate + downscope migration |
| IAM roles: prod-host (least-priv), worker, github-deploy (OIDC), dashboard-deploy (OIDC, old target), dashboard-role (old, Bedrock*/ListSecrets — revoked sessions), 4 ECS task/exec roles (never used) | | | | | | delete old + ECS roles day 7 |
| Root account | MFA on, no keys | **used for console work today** (GuardDuty ×2) | — | medium | — | create an admin IAM identity |
| CloudTrail metnmat-trail | management + S3 data events | logging | — | — | ~$0.50 | keep |
| GuardDuty (detector active) | detection | 2 findings (root usage) | — | — | trial, then ~$2-4 | keep |
| CloudWatch: 3 alarms + METNMAT/Host telemetry **[done]** | detection / sizing | OK | — | — | ~$2.50 | keep |
| SNS metnmat-alerts → dev@metnmat.com | alerting | **PendingConfirmation** | — | alarms reach nobody | $0 | confirm email |
| ECS: 12 task definitions, 3 empty log groups | dead path | inert | — | clutter | $0 | deregister/delete |
| ACM: 1 certificate | dead ALB era | unused | — | — | $0 | delete |
| Lambda / NAT / ELB / CloudFront / Route53 / WAF / ECR / Backup / KMS-CMK | — | **none** | — | — | $0 | — |

## 2. Host security (new EC2) — verified 2026-09-16 11:20 UTC

OS AL2023 2026-09-14 image, kernel 6.18, **0 pending security updates**, dnf-automatic enabled ·
sshd disabled+inactive, no authorized_keys anywhere, no ssm-user created yet · IMDSv2 enforced (401
without token) and **blocked for every app uid by nftables** (root-only) · listeners: Caddy 80/443,
apps on loopback only, Caddy admin loopback · no cron, no Docker, no non-stock enabled units, no
ld.so.preload, 0 SUID changes, 0 world-writable dirs, IOC sweep clean · apps run as `mm-*`
(nologin), code root-owned read-only, cross-app directory access denied, `/run/metnmat` 0700 root ·
auditd active, journald persistent, Caddy access logs on. Residual: `ec2-user` keeps cloud-init's
`NOPASSWD:ALL` (unreachable: no SSH, no keys) — cosmetic; remove if desired.

## 3. Sizing: t3.large vs t3.medium

Measured runtime (3 of 4 apps live, idle): RAM used **1.37 GB** of 7.8 GB (web 411 MB, cms 286 MB,
cc 303 MB, Caddy+system 265 MB); swap 23 MB; load 0.04; CPU avg 1–2 %. Expected with chatbot ≈ 1.7 GB.
Old t3.medium ran the same four apps for weeks; its OOM kills coincided with the attacker's 2.1 GB
miner, **but** the Command Center itself grew to 2.1 GB RSS over three weeks (pre-incident note in
deploy/README) and CMS `sharp` uploads allocate outside the heap.
Builds on the host: CPU 96 %, **t3 CPU credits fell to 1**, several GB of RAM — unacceptable on any
size and unnecessary once GitHub Actions builds again.

**Decision: OPTION C — t3.medium is sufficient for RUNTIME, not for builds.** Expected headroom on
4 GB: ~2 GB RAM (~50 %), CPU baseline 20 % vs ~2 % used. Not downgraded today. Preconditions:
1. builds only in GitHub Actions (merge the recovery branches → `main`/`master`; never build on host);
2. chatbot live;
3. **7 days of `METNMAT/Host` telemetry** (installed today) showing MemUsedPercent < 60 % and the
   Command Center's growth curve;
4. re-tune unit caps to sum ≤ 3.5 GB (web 700 M, cms 1.3 G, cc 1.1 G, chat 500 M) so cgroup limits,
   not the kernel OOM killer, decide.
Then: stop → change type → start (~2 min, EIP retained). Saving $32.70/mo. If the CC's telemetry
shows sustained growth past ~1 GB, keep t3.large or split the CC onto a t3.small.

## 4. IAM / secrets / code findings

- Old compromised host: stopped, quarantined, EIP unchanged (not reused), snapshot preserved,
  role sessions revoked; nothing else attached. **Not restarted.**
- CI: static AdministratorAccess key `…UJ63` inactive; all three repos carry `AWS_DEPLOY_ROLE_ARN`
  (OIDC role `metnmat-github-deploy`, scoped to artifact prefixes + SendCommand to prod-2 only).
  **But the default branches still hold the OLD workflows** (23 references to static keys in
  METNMAT-WEBSITE main, 3 in chatbot main) — they fail safely (secrets deleted) yet must be replaced
  by merging the recovery branches. No branch protection on either public repo.
- Dashboard repo secrets `VM_SSH_KEY`, `VM_HOST/PORT/USER`, `DASHBOARD_HOST/USER`,
  `GCP_SERVICE_ACCOUNT_KEY` belong to retired SSH/Cloud-Run deploys — delete; rotate the GCP SA key.
- Codebases + full git history (all branches): **no real credentials** — hits were product slugs
  (`sk-electrode…`), a TypeScript build-info hash (`re_…` in `.tsbuildinfo`), and a test fixture.
  No `.env` tracked in any repo.
- CloudTrail last 24 h: only metnmat-migration (this laptop), root console browsing (same office
  IP), and AWS service roles. Secrets Manager reads: only the new host role and the operator.
  Nothing from unknown IPs.
- Old media bucket: public-read policy is **intentional** (CC builds plain object URLs). Blocking it
  broke stored image links; reverted to prior state. Listing is blocked.

## 5. Cost (actual Cost Explorer data; credits currently cover 100 %)

Gross Aug: **$76.98** · gross Sep 1–16: **$42.40** · credits applied: −$76.98 / −$42.40 → **net $0
so far**. Credit balance is not queryable; plan for the gross figure.

Projected steady-state gross, current layout: t3.large 65.41 + worker 16.35 + EBS 6.94 + 3 public
IPv4 10.95 + Secrets Manager 14.00 + CloudWatch 2.50 + GuardDuty ~3 + CloudTrail/S3/SNS ~1 ≈
**$120/mo (≈ ₹10,100 at ₹84/$)**.

| Optimization | Saving/mo | When |
|---|---|---|
| Delete 31 old secrets | $12.40 | after chatbot + all apps verified |
| Terminate old instance + its EBS, release its EIP | $6.39 | day 7 |
| Delete empty bucket, ECS leftovers, ACM cert, dead VPC | $0 (hygiene) | any time |
| t3.large → t3.medium | $32.70 | after §3 preconditions |

After optimization: **≈ $68/mo (≈ ₹5,700)** with t3.medium, ≈ $101/mo (≈ ₹8,500) staying on
t3.large. Saving **≈ $52/mo (₹4,400)** or ≈ $19/mo (₹1,600).

## 6. Remaining risks (evidence-based)

**Critical:** none open.
**High:** (1) third-party credentials that were on the old host are not yet rotated — Supabase
service-role, Zoho, Gmail refresh tokens, Amazon SP-API, WhatsApp, Razorpay, Resend, OpenAI,
Pinecone, Upstash, Google — the attacker may still hold working keys; (2) a long-lived
AdministratorAccess key (`metnmat-migration …2EVH`) on a laptop; (3) daily console use as the
**root** account.
**Medium:** origin IP exposed (Cloudflare DNS-only, no WAF/rate-limit); old workflows still on the
default branches, no branch protection; Atlas M0 at 84 % with **no backups**; SNS unconfirmed; old
instance not yet terminated.
**Low:** ECS/VPC/ACM leftovers; `ec2-user` sudoers line; public-read CC media bucket; 2 SSM params
with burned values.

## 7. Blast radius (tested on the running host)

| If compromised | Attacker gets | Cannot get |
|---|---|---|
| Website (`mm-web`) | website secret (internal API key, signing keys, Resend/Razorpay once set) | CMS/CC/chat secrets, AWS role, S3, root, other apps' files |
| CMS (`mm-cms`) | CMS secret: Atlas `metnmat_cms` rw, media bucket rw (bucket-scoped key) | chatbot/CC data, AWS role, other secrets |
| Chatbot (`mm-chat`) | Atlas `metnmat` rw, OpenAI/Pinecone | CMS/CC secrets, AWS role |
| Command Center (`mm-cc`) | Atlas `metnmat` rw + every integration it holds (largest by nature) | CMS data, AWS role, other apps |
IMDS: blocked for all four (HTTP 000). Root: no sudo, no SSH. Cross-app files: denied.

## 8. Attack paths — closed?

Vulnerable Next/React **closed** (15.5.25 / 16.3.5 / React 19.2.8 + CI floor check) · IMDS pivot
**closed** · shared secrets **closed** (one secret per app) · excessive IAM **closed** on the new
role · SSH **closed** · weak isolation **closed** · public MongoDB **closed** (IP allow-list, old IP
absent, old users gone) · CI static keys **closed** (OIDC) · exposed origin **open** (DNS-only) ·
exposed third-party credentials **open until rotated**.

## 9. UPDATE 2026-09-16 — t3.large → t3.medium DONE (owner-approved, telemetry wait waived)
- Resized `i-0b446863ec28109b0` to **t3.medium**; EIP **52.66.54.7** retained; ~3 min outage.
- Post-resize (all 4 apps' units present): RAM used 0.6-0.8 GB of 3.8 GB (~22%), swap 0, load 0.2,
  CPU idle ~97%, **0 OOM, 0 failed units, 0 restart loops** on web/cms/cc. Public 200 on www/admin/
  command-center from an independent host.
- Unit memory caps re-tuned (repo + host): MemoryMax web 768 / cms 1200 / cc 1024 / chat 512 = 3.5 GB.
- Hardening re-verified after reboot: IMDS blocked for app users (root 200), nft table loaded,
  cross-app read denied, auditd active. sshd came back running after the stop/start (never reachable
  — SG has no port 22) so it was **stopped and masked**.
- Chatbot **stopped** (was crash-looping on missing OPENAI_API_KEY/PINECONE_API_KEY) — starts on
  `metnmat-release chat` once those keys are in metnmat/chat/env.
- Projected steady-state cost now ~$88/mo gross (t3.medium 32.70 + worker 16.35 + EBS 6.94 + 3 EIP
  10.95 + Secrets 14 + monitoring ~7). After deleting old instance/EIP/secrets on day 7: ~$55/mo.
