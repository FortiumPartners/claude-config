# Monitoring and Alerting Configuration for External Metrics Web Service

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "app" {
  name              = "/aws/eks/${local.name_prefix}/application"
  retention_in_days = var.log_retention_days

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-logs"
  })
}

resource "aws_cloudwatch_log_group" "redis" {
  name              = "/aws/elasticache/${local.name_prefix}/redis"
  retention_in_days = var.log_retention_days

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-logs"
  })
}

resource "aws_cloudwatch_log_group" "alb" {
  name              = "/aws/alb/${local.name_prefix}"
  retention_in_days = var.log_retention_days

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-logs"
  })
}

# SNS Topic for Alerts
resource "aws_sns_topic" "alerts" {
  name = "${local.name_prefix}-alerts"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alerts"
  })
}

resource "aws_sns_topic_subscription" "email_alerts" {
  count     = var.alert_email != null ? 1 : 0
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# CloudWatch Alarms

# RDS Alarms
resource "aws_cloudwatch_metric_alarm" "rds_cpu_high" {
  alarm_name          = "${local.name_prefix}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "RDS CPU utilization is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions         = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_connections_high" {
  alarm_name          = "${local.name_prefix}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "RDS connection count is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage_low" {
  alarm_name          = "${local.name_prefix}-rds-free-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "2147483648" # 2GB in bytes
  alarm_description   = "RDS free storage is low"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }

  tags = local.common_tags
}

# Redis Alarms
resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  alarm_name          = "${local.name_prefix}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "Redis CPU utilization is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis.replication_group_id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_high" {
  alarm_name          = "${local.name_prefix}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "90"
  alarm_description   = "Redis memory utilization is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis.replication_group_id
  }

  tags = local.common_tags
}

# EKS Cluster Alarms
resource "aws_cloudwatch_metric_alarm" "eks_node_cpu_high" {
  alarm_name          = "${local.name_prefix}-eks-node-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "node_cpu_utilization"
  namespace           = "ContainerInsights"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "EKS node CPU utilization is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = module.eks.cluster_id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "eks_pod_restarts" {
  alarm_name          = "${local.name_prefix}-eks-pod-restarts"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "pod_number_of_container_restarts"
  namespace           = "ContainerInsights"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "High number of pod restarts detected"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = module.eks.cluster_id
    Namespace   = "default"
  }

  tags = local.common_tags
}

# Application Load Balancer Alarms
resource "aws_cloudwatch_metric_alarm" "alb_response_time_high" {
  alarm_name          = "${local.name_prefix}-alb-response-time-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "1.0"
  alarm_description   = "ALB target response time is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors_high" {
  alarm_name          = "${local.name_prefix}-alb-5xx-errors-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "High number of 5XX errors from ALB targets"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "alb_healthy_targets_low" {
  alarm_name          = "${local.name_prefix}-alb-healthy-targets-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "Number of healthy ALB targets is low"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    TargetGroup = aws_lb_target_group.app.arn_suffix
  }

  tags = local.common_tags
}

# Custom Application Metrics Dashboard
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${local.name_prefix}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", aws_db_instance.postgres.id],
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", aws_db_instance.postgres.id],
            ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", aws_db_instance.postgres.id]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "RDS Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "ReplicationGroupId", aws_elasticache_replication_group.redis.replication_group_id],
            ["AWS/ElastiCache", "DatabaseMemoryUsagePercentage", "ReplicationGroupId", aws_elasticache_replication_group.redis.replication_group_id],
            ["AWS/ElastiCache", "NetworkBytesIn", "ReplicationGroupId", aws_elasticache_replication_group.redis.replication_group_id],
            ["AWS/ElastiCache", "NetworkBytesOut", "ReplicationGroupId", aws_elasticache_replication_group.redis.replication_group_id]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Redis Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.main.arn_suffix],
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.main.arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_Target_2XX_Count", "LoadBalancer", aws_lb.main.arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_Target_4XX_Count", "LoadBalancer", aws_lb.main.arn_suffix],
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", aws_lb.main.arn_suffix]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "Application Load Balancer Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["ContainerInsights", "node_cpu_utilization", "ClusterName", module.eks.cluster_id],
            ["ContainerInsights", "node_memory_utilization", "ClusterName", module.eks.cluster_id],
            ["ContainerInsights", "pod_cpu_utilization", "ClusterName", module.eks.cluster_id, "Namespace", "default"],
            ["ContainerInsights", "pod_memory_utilization", "ClusterName", module.eks.cluster_id, "Namespace", "default"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "EKS Cluster Metrics"
          period  = 300
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 12
        width  = 24
        height = 6

        properties = {
          query = "SOURCE '${aws_cloudwatch_log_group.app.name}'\n| fields @timestamp, @message\n| filter @message like /ERROR/\n| sort @timestamp desc\n| limit 100"
          region = var.aws_region
          title  = "Recent Application Errors"
        }
      }
    ]
  })
}

# Metric Filters for Application Logs
resource "aws_cloudwatch_log_metric_filter" "error_count" {
  name           = "${local.name_prefix}-error-count"
  log_group_name = aws_cloudwatch_log_group.app.name
  pattern        = "[timestamp, request_id, level=\"ERROR\", ...]"

  metric_transformation {
    name      = "ErrorCount"
    namespace = "${local.name_prefix}/Application"
    value     = "1"
  }
}

resource "aws_cloudwatch_log_metric_filter" "slow_queries" {
  name           = "${local.name_prefix}-slow-queries"
  log_group_name = aws_cloudwatch_log_group.app.name
  pattern        = "[timestamp, request_id, level, message=\"Database query took*ms\", duration > 1000]"

  metric_transformation {
    name      = "SlowQueryCount"
    namespace = "${local.name_prefix}/Application"
    value     = "1"
  }
}

# Custom Metric Alarms based on Log Filters
resource "aws_cloudwatch_metric_alarm" "app_error_rate_high" {
  alarm_name          = "${local.name_prefix}-app-error-rate-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorCount"
  namespace           = "${local.name_prefix}/Application"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Application error rate is high"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  treat_missing_data  = "notBreaching"

  tags = local.common_tags
}

# Auto Scaling Alarms for EKS
resource "aws_cloudwatch_metric_alarm" "eks_scale_up" {
  count               = var.enable_cluster_autoscaler ? 1 : 0
  alarm_name          = "${local.name_prefix}-eks-scale-up"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "pod_cpu_utilization"
  namespace           = "ContainerInsights"
  period              = "300"
  statistic           = "Average"
  threshold           = "70"
  alarm_description   = "Trigger EKS cluster scale up"
  
  dimensions = {
    ClusterName = module.eks.cluster_id
    Namespace   = "default"
  }

  tags = local.common_tags
}

# Composite Alarm for Overall System Health
resource "aws_cloudwatch_composite_alarm" "system_health" {
  alarm_name        = "${local.name_prefix}-system-health"
  alarm_description = "Overall system health composite alarm"

  alarm_rule = join(" OR ", [
    "ALARM(${aws_cloudwatch_metric_alarm.rds_cpu_high.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.redis_cpu_high.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.alb_5xx_errors_high.alarm_name})",
    "ALARM(${aws_cloudwatch_metric_alarm.alb_healthy_targets_low.alarm_name})"
  ])

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions   = [aws_sns_topic.alerts.arn]

  tags = local.common_tags
}