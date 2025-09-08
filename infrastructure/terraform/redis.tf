# Redis ElastiCache Configuration
# Part of Task 1.1: AWS infrastructure setup

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "${local.cluster_name}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = local.common_tags
}

# Security Group for Redis
resource "aws_security_group" "redis" {
  name_prefix = "${local.cluster_name}-redis-sg"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from EKS"
    from_port       = var.redis_port
    to_port         = var.redis_port
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-redis-sg"
  })
}

# KMS Key for Redis Encryption
resource "aws_kms_key" "redis" {
  description             = "Redis ElastiCache Encryption Key"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.cluster_name}-redis-encryption-key"
  })
}

resource "aws_kms_alias" "redis" {
  name          = "alias/${local.cluster_name}-redis-encryption-key"
  target_key_id = aws_kms_key.redis.key_id
}

# Random password for Redis
resource "random_password" "redis_auth_token" {
  length  = 32
  special = false # Redis auth tokens should not contain special characters
}

# AWS Secrets Manager Secret for Redis
resource "aws_secretsmanager_secret" "redis_auth_token" {
  name                    = "${local.cluster_name}-redis-auth-token"
  description             = "Redis ElastiCache auth token"
  recovery_window_in_days = 7

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "redis_auth_token" {
  secret_id = aws_secretsmanager_secret.redis_auth_token.id
  secret_string = jsonencode({
    auth_token = random_password.redis_auth_token.result
    endpoint   = aws_elasticache_replication_group.main.primary_endpoint_address
    port       = var.redis_port
  })
}

# Redis Parameter Group
resource "aws_elasticache_parameter_group" "main" {
  family = "redis7.x"
  name   = "${local.cluster_name}-redis-params"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  tags = local.common_tags
}

# Redis Replication Group
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.cluster_name}-redis"
  description          = "Redis cluster for ${local.cluster_name}"

  # Node Configuration
  node_type            = var.redis_node_type
  port                 = var.redis_port
  parameter_group_name = aws_elasticache_parameter_group.main.name

  # Cluster Configuration
  num_cache_clusters         = var.redis_num_cache_nodes
  automatic_failover_enabled = var.redis_num_cache_nodes > 1
  multi_az_enabled           = var.redis_num_cache_nodes > 1

  # Network Configuration
  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Security Configuration
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result
  kms_key_id                 = aws_kms_key.redis.arn

  # Backup Configuration
  snapshot_retention_limit = 3
  snapshot_window          = "03:00-05:00"
  maintenance_window       = "sun:05:00-sun:07:00"

  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  # Engine Configuration
  engine_version = "7.0"

  # Apply changes immediately in non-production environments
  apply_immediately = var.environment != "production"

  tags = local.common_tags

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [auth_token] # Prevent Terraform from changing auth token
  }
}

# CloudWatch Log Group for Redis Slow Log
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/${local.cluster_name}/redis-slow-log"
  retention_in_days = 7

  tags = local.common_tags
}

# CloudWatch Alarms for Redis
resource "aws_cloudwatch_metric_alarm" "redis_cpu_utilization" {
  alarm_name          = "${local.cluster_name}-redis-cpu-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "120"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors redis cpu utilization"
  alarm_actions       = [] # Add SNS topic ARN for notifications

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.replication_group_id}-001"
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_utilization" {
  alarm_name          = "${local.cluster_name}-redis-memory-utilization"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "120"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors redis memory utilization"
  alarm_actions       = [] # Add SNS topic ARN for notifications

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.replication_group_id}-001"
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "redis_connection_count" {
  alarm_name          = "${local.cluster_name}-redis-connection-count"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "50"
  alarm_description   = "This metric monitors redis connection count"
  alarm_actions       = [] # Add SNS topic ARN for notifications

  dimensions = {
    CacheClusterId = "${aws_elasticache_replication_group.main.replication_group_id}-001"
  }

  tags = local.common_tags
}