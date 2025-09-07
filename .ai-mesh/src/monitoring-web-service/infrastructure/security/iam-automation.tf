# IAM Role and Policy Generation with Least-Privilege Principle
# Infrastructure Management Subagent - Security and Compliance Automation

# Variables
variable "app_name" {
  description = "Application name"
  type        = string
  default     = "monitoring-web-service"
}

variable "environment" {
  description = "Environment (development, staging, production)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for security group rules"
  type        = string
}

variable "kms_key_arn" {
  description = "KMS key ARN for encryption"
  type        = string
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {}

# IAM Policy Generation Module
locals {
  # Base IAM policies for different service types
  service_policies = {
    web_service = {
      description = "Least-privilege policy for web service"
      actions = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams",
        "cloudwatch:PutMetricData",
        "xray:PutTraceSegments",
        "xray:PutTelemetryRecords",
        "xray:GetSamplingRules",
        "xray:GetSamplingTargets"
      ]
      resources = [
        "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/ecs/${var.app_name}-${var.environment}*",
        "arn:aws:cloudwatch:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
      ]
    }
    
    database_service = {
      description = "Least-privilege policy for database access"
      actions = [
        "rds:DescribeDBInstances",
        "rds:DescribeDBClusters",
        "rds-db:connect"
      ]
      resources = [
        "arn:aws:rds-db:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:dbuser:${var.app_name}-${var.environment}-db/${var.app_name}-user"
      ]
    }
    
    storage_service = {
      description = "Least-privilege policy for S3 access"
      actions = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ]
      resources = [
        "arn:aws:s3:::${var.app_name}-${var.environment}-*",
        "arn:aws:s3:::${var.app_name}-${var.environment}-*/*"
      ]
    }
    
    secrets_service = {
      description = "Least-privilege policy for secrets access"
      actions = [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ]
      resources = [
        "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.app_name}/${var.environment}/*"
      ]
    }
    
    kms_service = {
      description = "Least-privilege policy for KMS access"
      actions = [
        "kms:Decrypt",
        "kms:DescribeKey",
        "kms:GenerateDataKey"
      ]
      resources = [
        var.kms_key_arn
      ]
    }
  }

  # Environment-specific policy modifiers
  environment_policies = {
    development = {
      additional_actions = [
        "logs:DescribeLogGroups",
        "cloudwatch:GetMetricStatistics"
      ]
      resource_scope = "*"
    }
    staging = {
      additional_actions = [
        "logs:DescribeLogGroups"
      ]
      resource_scope = "environment"
    }
    production = {
      additional_actions = []
      resource_scope = "strict"
    }
  }
}

# ECS Task Role with Least-Privilege
resource "aws_iam_role" "ecs_task_role" {
  name = "${var.app_name}-${var.environment}-ecs-task-role"
  path = "/"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
          ArnLike = {
            "aws:SourceArn" = "arn:aws:ecs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
          }
        }
      }
    ]
  })

  # Session duration and external ID for additional security
  max_session_duration = var.environment == "production" ? 3600 : 7200

  tags = {
    Name        = "${var.app_name}-${var.environment}-ecs-task-role"
    Environment = var.environment
    Application = var.app_name
    PolicyScope = "least-privilege"
  }
}

# ECS Task Execution Role
resource "aws_iam_role" "ecs_execution_role" {
  name = "${var.app_name}-${var.environment}-ecs-execution-role"
  path = "/"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-ecs-execution-role"
    Environment = var.environment
    Application = var.app_name
  }
}

