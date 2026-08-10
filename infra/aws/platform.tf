# ECR repositories, the media S3 bucket, Secrets Manager containers and log groups.

# ── ECR ──────────────────────────────────────────────────────────────────────

resource "aws_ecr_repository" "service" {
  for_each = var.services

  name = "${var.name_prefix}/${each.key}"

  # IMMUTABLE is the point. The GCP pipeline pushes a mutable :latest tag, which
  # means there is no previous image to roll back to — the tag is overwritten in
  # place. Immutable tags plus :$COMMIT_SHA give a real rollback target.
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# Artifact Registry on GCP has no cleanup policy and has been accumulating an
# image per push. Do not repeat that here: keep the last 15 tagged images and
# expire untagged layers quickly.
resource "aws_ecr_lifecycle_policy" "service" {
  for_each   = aws_ecr_repository.service
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep the 15 most recent tagged images"
        selection = {
          tagStatus     = "tagged"
          tagPatternList = ["*"]
          countType     = "imageCountMoreThan"
          countNumber   = 15
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Expire untagged images after 3 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 3
        }
        action = { type = "expire" }
      },
    ]
  })
}

# ── Media bucket ─────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "media" {
  bucket = "${var.name_prefix}-media-${var.environment}"

  # Refuse to destroy a bucket holding customer media. Removing this line is a
  # deliberate act, which is the intent.
  lifecycle {
    prevent_destroy = true
  }
}

# Payload streams every file through the CMS at /api/media/file/<name>. Nothing
# is ever fetched directly from the bucket, so it must never be public.
#
# This is load-bearing beyond `media`: the same bucket also holds `documents`,
# `enquiry-uploads` and `blog-submission-files`, and the last of those contains
# UNPUBLISHED MANUSCRIPTS. A public bucket would expose them.
resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Versioning is the undo button for an accidental overwrite or delete during the
# GCS -> S3 copy. Worth the small storage cost on a bucket this size.
resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket     = aws_s3_bucket.media.id
  depends_on = [aws_s3_bucket_versioning.media]

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# ── Secrets Manager ──────────────────────────────────────────────────────────

resource "aws_secretsmanager_secret" "app" {
  for_each = toset(var.secret_names)

  name        = "${var.name_prefix}/${var.environment}/${each.value}"
  description = "Mirrors GCP Secret Manager secret '${each.value}'. Value set out-of-band."

  # A short window so a mistaken destroy can be undone, without leaving the name
  # unusable for 30 days if the secret genuinely needs recreating.
  recovery_window_in_days = 7
}

# Created empty on purpose. Putting a value here would write the plaintext into
# terraform.tfstate and into any plan output.
resource "aws_secretsmanager_secret_version" "app_placeholder" {
  for_each = aws_secretsmanager_secret.app

  secret_id     = each.value.id
  secret_string = "PLACEHOLDER_SET_ME"

  # Without this, every future apply would overwrite the real value with the
  # placeholder — silently breaking production at the next unrelated change.
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# ── Logs ─────────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "service" {
  for_each = var.services

  name              = "/ecs/${var.name_prefix}/${each.key}"
  retention_in_days = var.log_retention_days
}
