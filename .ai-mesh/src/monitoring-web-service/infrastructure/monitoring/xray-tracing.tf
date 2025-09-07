# AWS X-Ray Tracing Configuration
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

# X-Ray Service Map
resource "aws_xray_sampling_rule" "main" {
  rule_name      = "${var.app_name}-${var.environment}-sampling"
  priority       = 9000
  version        = 1
  reservoir_size = 1
  fixed_rate     = 0.1
  url_path       = "*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "*"
  resource_arn   = "*"

  tags = {
    Name        = "${var.app_name}-${var.environment}-sampling-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

# Enhanced sampling rule for production
resource "aws_xray_sampling_rule" "production_enhanced" {
  count = var.environment == "production" ? 1 : 0

  rule_name      = "${var.app_name}-${var.environment}-enhanced-sampling"
  priority       = 1000
  version        = 1
  reservoir_size = 2
  fixed_rate     = 0.2
  url_path       = "/api/*"
  host           = "*"
  http_method    = "*"
  service_type   = "*"
  service_name   = "${var.app_name}-*"
  resource_arn   = "*"

  tags = {
    Name        = "${var.app_name}-${var.environment}-enhanced-sampling"
    Environment = var.environment
    Application = var.app_name
  }
}

# X-Ray IAM Role for ECS Tasks
resource "aws_iam_role" "xray_role" {
  name = "${var.app_name}-${var.environment}-xray-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-xray-role"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_iam_role_policy" "xray_policy" {
  name = "${var.app_name}-${var.environment}-xray-policy"
  role = aws_iam_role.xray_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries"
        ]
        Resource = "*"
      }
    ]
  })
}

# X-Ray Daemon ECS Task Definition
resource "aws_ecs_task_definition" "xray_daemon" {
  family                   = "${var.app_name}-${var.environment}-xray-daemon"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.xray_execution_role.arn
  task_role_arn           = aws_iam_role.xray_role.arn

  container_definitions = jsonencode([
    {
      name      = "xray-daemon"
      image     = "public.ecr.aws/xray/aws-xray-daemon:latest"
      essential = true
      
      portMappings = [
        {
          containerPort = 2000
          protocol      = "udp"
          hostPort      = 2000
        }
      ]
      
      environment = [
        {
          name  = "AWS_REGION"
          value = data.aws_region.current.name
        }
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/aws/ecs/${var.app_name}-${var.environment}-xray"
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "xray-daemon"
          "awslogs-create-group"  = "true"
        }
      }

      healthCheck = {
        command = [
          "CMD-SHELL",
          "timeout 1s bash -c '</dev/tcp/localhost/2000' && echo 'healthy' || echo 'unhealthy'"
        ]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }

      resources = {
        limits = {
          memory = 512
        }
        reservations = {
          memory = 256
        }
      }
    }
  ])

  tags = {
    Name        = "${var.app_name}-${var.environment}-xray-daemon"
    Environment = var.environment
    Application = var.app_name
  }
}

# X-Ray Daemon ECS Service
resource "aws_ecs_service" "xray_daemon" {
  name            = "${var.app_name}-${var.environment}-xray-daemon"
  cluster         = data.aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.xray_daemon.arn
  desired_count   = var.environment == "production" ? 2 : 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = data.aws_subnets.private.ids
    security_groups  = [aws_security_group.xray_daemon.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.xray_daemon.arn
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-xray-daemon-service"
    Environment = var.environment
    Application = var.app_name
  }

  depends_on = [
    aws_iam_role_policy.xray_policy
  ]
}

# Security Group for X-Ray Daemon
resource "aws_security_group" "xray_daemon" {
  name_prefix = "${var.app_name}-${var.environment}-xray-"
  vpc_id      = data.aws_vpc.main.id

  ingress {
    from_port   = 2000
    to_port     = 2000
    protocol    = "udp"
    cidr_blocks = [data.aws_vpc.main.cidr_block]
    description = "X-Ray daemon UDP port"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "All outbound traffic"
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-xray-daemon-sg"
    Environment = var.environment
    Application = var.app_name
  }
}

