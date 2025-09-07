# Auto-scaling Configuration with Predictive Scaling and Cost Optimization
# Infrastructure Management Subagent - Cost Optimization and Resource Management

# Variables
variable "app_name" {
  description = "Application name"
  type        = string
  default     = "monitoring-web-service"
}

variable "environment" {
  description = "Environment (development, staging, production)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs for Auto Scaling Group"
  type        = list(string)
}

variable "instance_types" {
  description = "EC2 instance types in order of preference"
  type        = list(string)
  default     = ["t3.medium", "t3.large", "m5.large", "m5.xlarge"]
}

variable "min_capacity" {
  description = "Minimum capacity for Auto Scaling Group"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum capacity for Auto Scaling Group"
  type        = number
  default     = 10
}

variable "desired_capacity" {
  description = "Desired capacity for Auto Scaling Group"
  type        = number
  default     = 2
}

# Data sources
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}
data "aws_availability_zones" "available" {}

# Latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Environment-specific configurations
locals {
  environment_config = {
    development = {
      min_capacity     = 1
      max_capacity     = 3
      desired_capacity = 1
      instance_types   = ["t3.micro", "t3.small", "t3.medium"]
      spot_percentage  = 100
      predictive_scaling = false
      schedule_scaling = true
      health_check_grace_period = 300
    }
    staging = {
      min_capacity     = 2
      max_capacity     = 6
      desired_capacity = 2
      instance_types   = ["t3.small", "t3.medium", "t3.large"]
      spot_percentage  = 70
      predictive_scaling = true
      schedule_scaling = true
      health_check_grace_period = 300
    }
    production = {
      min_capacity     = 3
      max_capacity     = 20
      desired_capacity = 5
      instance_types   = ["m5.large", "m5.xlarge", "c5.large", "c5.xlarge"]
      spot_percentage  = 50
      predictive_scaling = true
      schedule_scaling = false
      health_check_grace_period = 600
    }
  }

  config = local.environment_config[var.environment]

  # Cost optimization settings
  cost_optimization = {
    development = {
      scale_down_after_hours = true
      weekend_scaling = 0
      auto_shutdown = true
      business_hours = {
        start = "08:00"
        end   = "18:00"
        timezone = "America/Los_Angeles"
      }
    }
    staging = {
      scale_down_after_hours = true
      weekend_scaling = 1
      auto_shutdown = false
      business_hours = {
        start = "06:00"
        end   = "22:00"
        timezone = "America/Los_Angeles"
      }
    }
    production = {
      scale_down_after_hours = false
      weekend_scaling = null
      auto_shutdown = false
      business_hours = null
    }
  }
}

# IAM Role for EC2 instances
resource "aws_iam_role" "ec2_role" {
  name = "${var.app_name}-${var.environment}-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-ec2-role"
    Environment = var.environment
    Application = var.app_name
  }
}

# IAM Instance Profile
resource "aws_iam_instance_profile" "ec2_profile" {
  name = "${var.app_name}-${var.environment}-ec2-profile"
  role = aws_iam_role.ec2_role.name

  tags = {
    Name        = "${var.app_name}-${var.environment}-ec2-profile"
    Environment = var.environment
    Application = var.app_name
  }
}

# Attach CloudWatch agent policy
resource "aws_iam_role_policy_attachment" "cloudwatch_agent_policy" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# Attach SSM policy for instance management
resource "aws_iam_role_policy_attachment" "ssm_policy" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Custom policy for cost optimization tools
resource "aws_iam_role_policy" "cost_optimization_policy" {
  name = "${var.app_name}-${var.environment}-cost-optimization-policy"
  role = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:PutMetricData",
          "cloudwatch:GetMetricStatistics",
          "cloudwatch:ListMetrics",
          "ce:GetCostAndUsage",
          "ce:GetUsageReport"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "autoscaling:DescribeAutoScalingGroups",
          "autoscaling:DescribeAutoScalingInstances",
          "autoscaling:DescribePolicies"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeSpotPriceHistory",
          "ec2:DescribeInstanceTypes"
        ]
        Resource = "*"
      }
    ]
  })
}

