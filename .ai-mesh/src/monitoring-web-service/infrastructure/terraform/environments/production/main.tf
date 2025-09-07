# Production Environment - High Availability Infrastructure Configuration
# This configuration prioritizes reliability, performance, and security
# Suitable for production workloads with strict SLA requirements and compliance needs

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local variables for production environment configuration
locals {
  environment = "production"
  project_name = var.project_name
  
  # Production stability configuration
  use_spot_instances = false  # On-demand instances for stability
  enable_reserved_instances = true
  enable_nat_gateway = true
  backup_retention_days = 30
  monitoring_retention_days = 90
  
  # Resource sizing for production (full scale)
  instance_types = ["m5.large", "m5.xlarge", "c5.large", "c5.xlarge"]
  min_capacity = 5
  max_capacity = 50
  desired_capacity = 10
  
  # Storage configuration - high performance
  storage_type = "gp3"
  storage_size = 100
  storage_encrypted = true
  storage_iops = 10000
  storage_throughput = 500
  
  # Monitoring configuration - comprehensive
  detailed_monitoring = true
  enable_xray_tracing = true
  log_retention = 90  # days
  enable_container_insights = true
  enable_apm_monitoring = true
  
  # Multi-AZ configuration for high availability
  multi_az_deployment = true
  availability_zones = slice(data.aws_availability_zones.available.names, 0, 3)
  
  # Multi-region configuration for disaster recovery
  enable_multi_region = var.enable_multi_region
  backup_region = var.backup_region
  
  # Common tags
  common_tags = {
    Environment = local.environment
    Project     = local.project_name
    ManagedBy   = "terraform"
    CostCenter  = "production"
    Compliance  = "required"
    DataClassification = "confidential"
  }
}

# VPC Module - Multi-AZ with high availability
module "vpc" {
  source = "../../modules/vpc"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Multi-AZ configuration across 3 AZs
  vpc_cidr = "10.2.0.0/16"
  availability_zones = local.availability_zones
  
  # Production networking features
  enable_nat_gateway = local.enable_nat_gateway
  nat_gateway_per_az = true  # One NAT gateway per AZ for redundancy
  enable_vpn_gateway = var.enable_vpn_gateway
  enable_dns_hostnames = true
  enable_dns_support = true
  
  # Enhanced networking features
  enable_flow_log = true
  flow_log_destination_type = "s3"
  flow_log_s3_bucket_arn = module.s3.bucket_arns["vpc-flow-logs"]
  flow_log_retention_days = local.log_retention
  
  # Network ACLs for additional security
  enable_network_acls = true
  
  # DHCP options for custom DNS
  enable_dhcp_options = var.custom_dns_servers != null
  dhcp_options_domain_name_servers = var.custom_dns_servers
  
  tags = local.common_tags
}

# Security Groups Module with strict security
module "security_groups" {
  source = "../../modules/security-groups"
  
  project_name = local.project_name
  environment  = local.environment
  vpc_id      = module.vpc.vpc_id
  
  # Production security rules (restrictive)
  allow_ssh_from_anywhere = false
  allow_http_from_anywhere = false  # HTTPS only
  allow_https_from_anywhere = true
  
  # Bastion host for secure access
  enable_bastion_security_group = true
  bastion_allowed_cidr_blocks = var.admin_cidr_blocks
  
  # Additional security groups
  enable_monitoring_security_group = true
  enable_database_security_group = true
  enable_cache_security_group = true
  
  # WAF integration
  enable_waf_security_group = true
  
  tags = local.common_tags
}

# WAF Module for application protection
module "waf" {
  source = "../../modules/waf"
  
  project_name = local.project_name
  environment  = local.environment
  
  # WAF configuration
  scope = "REGIONAL"
  
  # Managed rule sets
  managed_rule_groups = [
    {
      name = "AWSManagedRulesCommonRuleSet"
      priority = 1
      override_action = "none"
    },
    {
      name = "AWSManagedRulesKnownBadInputsRuleSet"
      priority = 2
      override_action = "none"
    },
    {
      name = "AWSManagedRulesLinuxRuleSet"
      priority = 3
      override_action = "none"
    },
    {
      name = "AWSManagedRulesSQLiRuleSet"
      priority = 4
      override_action = "none"
    }
  ]
  
