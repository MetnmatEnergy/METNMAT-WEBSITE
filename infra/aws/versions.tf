terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  # Remote state in S3, with a DynamoDB lock table.
  #
  # This is not optional bookkeeping — running without it actively broke this
  # stack. CI runners are ephemeral, so a local state file dies with the job.
  # The first apply created 87 real AWS resources and then the runner was
  # discarded; the next run started from EMPTY state, could not see any of them,
  # and planned to create all 98 again. An apply at that point would have
  # collided on every globally-unique name (the S3 bucket, the IAM roles, the
  # ECR repos, all 22 secrets).
  #
  # The bucket and lock table are created by an idempotent step in
  # .github/workflows/terraform-aws.yml BEFORE `terraform init` runs, which is
  # how the chicken-and-egg is resolved: they cannot be managed by the very
  # state they store.
  backend "s3" {
    bucket         = "metnmat-tfstate-976134557584"
    key            = "prod/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "metnmat-tfstate-lock"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  # Guard rail: every apply asserts it is pointed at the intended account, so a
  # stray profile or an exported AWS_PROFILE cannot build this stack somewhere
  # unexpected. Terraform fails before creating anything if it does not match.
  allowed_account_ids = [var.aws_account_id]

  default_tags {
    tags = {
      Project     = "METNMAT"
      Environment = var.environment
      ManagedBy   = "terraform"
      Repository  = "MetnmatEnergy/METNMAT-WEBSITE"
    }
  }
}
