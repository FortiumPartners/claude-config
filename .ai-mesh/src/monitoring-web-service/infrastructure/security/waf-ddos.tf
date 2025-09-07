# WAF and DDoS Protection Configuration
# Task 3.2: Network security and segmentation - WAF and DDoS protection

# Advanced WAF configuration with comprehensive rule sets
resource "aws_wafv2_web_acl" "advanced" {
  name  = "${local.name_prefix}-advanced-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate limiting rule - primary DDoS protection
  rule {
    name     = "RateLimitingRule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"

        scope_down_statement {
          not_statement {
            statement {
              byte_match_statement {
                search_string = "health"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "LOWERCASE"
                }
                positional_constraint = "CONTAINS"
              }
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "RateLimitingRule"
      sampled_requests_enabled    = true
    }
  }

  # Geographic blocking rule
  rule {
    name     = "GeoBlockingRule"
    priority = 2

    action {
      block {}
    }

    statement {
      geo_match_statement {
        country_codes = var.blocked_countries
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "GeoBlockingRule"
      sampled_requests_enabled    = true
    }
  }

  # IP reputation rule
  rule {
    name     = "AmazonIpReputationList"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "AmazonIpReputationList"
      sampled_requests_enabled    = true
    }
  }

  # Known bad inputs rule
  rule {
    name     = "KnownBadInputsRule"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "KnownBadInputsRule"
      sampled_requests_enabled    = true
    }
  }

  # Core rule set
  rule {
    name     = "CoreRuleSet"
    priority = 5

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        # Exclude specific rules that might cause false positives
        excluded_rule {
          name = "SizeRestrictions_BODY"
        }

        excluded_rule {
          name = "GenericRFI_BODY"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "CoreRuleSet"
      sampled_requests_enabled    = true
    }
  }

  # SQL injection protection
  rule {
    name     = "SqlInjectionRule"
    priority = 6

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "SqlInjectionRule"
      sampled_requests_enabled    = true
    }
  }

  # Linux operating system rule set
  rule {
    name     = "LinuxRuleSet"
    priority = 7

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesLinuxRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "LinuxRuleSet"
      sampled_requests_enabled    = true
    }
  }

  # Custom application-specific rules
  rule {
    name     = "CustomApplicationRules"
    priority = 10

    action {
      block {}
    }

    statement {
      or_statement {
        statement {
          # Block requests with suspicious user agents
          byte_match_statement {
            search_string = "sqlmap"
            field_to_match {
              single_header {
                name = "user-agent"
              }
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "CONTAINS"
          }
        }

        statement {
          # Block requests with SQL injection patterns in query strings
          sqli_match_statement {
            field_to_match {
              query_string {}
            }
            text_transformation {
              priority = 1
              type     = "URL_DECODE"
            }
            text_transformation {
              priority = 2
              type     = "HTML_ENTITY_DECODE"
            }
          }
        }

        statement {
          # Block requests with XSS patterns
          xss_match_statement {
            field_to_match {
              body {}
            }
            text_transformation {
              priority = 1
              type     = "URL_DECODE"
            }
            text_transformation {
              priority = 2
              type     = "HTML_ENTITY_DECODE"
            }
          }
        }

        statement {
          # Block requests with oversized bodies
          size_constraint_statement {
            field_to_match {
              body {}
            }
            comparison_operator = "GT"
            size                = 8192
            text_transformation {
              priority = 0
              type     = "NONE"
            }
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "CustomApplicationRules"
      sampled_requests_enabled    = true
    }
  }

  # Allow specific IP addresses (admin access)
  rule {
    name     = "AllowAdminIPs"
    priority = 0

    action {
      allow {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.admin_ips.arn
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "AllowAdminIPs"
      sampled_requests_enabled    = true
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-advanced-waf"
    Type = "security"
  })

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                 = "${local.name_prefix}-waf"
    sampled_requests_enabled    = true
  }
}

# IP set for admin access
resource "aws_wafv2_ip_set" "admin_ips" {
  name  = "${local.name_prefix}-admin-ips"
  scope = "REGIONAL"

  ip_address_version = "IPV4"
  addresses          = var.admin_ip_addresses

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-admin-ip-set"
    Type = "security"
  })
}

# Custom rule group for application-specific protections
resource "aws_wafv2_rule_group" "custom_app_protection" {
  name     = "${local.name_prefix}-app-protection"
  scope    = "REGIONAL"
  capacity = 100

  rule {
    name     = "BlockSuspiciousEndpoints"
    priority = 1

    action {
      block {}
    }

    statement {
      or_statement {
        statement {
          byte_match_statement {
            search_string = "/admin"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "STARTS_WITH"
          }
        }

        statement {
          byte_match_statement {
            search_string = "/.env"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "CONTAINS"
          }
        }

        statement {
          byte_match_statement {
            search_string = "/config"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "CONTAINS"
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "BlockSuspiciousEndpoints"
      sampled_requests_enabled    = true
    }
  }

  rule {
    name     = "RateLimitingPerPath"
    priority = 2

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 200
        aggregate_key_type = "IP"

        scope_down_statement {
          byte_match_statement {
            search_string = "/api"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "STARTS_WITH"
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "RateLimitingPerPath"
      sampled_requests_enabled    = true
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-protection-rule-group"
    Type = "security"
  })

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                 = "${local.name_prefix}-app-protection"
    sampled_requests_enabled    = true
  }
}

# Associate WAF with Application Load Balancer
resource "aws_wafv2_web_acl_association" "main" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.advanced.arn
}

# CloudFront distribution with DDoS protection
resource "aws_cloudfront_distribution" "main" {
  count = var.enable_cloudfront ? 1 : 0

  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "${local.name_prefix}-alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    # Custom headers for origin verification
    custom_header {
      name  = "X-Origin-Verify"
      value = var.cloudfront_origin_verify_header
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "Distribution for ${local.name_prefix} with DDoS protection"
  default_root_object = "index.html"

  # Logging configuration
  logging_config {
    include_cookies = false
    bucket          = aws_s3_bucket.cloudfront_logs[0].domain_name
    prefix          = "cloudfront-logs/"
  }

  # Geographic restrictions
  restrictions {
    geo_restriction {
      restriction_type = length(var.allowed_countries) > 0 ? "whitelist" : "none"
      locations        = var.allowed_countries
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "${local.name_prefix}-alb"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "CloudFront-Forwarded-Proto"]

      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400

    # Security headers
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers[0].id

    # Real-time logs
    realtime_log_config_arn = aws_cloudfront_realtime_log_config.main[0].arn
  }

  # Cache behavior for API endpoints
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "${local.name_prefix}-alb"

    forwarded_values {
      query_string = true
      headers      = ["*"]

      cookies {
        forward = "all"
      }
    }

    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
    viewer_protocol_policy = "https-only"

    # Real-time logs for API
    realtime_log_config_arn = aws_cloudfront_realtime_log_config.main[0].arn
  }

  # Cache behavior for static assets
  ordered_cache_behavior {
    path_pattern     = "/static/*"
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "${local.name_prefix}-alb"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000
    compress               = true
    viewer_protocol_policy = "redirect-to-https"
  }

  # Price class for cost optimization
  price_class = var.cloudfront_price_class

  # TLS configuration
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.cloudfront[0].arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  aliases = [var.cloudfront_domain_name]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cloudfront"
    Type = "cdn"
  })
}

# Response headers policy for security
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  count = var.enable_cloudfront ? 1 : 0

  name = "${local.name_prefix}-security-headers"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = false
    }

    content_type_options {
      override = false
    }

    frame_options {
      frame_option = "DENY"
      override     = false
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = false
    }
  }

  custom_headers_config {
    items {
      header   = "X-Security-Scanner"
      value    = "infrastructure-subagent"
      override = false
    }

    items {
      header   = "X-Content-Security-Policy"
      value    = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
      override = false
    }
  }

  cors_config {
    access_control_allow_credentials = false

    access_control_allow_headers {
      items = ["Authorization", "Content-Type", "X-Requested-With"]
    }

    access_control_allow_methods {
      items = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    }

    access_control_allow_origins {
      items = var.cors_allowed_origins
    }

    access_control_max_age_sec = 3600
    origin_override            = true
  }
}

