output "alb_dns_name" {
  description = <<-EOT
    The load balancer hostname. This is how you test the AWS stack BEFORE any
    production DNS changes: point a hosts-file entry or a staging record at it.
  EOT
  value = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "For an ALIAS record if the zone is ever moved to Route 53."
  value       = aws_lb.main.zone_id
}

output "acm_validation_records" {
  description = <<-EOT
    CNAME records to add AT GODADDY to validate the certificate.

    `terraform apply` blocks until these resolve. They are unrelated to the
    records currently serving the site, so adding them does not affect
    production traffic.
  EOT
  value = var.create_acm_certificate ? [
    for o in aws_acm_certificate.main[0].domain_validation_options : {
      host  = o.resource_record_name
      type  = o.resource_record_type
      value = o.resource_record_value
    }
  ] : []
}

output "atlas_allowlist_ips" {
  description = <<-EOT
    Add these to the MongoDB Atlas IP access list BEFORE the first task starts,
    or the dashboard and chatbot cannot reach the database.

    KEEP THE EXISTING GCP ENTRIES. Removing them severs the GCP stack, which is
    the environment you would fall back to.

    Empty when enable_nat_gateway = false — egress is then unstable and Atlas
    must allow 0.0.0.0/0.
  EOT
  value = aws_eip.nat[*].public_ip
}

output "ecr_repository_urls" {
  description = "Push targets for CI. Tag with :$COMMIT_SHA, never :latest."
  value       = { for k, r in aws_ecr_repository.service : k => r.repository_url }
}

output "github_actions_role_arn" {
  description = "Set as the AWS_DEPLOY_ROLE secret in GitHub. No access key required."
  value       = aws_iam_role.github_deploy.arn
}

output "media_bucket" {
  description = "S3 bucket for Payload uploads. Empty until the GCS copy runs."
  value       = aws_s3_bucket.media.id
}

output "secret_arns" {
  description = "Secret containers created empty. Populate with `aws secretsmanager put-secret-value`."
  value       = { for k, s in aws_secretsmanager_secret.app : k => s.arn }
}

output "next_steps" {
  description = "What to do after a successful apply."
  value       = <<-EOT

    1. POPULATE SECRETS — every one is the literal string PLACEHOLDER_SET_ME.
       Nothing will start until they hold real values:

         aws secretsmanager put-secret-value \
           --secret-id metnmat/prod/MONGODB_URI \
           --secret-string "<value>" --region ap-south-1

       Do NOT pass values on a shell command line you would rather not keep;
       use --secret-string file://... and delete the file afterwards.

    2. ATLAS ALLOWLIST — add `terraform output atlas_allowlist_ips`.
       KEEP the existing GCP entries.

    3. BUILD AND PUSH IMAGES to the ECR URLs above, tagged :$COMMIT_SHA.
       The services will not become healthy until a real image exists — the
       task definitions currently reference a :bootstrap tag that is not there.

    4. TEST VIA THE ALB HOSTNAME, not via production DNS:
         curl -H "Host: www.metnmat.com" https://${aws_lb.main.dns_name}/api/health

    5. DNS LAST, and only once everything above passes.

  EOT
}