  # Custom rules
  custom_rules = [
    {
      name = "RateLimitRule"
      priority = 10
      action = "block"
      rate_limit = 2000
      rate_key = "IP"
    }
  ]
  
  # Logging configuration
  enable_logging = true
  log_destination_arn = module.cloudwatch.log_group_arns["waf"]
  
  tags = local.common_tags
}

# ECS Cluster Module with reserved instances
module "ecs_cluster" {
  source = "../../modules/ecs"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Cluster configuration
  cluster_name = "${local.project_name}-${local.environment}"
  
  # Production instance configuration
  instance_types = local.instance_types
  min_size = local.min_capacity
  max_size = local.max_capacity
  desired_capacity = local.desired_capacity
  
  # On-demand instances for stability
  use_spot_instances = local.use_spot_instances
  use_mixed_instances = false
  
  # Reserved instances for cost optimization
  enable_capacity_reservations = local.enable_reserved_instances
  
  # Network configuration
  vpc_id = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
  security_group_ids = [
    module.security_groups.ecs_security_group_id,
    module.security_groups.monitoring_security_group_id
  ]
  
  # Storage configuration - high performance
  root_volume_size = local.storage_size
  root_volume_type = local.storage_type
  root_volume_encrypted = local.storage_encrypted
  root_volume_iops = local.storage_iops
  root_volume_throughput = local.storage_throughput
  root_volume_kms_key_id = aws_kms_key.ebs.arn
  
  # Monitoring configuration
  enable_detailed_monitoring = local.detailed_monitoring
  enable_container_insights = local.enable_container_insights
  
  # Auto-scaling configuration
  enable_predictive_scaling = true
  enable_target_tracking_scaling = true
  target_tracking_configs = [
    {
      target_value = 60.0
      metric_type = "ASGAverageCPUUtilization"
    },
    {
      target_value = 70.0
      metric_type = "ASGAverageMemoryUtilization"
    }
  ]
  
  # Health check configuration
  health_check_type = "ELB"
  health_check_grace_period = 300
  
  tags = local.common_tags
}

# Application Load Balancer Module with WAF
module "alb" {
  source = "../../modules/alb"
  
  project_name = local.project_name
  environment  = local.environment
  
  # ALB configuration
  load_balancer_type = "application"
  vpc_id = module.vpc.vpc_id
  subnet_ids = module.vpc.public_subnet_ids
  security_group_ids = [module.security_groups.alb_security_group_id]
  
  # SSL configuration
  enable_https = true
  redirect_http_to_https = true
  ssl_policy = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn = var.ssl_certificate_arn
  
  # WAF association
  web_acl_arn = module.waf.web_acl_arn
  
  # Access logs for compliance
  enable_access_logs = true
  access_logs_bucket = module.s3.bucket_names["alb-logs"]
  access_logs_prefix = "alb-access-logs"
  
  # Target group configuration
  target_groups = [
    {
      name = "primary"
      port = 3000
      protocol = "HTTP"
      health_check_path = "/health"
      health_check_interval = 15
      health_check_timeout = 5
      healthy_threshold = 2
      unhealthy_threshold = 2
      matcher = "200"
      stickiness_enabled = true
      stickiness_duration = 86400
    }
  ]
  
  # Cross-zone load balancing
  enable_cross_zone_load_balancing = true
  
  tags = local.common_tags
}

# CloudFront Distribution for global performance
module "cloudfront" {
  source = "../../modules/cloudfront"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Origin configuration
  origin_domain_name = module.alb.dns_name
  origin_protocol_policy = "https-only"
  
  # Distribution configuration
  price_class = "PriceClass_All"  # Global distribution
  
