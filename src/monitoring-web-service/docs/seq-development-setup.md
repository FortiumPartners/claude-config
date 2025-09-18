# Seq Structured Logging - Development Setup Guide

## Overview

This guide covers setting up and using the Seq structured logging system for local development of the Fortium Monitoring Web Service.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed
- Basic familiarity with structured logging concepts

## Quick Start

### 1. Start the Development Environment

```bash
# Start all services including Seq
docker-compose up -d

# Or start just the Seq service for standalone testing
docker-compose up -d seq
```

### 2. Access Seq Dashboard

- **URL**: http://localhost:5341
- **Default Credentials**: No authentication required in development
- **Ingestion Port**: 45341 (rarely needed for manual access)

### 3. Verify Seq Integration

```bash
# Check health endpoint includes Seq status
curl http://localhost:3000/health

# Expected response includes seq service status
{
  "status": "healthy",
  "services": {
    "seq": {
      "status": "healthy",
      "url": "http://seq:80",
      "latency": "15ms"
    }
  }
}
```

## Environment Variables

Add these to your `.env` file for local development:

```env
# Seq Configuration (Development)
SEQ_SERVER_URL=http://localhost:5341
SEQ_API_KEY=                           # Empty for anonymous ingestion
SEQ_BATCH_SIZE=50                      # Smaller batches for development
SEQ_FLUSH_INTERVAL=5000                # 5 seconds for faster feedback
SEQ_REQUEST_TIMEOUT=10000              # 10 seconds
SEQ_ENABLE_TLS=false                   # No TLS needed locally
```

## Using Structured Logging

### Basic Logging with Correlation

```typescript
import { Request, Response } from 'express';
import { logWithContext, createContextualLogger } from '../config/logger';

export async function handleRequest(req: Request, res: Response) {
  // Use request logger with correlation context
  req.logger.info('Processing user action', {
    action: 'create_metric',
    userId: req.user?.id,
    tenantId: req.tenant?.id,
  });

  // Log with structured format
  logWithContext('info', 'User action completed', req.logContext, {
    duration: 250,
    recordsProcessed: 15,
    event: 'user.action.complete',
  });
}
```

### Database Operations with Correlation

```typescript
import { correlateDbOperation } from '../middleware/correlation.middleware';

export async function createMetric(req: Request, data: MetricData) {
  return await correlateDbOperation(req, 'INSERT', async () => {
    return await db.metric.create({ data });
  });
}
```

### External API Calls with Correlation

```typescript
import { correlateApiCall } from '../middleware/correlation.middleware';

export async function fetchExternalData(req: Request, endpoint: string) {
  return await correlateApiCall(req, 'external-api', endpoint, async () => {
    return await fetch(endpoint);
  });
}
```

## Seq Dashboard Usage

### Pre-configured Dashboards

1. **Application Overview**
   - Log volume by level
   - Error rates
   - Response time percentiles
   - Top errors

2. **Performance Monitoring**
   - Request duration distribution
   - Slow requests
   - Database query performance

3. **User Activity**
   - Active users
   - Authentication events
   - User sessions

### Useful Queries

#### Find All Requests for a User
```sql
select * from stream 
where userId = 'user123' 
order by @Timestamp desc
```

#### Track Request Flow by Correlation ID
```sql
select @Timestamp, @Level, @Message, event 
from stream 
where correlationId = 'abc-123-def'
order by @Timestamp asc
```

#### Find Slow Database Operations
```sql
select operation, duration, correlationId, @Timestamp
from stream 
where event starts with 'db.' and duration > 500
order by duration desc
```

#### Error Rate by Hour
```sql
select count(*) as ErrorCount, time(@Timestamp, '1h') as Hour
from stream 
where @Level = 'Error'
group by Hour
order by Hour desc
```

## Development Patterns

### 1. Request Correlation

Always use the correlation middleware for API endpoints:

```typescript
import { defaultCorrelationMiddleware } from '../middleware/correlation.middleware';

app.use('/api/v1', defaultCorrelationMiddleware);
```

### 2. Structured Error Logging

```typescript
try {
  await performOperation();
} catch (error) {
  req.logger.error('Operation failed', {
    operation: 'performOperation',
    error: error.message,
    stack: error.stack,
    userId: req.user?.id,
    event: 'operation.error',
  });
  throw error;
}
```

