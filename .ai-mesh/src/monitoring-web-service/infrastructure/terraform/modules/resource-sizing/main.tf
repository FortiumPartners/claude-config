# Resource Sizing Algorithms Module
# Dynamically calculates optimal resource configurations based on environment and workload requirements

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Local values for resource sizing calculations
locals {
  # Environment-based resource multipliers
  environment_multipliers = {
    development = {
      cpu_multiplier    = 0.25  # 25% of production capacity
      memory_multiplier = 0.25  # 25% of production memory
      storage_multiplier = 0.2  # 20% of production storage
      cost_priority     = "maximum"
      availability_priority = "low"
    }
    staging = {
      cpu_multiplier    = 0.6   # 60% of production capacity
      memory_multiplier = 0.6   # 60% of production memory
      storage_multiplier = 0.4  # 40% of production storage
      cost_priority     = "medium"
      availability_priority = "medium"
    }
    production = {
      cpu_multiplier    = 1.0   # Full production capacity
      memory_multiplier = 1.0   # Full production memory
      storage_multiplier = 1.0  # Full production storage
      cost_priority     = "performance"
      availability_priority = "high"
    }
  }

  # Base resource configurations (production baseline)
  base_resources = {
    rds = {
      cpu_units       = 2.0    # vCPUs
      memory_gb       = 8.0    # GB RAM
      storage_gb      = 500    # GB storage
      iops           = 3000   # Baseline IOPS
    }
    redis = {
      cpu_units       = 1.0    # vCPUs
      memory_gb       = 4.0    # GB RAM
      connections     = 65000  # Max connections
    }
    eks_nodes = {
      cpu_units       = 4.0    # vCPUs per node
      memory_gb       = 16.0   # GB RAM per node
      storage_gb      = 100    # GB storage per node
      min_nodes       = 3      # Minimum for HA
      max_nodes       = 20     # Maximum scaling
    }
    load_balancer = {
      capacity_units  = 25     # ALB capacity units
      rules          = 100     # Number of rules
      targets        = 1000    # Target capacity
    }
  }

  # Current environment multiplier
  env_multiplier = local.environment_multipliers[var.environment]

  # Calculated RDS resources
  rds_resources = {
    instance_class = local.calculate_rds_instance_class(
      local.base_resources.rds.cpu_units * local.env_multiplier.cpu_multiplier,
      local.base_resources.rds.memory_gb * local.env_multiplier.memory_multiplier
    )
    allocated_storage = max(
      20, # Minimum storage
      floor(local.base_resources.rds.storage_gb * local.env_multiplier.storage_multiplier)
    )
    max_allocated_storage = max(
      100, # Minimum max storage
      floor(local.base_resources.rds.storage_gb * local.env_multiplier.storage_multiplier * 2)
    )
    backup_retention = local.calculate_backup_retention(var.environment)
    multi_az = var.environment == "production" ? true : false
    deletion_protection = var.environment == "production" ? true : false
  }

  # Calculated Redis resources
  redis_resources = {
    node_type = local.calculate_redis_node_type(
      local.base_resources.redis.cpu_units * local.env_multiplier.cpu_multiplier,
      local.base_resources.redis.memory_gb * local.env_multiplier.memory_multiplier
    )
    num_cache_nodes = local.calculate_redis_nodes(var.environment)
    snapshot_retention = local.calculate_backup_retention(var.environment) / 2
  }

  # Calculated EKS resources
  eks_resources = {
    instance_types = local.calculate_eks_instance_types(
      local.base_resources.eks_nodes.cpu_units * local.env_multiplier.cpu_multiplier,
      local.base_resources.eks_nodes.memory_gb * local.env_multiplier.memory_multiplier
    )
    min_size = local.calculate_eks_min_nodes(var.environment)
    max_size = local.calculate_eks_max_nodes(var.environment)
    desired_size = local.calculate_eks_desired_nodes(var.environment)
    disk_size = max(
      20, # Minimum disk size
      floor(local.base_resources.eks_nodes.storage_gb * local.env_multiplier.storage_multiplier)
    )
  }

  # Cost optimization features
  cost_optimizations = {
    single_nat_gateway = var.environment == "development" ? true : false
    enable_spot_instances = var.environment != "production" ? true : false
    auto_shutdown_enabled = var.environment == "development" ? true : false
    reserved_instance_eligible = var.environment == "production" ? true : false
  }
}

# RDS Instance Class Calculator
# Maps CPU and memory requirements to appropriate RDS instance classes
locals {
  calculate_rds_instance_class = function(cpu_requirement, memory_requirement) {
    # Instance class mapping based on CPU and memory requirements
    # Returns appropriate instance class for the calculated requirements
    
    # Development tier instances (cost-optimized)
    cpu_requirement <= 1 && memory_requirement <= 2 ? "db.t3.micro" :
    cpu_requirement <= 1 && memory_requirement <= 4 ? "db.t3.small" :
    cpu_requirement <= 2 && memory_requirement <= 8 ? "db.t3.medium" :
    
    # Staging tier instances (balanced)
    cpu_requirement <= 2 && memory_requirement <= 16 ? "db.t3.large" :
    cpu_requirement <= 4 && memory_requirement <= 32 ? "db.t3.xlarge" :
    
    # Production tier instances (performance-optimized)
    cpu_requirement <= 2 && memory_requirement <= 16 ? "db.r6g.large" :
    cpu_requirement <= 4 && memory_requirement <= 32 ? "db.r6g.xlarge" :
    cpu_requirement <= 8 && memory_requirement <= 64 ? "db.r6g.2xlarge" :
    
    # Default to medium for safety
    "db.t3.medium"
  }
}

