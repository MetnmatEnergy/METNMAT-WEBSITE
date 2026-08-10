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
    NODE_ENV               = "production"
    NEXT_TELEMETRY_DISABLED = "1"
    PORT                   = "8080"
  }

  service_env = {
    website = {
      NEXT_PUBLIC_SITE_URL = "https://www.metnmat.com"
      NEXT_PUBLIC_CMS_URL  = "https://admin.metnmat.com"
    }
    dashboard = {
      CMS_URL     = "https://admin.metnmat.com"
      WEBSITE_URL = "https://www.metnmat.com"
      EMAIL_FROM  = "METNMAT <onboarding@resend.dev>"

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
    }
  }

  # Which secrets each service actually needs. Deliberately not "all of them" —
  # the website has no database connection at all, and giving it MONGODB_URI
  # would hand a public-facing container credentials it never uses.
  service_secrets = {
    website = [
      "RESEND_API_KEY", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET",
      "RAZORPAY_WEBHOOK_SECRET", "INTERNAL_API_KEY", "CMS_OAUTH_KEY",
      "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
      "OPEN_EXCHANGE_RATES_APP_ID", "UPSTASH_REDIS_REST_TOKEN",
      "ANALYTICS_GEO_TOKEN",
    ]
    dashboard = [
      "MONGODB_URI", "PAYLOAD_SECRET", "PAYLOAD_PIN_PEPPER",
      "INTERNAL_API_KEY", "CMS_OAUTH_KEY", "RESEND_API_KEY",
      "OPEN_EXCHANGE_RATES_APP_ID", "DIRECTOR_PIN",
    ]
    chatbot = [
      "CHATBOT_MONGODB_URI", "GROQ_API_KEY", "JWT_SECRET",
      "UPSTASH_REDIS_REST_TOKEN",
      "Meta_WA_accessToken", "Meta_WA_SenderPhoneNumberId",
      "Meta_WA_wabaId", "Meta_WA_VerfyToken",
    ]
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
      name  = each.key
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
        for s in local.service_secrets[each.key] :
        { name = s, valueFrom = aws_secretsmanager_secret.app[s].arn }
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

  # CI owns the image tag. Without this, the next `terraform apply` would roll
  # production back to whatever tag is written above.
  lifecycle {
    ignore_changes = [container_definitions]
  }
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
