/**
 * Working OpenTelemetry Tracing Test - Simplified Version
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { trace } = require('@opentelemetry/api');

console.log('🚀 Starting simple tracing test...');

// Create resource
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: 'fortium-monitoring-service',
  [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'development',
});

// Configure exporter
const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
});

// Initialize SDK
const sdk = new NodeSDK({
  resource: resource,
  traceExporter: traceExporter,
});

async function runTest() {
  try {
    // Start SDK
    sdk.start();
    console.log('✅ SDK started');

    // Get tracer
    const tracer = trace.getTracer('fortium-monitoring-service', '1.0.0');

    // Create simple spans
    for (let i = 1; i <= 3; i++) {
      console.log(`Creating span ${i}...`);
      
      const span = tracer.startSpan(`test-operation-${i}`, {
        attributes: {
          'test.iteration': i,
          'service.name': 'fortium-monitoring-service',
        },
      });

      // Simulate work
      await new Promise(resolve => setTimeout(resolve, 100));
      
      span.end();
      console.log(`✓ Span ${i} completed`);
    }

    console.log('⏳ Waiting for export...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('✅ Test completed!');
    console.log('📊 Check SignOz at: http://localhost:3301');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sdk.shutdown();
    console.log('👋 Done');
  }
}

runTest();