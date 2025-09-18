#!/usr/bin/env node

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { Resource } = require('@opentelemetry/resources');
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = require('@opentelemetry/semantic-conventions');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { metrics, trace } = require('@opentelemetry/api');

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: 'signoz-test-service',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({
      url: 'http://localhost:4318/v1/metrics',
    }),
    exportIntervalMillis: 5000,
  }),
});

// Start the SDK
sdk.start();

// Get tracer and meter
const tracer = trace.getTracer('signoz-test-tracer');
const meter = metrics.getMeter('signoz-test-meter');

// Create some metrics
const requestCounter = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests',
});

const requestDuration = meter.createHistogram('http_request_duration_ms', {
  description: 'Duration of HTTP requests in milliseconds',
});

const activeConnections = meter.createUpDownCounter('active_connections', {
  description: 'Number of active connections',
});

async function generateTestData() {
  console.log('🚀 Generating test telemetry data for SignOz...');
  
  for (let i = 0; i < 10; i++) {
    // Create a test span (trace)
    const span = tracer.startSpan(`test-operation-${i}`, {
      attributes: {
        'http.method': i % 2 === 0 ? 'GET' : 'POST',
        'http.url': `https://api.example.com/users/${i}`,
        'http.status_code': i % 5 === 0 ? 500 : 200,
        'user.id': `user-${i}`,
        'environment': 'test',
      },
    });

    // Add some events to the span
    span.addEvent('Processing request', {
      'request.size': Math.floor(Math.random() * 1000),
    });

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    if (i % 5 === 0) {
      // Simulate an error
      span.recordException(new Error(`Test error for operation ${i}`));
      span.setStatus({ code: 2, message: 'Internal error' }); // ERROR status
    }

    span.addEvent('Request completed', {
      'response.size': Math.floor(Math.random() * 2000),
    });

    // Record metrics
    requestCounter.add(1, {
      method: i % 2 === 0 ? 'GET' : 'POST',
      status: i % 5 === 0 ? '500' : '200',
      endpoint: `/users/${i}`,
    });

    requestDuration.record(Math.random() * 200 + 50, {
      method: i % 2 === 0 ? 'GET' : 'POST',
      status: i % 5 === 0 ? '500' : '200',
    });

    activeConnections.add(i % 3 === 0 ? 1 : -1, {
      server: 'web-server-1',
    });

    span.end();
    
    console.log(`✅ Generated trace and metrics for operation ${i + 1}/10`);
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Generate some additional custom metrics
  const customGauge = meter.createObservableGauge('memory_usage_bytes', {
    description: 'Memory usage in bytes',
  });

  customGauge.addCallback((result) => {
    result.observe(Math.random() * 1000000000, {
      process: 'signoz-test',
      host: 'test-host',
    });
  });

  console.log('📊 Generated custom metrics');
  
  // Keep running for a bit to ensure metrics are exported
  console.log('⏳ Waiting for final metric export...');
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  console.log('✨ Test data generation completed!');
  console.log('🔍 Check SignOz UI at http://localhost:3301 to view the data');
  
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await sdk.shutdown();
  process.exit(0);
});

// Start generating test data
generateTestData().catch((error) => {
  console.error('❌ Error generating test data:', error);
  process.exit(1);
});