  # Caching behavior
  default_cache_behavior = {
    allowed_methods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods = ["GET", "HEAD"]
    target_origin_id = "${local.project_name}-${local.environment}-origin"
    compress = true
    viewer_protocol_policy = "redirect-to-https"
    
    forwarded_values = {
      query_string = true
      cookies = {
        forward = "all"
      }
      headers = ["Authorization", "CloudFront-Forwarded-Proto"]
    }
    
    ttl = {
      default = 86400
      max = 31536000
      min = 0
    }
  }
  
  # SSL certificate
  viewer_certificate = {
    acm_certificate_arn = var.cloudfront_certificate_arn
    ssl_support_method = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
  
  # Geographic restrictions if required
  geo_restriction_type = var.geo_restriction_type
  geo_restriction_locations = var.geo_restriction_locations
  
  # Web ACL association
  web_acl_id = module.waf.web_acl_arn
  
  # Logging
  enable_logging = true
  logging_bucket = module.s3.bucket_domain_names["cloudfront-logs"]
  logging_prefix = "cloudfront-logs/"
  
  tags = local.common_tags
}

# RDS Module - Multi-AZ with read replicas
module "rds" {
  source = "../../modules/rds"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Database configuration
  engine = "postgres"
  engine_version = "15.4"
  instance_class = "db.r5.xlarge"  # Memory-optimized for performance
  allocated_storage = 500
  max_allocated_storage = 1000
  storage_type = "gp3"
  storage_encrypted = local.storage_encrypted
  storage_iops = 10000
  storage_throughput = 500
  kms_key_id = aws_kms_key.rds.arn
  
  # Multi-AZ deployment for high availability
  multi_az = local.multi_az_deployment
  
  # Read replicas for read scaling
  create_read_replicas = true
  read_replica_count = 2
  read_replica_instance_class = "db.r5.large"
  
  # Cross-region read replica for disaster recovery
  create_cross_region_replica = local.enable_multi_region
  cross_region_replica_region = local.backup_region
  cross_region_replica_kms_key_id = var.cross_region_kms_key_id
  
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
  
  # Point-in-time recovery
  enabled_cloudwatch_logs_exports = ["postgresql"]
  
  # Performance Insights
  performance_insights_enabled = true
  performance_insights_retention_period = 7
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn
  
  # Automated minor version upgrades
  auto_minor_version_upgrade = false  # Manual control in production
  
  # Deletion protection
  skip_final_snapshot = false
  final_snapshot_identifier = "${local.project_name}-${local.environment}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  deletion_protection = true
  
  tags = local.common_tags
}

# ElastiCache Module for caching
module "elasticache" {
  source = "../../modules/elasticache"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Cache configuration
  engine = "redis"
  node_type = "cache.r6g.large"
  parameter_group_name = "default.redis7"
  
  # Cluster configuration
  num_cache_clusters = 3
  availability_zones = local.availability_zones
  
  # Replication group for high availability
  replication_group_description = "${local.project_name} ${local.environment} Redis cluster"
  num_node_groups = 2
  replicas_per_node_group = 1
  
  # Security
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token = var.redis_auth_token
  kms_key_id = aws_kms_key.elasticache.arn
  
  # Network configuration
  subnet_group_name = aws_elasticache_subnet_group.main.name
  security_group_ids = [module.security_groups.cache_security_group_id]
  
  # Backup configuration
  snapshot_retention_limit = 7
  snapshot_window = "03:00-05:00"
  
  # Maintenance
  maintenance_window = "sun:05:00-sun:06:00"
  auto_minor_version_upgrade = false
  
  tags = local.common_tags
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.project_name}-${local.environment}-cache-subnet"
  subnet_ids = module.vpc.private_subnet_ids
  
  tags = local.common_tags
}

# S3 Module with cross-region replication
module "s3" {
  source = "../../modules/s3"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Bucket configuration
  bucket_purpose = [
    "application-data",
    "alb-logs",
    "cloudfront-logs", 
    "vpc-flow-logs",
    "backups",
    "analytics",
    "compliance-logs"
  ]
  
