# Staging Environment - Production-Like Infrastructure Configuration
# This configuration balances cost optimization with production-like features
# Suitable for staging, testing, and pre-production workloads with moderate SLA requirements

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for staging environment configuration
locals {
  environment = "staging"
  project_name = var.project_name
  
  # Mixed instance strategy for cost optimization while maintaining availability
  use_mixed_instances = true
  spot_percentage = 50  # 50% spot, 50% on-demand
  spot_max_price = "0.10"  # 10% of on-demand pricing
  enable_nat_gateway = true
  backup_retention_days = 14
  monitoring_retention_days = 30
  
  # Resource sizing for staging (60% of production)
  instance_types = ["t3.medium", "t3.large", "c5.large"]
  min_capacity = 2
  max_capacity = 6
  desired_capacity = 3
  
  # Storage configuration
  storage_type = "gp3"
  storage_size = 50
  storage_encrypted = true
  storage_iops = 3000
  storage_throughput = 125
  
  # Monitoring configuration
  detailed_monitoring = true
  enable_xray_tracing = true
  log_retention = 30  # days
  enable_container_insights = true
  
  # Multi-AZ configuration for production-like testing
  multi_az_deployment = true
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 2)
  
  # Common tags
  common_tags = {
    Environment = local.environment
    Project     = local.project_name
    ManagedBy   = "terraform"
    CostCenter  = "staging"
    BusinessHours = "enabled"
  }
}

# VPC Module - Multi-AZ for production-like testing
module "vpc" {
  source = "../../modules/vpc"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Multi-AZ configuration
  vpc_cidr = "10.1.0.0/16"
  availability_zones = local.availability_zones
  
  # Production-like networking features
  enable_nat_gateway = local.enable_nat_gateway
  enable_vpn_gateway = false
  enable_dns_hostnames = true
  enable_dns_support = true
  
  # Enable flow logs for monitoring
  enable_flow_log = true
  flow_log_destination_type = "cloud-watch-logs"
  flow_log_retention_days = local.log_retention
  
  tags = local.common_tags
}

# Security Groups Module with enhanced security
module "security_groups" {
  source = "../../modules/security-groups"
  
  project_name = local.project_name
  environment  = local.environment
  vpc_id      = module.vpc.vpc_id
  
  # Staging-specific security rules (moderately restrictive)
  allow_ssh_from_anywhere = false  # Restrict SSH access
  allow_http_from_anywhere = true
  allow_https_from_anywhere = true
  
  # Additional security groups for staging
  enable_bastion_security_group = true
  enable_monitoring_security_group = true
  
  # Allow access from development environment
  additional_ingress_rules = [
    {
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = ["10.0.0.0/16"]  # Development VPC CIDR
      description = "SSH from development environment"
    }
  ]
  
  tags = local.common_tags
}

# ECS Cluster Module with mixed instances
module "ecs_cluster" {
  source = "../../modules/ecs"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Cluster configuration
  cluster_name = "${local.project_name}-${local.environment}"
  
  # Mixed instance configuration for cost optimization
  instance_types = local.instance_types
  min_size = local.min_capacity
  max_size = local.max_capacity
  desired_capacity = local.desired_capacity
  
  # Mixed instances policy
  use_mixed_instances = local.use_mixed_instances
  on_demand_base_capacity = 1
  on_demand_percentage_above_base = (100 - local.spot_percentage)
  spot_allocation_strategy = "diversified"
  spot_max_price = local.spot_max_price
  
  # Network configuration
  vpc_id = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
  security_group_ids = [module.security_groups.ecs_security_group_id]
  
  # Storage configuration
  root_volume_size = local.storage_size
  root_volume_type = local.storage_type
  root_volume_encrypted = local.storage_encrypted
  root_volume_iops = local.storage_type == "gp3" ? local.storage_iops : null
  root_volume_throughput = local.storage_type == "gp3" ? local.storage_throughput : null
  
  # Monitoring configuration
  enable_detailed_monitoring = local.detailed_monitoring
  enable_container_insights = local.enable_container_insights
  
  # Business hours scaling (production-like feature)
  enable_scheduled_scaling = true
  business_hours_scaling = {
    scale_up_schedule = "0 8 * * 1-5"    # 8 AM weekdays
    scale_down_schedule = "0 18 * * 1-5"  # 6 PM weekdays
    business_hours_capacity = 5           # Scale up during business hours
    off_hours_capacity = 2                # Scale down after hours
  }
  
