# SignOz Dashboard Configuration - Task 5.1

## Overview

This directory contains comprehensive SignOz dashboard configurations for production-ready observability of the monitoring web service. The implementation provides complete visibility into application performance, database operations, multi-tenant resource usage, and infrastructure health.

## Architecture

### Dashboard Categories

1. **Application Overview** (`01-application-overview.json`)
   - RED metrics (Rate, Errors, Duration)
   - SLA compliance monitoring
   - Feature usage analytics
   - Performance trend analysis

2. **Database Performance** (`02-database-performance.json`)
   - Query execution analysis
   - Connection pool monitoring
   - Slow query detection
   - Tenant-specific database usage

3. **Tenant Monitoring** (`03-tenant-monitoring.json`)
   - Multi-tenant resource isolation
   - Per-tenant SLA compliance
   - Resource quota utilization
   - Tenant activity patterns

4. **Infrastructure Monitoring** (`04-infrastructure-monitoring.json`)
   - System resource usage
   - Container health monitoring
   - Service dependency tracking
   - Capacity planning metrics

## Directory Structure

```
signoz/
├── dashboards/                    # Dashboard JSON configurations
│   ├── 01-application-overview.json
│   ├── 02-database-performance.json
│   ├── 03-tenant-monitoring.json
│   └── 04-infrastructure-monitoring.json
├── scripts/                      # Automation and management scripts
│   ├── provision-dashboards.sh  # Main provisioning script
│   ├── manage-dashboards.sh     # Management utilities
│   └── docker-compose-dashboards.yml # Docker integration
├── otel-collector-config.yaml   # OpenTelemetry Collector configuration
├── alertmanager-config.yml      # Alert manager configuration
├── prometheus.yml               # Prometheus configuration
└── README.md                    # This documentation
```

## Dashboard Details

### 1. Application Overview Dashboard

**Purpose**: Comprehensive application health monitoring with business intelligence

**Key Metrics**:
- Service uptime and availability
- Request rate and response time percentiles (P50, P95, P99)
- Error rate tracking and SLA compliance (99.9% target)
- API endpoint performance analysis
- Feature usage patterns and active user sessions
- Performance trend analysis and anomaly detection

**Panels**:
- Service Health Overview (Service status indicator)
- Request Rate (Total, success, and error requests per second)
- Error Rate (Percentage with thresholds: <1% green, <5% red)
- Response Time Percentiles (P50, P95, P99 latency distribution)
- SLA Compliance (99.9% availability tracking)
- API Endpoints Performance (Table with method, route, rate, latency)
- Feature Usage Patterns (Usage trends by feature)
- Active User Sessions (Session and tenant activity)
- Performance Trend Analysis (Historical trends with moving averages)
- Anomaly Detection Alerts (Active alerts and incidents)

**Access Level**: Viewer (read-only for operations teams)

### 2. Database Performance Dashboard

**Purpose**: PostgreSQL performance monitoring with query optimization insights

**Key Metrics**:
- Database connection status and pool utilization
- Query execution time distribution (P50, P95, P99)
- Slow query detection (>1s threshold)
- Database operations by type (SELECT, INSERT, UPDATE, DELETE)
- Connection acquisition time and pool health
- Tenant-specific database resource consumption

**Panels**:
- Database Connection Status (Connection health indicator)
- Connection Pool Utilization (Active, idle, and total connections)
- Connection Pool Health (Pool utilization percentage)
- Query Execution Time Distribution (Latency percentiles)
- Slow Query Detection (Queries exceeding 1s threshold)
- Database Operations by Type (CRUD operation rates)
- Query Error Rate (Error rate and percentage)
- Top Slow Queries by Table (Performance bottleneck identification)
- Connection Acquisition Time (Connection pool performance)
- Tenant-Specific Database Usage (Per-tenant query patterns)
- Database Resource Consumption by Tenant (CPU time and rows affected)
- Query Optimization Recommendations (Automated insights)
- Database Transaction Patterns (Transaction and rollback rates)