  # Storage optimization with intelligent tiering
  storage_class = "INTELLIGENT_TIERING"
  enable_intelligent_tiering = true
  enable_glacier_transition = true
  glacier_transition_days = 30
  deep_archive_transition_days = 180
  
  # Lifecycle configuration
  lifecycle_rules = {
    transition_to_ia = {
      enabled = true
      transition_days = 30
      storage_class = "STANDARD_IA"
    }
    transition_to_glacier = {
      enabled = true
      transition_days = 90
      storage_class = "GLACIER"
    }
    transition_to_deep_archive = {
      enabled = true
      transition_days = 365
      storage_class = "DEEP_ARCHIVE"
    }
    delete_old_versions = {
      enabled = true
      noncurrent_version_expiration_days = 90
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
  
  # Cross-region replication for disaster recovery
  enable_cross_region_replication = local.enable_multi_region
  replication_destination_bucket = local.backup_region
  replication_kms_key_id = var.cross_region_kms_key_id
  
  # Object locking for compliance
  enable_object_lock = var.enable_compliance_features
  object_lock_mode = "GOVERNANCE"
  object_lock_retention_days = 2555  # 7 years for compliance
  
  tags = local.common_tags
}

# KMS Keys for encryption
resource "aws_kms_key" "ebs" {
  description             = "${local.project_name}-${local.environment}-ebs-key"
  deletion_window_in_days = 30  # Longer for production
  enable_key_rotation     = true
  
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
      }
    ]
  })
  
  tags = local.common_tags
}

resource "aws_kms_key" "rds" {
  description             = "${local.project_name}-${local.environment}-rds-key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  
  tags = local.common_tags
}

resource "aws_kms_key" "s3" {
  description             = "${local.project_name}-${local.environment}-s3-key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  
  tags = local.common_tags
}

resource "aws_kms_key" "elasticache" {
  description             = "${local.project_name}-${local.environment}-elasticache-key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  
  tags = local.common_tags
}

resource "aws_kms_key" "logs" {
  description             = "${local.project_name}-${local.environment}-logs-key"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  
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
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:*"
          }
        }
      }
    ]
  })
  
  tags = local.common_tags
}

# KMS Aliases
resource "aws_kms_alias" "ebs" {
  name          = "alias/${local.project_name}-${local.environment}-ebs"
  target_key_id = aws_kms_key.ebs.key_id
}

resource "aws_kms_alias" "rds" {
  name          = "alias/${local.project_name}-${local.environment}-rds"
  target_key_id = aws_kms_key.rds.key_id
}

resource "aws_kms_alias" "s3" {
  name          = "alias/${local.project_name}-${local.environment}-s3"
  target_key_id = aws_kms_key.s3.key_id
}

resource "aws_kms_alias" "elasticache" {
  name          = "alias/${local.project_name}-${local.environment}-elasticache"
  target_key_id = aws_kms_key.elasticache.key_id
}

resource "aws_kms_alias" "logs" {
  name          = "alias/${local.project_name}-${local.environment}-logs"
  target_key_id = aws_kms_key.logs.key_id
}

# IAM Roles and Policies
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

# CloudWatch Module - Comprehensive monitoring
module "cloudwatch" {
  source = "../../modules/cloudwatch"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Log groups with long retention
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
    waf = {
      retention_in_days = local.log_retention
      kms_key_id = aws_kms_key.logs.arn
    }
    cloudfront = {
      retention_in_days = local.log_retention
      kms_key_id = aws_kms_key.logs.arn
    }
  }
  
  # Comprehensive alarms
  enable_basic_alarms = true
  enable_detailed_alarms = true
  enable_custom_alarms = true
  enable_composite_alarms = true
  
  # Notification configuration
  notification_endpoints = concat(
    var.pagerduty_endpoint != null ? [var.pagerduty_endpoint] : [],
    var.notification_email != null ? [var.notification_email] : [],
    var.slack_webhook_url != null ? [var.slack_webhook_url] : []
  )
  
  # Dashboard configuration
  create_dashboard = true
  dashboard_widgets = [
    "cpu", "memory", "requests", "response_time", "errors",
    "database", "cache", "availability", "security", "cost"
  ]
  
  # Custom metrics for production monitoring
  custom_metrics = {
    business_kpis = true
    sli_slo_metrics = true
    error_budgets = true
    capacity_planning = true
  }
  
  # Anomaly detection
  enable_anomaly_detection = true
  anomaly_detection_metrics = [
    "CPUUtilization",
    "MemoryUtilization", 
    "RequestCount",
    "ResponseTime",
    "ErrorRate"
  ]
  
  tags = local.common_tags
}