### 3. Performance Tracking

```typescript
import { trackPerformance } from '../middleware/correlation.middleware';

class UserService {
  @trackPerformance
  async createUser(req: Request, userData: UserData): Promise<User> {
    // Method automatically tracked with correlation context
    return await this.userRepository.create(userData);
  }
}
```

## Testing with Seq

### Manual Log Generation

```bash
# Send test log entry
curl -X POST http://localhost:3000/api/v1/logs \
  -H "Content-Type: application/json" \
  -H "x-correlation-id: test-123" \
  -d '{
    "entries": [{
      "level": "Information",
      "message": "Test log entry",
      "properties": {
        "userId": "test-user",
        "action": "manual-test"
      }
    }]
  }'
```

### Unit Testing with Mocked Seq

```typescript
// In your test files
jest.mock('../config/logger');

describe('Seq Integration', () => {
  it('should log with correlation context', async () => {
    const mockLogger = { info: jest.fn() };
    (createContextualLogger as jest.Mock).mockReturnValue(mockLogger);
    
    // Test your logging code
    req.logger.info('Test message', { userId: 'test' });
    
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Test message', 
      expect.objectContaining({ userId: 'test' })
    );
  });
});
```

## Configuration Options

### Seq Transport Options

```typescript
const seqTransport = createSeqTransport({
  serverUrl: 'http://localhost:5341',
  maxBatchingSize: 50,         // Smaller for development
  batchingDelay: 5000,         // 5 seconds
  requestTimeout: 10000,       // 10 seconds
  compact: false,              // Pretty formatting for development
  onError: (error) => {
    console.error('Seq error:', error.message);
  },
});
```

### Correlation Middleware Options

```typescript
const correlationMiddleware = correlationMiddleware({
  correlationHeaderName: 'x-correlation-id',
  generateNewCorrelationId: true,
  includeInResponse: true,
  logRequests: true,           // Enable request logging in development
});
```

## Common Development Tasks

### 1. Debug Correlation Issues

Check if correlation IDs are being propagated:

```typescript
app.use((req, res, next) => {
  console.log('Correlation ID:', req.correlationId);
  console.log('Log Context:', req.logContext);
  next();
});
```

### 2. Monitor Seq Performance

```typescript
import { getSeqMetrics } from '../config/logger';

app.get('/debug/seq-metrics', (req, res) => {
  const metrics = getSeqMetrics();
  res.json(metrics);
});
```

### 3. Test Circuit Breaker

```typescript
// Temporarily disable Seq to test circuit breaker
docker-compose stop seq

// Make some requests, check logs fall back to console
curl http://localhost:3000/api/v1/metrics

// Restart Seq and verify recovery
docker-compose start seq
```

## Best Practices

1. **Use Semantic Events**: Always include meaningful `event` properties:
   ```typescript
   req.logger.info('User created', {
     event: 'user.created',
     userId: newUser.id,
   });
   ```

2. **Include Context**: Add relevant context to all log entries:
   ```typescript
   req.logger.warn('Validation failed', {
     event: 'validation.failed',
     field: 'email',
     value: sanitizedEmail,
     reason: 'invalid_format',
   });
   ```

3. **Structure Performance Data**:
   ```typescript
   req.logger.info('Query completed', {
     event: 'db.query.complete',
     query: 'SELECT_USER_METRICS',
     duration: queryTime,
     rowCount: results.length,
   });
   ```

4. **Avoid Sensitive Data**: Never log passwords, tokens, or PII:
   ```typescript
   // Good
   req.logger.info('User authenticated', {
     event: 'auth.success',
     userId: user.id,
     method: 'jwt',
   });

   // Bad - never do this
   req.logger.info('Auth token', {
     token: user.accessToken,  // ❌ Security risk
   });
   ```

## Troubleshooting

See the [Seq Troubleshooting Guide](./seq-troubleshooting.md) for common issues and solutions.

## Next Steps

1. Review the [Seq query language documentation](https://docs.datalust.co/docs/the-seq-query-language)
2. Set up custom dashboards for your specific metrics
3. Configure alerts for critical errors
4. Explore Seq apps and extensions for additional functionality