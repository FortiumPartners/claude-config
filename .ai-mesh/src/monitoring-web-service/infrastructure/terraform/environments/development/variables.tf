# Development Environment Variables
# This file defines variables specific to the development environment
# with cost optimization and simplified configuration as primary concerns

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "monitoring-web-service"
  
  validation {
    condition = can(regex("^[a-z0-9-]+$", var.project_name))
    error_message = "Project name must contain only lowercase letters, numbers, and hyphens."
  }
}

variable "aws_region" {
  description = "AWS region for development environment"
  type        = string
  default     = "us-west-2"
  
  validation {
    condition = contains([
      "us-east-1", "us-east-2", "us-west-1", "us-west-2",
      "eu-west-1", "eu-west-2", "eu-central-1",
      "ap-southeast-1", "ap-southeast-2", "ap-northeast-1"
    ], var.aws_region)
    error_message = "AWS region must be a valid region."
  }
}

# Cost Optimization Variables
variable "enable_cost_optimization" {
  description = "Enable aggressive cost optimization features"
  type        = bool
  default     = true
}

variable "spot_instance_max_price" {
  description = "Maximum price for spot instances (as percentage of on-demand price)"
  type        = string
  default     = "0.05"  # 50% of on-demand price
  
  validation {
    condition = can(regex("^0\\.[0-9]+$", var.spot_instance_max_price))
    error_message = "Spot instance max price must be a decimal between 0 and 1."
  }
}

variable "auto_shutdown_schedule" {
  description = "Cron expression for automatic shutdown (empty to disable)"
  type        = string
  default     = "0 20 * * 1-5"  # 8 PM weekdays
}

variable "auto_startup_schedule" {
  description = "Cron expression for automatic startup (empty to disable)"
  type        = string
  default     = "0 8 * * 1-5"   # 8 AM weekdays
}

variable "weekend_scaling_enabled" {
  description = "Scale to zero on weekends for cost savings"
  type        = bool
  default     = true
}

# Resource Configuration Variables
variable "instance_types" {
  description = "List of EC2 instance types to use (cost-optimized)"
  type        = list(string)
  default     = ["t3.micro", "t3.small"]
  
  validation {
    condition = length(var.instance_types) > 0
    error_message = "At least one instance type must be specified."
  }
}

variable "min_capacity" {
  description = "Minimum number of instances"
  type        = number
  default     = 0  # Allow scaling to zero
  
  validation {
    condition = var.min_capacity >= 0 && var.min_capacity <= 10
    error_message = "Minimum capacity must be between 0 and 10."
  }
}

variable "max_capacity" {
  description = "Maximum number of instances"
  type        = number
  default     = 2
  
  validation {
    condition = var.max_capacity >= 1 && var.max_capacity <= 20
    error_message = "Maximum capacity must be between 1 and 20."
  }
}

variable "desired_capacity" {
  description = "Desired number of instances"
  type        = number
  default     = 1
  
  validation {
    condition = var.desired_capacity >= 0
    error_message = "Desired capacity must be non-negative."
  }
}

# Database Configuration Variables
variable "db_instance_class" {
  description = "RDS instance class for development"
  type        = string
  default     = "db.t3.micro"
  
  validation {
    condition = can(regex("^db\\.(t3|t2)\\.(nano|micro|small)$", var.db_instance_class))
    error_message = "Database instance class must be a cost-optimized burstable instance type."
  }
}

variable "db_allocated_storage" {
  description = "Initial database storage allocation in GB"
  type        = number
  default     = 20
  
  validation {
    condition = var.db_allocated_storage >= 20 && var.db_allocated_storage <= 100
    error_message = "Database storage must be between 20 and 100 GB for development."
  }
}

variable "db_backup_retention_days" {
  description = "Number of days to retain database backups"
  type        = number
  default     = 7
  
  validation {
    condition = var.db_backup_retention_days >= 1 && var.db_backup_retention_days <= 35
    error_message = "Backup retention must be between 1 and 35 days."
  }
}

# Storage Configuration Variables
variable "storage_type" {
  description = "EBS storage type for cost optimization"
  type        = string
  default     = "gp2"
  
  validation {
    condition = contains(["gp2", "gp3"], var.storage_type)
    error_message = "Storage type must be gp2 or gp3 for cost optimization."
  }
}

variable "root_volume_size" {
  description = "Size of the root EBS volume in GB"
  type        = number
  default     = 20
  
  validation {
    condition = var.root_volume_size >= 8 && var.root_volume_size <= 50
    error_message = "Root volume size must be between 8 and 50 GB for development."
  }
}

