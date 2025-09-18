# AWS Config Rules for Compliance Monitoring
# Infrastructure Management Subagent - Monitoring and Observability Infrastructure

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

variable "config_bucket" {
  description = "S3 bucket for AWS Config"
  type        = string
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for Config notifications"
  type        = string
}

# AWS Config Configuration Recorder
resource "aws_config_configuration_recorder" "main" {
  name     = "${var.app_name}-${var.environment}-config-recorder"
  role_arn = aws_iam_role.config.arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }

  depends_on = [aws_config_delivery_channel.main]
}

# AWS Config Delivery Channel
resource "aws_config_delivery_channel" "main" {
  name           = "${var.app_name}-${var.environment}-config-delivery-channel"
  s3_bucket_name = var.config_bucket
  sns_topic_arn  = var.sns_topic_arn

  snapshot_delivery_properties {
    delivery_frequency = "TwentyFour_Hours"
  }
}

# IAM Role for AWS Config
resource "aws_iam_role" "config" {
  name = "${var.app_name}-${var.environment}-config-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "config.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-config-role"
    Environment = var.environment
    Application = var.app_name
  }
}

# Attach AWS managed policy to Config role
resource "aws_iam_role_policy_attachment" "config" {
  role       = aws_iam_role.config.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/ConfigRole"
}

# Custom policy for Config role
resource "aws_iam_role_policy" "config_policy" {
  name = "${var.app_name}-${var.environment}-config-policy"
  role = aws_iam_role.config.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetBucketAcl",
          "s3:GetBucketLocation",
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::${var.config_bucket}"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ]
        Resource = "arn:aws:s3:::${var.config_bucket}/AWSLogs/*/Config/*"
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = var.sns_topic_arn
      }
    ]
  })
}

