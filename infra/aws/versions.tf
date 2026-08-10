terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }

  # Remote state is deliberately NOT configured yet.
  #
  # Bootstrapping it needs an S3 bucket + DynamoDB lock table that do not exist
  # until the first apply, so wiring it here would make the first run fail. Run
  # once with local state, then create the backend and migrate:
  #
  #   backend "s3" {
  #     bucket         = "metnmat-tfstate"
  #     key            = "prod/terraform.tfstate"
  #     region         = "ap-south-1"
  #     dynamodb_table = "metnmat-tfstate-lock"
  #     encrypt        = true
  #   }
  #
  # Until then terraform.tfstate is a LOCAL file that contains resource metadata.
  # It is gitignored. Do not commit it.
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
