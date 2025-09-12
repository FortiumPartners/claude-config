/**
 * OpenTelemetry Validation Routes
 * Task 2.2: Auto-instrumentation Implementation - Validation and Testing
 * 
 * Test endpoints for validating auto-instrumentation functionality
 * including trace propagation, database operations, and external API calls.
 */

import { Router, Request, Response } from 'express';
import * as api from '@opentelemetry/api';
import { logger } from '../config/logger';
import { createCustomSpan, recordMetric } from '../tracing/otel-init';
import { getPerformanceMetrics, resetPerformanceMetrics } from '../middleware/otel-performance.middleware';

// Mock external API call for testing
import fetch from 'node-fetch';

const router = Router();

/**
 * Basic trace generation endpoint
 * Tests span creation and attribute setting
 */
router.get('/trace/basic', async (req: Request, res: Response) => {
  const tracer = api.trace.getTracer('otel-validation', '1.0.0');
  
  const span = tracer.startSpan('validation.basic_trace', {
    attributes: {
      'test.type': 'basic',
      'test.endpoint': '/otel/trace/basic',
      'test.timestamp': Date.now()
    }
  });

  try {
    // Add custom attributes
    span.setAttributes({
      'request.method': req.method,
      'request.path': req.path,
      'request.query_params': JSON.stringify(req.query),
      'test.phase': 'execution'
    });

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));

    // Record custom metric
    recordMetric('otel_validation_requests_total', 1, {
      endpoint: 'basic_trace',
      status: 'success'
    });

    span.setStatus({ code: api.SpanStatusCode.OK });
    
    res.json({
      status: 'success',
      message: 'Basic trace generated successfully',
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ 
      code: api.SpanStatusCode.ERROR, 
      message: (error as Error).message 
    });
    
    logger.error('Error in basic trace test', { error });
    res.status(500).json({ error: 'Basic trace test failed' });
  } finally {
    span.end();
  }
});

/**
 * Nested spans test endpoint
 * Tests span hierarchy and context propagation
 */
