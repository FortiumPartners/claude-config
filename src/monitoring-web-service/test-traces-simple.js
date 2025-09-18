/**
 * Simple OpenTelemetry Tracing Test
 * This script creates manual traces and sends them to SignOz to test service visibility
 */

const { trace, metrics, context } = require('@opentelemetry/api');
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

console.log('🚀 Starting OpenTelemetry tracing test...');

// Create resource with service info
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: 'fortium-monitoring-service',
  [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  [SemanticResourceAttributes.SERVICE_NAMESPACE]: 'fortium',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'development',
});

// Configure trace exporter
const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Initialize NodeSDK
const sdk = new NodeSDK({
  resource: resource,
  traceExporter: traceExporter,
});

// Start the SDK
try {
  sdk.start();
  console.log('✅ OpenTelemetry SDK started successfully');
} catch (error) {
  console.error('❌ Failed to start OpenTelemetry SDK:', error.message);
  process.exit(1);
}

// Get tracer
const tracer = trace.getTracer('fortium-monitoring-service', '1.0.0');

// Function to create test traces
async function createTestTraces() {
  console.log('📊 Creating test traces...');
  
  for (let i = 1; i <= 5; i++) {
    const span = tracer.startSpan(`test-operation-${i}`, {
      attributes: {
        'operation.type': 'test',
        'test.iteration': i,
        'service.component': 'test-suite',
        'http.method': 'POST',
        'http.route': `/api/v1/test/${i}`,
        'http.status_code': 200,
      },
    });

    // Simulate some work with nested spans
    const childSpan = tracer.startSpan(`test-child-operation-${i}`, {
      parent: span,
      attributes: {
        'db.operation': 'SELECT',
        'db.name': 'fortium_metrics',
        'db.table': 'test_table',
      },
    });

    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    
    childSpan.setAttributes({
      'db.rows_affected': Math.floor(Math.random() * 10) + 1,
    });
    childSpan.setStatus({ code: trace.SpanStatusCode.OK });
    childSpan.end();

    span.setAttributes({
      'operation.duration_ms': Math.random() * 200 + 50,
      'operation.success': true,
    });
    span.setStatus({ code: 1 }); // OK = 1
    span.end();

    console.log(`   ✓ Created trace ${i}/5`);
  }

  console.log('🎉 Test traces created successfully!');
}

// Function to simulate HTTP request traces
async function createHttpTraces() {
  console.log('🌐 Creating HTTP request traces...');
  
  const endpoints = [
    { method: 'GET', path: '/api/v1/health', status: 200 },
    { method: 'POST', path: '/api/v1/auth/login', status: 404 },
    { method: 'GET', path: '/api/v1/metrics', status: 200 },
    { method: 'POST', path: '/api/v1/users', status: 201 },
    { method: 'GET', path: '/api/v1/dashboard', status: 200 },
  ];

  for (const endpoint of endpoints) {
    const span = tracer.startSpan(`HTTP ${endpoint.method} ${endpoint.path}`, {
      attributes: {
        'http.method': endpoint.method,
        'http.route': endpoint.path,
        'http.scheme': 'https',
        'http.status_code': endpoint.status,
        'http.user_agent': 'SignOz-Test/1.0.0',
        'service.component': 'http-handler',
      },
    });

    // Simulate request processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 150 + 25));
    
    span.setAttributes({
      'http.response.size': Math.floor(Math.random() * 1000) + 100,
      'operation.duration_ms': Math.random() * 100 + 25,
    });
    
    span.setStatus({ 
      code: endpoint.status >= 400 ? 2 : 1 // ERROR = 2, OK = 1
    });
    span.end();

    console.log(`   ✓ HTTP ${endpoint.method} ${endpoint.path} - ${endpoint.status}`);
  }

  console.log('🎯 HTTP traces created successfully!');
}

// Main test function
async function runTest() {
  try {
    console.log('🔍 Testing OpenTelemetry trace export to SignOz...\n');
    
    // Wait a moment for SDK to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create test traces
    await createTestTraces();
    console.log('');
    await createHttpTraces();
    
    // Wait for traces to be exported
    console.log('\n⏳ Waiting for traces to be exported...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('✅ Test completed successfully!');
    console.log('📊 Check SignOz dashboard at: http://localhost:3301');
    console.log('🔍 Look for service: fortium-monitoring-service');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Cleanup
    console.log('\n🧹 Shutting down SDK...');
    await sdk.shutdown();
    console.log('👋 Test script finished');
    process.exit(0);
  }
}

// Run the test
runTest().catch(console.error);