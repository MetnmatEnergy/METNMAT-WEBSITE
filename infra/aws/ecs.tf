# ECS cluster, task definitions and services.

resource "aws_ecs_cluster" "main" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled" # billed per metric; enable when there is a reason to
  }
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name       = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight            = 1
  }
}

locals {
  # Non-secret configuration, mirrored from the live Cloud Run services captured
  # in infra/backups/2026-08-10/cloudrun/. Sourcing these from the backup rather
  # than retyping them is what prevents the SEED_PRUNE_PLACEHOLDERS class of
  # mistake, which can delete production products on first boot.
  common_env = {
    NODE_ENV                = "production"
    NEXT_TELEMETRY_DISABLED = "1"
    PORT                    = "8080"

    # MUST stay above the ALB's idle_timeout (alb.tf, 300s). Node's HTTP server
    # closes an idle keep-alive connection after 5s by default. When the load
    # balancer holds a pooled connection longer than the origin will, the origin
    # closes it just as the ALB reuses it, and the ALB answers 502 — intermittent,
    # traffic-dependent, and impossible to reproduce on demand.
    #
    # The website is a Next standalone server, which reads this variable directly
    # (next/dist/build/utils.js). The dashboard runs `next start`, which does not
    # — it takes --keepAliveTimeout, passed in Dockerfile.dashboard's CMD. The
    # chatbot is an Express app in another repository and is NOT fixed by this.
    KEEP_ALIVE_TIMEOUT = "310000"
  }

  service_env = {
    website = {
      NEXT_PUBLIC_SITE_URL = "https://www.metnmat.com"
      NEXT_PUBLIC_CMS_URL  = "https://admin.metnmat.com"

      # Restored from infra/backups/2026-08-10/cloudrun/metnmat-website.yaml.
      # Omitting these did not fail anything — it silently changed behaviour:
      # QUOTE_NOTIFY_EMAIL defaults to contact@, so every sales enquiry and every
      # payment-anomaly ops alert would have quietly stopped reaching sales@; and
      # the Upstash REST URL is required alongside the token, so rate limiting
      # would have degraded to per-task memory with no log line either way.
      QUOTE_FROM_EMAIL       = "METNMAT <onboarding@resend.dev>"
      QUOTE_NOTIFY_EMAIL     = "sales@metnmat.com"
      UPSTASH_REDIS_REST_URL = "https://advanced-zebra-41141.upstash.io"
    }
    dashboard = {
      CMS_URL     = "https://admin.metnmat.com"
      WEBSITE_URL = "https://www.metnmat.com"
      EMAIL_FROM  = "METNMAT <onboarding@resend.dev>"

      # Also from the Cloud Run backup. Without DIRECTOR_EMAIL, seed.ts:731
      # returns before doing anything, so ensureDirectorAccount is a no-op and
      # the DIRECTOR_PIN secret below is inert.
      #
      # That matters more than it looks: a staff member's Payload password IS
      # HMAC(PAYLOAD_PIN_PEPPER, pin) — see collections/Users.ts. The director
      # bootstrap is what re-derives it after the pepper changes. With this
      # unset, setting a fresh pepper on AWS locks everyone out of the CMS, and
      # PIN-only accounts get a synthetic @staff.metnmat.local address that
      # cannot receive a password reset.
      DIRECTOR_EMAIL = "mk@metnmat.com"
      DIRECTOR_NAME  = "Mukesh Kumar"

      # Storage stays on GCS until the media copy is verified. Flipping to S3 is
      # a three-line change here — see docs/AWS-STORAGE-MIGRATION.md — but it
      # must NOT happen before the bucket is populated, or every image 404s.
      #   STORAGE_PROVIDER = "s3"
      #   S3_BUCKET        = aws_s3_bucket.media.id
      #   S3_REGION        = var.aws_region
      GCS_BUCKET     = "metnmat-media-prod"
      GCS_PROJECT_ID = "metnmat-website"
    }
    chatbot = {
      PUBLIC_URL                 = "https://chat.metnmat.com"
      ALLOWED_ORIGINS            = "https://www.metnmat.com,https://metnmat.com"
      FACEBOOK_GRAPH_API_VERSION = "v20.0"

      # Present on Cloud Run, missing here. The token without the URL is inert.
      UPSTASH_REDIS_REST_URL = "https://advanced-zebra-41141.upstash.io"
    }
  }

  # Which secrets each service actually needs. Deliberately not "all of them" —
  # the website has no database connection at all, and giving it MONGODB_URI
  # would hand a public-facing container credentials it never uses.
  #
  # ENV VAR NAME => SECRETS MANAGER SECRET NAME. These are not always the same,
  # and assuming they were is a real bug this shape fixes: the chatbot reads
  # MONGODB_URI (see the Cloud Run backup), but its value is stored under
  # CHATBOT_MONGODB_URI so it cannot collide with the CMS database — pointing
  # the CMS at the chatbot's database is gotcha #1 in CLAUDE.md. Injecting it
  # under the storage name meant the chatbot saw no MONGODB_URI at all.
  service_secrets = {
    website = {
      RESEND_API_KEY             = "RESEND_API_KEY"
      RAZORPAY_KEY_ID            = "RAZORPAY_KEY_ID"
      RAZORPAY_KEY_SECRET        = "RAZORPAY_KEY_SECRET"
      RAZORPAY_WEBHOOK_SECRET    = "RAZORPAY_WEBHOOK_SECRET"
      INTERNAL_API_KEY           = "INTERNAL_API_KEY"
      CMS_OAUTH_KEY              = "CMS_OAUTH_KEY"
      GOOGLE_CLIENT_ID           = "GOOGLE_CLIENT_ID"
      GOOGLE_CLIENT_SECRET       = "GOOGLE_CLIENT_SECRET"
      OPEN_EXCHANGE_RATES_APP_ID = "OPEN_EXCHANGE_RATES_APP_ID"
      UPSTASH_REDIS_REST_TOKEN   = "UPSTASH_REDIS_REST_TOKEN"
      ANALYTICS_GEO_TOKEN        = "ANALYTICS_GEO_TOKEN"
    }
    dashboard = {
      MONGODB_URI                = "MONGODB_URI"
      PAYLOAD_SECRET             = "PAYLOAD_SECRET"
      PAYLOAD_PIN_PEPPER         = "PAYLOAD_PIN_PEPPER"
      INTERNAL_API_KEY           = "INTERNAL_API_KEY"
      CMS_OAUTH_KEY              = "CMS_OAUTH_KEY"
      RESEND_API_KEY             = "RESEND_API_KEY"
      OPEN_EXCHANGE_RATES_APP_ID = "OPEN_EXCHANGE_RATES_APP_ID"
      DIRECTOR_PIN               = "DIRECTOR_PIN"
    }
    chatbot = {
      MONGODB_URI                 = "CHATBOT_MONGODB_URI"
      GROQ_API_KEY                = "GROQ_API_KEY"
      JWT_SECRET                  = "JWT_SECRET"
      UPSTASH_REDIS_REST_TOKEN    = "UPSTASH_REDIS_REST_TOKEN"
      Meta_WA_accessToken         = "Meta_WA_accessToken"
      Meta_WA_SenderPhoneNumberId = "Meta_WA_SenderPhoneNumberId"
      Meta_WA_wabaId              = "Meta_WA_wabaId"
      Meta_WA_VerfyToken          = "Meta_WA_VerfyToken"
    }
  }
}

