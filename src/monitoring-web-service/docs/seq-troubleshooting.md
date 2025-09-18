# Seq Structured Logging - Troubleshooting Guide

## Common Issues and Solutions

### 1. Seq Service Won't Start

#### Problem: Docker container fails to start

**Symptoms:**
- `docker-compose up seq` fails
- Container exits immediately
- "EULA not accepted" error

**Solution:**
```bash
# Ensure EULA is accepted in docker-compose.yml
environment:
  - ACCEPT_EULA=Y

# Check Docker logs
docker-compose logs seq

# Restart with fresh volumes if needed
docker-compose down -v
docker-compose up -d seq
```

#### Problem: Port conflicts

**Symptoms:**
- "Port 5341 already in use" error
- Cannot access Seq dashboard

**Solution:**
```bash
# Check what's using the port
lsof -i :5341

# Change the port in docker-compose.yml
ports:
  - "5342:80"  # Use different external port

# Update environment variable
SEQ_SERVER_URL=http://localhost:5342
```

### 2. Logs Not Appearing in Seq

#### Problem: Application logs don't appear in Seq dashboard

**Check Health Status:**
```bash
curl http://localhost:3000/health | jq '.services.seq'
```

**Expected Response:**
```json
{
  "status": "healthy",
  "url": "http://seq:80",
  "latency": "15ms"
}
```

**Common Solutions:**

1. **Check Seq connectivity:**
```bash
# Test direct connection to Seq
curl http://localhost:5341/api/version

# Should return Seq version info
```

2. **Verify environment variables:**
```bash
# In your application container
echo $SEQ_SERVER_URL
echo $SEQ_BATCH_SIZE

# Should match your configuration
```

3. **Check network connectivity:**
```bash
# Test from app container to seq container
docker exec metrics-api ping seq
docker exec metrics-api curl -f http://seq:80/api/version
```

#### Problem: Circuit breaker is open

**Symptoms:**
- Health check shows `"circuitBreakerOpen": true`
- Logs appear in console but not Seq

**Solution:**
```bash
# Check Seq metrics for failure count
curl http://localhost:3000/health | jq '.services.seq.metrics'

# Restart application to reset circuit breaker
docker-compose restart metrics-api

# Or wait for automatic reset (30 seconds by default)
```

### 3. Performance Issues

#### Problem: High latency to Seq

**Symptoms:**
- Seq health check shows high latency (>100ms)
- Application responses are slow

**Diagnosis:**
```bash
# Check Seq metrics
curl http://localhost:3000/health | jq '.services.seq.metrics'

# Monitor Seq container resources
docker stats metrics-seq
```

**Solutions:**

1. **Increase batch size to reduce frequency:**
```env
SEQ_BATCH_SIZE=100
SEQ_FLUSH_INTERVAL=30000
```

2. **Check Docker resources:**
```yaml
# In docker-compose.yml
seq:
  deploy:
    resources:
      limits:
        memory: 2G
        cpus: '1.0'
```

3. **Use async logging pattern:**
```typescript
// Configure transport for fire-and-forget
const seqTransport = createSeqTransport({
  batchingDelay: 1000,  // Batch more aggressively
  compact: true,        // Reduce payload size
});
```

#### Problem: High memory usage

**Symptoms:**
- Application memory grows continuously
- Out of memory errors

**Solutions:**

1. **Check buffer size:**
```typescript
const metrics = getSeqMetrics();
console.log('Buffer size:', metrics.bufferSize);
```

2. **Reduce buffer limits:**
```typescript
const seqTransport = createSeqTransport({
  maxBatchingSize: 50,  // Smaller batches
  batchingDelay: 5000,  // More frequent flushing
});
```

### 4. Authentication Issues

#### Problem: Seq returns 401 Unauthorized

**Symptoms:**
- Seq health status is "unhealthy"
- "Unauthorized" errors in logs

**Solution for Development:**
```json
// In seq/seq.json
{
  "api": {
    "authentication": {
      "provider": "Seq",
      "allowAnonymousIngestion": true
    }
  }
}
```

**Solution for Production:**
```env
# Set API key
SEQ_API_KEY=your-production-api-key
```

### 5. Data Volume Issues

#### Problem: Seq storage fills up quickly

**Symptoms:**
- Disk space warnings
- Old logs disappearing

**Solutions:**

1. **Configure retention policy:**
```json
// In seq/seq.json
{
  "storage": {
    "retentionDays": 7,        // Keep only 7 days in development
    "retentionSizeGb": 1,      // Limit to 1GB
    "compactionEnabled": true
  }
}
```

2. **Reduce log volume in development:**
```typescript
// Use lightweight middleware for high-traffic endpoints
app.use('/api/v1/metrics', lightCorrelationMiddleware);
```

