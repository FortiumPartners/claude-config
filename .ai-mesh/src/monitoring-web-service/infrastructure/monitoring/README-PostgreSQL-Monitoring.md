# PostgreSQL Monitoring Infrastructure

This directory contains comprehensive PostgreSQL and TimescaleDB monitoring infrastructure implemented as part of **Phase 2: Infrastructure & Integration** of the External Metrics Web Service project.

## Overview

The PostgreSQL monitoring setup provides:

- **Comprehensive Metrics Collection**: Database performance, connections, query statistics, and TimescaleDB-specific metrics
- **Automated Alerting**: Proactive alerts for performance degradation, connectivity issues, and resource limits
- **Visual Dashboards**: Pre-configured Grafana dashboards for database monitoring
- **Multi-Environment Support**: Deployable in both Docker Compose (development) and Kubernetes (production)
- **Security Best Practices**: Secure credential management and least-privilege access

## Architecture

```mermaid
graph TB
    subgraph "PostgreSQL Infrastructure"
        PG[PostgreSQL + TimescaleDB]
        PE[PostgreSQL Exporter]
    end
    
    subgraph "Monitoring Stack"
        PROM[Prometheus]
        GRAF[Grafana]
    end
    
    subgraph "Dashboards & Alerts"
        DASH[PostgreSQL Dashboard]
        ALERTS[Alert Rules]
    end
    
    PG --> PE
    PE --> PROM
    PROM --> GRAF
    PROM --> ALERTS
    GRAF --> DASH
```

## Files Structure

```
infrastructure/monitoring/
├── postgresql-monitoring.yaml          # Kubernetes deployment manifests
├── prometheus-grafana.yaml            # Main Prometheus/Grafana configuration (updated)
├── prometheus-config.yml              # Docker Compose Prometheus config
├── grafana-provisioning/              # Grafana auto-provisioning
│   ├── datasources/prometheus.yaml    # Prometheus datasource config
│   └── dashboards/
│       ├── dashboard-provider.yaml    # Dashboard provider config
│       └── postgresql-dashboard.json  # PostgreSQL dashboard definition
└── README-PostgreSQL-Monitoring.md   # This file
```

## Key Features

### Metrics Collection

**Core PostgreSQL Metrics:**
- Database connectivity and uptime
- Active connections by state
- Database sizes and growth trends
- Cache hit ratios and buffer statistics
- Query performance and execution statistics
- Lock contention and deadlock detection

**TimescaleDB Specific Metrics:**
- Hypertable chunk statistics
- Compression ratios and efficiency
- Chunk lifecycle management
- Time-series specific optimizations

**Advanced Monitoring:**
- Long-running query detection
- Replication lag monitoring (if applicable)
- WAL file generation and archiving
- Table and index size analysis

### Alert Rules

**Critical Alerts:**
- PostgreSQL instance down
- Connection limits exceeded
- Long-running queries (>5 minutes)
- Deadlock detection

**Warning Alerts:**
- High memory/CPU usage
- Low cache hit ratio (<95%)
- Rapid database growth
- TimescaleDB compression issues

### Dashboard Features

**PostgreSQL Overview Dashboard:**
- Real-time connection status
- Query performance trends
- Database size monitoring
- Cache efficiency metrics
- Top tables by size
- TimescaleDB chunk statistics

## Quick Start

### Docker Compose Deployment

1. **Basic Setup (PostgreSQL Exporter only):**
   ```bash
   cd /path/to/monitoring-web-service
   ./scripts/setup-postgresql-monitoring.sh setup-docker
   ```

2. **Full Monitoring Stack (with Prometheus + Grafana):**
   ```bash
   ./scripts/setup-postgresql-monitoring.sh setup-docker --with-monitoring
   ```

3. **Verify Setup:**
   ```bash
   ./scripts/setup-postgresql-monitoring.sh verify
   ```

### Kubernetes Deployment

1. **Deploy to Kubernetes:**
   ```bash
   ./scripts/setup-postgresql-monitoring.sh setup-kubernetes
   ```

2. **Check Status:**
   ```bash
   kubectl get pods -n postgresql-monitoring
   ```

3. **Port Forward for Local Access:**
   ```bash
   kubectl port-forward -n postgresql-monitoring svc/postgres-exporter 9187:9187
   ```

## Access Points

### Development Environment (Docker Compose)

- **PostgreSQL Exporter**: http://localhost:9187/metrics
- **Prometheus** (with `--with-monitoring`): http://localhost:9090
- **Grafana** (with `--with-monitoring`): http://localhost:3001 (admin/admin)

### Production Environment (Kubernetes)

- **PostgreSQL Exporter Service**: `postgres-exporter.postgresql-monitoring.svc.cluster.local:9187`
- **Metrics Endpoint**: `/metrics`
- **Health Check**: Available via Kubernetes liveness/readiness probes

## Configuration

### Environment Variables (Docker Compose)

```bash
# PostgreSQL Connection
DB_HOST=postgres
DB_PORT=5432
DB_NAME=metrics_development
DB_USER=metrics_user
DB_PASSWORD=secure_development_password

# Exporter Configuration
POSTGRES_EXPORTER_PORT=9187
PG_EXPORTER_AUTO_DISCOVER_DATABASES=true
PG_EXPORTER_EXCLUDE_DATABASES=postgres,template0,template1

# Monitoring Stack (optional)
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin
```