# Security Group for Auto Scaling Group
resource "aws_security_group" "asg_security_group" {
  name_prefix = "${var.app_name}-${var.environment}-asg-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "HTTP from VPC"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "HTTPS from VPC"
  }

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/8"]
    description = "SSH from VPC"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-asg-sg"
    Environment = var.environment
    Application = var.app_name
  }
}

# Launch Template with Mixed Instance Types
resource "aws_launch_template" "app_template" {
  name_prefix   = "${var.app_name}-${var.environment}-"
  image_id      = data.aws_ami.amazon_linux.id
  instance_type = local.config.instance_types[0]
  
  vpc_security_group_ids = [aws_security_group.asg_security_group.id]

  iam_instance_profile {
    name = aws_iam_instance_profile.ec2_profile.name
  }

  monitoring {
    enabled = true
  }

  # User data for instance initialization
  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    app_name    = var.app_name
    environment = var.environment
    region      = data.aws_region.current.name
  }))

  # Instance metadata options for security
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                = "required"
    http_put_response_hop_limit = 2
    instance_metadata_tags      = "enabled"
  }

  # Block device mappings with cost-optimized storage
  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size = var.environment == "production" ? 20 : 10
      volume_type = "gp3"
      iops        = var.environment == "production" ? 3000 : 1000
      throughput  = var.environment == "production" ? 125 : 80
      encrypted   = true
      delete_on_termination = true
    }
  }

  # Instance tags
  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "${var.app_name}-${var.environment}-instance"
      Environment = var.environment
      Application = var.app_name
      LaunchedBy  = "AutoScaling"
      CostCenter  = var.environment == "production" ? "production-workloads" : "non-production"
      Team        = "infrastructure"
      Project     = var.app_name
    }
  }

  tag_specifications {
    resource_type = "volume"
    tags = {
      Name        = "${var.app_name}-${var.environment}-volume"
      Environment = var.environment
      Application = var.app_name
    }
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-launch-template"
    Environment = var.environment
    Application = var.app_name
  }
}

# Auto Scaling Group with Mixed Instances Policy
resource "aws_autoscaling_group" "app_asg" {
  name                = "${var.app_name}-${var.environment}-asg"
  vpc_zone_identifier = var.subnet_ids
  target_group_arns   = [aws_lb_target_group.app_tg.arn]
  health_check_type   = "ELB"
  health_check_grace_period = local.config.health_check_grace_period

  min_size         = local.config.min_capacity
  max_size         = local.config.max_capacity
  desired_capacity = local.config.desired_capacity

  # Mixed instances policy for cost optimization
  mixed_instances_policy {
    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.app_template.id
        version           = "$Latest"
      }

      # Override instance types for diversification
      dynamic "override" {
        for_each = local.config.instance_types
        content {
          instance_type = override.value
          weighted_capacity = 1
        }
      }
    }

    instances_distribution {
      on_demand_base_capacity                  = var.environment == "production" ? 2 : 0
      on_demand_percentage_above_base_capacity = 100 - local.config.spot_percentage
      spot_allocation_strategy                 = "price-capacity-optimized"
      spot_instance_pools                      = 4
      spot_max_price                          = var.environment == "production" ? null : "0.10"
    }
  }

  # Instance refresh for updates
  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = var.environment == "production" ? 90 : 50
      instance_warmup       = 300
    }
  }

  # Tags
  dynamic "tag" {
    for_each = {
      Name         = "${var.app_name}-${var.environment}-asg"
      Environment  = var.environment
      Application  = var.app_name
      CostCenter   = var.environment == "production" ? "production-workloads" : "non-production"
      Team         = "infrastructure"
      Project      = var.app_name
      Backup       = var.environment == "production" ? "daily" : "none"
      Monitoring   = "enabled"
    }
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }

  # Lifecycle hooks for graceful shutdown
  initial_lifecycle_hook {
    name                 = "${var.app_name}-${var.environment}-terminate-hook"
    default_result       = "ABANDON"
    heartbeat_timeout    = 300
    lifecycle_transition = "autoscaling:EC2_INSTANCE_TERMINATING"

    notification_target_arn = aws_sns_topic.asg_notifications.arn
    role_arn               = aws_iam_role.asg_notification_role.arn
  }

  depends_on = [aws_lb_target_group.app_tg]
}

