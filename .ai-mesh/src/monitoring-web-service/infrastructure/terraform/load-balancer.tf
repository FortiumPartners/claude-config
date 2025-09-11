# Application Load Balancer Configuration for External Metrics Web Service

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets           = module.vpc.public_subnets

  enable_deletion_protection       = var.enable_deletion_protection
  enable_cross_zone_load_balancing = true
  enable_http2                    = true
  
  # Associate WAF if enabled
  dynamic "web_acl_id" {
    for_each = var.enable_waf ? [aws_wafv2_web_acl.main[0].arn] : []
    content {
      web_acl_id = web_acl_id.value
    }
  }

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb-access-logs"
    enabled = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb"
  })
}

# S3 bucket for ALB access logs
resource "aws_s3_bucket" "alb_logs" {
  bucket = "${local.name_prefix}-alb-logs-${random_id.alb_logs_suffix.hex}"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-logs"
  })
}

resource "random_id" "alb_logs_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    id     = "delete_old_logs"
    status = "Enabled"

    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_elb_service_account.main.id}:root"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/alb-access-logs/*"
      },
      {
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/alb-access-logs/*"
        Condition = {
          StringEquals = {
            "s3:x-amz-acl" = "bucket-owner-full-control"
          }
        }
      },
      {
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.alb_logs.arn
      }
    ]
  })
}

# Get ALB service account for the region
data "aws_elb_service_account" "main" {}

# Target group for the application
resource "aws_lb_target_group" "app" {
  name        = "${local.name_prefix}-app-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = module.vpc.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    timeout             = 10
    interval            = 30
    path                = "/api/health"
    matcher             = "200"
    port                = "traffic-port"
    protocol            = "HTTP"
  }

  # Enable stickiness for consistent user experience
  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400 # 1 day
    enabled         = true
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-tg"
  })
}

# HTTPS Listener (primary)
resource "aws_lb_listener" "https" {
  count             = var.ssl_certificate_arn != null ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"
  certificate_arn   = var.ssl_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  tags = local.common_tags
}

# HTTP Listener (redirect to HTTPS if certificate is available, otherwise forward)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = var.ssl_certificate_arn != null ? "redirect" : "forward"
    
    dynamic "redirect" {
      for_each = var.ssl_certificate_arn != null ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
    
    dynamic "forward" {
      for_each = var.ssl_certificate_arn == null ? [1] : []
      content {
        target_group {
          arn = aws_lb_target_group.app.arn
        }
      }
    }
  }

  tags = local.common_tags
}

# Route 53 DNS record (if domain is provided)
data "aws_route53_zone" "main" {
  count = var.domain_name != null ? 1 : 0
  name  = var.domain_name
}

resource "aws_route53_record" "app" {
  count   = var.domain_name != null ? 1 : 0
  zone_id = data.aws_route53_zone.main[0].zone_id
  name    = "metrics.${var.domain_name}"
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Additional listener rules for API versioning
resource "aws_lb_listener_rule" "api_v1" {
  listener_arn = var.ssl_certificate_arn != null ? aws_lb_listener.https[0].arn : aws_lb_listener.http.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  condition {
    path_pattern {
      values = ["/api/v1/*"]
    }
  }

  condition {
    http_request_method {
      values = ["GET", "POST", "PUT", "DELETE", "PATCH"]
    }
  }

  tags = local.common_tags
}

# Health check endpoint rule (higher priority)
resource "aws_lb_listener_rule" "health_check" {
  listener_arn = var.ssl_certificate_arn != null ? aws_lb_listener.https[0].arn : aws_lb_listener.http.arn
  priority     = 50

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  condition {
    path_pattern {
      values = ["/api/health", "/health", "/healthz"]
    }
  }

  tags = local.common_tags
}

# Static assets rule (if serving static content)
resource "aws_lb_listener_rule" "static_assets" {
  listener_arn = var.ssl_certificate_arn != null ? aws_lb_listener.https[0].arn : aws_lb_listener.http.arn
  priority     = 200

  action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Static assets should be served from CDN"
      status_code  = "404"
    }
  }

  condition {
    path_pattern {
      values = ["/static/*", "/assets/*", "*.js", "*.css", "*.png", "*.jpg", "*.ico"]
    }
  }

  tags = local.common_tags
}

# Maintenance page rule (can be activated during deployments)
resource "aws_lb_listener_rule" "maintenance" {
  count        = 0 # Set to 1 to enable maintenance mode
  listener_arn = var.ssl_certificate_arn != null ? aws_lb_listener.https[0].arn : aws_lb_listener.http.arn
  priority     = 10 # Highest priority

  action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/html"
      message_body = <<-EOT
        <!DOCTYPE html>
        <html>
        <head>
            <title>Maintenance - External Metrics Web Service</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; margin-top: 100px; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                h1 { color: #333; }
                p { color: #666; line-height: 1.6; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🔧 Maintenance in Progress</h1>
                <p>The External Metrics Web Service is currently undergoing scheduled maintenance to improve performance and add new features.</p>
                <p>We expect to be back online shortly. Thank you for your patience.</p>
                <p>For urgent issues, please contact our support team at <a href="mailto:engineering@fortium.dev">engineering@fortium.dev</a></p>
            </div>
        </body>
        </html>
      EOT
      status_code  = "503"
    }
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  tags = local.common_tags
}