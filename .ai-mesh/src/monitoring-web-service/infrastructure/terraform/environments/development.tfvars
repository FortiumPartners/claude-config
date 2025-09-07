# Development Environment Configuration
# Optimized for cost and development workflow

# General Configuration
environment = "development"
aws_region = "us-west-2"

# Network Configuration (smaller CIDR for cost optimization)
vpc_cidr = "10.0.0.0/20"  # Smaller network space
private_subnet_cidrs = ["10.0.1.0/26", "10.0.2.0/26"]  # Only 2 AZs for dev
public_subnet_cidrs = ["10.0.4.0/26", "10.0.5.0/26"]

# RDS Configuration (cost-optimized)
postgres_version = "14.9"
rds_instance_class = "db.t3.micro"  # Smallest instance for dev
rds_allocated_storage = 20  # Minimum storage
rds_max_allocated_storage = 100  # Limited auto-scaling
database_name = "metrics_dev"
database_username = "metrics_dev_user"
backup_retention_period = 1  # Minimal backup retention

# ElastiCache Redis Configuration (cost-optimized)
redis_version = "7.0"
redis_node_type = "cache.t3.micro"  # Smallest instance
redis_num_cache_nodes = 1  # Single node for dev
redis_snapshot_retention_limit = 1  # Minimal snapshot retention

# EKS Configuration (minimal resources)
kubernetes_version = "1.28"
eks_node_instance_types = ["t3.small"]  # Small instances for dev
eks_node_group_min_size = 1
eks_node_group_max_size = 3
eks_node_group_desired_size = 1  # Start with single node
eks_node_disk_size = 30  # Minimal disk space

# Load Balancer Configuration
enable_deletion_protection = false  # Allow easy teardown in dev
ssl_certificate_arn = null  # Use HTTP only in dev
domain_name = "metrics-dev.fortium.internal"

# Monitoring Configuration (reduced retention)
enable_cloudwatch_logs = true
log_retention_days = 3  # Short retention for cost savings
alert_email = "engineering@fortium.dev"

# Security Configuration (relaxed for development)
enable_waf = false  # Disable WAF for cost savings
allowed_cidr_blocks = ["0.0.0.0/0"]  # Open access for development

# Cost Optimization Settings
enable_nat_gateway = true
single_nat_gateway = true  # Single NAT for cost savings
enable_cluster_autoscaler = false  # Manual scaling in dev
enable_horizontal_pod_autoscaler = false  # Reduce complexity

# Backup and Recovery (minimal)
enable_point_in_time_recovery = false  # Disable for cost savings
backup_window = "07:00-08:00"  # During business hours is fine for dev
maintenance_window = "sat:08:00-sat:09:00"  # Weekend maintenance

# Development-specific tags
additional_tags = {
  CostCenter = "Engineering-Development"
  AutoShutdown = "enabled"  # Enable auto-shutdown during nights/weekends
  BackupRequired = "false"
  ComplianceLevel = "development"
}