**Access Level**: Viewer (database team access)

### 3. Tenant Monitoring Dashboard

**Purpose**: Multi-tenant observability with resource isolation and SLA tracking

**Key Metrics**:
- Active tenant count and distribution
- Per-tenant request rate and performance
- Tenant SLA compliance monitoring
- Resource usage tracking (CPU, memory, storage)
- Rate limiting status and quota utilization
- Tenant onboarding and activity patterns

**Panels**:
- Active Tenants Overview (Current active tenant count)
- Tenant Request Rate Distribution (Top 10 tenants by request volume)
- Tenant SLA Compliance (P95 latency, error rate, availability by tenant)
- Tenant Resource Usage - CPU Time (CPU consumption by tenant)
- Tenant Resource Usage - Memory (Memory usage by tenant)
- Tenant API Rate Limiting Status (Rate limit hits and percentages)
- Tenant Storage Consumption (Storage usage by tenant)
- Tenant Activity Patterns (Heatmap of tenant activity)
- Tenant Onboarding Metrics (New tenants, activations, churn)
- Tenant-Specific Error Analysis (Error rates by tenant and status code)
- Tenant SLA Breach Detection (SLA violation alerts)
- Tenant Bandwidth Usage (Inbound and outbound traffic by tenant)
- Tenant Feature Usage Distribution (Feature adoption by tenant)
- Resource Quota Utilization by Tenant (CPU, memory, storage quotas)

**Access Level**: Editor (tenant management teams need update access)

### 4. Infrastructure Monitoring Dashboard

**Purpose**: System resource and container health monitoring with capacity planning

**Key Metrics**:
- System health overview (service and host status)
- CPU and memory utilization
- Disk space usage and network traffic
- Container resource usage and health status
- Service dependency health
- Capacity planning and scaling recommendations

**Panels**:
- System Health Overview (Service and host status)
- CPU Utilization (System and average CPU usage)
- Memory Usage (Memory consumption and utilization)
- Disk Space Usage (Filesystem usage by mount point)
- Network Traffic (Transmit and receive rates by interface)
- Container Resource Usage (CPU and memory by container)
- Container Health Status (Running status, uptime, memory failures)
- Service Dependency Health (PostgreSQL, Redis, ClickHouse status)
- Load Average & System Load (1m, 5m, 15m load averages)
- Process Count & Resource Limits (Process counts and file descriptors)
- Capacity Planning Metrics (Predicted resource usage)
- Orchestration Health (Docker Compose container status)
- Service Communication Health (Health check performance)
- Scaling Recommendations (Resource usage alerts)

**Access Level**: Viewer (infrastructure team monitoring)

## Automation Scripts

### provision-dashboards.sh

**Purpose**: Automated dashboard deployment and management

**Features**:
- Dashboard validation and deployment
- Access control configuration
- Health monitoring
- Backup and export functionality
- Error handling and logging

**Usage**:
```bash
# Deploy all dashboards
./provision-dashboards.sh

# Deploy with custom SignOz URL
./provision-dashboards.sh -u http://signoz:3301

# Deploy with API key authentication
./provision-dashboards.sh -k your-api-key

# Health check only
./provision-dashboards.sh --health-check

# Export existing dashboards
./provision-dashboards.sh --export-only
```

### manage-dashboards.sh

**Purpose**: Dashboard management utilities and maintenance

**Features**:
- Dashboard listing and reporting
- Backup and restore operations
- Configuration validation
- Cleanup and maintenance
- HTML report generation

**Usage**:
```bash
# List all dashboards
./manage-dashboards.sh list

# Create backup
./manage-dashboards.sh backup

# Restore from backup
./manage-dashboards.sh restore /path/to/backup

# Validate dashboard configuration
./manage-dashboards.sh validate dashboard.json

# Generate HTML report
./manage-dashboards.sh report
```

### Docker Integration

**File**: `docker-compose-dashboards.yml`