# Security Group Rules
resource "aws_config_config_rule" "security_group_ssh_check" {
  name = "${var.app_name}-${var.environment}-security-group-ssh-check"

  source {
    owner             = "AWS"
    source_identifier = "INCOMING_SSH_DISABLED"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-sg-ssh-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_config_config_rule" "security_group_unrestricted_access" {
  name = "${var.app_name}-${var.environment}-security-group-unrestricted-access"

  source {
    owner             = "AWS"
    source_identifier = "SECURITY_GROUP_UNRESTRICTED_COMMON_PORTS_CHECK"
  }

  input_parameters = jsonencode({
    blockedPort1 = "20"
    blockedPort2 = "21"
    blockedPort3 = "3389"
    blockedPort4 = "3306"
    blockedPort5 = "5432"
  })

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-sg-unrestricted-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

# S3 Bucket Rules
resource "aws_config_config_rule" "s3_bucket_public_read_prohibited" {
  name = "${var.app_name}-${var.environment}-s3-public-read-prohibited"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_PUBLIC_READ_PROHIBITED"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-s3-read-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_config_config_rule" "s3_bucket_public_write_prohibited" {
  name = "${var.app_name}-${var.environment}-s3-public-write-prohibited"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_PUBLIC_WRITE_PROHIBITED"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-s3-write-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_config_config_rule" "s3_bucket_ssl_requests_only" {
  name = "${var.app_name}-${var.environment}-s3-ssl-requests-only"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_SSL_REQUESTS_ONLY"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-s3-ssl-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_config_config_rule" "s3_bucket_server_side_encryption" {
  name = "${var.app_name}-${var.environment}-s3-server-side-encryption"

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-s3-encryption-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

# RDS Rules
resource "aws_config_config_rule" "rds_storage_encrypted" {
  name = "${var.app_name}-${var.environment}-rds-storage-encrypted"

  source {
    owner             = "AWS"
    source_identifier = "RDS_STORAGE_ENCRYPTED"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-rds-encryption-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_config_config_rule" "rds_instance_public_access_check" {
  name = "${var.app_name}-${var.environment}-rds-instance-public-access-check"

  source {
    owner             = "AWS"
    source_identifier = "RDS_INSTANCE_PUBLIC_ACCESS_CHECK"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-rds-public-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_config_config_rule" "rds_snapshots_public_prohibited" {
  name = "${var.app_name}-${var.environment}-rds-snapshots-public-prohibited"

  source {
    owner             = "AWS"
    source_identifier = "RDS_SNAPSHOTS_PUBLIC_PROHIBITED"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-rds-snapshot-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

# EC2 Rules
resource "aws_config_config_rule" "ec2_security_group_attached_to_eni" {
  name = "${var.app_name}-${var.environment}-ec2-security-group-attached-to-eni"

  source {
    owner             = "AWS"
    source_identifier = "EC2_SECURITY_GROUP_ATTACHED_TO_ENI"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-ec2-sg-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_config_config_rule" "ec2_instance_managed_by_systems_manager" {
  name = "${var.app_name}-${var.environment}-ec2-instance-managed-by-systems-manager"

  source {
    owner             = "AWS"
    source_identifier = "EC2_INSTANCE_MANAGED_BY_SSM"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-ec2-ssm-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

# IAM Rules
resource "aws_config_config_rule" "iam_password_policy" {
  name = "${var.app_name}-${var.environment}-iam-password-policy"

  source {
    owner             = "AWS"
    source_identifier = "IAM_PASSWORD_POLICY"
  }

  input_parameters = jsonencode({
    RequireUppercaseCharacters = "true"
    RequireLowercaseCharacters = "true"
    RequireSymbols             = "true"
    RequireNumbers             = "true"
    MinimumPasswordLength      = "8"
    PasswordReusePrevention    = "3"
    MaxPasswordAge             = "90"
  })

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-iam-password-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_config_config_rule" "iam_user_no_policies_check" {
  name = "${var.app_name}-${var.environment}-iam-user-no-policies-check"

  source {
    owner             = "AWS"
    source_identifier = "IAM_USER_NO_POLICIES_CHECK"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-iam-user-policies-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_config_config_rule" "root_access_key_check" {
  name = "${var.app_name}-${var.environment}-root-access-key-check"

  source {
    owner             = "AWS"
    source_identifier = "ROOT_ACCESS_KEY_CHECK"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-root-key-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

# ELB Rules
resource "aws_config_config_rule" "elb_logging_enabled" {
  name = "${var.app_name}-${var.environment}-elb-logging-enabled"

  source {
    owner             = "AWS"
    source_identifier = "ELB_LOGGING_ENABLED"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-elb-logging-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_config_config_rule" "alb_http_to_https_redirection_check" {
  name = "${var.app_name}-${var.environment}-alb-http-to-https-redirection-check"

  source {
    owner             = "AWS"
    source_identifier = "ALB_HTTP_TO_HTTPS_REDIRECTION_CHECK"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-alb-redirect-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

# CloudTrail Rules
resource "aws_config_config_rule" "cloud_trail_enabled" {
  name = "${var.app_name}-${var.environment}-cloud-trail-enabled"

  source {
    owner             = "AWS"
    source_identifier = "CLOUD_TRAIL_ENABLED"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-cloudtrail-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_config_config_rule" "cloud_trail_log_file_validation_enabled" {
  name = "${var.app_name}-${var.environment}-cloud-trail-log-file-validation-enabled"

  source {
    owner             = "AWS"
    source_identifier = "CLOUD_TRAIL_LOG_FILE_VALIDATION_ENABLED"
  }

  depends_on = [aws_config_configuration_recorder.main]

  tags = {
    Name        = "${var.app_name}-${var.environment}-cloudtrail-validation-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

# Custom Lambda-based Config Rule
resource "aws_config_config_rule" "custom_resource_tagging_compliance" {
  name = "${var.app_name}-${var.environment}-resource-tagging-compliance"

  source {
    owner                = "AWS_CONFIG_RULE"
    source_identifier    = aws_lambda_function.config_rule_function.arn
    source_detail {
      event_source = "aws.config"
      message_type = "ConfigurationItemChangeNotification"
    }
    source_detail {
      event_source = "aws.config"
      message_type = "OversizedConfigurationItemChangeNotification"
    }
  }

  input_parameters = jsonencode({
    requiredTags = "Environment,Application,Name"
    environment  = var.environment
    application  = var.app_name
  })

  depends_on = [
    aws_config_configuration_recorder.main,
    aws_lambda_permission.config_rule
  ]

  tags = {
    Name        = "${var.app_name}-${var.environment}-tagging-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

# Lambda function for custom Config rule
resource "aws_lambda_function" "config_rule_function" {
  filename         = "config-rule-function.zip"
  function_name    = "${var.app_name}-${var.environment}-config-rule-function"
  role            = aws_iam_role.config_rule_lambda.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.config_rule_lambda.output_base64sha256
  runtime         = "python3.9"
  timeout         = 60

  environment {
    variables = {
      ENVIRONMENT = var.environment
      APP_NAME    = var.app_name
    }
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-config-rule-function"
    Environment = var.environment
    Application = var.app_name
  }
}

# Lambda permission for Config
resource "aws_lambda_permission" "config_rule" {
  statement_id  = "AllowConfigInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.config_rule_function.function_name
  principal     = "config.amazonaws.com"
  source_account = data.aws_caller_identity.current.account_id
}

# IAM role for Config rule Lambda
resource "aws_iam_role" "config_rule_lambda" {
  name = "${var.app_name}-${var.environment}-config-rule-lambda-role"

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
    Name        = "${var.app_name}-${var.environment}-config-rule-lambda-role"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_iam_role_policy_attachment" "config_rule_lambda_basic" {
  role       = aws_iam_role.config_rule_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "config_rule_lambda_policy" {
  name = "${var.app_name}-${var.environment}-config-rule-lambda-policy"
  role = aws_iam_role.config_rule_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "config:PutEvaluations",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# Archive for Lambda function
data "archive_file" "config_rule_lambda" {
  type        = "zip"
  output_path = "config-rule-function.zip"
  
  source {
    content = <<-EOT
      import json
      import boto3
      
      def handler(event, context):
          config_client = boto3.client('config')
          
          # Parse the event
          configuration_item = event['configurationItem']
          resource_type = configuration_item['resourceType']
          resource_id = configuration_item['resourceId']
          
          # Check if resource has required tags
          required_tags = ['Environment', 'Application', 'Name']
          resource_tags = configuration_item.get('tags', {})
          
          compliance = 'COMPLIANT'
          missing_tags = []
          
          for tag in required_tags:
              if tag not in resource_tags:
                  missing_tags.append(tag)
                  compliance = 'NON_COMPLIANT'
          
          # Prepare evaluation
          evaluation = {
              'ComplianceResourceType': resource_type,
              'ComplianceResourceId': resource_id,
              'ComplianceType': compliance,
              'OrderingTimestamp': configuration_item['configurationItemCaptureTime']
          }
          
          if missing_tags:
              evaluation['Annotation'] = f"Missing required tags: {', '.join(missing_tags)}"
          
          # Submit evaluation
          response = config_client.put_evaluations(
              Evaluations=[evaluation],
              ResultToken=event['resultToken']
          )
          
          return {
              'statusCode': 200,
              'body': json.dumps({
                  'compliance': compliance,
                  'missing_tags': missing_tags
              })
          }
    EOT
    filename = "index.py"
  }
}

# Config Remediation Configuration
resource "aws_config_remediation_configuration" "s3_bucket_public_access_remediation" {
  config_rule_name = aws_config_config_rule.s3_bucket_public_read_prohibited.name

  resource_type           = "AWS::S3::Bucket"
  target_type             = "SSM_DOCUMENT"
  target_id               = "AWSConfigRemediation-RemoveS3BucketPublicReadAccess"
  target_version          = "1"
  automatic               = var.environment == "production"
  maximum_automatic_attempts = 3

  parameters = {
    AutomationAssumeRole = aws_iam_role.remediation.arn
    BucketName          = "RESOURCE_ID"
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-s3-remediation"
    Environment = var.environment
    Application = var.app_name
  }
}

# IAM Role for Config Remediation
resource "aws_iam_role" "remediation" {
  name = "${var.app_name}-${var.environment}-config-remediation-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ssm.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-remediation-role"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_iam_role_policy" "remediation_policy" {
  name = "${var.app_name}-${var.environment}-remediation-policy"
  role = aws_iam_role.remediation.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetBucketAcl",
          "s3:GetBucketPublicAccessBlock",
          "s3:PutBucketPublicAccessBlock",
          "s3:GetBucketPolicyStatus",
          "s3:GetBucketPolicy",
          "s3:DeleteBucketPolicy"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "config:ListDiscoveredResources"
        ]
        Resource = "*"
      }
    ]
  })
}

# Data sources
data "aws_caller_identity" "current" {}

# Outputs
output "config_recorder_name" {
  description = "Name of the Config configuration recorder"
  value       = aws_config_configuration_recorder.main.name
}

output "config_delivery_channel_name" {
  description = "Name of the Config delivery channel"
  value       = aws_config_delivery_channel.main.name
}

output "config_rules_count" {
  description = "Number of Config rules created"
  value       = length([
    aws_config_config_rule.security_group_ssh_check,
    aws_config_config_rule.security_group_unrestricted_access,
    aws_config_config_rule.s3_bucket_public_read_prohibited,
    aws_config_config_rule.s3_bucket_public_write_prohibited,
    aws_config_config_rule.s3_bucket_ssl_requests_only,
    aws_config_config_rule.s3_bucket_server_side_encryption,
    aws_config_config_rule.rds_storage_encrypted,
    aws_config_config_rule.rds_instance_public_access_check,
    aws_config_config_rule.rds_snapshots_public_prohibited,
    aws_config_config_rule.ec2_security_group_attached_to_eni,
    aws_config_config_rule.ec2_instance_managed_by_systems_manager,
    aws_config_config_rule.iam_password_policy,
    aws_config_config_rule.iam_user_no_policies_check,
    aws_config_config_rule.root_access_key_check,
    aws_config_config_rule.elb_logging_enabled,
    aws_config_config_rule.alb_http_to_https_redirection_check,
    aws_config_config_rule.cloud_trail_enabled,
    aws_config_config_rule.cloud_trail_log_file_validation_enabled,
    aws_config_config_rule.custom_resource_tagging_compliance
  ])
}

output "config_console_url" {
  description = "URL for the AWS Config console"
  value       = "https://console.aws.amazon.com/config/home?region=${data.aws_region.current.name}#/dashboard"
}

# Data source for region
data "aws_region" "current" {}