# AWS Secrets Manager Integration with Automatic Rotation
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

variable "kms_key_id" {
  description = "KMS key ID for encryption"
  type        = string
}

variable "database_username" {
  description = "Database master username"
  type        = string
  default     = "postgres"
}

variable "vpc_id" {
  description = "VPC ID for Lambda function"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for Lambda function"
  type        = list(string)
}

variable "database_cluster_identifier" {
  description = "RDS cluster identifier"
  type        = string
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# Random passwords for secrets
resource "random_password" "database_password" {
  length  = 32
  special = true
  upper   = true
  lower   = true
  numeric = true
  
  # Avoid characters that might cause issues in connection strings
  override_special = "!#$%&*()-_=+[]{}<>?"
}

resource "random_password" "redis_password" {
  length  = 32
  special = false
  upper   = true
  lower   = true
  numeric = true
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
  upper   = true
  lower   = true
  numeric = true
}

resource "random_password" "api_key" {
  length  = 40
  special = false
  upper   = true
  lower   = true
  numeric = true
}

# Database credentials secret
resource "aws_secretsmanager_secret" "database_credentials" {
  name                    = "${var.app_name}/${var.environment}/database/credentials"
  description             = "Database credentials for ${var.app_name} ${var.environment}"
  kms_key_id             = var.kms_key_id
  recovery_window_in_days = var.environment == "production" ? 7 : 0

  replica {
    region = "us-east-1"
    kms_key_id = var.kms_key_id
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-database-credentials"
    Environment = var.environment
    Application = var.app_name
    SecretType  = "database-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "database_credentials" {
  secret_id = aws_secretsmanager_secret.database_credentials.id
  
  secret_string = jsonencode({
    username = var.database_username
    password = random_password.database_password.result
    engine   = "postgres"
    host     = "${var.app_name}-${var.environment}-db.cluster-${random_id.cluster_suffix.hex}.${data.aws_region.current.name}.rds.amazonaws.com"
    port     = 5432
    dbname   = "${var.app_name}_${var.environment}"
    dbInstanceIdentifier = var.database_cluster_identifier
  })
}

# Redis credentials secret
resource "aws_secretsmanager_secret" "redis_credentials" {
  name                    = "${var.app_name}/${var.environment}/redis/credentials"
  description             = "Redis credentials for ${var.app_name} ${var.environment}"
  kms_key_id             = var.kms_key_id
  recovery_window_in_days = var.environment == "production" ? 7 : 0

  tags = {
    Name        = "${var.app_name}-${var.environment}-redis-credentials"
    Environment = var.environment
    Application = var.app_name
    SecretType  = "redis-credentials"
  }
}

resource "aws_secretsmanager_secret_version" "redis_credentials" {
  secret_id = aws_secretsmanager_secret.redis_credentials.id
  
  secret_string = jsonencode({
    password = random_password.redis_password.result
    host     = "${var.app_name}-${var.environment}-redis.${random_id.redis_suffix.hex}.cache.amazonaws.com"
    port     = 6379
    url      = "redis://:${random_password.redis_password.result}@${var.app_name}-${var.environment}-redis.${random_id.redis_suffix.hex}.cache.amazonaws.com:6379"
  })
}

# Application secrets
resource "aws_secretsmanager_secret" "application_secrets" {
  name                    = "${var.app_name}/${var.environment}/application/secrets"
  description             = "Application secrets for ${var.app_name} ${var.environment}"
  kms_key_id             = var.kms_key_id
  recovery_window_in_days = var.environment == "production" ? 7 : 0

  tags = {
    Name        = "${var.app_name}-${var.environment}-application-secrets"
    Environment = var.environment
    Application = var.app_name
    SecretType  = "application-secrets"
  }
}

resource "aws_secretsmanager_secret_version" "application_secrets" {
  secret_id = aws_secretsmanager_secret.application_secrets.id
  
  secret_string = jsonencode({
    jwt_secret           = random_password.jwt_secret.result
    api_key             = random_password.api_key.result
    encryption_key      = base64encode(random_password.jwt_secret.result)
    webhook_secret      = random_password.api_key.result
    oauth_client_secret = random_password.api_key.result
  })
}

# Third-party API keys secret
resource "aws_secretsmanager_secret" "api_keys" {
  name                    = "${var.app_name}/${var.environment}/api/keys"
  description             = "Third-party API keys for ${var.app_name} ${var.environment}"
  kms_key_id             = var.kms_key_id
  recovery_window_in_days = var.environment == "production" ? 7 : 0

  tags = {
    Name        = "${var.app_name}-${var.environment}-api-keys"
    Environment = var.environment
    Application = var.app_name
    SecretType  = "api-keys"
  }
}

resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id
  
  secret_string = jsonencode({
    datadog_api_key     = "placeholder-datadog-api-key"
    slack_webhook_url   = "https://hooks.slack.com/services/placeholder"
    github_token        = "placeholder-github-token"
    aws_access_key_id   = "placeholder-aws-access-key"
    aws_secret_key      = "placeholder-aws-secret-key"
    sendgrid_api_key    = "placeholder-sendgrid-api-key"
  })
}

# Random IDs for unique naming
resource "random_id" "cluster_suffix" {
  byte_length = 4
}

resource "random_id" "redis_suffix" {
  byte_length = 4
}

# Lambda function for automatic secret rotation
resource "aws_lambda_function" "secret_rotation" {
  count = var.environment == "production" ? 1 : 0
  
  filename         = "secret-rotation.zip"
  function_name    = "${var.app_name}-${var.environment}-secret-rotation"
  role            = aws_iam_role.secret_rotation_role[0].arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.secret_rotation[0].output_base64sha256
  runtime         = "python3.9"
  timeout         = 30
  
  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = [aws_security_group.secret_rotation[0].id]
  }

  environment {
    variables = {
      ENVIRONMENT                = var.environment
      APP_NAME                  = var.app_name
      DATABASE_CLUSTER_IDENTIFIER = var.database_cluster_identifier
    }
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-secret-rotation"
    Environment = var.environment
    Application = var.app_name
  }
}

