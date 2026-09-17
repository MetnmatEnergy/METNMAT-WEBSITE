# deploy/v2 — isolated-per-app production host

Replaces `deploy/bin/*`, `deploy/pm2/*` and `deploy/caddy/*` after the September 2026
React2Shell compromise (see `docs/incident/2026-09-react2shell/`). The old layout ran four
apps as one Linux user, loaded **every** production secret into **every** process, and let
any process mint the instance role's credentials from the metadata service. One RCE in one
app therefore exposed everything on the box. v2 is designed so that the same RCE exposes
only the secrets of the app that was exploited.

## Layout on the host

| App | systemd unit | Linux user | Port | Root | Secret |
|---|---|---|---|---|---|
| website | `metnmat-web.service` | `mm-web` | 3100 | `/srv/metnmat/web` | `metnmat/web/env` |
| Payload CMS | `metnmat-cms.service` | `mm-cms` | 3200 | `/srv/metnmat/cms` | `metnmat/cms/env` |
| chatbot | `metnmat-chat.service` | `mm-chat` | 3002 | `/srv/metnmat/chat` | `metnmat/chat/env` |
| Command Center | `metnmat-cc.service` | `mm-cc` | 3000 | `/srv/metnmat/cc` | `metnmat/cc/env` |

Caddy (user `caddy`) terminates TLS on 80/443 and proxies to loopback. Nothing else
listens publicly. There is no SSH; administration is AWS Systems Manager Session Manager.

## The isolation, layer by layer

1. **Separate system users.** `mm-*` accounts have no shell, no home, no sudo, no cron.
   Files of one app are unreadable to another (`0750`/`0640`, group = the app's user).
2. **Root-owned code.** Releases are extracted and owned by `root:mm-<app>`. The app can
   read and execute its code but cannot modify it. Only `.next/cache` is writable.
3. **One secret per app.** `metnmat-fetch-secrets <app>` runs as root
   (`ExecStartPre=+…`) and reads exactly one Secrets Manager entry, `metnmat/<app>/env`
   (a JSON object of `KEY: value`). It writes `/run/metnmat/<app>.env` as `root:root 0600`.
   systemd (PID 1) reads that file and hands the variables to the service. The app never
   holds AWS credentials and never talks to Secrets Manager.
4. **Metadata service blocked for apps.** nftables drops every packet to
   `169.254.169.254` unless the sending process is uid 0. The fetcher, the SSM agent and
   `release.sh` are root; every app is not. A compromised app cannot obtain the instance
   role at all, so it cannot read another app's secret even though the role can.
5. **Least-privilege role.** The instance role can read the four `metnmat/*/env` secrets
   and download deploy artifacts. It has **no** S3 media access, **no** Bedrock, **no**
   `ListSecrets`. The CMS reaches its media bucket with a dedicated IAM user whose only
   permission is that bucket; its key lives inside `metnmat/cms/env`, so only the CMS has it.
6. **systemd hardening.** `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`,
   `ProtectHome`, syscall filter, empty capability set, per-unit memory limits, and
   `IPAddressDeny` for the known command-and-control addresses.
7. **Kill switch for the known C2.** nftables also drops traffic to `193.32.162.134` and
   `45.86.86.23` and logs the attempt, so a re-infection announces itself.

## Files

```
bin/bootstrap-host.sh        root · one-time host prep, idempotent, run over SSM
bin/metnmat-fetch-secrets    root · ExecStartPre secret fetcher (installed to /usr/local/sbin)
bin/release.sh               root · download → verify → swap → restart → health → rollback
systemd/*.service            the four hardened units
etc/<app>.conf               static, NON-secret environment per app (checked in)
etc/<app>.required           variables the fetcher must find in the secret, or refuse to start
nftables/metnmat.nft         IMDS root-only rule + C2 block
caddy/Caddyfile              all five hostnames → loopback ports
aws/instance-role-policy.json   what the host role may do (four secrets + artifacts)
aws/cms-media-user-policy.json  the CMS's S3-only IAM user
aws/github-deploy-role-*.json   what GitHub Actions may do (upload artifact, run release)
aws/launch-instance.sh       creates SG, role, profile, instance, EIP — prints ids
aws/provision-secrets.sh     creates the four metnmat/<app>/env secrets (random values
                             generated server-side; third-party keys left as SET_ME)
```

## Deploy flow

GitHub Actions (OIDC role, no static keys) builds → uploads `s3://<artifacts>/<app>/<sha>/`
(`<artifact>.tgz` + `.sha256`) → `ssm send-command` runs
`/usr/local/sbin/metnmat-release <app> <sha>` as root → health check → auto-rollback.

## Things v2 deliberately does not do

- No PM2. systemd owns restarts, memory caps and logs (`journalctl -u metnmat-<app>`).
- No `.env` files on disk for any app. `/run/metnmat/*.env` is tmpfs, root-only, rewritten
  at every start.
- No shared `with-secrets.sh`. It is deleted.
- No Bedrock grant. Nothing in the four apps used it (CloudTrail: zero `InvokeModel` calls).
