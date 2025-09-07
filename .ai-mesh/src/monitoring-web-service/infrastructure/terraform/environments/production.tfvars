# Production Environment Configuration
# High availability, performance, and security optimized

# General Configuration
environment = "production"
aws_region = "us-west-2"

# Network Configuration (full production scale)
vpc_cidr = "10.2.0.0/16"  # Separate network space with room for growth
private_subnet_cidrs = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]  # 3 AZs for HA
public_subnet_cidrs = ["10.2.101.0/24", "10.2.102.0/24", "10.2.103.0/24"]

# RDS Configuration (high performance and availability)
postgres_version = "14.9"
rds_instance_class = "db.r6g.large"  # Memory-optimized for production workloads
rds_allocated_storage = 500  # Substantial initial storage
rds_max_allocated_storage = 2000  # Room for significant growth
database_name = "metrics_production"
database_username = "metrics_prod_user"
backup_retention_period = 14  # Extended backup retention

# ElastiCache Redis Configuration (high performance)
redis_version = "7.0"
redis_node_type = "cache.r6g.large"  # Memory-optimized for caching
redis_num_cache_nodes = 3  # Multi-node HA configuration
redis_snapshot_retention_limit = 14  # Extended snapshot retention

# EKS Configuration (production-grade scaling)
kubernetes_version = "1.28"
eks_node_instance_types = ["r6i.xlarge", "r6i.2xlarge"]  # High-performance instances
eks_node_group_min_size = 3  # Minimum HA across 3 AZs
eks_node_group_max_size = 20  # Significant scaling capacity
eks_node_group_desired_size = 6  # Start with robust baseline
eks_node_disk_size = 100  # Ample storage for production workloads

# Load Balancer Configuration (production security)
enable_deletion_protection = true  # Prevent accidental deletion
ssl_certificate_arn = null  # TODO: Add production SSL certificate ARN
domain_name = "metrics.fortium.com"

# Monitoring Configuration (comprehensive)
enable_cloudwatch_logs = true
log_retention_days = 90  # Extended retention for compliance
alert_email = "sre@fortium.dev"  # SRE team for production alerts

# Security Configuration (maximum security)
enable_waf = true  # Full WAF protection
allowed_cidr_blocks = ["0.0.0.0/0"]  # Global access but protected by WAF

# Performance Optimization (no cost shortcuts)
enable_nat_gateway = true
single_nat_gateway = false  # Multi-AZ NAT for HA
enable_cluster_autoscaler = true  # Full autoscaling capabilities
enable_horizontal_pod_autoscaler = true  # Pod-level autoscaling

# Backup and Recovery (comprehensive)
enable_point_in_time_recovery = true  # Full PITR capabilities
backup_window = "03:00-04:00"  # Minimal impact time
maintenance_window = "sun:04:00-sun:05:00"  # Minimal impact maintenance

# Production-specific tags
additional_tags = {
  CostCenter = "Engineering-Production"
  AutoShutdown = "disabled"  # Never auto-shutdown production
  BackupRequired = "true"
  ComplianceLevel = "production"
  SLA = "99.9%"
  DataClassification = "internal"
  DisasterRecovery = "enabled"
}