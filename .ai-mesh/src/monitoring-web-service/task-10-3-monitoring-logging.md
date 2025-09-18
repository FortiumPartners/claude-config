# Sprint 10 - Task 10.3: Monitoring & Logging Implementation

**Agent**: backend-developer (Observability specialist)  
**Duration**: 8 hours  
**Status**: Pending (Dependent on Tasks 10.1-10.2)

## Task Requirements

Implement comprehensive monitoring and logging infrastructure for the External Metrics Web Service production deployment:

### 10.3.1 CloudWatch/Prometheus Monitoring
**Application Performance Monitoring**:
- Custom metrics collection for business KPIs
- API response time and throughput monitoring
- Database query performance tracking
- Memory and CPU utilization monitoring
- WebSocket connection health monitoring

**Infrastructure Monitoring**:
- EKS cluster health and node status
- RDS database performance metrics
- ElastiCache Redis cluster monitoring
- Load balancer and network performance
- Auto-scaling events and capacity planning

### 10.3.2 Comprehensive Alerting System
**Critical Alerts (Immediate Response)**:
- API endpoint downtime or error rate >5%
- Database connection failures
- Memory usage >90% or CPU >85%
- SSL certificate expiration warnings
- Security breach detection

**Warning Alerts (24-hour Response)**:
- Performance degradation (response time >500ms)
- Disk space usage >80%
- Unusual traffic patterns
- Failed background jobs
- Cache hit rate degradation

### 10.3.3 Production Logging Setup
**Structured Logging**:
- Centralized log aggregation with CloudWatch Logs
- JSON-formatted log entries with correlation IDs
- Security event logging and audit trails
- Error tracking with stack traces
- Performance profiling and slow query logging

## Implementation Specifications

### CloudWatch Monitoring Configuration

```yaml
# cloudwatch-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cloudwatch-agent-config
  namespace: metrics-production
data:
  cwagentconfig.json: |
    {
      "agent": {
        "region": "us-east-1",
        "buffer_time": 10000
      },
      "logs": {
        "logs_collected": {
          "kubernetes": {
            "cluster_name": "metrics-production",
            "log_group_name": "/aws/eks/metrics-production/logs",
            "log_stream_name": "{pod_name}",
            "metrics_collected": [
              {
                "namespace": "CWAgent",
                "dimensions": [
                  ["ClusterName", "Namespace", "PodName"]
                ],
                "metrics": [
                  {
                    "metric_name": "pod_cpu_utilization",
                    "rename": "CPU_UTILIZATION"
                  },
                  {
                    "metric_name": "pod_memory_utilization", 
                    "rename": "MEMORY_UTILIZATION"
                  }
                ]
              }
            ]
          }
        }
      },
      "metrics": {
        "namespace": "ExternalMetrics/Production",
        "metrics_collected": {
          "cpu": {
            "measurement": ["cpu_usage_idle", "cpu_usage_iowait", "cpu_usage_user", "cpu_usage_system"],
            "metrics_collection_interval": 60,
            "resources": ["*"],
            "totalcpu": false
          },
          "disk": {
            "measurement": ["used_percent"],
            "metrics_collection_interval": 60,
            "resources": ["*"]
          },
          "mem": {
            "measurement": ["mem_used_percent"],
            "metrics_collection_interval": 60
          }
        }
      }
    }

---
# Application-specific metrics
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: metrics-production
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    rule_files:
      - "/etc/prometheus/rules/*.yml"
    
    scrape_configs:
      - job_name: 'metrics-api'
        kubernetes_sd_configs:
          - role: pod
            namespaces:
              names:
                - metrics-production
        relabel_configs:
          - source_labels: [__meta_kubernetes_pod_label_app]
            action: keep
            regex: metrics-api
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
            action: keep
            regex: true
          - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
            action: replace
            target_label: __metrics_path__
            regex: (.+)
        
      - job_name: 'postgres-exporter'
        static_configs:
          - targets: ['postgres-exporter:9187']
        
      - job_name: 'redis-exporter'
        static_configs:
          - targets: ['redis-exporter:9121']

      - job_name: 'node-exporter'
        kubernetes_sd_configs:
          - role: node
        relabel_configs:
          - action: replace
            source_labels: [__address__]
            regex: '(.*):10250'
            replacement: '${1}:9100'
            target_label: __address__
```

### Custom Application Metrics

