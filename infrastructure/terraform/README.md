# External Metrics Web Service Infrastructure

This directory contains Terraform configuration for the AWS infrastructure supporting the External Metrics Web Service.

## Architecture Overview

- **EKS Cluster**: Kubernetes orchestration with auto-scaling node groups
- **RDS PostgreSQL**: Multi-AZ database with encryption and performance insights
- **Redis ElastiCache**: Caching and session management with clustering
- **Application Load Balancer**: SSL termination and traffic distribution
- **VPC**: Private networking with public/private subnets across AZs

## Prerequisites

1. **AWS CLI** configured with appropriate permissions
2. **Terraform** >= 1.0 installed
3. **kubectl** for Kubernetes management
4. **Domain name** with Route53 hosted zone (for SSL certificates)

## Quick Start

### 1. Initialize Terraform

```bash
cd infrastructure/terraform
terraform init
```

### 2. Review and Customize Variables

Edit `terraform.tfvars` (create if not exists):

```hcl
# Basic Configuration
aws_region      = "us-east-1"
environment     = "staging"
project_name    = "external-metrics"
domain_name     = "your-domain.com"

# EKS Configuration
kubernetes_version = "1.27"
node_group_scaling_config = {
  desired_size = 3
  max_size     = 10
  min_size     = 1
}

# Database Configuration
db_instance_class = "db.t3.small"
db_multi_az       = true

# Redis Configuration
redis_node_type        = "cache.t3.micro"
redis_num_cache_nodes  = 2

# Security (IMPORTANT: Restrict in production)
allowed_cidr_blocks = ["10.0.0.0/8"]  # Replace with your IP ranges
```

### 3. Plan and Apply

```bash
# Review changes
terraform plan

# Apply infrastructure
terraform apply
```

### 4. Configure kubectl

```bash
# Get cluster credentials
aws eks get-token --cluster-name external-metrics-staging --region us-east-1

# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name external-metrics-staging
```

## Infrastructure Components

### VPC and Networking
- **VPC**: 10.0.0.0/16 CIDR block
- **Public Subnets**: 2 subnets for ALB and NAT gateways
- **Private Subnets**: 2 subnets for EKS nodes and databases
- **Internet Gateway**: Public internet access
- **NAT Gateways**: Outbound internet for private subnets

### EKS Cluster
- **Control Plane**: Managed Kubernetes control plane
- **Node Group**: Auto-scaling EC2 instances for workloads
- **Add-ons**: VPC CNI, CoreDNS, kube-proxy, EBS CSI driver
- **Security**: Pod security standards and network policies

### RDS PostgreSQL
- **Multi-AZ**: High availability deployment
- **Encryption**: At-rest and in-transit encryption
- **Monitoring**: Performance Insights and CloudWatch
- **Backups**: Automated daily backups with 7-day retention

### Redis ElastiCache
- **Clustering**: Multi-node setup for high availability
- **Security**: Auth tokens and encryption
- **Monitoring**: CloudWatch metrics and alarms

### Application Load Balancer
- **SSL/TLS**: Automatic certificate management with ACM
- **Health Checks**: Application health monitoring
- **Access Logs**: S3-based logging for troubleshooting

## Security Features

### Network Security
- **VPC Flow Logs**: Network traffic monitoring
- **Security Groups**: Restrictive inbound/outbound rules
- **Private Subnets**: Database and application isolation

### Data Protection
- **Encryption at Rest**: KMS keys for all data stores
- **Encryption in Transit**: TLS 1.2+ for all connections
- **Secrets Management**: AWS Secrets Manager for credentials

### Access Control
- **IAM Roles**: Least privilege access for all components
- **EKS RBAC**: Kubernetes role-based access control
- **Certificate Management**: Automated SSL certificate rotation

## Monitoring and Logging

### CloudWatch Integration
- **Metrics**: System and application performance metrics
- **Logs**: Centralized logging for all components
- **Alarms**: Automated alerting for critical issues

### Performance Monitoring
- **RDS Performance Insights**: Database query optimization
- **EKS Container Insights**: Pod and node metrics
- **ALB Access Logs**: Request patterns and latency

## Cost Optimization

### Resource Sizing
- **Development**: t3.micro/small instances for cost efficiency
- **Production**: Larger instances with reserved pricing
- **Auto Scaling**: Dynamic resource allocation based on demand

### Storage Optimization
- **EBS gp3**: Cost-effective storage for EKS nodes
- **S3 Lifecycle**: Automated log cleanup policies
- **RDS Storage**: Auto-scaling to prevent over-provisioning

## Disaster Recovery

### Backup Strategy
- **RDS**: Automated backups with point-in-time recovery
- **Redis**: Snapshot-based backups
- **EKS**: GitOps-based infrastructure as code

### Multi-AZ Deployment
- **High Availability**: Resources distributed across availability zones
- **Failover**: Automatic failover for critical components
- **Recovery Time**: < 4 hour RTO for complete environment rebuild

## Production Considerations

### Security Hardening
- **Network ACLs**: Additional network layer security
- **WAF**: Web Application Firewall for ALB
- **VPC Endpoints**: Private API access without internet

### Compliance
- **Encryption**: All data encrypted at rest and in transit
- **Audit Logging**: Comprehensive audit trail
- **Access Controls**: Fine-grained permission management

### Monitoring Enhancement
- **Distributed Tracing**: Request flow across services
- **Custom Metrics**: Business-specific KPIs
- **Alerting**: PagerDuty/Slack integration for incidents

## Troubleshooting

### Common Issues

**EKS Node Group Not Starting**
```bash
# Check IAM roles and policies
aws iam get-role --role-name external-metrics-staging-node-group-role

# Verify subnet configuration
terraform show | grep subnet
```

**RDS Connection Issues**
```bash
# Check security groups
aws ec2 describe-security-groups --group-ids sg-xxxxx

# Test database connectivity from EKS pod
kubectl run -it --rm debug --image=postgres:14 --restart=Never -- psql -h <rds-endpoint> -U metrics_admin -d external_metrics
```

**SSL Certificate Issues**
```bash
# Check certificate validation
aws acm describe-certificate --certificate-arn <cert-arn>

# Verify Route53 records
aws route53 list-resource-record-sets --hosted-zone-id <zone-id>
```

### Terraform State Management

**Backend Configuration** (Recommended for production):
```hcl
terraform {
  backend "s3" {
    bucket = "your-terraform-state-bucket"
    key    = "external-metrics/terraform.tfstate"
    region = "us-east-1"
  }
}
```

## Cleanup

To destroy the infrastructure:

```bash
# Destroy resources (BE CAREFUL!)
terraform destroy

# Manually delete any remaining resources:
# - S3 buckets with objects
# - KMS keys (after deletion window)
# - Route53 records (if not managed by Terraform)
```

## Support

For infrastructure issues:
1. Check CloudWatch logs for error messages
2. Review Terraform state for drift
3. Validate AWS service limits and quotas
4. Contact AWS support for service-specific issues

## Security Notice

This infrastructure includes sensitive outputs marked as `sensitive = true`. Always use proper secret management practices and never commit secrets to version control.