# Attach AWS managed policy to execution role
resource "aws_iam_role_policy_attachment" "ecs_execution_role_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Custom execution policy for enhanced logging and secrets
resource "aws_iam_role_policy" "ecs_execution_custom_policy" {
  name = "${var.app_name}-${var.environment}-execution-custom-policy"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "ssm:GetParameters",
          "ssm:GetParameter",
          "kms:Decrypt"
        ]
        Resource = [
          "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.app_name}/${var.environment}/*",
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.app_name}/${var.environment}/*",
          var.kms_key_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/ecs/${var.app_name}-${var.environment}*"
      }
    ]
  })
}

# Composite Task Policy Generator
resource "aws_iam_policy" "ecs_task_policy" {
  name        = "${var.app_name}-${var.environment}-ecs-task-policy"
  path        = "/"
  description = "Composite least-privilege policy for ECS task"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      # Web service permissions
      [
        {
          Effect   = "Allow"
          Action   = local.service_policies.web_service.actions
          Resource = local.service_policies.web_service.resources
        }
      ],
      # Database permissions
      [
        {
          Effect   = "Allow"
          Action   = local.service_policies.database_service.actions
          Resource = local.service_policies.database_service.resources
        }
      ],
      # Storage permissions
      [
        {
          Effect   = "Allow"
          Action   = local.service_policies.storage_service.actions
          Resource = local.service_policies.storage_service.resources
        }
      ],
      # Secrets permissions
      [
        {
          Effect   = "Allow"
          Action   = local.service_policies.secrets_service.actions
          Resource = local.service_policies.secrets_service.resources
        }
      ],
      # KMS permissions
      [
        {
          Effect   = "Allow"
          Action   = local.service_policies.kms_service.actions
          Resource = local.service_policies.kms_service.resources
        }
      ],
      # Environment-specific permissions
      var.environment == "development" ? [
        {
          Effect   = "Allow"
          Action   = local.environment_policies.development.additional_actions
          Resource = "*"
          Condition = {
            StringLike = {
              "aws:RequestedRegion" = [data.aws_region.current.name]
            }
          }
        }
      ] : [],
      # Time-based access for production
      var.environment == "production" ? [
        {
          Effect   = "Allow"
          Action   = ["cloudwatch:*"]
          Resource = "*"
          Condition = {
            DateGreaterThan = {
              "aws:CurrentTime" = "2024-01-01T00:00:00Z"
            }
            DateLessThan = {
              "aws:CurrentTime" = "2025-12-31T23:59:59Z"
            }
            IpAddress = {
              "aws:SourceIp" = [
                "10.0.0.0/8",    # VPC CIDR
                "172.16.0.0/12", # Private networks
                "192.168.0.0/16" # Private networks
              ]
            }
          }
        }
      ] : []
    )
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-ecs-task-policy"
    Environment = var.environment
    Application = var.app_name
    Generated   = timestamp()
  }
}

# Attach task policy to task role
resource "aws_iam_role_policy_attachment" "ecs_task_policy_attachment" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_task_policy.arn
}

# Lambda Execution Role with Least-Privilege
resource "aws_iam_role" "lambda_execution_role" {
  name = "${var.app_name}-${var.environment}-lambda-execution-role"
  path = "/"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-lambda-execution-role"
    Environment = var.environment
    Application = var.app_name
  }
}

# Lambda policy with VPC and secrets access
resource "aws_iam_policy" "lambda_policy" {
  name        = "${var.app_name}-${var.environment}-lambda-policy"
  path        = "/"
  description = "Least-privilege policy for Lambda functions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.app_name}-${var.environment}*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:AttachNetworkInterface",
          "ec2:DetachNetworkInterface"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ec2:Vpc" = var.vpc_id
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "ssm:GetParameter",
          "ssm:GetParameters"
        ]
        Resource = [
          "arn:aws:secretsmanager:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:secret:${var.app_name}/${var.environment}/*",
          "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter/${var.app_name}/${var.environment}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = var.kms_key_arn
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-lambda-policy"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_iam_role_policy_attachment" "lambda_policy_attachment" {
  role       = aws_iam_role.lambda_execution_role.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

# Auto Scaling Role
resource "aws_iam_role" "autoscaling_role" {
  name = "${var.app_name}-${var.environment}-autoscaling-role"
  path = "/"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "application-autoscaling.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-autoscaling-role"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_iam_role_policy_attachment" "autoscaling_policy" {
  role       = aws_iam_role.autoscaling_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSServiceRolePolicy"
}

# Custom Auto Scaling Policy
resource "aws_iam_policy" "autoscaling_custom_policy" {
  name        = "${var.app_name}-${var.environment}-autoscaling-custom-policy"
  path        = "/"
  description = "Custom policy for ECS auto scaling"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:DescribeServices",
          "ecs:UpdateService",
          "cloudwatch:PutMetricAlarm",
          "cloudwatch:DescribeAlarms",
          "cloudwatch:DeleteAlarms"
        ]
        Resource = [
          "arn:aws:ecs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:service/${var.app_name}-cluster/${var.app_name}-${var.environment}*",
          "arn:aws:cloudwatch:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:alarm:${var.app_name}-${var.environment}-*"
        ]
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-autoscaling-custom-policy"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_iam_role_policy_attachment" "autoscaling_custom_policy_attachment" {
  role       = aws_iam_role.autoscaling_role.name
  policy_arn = aws_iam_policy.autoscaling_custom_policy.arn
}

# Cross-Account Access Role (for CI/CD)
resource "aws_iam_role" "cicd_cross_account_role" {
  count = var.environment == "production" ? 1 : 0
  name  = "${var.app_name}-${var.environment}-cicd-cross-account-role"
  path  = "/"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.cicd_account_id}:root"
        }
        Condition = {
          StringEquals = {
            "sts:ExternalId" = var.cicd_external_id
          }
          StringLike = {
            "aws:userid" = "*:${var.app_name}-cicd-user"
          }
        }
      }
    ]
  })

  max_session_duration = 3600  # 1 hour for CI/CD operations

  tags = {
    Name        = "${var.app_name}-${var.environment}-cicd-cross-account-role"
    Environment = var.environment
    Application = var.app_name
    Purpose     = "ci-cd-cross-account"
  }
}

# CI/CD Deployment Policy
resource "aws_iam_policy" "cicd_deployment_policy" {
  count       = var.environment == "production" ? 1 : 0
  name        = "${var.app_name}-${var.environment}-cicd-deployment-policy"
  path        = "/"
  description = "Limited deployment permissions for CI/CD"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeTaskDefinition",
          "ecs:RegisterTaskDefinition"
        ]
        Resource = [
          "arn:aws:ecs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:service/${var.app_name}-cluster/${var.app_name}-${var.environment}",
          "arn:aws:ecs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:task-definition/${var.app_name}-${var.environment}*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
        Condition = {
          StringLike = {
            "ecr:ResourceTag/Environment" = var.environment
          }
        }
      },
      {
        Effect = "Allow"
        Action = [
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/ecs/${var.app_name}-${var.environment}*"
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-cicd-deployment-policy"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_iam_role_policy_attachment" "cicd_deployment_policy_attachment" {
  count      = var.environment == "production" ? 1 : 0
  role       = aws_iam_role.cicd_cross_account_role[0].name
  policy_arn = aws_iam_policy.cicd_deployment_policy[0].arn
}

# Policy Boundary for Additional Security
resource "aws_iam_policy" "permission_boundary" {
  name        = "${var.app_name}-${var.environment}-permission-boundary"
  path        = "/"
  description = "Permission boundary to limit maximum permissions"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:*",
          "cloudwatch:*",
          "xray:*",
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
          "ssm:GetParameter",
          "ssm:GetParameters",
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "rds-db:connect",
          "rds:DescribeDBInstances"
        ]
        Resource = "*"
      },
      {
        Effect = "Deny"
        Action = [
          "iam:*",
          "organizations:*",
          "account:*"
        ]
        Resource = "*"
      },
      {
        Effect = "Deny"
        Action = "*"
        Resource = "*"
        Condition = {
          StringNotEquals = {
            "aws:RequestedRegion" = [
              data.aws_region.current.name,
              "us-east-1"  # Allow CloudFront region
            ]
          }
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-permission-boundary"
    Environment = var.environment
    Application = var.app_name
    Purpose     = "security-boundary"
  }
}

# Variables for cross-account access
variable "cicd_account_id" {
  description = "AWS account ID for CI/CD cross-account access"
  type        = string
  default     = ""
}

variable "cicd_external_id" {
  description = "External ID for CI/CD cross-account access"
  type        = string
  default     = ""
}

# Outputs
output "ecs_task_role_arn" {
  description = "ARN of the ECS task role"
  value       = aws_iam_role.ecs_task_role.arn
}

output "ecs_execution_role_arn" {
  description = "ARN of the ECS execution role"
  value       = aws_iam_role.ecs_execution_role.arn
}

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution_role.arn
}

output "autoscaling_role_arn" {
  description = "ARN of the auto scaling role"
  value       = aws_iam_role.autoscaling_role.arn
}

output "permission_boundary_arn" {
  description = "ARN of the permission boundary policy"
  value       = aws_iam_policy.permission_boundary.arn
}

output "cicd_cross_account_role_arn" {
  description = "ARN of the CI/CD cross-account role"
  value       = var.environment == "production" ? aws_iam_role.cicd_cross_account_role[0].arn : ""
}

output "policy_arns" {
  description = "ARNs of all generated policies"
  value = {
    ecs_task_policy              = aws_iam_policy.ecs_task_policy.arn
    lambda_policy               = aws_iam_policy.lambda_policy.arn
    autoscaling_custom_policy   = aws_iam_policy.autoscaling_custom_policy.arn
    permission_boundary         = aws_iam_policy.permission_boundary.arn
    cicd_deployment_policy      = var.environment == "production" ? aws_iam_policy.cicd_deployment_policy[0].arn : ""
  }
}