# Target Group for Load Balancer
resource "aws_lb_target_group" "app_tg" {
  name     = "${var.app_name}-${var.environment}-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-tg"
    Environment = var.environment
    Application = var.app_name
  }
}

# Auto Scaling Policies - Target Tracking
resource "aws_autoscaling_policy" "cpu_utilization_policy" {
  name               = "${var.app_name}-${var.environment}-cpu-policy"
  scaling_adjustment = null
  adjustment_type    = null
  cooldown          = null
  autoscaling_group_name = aws_autoscaling_group.app_asg.name
  policy_type       = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value = var.environment == "production" ? 60.0 : 70.0
  }
}

resource "aws_autoscaling_policy" "memory_utilization_policy" {
  name               = "${var.app_name}-${var.environment}-memory-policy"
  autoscaling_group_name = aws_autoscaling_group.app_asg.name
  policy_type       = "TargetTrackingScaling"

  target_tracking_configuration {
    customized_metric_specification {
      metric_dimension {
        name  = "AutoScalingGroupName"
        value = aws_autoscaling_group.app_asg.name
      }
      metric_name = "MemoryUtilization"
      namespace   = "AWS/EC2"
      statistic   = "Average"
    }
    target_value = var.environment == "production" ? 70.0 : 80.0
  }
}

# Request count based scaling
resource "aws_autoscaling_policy" "request_count_policy" {
  name               = "${var.app_name}-${var.environment}-request-policy"
  autoscaling_group_name = aws_autoscaling_group.app_asg.name
  policy_type       = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ALBRequestCountPerTarget"
      resource_label        = "${aws_lb.app_lb.arn_suffix}/${aws_lb_target_group.app_tg.arn_suffix}"
    }
    target_value = var.environment == "production" ? 1000.0 : 500.0
  }
}

# Predictive Scaling Policy (Production and Staging only)
resource "aws_autoscaling_policy" "predictive_scaling_policy" {
  count              = local.config.predictive_scaling ? 1 : 0
  name               = "${var.app_name}-${var.environment}-predictive-policy"
  autoscaling_group_name = aws_autoscaling_group.app_asg.name
  policy_type       = "PredictiveScaling"

  predictive_scaling_configuration {
    metric_specification {
      target_value = var.environment == "production" ? 60.0 : 70.0
      predefined_metric_specification {
        predefined_metric_type = "ASGAverageCPUUtilization"
      }
    }
    mode                         = var.environment == "production" ? "ForecastAndScale" : "ForecastOnly"
    scheduling_buffer_time       = 300
    max_capacity_breach_behavior = "IncreaseMaxCapacity"
    max_capacity_buffer          = 10
  }
}

# Scheduled Scaling for Cost Optimization
resource "aws_autoscaling_schedule" "scale_down_evening" {
  count                  = local.cost_optimization[var.environment].scale_down_after_hours ? 1 : 0
  scheduled_action_name  = "${var.app_name}-${var.environment}-scale-down-evening"
  min_size              = local.config.min_capacity
  max_size              = local.config.max_capacity  
  desired_capacity       = max(1, local.config.desired_capacity - 2)
  recurrence            = "0 18 * * MON-FRI"  # 6 PM weekdays
  time_zone             = local.cost_optimization[var.environment].business_hours.timezone
  autoscaling_group_name = aws_autoscaling_group.app_asg.name
}