resource "aws_ecs_task_definition" "service" {
  for_each = var.services

  family                   = "${var.name_prefix}-${each.key}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = each.value.cpu
  memory                   = each.value.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task[each.key].arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([
    {
      name = each.key
      # Placeholder only. CI replaces this with :$COMMIT_SHA on every deploy, and
      # the lifecycle block below stops Terraform from reverting it afterwards.
      image = "${aws_ecr_repository.service[each.key].repository_url}:bootstrap"

      essential = true

      portMappings = [{
        containerPort = each.value.container_port
        protocol      = "tcp"
      }]

      environment = [
        for k, v in merge(local.common_env, local.service_env[each.key]) :
        { name = k, value = v }
      ]

      # Injected by the ECS agent at start — the container never sees an API
      # call to Secrets Manager, and the values never appear in the task
      # definition, in state, or in the console.
      secrets = [
        for env_name, secret_name in local.service_secrets[each.key] :
        { name = env_name, valueFrom = aws_secretsmanager_secret.app[secret_name].arn }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.service[each.key].name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }
    }
  ])

  # NO lifecycle ignore here, deliberately — and the reason is worth recording,
  # because the obvious-looking `ignore_changes = [container_definitions]` that
  # used to be here was actively harmful.
  #
  # container_definitions is a single JSON blob holding the image AND the
  # environment AND the secret wiring. Ignoring it to protect the image tag also
  # froze every environment variable in this file: `terraform apply` could not
  # change them, so the DIRECTOR_EMAIL / QUOTE_NOTIFY_EMAIL / UPSTASH_REDIS_REST_URL
  # omissions above were unfixable through Terraform. Config drifted silently and
  # permanently, which is the opposite of what the stack is for.
  #
  # Removing it does NOT let Terraform revert a deploy, because the two resources
  # divide responsibility:
  #   - Terraform owns this task definition FAMILY. An apply registers a new
  #     revision carrying the config above and the placeholder image tag.
  #   - CI reads the family's latest revision, swaps ONLY the image, registers
  #     its own revision, and points the service at it (deploy-aws.yml).
  #   - The service keeps ignore_changes = [task_definition] (below), so an apply
  #     never moves the RUNNING revision.
  # The placeholder tag is therefore never deployed: CI always overwrites the
  # image before update-service. Config changes here reach production on the next
  # deploy, which is exactly when they should.
}

resource "aws_ecs_service" "service" {
  for_each = var.services

  name            = "${var.name_prefix}-${each.key}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.service[each.key].arn
  desired_count   = each.value.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.task_subnet_ids
    security_groups  = [aws_security_group.tasks.id]
    assign_public_ip = local.assign_public_ip
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.service[each.key].arn
    container_name   = each.key
    container_port   = each.value.container_port
  }

  # Rolling deploy with no capacity dip: 100 keeps the old task serving until the
  # new one is healthy, 200 allows both to run briefly. This is what makes a bad
  # deploy fail closed — an unhealthy task never receives traffic.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # Payload seeds on boot; give it time before the first health check counts.
  health_check_grace_period_seconds = 120

  # Same reason as the task definition: CI moves this forward, Terraform must not
  # move it back.
  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }

  depends_on = [aws_lb_listener.https]
}
