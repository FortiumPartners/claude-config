# Staging Environment Configuration
# Task 1.3: CI/CD pipeline setup

# Basic Configuration
aws_region      = "us-east-1"
environment     = "staging"
project_name    = "external-metrics"
domain_name     = "staging.external-metrics.com"

# VPC Configuration
vpc_cidr              = "10.1.0.0/16"
public_subnet_cidrs   = ["10.1.1.0/24", "10.1.2.0/24"]
private_subnet_cidrs  = ["10.1.10.0/24", "10.1.20.0/24"]

# EKS Configuration
kubernetes_version = "1.27"
node_group_instance_types = ["t3.medium"]
node_group_scaling_config = {
  desired_size = 2
  max_size     = 5
  min_size     = 1
}

# RDS Configuration (Smaller instances for staging)
db_instance_class           = "db.t3.micro"
db_allocated_storage        = 20
db_max_allocated_storage    = 50
db_backup_retention_period  = 3
db_multi_az                 = false  # Single AZ for staging

# Redis Configuration (Smaller cluster for staging)
redis_node_type        = "cache.t3.micro"
redis_num_cache_nodes  = 1  # Single node for staging

# Security Configuration
allowed_cidr_blocks = [
  "10.0.0.0/8",     # Internal networks
  "172.16.0.0/12",  # Internal networks
  "192.168.0.0/16"  # Internal networks
]