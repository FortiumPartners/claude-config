# OTEL-Only Logging Configuration

This document describes how to run the Fortium Metrics Web Service with OTEL-only logging, where all logs are sent exclusively to the OpenTelemetry Collector without console or file fallbacks.

## Overview

The OTEL-only logging configuration:
- **Backend**: Disables console and file logging, routes all logs to OTEL collector
- **Frontend**: Disables console.log, sends structured logs to OTEL collector via backend API
- **OTEL Collector**: Receives, processes, and forwards logs to observability backends
- **Observability Stack**: Jaeger for traces, Prometheus for metrics, file export for logs

## Quick Start

### 1. Start OTEL-Only Environment

```bash
# Navigate to the monitoring web service directory
cd src/monitoring-web-service

# Start the OTEL-only stack
docker-compose -f docker-compose.otel-only.yml up -d

# Check service health
docker-compose -f docker-compose.otel-only.yml ps
```

### 2. Verify OTEL Collector

```bash
# Check OTEL collector health
curl http://localhost:8888/metrics

# View Z-Pages for debugging
open http://localhost:55679/debug/tracez
```

### 3. Access Services

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **OTEL Collector Metrics**: http://localhost:8888/metrics
- **Jaeger UI**: http://localhost:16686
- **Prometheus**: http://localhost:9090
- **OTEL Z-Pages**: http://localhost:55679

## Configuration Details

### Backend Configuration

**OTEL-Only Environment Variables:**
```bash
OTEL_ENABLE_LOGGING=true
OTEL_LOGGING_ONLY=true
OTEL_ENABLE_CONSOLE_LOGGING=false
OTEL_ENABLE_FILE_LOGGING=false
OTEL_ENABLE_PARALLEL_LOGGING=false
OTEL_ENABLE_SEQ_FALLBACK=false
```

**Result**: All backend logs route to OTEL collector at `http://otel-collector:4318/v1/logs`

### Frontend Configuration

**OTEL-Only Environment Variables:**
```bash
VITE_OTEL_LOGGING_ONLY=true
VITE_DISABLE_CONSOLE_LOGGING=true
VITE_OTEL_ENDPOINT=/api/v1/otel/logs
```

**Result**: Frontend logs send to backend OTEL endpoint, console.log methods are overridden

### OTEL Collector Pipeline

```
Frontend/Backend → OTLP HTTP/gRPC → OTEL Collector → [Logging, File, Jaeger, Prometheus]
```

**Processors Applied:**
- Memory limiting (512 MB)
- Resource attribute enhancement
- Sensitive data filtering
- Batch processing
- PII filtering

## Log Flow

### Backend Log Flow
```
Winston Logger → OTEL Transport → OTEL Collector → File Export + Console Debug
```

### Frontend Log Flow
```
Custom OTEL Logger → HTTP Request → Backend OTEL API → OTEL Collector → File Export
```

## Monitoring & Debugging

### OTEL Collector Health

```bash
# Health check endpoint
curl http://localhost:13133

# Metrics endpoint
curl http://localhost:8888/metrics

# Z-Pages debugging
curl http://localhost:55679/debug/servicez
```

### Log Verification

```bash
# Check exported logs
docker exec fortium-otel-collector tail -f /tmp/otel-logs.json

# Check collector logs
docker logs fortium-otel-collector

# Check backend logs (should be minimal)
docker logs fortium-backend-otel
```

### Performance Monitoring

**Key Metrics to Monitor:**
- `otelcol_receiver_accepted_log_records` - Logs received
- `otelcol_exporter_sent_log_records` - Logs exported
- `otelcol_processor_batch_batch_send_size` - Batch sizes
- `fortium_metrics_*` - Application metrics

## Troubleshooting

### Common Issues

**1. No Logs in OTEL Collector**
```bash
# Check collector configuration
docker exec fortium-otel-collector cat /etc/otel-collector-config.yaml

# Verify OTLP endpoint connectivity
curl -X POST http://localhost:4318/v1/logs \
  -H "Content-Type: application/json" \
  -d '{"resourceLogs":[]}'
```

**2. Frontend Logs Not Reaching Backend**
```bash
# Check frontend network requests
# Open browser dev tools → Network tab
# Look for POST requests to /api/v1/otel/logs

# Verify backend OTEL endpoint
curl http://localhost:3000/api/v1/otel/logs
```