**Services**:
- `dashboard-provisioner`: Automated dashboard deployment on startup
- `dashboard-monitor`: Continuous health monitoring (optional)

**Usage**:
```bash
# Deploy dashboards as part of monitoring stack
docker-compose -f docker-compose-dashboards.yml up dashboard-provisioner

# Enable continuous monitoring
docker-compose -f docker-compose-dashboards.yml --profile monitoring up
```

## Configuration

### Environment Variables

```bash
# SignOz Configuration
SIGNOZ_URL=http://localhost:3301          # SignOz frontend URL
SIGNOZ_API_KEY=your-api-key               # API key for authentication

# Dashboard Configuration
DASHBOARD_DIR=/path/to/dashboards         # Dashboard directory
BACKUP_DIR=/path/to/backups              # Backup directory
LOG_LEVEL=INFO                           # Logging level

# Monitoring Configuration
HEALTH_CHECK_INTERVAL=300                 # Health check interval (seconds)
```

### Access Control Matrix

| Dashboard | Admin | Editor | Viewer | Public |
|-----------|-------|--------|--------|--------|
| Application Overview | CRUD | RU | R | - |
| Database Performance | CRUD | RU | R | - |
| Tenant Monitoring | CRUD | CRUD | R | - |
| Infrastructure Monitoring | CRUD | RU | R | - |

**Legend**:
- C: Create, R: Read, U: Update, D: Delete
- Admin: Full access to all dashboards
- Editor: Can modify tenant monitoring dashboards
- Viewer: Read-only access for operations teams
- Public: No public access (all dashboards require authentication)

## Deployment Guide

### Prerequisites

1. **SignOz Installation**: Ensure SignOz is running and accessible
2. **OpenTelemetry Collector**: Properly configured collector (see `otel-collector-config.yaml`)
3. **Required Tools**: `curl`, `jq`, `bash` for automation scripts
4. **Network Access**: Connectivity to SignOz API endpoints

### Deployment Steps

1. **Prepare Environment**:
   ```bash
   export SIGNOZ_URL=http://your-signoz:3301
   export SIGNOZ_API_KEY=your-api-key
   ```

2. **Validate Configuration**:
   ```bash
   ./manage-dashboards.sh validate dashboards/01-application-overview.json
   ```

3. **Deploy Dashboards**:
   ```bash
   ./provision-dashboards.sh
   ```

4. **Verify Deployment**:
   ```bash
   ./provision-dashboards.sh --health-check
   ```

5. **Create Initial Backup**:
   ```bash
   ./manage-dashboards.sh backup
   ```

### Docker Deployment

1. **Configure Environment**:
   ```bash
   echo "SIGNOZ_API_KEY=your-api-key" > .env
   ```

2. **Deploy with Docker Compose**:
   ```bash
   docker-compose -f scripts/docker-compose-dashboards.yml up dashboard-provisioner
   ```

3. **Enable Monitoring** (Optional):
   ```bash
   docker-compose -f scripts/docker-compose-dashboards.yml --profile monitoring up -d
   ```

## Monitoring and Maintenance

### Health Checks

The dashboard provisioning system includes automated health checks:

1. **Dashboard Accessibility**: Verifies each dashboard is accessible via API
2. **Panel Validation**: Ensures all panels have valid queries and configurations
3. **Data Availability**: Confirms metrics data is flowing correctly
4. **Performance Monitoring**: Tracks dashboard load times and responsiveness

### Backup Strategy

1. **Automated Backups**: Daily backups of all dashboard configurations
2. **Retention Policy**: 30-day retention with configurable cleanup
3. **Versioning**: Timestamp-based backup versioning
4. **Recovery Testing**: Regular restore testing to ensure backup integrity

### Maintenance Tasks

1. **Weekly**: Review dashboard performance and query optimization
2. **Monthly**: Cleanup old backups and generate usage reports
3. **Quarterly**: Review and update dashboard configurations
4. **Annually**: Comprehensive observability strategy review

## Troubleshooting

