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
      # 308, not 301. A 301 permits the client to re-issue the request as GET,
      # which silently DROPS the body of any POST that arrives over plain HTTP —
      # a mis-configured Razorpay webhook or a form posted to http:// would be
      # answered 200 by the redirect and never reach the application. 308 keeps
      # the method and body intact. middleware.ts makes the same choice, for the
      # same reason.
      status_code = "HTTP_308"
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
