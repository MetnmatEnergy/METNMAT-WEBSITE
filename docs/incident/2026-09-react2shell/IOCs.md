# Indicators of compromise — React2Shell incident, September 2026

Use these to sweep any other host, and to recognise a re-infection on the new one.
No secret values here. Full artefacts are in the private forensic bucket
`s3://metnmat-forensics-976134557584/` (bundle `host-i-0b7f49ca3e9852d4b/forensics-20260916T055428Z.tar.gz`,
sha256 sidecar alongside) and in EBS snapshot `snap-0d28d630743a401d3`.

## Network

| Indicator | Role |
|---|---|
| `193.32.162.134` tcp/8080 (HTTP jobs + loot upload), tcp/9090 (agent session) | "tiktouk" botnet hub / C2 |
| `45.86.86.23` tcp/11133 (`/wjazvtmfsd/install`) | installer host used on 2026-08-25 through the CMS RCE |
| Outbound floods to `quickex.io` (159.65.91.230, 159.65.124.208, 109.234.34.18, 165.22.196.213, 159.65.192.251, 89.124.71.89) | victim of the HTTP/2 DDoS module `.n.js` |
| Loopback listener `127.0.0.1:18080` | agent's local control socket |
| Bot identity string `nx-www.metnmat.com`; hub token beginning `b3dc8151…` | appears in every worker's argv |

## Filesystem

```
/tmp/.tiktouk/                ~/.tiktouk/            (scanner/cracker toolkit, logs)
/tmp/.core-sync               ./tiktouk-agent        (Go C2 agent, ELF)
/dev/shm/.n.js                                       (Node HTTP/2 flood, quickex.io)
~/system-check/{system-check,systemx86,config.json}  (xmrig Monero miner, renamed)
~/sysl/{systemx86,config.json}                       (xmrig, second copy)
/tmp/tiktouk-job-*.sh                                (transient job scripts from the hub)
/tmp/.mb_hosts.* /tmp/.mb_vulns.*                    (Metabase scan state)
~/.wget-hsts modified 2026-09-12                     (attacker used wget)
```
Process names: `tiktouk-agent`, `.core-sync`, `wp2s-worker`, `wp2s_crack.py`, `wp2s_poll.py`,
`pathscan`, `jscrawl-worker`, `metabase-scan`, `gsmtp_scan.py`, `elrce_scan.py`, `elrce_crack.py`,
`nextjs_scan.py`, `nextjs_crack.py`, `nextjs_enroll.py`, `cracker-linux-amd64`, `systemx86`,
`system-check`.

## Persistence

`ec2-user` crontab entries:
- `* * * * *` relaunch `/tmp/.core-sync -hub 193.32.162.134:9090 …`
- `* * * * *` `bash /tmp/.tiktouk/dog.sh` (watchdog re-downloads and restarts every module)
- `*/30 * * * *` `docker start amco_<8hex>` ×14 (no Docker on host — inert)
- `*/30 * * * *` create user `pakchoi` with password + `NOPASSWD` sudoers drop-in (never succeeded)

## Log signatures

- Next.js error log: `digest: '<base64 ≥ 200 chars>'` — command output smuggled through the
  `NEXT_REDIRECT` digest (React2Shell / CVE-2025-55182 exploitation).
- Next.js error log: `Error: Command failed: <shell>` — the RCE running shell commands that
  exited non-zero (`curl … | bash`, `cat .env`, `find / -name '*.env'`…).
- journal: `sshd: Invalid user pakchoi from 127.0.0.1` every ~30 min.
- journal: `crontab[…]: (ec2-user) REPLACE (ec2-user)` at 2026-08-22 13:53, 08-24 08:13, 09-06 03:09.
- kernel: `Out of memory: Killed process … (systemx86|jscrawl-worker|dashboard)`.
- CloudTrail (instance role): `ListBuckets`, `ListFunctions20150331`, `GetParametersByPath`
  → `AccessDenied` bursts; `GetSecretValue` on `metnmat/chatbot/*` outside any deploy.

## Vulnerable software

Next.js **15.1.6** / React **19.0.0** (any Next < 15.1.9 / < 15.2.6 / < 15.3.6 / < 15.4.8 /
< 15.5.7 / < 16.0.7 and React 19.0.0–19.2.0). Fixed in this repo by moving the website to
15.5.25 and the CMS to 16.3.5, both on React 19.2.8.

## Quick sweep for another Linux host

```bash
sudo pgrep -af 'tiktouk|core-sync|wp2s|pathscan|jscrawl|systemx86|system-check|\.n\.js'
sudo ls -la /tmp/.tiktouk ~/.tiktouk /tmp/.core-sync /dev/shm/.n.js ~/sysl ~/system-check 2>/dev/null
sudo crontab -l -u ec2-user 2>/dev/null | grep -E 'tiktouk|core-sync|pakchoi|amco_'
sudo ss -tnp | grep -E '193\.32\.162\.134|45\.86\.86\.23'
sudo journalctl --since -30d | grep -cE 'Invalid user pakchoi|c2-blocked|imds-blocked'
```