# Service Discovery for X-Ray Daemon
resource "aws_service_discovery_service" "xray_daemon" {
  name = "xray-daemon"

  dns_config {
    namespace_id = data.aws_service_discovery_dns_namespace.main.id

    dns_records {
      ttl  = 60
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_grace_period_seconds = 30

  tags = {
    Name        = "${var.app_name}-${var.environment}-xray-daemon-discovery"
    Environment = var.environment
    Application = var.app_name
  }
}

# IAM Role for X-Ray Daemon Execution
resource "aws_iam_role" "xray_execution_role" {
  name = "${var.app_name}-${var.environment}-xray-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-xray-execution-role"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_iam_role_policy_attachment" "xray_execution_policy" {
  role       = aws_iam_role.xray_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Application Load Balancer X-Ray Configuration
resource "aws_lb_listener_rule" "xray_tracing" {
  listener_arn = data.aws_lb_listener.main.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = data.aws_lb_target_group.main.arn

    # Enable X-Ray tracing
    forward {
      target_group {
        arn    = data.aws_lb_target_group.main.arn
        weight = 100
      }
      
      stickiness {
        enabled  = false
        duration = 1
      }
    }
  }

  condition {
    path_pattern {
      values = ["/*"]
    }
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-xray-listener-rule"
    Environment = var.environment
    Application = var.app_name
  }
}

# CloudWatch Insights Queries for X-Ray Analysis
resource "aws_cloudwatch_query_definition" "xray_error_analysis" {
  name = "${var.app_name}-${var.environment}-xray-error-analysis"

  log_group_names = [
    "/aws/ecs/${var.app_name}-${var.environment}",
    "/aws/ecs/${var.app_name}-${var.environment}-xray"
  ]

  query_string = <<-EOT
    fields @timestamp, @message
    | filter @message like /ERROR/
    | filter @message like /trace_id/
    | parse @message "trace_id=*" as trace_id
    | stats count() by trace_id
    | sort count desc
    | limit 20
  EOT
}

resource "aws_cloudwatch_query_definition" "xray_performance_analysis" {
  name = "${var.app_name}-${var.environment}-xray-performance"

  log_group_names = [
    "/aws/ecs/${var.app_name}-${var.environment}"
  ]

  query_string = <<-EOT
    fields @timestamp, @message, @duration
    | filter @message like /response_time/
    | parse @message "response_time=* trace_id=*" as response_time, trace_id
    | filter response_time > 1000
    | stats avg(response_time), max(response_time), count() by trace_id
    | sort avg desc
    | limit 50
  EOT
}

# X-Ray Service Map Integration with API Gateway
resource "aws_api_gateway_stage" "xray_enabled" {
  count         = var.environment == "production" ? 1 : 0
  deployment_id = data.aws_api_gateway_deployment.main.id
  rest_api_id   = data.aws_api_gateway_rest_api.main.id
  stage_name    = var.environment

  xray_tracing_enabled = true

  tags = {
    Name        = "${var.app_name}-${var.environment}-api-stage"
    Environment = var.environment
    Application = var.app_name
  }
}

# Lambda Function X-Ray Configuration (if applicable)
resource "aws_lambda_function" "xray_processor" {
  count = length(data.aws_lambda_function.processor) > 0 ? 1 : 0

  filename         = "xray-processor.zip"
  function_name    = "${var.app_name}-${var.environment}-xray-processor"
  role            = aws_iam_role.xray_lambda_role[0].arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.xray_processor[0].output_base64sha256
  runtime         = "nodejs18.x"
  timeout         = 30

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      ENVIRONMENT     = var.environment
      APP_NAME        = var.app_name
      XRAY_DAEMON_URL = "http://xray-daemon.${data.aws_service_discovery_dns_namespace.main.name}:2000"
    }
  }

  tags = {
    Name        = "${var.app_name}-${var.environment}-xray-processor"
    Environment = var.environment
    Application = var.app_name
  }
}

