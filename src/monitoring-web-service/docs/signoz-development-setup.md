# SignOz Development Environment Setup

## Task 1.1: Development Environment Setup for Seq to OpenTelemetry + SignOz Migration

This document provides comprehensive instructions for setting up SignOz observability platform with OpenTelemetry for the Fortium Monitoring Web Service.

## 📋 Overview

SignOz is an open-source observability platform that provides:
- **Distributed Tracing**: End-to-end request tracking
- **Metrics Monitoring**: Application and infrastructure metrics  
- **Logs Management**: Centralized log aggregation
- **Alerting**: Real-time alerts and notifications
- **Service Maps**: Visual service dependency mapping

## 🏗️ Architecture

```
┌─────────────────┐    ┌────────────────────┐    ┌─────────────────┐
│   Application   │───▶│  OTEL Collector    │───▶│   ClickHouse    │
│   (Node.js)     │    │  (Telemetry        │    │   (Storage)     │
│                 │    │   Processing)      │    │                 │
└─────────────────┘    └────────────────────┘    └─────────────────┘
                                │                          │
                                ▼                          ▼
┌─────────────────┐    ┌────────────────────┐    ┌─────────────────┐
│  SignOz Frontend│◀───│  Query Service     │◀───│  Alert Manager  │
│  (Web UI)       │    │  (API Backend)     │    │  (Notifications)│
│  Port: 3301     │    │  Port: 8080        │    │  Port: 9093     │
└─────────────────┘    └────────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose v2.x
- Node.js 18+
- 8GB RAM minimum
- 20GB disk space

### 1. Start SignOz Environment

```bash
# Start all SignOz services
npm run signoz:start

# Check service status
docker-compose -f docker-compose.signoz.yml ps

# View logs
npm run signoz:logs
```

### 2. Install Dependencies

```bash
# Install OpenTelemetry packages
npm install

# The following packages are automatically included:
# - @opentelemetry/api
# - @opentelemetry/sdk-node
# - @opentelemetry/auto-instrumentations-node
# - @opentelemetry/exporter-otlp-http
# - @opentelemetry/exporter-prometheus
# - Additional instrumentation packages
```

### 3. Run Application with OpenTelemetry

```bash
# Development mode with OpenTelemetry
npm run dev:otel

# Production mode with OpenTelemetry  
npm run start:otel
```

### 4. Access SignOz UI

Open [http://localhost:3301](http://localhost:3301) in your browser.

## 📊 Service Endpoints

| Service | Endpoint | Description |
|---------|----------|-------------|
| SignOz UI | http://localhost:3301 | Main observability dashboard |
| Query Service | http://localhost:8080 | API backend for queries |
| OTEL Collector (HTTP) | http://localhost:4318 | OTLP HTTP receiver |
| OTEL Collector (gRPC) | http://localhost:4317 | OTLP gRPC receiver |
| ClickHouse HTTP | http://localhost:8123 | Database HTTP interface |
| ClickHouse Native | tcp://localhost:9000 | Database native protocol |
| Collector Metrics | http://localhost:8888/metrics | Internal collector metrics |
| Collector Health | http://localhost:13133 | Health check endpoint |
| Alert Manager | http://localhost:9093 | Alert management UI |

## 🔧 Configuration Files

### Core Configuration

- **`docker-compose.signoz.yml`**: Complete SignOz stack definition
- **`signoz/otel-collector-config.yaml`**: OTEL Collector configuration
- **`signoz/clickhouse-config.xml`**: ClickHouse database configuration
- **`src/tracing/otel-init.ts`**: OpenTelemetry SDK initialization
- **`.env.otel`**: Environment variables for OTEL configuration

### Development Tools

- **`.vscode/launch.json`**: VS Code debugging with OTEL support
- **`.vscode/settings.json`**: Workspace settings and file associations
- **`scripts/validate-signoz-integration.ts`**: Comprehensive validation script
- **`scripts/test-otel-integration.ts`**: OTEL integration testing

## 🧪 Testing and Validation

### Comprehensive Validation

Run the complete integration validation:

```bash
npm run validate:signoz
```

This checks:
- ✅ Docker services status
- ✅ Network connectivity
- ✅ ClickHouse accessibility
- ✅ OTEL Collector health
- ✅ Query Service API
- ✅ SignOz Frontend
- ✅ Configuration files

### OTEL Integration Testing

Generate test telemetry data:

```bash
npm run otel:test
```

This creates:
- 🔍 Sample traces with nested spans
- 📊 Various metric types (counters, histograms, gauges)
- 🎯 Complex user journey simulation
- 🌐 Direct OTLP endpoint testing

### Manual Testing

```bash
# Test OTEL Collector health
curl http://localhost:13133