# Monitoring Configuration Variables
variable "enable_detailed_monitoring" {
  description = "Enable detailed CloudWatch monitoring"
  type        = bool
  default     = false  # Disabled for cost savings
}

variable "log_retention_days" {
  description = "Number of days to retain CloudWatch logs"
  type        = number
  default     = 7
  
  validation {
    condition = contains([1, 3, 5, 7, 14, 30], var.log_retention_days)
    error_message = "Log retention must be 1, 3, 5, 7, 14, or 30 days."
  }
}

variable "enable_xray_tracing" {
  description = "Enable AWS X-Ray tracing"
  type        = bool
  default     = false  # Disabled for cost savings
}

# Security Configuration Variables
variable "enable_encryption_at_rest" {
  description = "Enable encryption at rest for storage"
  type        = bool
  default     = false  # Disabled for development
}

variable "enable_encryption_in_transit" {
  description = "Enable encryption in transit"
  type        = bool
  default     = true   # Enabled for security
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the application"
  type        = list(string)
  default     = ["0.0.0.0/0"]  # Open access for development
  
  validation {
    condition = length(var.allowed_cidr_blocks) > 0
    error_message = "At least one CIDR block must be specified."
  }
}

# Network Configuration Variables
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
  
  validation {
    condition = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block."
  }
}

variable "availability_zones_count" {
  description = "Number of availability zones to use"
  type        = number
  default     = 1  # Single AZ for cost savings
  
  validation {
    condition = var.availability_zones_count >= 1 && var.availability_zones_count <= 3
    error_message = "Availability zones count must be between 1 and 3."
  }
}

variable "enable_nat_gateway" {
  description = "Enable NAT Gateway (use NAT instances instead for cost savings)"
  type        = bool
  default     = false
}

# Notification Variables
variable "notification_email" {
  description = "Email address for CloudWatch alarms and notifications"
  type        = string
  default     = null
  
  validation {
    condition = var.notification_email == null || can(regex("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", var.notification_email))
    error_message = "Notification email must be a valid email address."
  }
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for notifications (optional)"
  type        = string
  default     = null
  sensitive   = true
}

# Feature Flags
variable "enable_container_insights" {
  description = "Enable ECS Container Insights"
  type        = bool
  default     = false  # Disabled for cost savings
}

variable "enable_load_balancer_access_logs" {
  description = "Enable ALB access logging"
  type        = bool
  default     = false  # Disabled for cost savings
}

variable "enable_vpc_flow_logs" {
  description = "Enable VPC Flow Logs"
  type        = bool
  default     = false  # Disabled for cost savings
}

variable "enable_cloudtrail" {
  description = "Enable AWS CloudTrail"
  type        = bool
  default     = false  # Disabled for cost savings
}

# Application-Specific Variables
variable "application_port" {
  description = "Port the application listens on"
  type        = number
  default     = 3000
  
  validation {
    condition = var.application_port > 0 && var.application_port <= 65535
    error_message = "Application port must be between 1 and 65535."
  }
}

variable "health_check_path" {
  description = "Health check path for the application"
  type        = string
  default     = "/health"
}

variable "health_check_interval" {
  description = "Health check interval in seconds"
  type        = number
  default     = 30
  
  validation {
    condition = var.health_check_interval >= 5 && var.health_check_interval <= 300
    error_message = "Health check interval must be between 5 and 300 seconds."
  }
}

# Development-Specific Variables
variable "developer_access_key_ids" {
  description = "List of IAM user access key IDs for developer access"
  type        = list(string)
  default     = []
}

variable "enable_debug_logging" {
  description = "Enable debug logging for troubleshooting"
  type        = bool
  default     = true  # Enabled for development
}

variable "allow_ssh_access" {
  description = "Allow SSH access to EC2 instances"
  type        = bool
  default     = true  # Enabled for development debugging
}

variable "ssh_key_pair_name" {
  description = "Name of the EC2 Key Pair for SSH access"
  type        = string
  default     = null
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "cost_center" {
  description = "Cost center for resource tagging"
  type        = string
  default     = "development"
}

variable "owner" {
  description = "Owner of the resources for tagging"
  type        = string
  default     = "development-team"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "development"
  
  validation {
    condition = contains(["development", "dev", "sandbox"], var.environment)
    error_message = "Environment must be development, dev, or sandbox for this configuration."
  }
}