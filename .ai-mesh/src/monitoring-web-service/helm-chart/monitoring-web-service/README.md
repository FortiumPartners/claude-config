# Monitoring Web Service Helm Chart

A comprehensive Helm chart for deploying the External Metrics Web Service with PostgreSQL/TimescaleDB, Redis, and integrated monitoring capabilities.

## Overview

This Helm chart deploys a production-ready monitoring and metrics collection platform with:

- **Node.js Application**: Scalable web service for external metrics collection
- **PostgreSQL + TimescaleDB**: Time-series database optimized for metrics storage
- **Redis**: Caching layer for improved performance
- **PostgreSQL Monitoring**: Integrated PostgreSQL exporter for comprehensive database observability
- **Kubernetes Native**: Full Kubernetes integration with RBAC, NetworkPolicies, and security best practices

## Chart Features

### 🚀 **Production Ready**
- Horizontal Pod Autoscaling (HPA)
- Pod Disruption Budgets (PDB)
- Resource limits and requests
- Health checks and readiness probes
- Rolling deployment strategy

### 🔒 **Security First**
- Non-root containers
- Read-only root filesystem
- Security contexts and Pod Security Standards
- Network policies for traffic isolation
- Secret management for sensitive data

### 📊 **Monitoring & Observability**
- Prometheus metrics endpoints
- ServiceMonitor for Prometheus Operator
- PostgreSQL monitoring with dedicated exporter
- Grafana dashboard support
- Custom alerts and rules

### 🏗️ **Infrastructure Integration**
- RBAC configuration
- Ingress support with TLS
- Multiple storage class support
- Environment-specific overrides
- External database support

## Prerequisites

- Kubernetes 1.19+
- Helm 3.8+
- StorageClass for persistent volumes
- (Optional) Prometheus Operator for ServiceMonitor support
- (Optional) Ingress controller for external access

## Installation

### Quick Start

```bash
# Add the chart repository (if available)
helm repo add fortium https://charts.fortium.dev
helm repo update

# Install with default values
helm install my-monitoring-service fortium/monitoring-web-service
```

### Local Installation

```bash
# Clone the repository
git clone https://github.com/FortiumPartners/monitoring-web-service.git
cd monitoring-web-service/helm-chart

# Install the chart
helm install my-monitoring-service ./monitoring-web-service
```

### Environment-Specific Installation

```bash
# Development environment
helm install monitoring-dev ./monitoring-web-service \
  --values ./monitoring-web-service/values-dev.yaml \
  --namespace monitoring-dev --create-namespace

# Production environment
helm install monitoring-prod ./monitoring-web-service \
  --values ./monitoring-web-service/values-prod.yaml \
  --namespace monitoring-prod --create-namespace
```

## Configuration

### Core Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `app.replicaCount` | Number of application replicas | `3` |
| `app.image.repository` | Application image repository | `fortium-metrics-web-service` |
| `app.image.tag` | Application image tag | `1.0.0` |
| `app.resources.requests.memory` | Memory request | `256Mi` |
| `app.resources.limits.memory` | Memory limit | `512Mi` |

### Database Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `postgresql.enabled` | Enable PostgreSQL deployment | `true` |
| `postgresql.auth.username` | PostgreSQL username | `metrics_user` |
| `postgresql.auth.database` | PostgreSQL database name | `metrics_production` |
| `postgresql.primary.persistence.size` | PostgreSQL storage size | `100Gi` |

### Redis Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `redis.enabled` | Enable Redis deployment | `true` |
| `redis.auth.enabled` | Enable Redis authentication | `true` |
| `redis.master.persistence.size` | Redis storage size | `8Gi` |

### Monitoring Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `monitoring.postgresql.enabled` | Enable PostgreSQL monitoring | `true` |
| `serviceMonitor.enabled` | Create ServiceMonitor for Prometheus | `true` |
| `serviceMonitor.interval` | Scrape interval | `30s` |

### Ingress Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `ingress.enabled` | Enable ingress | `true` |
| `ingress.className` | Ingress class name | `nginx` |
| `ingress.hosts[0].host` | Hostname | `metrics.example.com` |
| `ingress.tls.enabled` | Enable TLS | `true` |

## Environment-Specific Values

### Development (values-dev.yaml)

```yaml
app:
  replicaCount: 1
  resources:
    requests:
      memory: "128Mi"
      cpu: "50m"
    limits:
      memory: "256Mi"
      cpu: "200m"

postgresql:
  primary:
    persistence:
      size: 10Gi

autoscaling:
  enabled: false

ingress:
  hosts:
    - host: metrics-dev.example.com
```

### Staging (values-staging.yaml)

```yaml
app:
  replicaCount: 2
  
postgresql:
  primary:
    persistence:
      size: 50Gi

autoscaling:
  minReplicas: 2
  maxReplicas: 5

ingress:
  hosts:
    - host: metrics-staging.example.com
```

### Production (values-prod.yaml)

