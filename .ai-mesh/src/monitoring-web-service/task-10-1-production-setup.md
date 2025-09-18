# Sprint 10 - Task 10.1: Production Environment Setup

**Agent**: backend-developer  
**Duration**: 15 hours  
**Status**: In Progress

## Task Requirements

Implement production environment setup for the External Metrics Web Service:

### 10.1.1 Production Infrastructure Provisioning
**AWS EKS Production Cluster**:
- Production-grade Kubernetes cluster configuration
- Auto-scaling node groups (3-10 nodes)
- Multi-AZ deployment for high availability
- Security groups and network policies

**Database Infrastructure**:
- RDS PostgreSQL Multi-AZ with automated backups
- Read replicas for performance optimization
- Database parameter groups for production tuning
- Automated backup and point-in-time recovery

**Caching & Storage**:
- ElastiCache Redis cluster for caching and sessions
- S3 buckets for file storage and backups
- CloudWatch logging and monitoring setup

### 10.1.2 SSL Certificate Configuration
**Certificate Management**:
- AWS Certificate Manager (ACM) SSL certificates
- Domain validation and certificate issuance
- Load balancer SSL termination configuration
- Certificate auto-renewal setup

**Security Configuration**:
- TLS 1.3 enforcement
- Security headers configuration
- HSTS implementation
- SSL Labs A+ rating validation

### 10.1.3 Domain and DNS Configuration
**DNS Setup**:
- Route 53 hosted zone configuration
- Production domain (metrics.fortium.com)
- Health checks and failover routing
- CDN integration with CloudFront

**Load Balancing**:
- Application Load Balancer (ALB) configuration
- Target groups for backend services
- Health check configuration
- Blue-green deployment preparation

## Implementation Specifications

### Terraform Infrastructure as Code

```hcl
# Production EKS cluster
resource "aws_eks_cluster" "metrics_prod" {
  name     = "metrics-production"
  role_arn = aws_iam_role.eks_cluster.arn
  version  = "1.24"

  vpc_config {
    subnet_ids = [
      aws_subnet.private_1a.id,
      aws_subnet.private_1b.id,
      aws_subnet.private_1c.id
    ]
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_cluster_policy,
  ]
}

# RDS PostgreSQL Multi-AZ
resource "aws_db_instance" "metrics_prod" {
  identifier = "metrics-production"
  
  engine         = "postgres"
  engine_version = "14.9"
  instance_class = "db.r6g.large"
  
  allocated_storage     = 100
  max_allocated_storage = 1000
  storage_encrypted     = true
  
  multi_az               = true
  publicly_accessible    = false
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  performance_insights_enabled = true
  monitoring_interval         = 60
  
  vpc_security_group_ids = [aws_security_group.rds_prod.id]
  db_subnet_group_name   = aws_db_subnet_group.metrics_prod.name
}

# ElastiCache Redis Cluster
resource "aws_elasticache_replication_group" "metrics_prod" {
  replication_group_id         = "metrics-prod"
  description                  = "Redis cluster for metrics production"
  
  node_type                    = "cache.r6g.large"
  port                         = 6379
  parameter_group_name         = "default.redis7"
  
  num_cache_clusters           = 2
  automatic_failover_enabled   = true
  multi_az_enabled            = true
  
  subnet_group_name = aws_elasticache_subnet_group.metrics_prod.name
  security_group_ids = [aws_security_group.redis_prod.id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}
```

### Kubernetes Production Configuration

```yaml
# Production namespace
apiVersion: v1
kind: Namespace
metadata:
  name: metrics-production
  labels:
    env: production

---
# Production deployment with resource limits
apiVersion: apps/v1
kind: Deployment
metadata:
  name: metrics-api
  namespace: metrics-production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: metrics-api
      env: production
  template:
    metadata:
      labels:
        app: metrics-api
        env: production
    spec:
      containers:
      - name: api
        image: metrics/api:production
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: url
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
# Horizontal Pod Autoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: metrics-api-hpa
  namespace: metrics-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: metrics-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### SSL and Security Configuration

```yaml
# ALB Ingress with SSL termination
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: metrics-ingress
  namespace: metrics-production
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT-ID
    alb.ingress.kubernetes.io/ssl-policy: ELBSecurityPolicy-TLS-1-2-2017-01
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
spec:
  rules:
  - host: metrics.fortium.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: metrics-frontend
            port:
              number: 80
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: metrics-api
            port:
              number: 3000
  tls:
  - hosts:
    - metrics.fortium.com
    secretName: metrics-tls
```

## Expected Deliverables

1. **Infrastructure Provisioned**:
   - ✅ Production EKS cluster operational
   - ✅ RDS PostgreSQL Multi-AZ configured
   - ✅ ElastiCache Redis cluster active
   - ✅ S3 buckets for storage and backups

2. **Security Implemented**:
   - ✅ SSL certificates configured and validated
   - ✅ Security groups and network policies
   - ✅ IAM roles with least privilege
   - ✅ Encryption at rest and in transit

3. **DNS and Load Balancing**:
   - ✅ Production domain configured
   - ✅ Route 53 health checks active
   - ✅ ALB with SSL termination
   - ✅ CloudFront CDN integration

## Quality Gates

- [ ] All infrastructure components healthy and accessible
- [ ] SSL Labs A+ rating achieved for production domain
- [ ] Database connection successful with <100ms latency
- [ ] Auto-scaling tested and functional
- [ ] Security scan passed with no critical issues
- [ ] Backup and recovery procedures tested

## Handoff Requirements

**To Next Task (CI/CD Pipeline)**:
- Infrastructure endpoints and credentials
- Kubernetes cluster access configuration  
- Database connection strings and secrets
- Domain and SSL certificate details

**Agent**: Please implement the production environment setup according to these specifications. Focus on security, performance, and reliability. Ensure all components are production-ready with proper monitoring and alerting.