# External Metrics Web Service - AWS Infrastructure
# Based on TRD Sprint 1 requirements for production-ready deployment

terraform {
  required_version = ">= 1.5"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.10"
    }
  }

  # Backend configuration (uncomment and configure for production)
  # backend "s3" {
  #   bucket  = "fortium-terraform-state"
  #   key     = "metrics-web-service/terraform.tfstate"
  #   region  = "us-west-2"
  #   encrypt = true
  # }
}

# Provider configuration
provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "External Metrics Web Service"
      Environment = var.environment
      Owner       = "Fortium Partners Engineering"
      ManagedBy   = "Terraform"
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Local values for consistent naming
locals {
  name_prefix = "fortium-metrics-${var.environment}"
  common_tags = {
    Project     = "External Metrics Web Service"
    Environment = var.environment
    Owner       = "Fortium Partners Engineering"
    ManagedBy   = "Terraform"
  }
}

# VPC Configuration
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${local.name_prefix}-vpc"
  cidr = var.vpc_cidr

  azs             = data.aws_availability_zones.available.names
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  # NAT Gateway configuration
  enable_nat_gateway = true
  single_nat_gateway = var.environment == "development" ? true : false
  enable_vpn_gateway = false

  # DNS support
  enable_dns_hostnames = true
  enable_dns_support   = true

  # VPC Flow Logs
  enable_flow_log                      = true
  create_flow_log_cloudwatch_log_group = true
  create_flow_log_cloudwatch_iam_role  = true

  tags = local.common_tags
}

# Security Groups
resource "aws_security_group" "rds" {
  name_prefix = "${local.name_prefix}-rds"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for RDS PostgreSQL"

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "PostgreSQL access from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-sg"
  })
}

resource "aws_security_group" "redis" {
  name_prefix = "${local.name_prefix}-redis"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for ElastiCache Redis"

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "Redis access from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-sg"
  })
}

resource "aws_security_group" "alb" {
  name_prefix = "${local.name_prefix}-alb"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for Application Load Balancer"

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP traffic"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS traffic"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-sg"
  })
}

# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = module.vpc.private_subnets

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
}

# RDS PostgreSQL Instance (Multi-AZ for production)
resource "aws_db_instance" "postgres" {
  identifier = "${local.name_prefix}-postgres"

  # Engine configuration
  engine         = "postgres"
  engine_version = var.postgres_version
  instance_class = var.rds_instance_class

  # Storage configuration
  allocated_storage       = var.rds_allocated_storage
  max_allocated_storage   = var.rds_max_allocated_storage
  storage_type            = "gp3"
  storage_encrypted       = true
  kms_key_id             = aws_kms_key.rds.arn

  # Database configuration
  db_name  = var.database_name
  username = var.database_username
  password = var.database_password
  port     = 5432

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  # High availability (Multi-AZ for production)
  multi_az = var.environment == "production" ? true : false

  # Backup configuration
  backup_retention_period = var.backup_retention_period
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"

  # Monitoring
  monitoring_interval                   = 60
  monitoring_role_arn                  = aws_iam_role.rds_monitoring.arn
  enabled_cloudwatch_logs_exports      = ["postgresql"]
  performance_insights_enabled         = true
  performance_insights_retention_period = 7

  # Security
  deletion_protection = var.environment == "production" ? true : false
  skip_final_snapshot = var.environment == "development" ? true : false
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgres"
  })
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.name_prefix}-cache-subnet"
  subnet_ids = module.vpc.private_subnets

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cache-subnet-group"
  })
}

# ElastiCache Redis Cluster
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id       = "${local.name_prefix}-redis"
  description                = "Redis cluster for External Metrics Web Service"
  
  # Engine configuration
  engine               = "redis"
  engine_version       = var.redis_version
  node_type           = var.redis_node_type
  parameter_group_name = "default.redis7"
  
  # Cluster configuration
  num_cache_clusters = var.redis_num_cache_nodes
  port              = 6379
  
  # Network configuration
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]
  
  # Security
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                = var.redis_auth_token
  kms_key_id               = aws_kms_key.redis.arn
  
  # Backup configuration
  automatic_failover_enabled = var.redis_num_cache_nodes > 1
  snapshot_retention_limit   = var.redis_snapshot_retention_limit
  snapshot_window           = "03:00-05:00"
  
  # Maintenance
  maintenance_window = "sun:05:00-sun:07:00"
  
  # Notifications
  notification_topic_arn = aws_sns_topic.alerts.arn
  
  # Log delivery
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis"
  })
}

# EKS Cluster
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = "${local.name_prefix}-eks"
  cluster_version = var.kubernetes_version

  vpc_id                         = module.vpc.vpc_id
  subnet_ids                     = module.vpc.private_subnets
  cluster_endpoint_public_access = true

  # EKS Managed Node Groups
  eks_managed_node_groups = {
    main = {
      name = "${local.name_prefix}-nodes"

      instance_types = var.eks_node_instance_types
      capacity_type  = "ON_DEMAND"

      min_size     = var.eks_node_group_min_size
      max_size     = var.eks_node_group_max_size
      desired_size = var.eks_node_group_desired_size

      # Launch template
      create_launch_template = false
      launch_template_name   = ""

      disk_size = var.eks_node_disk_size

      # Remote access
      remote_access = {
        ec2_ssh_key               = var.ec2_key_pair_name
        source_security_group_ids = [aws_security_group.eks_remote_access.id]
      }

      labels = {
        Environment = var.environment
        NodeGroup   = "main"
      }

      tags = local.common_tags
    }
  }

  # Additional security group for remote access
  node_security_group_additional_rules = {
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      self        = true
    }
  }

  tags = local.common_tags
}

# Additional security group for EKS remote access
resource "aws_security_group" "eks_remote_access" {
  name_prefix = "${local.name_prefix}-eks-remote"
  vpc_id      = module.vpc.vpc_id
  description = "Security group for EKS remote access"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
    description = "SSH access from VPC"
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-remote-access"
  })
}