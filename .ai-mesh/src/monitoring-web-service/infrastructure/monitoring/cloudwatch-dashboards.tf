# CloudWatch Dashboards and Alarms Configuration
# Infrastructure Management Subagent - Monitoring and Observability Infrastructure

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

variable "alb_arn_suffix" {
  description = "ALB ARN suffix for metrics"
  type        = string
}

variable "target_group_arn_suffix" {
  description = "Target Group ARN suffix for metrics"
  type        = string
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for alerting"
  type        = string
}

# CloudWatch Dashboard for Application Metrics
resource "aws_cloudwatch_dashboard" "application_dashboard" {
  dashboard_name = "${var.app_name}-${var.environment}-application"

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
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", var.alb_arn_suffix],
            [".", "TargetResponseTime", ".", "."],
            [".", "HTTPCode_Target_2XX_Count", ".", "."],
            [".", "HTTPCode_Target_4XX_Count", ".", "."],
            [".", "HTTPCode_Target_5XX_Count", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Application Load Balancer Metrics"
          period  = 300
          stat    = "Sum"
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
            ["AWS/ECS", "CPUUtilization", "ServiceName", "${var.app_name}-${var.environment}", "ClusterName", "${var.app_name}-cluster"],
            [".", "MemoryUtilization", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "ECS Service Resource Utilization"
          period  = 300
          stat    = "Average"
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "CPUUtilization", "DBClusterIdentifier", "${var.app_name}-${var.environment}-db"],
            [".", "DatabaseConnections", ".", "."],
            [".", "ReadLatency", ".", "."],
            [".", "WriteLatency", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "RDS Aurora Cluster Metrics"
          period  = 300
          stat    = "Average"
        }
      },
      {
        type   = "metric"
        x      = 8
        y      = 6
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/ElastiCache", "CPUUtilization", "CacheClusterId", "${var.app_name}-${var.environment}-redis"],
            [".", "NetworkBytesIn", ".", "."],
            [".", "NetworkBytesOut", ".", "."],
            [".", "CacheHits", ".", "."],
            [".", "CacheMisses", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "ElastiCache Redis Metrics"
          period  = 300
          stat    = "Average"
        }
      },
      {
        type   = "metric"
        x      = 16
        y      = 6
        width  = 8
        height = 6

        properties = {
          metrics = [
            ["AWS/Logs", "IncomingLogEvents", "LogGroupName", "/aws/ecs/${var.app_name}-${var.environment}"],
            ["AWS/Lambda", "Invocations", "FunctionName", "${var.app_name}-${var.environment}-processor"],
            [".", "Errors", ".", "."],
            [".", "Duration", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "Logs and Lambda Metrics"
          period  = 300
          stat    = "Sum"
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 12
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '/aws/ecs/${var.app_name}-${var.environment}' | fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc | limit 100"
          region  = data.aws_region.current.name
          title   = "Recent Error Logs"
          view    = "table"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-application-dashboard"
    Environment = var.environment
    Application = var.app_name
  }
}

# CloudWatch Dashboard for Infrastructure Metrics
resource "aws_cloudwatch_dashboard" "infrastructure_dashboard" {
  dashboard_name = "${var.app_name}-${var.environment}-infrastructure"

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
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", "${var.app_name}-${var.environment}-asg"],
            [".", "NetworkIn", ".", "."],
            [".", "NetworkOut", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "EC2 Infrastructure Metrics"
          period  = 300
          stat    = "Average"
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
            ["AWS/ECS", "RunningTaskCount", "ServiceName", "${var.app_name}-${var.environment}", "ClusterName", "${var.app_name}-cluster"],
            [".", "PendingTaskCount", ".", ".", ".", "."],
            [".", "DesiredCount", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "ECS Service Task Metrics"
          period  = 300
          stat    = "Average"
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
            ["AWS/S3", "BucketSizeBytes", "BucketName", "${var.app_name}-${var.environment}-data", "StorageType", "StandardStorage"],
            [".", "NumberOfObjects", ".", ".", ".", "AllStorageTypes"]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "S3 Storage Metrics"
          period  = 86400
          stat    = "Average"
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
            ["AWS/CloudFront", "Requests", "DistributionId", aws_cloudfront_distribution.main.id],
            [".", "BytesDownloaded", ".", "."],
            [".", "BytesUploaded", ".", "."],
            [".", "4xxErrorRate", ".", "."],
            [".", "5xxErrorRate", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = "us-east-1"  # CloudFront metrics are in us-east-1
          title   = "CloudFront Distribution Metrics"
          period  = 300
          stat    = "Sum"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-infrastructure-dashboard"
    Environment = var.environment
    Application = var.app_name
  }
}

# CloudWatch Dashboard for Security and Compliance
resource "aws_cloudwatch_dashboard" "security_dashboard" {
  dashboard_name = "${var.app_name}-${var.environment}-security"

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
            ["AWS/WAFv2", "AllowedRequests", "WebACL", "${var.app_name}-${var.environment}-waf", "Rule", "ALL"],
            [".", "BlockedRequests", ".", ".", ".", "."]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "WAF Security Metrics"
          period  = 300
          stat    = "Sum"
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
            ["AWS/GuardDuty", "FindingCount", "DetectorId", data.aws_guardduty_detector.main.id]
          ]
          view    = "timeSeries"
          stacked = false
          region  = data.aws_region.current.name
          title   = "GuardDuty Security Findings"
          period  = 3600
          stat    = "Sum"
        }
      },
      {
        type   = "log"
        x      = 0
        y      = 6
        width  = 24
        height = 6

        properties = {
          query   = "SOURCE '/aws/apigateway/${var.app_name}-${var.environment}' | fields @timestamp, @message | filter status >= 400 | sort @timestamp desc | limit 50"
          region  = data.aws_region.current.name
          title   = "API Gateway Error Logs"
          view    = "table"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-security-dashboard"
    Environment = var.environment
    Application = var.app_name
  }
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "high_cpu_utilization" {
  alarm_name          = "${var.app_name}-${var.environment}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ECS CPU utilization"
  alarm_actions       = [var.sns_topic_arn]
  ok_actions          = [var.sns_topic_arn]

  dimensions = {
    ServiceName = "${var.app_name}-${var.environment}"
    ClusterName = "${var.app_name}-cluster"
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-high-cpu-alarm"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_cloudwatch_metric_alarm" "high_memory_utilization" {
  alarm_name          = "${var.app_name}-${var.environment}-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors ECS memory utilization"
  alarm_actions       = [var.sns_topic_arn]
  ok_actions          = [var.sns_topic_arn]

  dimensions = {
    ServiceName = "${var.app_name}-${var.environment}"
    ClusterName = "${var.app_name}-cluster"
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-high-memory-alarm"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_cloudwatch_metric_alarm" "high_error_rate" {
  alarm_name          = "${var.app_name}-${var.environment}-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "This metric monitors 5XX error rate"
  alarm_actions       = [var.sns_topic_arn]
  ok_actions          = [var.sns_topic_arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-error-rate-alarm"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_cloudwatch_metric_alarm" "high_response_time" {
  alarm_name          = "${var.app_name}-${var.environment}-high-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "3"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "2"
  alarm_description   = "This metric monitors response time"
  alarm_actions       = [var.sns_topic_arn]
  ok_actions          = [var.sns_topic_arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-response-time-alarm"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_cloudwatch_metric_alarm" "database_cpu_high" {
  alarm_name          = "${var.app_name}-${var.environment}-db-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = [var.sns_topic_arn]

  dimensions = {
    DBClusterIdentifier = "${var.app_name}-${var.environment}-db"
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-db-cpu-alarm"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_cloudwatch_metric_alarm" "database_connections_high" {
  alarm_name          = "${var.app_name}-${var.environment}-db-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS connection count"
  alarm_actions       = [var.sns_topic_arn]

  dimensions = {
    DBClusterIdentifier = "${var.app_name}-${var.environment}-db"
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-db-connections-alarm"
    Environment = var.environment
    Application = var.app_name
  }
}

# Custom Metrics for Business Logic
resource "aws_cloudwatch_log_metric_filter" "error_rate_filter" {
  name           = "${var.app_name}-${var.environment}-error-rate"
  log_group_name = "/aws/ecs/${var.app_name}-${var.environment}"
  pattern        = "[timestamp, request_id, ERROR]"

  metric_transformation {
    name      = "ErrorCount"
    namespace = "${var.app_name}/${var.environment}"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "business_error_rate" {
  alarm_name          = "${var.app_name}-${var.environment}-business-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "ErrorCount"
  namespace           = "${var.app_name}/${var.environment}"
  period              = "300"
  statistic           = "Sum"
  threshold           = "5"
  alarm_description   = "This metric monitors application error rate"
  alarm_actions       = [var.sns_topic_arn]
  treat_missing_data  = "notBreaching"

  tags = {
    Name        = "${var.app_name}-${var.environment}-business-error-alarm"
    Environment = var.environment
    Application = var.app_name
  }
}

# Data sources
data "aws_region" "current" {}

data "aws_guardduty_detector" "main" {
  depends_on = [aws_guardduty_detector.main]
}

# GuardDuty detector (if not exists)
resource "aws_guardduty_detector" "main" {
  enable = true

  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = true
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-guardduty"
    Environment = var.environment
    Application = var.app_name
  }
}

# CloudFront distribution reference (assumed to exist)
data "aws_cloudfront_distribution" "main" {
  id = "${var.app_name}-${var.environment}-cloudfront"
}

# Output dashboard URLs
output "application_dashboard_url" {
  description = "URL for the application CloudWatch dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.application_dashboard.dashboard_name}"
}

output "infrastructure_dashboard_url" {
  description = "URL for the infrastructure CloudWatch dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.infrastructure_dashboard.dashboard_name}"
}

output "security_dashboard_url" {
  description = "URL for the security CloudWatch dashboard"
  value       = "https://console.aws.amazon.com/cloudwatch/home?region=${data.aws_region.current.name}#dashboards:name=${aws_cloudwatch_dashboard.security_dashboard.dashboard_name}"
}