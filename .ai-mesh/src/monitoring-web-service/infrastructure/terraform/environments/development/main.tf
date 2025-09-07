# Development Environment - Cost-Optimized Infrastructure Configuration
# This configuration prioritizes cost savings over high availability
# Suitable for development and testing workloads with lower SLA requirements

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for development environment configuration
locals {
  environment = "development"
  project_name = var.project_name
  
  # Cost optimization settings
  use_spot_instances = true
  spot_max_price = "0.05"  # 50% of on-demand pricing
  enable_nat_gateway = false  # Use NAT instances for cost savings
  backup_retention_days = 7
  monitoring_retention_days = 7
  
  # Resource sizing for development (25% of production)
  instance_types = ["t3.micro", "t3.small"]
  min_capacity = 1
  max_capacity = 2
  desired_capacity = 1
  
  # Storage configuration
  storage_type = "gp2"  # Standard SSD for cost efficiency
  storage_size = 20     # GB
  storage_encrypted = false  # No encryption for dev data
  
  # Monitoring configuration
  detailed_monitoring = false
  enable_xray_tracing = false
  log_retention = 7  # days
  
  # Common tags
  common_tags = {
    Environment = local.environment
    Project     = local.project_name
    ManagedBy   = "terraform"
    CostCenter  = "development"
    AutoShutdown = "enabled"
  }
}

# VPC Module - Single AZ for cost optimization
module "vpc" {
  source = "../../modules/vpc"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Single AZ configuration for cost savings
  vpc_cidr = "10.0.0.0/16"
  availability_zones = [data.aws_availability_zones.available.names[0]]  # Single AZ
  
  # Cost optimization settings
  enable_nat_gateway = local.enable_nat_gateway
  enable_vpn_gateway = false
  enable_dns_hostnames = true
  enable_dns_support = true
  
  # Flow logs disabled for cost savings
  enable_flow_log = false
  
  tags = local.common_tags
}

# Security Groups Module
module "security_groups" {
  source = "../../modules/security-groups"
  
  project_name = local.project_name
  environment  = local.environment
  vpc_id      = module.vpc.vpc_id
  
  # Development-specific security rules (more permissive)
  allow_ssh_from_anywhere = true
  allow_http_from_anywhere = true
  allow_https_from_anywhere = true
  
  tags = local.common_tags
}

# ECS Cluster Module - Spot instances for cost optimization
module "ecs_cluster" {
  source = "../../modules/ecs"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Cluster configuration
  cluster_name = "${local.project_name}-${local.environment}"
  
  # Auto Scaling Group with spot instances
  instance_types = local.instance_types
  min_size = local.min_capacity
  max_size = local.max_capacity
  desired_capacity = local.desired_capacity
  
  # Spot instance configuration
  use_spot_instances = local.use_spot_instances
  spot_max_price = local.spot_max_price
  spot_allocation_strategy = "diversified"
  
  # Network configuration
  vpc_id = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
  security_group_ids = [module.security_groups.ecs_security_group_id]
  
  # Storage configuration
  root_volume_size = local.storage_size
  root_volume_type = local.storage_type
  root_volume_encrypted = local.storage_encrypted
  
  # Monitoring configuration
  enable_detailed_monitoring = local.detailed_monitoring
  enable_container_insights = false  # Disabled for cost savings
  
  # Auto-scaling configuration
  enable_scheduled_scaling = true
  scale_down_schedule = "0 20 * * 1-5"  # Scale down at 8 PM weekdays
  scale_up_schedule = "0 8 * * 1-5"    # Scale up at 8 AM weekdays
  weekend_desired_capacity = 0         # Scale to zero on weekends
  
  tags = local.common_tags
}

# Application Load Balancer Module
module "alb" {
  source = "../../modules/alb"
  
  project_name = local.project_name
  environment  = local.environment
  
  # ALB configuration
  load_balancer_type = "application"
  vpc_id = module.vpc.vpc_id
  subnet_ids = module.vpc.public_subnet_ids
  security_group_ids = [module.security_groups.alb_security_group_id]
  