**3. Backend OTEL Transport Failing**
```bash
# Check backend environment
docker exec fortium-backend-otel printenv | grep OTEL

# Review backend logs for OTEL errors
docker logs fortium-backend-otel 2>&1 | grep -i otel
```

**4. OTEL Collector Not Starting**
```bash
# Check collector configuration syntax
docker run --rm -v $(pwd)/otel-collector-config.yaml:/config.yaml \
  otel/opentelemetry-collector-contrib:latest \
  --config=/config.yaml --dry-run
```

### Debug Mode

Enable verbose logging temporarily:

```bash
# Stop current services
docker-compose -f docker-compose.otel-only.yml down

# Enable debug mode in collector config
# Edit otel-collector-config.yaml:
# telemetry:
#   logs:
#     level: debug

# Restart with debug
docker-compose -f docker-compose.otel-only.yml up -d
```

## Performance Characteristics

**Expected Performance:**
- Log latency: < 100ms (p95)
- Throughput: > 10,000 logs/minute
- Memory usage: < 512 MB (collector)
- CPU usage: < 50% (collector)

**Batch Processing:**
- Max batch size: 1024 logs
- Timeout: 10 seconds
- Memory limit: 512 MB

## Security Features

**Sensitive Data Protection:**
- PII filtering enabled
- Sensitive attribute masking
- Keyword-based content filtering
- Resource attribute validation

**Filtered Content:**
- Passwords, secrets, tokens
- API keys and credentials
- Personal information
- Stack traces (optionally)

## Production Considerations

### Scaling

**Horizontal Scaling:**
```yaml
# In docker-compose.otel-only.yml
otel-collector:
  deploy:
    replicas: 3
    resources:
      limits:
        memory: 512M
        cpus: '0.5'
```

**Vertical Scaling:**
```yaml
# Increase collector resources
memory_limiter:
  limit_mib: 1024

batch:
  send_batch_size: 2048
  send_batch_max_size: 4096
```

### High Availability

**Load Balancing:**
```yaml
# Use multiple collector endpoints
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-lb:4317
```

**Persistence:**
```yaml
# Add persistent volume for buffering
volumes:
  - otel_buffer:/var/lib/otelcol
```

### Backup Strategy

**Log Export Redundancy:**
```yaml
exporters:
  # Primary export
  otlp/primary:
    endpoint: https://primary-backend:4317

  # Backup export
  otlp/backup:
    endpoint: https://backup-backend:4317

  # Local file backup
  file/backup:
    path: /persistent/logs/backup.json
```

## Environment Migration

### From Seq to OTEL-Only

1. **Enable parallel logging**:
   ```bash
   OTEL_ENABLE_PARALLEL_LOGGING=true
   ```

2. **Validate log correlation**:
   - Compare Seq and OTEL logs
   - Verify trace correlation
   - Check performance impact

3. **Switch to OTEL-only**:
   ```bash
   OTEL_LOGGING_ONLY=true
   OTEL_ENABLE_SEQ_FALLBACK=false
   ```

4. **Remove Seq configuration**:
   - Remove Seq environment variables
   - Remove Seq Docker services
   - Clean up Seq data volumes

### From Console Logging

1. **Gradual migration**:
   ```bash
   # Phase 1: Add OTEL alongside console
   OTEL_ENABLE_LOGGING=true
   OTEL_ENABLE_CONSOLE_LOGGING=true

   # Phase 2: OTEL-only
   OTEL_LOGGING_ONLY=true
   OTEL_ENABLE_CONSOLE_LOGGING=false
   ```

2. **Frontend console override**:
   ```javascript
   // Automatic in production
   if (process.env.NODE_ENV === 'production') {
     disableConsoleLogging();
   }
   ```

## Compliance and Auditing

**Audit Trail:**
- All logs tagged with service metadata
- Correlation IDs for request tracing
- User and tenant attribution
- Timestamp precision: microseconds

**Compliance Features:**
- GDPR-compliant PII filtering
- SOX-compliant audit trails
- HIPAA-safe data handling
- Data retention controls

---

**Need Help?**
- Check Z-Pages: http://localhost:55679
- Review collector metrics: http://localhost:8888/metrics
- Examine service logs: `docker-compose -f docker-compose.otel-only.yml logs`