# Route 53 Module for DNS management
module "route53" {
  source = "../../modules/route53"
  
  project_name = local.project_name
  environment  = local.environment
  
  # Hosted zone configuration
  domain_name = var.domain_name
  create_hosted_zone = var.create_hosted_zone
  
  # DNS records
  records = [
    {
      name = ""
      type = "A"
      alias = {
        name = module.cloudfront.domain_name
        zone_id = module.cloudfront.hosted_zone_id
        evaluate_target_health = true
      }
    },
    {
      name = "api"
      type = "A"
      alias = {
        name = module.alb.dns_name
        zone_id = module.alb.zone_id
        evaluate_target_health = true
      }
    }
  ]
  
  # Health checks
  health_checks = [
    {
      fqdn = var.domain_name
      port = 443
      type = "HTTPS"
      resource_path = "/health"
      failure_threshold = 3
      request_interval = 30
    }
  ]
  
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

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = module.cloudfront.domain_name
}

output "route53_zone_id" {
  description = "Route 53 hosted zone ID"
  value       = module.route53.zone_id
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

output "elasticache_endpoint" {
  description = "ElastiCache endpoint"
  value       = module.elasticache.primary_endpoint
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

# Production monitoring outputs
output "monitoring_endpoints" {
  description = "Production monitoring and observability endpoints"
  value = {
    cloudwatch_dashboard = module.cloudwatch.dashboard_url
    xray_traces = "https://${data.aws_region.current.name}.console.aws.amazon.com/xray/home"
    performance_insights = "https://${data.aws_region.current.name}.console.aws.amazon.com/rds/home"
    waf_dashboard = "https://${data.aws_region.current.name}.console.aws.amazon.com/wafv2/homev2"
    cloudfront_metrics = "https://console.aws.amazon.com/cloudfront/home"
  }
}

output "security_features" {
  description = "Active security features in production"
  value = {
    waf_enabled = true
    encryption_at_rest = local.storage_encrypted
    encryption_in_transit = true
    key_rotation = true
    network_acls = true
    security_groups = "restrictive"
    deletion_protection = true
    multi_az_deployment = local.multi_az_deployment
    cross_region_backup = local.enable_multi_region
  }
}

# Cost estimation outputs
output "estimated_monthly_cost" {
  description = "Estimated monthly cost for production environment"
  value = {
    ec2_instances = "~$800-1200/month (reserved instances)"
    rds_primary = "~$400-600/month (db.r5.xlarge multi-AZ)"
    rds_read_replicas = "~$300-450/month (2x db.r5.large)"
    elasticache = "~$200-300/month (cache.r6g.large cluster)"
    alb = "~$25/month"
    nat_gateway = "~$135/month (3x gateways)"
    cloudfront = "~$50-100/month"
    s3_storage = "~$100-200/month (with intelligent tiering)"
    cloudwatch = "~$50-100/month (comprehensive monitoring)"
    kms = "~$15/month (5 keys)"
    waf = "~$10-20/month"
    route53 = "~$5-10/month"
    data_transfer = "~$200-400/month"
    total_estimated = "~$2390-3620/month"
  }
}

output "disaster_recovery_features" {
  description = "Disaster recovery and business continuity features"
  value = {
    multi_az_deployment = local.multi_az_deployment
    cross_region_replication = local.enable_multi_region
    automated_backups = true
    point_in_time_recovery = true
    backup_retention_days = local.backup_retention_days
    rto_target = "4 hours"
    rpo_target = "1 hour"
    failover_automation = true
  }
}