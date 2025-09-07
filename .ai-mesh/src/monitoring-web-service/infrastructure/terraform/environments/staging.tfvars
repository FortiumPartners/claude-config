# Staging Environment Configuration
# Production-like setup at reduced scale for testing and validation

# General Configuration
environment = "staging"
aws_region = "us-west-2"

# Network Configuration (production-like but smaller)
vpc_cidr = "10.1.0.0/16"  # Separate network space from dev/prod
private_subnet_cidrs = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]  # 3 AZs for HA testing
public_subnet_cidrs = ["10.1.101.0/24", "10.1.102.0/24", "10.1.103.0/24"]

# RDS Configuration (production-like but smaller)
postgres_version = "14.9"
rds_instance_class = "db.t3.medium"  # Mid-range instance
rds_allocated_storage = 50  # Moderate storage
rds_max_allocated_storage = 200  # Limited auto-scaling
database_name = "metrics_staging"
database_username = "metrics_staging_user"
backup_retention_period = 3  # Short but reasonable retention

# ElastiCache Redis Configuration (production-like)
redis_version = "7.0"
redis_node_type = "cache.t3.medium"  # Mid-range instance
redis_num_cache_nodes = 2  # HA configuration for testing
redis_snapshot_retention_limit = 3  # Short retention

# EKS Configuration (production-like scaling)
kubernetes_version = "1.28"
eks_node_instance_types = ["t3.large"]  # Production-like instance types
eks_node_group_min_size = 2  # HA minimum
eks_node_group_max_size = 6  # Moderate scaling
eks_node_group_desired_size = 2  # Start with HA pair
eks_node_disk_size = 50  # Production-like storage

# Load Balancer Configuration (production features)
enable_deletion_protection = false  # Allow teardown but require explicit action
ssl_certificate_arn = null  # TODO: Add staging SSL certificate
domain_name = "metrics-staging.fortium.com"

# Monitoring Configuration (production-like)
enable_cloudwatch_logs = true
log_retention_days = 14  # Moderate retention for testing
alert_email = "engineering@fortium.dev"

# Security Configuration (production-like)
enable_waf = true  # Enable WAF for security testing
allowed_cidr_blocks = ["10.0.0.0/8", "172.16.0.0/12"]  # Internal networks only

# Cost Optimization (balanced)
enable_nat_gateway = true
single_nat_gateway = false  # Multi-AZ NAT for HA testing
enable_cluster_autoscaler = true  # Test autoscaling behavior
enable_horizontal_pod_autoscaler = true  # Test HPA behavior

# Backup and Recovery (production-like testing)
enable_point_in_time_recovery = true  # Test backup/recovery procedures
backup_window = "03:00-04:00"  # Non-business hours
maintenance_window = "sun:04:00-sun:05:00"  # Weekend maintenance

# Staging-specific tags
additional_tags = {
  CostCenter = "Engineering-QA"
  AutoShutdown = "evenings"  # Shutdown evenings but not weekends
  BackupRequired = "true"
  ComplianceLevel = "staging"
  TestEnvironment = "pre-production"
}