# Two distinct roles per the ECS model, and the distinction matters:
#
#   EXECUTION role — used by the ECS agent, BEFORE the container starts, to pull
#                    the image and resolve secrets into the environment.
#   TASK role      — assumed by the application code itself at runtime. This is
#                    what grants S3 access.
#
# Collapsing them into one is a common shortcut that hands the running container
# permission to read every secret in the account via the API. Kept separate.

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# ── Execution role ───────────────────────────────────────────────────────────

resource "aws_iam_role" "execution" {
  name               = "${var.name_prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Scoped to THIS stack's secrets by ARN. The managed policy above deliberately
# does not grant secret access, so this is the only path to them — and it cannot
# read secrets belonging to anything else in the account.
data "aws_iam_policy_document" "execution_secrets" {
  statement {
    sid       = "ReadOwnSecrets"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [for s in aws_secretsmanager_secret.app : s.arn]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "${var.name_prefix}-execution-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# ── Task roles (one per service, least privilege) ────────────────────────────

resource "aws_iam_role" "task" {
  for_each           = var.services
  name               = "${var.name_prefix}-task-${each.key}"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

# ONLY the dashboard writes media. The website reads through the CMS REST API and
# the chatbot touches no object storage at all, so neither gets S3 permissions.
#
# This is the AWS equivalent of Cloud Run's attached service account supplying
# ADC — the SDK picks these credentials up automatically, which is why
# S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are left unset in production.
data "aws_iam_policy_document" "dashboard_s3" {
  statement {
    sid = "ObjectReadWrite"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:GetObjectVersion",
    ]
    resources = ["${aws_s3_bucket.media.arn}/*"]
  }

  statement {
    sid = "BucketList"
    actions = [
      "s3:ListBucket",
      "s3:GetBucketLocation",
    ]
    resources = [aws_s3_bucket.media.arn]
  }
}

resource "aws_iam_role_policy" "dashboard_s3" {
  name   = "${var.name_prefix}-dashboard-s3"
  role   = aws_iam_role.task["dashboard"].id
  policy = data.aws_iam_policy_document.dashboard_s3.json
}

# ── GitHub Actions OIDC ──────────────────────────────────────────────────────
#
# Lets the CI workflow assume a role directly, with no long-lived AWS access key
# stored in GitHub. Short-lived credentials, nothing to leak or rotate.

resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # BOTH the repository AND the branch are pinned. Repo-only is the classic
    # mistake: any branch — including one opened by a fork's pull request — could
    # then assume this role and deploy to production.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:MetnmatEnergy/METNMAT-WEBSITE:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${var.name_prefix}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid       = "EcrAuth"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"] # this action does not accept a resource restriction
  }

  statement {
    sid = "EcrPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
      "ecr:BatchGetImage",
      "ecr:GetDownloadUrlForLayer",
    ]
    resources = [for r in aws_ecr_repository.service : r.arn]
  }

  statement {
    sid = "DeployService"
    actions = [
      "ecs:DescribeServices",
      "ecs:DescribeTaskDefinition",
      "ecs:RegisterTaskDefinition",
      "ecs:UpdateService",
    ]
    resources = ["*"] # RegisterTaskDefinition cannot be resource-scoped
  }

  # Required so the CI role can hand the task/execution roles to ECS. Scoped to
  # exactly these roles — unscoped iam:PassRole is a privilege-escalation hole.
  statement {
    sid       = "PassTaskRoles"
    actions   = ["iam:PassRole"]
    resources = concat([aws_iam_role.execution.arn], [for r in aws_iam_role.task : r.arn])
    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "${var.name_prefix}-github-deploy"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
