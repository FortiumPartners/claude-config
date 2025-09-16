/**
 * Simple OpenTelemetry Validation Test
 * Tests basic OTEL initialization without seq-logging conflicts
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { trace } = require('@opentelemetry/api');

console.log('🧪 Starting OpenTelemetry Validation Test...');

try {
  // Initialize OTEL SDK
  const sdk = new NodeSDK({
    resource: new Resource({
      'service.name': 'fortium-metrics-otel-test',
      'service.version': '1.0.0',
    }),
    traceExporter: new OTLPTraceExporter({
      url: 'http://localhost:4318/v1/traces',
      headers: {},
    }),
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    })],
  });

  // Start the SDK
  sdk.start();
  console.log('✅ OpenTelemetry SDK initialized successfully');

  // Test tracing
  const tracer = trace.getTracer('test-tracer');
  
  const span = tracer.startSpan('test-span');
  span.setAttributes({
    'test.type': 'validation',
    'test.component': 'otel-migration',
  });
  
  console.log('✅ Test span created successfully');
  
  // Simulate some work
  setTimeout(() => {
    span.addEvent('test-event', {
      'event.message': 'OpenTelemetry integration working',
    });
    
    span.end();
    console.log('✅ Test span completed');
    
    // Shutdown SDK
    sdk.shutdown()
      .then(() => {
        console.log('✅ OpenTelemetry SDK shutdown successfully');
        console.log('🎉 OpenTelemetry validation test PASSED');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ SDK shutdown failed:', error);
        process.exit(1);
      });
  }, 100);

} catch (error) {
  console.error('❌ OpenTelemetry validation test FAILED:', error);
  process.exit(1);
}