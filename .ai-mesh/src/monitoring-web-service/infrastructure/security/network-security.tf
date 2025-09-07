# Network Security and Segmentation Configuration
# Task 3.2: Network security and segmentation

# Enhanced VPC configuration with security best practices
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  # Enhanced VPC features for security
  instance_tenancy                 = "default"
  assign_generated_ipv6_cidr_block = false
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
    Tier = "networking"
    SecurityLevel = "high"
  })
}

# Internet Gateway with controlled routing
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-igw"
    Tier = "networking"
  })
}

# Private subnets with enhanced security
resource "aws_subnet" "private" {
  count = length(var.availability_zones)
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 100)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false
  
  # Enhanced subnet features
  assign_ipv6_address_on_creation = false
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-${count.index + 1}"
    Type = "Private"
    Tier = "application"
    kubernetes.io/role/internal-elb = "1"
    kubernetes.io/cluster/${local.name_prefix}-eks = "owned"
  })
}

# Public subnets with minimal exposure
resource "aws_subnet" "public" {
  count = length(var.availability_zones)
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false  # Explicit control of public IPs
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-${count.index + 1}"
    Type = "Public"
    Tier = "web"
    kubernetes.io/role/elb = "1"
    kubernetes.io/cluster/${local.name_prefix}-eks = "owned"
  })
}

# Database subnets for data tier isolation
resource "aws_subnet" "database" {
  count = length(var.availability_zones)
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 200)
  availability_zone = var.availability_zones[count.index]
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-database-${count.index + 1}"
    Type = "Database"
    Tier = "data"
  })
}

# NAT Gateway for private subnet outbound access
resource "aws_eip" "nat" {
  count = var.enable_nat_gateway ? length(var.availability_zones) : 0
  
  domain = "vpc"
  
  depends_on = [aws_internet_gateway.main]
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-eip-${count.index + 1}"
    Type = "NAT"
  })
}

resource "aws_nat_gateway" "main" {
  count = var.enable_nat_gateway ? length(var.availability_zones) : 0
  
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-nat-${count.index + 1}"
    Type = "NAT"
  })
  
  depends_on = [aws_internet_gateway.main]
}

# Network ACLs for subnet-level security
resource "aws_network_acl" "public" {
  vpc_id = aws_vpc.main.id
  
  subnet_ids = aws_subnet.public[*].id
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-nacl"
    Tier = "web"
  })
}

# Public network ACL rules
resource "aws_network_acl_rule" "public_inbound_http" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 100
  protocol       = "tcp"
  rule_action    = "allow"
  from_port      = 80
  to_port        = 80
  cidr_block     = "0.0.0.0/0"
}

resource "aws_network_acl_rule" "public_inbound_https" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 110
  protocol       = "tcp"
  rule_action    = "allow"
  from_port      = 443
  to_port        = 443
  cidr_block     = "0.0.0.0/0"
}

resource "aws_network_acl_rule" "public_inbound_ssh" {
  count = var.environment == "production" ? 0 : 1
  
  network_acl_id = aws_network_acl.public.id
  rule_number    = 120
  protocol       = "tcp"
  rule_action    = "allow"
  from_port      = 22
  to_port        = 22
  cidr_block     = var.admin_cidr_blocks[0]  # Restrict to admin networks
}

resource "aws_network_acl_rule" "public_inbound_ephemeral" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 130
  protocol       = "tcp"
  rule_action    = "allow"
  from_port      = 1024
  to_port        = 65535
  cidr_block     = "0.0.0.0/0"
}

resource "aws_network_acl_rule" "public_outbound_all" {
  network_acl_id = aws_network_acl.public.id
  rule_number    = 100
  protocol       = "-1"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
}

# Private network ACL
resource "aws_network_acl" "private" {
  vpc_id = aws_vpc.main.id
  
  subnet_ids = aws_subnet.private[*].id
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-nacl"
    Tier = "application"
  })
}

# Private network ACL rules
resource "aws_network_acl_rule" "private_inbound_vpc" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 100
  protocol       = "-1"
  rule_action    = "allow"
  cidr_block     = var.vpc_cidr
}

resource "aws_network_acl_rule" "private_inbound_ephemeral" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 110
  protocol       = "tcp"
  rule_action    = "allow"
  from_port      = 1024
  to_port        = 65535
  cidr_block     = "0.0.0.0/0"
}

resource "aws_network_acl_rule" "private_outbound_all" {
  network_acl_id = aws_network_acl.private.id
  rule_number    = 100
  protocol       = "-1"
  rule_action    = "allow"
  cidr_block     = "0.0.0.0/0"
}

# Database network ACL
resource "aws_network_acl" "database" {
  vpc_id = aws_vpc.main.id
  
  subnet_ids = aws_subnet.database[*].id
  
  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-database-nacl"
    Tier = "data"
  })
}