```javascript
// metrics/business-metrics.js
const prometheus = require('prom-client');

// Business KPI Metrics
const activeUsersGauge = new prometheus.Gauge({
  name: 'metrics_active_users_total',
  help: 'Total number of active users',
  labelNames: ['tenant_id', 'time_window']
});

const productivityScoreHistogram = new prometheus.Histogram({
  name: 'metrics_productivity_score',
  help: 'Distribution of user productivity scores',
  labelNames: ['tenant_id', 'user_role'],
  buckets: [10, 25, 50, 75, 90, 95, 99, 100]
});

const apiRequestDuration = new prometheus.Histogram({
  name: 'metrics_api_request_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'tenant_id'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5, 10]
});

const websocketConnections = new prometheus.Gauge({
  name: 'metrics_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['tenant_id']
});

const databaseQueryDuration = new prometheus.Histogram({
  name: 'metrics_database_query_duration_seconds',
  help: 'Database query execution time',
  labelNames: ['query_type', 'tenant_id'],
  buckets: [0.001, 0.01, 0.1, 0.5, 1, 2, 5]
});

// Export metrics for Prometheus scraping
const register = prometheus.register;
module.exports = {
  activeUsersGauge,
  productivityScoreHistogram,
  apiRequestDuration,
  websocketConnections,
  databaseQueryDuration,
  register
};
```

### Alerting Rules Configuration

```yaml
# prometheus-alerts.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-alerts
  namespace: metrics-production
data:
  alerts.yml: |
    groups:
    - name: external-metrics-critical
      rules:
      # API Health Critical Alerts
      - alert: APIHighErrorRate
        expr: rate(metrics_api_request_duration_seconds{status_code=~"5.."}[5m]) > 0.05
        for: 1m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "High API error rate detected"
          description: "API error rate is {{ $value }} errors/sec for {{ $labels.route }}"

      - alert: APIHighLatency
        expr: histogram_quantile(0.95, rate(metrics_api_request_duration_seconds_bucket[5m])) > 0.5
        for: 2m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "API response time degradation"
          description: "95th percentile latency is {{ $value }}s for {{ $labels.route }}"

      # Database Critical Alerts
      - alert: DatabaseConnectionFailure
        expr: up{job="postgres-exporter"} == 0
        for: 1m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "Database connection failure"
          description: "PostgreSQL database is unreachable"

      - alert: DatabaseHighConnections
        expr: pg_stat_database_numbackends / pg_settings_max_connections > 0.8
        for: 5m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "Database connection pool near limit"
          description: "Database connections at {{ $value }}% of maximum"

    - name: external-metrics-warning
      rules:
      # Performance Warning Alerts
      - alert: HighMemoryUsage
        expr: (container_memory_usage_bytes / container_spec_memory_limit_bytes) > 0.8
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is {{ $value }}% on {{ $labels.pod }}"

      - alert: HighCPUUsage
        expr: rate(container_cpu_usage_seconds_total[5m]) > 0.8
        for: 10m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is {{ $value }}% on {{ $labels.pod }}"

      # WebSocket Connection Alerts
      - alert: WebSocketConnectionDrop
        expr: delta(metrics_websocket_connections_active[10m]) < -50
        for: 2m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "Significant WebSocket connection drop"
          description: "WebSocket connections dropped by {{ $value }} in the last 10 minutes"

    - name: external-metrics-business
      rules:
      # Business Metric Alerts
      - alert: LowUserActivity
        expr: metrics_active_users_total{time_window="1h"} < 10
        for: 30m
        labels:
          severity: warning
          team: product
        annotations:
          summary: "Low user activity detected"
          description: "Only {{ $value }} active users in the last hour for tenant {{ $labels.tenant_id }}"

      - alert: ProductivityScoreAnomaly
        expr: avg_over_time(metrics_productivity_score[1h]) < 50
        for: 15m
        labels:
          severity: warning
          team: product
        annotations:
          summary: "Productivity score anomaly"
          description: "Average productivity score dropped to {{ $value }} for tenant {{ $labels.tenant_id }}"
```

### Structured Logging Configuration