### Kubernetes Secrets

The Kubernetes deployment uses secrets for secure credential management:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-exporter-secret
  namespace: postgresql-monitoring
type: Opaque
stringData:
  DATA_SOURCE_NAME: "postgresql://username:password@host:port/database?sslmode=require"
```

## Custom Queries

The monitoring setup includes custom queries for enhanced PostgreSQL and TimescaleDB monitoring:

### Database Size Monitoring
- Tracks individual database sizes
- Monitors growth trends
- Alerts on rapid growth

### Table Size Analysis
- Top 20 largest tables
- Index size tracking
- Storage efficiency metrics

### Connection Monitoring
- Active connections by state
- Connection limits tracking
- Long-running query detection

### TimescaleDB Features
- Hypertable chunk statistics
- Compression ratio monitoring
- Time-series optimization metrics

## Performance Tuning

### PostgreSQL Configuration

The setup includes optimized PostgreSQL settings for the monitoring workload:

```sql
-- Key performance settings
shared_preload_libraries = 'timescaledb,pg_stat_statements'
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
```

### Exporter Configuration

- **Scrape Interval**: 30 seconds (configurable)
- **Timeout**: 10 seconds
- **Auto-discovery**: Enabled for all application databases
- **Custom Queries**: Enabled via mounted configuration

## Security Considerations

### Access Control
- PostgreSQL exporter runs with minimal privileges
- Dedicated monitoring user with read-only access
- Kubernetes RBAC configured for least privilege

### Credential Management
- Secrets stored securely in Kubernetes secrets or Docker Compose env files
- No hardcoded credentials in configuration files
- SSL/TLS encryption for PostgreSQL connections (production)

### Network Security
- Metrics endpoints secured via Kubernetes network policies
- Firewall rules for port access (production environments)
- Internal-only access to sensitive metrics

## Monitoring and Alerting

### Prometheus Integration

The monitoring setup integrates seamlessly with existing Prometheus infrastructure:

```yaml
# Automatic service discovery
- job_name: 'postgres-exporter'
  kubernetes_sd_configs:
    - role: endpoints
      namespaces:
        names:
          - postgresql-monitoring
```

### Grafana Integration

Pre-configured dashboard includes:
- Real-time metrics visualization
- Historical trend analysis
- Alert status overview
- Custom query capabilities

### Alert Manager Integration

Ready for integration with AlertManager for:
- Email notifications
- Slack integration
- PagerDuty escalation
- Custom webhook notifications

## Troubleshooting

### Common Issues

1. **Connection Refused:**
   - Check PostgreSQL service is running
   - Verify network connectivity
   - Confirm credentials are correct

2. **No Metrics Available:**
   - Check exporter logs: `docker logs metrics-postgres-exporter`
   - Verify PostgreSQL user permissions
   - Ensure pg_stat_statements extension is enabled

3. **Dashboard Not Loading:**
   - Check Prometheus connectivity to exporter
   - Verify Grafana datasource configuration
   - Check dashboard import status

### Logs and Debugging

**Docker Compose:**
```bash
# Check exporter logs
docker logs metrics-postgres-exporter

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Verify metrics endpoint
curl http://localhost:9187/metrics
```

**Kubernetes:**
```bash
# Check pod logs
kubectl logs -n postgresql-monitoring deployment/postgres-exporter

# Check service endpoints
kubectl get endpoints -n postgresql-monitoring

# Port forward for debugging
kubectl port-forward -n postgresql-monitoring svc/postgres-exporter 9187:9187
```

## Maintenance

### Regular Tasks

1. **Monitor Disk Usage**: PostgreSQL metrics can grow over time
2. **Update Images**: Keep exporter and Prometheus images updated
3. **Review Alerts**: Regularly review and tune alert thresholds
4. **Backup Configuration**: Backup custom queries and dashboard configurations

### Scaling Considerations

- **High Traffic**: Consider multiple exporter instances with load balancing
- **Large Databases**: Tune scrape intervals and query timeouts
- **Multi-Region**: Deploy monitoring per region for reduced latency

## Contributing

### Adding Custom Metrics

1. Edit `postgresql-monitoring.yaml` ConfigMap
2. Add custom queries following the format:
   ```yaml
   custom_metric_name:
     query: "SELECT column FROM table WHERE condition"
     master: true
     cache_seconds: 30
     metrics:
       - column:
           usage: "GAUGE"
           description: "Metric description"
   ```

### Enhancing Dashboards

1. Edit the Grafana dashboard JSON in `grafana-provisioning/dashboards/`
2. Test changes in development environment
3. Deploy updates via configuration management

---

## Support

For issues related to PostgreSQL monitoring:

1. Check the troubleshooting section above
2. Review logs for error messages
3. Verify PostgreSQL and exporter versions compatibility
4. Consult the PostgreSQL Exporter documentation: https://github.com/prometheus-community/postgres_exporter

---

**Phase 2 Implementation Status**: ✅ **COMPLETED**

This PostgreSQL monitoring infrastructure provides comprehensive database observability and forms the foundation for reliable metrics collection and alerting in the External Metrics Web Service.