# Database network ACL rules - most restrictive
resource "aws_network_acl_rule" "database_inbound_app" {
  network_acl_id = aws_network_acl.database.id
  rule_number    = 100
  protocol       = "tcp"
  rule_action    = "allow"
  from_port      = 5432
  to_port        = 5432
  cidr_block     = join(",", aws_subnet.private[*].cidr_block)
}

resource "aws_network_acl_rule" "database_inbound_redis" {
  network_acl_id = aws_network_acl.database.id
  rule_number    = 110
  protocol       = "tcp"
  rule_action    = "allow"
  from_port      = 6379
  to_port        = 6379
  cidr_block     = join(",", aws_subnet.private[*].cidr_block)
}

resource "aws_network_acl_rule" "database_outbound_ephemeral" {
  network_acl_id = aws_network_acl.database.id
  rule_number    = 100
  protocol       = "tcp"
  rule_action    = "allow"
  from_port      = 1024
  to_port        = 65535
  cidr_block     = "0.0.0.0/0"
}

# Enhanced Security Groups with least privilege
resource "aws_security_group" "alb" {
  name_prefix = "${local.name_prefix}-alb-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for Application Load Balancer - Web tier"

  ingress {
    description = "HTTP from internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description     = "To application tier"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  egress {
    description     = "To application tier HTTPS"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-alb-sg"
    Tier = "web"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Application tier security group
resource "aws_security_group" "app" {
  name_prefix = "${local.name_prefix}-app-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for application servers"

  ingress {
    description     = "HTTP from ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "HTTPS from ALB"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Application port from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # SSH access only for non-production environments
  dynamic "ingress" {
    for_each = var.environment == "production" ? [] : [1]
    content {
      description = "SSH from bastion"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      security_groups = [aws_security_group.bastion.id]
    }
  }

  egress {
    description     = "To database tier PostgreSQL"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.rds.id]
  }

  egress {
    description     = "To cache tier Redis"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.redis.id]
  }

  egress {
    description = "HTTPS to internet for external APIs"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS to VPC resolver"
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-app-sg"
    Tier = "application"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Database security group with strict access controls
resource "aws_security_group" "rds" {
  name_prefix = "${local.name_prefix}-rds-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for RDS PostgreSQL - Data tier"

  ingress {
    description     = "PostgreSQL from application tier"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  # Management access for non-production environments
  dynamic "ingress" {
    for_each = var.environment == "production" ? [] : [1]
    content {
      description     = "PostgreSQL from bastion for management"
      from_port       = 5432
      to_port         = 5432
      protocol        = "tcp"
      security_groups = [aws_security_group.bastion.id]
    }
  }

  # No egress rules - databases don't need outbound access

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-rds-sg"
    Tier = "data"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Redis security group
resource "aws_security_group" "redis" {
  name_prefix = "${local.name_prefix}-redis-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for ElastiCache Redis"

  ingress {
    description     = "Redis from application tier"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-redis-sg"
    Tier = "cache"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Bastion host security group for secure access
resource "aws_security_group" "bastion" {
  count = var.environment == "production" ? 0 : 1
  
  name_prefix = "${local.name_prefix}-bastion-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for bastion host"

  ingress {
    description = "SSH from admin networks"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.admin_cidr_blocks
  }

  egress {
    description = "SSH to private subnets"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = aws_subnet.private[*].cidr_block
  }

  egress {
    description = "Database access for management"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = aws_subnet.database[*].cidr_block
  }

  egress {
    description = "HTTPS for package updates"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "DNS"
    from_port   = 53
    to_port     = 53
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-bastion-sg"
    Tier = "management"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# EKS cluster security group
resource "aws_security_group" "eks_cluster" {
  name_prefix = "${local.name_prefix}-eks-cluster-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for EKS cluster control plane"

  ingress {
    description = "HTTPS from worker nodes"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-cluster-sg"
    Type = "kubernetes"
    Tier = "control-plane"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# EKS worker nodes security group
resource "aws_security_group" "eks_nodes" {
  name_prefix = "${local.name_prefix}-eks-nodes-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for EKS worker nodes"

  ingress {
    description = "All traffic from cluster control plane"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    security_groups = [aws_security_group.eks_cluster.id]
  }

  ingress {
    description = "All traffic from other nodes"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  ingress {
    description = "NodePort services from ALB"
    from_port   = 30000
    to_port     = 32767
    protocol    = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-eks-nodes-sg"
    Type = "kubernetes"
    Tier = "worker-nodes"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Route tables with security-focused routing
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-rt"
    Type = "public"
  })
}

resource "aws_route_table" "private" {
  count = length(aws_subnet.private)
  
  vpc_id = aws_vpc.main.id

  dynamic "route" {
    for_each = var.enable_nat_gateway ? [1] : []
    content {
      cidr_block     = "0.0.0.0/0"
      nat_gateway_id = aws_nat_gateway.main[count.index].id
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-private-rt-${count.index + 1}"
    Type = "private"
  })
}

resource "aws_route_table" "database" {
  vpc_id = aws_vpc.main.id

  # No internet access for database subnets

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-database-rt"
    Type = "database"
  })
}

# Route table associations
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)
  
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)
  
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}

resource "aws_route_table_association" "database" {
  count = length(aws_subnet.database)
  
  subnet_id      = aws_subnet.database[count.index].id
  route_table_id = aws_route_table.database.id
}

# VPC Flow Logs for network monitoring
resource "aws_flow_log" "vpc" {
  iam_role_arn    = aws_iam_role.flow_log.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_log.arn
  traffic_type    = "ALL"
  vpc_id          = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc-flow-log"
    Type = "security-monitoring"
  })
}

resource "aws_cloudwatch_log_group" "vpc_flow_log" {
  name              = "/aws/vpc/${local.name_prefix}/flowlogs"
  retention_in_days = var.log_retention_days

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc-flow-log-group"
    Type = "monitoring"
  })

  kms_key_id = aws_kms_key.logs.arn
}

# IAM role for VPC Flow Logs
resource "aws_iam_role" "flow_log" {
  name = "${local.name_prefix}-flow-log-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "flow_log" {
  name = "${local.name_prefix}-flow-log-policy"
  role = aws_iam_role.flow_log.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# VPC Endpoints for secure AWS service access
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${data.aws_region.current.name}.s3"
  
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat([aws_route_table.public.id], aws_route_table.private[*].id)

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-s3-endpoint"
    Type = "vpc-endpoint"
  })
}