# Real-time logs for CloudFront
resource "aws_cloudfront_realtime_log_config" "main" {
  count = var.enable_cloudfront ? 1 : 0

  name          = "${local.name_prefix}-realtime-logs"
  endpoint_id   = aws_kinesis_data_stream.cloudfront_logs[0].name
  sampling_rate = var.cloudfront_realtime_log_sampling_rate

  fields = [
    "timestamp",
    "c-ip",
    "sc-status",
    "cs-method",
    "cs-uri-stem",
    "cs-uri-query",
    "cs-user-agent",
    "cs-referer",
    "sc-bytes",
    "time-taken"
  ]
}

# Kinesis data stream for real-time logs
resource "aws_kinesis_data_stream" "cloudfront_logs" {
  count = var.enable_cloudfront ? 1 : 0

  name             = "${local.name_prefix}-cloudfront-logs"
  shard_count      = 1
  retention_period = 24

  encryption_type = "KMS"
  kms_key_id      = aws_kms_key.kinesis[0].arn

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cloudfront-logs"
    Type = "streaming"
  })
}

# KMS key for Kinesis encryption
resource "aws_kms_key" "kinesis" {
  count = var.enable_cloudfront ? 1 : 0

  description             = "KMS key for Kinesis encryption"
  deletion_window_in_days = var.environment == "production" ? 30 : 7
  enable_key_rotation     = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-kinesis-kms-key"
    Type = "encryption"
  })
}