  tags = local.common_tags
}

# Application Load Balancer Module with SSL
module "alb" {
  source = "../../modules/alb"
  
  project_name = local.project_name
  environment  = local.environment
  
  # ALB configuration
  load_balancer_type = "network"  # NLB for performance testing
  vpc_id = module.vpc.vpc_id
  subnet_ids = module.vpc.public_subnet_ids
  security_group_ids = [module.security_groups.alb_security_group_id]
  
  # SSL configuration
  enable_https = true
  ssl_policy = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn = var.ssl_certificate_arn
  
  # Access logs enabled for analysis
  enable_access_logs = true
  access_logs_bucket = module.s3.bucket_names["logs"]
  access_logs_prefix = "alb-access-logs"
  
  # Target group configuration
  target_group_port = 3000
  target_group_protocol = "HTTP"
  health_check_path = "/health"
  health_check_interval = 15  # More frequent checks
  health_check_timeout = 10
  healthy_threshold = 2
  unhealthy_threshold = 3
  
  # Stickiness for session-based testing
  enable_stickiness = true
  stickiness_duration = 86400  # 24 hours
  
  tags = local.common_tags
}

# RDS Module - Multi-AZ for production-like testing
module "rds" {
  source = "../../modules/rds"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Database configuration
  engine = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.medium"  # Larger instance for performance testing
  allocated_storage = 100
  max_allocated_storage = 200
  storage_type = "gp3"
  storage_encrypted = local.storage_encrypted
  storage_iops = 3000
  storage_throughput = 125
  
  # Multi-AZ deployment for availability testing
  multi_az = local.multi_az_deployment
  availability_zone = local.multi_az_deployment ? null : local.availability_zones[0]
  
  # Database credentials
  db_name = replace(local.project_name, "-", "_")
  username = "app_user"
  manage_master_user_password = true
  
  # Network configuration
  vpc_id = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
  vpc_security_group_ids = [module.security_groups.rds_security_group_id]
  
  # Backup configuration
  backup_retention_period = local.backup_retention_days
  backup_window = "03:00-04:00"
  maintenance_window = "sun:04:00-sun:06:00"
  
  # Performance Insights enabled for monitoring
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn
  
  # Automated minor version upgrades
  auto_minor_version_upgrade = true
  
  # Final snapshot for staging
  skip_final_snapshot = false
  final_snapshot_identifier = "${local.project_name}-${local.environment}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  deletion_protection = true
  
  tags = local.common_tags
}

# RDS Enhanced Monitoring IAM Role
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "${local.project_name}-${local.environment}-rds-monitoring-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# CloudWatch Module - Enhanced monitoring
module "cloudwatch" {
  source = "../../modules/cloudwatch"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Log groups with extended retention
  log_groups = {
    application = {
      retention_in_days = local.log_retention
      kms_key_id = aws_kms_key.logs.arn
    }
    ecs = {
      retention_in_days = local.log_retention
      kms_key_id = aws_kms_key.logs.arn
    }
    alb = {
      retention_in_days = local.log_retention
      kms_key_id = aws_kms_key.logs.arn
    }
    vpc_flow_logs = {
      retention_in_days = local.log_retention
      kms_key_id = aws_kms_key.logs.arn
    }
  }
  
  # Enhanced alarms
  enable_basic_alarms = true
  enable_detailed_alarms = true
  enable_custom_alarms = true
  
  # Notification configuration
  notification_endpoints = concat(
    var.notification_email != null ? [var.notification_email] : [],
    var.slack_webhook_url != null ? [var.slack_webhook_url] : []
  )
  
  # Dashboard configuration
  create_dashboard = true
  dashboard_widgets = [
    "cpu", "memory", "requests", "response_time",
    "database", "cache", "errors", "availability"
  ]
  
  # Custom metrics for staging testing
  custom_metrics = {
    load_testing_metrics = true
    performance_testing_metrics = true
    chaos_engineering_metrics = true
  }
  
  tags = local.common_tags
}