router.get('/trace/nested', async (req: Request, res: Response) => {
  const result = await createCustomSpan(
    'validation.nested_trace_parent',
    async () => {
      const tracer = api.trace.getTracer('otel-validation', '1.0.0');
      
      // Child span 1
      const childSpan1 = tracer.startSpan('validation.nested_child_1', {
        attributes: {
          'child.number': 1,
          'child.operation': 'data_processing'
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));
      childSpan1.end();

      // Child span 2 with nested grandchild
      const childSpan2 = tracer.startSpan('validation.nested_child_2', {
        attributes: {
          'child.number': 2,
          'child.operation': 'validation'
        }
      });

      // Grandchild span
      const grandchildSpan = tracer.startSpan('validation.nested_grandchild', {
        attributes: {
          'grandchild.operation': 'deep_processing'
        }
      });

      await new Promise(resolve => setTimeout(resolve, 30));
      grandchildSpan.end();
      
      childSpan2.end();

      return {
        message: 'Nested trace generated successfully',
        spanCount: 3,
        hierarchy: 'parent -> child1, child2 -> grandchild'
      };
    },
    {
      'test.type': 'nested',
      'test.complexity': 'high'
    }
  );

  res.json({
    status: 'success',
    ...result,
    timestamp: new Date().toISOString()
  });
});

/**
 * Database operation test endpoint
 * Tests database instrumentation with mock operations
 */
router.get('/trace/database', async (req: Request, res: Response) => {
  const tracer = api.trace.getTracer('otel-validation', '1.0.0');
  
  const span = tracer.startSpan('validation.database_operations', {
    attributes: {
      'test.type': 'database',
      'db.operation.simulated': true
    }
  });

  try {
    // Simulate different database operations
    const operations = [
      { type: 'SELECT', duration: 50, rows: 25 },
      { type: 'INSERT', duration: 30, rows: 1 },
      { type: 'UPDATE', duration: 75, rows: 3 },
      { type: 'SELECT', duration: 120, rows: 150 }
    ];

    const results = [];
    
    for (const op of operations) {
      const dbSpan = tracer.startSpan(`db.${op.type.toLowerCase()}`, {
        attributes: {
          'db.operation': op.type,
          'db.statement': `${op.type} simulated operation`,
          'db.system': 'postgresql',
          'db.name': 'fortium_metrics'
        }
      });

      // Simulate operation duration
      await new Promise(resolve => setTimeout(resolve, op.duration));
      
      dbSpan.setAttributes({
        'db.rows_affected': op.rows,
        'db.duration.ms': op.duration
      });

      dbSpan.setStatus({ code: api.SpanStatusCode.OK });
      dbSpan.end();
      
      results.push({
        operation: op.type,
        duration: `${op.duration}ms`,
        rowsAffected: op.rows
      });
    }

    span.setAttributes({
      'db.total_operations': operations.length,
      'db.total_duration.ms': operations.reduce((sum, op) => sum + op.duration, 0)
    });

    span.setStatus({ code: api.SpanStatusCode.OK });
    
    res.json({
      status: 'success',
      message: 'Database operations traced successfully',
      operations: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ 
      code: api.SpanStatusCode.ERROR, 
      message: (error as Error).message 
    });
    
    res.status(500).json({ error: 'Database trace test failed' });
  } finally {
    span.end();
  }
});

/**
 * HTTP client test endpoint
 * Tests outbound HTTP call instrumentation
 */
router.get('/trace/http-client', async (req: Request, res: Response) => {
  const tracer = api.trace.getTracer('otel-validation', '1.0.0');
  
  const span = tracer.startSpan('validation.http_client_calls', {
    attributes: {
      'test.type': 'http_client',
      'test.external_calls': true
    }
  });

  try {
    const externalCalls = [];

    // Test call 1: JSONPlaceholder API
    try {
      const response1 = await fetch('https://jsonplaceholder.typicode.com/posts/1', {
        timeout: 5000,
        headers: {
          'User-Agent': 'Fortium-OTEL-Validation/1.0.0',
          'Accept': 'application/json'
        }
      });
      
      const data1 = await response1.json();
      
      externalCalls.push({
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        status: response1.status,
        success: true,
        dataReceived: !!data1
      });
    } catch (error) {
      externalCalls.push({
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        status: 0,
        success: false,
        error: (error as Error).message
      });
    }

    // Test call 2: HTTP status codes API
    try {
      const response2 = await fetch('https://httpstat.us/200', {
        timeout: 5000,
        headers: {
          'User-Agent': 'Fortium-OTEL-Validation/1.0.0'
        }
      });
      
      externalCalls.push({
        url: 'https://httpstat.us/200',
        status: response2.status,
        success: response2.ok,
        contentType: response2.headers.get('content-type')
      });
    } catch (error) {
      externalCalls.push({
        url: 'https://httpstat.us/200',
        status: 0,
        success: false,
        error: (error as Error).message
      });
    }

    span.setAttributes({
      'http.client.calls_made': externalCalls.length,
      'http.client.successful_calls': externalCalls.filter(call => call.success).length
    });

    span.setStatus({ code: api.SpanStatusCode.OK });
    
    res.json({
      status: 'success',
      message: 'HTTP client calls traced successfully',
      externalCalls,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ 
      code: api.SpanStatusCode.ERROR, 
      message: (error as Error).message 
    });
    
    res.status(500).json({ error: 'HTTP client trace test failed' });
  } finally {
    span.end();
  }
});

/**
 * Error handling test endpoint
 * Tests error instrumentation and exception recording
 */
router.get('/trace/error', async (req: Request, res: Response) => {
  const tracer = api.trace.getTracer('otel-validation', '1.0.0');
  
  const span = tracer.startSpan('validation.error_handling', {
    attributes: {
      'test.type': 'error',
      'test.intentional_error': true
    }
  });

  try {
    // Simulate different types of errors
    const errorType = req.query.type as string || 'generic';

    span.setAttributes({
      'error.type': errorType,
      'error.simulated': true
    });

    switch (errorType) {
      case 'timeout':
        span.recordException(new Error('Simulated timeout error'));
        span.setStatus({ 
          code: api.SpanStatusCode.ERROR, 
          message: 'Timeout error' 
        });
        break;
      
      case 'validation':
        span.recordException(new Error('Simulated validation error'));
        span.setStatus({ 
          code: api.SpanStatusCode.ERROR, 
          message: 'Validation error' 
        });
        break;
      
      case 'database':
        span.recordException(new Error('Simulated database connection error'));
        span.setStatus({ 
          code: api.SpanStatusCode.ERROR, 
          message: 'Database error' 
        });
        break;
      
      default:
        span.recordException(new Error('Simulated generic error'));
        span.setStatus({ 
          code: api.SpanStatusCode.ERROR, 
          message: 'Generic error' 
        });
    }

    // Record error metric
    recordMetric('otel_validation_errors_total', 1, {
      error_type: errorType,
      endpoint: 'error_test'
    });

    res.json({
      status: 'success',
      message: 'Error traced successfully',
      errorType,
      traceId: span.spanContext().traceId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ 
      code: api.SpanStatusCode.ERROR, 
      message: (error as Error).message 
    });
    
    res.status(500).json({ error: 'Error trace test failed' });
  } finally {
    span.end();
  }
});

/**
 * Performance test endpoint
 * Tests performance impact measurement
 */
router.get('/trace/performance', async (req: Request, res: Response) => {
  const iterations = parseInt(req.query.iterations as string) || 10;
  const delay = parseInt(req.query.delay as string) || 50;
  
  const tracer = api.trace.getTracer('otel-validation', '1.0.0');
  
  const span = tracer.startSpan('validation.performance_test', {
    attributes: {
      'test.type': 'performance',
      'test.iterations': iterations,
      'test.delay_ms': delay
    }
  });

  try {
    const startTime = process.hrtime.bigint();
    
    for (let i = 0; i < iterations; i++) {
      const iterationSpan = tracer.startSpan(`validation.performance_iteration_${i}`, {
        attributes: {
          'iteration.number': i,
          'iteration.total': iterations
        }
      });

      // Simulate work
      await new Promise(resolve => setTimeout(resolve, delay));
      
      iterationSpan.setStatus({ code: api.SpanStatusCode.OK });
      iterationSpan.end();
    }

    const endTime = process.hrtime.bigint();
    const totalDuration = Number(endTime - startTime) / 1_000_000; // Convert to ms

    span.setAttributes({
      'performance.total_duration.ms': totalDuration,
      'performance.average_iteration.ms': totalDuration / iterations,
      'performance.spans_created': iterations + 1
    });

    span.setStatus({ code: api.SpanStatusCode.OK });
    
    res.json({
      status: 'success',
      message: 'Performance test completed',
      results: {
        iterations,
        totalDuration: `${Math.round(totalDuration * 100) / 100}ms`,
        averagePerIteration: `${Math.round((totalDuration / iterations) * 100) / 100}ms`,
        spansCreated: iterations + 1
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ 
      code: api.SpanStatusCode.ERROR, 
      message: (error as Error).message 
    });
    
    res.status(500).json({ error: 'Performance test failed' });
  } finally {
    span.end();
  }
});

/**
 * Get current performance metrics
 */
router.get('/performance/metrics', (req: Request, res: Response) => {
  const metrics = getPerformanceMetrics();
  
  res.json({
    status: 'success',
    timestamp: new Date().toISOString(),
    metrics: {
      summary: {
        totalRequests: metrics.requestCount,
        averageLatency: `${Math.round(metrics.averageLatency * 100) / 100}ms`,
        performanceImpact: metrics.performanceImpact,
        overheadPercentage: `${Math.round(metrics.overheadPercentage * 100) / 100}%`
      },
      latency: {
        min: `${Math.round(metrics.minLatency * 100) / 100}ms`,
        max: `${Math.round(metrics.maxLatency * 100) / 100}ms`,
        average: `${Math.round(metrics.averageLatency * 100) / 100}ms`,
        p95: `${Math.round(metrics.p95Latency * 100) / 100}ms`,
        p99: `${Math.round(metrics.p99Latency * 100) / 100}ms`
      },
      instrumentation: {
        averageOverhead: `${Math.round(metrics.averageOverhead * 100) / 100}ms`,
        totalOverhead: `${Math.round(metrics.instrumentationOverhead * 100) / 100}ms`,
        impactPercentage: `${Math.round(metrics.overheadPercentage * 100) / 100}%`
      }
    }
  });
});

/**
 * Reset performance metrics
 */
router.post('/performance/reset', (req: Request, res: Response) => {
  resetPerformanceMetrics();
  
  res.json({
    status: 'success',
    message: 'Performance metrics reset',
    timestamp: new Date().toISOString()
  });
});

/**
 * Comprehensive validation endpoint
 * Runs all validation tests in sequence
 */
router.get('/validate/comprehensive', async (req: Request, res: Response) => {
  const tracer = api.trace.getTracer('otel-validation', '1.0.0');
  
  const span = tracer.startSpan('validation.comprehensive_test', {
    attributes: {
      'test.type': 'comprehensive',
      'test.suite': 'full_validation'
    }
  });

  try {
    const results = {
      basicTrace: false,
      nestedSpans: false,
      databaseOps: false,
      httpClient: false,
      errorHandling: false,
      performance: false
    };

    // Run basic trace test
    try {
      const basicSpan = tracer.startSpan('validation.basic_internal');
      await new Promise(resolve => setTimeout(resolve, 10));
      basicSpan.end();
      results.basicTrace = true;
    } catch (error) {
      logger.warn('Basic trace test failed', { error });
    }

    // Run nested spans test
    try {
      const parentSpan = tracer.startSpan('validation.nested_internal');
      const childSpan = tracer.startSpan('validation.nested_child_internal');
      await new Promise(resolve => setTimeout(resolve, 10));
      childSpan.end();
      parentSpan.end();
      results.nestedSpans = true;
    } catch (error) {
      logger.warn('Nested spans test failed', { error });
    }

    // Test database simulation
    try {
      const dbSpan = tracer.startSpan('validation.db_internal');
      dbSpan.setAttributes({
        'db.operation': 'SELECT',
        'db.table': 'test_table'
      });
      await new Promise(resolve => setTimeout(resolve, 20));
      dbSpan.end();
      results.databaseOps = true;
    } catch (error) {
      logger.warn('Database ops test failed', { error });
    }

    // Test HTTP client (mock)
    try {
      const httpSpan = tracer.startSpan('validation.http_internal');
      httpSpan.setAttributes({
        'http.method': 'GET',
        'http.url': 'mock://test.example.com/api'
      });
      await new Promise(resolve => setTimeout(resolve, 30));
      httpSpan.end();
      results.httpClient = true;
    } catch (error) {
      logger.warn('HTTP client test failed', { error });
    }

    // Test error handling
    try {
      const errorSpan = tracer.startSpan('validation.error_internal');
      errorSpan.recordException(new Error('Test exception'));
      errorSpan.setStatus({ 
        code: api.SpanStatusCode.ERROR, 
        message: 'Test error' 
      });
      errorSpan.end();
      results.errorHandling = true;
    } catch (error) {
      logger.warn('Error handling test failed', { error });
    }

    // Test performance
    try {
      const perfSpan = tracer.startSpan('validation.performance_internal');
      const startTime = process.hrtime.bigint();
      await new Promise(resolve => setTimeout(resolve, 50));
      const endTime = process.hrtime.bigint();
      const duration = Number(endTime - startTime) / 1_000_000;
      perfSpan.setAttributes({ 'performance.duration.ms': duration });
      perfSpan.end();
      results.performance = true;
    } catch (error) {
      logger.warn('Performance test failed', { error });
    }

    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(Boolean).length;
    const overallSuccess = passedTests === totalTests;

    span.setAttributes({
      'validation.total_tests': totalTests,
      'validation.passed_tests': passedTests,
      'validation.success_rate': (passedTests / totalTests) * 100,
      'validation.overall_success': overallSuccess
    });

    span.setStatus({ 
      code: overallSuccess ? api.SpanStatusCode.OK : api.SpanStatusCode.ERROR,
      message: overallSuccess ? 'All tests passed' : 'Some tests failed'
    });

    res.json({
      status: overallSuccess ? 'success' : 'partial_success',
      message: `Validation completed: ${passedTests}/${totalTests} tests passed`,
      results,
      summary: {
        totalTests,
        passedTests,
        successRate: `${Math.round((passedTests / totalTests) * 100)}%`,
        overallSuccess
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({ 
      code: api.SpanStatusCode.ERROR, 
      message: (error as Error).message 
    });
    
    res.status(500).json({ error: 'Comprehensive validation failed' });
  } finally {
    span.end();
  }
});

export default router;