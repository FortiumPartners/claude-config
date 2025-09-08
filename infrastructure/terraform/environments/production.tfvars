# Production Environment Configuration  
# Task 1.3: CI/CD pipeline setup

# Basic Configuration
aws_region   = "us-east-1"
environment  = "production"
project_name = "external-metrics"
domain_name  = "external-metrics.com"

# VPC Configuration
vpc_cidr             = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.20.0/24"]

# EKS Configuration
kubernetes_version        = "1.27"
node_group_instance_types = ["t3.large", "t3.xlarge"]
node_group_scaling_config = {
  desired_size = 5
  max_size     = 20
  min_size     = 3
}

# RDS Configuration (Production-ready instances)
db_instance_class          = "db.r6g.large"
db_allocated_storage       = 100
db_max_allocated_storage   = 1000
db_backup_retention_period = 7
db_multi_az                = true # High availability

# Redis Configuration (Production cluster)
redis_node_type       = "cache.r6g.large"
redis_num_cache_nodes = 3 # Multi-node cluster

# Security Configuration (Restrictive for production)
allowed_cidr_blocks = [
  "10.0.0.0/8" # Only internal networks
]