terraform {
  required_version = ">= 1.10.0" # use_lockfile (native S3 state locking) requires 1.10+

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend values (bucket, region, key) are intentionally left out of this
  # committed file to avoid exposing account-specific info in a public repo.
  # Provide them at `terraform init` time via -backend-config=backend.hcl
  # (see backend.hcl.example).
  backend "s3" {
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  common_tags = merge(
    {
      Project   = var.project_name
      ManagedBy = "terraform"
    },
    var.tags
  )
}