resource "aws_kms_alias" "kinesis" {
  count = var.enable_cloudfront ? 1 : 0

  name          = "alias/${local.name_prefix}-kinesis"
  target_key_id = aws_kms_key.kinesis[0].key_id
}

# S3 bucket for CloudFront access logs
resource "aws_s3_bucket" "cloudfront_logs" {
  count = var.enable_cloudfront ? 1 : 0

  bucket = "${local.name_prefix}-cloudfront-logs-${random_id.bucket_suffix[0].hex}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cloudfront-logs"
    Type = "logging"
  })
}

resource "aws_s3_bucket_versioning" "cloudfront_logs" {
  count = var.enable_cloudfront ? 1 : 0

  bucket = aws_s3_bucket.cloudfront_logs[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "cloudfront_logs" {
  count = var.enable_cloudfront ? 1 : 0

  bucket = aws_s3_bucket.cloudfront_logs[0].id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.logs.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "cloudfront_logs" {
  count = var.enable_cloudfront ? 1 : 0

  bucket = aws_s3_bucket.cloudfront_logs[0].id

  rule {
    id     = "log_lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 2555  # 7 years
    }
  }
}

# Random ID for unique bucket naming
resource "random_id" "bucket_suffix" {
  count = var.enable_cloudfront ? 1 : 0

  byte_length = 4
}

# ACM certificate for CloudFront
resource "aws_acm_certificate" "cloudfront" {
  count = var.enable_cloudfront ? 1 : 0

  domain_name       = var.cloudfront_domain_name
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.cloudfront_domain_name}"
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cloudfront-cert"
    Type = "security"
  })
}

# Shield Advanced subscription for enhanced DDoS protection
resource "aws_shield_protection" "cloudfront" {
  count = var.enable_shield_advanced && var.enable_cloudfront ? 1 : 0

  name         = "${local.name_prefix}-cloudfront-shield"
  resource_arn = aws_cloudfront_distribution.main[0].arn

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-cloudfront-shield"
    Type = "security"
  })
}

resource "aws_shield_protection" "alb" {
  count = var.enable_shield_advanced ? 1 : 0

  name         = "${local.name_prefix}-alb-shield"
  resource_arn = aws_lb.main.arn

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-shield"
    Type = "security"
  })
}

# CloudWatch alarms for DDoS detection
resource "aws_cloudwatch_metric_alarm" "ddos_attack" {
  alarm_name          = "${local.name_prefix}-ddos-attack"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DDoSDetected"
  namespace           = "AWS/DDoSProtection"
  period              = "60"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors for DDoS attacks"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    ResourceArn = aws_lb.main.arn
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ddos-alarm"
    Type = "monitoring"
  })
}

# CloudWatch alarm for high request rate
resource "aws_cloudwatch_metric_alarm" "high_request_rate" {
  alarm_name          = "${local.name_prefix}-high-request-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "RequestCount"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Sum"
  threshold           = "10000"
  alarm_description   = "This metric monitors for unusually high request rates"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-high-request-rate-alarm"
    Type = "monitoring"
  })
}

# WAF logging configuration
resource "aws_wafv2_web_acl_logging_configuration" "main" {
  resource_arn            = aws_wafv2_web_acl.advanced.arn
  log_destination_configs = [aws_cloudwatch_log_group.waf.arn]

  redacted_fields {
    single_header {
      name = "authorization"
    }
  }

  redacted_fields {
    single_header {
      name = "cookie"
    }
  }
}

# CloudWatch log group for WAF logs
resource "aws_cloudwatch_log_group" "waf" {
  name              = "/aws/wafv2/${local.name_prefix}"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.logs.arn

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-waf-logs"
    Type = "logging"
  })
}

# Output values
output "waf_arn" {
  description = "ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.advanced.arn
}

output "waf_id" {
  description = "ID of the WAF Web ACL"
  value       = aws_wafv2_web_acl.advanced.id
}

output "cloudfront_domain_name" {
  description = "Domain name of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].domain_name : null
}

output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = var.enable_cloudfront ? aws_cloudfront_distribution.main[0].id : null
}

output "shield_protection_ids" {
  description = "IDs of Shield protections"
  value = {
    alb        = var.enable_shield_advanced ? aws_shield_protection.alb[0].id : null
    cloudfront = var.enable_shield_advanced && var.enable_cloudfront ? aws_shield_protection.cloudfront[0].id : null
  }
}