```yaml
app:
  replicaCount: 3
  resources:
    requests:
      memory: "256Mi"
      cpu: "100m"
    limits:
      memory: "512Mi"
      cpu: "500m"

postgresql:
  primary:
    persistence:
      size: 100Gi
    resources:
      requests:
        memory: "1Gi"
        cpu: "500m"
      limits:
        memory: "2Gi"
        cpu: "1000m"

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10

podDisruptionBudget:
  enabled: true
  minAvailable: 2

ingress:
  hosts:
    - host: metrics.example.com
  tls:
    - secretName: monitoring-web-service-tls
      hosts:
        - metrics.example.com
```

## Advanced Configuration

### External Database

To use an external PostgreSQL instance:

```yaml
postgresql:
  enabled: false

externalDatabase:
  enabled: true
  host: "postgres.external.com"
  port: 5432
  database: "metrics_production"
  username: "metrics_user"
  password: "your-secure-password"
  sslMode: "require"
```

### External Redis

To use an external Redis instance:

```yaml
redis:
  enabled: false

externalRedis:
  enabled: true
  host: "redis.external.com"
  port: 6379
  password: "your-redis-password"
  database: 0
```

### Custom Resource Requirements

```yaml
app:
  resources:
    requests:
      memory: "512Mi"
      cpu: "200m"
    limits:
      memory: "1Gi"
      cpu: "500m"

postgresql:
  primary:
    resources:
      requests:
        memory: "2Gi"
        cpu: "1000m"
      limits:
        memory: "4Gi"
        cpu: "2000m"
```

### Network Policies

```yaml
networkPolicy:
  enabled: true
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
      ports:
        - protocol: TCP
          port: 3000
  egress:
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: postgresql
      ports:
        - protocol: TCP
          port: 5432
```

## Monitoring and Observability

### Prometheus Integration

The chart automatically creates ServiceMonitors for Prometheus Operator:

```yaml
serviceMonitor:
  enabled: true
  namespace: monitoring
  labels:
    release: prometheus
  interval: 30s
  endpoints:
    - port: metrics
      path: /metrics
```

### PostgreSQL Monitoring

Integrated PostgreSQL monitoring provides:

- Database connectivity and performance metrics
- Query statistics and slow query detection
- Connection pooling and resource utilization
- TimescaleDB-specific metrics

Access PostgreSQL metrics at: `/metrics` endpoint of the postgres-exporter service.

### Application Metrics

The application exposes metrics at `/api/metrics` including:

- HTTP request metrics
- Database connection pool stats
- Cache hit/miss ratios
- Background job statistics
- Custom business metrics

## Troubleshooting

### Common Issues

1. **Pods not starting**
   ```bash
   kubectl describe pods -l app.kubernetes.io/name=monitoring-web-service
   kubectl logs -l app.kubernetes.io/name=monitoring-web-service
   ```

2. **Database connection issues**
   ```bash
   kubectl logs deployment/monitoring-web-service-postgresql
   kubectl exec -it deployment/monitoring-web-service -- env | grep DB_
   ```

3. **Storage issues**
   ```bash
   kubectl get pvc
   kubectl describe pvc
   ```

### Health Checks

```bash
# Check application health
kubectl port-forward svc/monitoring-web-service 3000:80
curl http://localhost:3000/api/health

# Check PostgreSQL exporter
kubectl port-forward svc/monitoring-web-service-postgres-exporter 9187:9187
curl http://localhost:9187/metrics
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment monitoring-web-service --replicas=5

# Check HPA status
kubectl get hpa monitoring-web-service
kubectl describe hpa monitoring-web-service
```

## Security Considerations

### Pod Security

- All containers run as non-root users
- Read-only root filesystem where possible
- Minimal capabilities granted
- Security contexts enforced

### Network Security

- Network policies restrict traffic between pods
- Service-to-service communication controlled
- External access through ingress only

### Secret Management

- Database passwords auto-generated if not provided
- JWT secrets auto-generated for security
- Secrets mounted as environment variables
- Support for external secret management systems

## Upgrades

### Helm Upgrade

```bash
# Upgrade with new values
helm upgrade monitoring-web-service ./monitoring-web-service \
  --values ./values-prod.yaml

# Check rollout status
kubectl rollout status deployment/monitoring-web-service
```

### Database Migrations

The application handles database migrations automatically on startup. For major schema changes, consider:

1. Creating a database backup
2. Testing migrations in staging
3. Planning maintenance windows for production

## Development

### Local Development

```bash
# Install dependencies
helm dependency update ./monitoring-web-service

# Validate templates
helm template monitoring-web-service ./monitoring-web-service \
  --values ./monitoring-web-service/values-dev.yaml

# Dry run
helm install monitoring-dev ./monitoring-web-service \
  --values ./monitoring-web-service/values-dev.yaml \
  --dry-run --debug
```

### Testing

```bash
# Lint the chart
helm lint ./monitoring-web-service

# Test with different values
helm template test ./monitoring-web-service \
  --set postgresql.enabled=false \
  --set externalDatabase.enabled=true
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:

- GitHub Issues: https://github.com/FortiumPartners/monitoring-web-service/issues
- Documentation: https://docs.fortium.dev/monitoring-web-service
- Email: infrastructure@fortium.dev

## License

This Helm chart is licensed under the MIT License. See [LICENSE](LICENSE) for details.