```javascript
// logger/production-logger.js
const winston = require('winston');
const CloudWatchTransport = require('winston-cloudwatch');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return JSON.stringify({
        timestamp,
        level,
        message,
        environment: process.env.NODE_ENV,
        service: 'external-metrics-api',
        version: process.env.APP_VERSION,
        correlationId: meta.correlationId,
        tenantId: meta.tenantId,
        userId: meta.userId,
        ...meta
      });
    })
  ),
  transports: [
    // CloudWatch Logs
    new CloudWatchTransport({
      logGroupName: '/aws/eks/metrics-production/application',
      logStreamName: `${process.env.HOSTNAME}-${Date.now()}`,
      awsRegion: process.env.AWS_REGION,
      jsonMessage: true,
      messageFormatter: ({ level, message, additionalInfo }) => 
        `[${level}] ${message} ${JSON.stringify(additionalInfo, null, 2)}`
    }),

    // Local console for debugging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new CloudWatchTransport({
      logGroupName: '/aws/eks/metrics-production/exceptions',
      logStreamName: `exceptions-${Date.now()}`,
      awsRegion: process.env.AWS_REGION
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new CloudWatchTransport({
      logGroupName: '/aws/eks/metrics-production/rejections',
      logStreamName: `rejections-${Date.now()}`,
      awsRegion: process.env.AWS_REGION
    })
  ]
});

// Security audit logger
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new CloudWatchTransport({
      logGroupName: '/aws/eks/metrics-production/security-audit',
      logStreamName: `audit-${Date.now()}`,
      awsRegion: process.env.AWS_REGION,
      jsonMessage: true
    })
  ]
});

module.exports = { logger, auditLogger };
```

### Grafana Dashboard Configuration

```json
{
  "dashboard": {
    "title": "External Metrics Service - Production",
    "tags": ["metrics", "production", "monitoring"],
    "timezone": "UTC",
    "panels": [
      {
        "title": "API Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(metrics_api_request_duration_seconds_count[5m])) by (route)",
            "legendFormat": "{{ route }}"
          }
        ],
        "yAxes": [
          {
            "label": "Requests/sec"
          }
        ]
      },
      {
        "title": "API Response Time (95th percentile)",
        "type": "graph", 
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(metrics_api_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ],
        "yAxes": [
          {
            "label": "Seconds",
            "max": 1
          }
        ]
      },
      {
        "title": "Active Users by Tenant",
        "type": "graph",
        "targets": [
          {
            "expr": "metrics_active_users_total",
            "legendFormat": "Tenant {{ tenant_id }}"
          }
        ]
      },
      {
        "title": "Database Query Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(metrics_database_query_duration_seconds_bucket[5m]))",
            "legendFormat": "{{ query_type }}"
          }
        ]
      },
      {
        "title": "WebSocket Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "sum(metrics_websocket_connections_active)"
          }
        ]
      },
      {
        "title": "System Resource Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(container_cpu_usage_seconds_total[5m]) * 100",
            "legendFormat": "CPU {{ pod }}"
          },
          {
            "expr": "(container_memory_usage_bytes / container_spec_memory_limit_bytes) * 100",
            "legendFormat": "Memory {{ pod }}"
          }
        ]
      }
    ]
  }
}
```

## Expected Deliverables

1. **Monitoring Infrastructure**:
   - ✅ CloudWatch/Prometheus setup with custom metrics
   - ✅ Business KPI tracking and visualization
   - ✅ Infrastructure health monitoring
   - ✅ Real-time performance dashboards

2. **Alerting System**:
   - ✅ Critical alerts with immediate notification
   - ✅ Warning alerts with 24-hour SLA
   - ✅ Business metric anomaly detection
   - ✅ Escalation procedures and on-call integration

3. **Logging Framework**:
   - ✅ Centralized log aggregation
   - ✅ Structured JSON logging with correlation IDs
   - ✅ Security audit trail logging
   - ✅ Error tracking and stack trace collection

## Quality Gates

- [ ] All critical metrics collection functional
- [ ] Alert thresholds validated through load testing
- [ ] Log aggregation capturing 100% of application events
- [ ] Dashboards displaying real-time data with <30s latency
- [ ] Alerting system tested with mock incidents
- [ ] Performance overhead <5% of system resources

## Handoff Requirements

**From Previous Tasks**:
- Production infrastructure endpoints
- Application deployment success confirmation
- Performance baselines from testing

**To Task 10.4 (Documentation)**:
- Monitoring dashboard URLs and access procedures
- Alert escalation procedures
- Troubleshooting runbooks
- Performance benchmark documentation

**Agent**: Please implement the comprehensive monitoring and logging infrastructure. Focus on observability, proactive alerting, and operational excellence. Ensure all monitoring data is actionable and supports the production SLA requirements.