# Security group for Lambda rotation function
resource "aws_security_group" "secret_rotation" {
  count = var.environment == "production" ? 1 : 0
  
  name_prefix = "${var.app_name}-${var.environment}-secret-rotation-"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS outbound for AWS API calls"
  }

  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "PostgreSQL connection"
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-secret-rotation-sg"
    Environment = var.environment
    Application = var.app_name
  }
}

# IAM role for secret rotation Lambda
resource "aws_iam_role" "secret_rotation_role" {
  count = var.environment == "production" ? 1 : 0
  name  = "${var.app_name}-${var.environment}-secret-rotation-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-secret-rotation-role"
    Environment = var.environment
    Application = var.app_name
  }
}

# IAM policy for secret rotation
resource "aws_iam_role_policy" "secret_rotation_policy" {
  count = var.environment == "production" ? 1 : 0
  name  = "${var.app_name}-${var.environment}-secret-rotation-policy"
  role  = aws_iam_role.secret_rotation_role[0].id

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
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${var.app_name}-${var.environment}-secret-rotation*"
      },
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecretVersionStage"
        ]
        Resource = [
          aws_secretsmanager_secret.database_credentials.arn,
          aws_secretsmanager_secret.redis_credentials.arn,
          aws_secretsmanager_secret.application_secrets.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "rds:ModifyDBCluster",
          "rds:DescribeDBClusters",
          "rds:DescribeDBInstances"
        ]
        Resource = [
          "arn:aws:rds:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:cluster:${var.database_cluster_identifier}",
          "arn:aws:rds:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:db:${var.database_cluster_identifier}-*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "arn:aws:kms:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:key/${var.kms_key_id}"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface"
        ]
        Resource = "*"
      }
    ]
  })
}

