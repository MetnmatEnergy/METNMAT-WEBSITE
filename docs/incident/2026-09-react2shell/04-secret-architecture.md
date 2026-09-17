# Secret architecture v2 — design and validation

The design itself is documented in `deploy/v2/README.md`. This file records **why** each
choice was made against the incident's facts and **how it was validated**.

## The failure it must prevent

On the old host one RCE inside the website (uid `ec2-user`) yielded, without any further
exploitation:

1. every variable of its own process (expected),
2. every variable of the CMS, chatbot and Command Center processes — same uid, so
   `/proc/<pid>/environ` and the Command Center's `.env` were readable,
3. every `metnmat/prod/*` secret even where an app did not use it — `with-secrets.sh` loaded
   the whole prefix into every process,
4. the instance role's credentials — the metadata service answered any uid — and with them
   `metnmat/chatbot/*`, the S3 media buckets and Bedrock.

## Threat model for v2

Assume an attacker gets arbitrary code execution as the app's Linux user (that is what a
framework RCE gives). They must **not** be able to reach any of 2–4. They *will* be able to
read 1; the design shrinks 1 to the minimum each app genuinely needs.

## Controls and what each one closes

| # | Control | Closes |
|---|---|---|
| A | Four system users `mm-web`, `mm-cms`, `mm-chat`, `mm-cc`; releases `root:mm-<app>` 0750/0640 | 2 — other apps' files and `/proc` are unreadable (`ProtectProc=invisible` + different uid) |
| B | One secret per app, `metnmat/<app>/env`; fetched by root; only the app's own keys | 3 — the process env contains its own configuration only |
| C | nftables: packets to `169.254.169.254` dropped unless uid 0; systemd units run as non-root | 4 — no app can obtain instance-role credentials at all |
| D | Instance role limited to `GetSecretValue` on the four `metnmat/*/env` ARNs + artifact `GetObject`; no `ListSecrets`, no S3 media, no Bedrock | limits the blast radius **if** C were ever bypassed |
| E | CMS S3 access via IAM user `metnmat-cms-media` (media bucket only), key stored only in `metnmat/cms/env` | keeps C absolute (the CMS never needs IMDS) while the CMS keeps its uploads |
| F | systemd hardening (`NoNewPrivileges`, `ProtectSystem=strict`, `CapabilityBoundingSet=`, syscall filter, `PrivateTmp`, memory caps) | privilege escalation and resource exhaustion from inside a unit |
| G | No SSH, no sudo-capable interactive user; SSM Session Manager only | the `ec2-user NOPASSWD:ALL` root path that existed on the old host |
| H | nftables + `IPAddressDeny` for the known C2 addresses, with logging | silent re-enrolment into the same botnet |
| I | Artifact sha256 sidecar verified before extraction; releases root-owned | tampered artifacts; an RCE cannot rewrite its own code |
| J | Security auto-updates, persistent journald, CloudWatch alarms | the 3-week detection gap |

## Why not "just separate the Secrets Manager prefixes"

Prefix separation alone (four prefixes, one role) is defeated by 4: any app reaches IMDS,
takes the role, and reads all four prefixes. The user requirement was explicit on this, and
the CloudTrail evidence shows the attacker did exactly that on the old host. Control C is the
load-bearing one; B and D are what make C *sufficient* rather than merely helpful.

## Trade-off accepted

E introduces one long-lived access key (the CMS media user). It is scoped to one bucket, never
leaves `metnmat/cms/env`, and is rotated by re-running `provision-secrets.sh`. The alternative
— letting the CMS use IMDS — would reopen 4 for the CMS. A CMS compromise then exposes the
media bucket, which the CMS can already read and write by design.

## Validation

| Check | How | Result |
|---|---|---|
| IMDS unreachable from an app uid | `bootstrap-host.sh` verification step: `runuser -u mm-web -- curl …169.254.169.254` | **expect 000 (blocked)**; root gets 200. Also `journalctl -k | grep imds-blocked` counts attempts |
| App cannot read another app's env file | `/run/metnmat/*.env` are `root:root 0600`; `/run/metnmat` is 0700 | filesystem permissions; `ProtectSystem=strict` also mounts the tree read-only |
| App cannot read another app's release | `/srv/metnmat/<app>` is `root:mm-<app> 0750` | `runuser -u mm-web -- ls /srv/metnmat/cms/current` → Permission denied |
| Fetcher refuses placeholders and banned keys | `metnmat-fetch-secrets` exits non-zero on missing `.required` keys, drops `DIRECTOR_RESET`/`SEED_PRUNE_PLACEHOLDERS`, refuses `SET_ME` | unit fails to start, journal explains which key |
| Role cannot list or read other secrets | `aws secretsmanager list-secrets` from root on the host → AccessDenied; `get-secret-value metnmat/prod/MONGODB_URI` → AccessDenied | run during bootstrap acceptance |
| Artifact tamper detection | corrupt a byte of the `.tgz` in S3 → `metnmat-release` exits "sha256 mismatch" | run once on the new host before cutover |
| C2 block works | `curl -m 3 http://193.32.162.134:8080/` from the host → timeout, kernel log `c2-blocked` | run during bootstrap acceptance |
| Rollback works | deploy a deliberately broken sha (bad entry file) → release fails health check → previous release restored | run once on the new host before cutover |

Each row above is executed as part of the runbook (`05-recovery-runbook.md`, phase 5) and the
outcome recorded there before DNS is moved.
