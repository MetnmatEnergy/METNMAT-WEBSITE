# AWS infrastructure — Terraform

Target: account **976134557584** (METNMAT Innovations), region **ap-south-1** (Mumbai).

**Nothing here has been applied.** These files describe the stack; running
`terraform apply` is a separate, deliberate act. Read §4 before you do.

---

## 1. What this builds

```
                    Internet
                       │
              ┌────────▼────────┐   ACM cert (ap-south-1)
              │       ALB       │   HTTPS :443, HTTP :80 → 301
              │  host-routed    │   idle_timeout 300s
              └────────┬────────┘
        ┌──────────────┼──────────────┐
   www.  │        admin.│         chat.│
  ┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼─────┐
  │  website   │ │ dashboard  │ │  chatbot   │   ECS Fargate
  │ 0.5 / 1GB  │ │  1 / 2GB   │ │0.25/0.5GB  │   private subnets
  └──────┬─────┘ └──────┬─────┘ └──────┬─────┘
         └──────────────┼──────────────┘
                   NAT Gateway ── fixed egress IPs → Atlas allowlist
                        │
        MongoDB Atlas · Razorpay · Resend · Groq · Upstash · Meta
                        (all unchanged, all external)
```

| File | Contains |
|---|---|
| `versions.tf` | Provider, account guard rail, default tags |
| `variables.tf` | Every tunable, with the cost trade-offs documented |
| `network.tf` | VPC, subnets, NAT, security groups |
| `platform.tf` | ECR, S3 media bucket, Secrets Manager, log groups |
| `iam.tf` | Task/execution roles, GitHub OIDC |
| `alb.tf` | Load balancer, target groups, ACM, listener rules |
| `ecs.tf` | Cluster, task definitions, services |
| `outputs.tf` | Everything you need for the next step |

---

## 2. Decisions worth knowing about

**One ALB, not three.** An ALB carries a fixed hourly charge, so three would
triple the largest fixed cost for no benefit. Host-based listener rules separate
the services.

**NAT Gateway is on by default, and it is probably your largest single cost.**
It exists so egress comes from fixed Elastic IPs and the MongoDB Atlas access
list can stay tight. If Atlas already allows `0.0.0.0/0`, set
`enable_nat_gateway = false` and delete that entire line item — tasks then run in
public subnets, but the security group still blocks all inbound except from the
ALB. **Check the Atlas access list before you decide.**

**Execution role and task role are separate.** The execution role resolves
secrets before the container starts; the task role is what the application code
assumes. Merging them — a common shortcut — would let the running container read
every secret in the account.

**ECR tags are IMMUTABLE.** The GCP pipeline pushes a mutable `:latest`, which
means there is no previous image to roll back to. Immutable tags plus
`:$COMMIT_SHA` give a real rollback target. A lifecycle policy keeps the last 15.

**Terraform does not own the deployed image.** `ignore_changes` on
`container_definitions` and `task_definition` lets CI move production forward
without the next `terraform apply` rolling it back.

**Storage stays on GCS.** `ecs.tf` sets `GCS_BUCKET`/`GCS_PROJECT_ID`, not the S3
variables. Switching is a three-line change, but only **after** the media copy is
verified — see [`../../docs/AWS-STORAGE-MIGRATION.md`](../../docs/AWS-STORAGE-MIGRATION.md).

---

## 3. Cost

Rough, **list price, ap-south-1**, at low traffic. Verify in the AWS Pricing
Calculator before committing — I hold no AWS credentials and could not query the
Pricing API.

| Item | Est. / month |
|---|---|
| **NAT Gateway** (1, `single_nat_gateway = true`) | **largest fixed item** |
| ALB (fixed hourly + LCU) | second largest |
| Fargate — 1.75 vCPU / 3.5 GB total, always on | moderate |
| ECR, S3, Secrets Manager (22), CloudWatch | small |

Two honest notes:

- **Cloud Run currently costs ~₹0 at idle** because `minScale=0` and CPU is
  throttled outside requests. Fargate provisions continuously. **This migration
  increases your compute bill**, and the increase is mostly NAT + ALB + always-on
  tasks. That is the price of leaving, not a mistake in the design.
- Setting `enable_nat_gateway = false` removes the single largest line, if and
  only if Atlas permits it.

---

## 4. Applying it — the order matters

### Prerequisites

- Terraform ≥ 1.6, AWS CLI configured for account `976134557584`
- **Billing active on the AWS account.** The outage you are leaving was a billing
  failure; AWS behaves the same way.
- The **MongoDB Atlas IP access list** decision made (§2)

### Steps

```bash
cd infra/aws
terraform init
terraform plan -out=tfplan     # READ THIS. It creates ~50 resources.
terraform apply tfplan
```

`apply` will **pause** at ACM validation. Run:

```bash
terraform output acm_validation_records
```

and add those CNAMEs at GoDaddy. Terraform resumes once they resolve. These
records are unrelated to the ones serving the site today — adding them changes
nothing about live traffic.

### After apply

```bash
terraform output next_steps
```

Summary: populate the 22 secrets (all created as `PLACEHOLDER_SET_ME`), add the
NAT IPs to Atlas, push real images, then test **via the ALB hostname**:

```bash
curl -H "Host: www.metnmat.com" https://$(terraform output -raw alb_dns_name)/api/health
```

**DNS is last, and only after everything above passes.**

---

## 5. What this deliberately does NOT do

- **Touch GCP.** Nothing here reads, modifies or deletes anything on GCP.
- **Touch DNS.** No Route 53 zone, no registrar change. The zone stays at
  GoDaddy, which keeps rollback a single record edit at a neutral third party.
- **Migrate data.** No media copy, no database change. Atlas is shared and
  untouched.
- **Store secret values.** Containers are created empty. A value in Terraform
  would land in state and in plan output.

---

## 6. Known gaps before production traffic

1. **The dashboard has no health endpoint.** `/` redirects, which passes the
   `200-399` matcher, but a real `/api/health` would be better.
2. **`chat.metnmat.com` currently 404s** even on GCP. Worth understanding before
   routing it here.
3. **`importMap.js` needs an S3 entry** if and when storage switches — without
   it the admin renders blank. See `CLAUDE.md` gotcha #2.
4. **Remote state is local.** Bootstrap the S3 backend after the first apply
   (`versions.tf` carries the block, commented).
5. **No WAF, no CloudFront.** GCP fronts the site with a load balancer and CDN
   today; this stack does not replicate that. Static assets will be served by the
   containers. Add CloudFront once the migration is stable.
