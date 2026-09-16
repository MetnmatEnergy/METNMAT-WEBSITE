# Containment plan — requires explicit approval before execution

Target: `i-0b7f49ca3e9852d4b` (15.206.25.71, `metnmat-website`), volume `vol-059883f4455657c81`.
Every step below is production-impacting or irreversible and is executed **only after approval**.
Steps 0 and 1 (evidence) are already done.

| # | Action | Command (read-only shown; live command identical) | Impact | Reversible? |
|---|---|---|---|---|
| 0 | Forensic EBS snapshot | `create-snapshot vol-059883f4455657c81` → **snap-0d28d630743a401d3** | none | n/a — keep |
| 1 | On-host bundle + investigator evidence → `s3://metnmat-forensics-976134557584/` | done / in progress | none | n/a — keep |
| 2 | **Isolate network**: swap the instance's security group for `sg-0890559606eea14f8` (`metnmat-quarantine`, 0 inbound, 0 outbound rules) | `aws ec2 modify-instance-attribute --instance-id i-0b7f49ca3e9852d4b --groups sg-0890559606eea14f8` | www/admin/chat/command-center go **hard-down** (connection refused instead of 502). Botnet C2, cracking, DDoS and mining stop within seconds. **SSM also loses connectivity** (agent needs outbound 443) — no more remote commands on the box. | yes: `--groups sg-0bc6c64b14e7dd8d5` |
| 3 | **Stop the instance** | `aws ec2 stop-instances --instance-ids i-0b7f49ca3e9852d4b` | RAM state lost (disk preserved in snapshot + volume). EIP 15.206.25.71 stays allocated to the stopped instance. | yes (start), but we won't |
| 4 | **Revoke every credential the role issued before now** | attach inline policy `RevokeOlderSessions` to `metnmat-dashboard-role`: `Deny *` with `Condition: DateLessThan aws:TokenIssueTime = <now>` | any role credentials copied off the box become useless. The stopped instance is unaffected. (If step 3 is skipped, the SSM agent refreshes and keeps working.) | yes (detach policy) |
| 5 | **Delete the exposed GitHub deploy key** id 159774699 on `MetnmatEnergy/Metnmat_Dashboard` | `gh api -X DELETE repos/MetnmatEnergy/Metnmat_Dashboard/keys/159774699` | the old host can no longer fetch the Command Center source. The old deploy workflow (`git fetch` on host) breaks — it is replaced by the artifact deploy in v2. | re-add a new key (no) |
| 6 | **Deactivate the static AdministratorAccess key** `AKIA…UJ63` used by GitHub Actions in both repos | `aws iam update-access-key --user-name metnmat-migration --access-key-id AKIA…UJ63 --status Inactive` | website/CMS/chatbot deploy workflows fail until the `AWS_DEPLOY_ROLE_ARN` repo secret is set (OIDC path already supported by all three workflows) | yes (reactivate) |
| 7 | Set repo secret `AWS_DEPLOY_ROLE_ARN=arn:aws:iam::976134557584:role/metnmat-github-deploy` on METNMAT-WEBSITE and METNMAT-chatbot; delete `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` from both | `gh secret set …` / `gh secret delete …` | workflows switch to OIDC | yes |
| 8 | Block the C2 at the account edge too: add outbound deny for `193.32.162.134/32`, `45.86.86.23/32` to the default VPC's network ACL | `aws ec2 create-network-acl-entry … --egress --rule-action deny` | affects every instance in the VPC — only these two IPs, which nothing legitimate talks to | yes |
| 9 | **Do not start `i-0b7f49ca3e9852d4b` again.** Terminate after the new host has served production for 7 days and the snapshot is confirmed complete. Release EIP 15.206.25.71 (Spamhaus XBL listed). | `terminate-instances` / `release-address` | old host gone for good | **no** |

Ordering matters: 2 before 3 (so nothing leaves during shutdown), 4 after 3 (the agent
would otherwise lose its own session while we still want it — irrelevant once stopped).

Who else to inform after step 2: your hosting/abuse contact (the EIP is on the Spamhaus XBL),
and optionally quickex.io, whose site this host was flooding.
