# Recovery runbook — from compromised host to clean production

Ordered, with the approval gates marked. **G** = needs the owner's explicit go-ahead.
**You** = needs a human with provider-console access (I cannot do it). Everything else I run.

## Phase 0 — evidence (done 2026-09-16)

- EBS snapshot `snap-0d28d630743a401d3` of `vol-059883f4455657c81` — complete, tagged `retain=true`.
- On-host bundle `s3://metnmat-forensics-976134557584/host-i-0b7f49ca3e9852d4b/forensics-20260916T055428Z.tar.gz` (+ `.sha256`): processes, sockets, crontab, malware directories, journal since Aug 10, Caddy and app logs, systemd state, auth files.
- Investigator bundle `s3://metnmat-forensics-976134557584/investigator-laptop/` — SSM outputs, CloudTrail dumps, scripts.
- Bucket: private, encrypted, versioned; the old host's role may only *write* under its own prefix.

## Phase 1 — containment  **G**

Exactly `03-containment-plan.md`, steps 2–8, in that order. Expected duration 10 minutes.
After this the four hostnames are hard-down until Phase 6. The attacker's DDoS, scanning and
mining stop at step 2.

## Phase 2 — third-party rotation  **You**

Work through `02-credential-inventory.md` top to bottom. Priority order:
1. Supabase service-role (bypasses row-level security) · MongoDB Atlas users (both) · OpenAI · Pinecone.
2. Zoho, Amazon SP-API, Gmail refresh tokens, WhatsApp tokens — revoke first, re-authorise later.
3. Razorpay, Resend, Google OAuth, Upstash, Gemini/DeepSeek/Groq, Google Maps, exchange-rates.
For every item, revoke the old credential **and** look at the provider's usage/audit log for
anything after 2026-08-13.

New MongoDB Atlas users: one for `metnmat_cms` (CMS), one for `metnmat` (chatbot), one for the
Command Center's database. Add the **new** EIP (Phase 3) to the Atlas IP access list and remove
15.206.25.71.

## Phase 3 — new infrastructure

```bash
deploy/v2/aws/launch-instance.sh          # SG, role, profile, CMS media user, t3.large, EIP → prints ids
deploy/v2/aws/provision-secrets.sh        # metnmat/{web,cms,chat,cc}/env with generated values + SET_ME
```
Then **You**: in Secrets Manager, edit each `metnmat/<app>/env` as key/value and replace every
`SET_ME` with the credentials issued in Phase 2. Each unit refuses to start until its
`.required` keys are filled, so nothing half-configured can boot.

Update `deploy/v2/aws/github-deploy-role-policy.json` with the new instance id and apply:
```bash
aws iam put-role-policy --role-name metnmat-github-deploy --policy-name deploy-v2 --policy-document file://deploy/v2/aws/github-deploy-role-policy.json
aws iam update-assume-role-policy --role-name metnmat-github-deploy --policy-document file://deploy/v2/aws/github-deploy-role-trust.json
aws iam delete-role-policy --role-name metnmat-github-deploy --policy-name deploy-via-ssm      # old: pointed at the compromised instance
aws iam delete-role-policy --role-name metnmat-github-deploy --policy-name deploy-artifacts-write
```
GitHub (all three repos): variable `PROD_INSTANCE_ID=<new id>`, secret
`AWS_DEPLOY_ROLE_ARN=arn:aws:iam::976134557584:role/metnmat-github-deploy`; delete
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`; in `Metnmat_Dashboard` also delete the
`VM_*`/`DASHBOARD_*`/`GCP_SERVICE_ACCOUNT_KEY` secrets the old SSH/Cloud Run deploys used.

## Phase 4 — bootstrap the host

Run the **Bootstrap v2 host** workflow (or the equivalent SSM command). It installs Node 22,
Caddy, Bun, the four users, units, nftables, the fetcher, journald, swap, auto-updates and
disables sshd. Its verification block must show `IMDS as mm-web: HTTP 000` and root `200`.

## Phase 5 — deploy and validate (before any DNS change)

1. Merge `incident/react2shell-recovery` into `main` (website → Next 15.5.25, CMS → Next
   16.3.5 + Payload 3.89.0, both React 19.2.8; v2 deploy layer). Run **Deploy website** and
   **Deploy CMS**. In `METNMAT-chatbot` and `Metnmat_Dashboard` merge their recovery branches
   and run **Deploy chatbot** / **Deploy Command Center**.
2. Acceptance on the host (root over SSM):
   - `systemctl status metnmat-{web,cms,chat,cc}` all `active (running)`
   - `curl -H 'Host: www.metnmat.com' http://127.0.0.1:3100/` → 200 · `admin…:3200/admin/login` → 200 · `chat…:3002/` → 200/404 · `command-center…:3000/login` → 200
   - `runuser -u mm-web -- curl -m3 http://169.254.169.254/` → blocked; `runuser -u mm-web -- ls /srv/metnmat/cms/current` → denied
   - `aws secretsmanager list-secrets` (as root) → AccessDenied; `get-secret-value --secret-id metnmat/prod/MONGODB_URI` → AccessDenied
   - `curl -m3 http://193.32.162.134:8080/` → timeout, `journalctl -k | grep c2-blocked` shows it
   - deploy a deliberately broken sha → `metnmat-release` rolls back; redeploy the good one
3. End-to-end through Caddy using the new EIP with a hosts-file override on your laptop:
   log into the CMS as director (new PIN), open a product, upload one image (exercises the
   CMS S3 user), place a test enquiry on the website (exercises Resend + INTERNAL_API_KEY),
   open the chatbot widget, log into the Command Center.
4. `deploy/v2/aws/monitoring.sh <new-instance-id>` and confirm the SNS e-mail.

## Phase 6 — cutover  **You** (Cloudflare) 

Change the A records for `metnmat.com`, `www`, `admin`, `chat`, `command-center` to the new
EIP (TTL 300 first). Caddy issues fresh Let's Encrypt certificates on first request. Watch
`journalctl -u caddy -f` for issuance, then check all five hostnames from outside.
Consider enabling Cloudflare proxying (orange cloud) afterwards — it hides the origin IP,
absorbs volumetric traffic and gives you the WAF; if you do, add Cloudflare's IP ranges to
`trusted_proxies` in the Caddyfile so client IPs are correct.

## Phase 7 — decommission  **G**

After 7 clean days: terminate `i-0b7f49ca3e9852d4b`, release EIP 15.206.25.71, delete the
`metnmat-dashboard-role`/profile and `metnmat-dashboard-sg`, delete `metnmat/prod/*` and
`metnmat/chatbot/*` secrets (they hold only burned values), delete the old GitHub workflows'
leftovers (`deploy-aws.yml` is already dead). Keep the snapshot and the forensic bucket for at
least a year. Request Spamhaus XBL delisting for 15.206.25.71 only if you intend to reuse it
(recommended: don't).

## Phase 8 — afterwards

- Enable Dependabot security updates on all three repos; the `Refuse known-vulnerable
  framework versions` step in each workflow blocks a regression below the safe floor.
- Move the WhatsApp worker (`i-001a2ec37cab94a96`, clean) onto the same v2 pattern when
  convenient; it still deploys with a repository deploy key and runs as `ec2-user`.
- Shrink `metnmat-migration` from AdministratorAccess to an operator policy; rotate its
  remaining key.
- Write the post-mortem: `docs/incident/2026-09-react2shell/01-investigation-report.md` is the input.