resource "aws_autoscaling_schedule" "scale_up_morning" {
  count                  = local.cost_optimization[var.environment].scale_down_after_hours ? 1 : 0
  scheduled_action_name  = "${var.app_name}-${var.environment}-scale-up-morning"
  min_size              = local.config.min_capacity
  max_size              = local.config.max_capacity
  desired_capacity       = local.config.desired_capacity
  recurrence            = "0 8 * * MON-FRI"  # 8 AM weekdays
  time_zone             = local.cost_optimization[var.environment].business_hours.timezone
  autoscaling_group_name = aws_autoscaling_group.app_asg.name
}

# Weekend scaling for development/staging
resource "aws_autoscaling_schedule" "weekend_scale_down" {
  count                  = local.cost_optimization[var.environment].weekend_scaling != null ? 1 : 0
  scheduled_action_name  = "${var.app_name}-${var.environment}-weekend-scale-down"
  min_size              = local.cost_optimization[var.environment].weekend_scaling
  max_size              = local.config.max_capacity
  desired_capacity       = local.cost_optimization[var.environment].weekend_scaling
  recurrence            = "0 20 * * FRI"  # Friday 8 PM
  time_zone             = "UTC"
  autoscaling_group_name = aws_autoscaling_group.app_asg.name
}

resource "aws_autoscaling_schedule" "weekend_scale_up" {
  count                  = local.cost_optimization[var.environment].weekend_scaling != null ? 1 : 0
  scheduled_action_name  = "${var.app_name}-${var.environment}-weekend-scale-up"
  min_size              = local.config.min_capacity
  max_size              = local.config.max_capacity
  desired_capacity       = local.config.desired_capacity
  recurrence            = "0 8 * * MON"  # Monday 8 AM
  time_zone             = "UTC"
  autoscaling_group_name = aws_autoscaling_group.app_asg.name
}

# Load Balancer for the Auto Scaling Group
resource "aws_lb" "app_lb" {
  name               = "${var.app_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_security_group.id]
  subnets           = var.subnet_ids

  enable_deletion_protection = var.environment == "production"

  tags = {
    Name        = "${var.app_name}-${var.environment}-alb"
    Environment = var.environment
    Application = var.app_name
  }
}

# Security Group for ALB
resource "aws_security_group" "alb_security_group" {
  name_prefix = "${var.app_name}-${var.environment}-alb-"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTP"
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "HTTPS"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-alb-sg"
    Environment = var.environment
    Application = var.app_name
  }
}

# SNS Topic for ASG notifications
resource "aws_sns_topic" "asg_notifications" {
  name = "${var.app_name}-${var.environment}-asg-notifications"

  tags = {
    Name        = "${var.app_name}-${var.environment}-asg-notifications"
    Environment = var.environment
    Application = var.app_name
  }
}

# IAM Role for ASG notifications
resource "aws_iam_role" "asg_notification_role" {
  name = "${var.app_name}-${var.environment}-asg-notification-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "autoscaling.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-asg-notification-role"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_iam_role_policy" "asg_notification_policy" {
  name = "${var.app_name}-${var.environment}-asg-notification-policy"
  role = aws_iam_role.asg_notification_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.asg_notifications.arn
      }
    ]
  })
}

# Outputs
output "autoscaling_group_name" {
  description = "Name of the Auto Scaling Group"
  value       = aws_autoscaling_group.app_asg.name
}

output "autoscaling_group_arn" {
  description = "ARN of the Auto Scaling Group"
  value       = aws_autoscaling_group.app_asg.arn
}

output "launch_template_id" {
  description = "ID of the Launch Template"
  value       = aws_launch_template.app_template.id
}

output "target_group_arn" {
  description = "ARN of the Target Group"
  value       = aws_lb_target_group.app_tg.arn
}

output "load_balancer_dns" {
  description = "DNS name of the Load Balancer"
  value       = aws_lb.app_lb.dns_name
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for notifications"
  value       = aws_sns_topic.asg_notifications.arn
}