### Common Issues

1. **Dashboard Not Loading**:
   - Check SignOz connectivity: `curl $SIGNOZ_URL/api/v1/version`
   - Verify API authentication
   - Review dashboard JSON syntax

2. **Missing Metrics Data**:
   - Confirm OpenTelemetry Collector configuration
   - Check metric ingestion pipeline
   - Verify service instrumentation

3. **Performance Issues**:
   - Review query complexity and time ranges
   - Check ClickHouse resource utilization
   - Optimize panel refresh rates

4. **Access Control Problems**:
   - Verify API key permissions
   - Check dashboard sharing settings
   - Review user role assignments

### Debugging

1. **Enable Debug Logging**:
   ```bash
   LOG_LEVEL=DEBUG ./provision-dashboards.sh
   ```

2. **Check API Responses**:
   ```bash
   curl -s "$SIGNOZ_URL/api/v1/dashboards" | jq '.'
   ```

3. **Validate Dashboard JSON**:
   ```bash
   jq empty dashboard.json && echo "Valid JSON"
   ```

## Performance Optimization

### Query Optimization

1. **Time Range Limits**: Use appropriate time ranges (default: 1 hour)
2. **Sampling Rates**: Implement intelligent sampling for high-volume metrics
3. **Aggregation**: Use proper aggregation functions (sum, avg, rate)
4. **Indexing**: Ensure proper ClickHouse indexing for metric queries

### Resource Usage

1. **Panel Limits**: Reasonable number of panels per dashboard (<15)
2. **Refresh Rates**: Appropriate refresh intervals (30s default)
3. **Data Retention**: Configure metric retention policies
4. **Caching**: Enable query result caching where possible

## Security Considerations

### Authentication

1. **API Keys**: Secure API key management and rotation
2. **Network Security**: TLS encryption for all communications
3. **Access Control**: Role-based access to dashboard management
4. **Audit Logging**: Track dashboard modifications and access

### Data Privacy

1. **Tenant Isolation**: Ensure tenant data separation in dashboards
2. **PII Protection**: Avoid exposing personally identifiable information
3. **Data Masking**: Implement data masking for sensitive metrics
4. **Retention Policies**: Appropriate data retention and deletion

## Integration with Existing Infrastructure

### Sprint Integration

This Task 5.1 implementation builds upon:

- **Sprint 1-2**: Complete OTEL infrastructure and tracing setup
- **Sprint 3**: Logging integration and parallel validation
- **Sprint 4**: Business metrics and advanced tracing capabilities

### Metric Sources

1. **Application Metrics**: HTTP request metrics, business KPIs
2. **Database Metrics**: PostgreSQL/Prisma performance metrics
3. **Infrastructure Metrics**: System resources, container health
4. **Custom Metrics**: Tenant-specific and feature usage metrics

### Alert Integration

Dashboards integrate with alerting systems through:

1. **Annotations**: Visual indicators for alert conditions
2. **Thresholds**: Color-coded threshold indicators
3. **Alert Panels**: Dedicated panels for active alerts
4. **Notification Integration**: Links to incident management systems

## Future Enhancements

### Planned Features

1. **AI-Powered Insights**: Machine learning-based anomaly detection
2. **Custom Visualizations**: Business-specific chart types
3. **Mobile Dashboards**: Responsive design for mobile access
4. **Export Capabilities**: PDF/PNG export for reports
5. **Advanced Filtering**: Dynamic filtering and drill-down capabilities

### Extensibility

The dashboard system is designed for extensibility:

1. **Templating**: Variable-based dashboard templating
2. **Plugin System**: Support for custom panel types
3. **API Integration**: RESTful API for dashboard management
4. **Webhook Support**: Event-driven dashboard updates

---

**Implementation Status**: ✅ Complete - Task 5.1 SignOz Dashboard Configuration
**Integration**: Builds upon Sprints 1-4 OpenTelemetry infrastructure
**Deployment**: Production-ready with automated provisioning and monitoring