# Test ClickHouse connectivity
curl "http://localhost:8123?query=SELECT version()"

# Test OTLP HTTP receiver
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{"resourceSpans":[]}'

# View collector metrics
curl http://localhost:8888/metrics
```

## 🐛 Debugging

### VS Code Debugging

Launch configurations available:
- **Debug with OpenTelemetry**: Full OTEL instrumentation
- **Debug without OpenTelemetry**: Standard debugging
- **Debug Tests with OpenTelemetry**: Test debugging with traces
- **Validate SignOz Integration**: Run validation script

### Log Analysis

```bash
# View all logs
npm run signoz:logs

# Specific service logs
docker-compose -f docker-compose.signoz.yml logs signoz-otel-collector
docker-compose -f docker-compose.signoz.yml logs signoz-clickhouse
docker-compose -f docker-compose.signoz.yml logs signoz-query-service
```

### Common Issues

#### 1. Services Not Starting

```bash
# Check system resources
docker system df
docker system prune

# Reset SignOz environment
npm run signoz:clean
npm run signoz:start
```

#### 2. Port Conflicts

Check if ports are in use:
```bash
lsof -i :3301  # SignOz UI
lsof -i :4318  # OTEL HTTP
lsof -i :8123  # ClickHouse
```

#### 3. ClickHouse Connection Issues

```bash
# Check ClickHouse logs
docker-compose -f docker-compose.signoz.yml logs signoz-clickhouse

# Test direct connection
docker exec -it signoz-clickhouse clickhouse-client
```

#### 4. OTEL Collector Issues

```bash
# Validate collector config
docker-compose -f docker-compose.signoz.yml exec signoz-otel-collector \
  /otelcol-signoz --config=/etc/otelcol-signoz/config.yaml --dry-run

# Check collector health
curl -f http://localhost:13133 || echo "Collector unhealthy"
```

## 📈 Performance Tuning

### Resource Limits (Development)

Current configuration optimized for development:

- **ClickHouse**: 1GB RAM, 0.5 CPU
- **OTEL Collector**: 512MB RAM, 0.5 CPU  
- **Query Service**: 512MB RAM, 0.5 CPU
- **Total**: ~2GB RAM, 1.5 CPU

### Batch Processing

OTEL Collector batch configuration:
```yaml
processors:
  batch:
    timeout: 1s
    send_batch_size: 1024
    send_batch_max_size: 2048
```

### Data Retention

ClickHouse retention (30 days for development):
```xml
<query_log>
  <ttl>event_date + INTERVAL 30 DAY DELETE</ttl>
</query_log>
```

## 🔒 Security Configuration

### Development Security

- Anonymous access enabled for development
- Default passwords (change for production)
- Internal network communication only
- CORS enabled for localhost

### Production Considerations

For production deployment:
1. Enable authentication in ClickHouse
2. Configure SSL/TLS certificates
3. Set up proper network security groups
4. Enable audit logging
5. Configure backup and disaster recovery

## 📚 Useful Commands

### Docker Management

```bash
# Start SignOz stack
npm run signoz:start

# Stop SignOz stack  
npm run signoz:stop

# View logs
npm run signoz:logs

# Clean up (removes volumes)
npm run signoz:clean

# Restart specific service
docker-compose -f docker-compose.signoz.yml restart signoz-otel-collector
```

### Application Development

```bash
# Start with OTEL tracing
npm run dev:otel

# Start without OTEL tracing
npm run dev

# Build with OTEL support
npm run build

# Run production with OTEL
npm run start:otel
```

### Monitoring and Validation

```bash
# Full integration validation
npm run validate:signoz

# Generate test telemetry
npm run otel:test

# Check application health
curl http://localhost:3000/health

# Check OTEL collector health
curl http://localhost:13133
```

## 🎯 Next Steps

After successful setup:

1. **Explore SignOz UI**: Navigate to http://localhost:3301
2. **View Application Traces**: Look for service "fortium-monitoring-service"
3. **Check Metrics Dashboard**: Monitor application performance
4. **Set Up Alerts**: Configure alerts for critical metrics
5. **Integrate with CI/CD**: Add observability to deployment pipelines

## 📖 Additional Resources

- [SignOz Documentation](https://signoz.io/docs/)
- [OpenTelemetry Node.js](https://opentelemetry.io/docs/instrumentation/js/)
- [ClickHouse Documentation](https://clickhouse.com/docs/)
- [Docker Compose Reference](https://docs.docker.com/compose/)

## 🆘 Support

For issues and questions:
1. Check the validation script output
2. Review service logs
3. Consult the troubleshooting section above
4. Refer to the official SignOz documentation