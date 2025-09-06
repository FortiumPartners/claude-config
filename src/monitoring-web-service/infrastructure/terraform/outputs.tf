# Outputs for External Metrics Web Service Infrastructure

# VPC Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnet_ids" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnets
}

# Database Outputs
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = false
}

output "rds_port" {
  description = "RDS instance port"
  value       = aws_db_instance.postgres.port
}

output "rds_database_name" {
  description = "RDS database name"
  value       = aws_db_instance.postgres.db_name
}

output "rds_username" {
  description = "RDS master username"
  value       = aws_db_instance.postgres.username
  sensitive   = false
}

output "rds_security_group_id" {
  description = "Security group ID for RDS"
  value       = aws_security_group.rds.id
}

# Redis Outputs
output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = false
}

output "redis_port" {
  description = "Redis cluster port"
  value       = aws_elasticache_replication_group.redis.port
}

output "redis_auth_token_enabled" {
  description = "Whether Redis auth token is enabled"
  value       = aws_elasticache_replication_group.redis.auth_token != null
}

output "redis_security_group_id" {
  description = "Security group ID for Redis"
  value       = aws_security_group.redis.id
}

# EKS Outputs
output "eks_cluster_id" {
  description = "EKS cluster ID"
  value       = module.eks.cluster_id
}

output "eks_cluster_arn" {
  description = "EKS cluster ARN"
  value       = module.eks.cluster_arn
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
  sensitive   = false
}

output "eks_cluster_version" {
  description = "EKS cluster Kubernetes version"
  value       = module.eks.cluster_version
}

output "eks_cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "eks_node_groups" {
  description = "EKS node groups information"
  value       = module.eks.eks_managed_node_groups
  sensitive   = false
}

output "eks_oidc_provider_arn" {
  description = "ARN of the EKS OIDC Provider"
  value       = module.eks.oidc_provider_arn
}

# Load Balancer Outputs
output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = aws_lb.main.zone_id
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_security_group_id" {
  description = "Security group ID for the ALB"
  value       = aws_security_group.alb.id
}

# Security Outputs
output "kms_rds_key_id" {
  description = "KMS key ID for RDS encryption"
  value       = aws_kms_key.rds.id
}

output "kms_redis_key_id" {
  description = "KMS key ID for Redis encryption"
  value       = aws_kms_key.redis.id
}

output "kms_eks_key_id" {
  description = "KMS key ID for EKS encryption"
  value       = aws_kms_key.eks.id
}

output "secrets_manager_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.app_secrets.arn
  sensitive   = false
}

output "app_storage_bucket_name" {
  description = "Name of the S3 bucket for application storage"
  value       = aws_s3_bucket.app_storage.id
}

output "app_storage_bucket_arn" {
  description = "ARN of the S3 bucket for application storage"
  value       = aws_s3_bucket.app_storage.arn
}

# IAM Outputs
output "eks_pod_role_arn" {
  description = "ARN of the IAM role for EKS pods"
  value       = aws_iam_role.eks_pod_role.arn
}

output "app_policy_arn" {
  description = "ARN of the application IAM policy"
  value       = aws_iam_policy.app_policy.arn
}

# WAF Outputs
output "waf_web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = var.enable_waf ? aws_wafv2_web_acl.main[0].arn : null
}

# Monitoring Outputs
output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = aws_cloudwatch_log_group.app.name
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for alerts"
  value       = aws_sns_topic.alerts.arn
}

# Connection Information for Application Deployment
output "database_connection_string" {
  description = "Database connection string template"
  value       = "postgresql://${aws_db_instance.postgres.username}:<password>@${aws_db_instance.postgres.endpoint}/${aws_db_instance.postgres.db_name}"
  sensitive   = true
}

output "redis_connection_string" {
  description = "Redis connection string template"
  value       = "redis://${aws_elasticache_replication_group.redis.primary_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
  sensitive   = false
}

# Environment Configuration for Application
output "environment_variables" {
  description = "Environment variables for application deployment"
  value = {
    # Database configuration
    DB_HOST     = split(":", aws_db_instance.postgres.endpoint)[0]
    DB_PORT     = tostring(aws_db_instance.postgres.port)
    DB_NAME     = aws_db_instance.postgres.db_name
    DB_USER     = aws_db_instance.postgres.username
    DB_SSL_MODE = "require"
    
    # Redis configuration
    REDIS_HOST = aws_elasticache_replication_group.redis.primary_endpoint_address
    REDIS_PORT = tostring(aws_elasticache_replication_group.redis.port)
    REDIS_TLS  = "true"
    
    # AWS configuration
    AWS_REGION               = var.aws_region
    AWS_SECRETS_MANAGER_ARN  = aws_secretsmanager_secret.app_secrets.arn
    AWS_S3_BUCKET_NAME       = aws_s3_bucket.app_storage.id
    
    # Kubernetes configuration
    KUBERNETES_NAMESPACE     = "default"
    SERVICE_ACCOUNT_NAME     = "metrics-web-service"
    
    # Application configuration
    NODE_ENV                 = var.environment
    LOG_LEVEL                = var.environment == "production" ? "info" : "debug"
    
    # Performance tuning
    DB_POOL_SIZE            = "20"
    CACHE_TTL_SECONDS       = "300"
    MAX_BATCH_SIZE          = "1000"
    RATE_LIMIT_WINDOW_MS    = "60000"
    RATE_LIMIT_MAX_REQUESTS = "1000"
  }
  sensitive = false
}

# Deployment Commands
output "deployment_commands" {
  description = "Commands for deploying the application"
  value = {
    # Connect to EKS cluster
    eks_connect = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_id}"
    
    # Apply Kubernetes configurations
    kubectl_apply = "kubectl apply -f kubernetes/"
    
    # Port forward for local testing
    port_forward = "kubectl port-forward svc/metrics-web-service 3000:3000"
    
    # View logs
    logs = "kubectl logs -l app=metrics-web-service -f"
    
    # Database migration
    migrate = "kubectl exec -it deployment/metrics-web-service -- npm run migrate"
  }
}

# Useful Information
output "next_steps" {
  description = "Next steps after infrastructure deployment"
  value = [
    "1. Update kubeconfig: aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_id}",
    "2. Create Kubernetes namespace: kubectl create namespace metrics",
    "3. Apply application manifests: kubectl apply -f kubernetes/",
    "4. Run database migrations: kubectl exec -it deployment/metrics-web-service -- npm run migrate",
    "5. Verify deployment: kubectl get pods -n metrics",
    "6. Access application: ${aws_lb.main.dns_name}",
    "7. Monitor logs: kubectl logs -l app=metrics-web-service -f -n metrics"
  ]
}

# Cost Estimation Information
output "cost_estimation" {
  description = "Estimated monthly costs (USD) for key resources"
  value = {
    rds_instance    = "Approximately $${formatstring("%.2f", 0.082 * 24 * 30)} per month for ${var.rds_instance_class}"
    redis_cluster   = "Approximately $${formatstring("%.2f", 0.068 * 24 * 30 * var.redis_num_cache_nodes)} per month for ${var.redis_num_cache_nodes}x ${var.redis_node_type}"
    eks_cluster     = "$73 per month for EKS cluster + node costs"
    data_transfer   = "Variable based on usage"
    storage         = "Variable based on data volume"
    note           = "Costs are estimates and may vary based on usage, region, and AWS pricing changes"
  }
}