resource "aws_vpc_endpoint" "ec2" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ec2"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  
  private_dns_enabled = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ec2-endpoint"
    Type = "vpc-endpoint"
  })
}

resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  
  private_dns_enabled = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecr-dkr-endpoint"
    Type = "vpc-endpoint"
  })
}

resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  
  private_dns_enabled = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-ecr-api-endpoint"
    Type = "vpc-endpoint"
  })
}

# Security group for VPC endpoints
resource "aws_security_group" "vpc_endpoints" {
  name_prefix = "${local.name_prefix}-vpc-endpoints-"
  vpc_id      = aws_vpc.main.id
  description = "Security group for VPC endpoints"

  ingress {
    description = "HTTPS from VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc-endpoints-sg"
    Type = "vpc-endpoints"
  })

  lifecycle {
    create_before_destroy = true
  }
}

# Data sources
data "aws_region" "current" {}

# Additional KMS key for log encryption
resource "aws_kms_key" "logs" {
  description             = "KMS key for log encryption"
  deletion_window_in_days = var.environment == "production" ? 30 : 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow CloudWatch Logs"
        Effect = "Allow"
        Principal = {
          Service = "logs.${data.aws_region.current.name}.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-logs-kms-key"
    Type = "encryption"
  })
}

resource "aws_kms_alias" "logs" {
  name          = "alias/${local.name_prefix}-logs"
  target_key_id = aws_kms_key.logs.key_id
}

# WAF for application protection
resource "aws_wafv2_web_acl" "main" {
  count = var.environment == "production" ? 1 : 0
  
  name  = "${local.name_prefix}-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate limiting rule
  rule {
    name     = "RateLimitRule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit           = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "RateLimitRule"
      sampled_requests_enabled    = true
    }
  }

  # AWS Managed Rules
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 10

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                 = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled    = true
    }
  }

  # SQL injection protection
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 20

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
      metric_name                 = "AWSManagedRulesSQLiRuleSetMetric"
      sampled_requests_enabled    = true
    }
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-waf"
    Type = "security"
  })

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                 = "${local.name_prefix}-waf"
    sampled_requests_enabled    = true
  }
}

# Associate WAF with ALB
resource "aws_wafv2_web_acl_association" "main" {
  count = var.environment == "production" ? 1 : 0
  
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main[0].arn
}

# Output values for security configuration
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = aws_subnet.public[*].id
}

output "database_subnet_ids" {
  description = "IDs of the database subnets"
  value       = aws_subnet.database[*].id
}

output "security_group_ids" {
  description = "Security group IDs by tier"
  value = {
    alb      = aws_security_group.alb.id
    app      = aws_security_group.app.id
    rds      = aws_security_group.rds.id
    redis    = aws_security_group.redis.id
    bastion  = var.environment == "production" ? null : aws_security_group.bastion[0].id
    eks_cluster = aws_security_group.eks_cluster.id
    eks_nodes   = aws_security_group.eks_nodes.id
  }
}

output "flow_log_group_name" {
  description = "Name of the VPC Flow Logs CloudWatch log group"
  value       = aws_cloudwatch_log_group.vpc_flow_log.name
}

output "waf_arn" {
  description = "ARN of the WAF Web ACL"
  value       = var.environment == "production" ? aws_wafv2_web_acl.main[0].arn : null
}