# KMS Key for encryption
resource "aws_kms_key" "logs" {
  description             = "${local.project_name}-${local.environment}-logs-key"
  deletion_window_in_days = 7
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = "kms:*"
        Resource = "*"
      },
      {
        Effect = "Allow"
        Principal = {
          Service = "logs.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_kms_alias" "logs" {
  name          = "alias/${local.project_name}-${local.environment}-logs"
  target_key_id = aws_kms_key.logs.key_id
}

# S3 Module with intelligent tiering
module "s3" {
  source = "../../modules/s3"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Bucket configuration
  bucket_purpose = ["application-data", "logs", "backups", "analytics"]
  
  # Storage optimization
  storage_class = "STANDARD"
  enable_intelligent_tiering = true
  enable_glacier_transition = true
  glacier_transition_days = 30
  deep_archive_transition_days = 90
  
  # Lifecycle configuration
  lifecycle_rules = {
    transition_to_ia = {
      enabled = true
      transition_days = 30
      storage_class = "STANDARD_IA"
    }
    delete_old_versions = {
      enabled = true
      noncurrent_version_expiration_days = 30
    }
    delete_incomplete_uploads = {
      enabled = true
      abort_incomplete_multipart_upload_days = 7
    }
  }
  
  # Security configuration
  enable_versioning = true
  enable_server_side_encryption = true
  kms_key_id = aws_kms_key.s3.arn
  enable_public_access_block = true
  
  # Cross-region replication for testing
  enable_cross_region_replication = var.enable_cross_region_backup
  replication_destination_bucket = var.backup_region
  
  tags = local.common_tags
}

# KMS Key for S3 encryption
resource "aws_kms_key" "s3" {
  description             = "${local.project_name}-${local.environment}-s3-key"
  deletion_window_in_days = 7
  
  tags = local.common_tags
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${local.project_name}-${local.environment}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

# X-Ray Tracing Configuration
resource "aws_xray_sampling_rule" "staging" {
  rule_name      = "${local.project_name}-${local.environment}"
  priority       = 9000
  version        = 1
  reservoir_size = 1
  fixed_rate     = 0.1  # 10% sampling rate
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"
  
  tags = local.common_tags
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs_cluster.cluster_name
}

output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = module.alb.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the load balancer"
  value       = module.alb.zone_id
}

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "rds_read_replica_endpoints" {
  description = "RDS read replica endpoints"
  value       = module.rds.read_replica_endpoints
  sensitive   = true
}

output "s3_bucket_names" {
  description = "Names of created S3 buckets"
  value       = module.s3.bucket_names
}

output "cloudwatch_dashboard_url" {
  description = "URL to the CloudWatch dashboard"
  value       = module.cloudwatch.dashboard_url
}

# Testing and validation outputs
output "load_testing_endpoints" {
  description = "Endpoints for load testing"
  value = {
    primary_alb = "https://${module.alb.dns_name}"
    health_check = "https://${module.alb.dns_name}/health"
    metrics = "https://${module.alb.dns_name}/metrics"
  }
}

output "monitoring_endpoints" {
  description = "Monitoring and observability endpoints"
  value = {
    cloudwatch_dashboard = module.cloudwatch.dashboard_url
    xray_traces = "https://${data.aws_region.current.name}.console.aws.amazon.com/xray/home"
    performance_insights = "https://${data.aws_region.current.name}.console.aws.amazon.com/rds/home"
  }
}

# Cost estimation outputs
output "estimated_monthly_cost" {
  description = "Estimated monthly cost for staging environment"
  value = {
    ec2_instances = "~$80-120/month (mixed instances)"
    rds = "~$60-80/month (db.t3.medium multi-AZ)"
    nlb = "~$25/month"
    nat_gateway = "~$45/month"
    s3 = "~$20-30/month (with intelligent tiering)"
    cloudwatch = "~$15-25/month (enhanced monitoring)"
    kms = "~$5/month"
    data_transfer = "~$20-40/month"
    total_estimated = "~$270-365/month"
  }
}

output "cost_optimization_features" {
  description = "Active cost optimization features"
  value = {
    mixed_instances = local.use_mixed_instances
    spot_percentage = "${local.spot_percentage}%"
    intelligent_tiering = true
    scheduled_scaling = true
    business_hours_optimization = true
    lifecycle_policies = true
    performance_insights_retention = "7 days"
  }
}