# One ALB, host-routed to three target groups.
#
# One load balancer rather than three is deliberate: the ALB has a fixed hourly
# charge, so three would triple the largest fixed cost in the stack for no
# benefit. Host-based listener rules separate the services cleanly.

resource "aws_lb" "main" {
  name               = "${var.name_prefix}-alb"
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  # Cloud Run's request timeout is currently 300s. Match it rather than accept
  # the 60s default, which would cut off long admin operations.
  idle_timeout = 300

  enable_http2               = true
  drop_invalid_header_fields = true

  # Guards against `terraform destroy` taking production offline by accident.
  enable_deletion_protection = true

  # Without this there is NO record of an HTTP request anywhere in the stack.
  # CloudWatch holds application stdout only, so a 502, a 404 or a spike of
  # traffic against a path the app never logs leaves no trace at all — and after
  # DNS cutover this is the only place a request is seen before it reaches a
  # container. GCP's load balancer produced these; the stack did not replicate it.
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb"
    enabled = true
  }

  # AWS validates the bucket policy at the moment access logging is enabled, by
  # writing a probe object. The reference above only makes Terraform order this
  # after the BUCKET, not after its policy — so without this the apply races and
  # fails with "Access Denied for bucket". Explicit, because the graph cannot
  # infer it.
  depends_on = [aws_s3_bucket_policy.alb_logs]
}

resource "aws_lb_target_group" "service" {
  for_each = var.services

  # name_prefix, NOT name. With create_before_destroy below, a fixed name makes
  # the replacement fail — the old target group still holds it. AWS caps this
  # prefix at 6 characters.
  name_prefix = substr(each.key, 0, 6)
  port        = each.value.container_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip" # required for Fargate

  health_check {
    enabled             = true
    path                = each.value.health_check_path
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    # Both services expose a real /api/health returning 200. 200-399 is kept
    # rather than a strict 200 so a future redirect in front of a service
    # cannot silently mark every task unhealthy.
    matcher = "200-399"
  }

  # How long the ALB keeps sending an in-flight request to a task that is being
  # replaced. (The previous comment here described STARTUP, which this setting
  # has nothing to do with — startup is health_check_grace_period_seconds on the
  # service.) Too short and a deploy cuts off requests still being served; the
  # admin runs long operations, so 30s was optimistic. 60s drains comfortably
  # while keeping deploys quick.
  deregistration_delay = 60

  # A target group cannot be destroyed while a listener rule references it;
  # create the replacement first.
  lifecycle {
    create_before_destroy = true
  }
}

# ── TLS ──────────────────────────────────────────────────────────────────────
#
# ACM in ap-south-1, because the certificate terminates on the ALB. (The
# us-east-1 requirement people remember applies to CloudFront, not to an ALB.)

resource "aws_acm_certificate" "main" {
  count = var.create_acm_certificate ? 1 : 0

  domain_name               = var.root_domain
  subject_alternative_names = keys(var.service_domains)
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# DNS validation records must be added at GoDaddy by hand — the zone is not in
# Route 53, so Terraform cannot create them. `terraform apply` will WAIT here
# until they resolve. Run `terraform output acm_validation_records` to get them.
#
# These CNAMEs are unrelated to the records currently serving the site, so adding
# them changes nothing about production traffic.
resource "aws_acm_certificate_validation" "main" {
  count           = var.create_acm_certificate ? 1 : 0
  certificate_arn = aws_acm_certificate.main[0].arn

  timeouts {
    create = "60m"
  }
}

# ── Listeners ────────────────────────────────────────────────────────────────

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port     = "443"
      protocol = "HTTPS"

      # 301 is NOT a preference — it is the only real choice here. The ELBv2 API
      # accepts exactly "HTTP_301" or "HTTP_302" for a redirect action, and
      # anything else fails `terraform validate` outright:
      #
      #   Error: expected status_code to be one of ["HTTP_301" "HTTP_302"],
      #          got HTTP_308
      #
      # That matters because a 301 lets a client re-issue the request as GET, so
      # the body of a POST arriving over plain HTTP is dropped. middleware.ts
      # deliberately uses 308 for its own apex->www redirect for exactly that
      # reason — but middleware runs INSIDE the app, where 308 is available, and
      # the ALB is in front of it.
      #
      # What actually covers the gap:
      #   - next.config.mjs sends HSTS with `preload`, so a browser that has seen
      #     the site once never issues plain HTTP again.
      #   - Machine callers that would POST (the Razorpay webhook) are configured
      #     with an https:// URL, so they never traverse this listener.
      # If a plaintext POST ever becomes a real path, terminate it at CloudFront,
      # which does support 307/308.
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  count = var.create_acm_certificate ? 1 : 0

  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.main[0].certificate_arn

  # Anything not matching a host rule gets a flat 404 rather than being handed
  # to whichever service happens to be first.
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }
}

# The ZONE APEX, handled separately from service_domains.
#
# Without this rule, Host: metnmat.com matches no listener rule — the rules below
# use exact host_header matching — and falls through to the HTTPS listener's
# default action, a flat 404. Two things break at that moment:
#   1. Anyone typing the bare domain gets an ALB error page, not the site.
#   2. The apex -> www 308 in apps/website/src/middleware.ts never executes,
#      because the request never reaches the application. That redirect is not
#      cosmetic: it is what fixed the host-only-cookie trap that broke Google
#      sign-in and persistent sessions (the OAuth state cookie was being set on
#      the apex while redirect_uri pointed at www).
#
# Forwarded to the WEBSITE target group rather than answered with an ALB-level
# redirect, deliberately: middleware.ts already owns canonical-host policy, and
# duplicating it here would mean two places to keep in sync, with the ALB copy
# unable to use 308.
#
# NOT added to var.service_domains, which would be the obvious-looking change:
# that map feeds aws_acm_certificate.subject_alternative_names, and the apex is
# already the certificate's domain_name (alb.tf, aws_acm_certificate.main). Adding
# it there would duplicate it into the SAN list and force certificate
# REPLACEMENT — re-validation, and an outage window on a live listener.
#
# Priority 50 sits above the service rules (100/200/300) and collides with none.
#
# STILL REQUIRED, AND NOT SOLVABLE IN THIS REPOSITORY: GoDaddy cannot point an
# apex A record at an ALB — there is no ALIAS/ANAME record type there, and an ALB
# has no static IP. This rule makes the ALB answer the apex correctly once
# something can route it; getting traffic there needs Route 53 (alias record) or
# CloudFront in front. See docs/aws-production-report.md.
resource "aws_lb_listener_rule" "apex" {
  count = var.create_acm_certificate ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 50

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.service["website"].arn
  }

  condition {
    host_header {
      values = [var.root_domain]
    }
  }
}

resource "aws_lb_listener_rule" "host" {
  for_each = var.create_acm_certificate ? var.service_domains : {}

  listener_arn = aws_lb_listener.https[0].arn
  priority     = var.services[each.value].priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.service[each.value].arn
  }

  condition {
    host_header {
      values = [each.key]
    }
  }
}
