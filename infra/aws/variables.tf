# ─────────────────────────────────────────────────────────────────────────────
# Account / region
# ─────────────────────────────────────────────────────────────────────────────

variable "aws_account_id" {
  description = "AWS account this stack may be applied to. Asserted by the provider."
  type        = string
  default     = "976134557584" # METNMAT Innovations
}

variable "aws_region" {
  description = "Mumbai — closest region to the user base, matching GCP asia-south1."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "name_prefix" {
  description = "Prefix for every resource name."
  type        = string
  default     = "metnmat"
}

# ─────────────────────────────────────────────────────────────────────────────
# Networking
# ─────────────────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  type    = string
  default = "10.20.0.0/16"
}

variable "az_count" {
  description = <<-EOT
    Availability zones to span. 2 is the minimum an ALB accepts.
    Raising this also raises NAT cost when enable_nat_gateway = true.
  EOT
  type        = number
  default     = 2
}

variable "enable_nat_gateway" {
  description = <<-EOT
    THE SINGLE BIGGEST COST DECISION IN THIS STACK. Read before changing.

    true  — tasks run in PRIVATE subnets and egress through a NAT Gateway.
            Egress comes from a small set of fixed Elastic IPs, so the MongoDB
            Atlas IP access list can stay tight. This is the secure default.
            Cost: NAT Gateway is billed per hour PLUS per GB processed, and at
            this traffic level it is likely the largest line item in the whole
            stack — plausibly more than all three containers combined.

    false — tasks run in PUBLIC subnets with public IPs and no NAT.
            Saves the entire NAT bill. Security groups still block all inbound
            traffic except from the ALB, so this is not as exposed as it sounds.
            BUT the egress IP is not stable, so Atlas must allow 0.0.0.0/0.

    Decide this by checking the Atlas IP access list FIRST:
      - Atlas already allows 0.0.0.0/0  -> false is reasonable, and cheaper.
      - Atlas restricts by IP           -> keep true, or you cannot connect.

    SET TO false ON 2026-08-10. The Atlas access list was confirmed to allow
    0.0.0.0/0, so fixed egress IPs buy nothing here.

    Worth stating plainly, because it looks like a security downgrade and is
    not: Cloud Run has no stable egress IP either. That is almost certainly WHY
    Atlas is open in the first place. Running tasks in public subnets is
    therefore PARITY with the current production posture, not a regression from
    it — and inbound is still blocked to everything except the ALB by security
    group, which is the control that actually matters.

    If the Atlas access list is ever tightened, flip this back to true and
    re-apply. The private subnets are still created either way, so the change is
    a routing swap rather than a rebuild.
  EOT
  type        = bool
  default     = false
}

variable "single_nat_gateway" {
  description = <<-EOT
    Use ONE NAT Gateway for all AZs instead of one per AZ.
    Cuts NAT cost by ~50% at az_count = 2, at the price of a single-AZ
    dependency for outbound traffic. Reasonable for this workload.
  EOT
  type        = bool
  default     = true
}

# ─────────────────────────────────────────────────────────────────────────────
# Domains / TLS
# ─────────────────────────────────────────────────────────────────────────────

variable "root_domain" {
  type    = string
  default = "metnmat.com"
}

variable "service_domains" {
  description = "host -> which service the ALB routes it to."
  type        = map(string)
  default = {
    "www.metnmat.com"   = "website"
    "admin.metnmat.com" = "dashboard"
    "chat.metnmat.com"  = "chatbot"
  }
}

variable "create_acm_certificate" {
  description = <<-EOT
    Issue an ACM certificate for the domains above.

    Validation is DNS-based and the zone is at GoDaddy, not Route 53, so
    Terraform CANNOT complete validation on its own. It will create the
    certificate and then WAIT while you add the CNAME records GoDaddy-side.
    The records to add are printed by `terraform output acm_validation_records`.

    This does NOT touch any existing production DNS record — validation CNAMEs
    are unrelated to the A/CNAME records currently serving the site.
  EOT
  type        = bool
  default     = true
}

# ─────────────────────────────────────────────────────────────────────────────
# Container sizing
# ─────────────────────────────────────────────────────────────────────────────

variable "services" {
  description = <<-EOT
    Per-service Fargate sizing and health check.

    Sizing note: Cloud Run currently gives each service 1 vCPU with CPU
    throttling, so CPU is only consumed during a request. Fargate provisions CPU
    continuously, so a like-for-like 1 vCPU everywhere would be both wasteful and
    expensive. These values are chosen per workload instead:

      website   0.5 vCPU / 1 GB  — Next.js SSR, the busiest service
      dashboard 1.0 vCPU / 2 GB  — Payload boots a seed on every start and its
                                   admin bundle is heavy; it needs the headroom
      chatbot   0.25 vCPU / 0.5 GB — thin Express proxy in front of Groq

    Valid Fargate combinations are constrained: 256 CPU allows 512/1024/2048 MB;
    512 CPU allows 1024-4096 MB; 1024 CPU allows 2048-8192 MB.
  EOT
  type = map(object({
    cpu               = number
    memory            = number
    container_port    = number
    health_check_path = string
    desired_count     = number
    priority          = number
  }))
  default = {
    website = {
      cpu               = 512
      memory            = 1024
      container_port    = 8080
      health_check_path = "/api/health"
      desired_count     = 1
      priority          = 100
    }
    dashboard = {
      cpu               = 1024
      memory            = 2048
      container_port    = 8080
      health_check_path = "/api/health"
      desired_count     = 1
      priority          = 200
    }
    chatbot = {
      cpu               = 256
      memory            = 512
      container_port    = 8080
      health_check_path = "/"
      desired_count     = 1
      priority          = 300
    }
  }
}

variable "log_retention_days" {
  description = "CloudWatch retention. Logs are billed for storage; unlimited retention is a slow leak."
  type        = number
  default     = 30
}

# ─────────────────────────────────────────────────────────────────────────────
# Secrets
# ─────────────────────────────────────────────────────────────────────────────

variable "secret_names" {
  description = <<-EOT
    Secrets to CREATE (empty) in AWS Secrets Manager, mirroring the 22 that exist
    in GCP Secret Manager.

    Terraform creates the containers only. VALUES ARE NEVER PUT IN TERRAFORM —
    they would land in state and in git. Populate them afterwards with
    `aws secretsmanager put-secret-value`, or through the console.

    A lifecycle ignore_changes on the value means a later `terraform apply` will
    not wipe what you entered.
  EOT
  type        = list(string)
  default = [
    "MONGODB_URI",
    "PAYLOAD_SECRET",
    "PAYLOAD_PIN_PEPPER",
    "INTERNAL_API_KEY",
    "CMS_OAUTH_KEY",
    "RESEND_API_KEY",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "OPEN_EXCHANGE_RATES_APP_ID",
    "UPSTASH_REDIS_REST_TOKEN",
    "ANALYTICS_GEO_TOKEN",
    "DIRECTOR_PIN",
    "JWT_SECRET",
    "GROQ_API_KEY",
    "CHATBOT_MONGODB_URI",
    "Meta_WA_accessToken",
    "Meta_WA_SenderPhoneNumberId",
    "Meta_WA_wabaId",
    "Meta_WA_VerfyToken",
  ]
}