# Lambda IAM Role for X-Ray
resource "aws_iam_role" "xray_lambda_role" {
  count = length(data.aws_lambda_function.processor) > 0 ? 1 : 0
  name  = "${var.app_name}-${var.environment}-xray-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.app_name}-${var.environment}-xray-lambda-role"
    Environment = var.environment
    Application = var.app_name
  }
}

resource "aws_iam_role_policy_attachment" "xray_lambda_basic" {
  count      = length(aws_lambda_function.xray_processor)
  role       = aws_iam_role.xray_lambda_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy_attachment" "xray_lambda_tracing" {
  count      = length(aws_lambda_function.xray_processor)
  role       = aws_iam_role.xray_lambda_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
}

# Archive for Lambda function
data "archive_file" "xray_processor" {
  count       = length(data.aws_lambda_function.processor) > 0 ? 1 : 0
  type        = "zip"
  output_path = "xray-processor.zip"
  
  source {
    content = <<-EOT
      const AWSXRay = require('aws-xray-sdk-core');
      const AWS = AWSXRay.captureAWS(require('aws-sdk'));

      exports.handler = async (event) => {
          const segment = AWSXRay.getSegment();
          const subsegment = segment.addNewSubsegment('xray-processor');
          
          try {
              // Process X-Ray traces
              console.log('Processing X-Ray trace data:', JSON.stringify(event));
              
              // Add metadata
              subsegment.addMetadata('event', event);
              subsegment.addMetadata('environment', process.env.ENVIRONMENT);
              
              // Simulate processing
              await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
              
              subsegment.close();
              
              return {
                  statusCode: 200,
                  body: JSON.stringify({
                      message: 'X-Ray trace processed successfully',
                      traceId: segment.trace_id
                  })
              };
          } catch (error) {
              subsegment.addError(error);
              subsegment.close();
              throw error;
          }
      };
    EOT
    filename = "index.js"
  }
}

# Data sources
data "aws_region" "current" {}

data "aws_vpc" "main" {
  tags = {
    Name = "${var.app_name}-${var.environment}-vpc"
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  tags = {
    Type = "Private"
  }
}

data "aws_ecs_cluster" "main" {
  cluster_name = "${var.app_name}-cluster"
}

data "aws_service_discovery_dns_namespace" "main" {
  name = "${var.app_name}-${var.environment}.local"
  type = "DNS_PRIVATE"
}

data "aws_lb_listener" "main" {
  load_balancer_arn = data.aws_lb.main.arn
  port              = 80
}

data "aws_lb" "main" {
  name = "${var.app_name}-alb"
}

data "aws_lb_target_group" "main" {
  name = "${var.app_name}-${var.environment}-tg"
}

data "aws_api_gateway_rest_api" "main" {
  name = "${var.app_name}-${var.environment}-api"
}

data "aws_api_gateway_deployment" "main" {
  rest_api_id = data.aws_api_gateway_rest_api.main.id
  stage_name  = var.environment
}

data "aws_lambda_function" "processor" {
  function_name = "${var.app_name}-${var.environment}-processor"
}

# Outputs
output "xray_daemon_service_name" {
  description = "Name of the X-Ray daemon ECS service"
  value       = aws_ecs_service.xray_daemon.name
}

output "xray_sampling_rule_name" {
  description = "Name of the X-Ray sampling rule"
  value       = aws_xray_sampling_rule.main.rule_name
}

output "xray_service_map_url" {
  description = "URL for the X-Ray service map"
  value       = "https://console.aws.amazon.com/xray/home?region=${data.aws_region.current.name}#/service-map"
}

output "xray_traces_url" {
  description = "URL for the X-Ray traces"
  value       = "https://console.aws.amazon.com/xray/home?region=${data.aws_region.current.name}#/traces"
}