# Redis Node Type Calculator
locals {
  calculate_redis_node_type = function(cpu_requirement, memory_requirement) {
    # Redis instance type mapping based on CPU and memory requirements
    
    # Development tier (cost-optimized)
    cpu_requirement <= 0.5 && memory_requirement <= 1 ? "cache.t3.micro" :
    cpu_requirement <= 1 && memory_requirement <= 2 ? "cache.t3.small" :
    cpu_requirement <= 2 && memory_requirement <= 4 ? "cache.t3.medium" :
    
    # Production tier (memory-optimized)
    cpu_requirement <= 2 && memory_requirement <= 13 ? "cache.r6g.large" :
    cpu_requirement <= 4 && memory_requirement <= 26 ? "cache.r6g.xlarge" :
    cpu_requirement <= 8 && memory_requirement <= 52 ? "cache.r6g.2xlarge" :
    
    # Default to medium for safety
    "cache.t3.medium"
  }
}

# EKS Instance Types Calculator
locals {
  calculate_eks_instance_types = function(cpu_requirement, memory_requirement) {
    # EKS node instance type selection based on requirements
    
    # Development tier (cost-optimized)
    cpu_requirement <= 1 && memory_requirement <= 4 ? ["t3.small"] :
    cpu_requirement <= 2 && memory_requirement <= 8 ? ["t3.medium"] :
    cpu_requirement <= 4 && memory_requirement <= 16 ? ["t3.large"] :
    
    # Production tier (performance-optimized with multiple options)
    cpu_requirement <= 8 && memory_requirement <= 32 ? ["r6i.xlarge", "c6i.xlarge"] :
    cpu_requirement <= 16 && memory_requirement <= 64 ? ["r6i.2xlarge", "c6i.2xlarge"] :
    
    # Default to large instances
    ["t3.large"]
  }
}

# Node Sizing Calculators
locals {
  calculate_eks_min_nodes = function(environment) {
    environment == "development" ? 1 :
    environment == "staging" ? 2 :
    environment == "production" ? 3 :
    1
  }
  
  calculate_eks_max_nodes = function(environment) {
    environment == "development" ? 3 :
    environment == "staging" ? 6 :
    environment == "production" ? 20 :
    5
  }
  
  calculate_eks_desired_nodes = function(environment) {
    environment == "development" ? 1 :
    environment == "staging" ? 2 :
    environment == "production" ? 6 :
    2
  }

  calculate_redis_nodes = function(environment) {
    environment == "development" ? 1 :
    environment == "staging" ? 2 :
    environment == "production" ? 3 :
    1
  }

  calculate_backup_retention = function(environment) {
    environment == "development" ? 1 :
    environment == "staging" ? 3 :
    environment == "production" ? 14 :
    7
  }
}

# Cost Estimation Calculator
locals {
  estimated_monthly_cost = {
    rds_cost = local.calculate_rds_cost(local.rds_resources.instance_class, local.rds_resources.allocated_storage)
    redis_cost = local.calculate_redis_cost(local.redis_resources.node_type, local.redis_resources.num_cache_nodes)
    eks_cost = local.calculate_eks_cost(local.eks_resources.instance_types[0], local.eks_resources.desired_size)
    total_estimated = local.calculate_total_infrastructure_cost()
  }

  calculate_rds_cost = function(instance_class, storage_gb) {
    # Simplified cost estimation (USD/month)
    # Based on us-west-2 pricing as of 2024
    
    instance_class == "db.t3.micro" ? 15.0 + (storage_gb * 0.115) :
    instance_class == "db.t3.small" ? 30.0 + (storage_gb * 0.115) :
    instance_class == "db.t3.medium" ? 60.0 + (storage_gb * 0.115) :
    instance_class == "db.t3.large" ? 120.0 + (storage_gb * 0.115) :
    instance_class == "db.r6g.large" ? 180.0 + (storage_gb * 0.115) :
    instance_class == "db.r6g.xlarge" ? 360.0 + (storage_gb * 0.115) :
    100.0 + (storage_gb * 0.115)
  }

  calculate_redis_cost = function(node_type, node_count) {
    # Per-node cost estimates (USD/month)
    
    node_cost = (
      node_type == "cache.t3.micro" ? 15.0 :
      node_type == "cache.t3.small" ? 30.0 :
      node_type == "cache.t3.medium" ? 60.0 :
      node_type == "cache.r6g.large" ? 150.0 :
      node_type == "cache.r6g.xlarge" ? 300.0 :
      75.0
    )
    
    node_cost * node_count
  }

  calculate_eks_cost = function(instance_type, node_count) {
    # EKS cluster cost + node costs (USD/month)
    
    cluster_cost = 73.0  # EKS control plane cost
    
    node_cost = (
      instance_type == "t3.small" ? 15.0 :
      instance_type == "t3.medium" ? 30.0 :
      instance_type == "t3.large" ? 60.0 :
      instance_type == "r6i.xlarge" ? 230.0 :
      instance_type == "r6i.2xlarge" ? 460.0 :
      100.0
    )
    
    cluster_cost + (node_cost * node_count)
  }

  calculate_total_infrastructure_cost = function() {
    local.estimated_monthly_cost.rds_cost +
    local.estimated_monthly_cost.redis_cost +
    local.estimated_monthly_cost.eks_cost +
    100  # Additional services (ALB, CloudWatch, etc.)
  }
}