  # SSL configuration (self-signed for development)
  enable_https = false  # HTTP only for simplicity
  ssl_policy = null
  certificate_arn = null
  
  # Access logs disabled for cost savings
  enable_access_logs = false
  
  # Target group configuration
  target_group_port = 3000
  target_group_protocol = "HTTP"
  health_check_path = "/health"
  health_check_interval = 30
  healthy_threshold = 2
  unhealthy_threshold = 5
  
  tags = local.common_tags
}

# RDS Module - Single AZ for cost optimization
module "rds" {
  source = "../../modules/rds"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Database configuration
  engine = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"  # Smallest instance for cost savings
  allocated_storage = 20
  max_allocated_storage = 40
  storage_type = "gp2"
  storage_encrypted = local.storage_encrypted
  
  # Single AZ deployment for cost savings
  multi_az = false
  availability_zone = data.aws_availability_zones.available.names[0]
  
  # Database credentials
  db_name = replace(local.project_name, "-", "_")
  username = "app_user"
  manage_master_user_password = true
  
  # Network configuration
  vpc_id = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
  vpc_security_group_ids = [module.security_groups.rds_security_group_id]
  
  # Backup configuration (minimal for development)
  backup_retention_period = local.backup_retention_days
  backup_window = "03:00-04:00"
  maintenance_window = "sun:04:00-sun:05:00"
  
  # Performance Insights disabled for cost savings
  performance_insights_enabled = false
  monitoring_interval = 0  # Disable enhanced monitoring
  
  # Skip final snapshot for development
  skip_final_snapshot = true
  deletion_protection = false
  
  tags = local.common_tags
}

# CloudWatch Module - Basic monitoring
module "cloudwatch" {
  source = "../../modules/cloudwatch"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Log groups with short retention
  log_groups = {
    application = {
      retention_in_days = local.log_retention
      kms_key_id = null  # No encryption for cost savings
    }
    ecs = {
      retention_in_days = local.log_retention
      kms_key_id = null
    }
  }
  
  # Basic alarms only
  enable_basic_alarms = true
  enable_detailed_alarms = false
  
  # Notification configuration (email only)
  notification_endpoints = var.notification_email != null ? [var.notification_email] : []
  
  # Dashboard configuration
  create_dashboard = true
  dashboard_widgets = ["cpu", "memory", "requests"]  # Basic widgets only
  
  tags = local.common_tags
}

# S3 Module - Standard storage class for cost optimization
module "s3" {
  source = "../../modules/s3"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Bucket configuration
  bucket_purpose = ["application-data", "logs"]
  
  # Cost optimization settings
  storage_class = "STANDARD"
  enable_intelligent_tiering = false  # Disabled for cost savings
  enable_glacier_transition = true
  glacier_transition_days = 30
  
  # Lifecycle configuration
  lifecycle_rules = {
    delete_old_versions = {
      enabled = true
      noncurrent_version_expiration_days = 7  # Short retention for dev
    }
    delete_incomplete_uploads = {
      enabled = true
      abort_incomplete_multipart_upload_days = 1
    }
  }
  
  # Security configuration (relaxed for development)
  enable_versioning = false
  enable_server_side_encryption = false
  enable_public_access_block = true
  
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

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "s3_bucket_names" {
  description = "Names of created S3 buckets"
  value       = module.s3.bucket_names
}

# Cost optimization outputs
output "estimated_monthly_cost" {
  description = "Estimated monthly cost for development environment"
  value = {
    ec2_instances = "~$15-25/month (t3.micro spot instances)"
    rds = "~$15-20/month (db.t3.micro)"
    alb = "~$20/month"
    s3 = "~$3-5/month (minimal usage)"
    data_transfer = "~$5-10/month"
    total_estimated = "~$58-80/month"
  }
}

output "cost_optimization_features" {
  description = "Active cost optimization features"
  value = {
    spot_instances = local.use_spot_instances
    single_az_deployment = true
    no_nat_gateway = !local.enable_nat_gateway
    minimal_monitoring = true
    scheduled_scaling = true
    weekend_shutdown = true
    short_retention_periods = true
  }
}