# VPC Endpoint policy attachment
resource "aws_iam_role_policy_attachment" "secret_rotation_vpc_policy" {
  count      = var.environment == "production" ? 1 : 0
  role       = aws_iam_role.secret_rotation_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# Archive for Lambda function
data "archive_file" "secret_rotation" {
  count       = var.environment == "production" ? 1 : 0
  type        = "zip"
  output_path = "secret-rotation.zip"
  
  source {
    content = <<-EOT
      import json
      import boto3
      import os
      import logging
      import psycopg2
      from botocore.exceptions import ClientError

      logger = logging.getLogger()
      logger.setLevel(logging.INFO)

      def handler(event, context):
          """
          AWS Secrets Manager rotation function for PostgreSQL
          """
          service = boto3.client('secretsmanager')
          
          # Parse the secret ARN from the event
          secret_arn = event['SecretId']
          token = event['ClientRequestToken']
          step = event['Step']
          
          logger.info(f"Rotating secret {secret_arn}, step {step}")
          
          try:
              if step == "createSecret":
                  create_secret(service, secret_arn, token)
              elif step == "setSecret":
                  set_secret(service, secret_arn, token)
              elif step == "testSecret":
                  test_secret(service, secret_arn, token)
              elif step == "finishSecret":
                  finish_secret(service, secret_arn, token)
              else:
                  logger.error(f"Invalid step {step}")
                  raise ValueError(f"Invalid step {step}")
                  
          except Exception as e:
              logger.error(f"Error in rotation step {step}: {str(e)}")
              raise e
          
          logger.info(f"Successfully completed step {step}")
          return {"message": f"Step {step} completed successfully"}

      def create_secret(service, arn, token):
          """Create a new secret version with a new password"""
          # Get the current secret
          current_secret = get_secret_dict(service, arn, "AWSCURRENT")
          
          # Generate new password
          import string
          import random
          
          characters = string.ascii_letters + string.digits + "!#$%&*()-_=+[]{}?"
          new_password = ''.join(random.choice(characters) for _ in range(32))
          
          # Create new secret version
          new_secret = current_secret.copy()
          new_secret['password'] = new_password
          
          service.put_secret_value(
              SecretId=arn,
              ClientRequestToken=token,
              SecretString=json.dumps(new_secret),
              VersionStage="AWSPENDING"
          )
          
          logger.info("Created new secret version")

      def set_secret(service, arn, token):
          """Set the new password in the database"""
          pending_secret = get_secret_dict(service, arn, "AWSPENDING", token)
          
          # Connect to database and update password
          try:
              conn = psycopg2.connect(
                  host=pending_secret['host'],
                  port=pending_secret['port'],
                  database=pending_secret['dbname'],
                  user=pending_secret['username'],
                  password=pending_secret['password']
              )
              
              with conn.cursor() as cursor:
                  cursor.execute(f"ALTER USER {pending_secret['username']} PASSWORD %s", (pending_secret['password'],))
                  conn.commit()
              
              conn.close()
              logger.info("Updated database password")
              
          except Exception as e:
              logger.error(f"Failed to set password in database: {str(e)}")
              raise e

      def test_secret(service, arn, token):
          """Test the new secret by connecting to the database"""
          pending_secret = get_secret_dict(service, arn, "AWSPENDING", token)
          
          try:
              conn = psycopg2.connect(
                  host=pending_secret['host'],
                  port=pending_secret['port'],
                  database=pending_secret['dbname'],
                  user=pending_secret['username'],
                  password=pending_secret['password']
              )
              
              with conn.cursor() as cursor:
                  cursor.execute("SELECT 1")
                  result = cursor.fetchone()
                  
              conn.close()
              logger.info("Successfully tested new password")
              
          except Exception as e:
              logger.error(f"Failed to test new password: {str(e)}")
              raise e

      def finish_secret(service, arn, token):
          """Finalize the rotation by updating version stages"""
          # Move AWSPENDING to AWSCURRENT
          service.update_secret_version_stage(
              SecretId=arn,
              VersionStage="AWSCURRENT",
              ClientRequestToken=token,
              RemoveFromVersionId=get_secret_version(service, arn, "AWSCURRENT")
          )
          
          service.update_secret_version_stage(
              SecretId=arn,
              VersionStage="AWSPENDING",
              ClientRequestToken=token,
              RemoveFromVersionId=token
          )
          
          logger.info("Completed secret rotation")

      def get_secret_dict(service, arn, stage, token=None):
          """Get secret as dictionary"""
          kwargs = {'SecretId': arn, 'VersionStage': stage}
          if token:
              kwargs['VersionId'] = token
              
          response = service.get_secret_value(**kwargs)
          return json.loads(response['SecretString'])

      def get_secret_version(service, arn, stage):
          """Get the version ID for a stage"""
          response = service.describe_secret(SecretId=arn)
          return response['VersionIdsToStages'][stage][0]
    EOT
    filename = "index.py"
  }
}

# Lambda permission for Secrets Manager
resource "aws_lambda_permission" "allow_secret_manager_call_lambda" {
  count         = var.environment == "production" ? 1 : 0
  function_name = aws_lambda_function.secret_rotation[0].function_name
  action        = "lambda:InvokeFunction"
  principal     = "secretsmanager.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
}

# Automatic rotation schedule for database credentials
resource "aws_secretsmanager_secret_rotation" "database_rotation" {
  count     = var.environment == "production" ? 1 : 0
  secret_id = aws_secretsmanager_secret.database_credentials.id

  rotation_lambda_arn = aws_lambda_function.secret_rotation[0].arn
  
  rotation_rules {
    automatically_after_days = 30
  }

  depends_on = [aws_lambda_permission.allow_secret_manager_call_lambda]
}

# Outputs
output "database_credentials_arn" {
  description = "ARN of the database credentials secret"
  value       = aws_secretsmanager_secret.database_credentials.arn
}

output "redis_credentials_arn" {
  description = "ARN of the Redis credentials secret"
  value       = aws_secretsmanager_secret.redis_credentials.arn
}

output "application_secrets_arn" {
  description = "ARN of the application secrets"
  value       = aws_secretsmanager_secret.application_secrets.arn
}

output "api_keys_arn" {
  description = "ARN of the API keys secret"
  value       = aws_secretsmanager_secret.api_keys.arn
}

output "secret_rotation_function_arn" {
  description = "ARN of the secret rotation Lambda function"
  value       = var.environment == "production" ? aws_lambda_function.secret_rotation[0].arn : ""
}

output "secret_names" {
  description = "Names of all managed secrets"
  value = {
    database_credentials = aws_secretsmanager_secret.database_credentials.name
    redis_credentials   = aws_secretsmanager_secret.redis_credentials.name
    application_secrets = aws_secretsmanager_secret.application_secrets.name
    api_keys           = aws_secretsmanager_secret.api_keys.name
  }
}

output "secret_arns" {
  description = "ARNs of all managed secrets"
  value = {
    database_credentials = aws_secretsmanager_secret.database_credentials.arn
    redis_credentials   = aws_secretsmanager_secret.redis_credentials.arn
    application_secrets = aws_secretsmanager_secret.application_secrets.arn
    api_keys           = aws_secretsmanager_secret.api_keys.arn
  }
}