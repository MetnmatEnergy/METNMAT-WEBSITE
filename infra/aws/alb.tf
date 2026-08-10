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
    # 200-399 so a redirect counts as healthy. The dashboard's "/" returns a
    # redirect to /admin, and it has no dedicated health route yet.
    matcher = "200-399"
  }

  # Payload's boot runs a seed before it serves, so give it room to start.
  deregistration_delay = 30

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
      port        = "443"
      protocol    = "HTTPS"
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