### 6. Docker Compose Issues

#### Problem: Service dependency failures

**Symptoms:**
- App starts before Seq is ready
- Connection refused errors

**Solution:**
```yaml
# Ensure proper health checks and dependencies
depends_on:
  seq:
    condition: service_healthy

healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:80/api/version"]
  interval: 30s
  timeout: 10s
  start_period: 60s
  retries: 5
```

#### Problem: Volume mount issues

**Symptoms:**
- Configuration file not found
- Data not persisting

**Solution:**
```bash
# Check volume mounts
docker inspect metrics-seq | jq '.[0].Mounts'

# Ensure file exists and is readable
ls -la ./seq/seq.json
chmod 644 ./seq/seq.json

# Recreate volumes if corrupted
docker-compose down -v
docker-compose up -d
```

### 7. Development Workflow Issues

#### Problem: Changes to logging code not taking effect

**Solution:**
```bash
# Restart application container
docker-compose restart metrics-api

# Or rebuild if you changed dependencies
docker-compose build metrics-api
docker-compose up -d metrics-api
```

#### Problem: Can't see correlation between frontend and backend logs

**Check correlation headers:**
```javascript
// In browser DevTools Network tab, check headers
// Should see x-correlation-id in request headers

// In Seq, query by correlation ID
correlationId = 'abc-123-def' 
order by @Timestamp asc
```

## Debugging Commands

### Test Seq Transport Directly

```bash
# Test log ingestion directly
curl -X POST http://localhost:5341/api/events/raw \
  -H "Content-Type: application/json" \
  -d '{
    "@t": "2025-09-10T15:30:00.000Z",
    "@l": "Information",
    "@m": "Test log entry",
    "test": true
  }'
```

### Monitor Winston Logs

```typescript
// Add debug logging to Winston transport
logger.on('logged', (info) => {
  console.log('Winston logged:', info);
});

logger.on('error', (err) => {
  console.error('Winston error:', err);
});
```

### Check Application Metrics

```bash
# Get detailed Seq transport metrics
curl http://localhost:3000/health | jq '.services.seq.metrics'

# Expected output:
{
  "totalLogs": 150,
  "successfulLogs": 148,
  "failedLogs": 2,
  "averageLatency": 23,
  "circuitBreakerOpen": false,
  "bufferSize": 0
}
```

## Environment-Specific Troubleshooting

### Development Environment

```bash
# Enable verbose logging
export LOG_LEVEL=debug
docker-compose up -d

# Check all service logs
docker-compose logs -f
```

### Testing Environment

```bash
# Seq transport should be disabled in tests
NODE_ENV=test npm test

# Verify no Seq connections in test logs
```

### Production Environment

```bash
# Check production health
curl https://your-app.com/health

# Monitor Seq server status
curl https://your-seq-server.com/api/version
```

## Getting Help

### Useful Log Queries

1. **Find all errors in last hour:**
```sql
@Level = 'Error' and @Timestamp > now() - 1h
order by @Timestamp desc
```

2. **Track slow requests:**
```sql
has(duration) and duration > 1000
order by duration desc
```

3. **Monitor circuit breaker status:**
```sql
@Message like '%circuit breaker%'
order by @Timestamp desc
```

### Support Resources

- [Seq Documentation](https://docs.datalust.co/)
- [Winston Transport Documentation](https://github.com/winstonjs/winston#transports)
- [Docker Compose Documentation](https://docs.docker.com/compose/)

### Internal Support

1. Check the health endpoint: `/health`
2. Review application logs: `docker-compose logs metrics-api`
3. Check Seq server logs: `docker-compose logs seq`
4. Validate configuration: Review `.env` and `seq/seq.json`

## Performance Optimization

### For Development

```env
# Optimize for fast feedback
SEQ_BATCH_SIZE=10
SEQ_FLUSH_INTERVAL=2000
SEQ_REQUEST_TIMEOUT=5000
```

### For Production

```env
# Optimize for throughput
SEQ_BATCH_SIZE=100
SEQ_FLUSH_INTERVAL=30000
SEQ_REQUEST_TIMEOUT=10000
```

### Circuit Breaker Tuning

```typescript
// In seq-transport.ts, adjust thresholds:
private static readonly FAILURE_THRESHOLD = 3;        // Lower in development
private static readonly SUCCESS_THRESHOLD = 2;         // Faster recovery
private static readonly CIRCUIT_RESET_TIMEOUT = 15000; // 15s instead of 30s
```

---

**Note**: This troubleshooting guide covers the most common issues encountered during development. For production deployment issues, refer to the production deployment guide.