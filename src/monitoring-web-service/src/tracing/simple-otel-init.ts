/**
 * Simple OpenTelemetry Initialization for SignOz Integration
 * This file provides basic tracing to make the service visible in SignOz dashboard
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';

// Create resource with service information
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: 'fortium-monitoring-service',
  [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: 'development',
});

// Configure trace exporter for SignOz with debug logging
const traceExporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
  headers: {
    'Content-Type': 'application/json',
  },
  timeoutMillis: 10000, // 10 second timeout
});

// Add debug logging for the exporter
const originalExport = traceExporter.export.bind(traceExporter);
traceExporter.export = function(spans, resultCallback) {
  console.log(`🔄 Attempting to export ${spans.length} spans to SignOz collector...`);
  originalExport(spans, (result) => {
    console.log(`📤 Export result:`, result);
    if (result.code !== 0) {
      console.error(`❌ Export failed with code ${result.code}:`, result.error);
    } else {
      console.log(`✅ Successfully exported ${spans.length} spans to SignOz`);
    }
    resultCallback(result);
  });
};

// Add console exporter for debugging
const consoleExporter = new ConsoleSpanExporter();

// Create batch processors with aggressive settings for debugging
const batchProcessor = new BatchSpanProcessor(traceExporter, {
  maxExportBatchSize: 1, // Export immediately for testing
  maxQueueSize: 10,
  scheduledDelayMillis: 100, // Export every 100ms for testing
  exportTimeoutMillis: 5000, // 5 second timeout
});

const consoleBatchProcessor = new BatchSpanProcessor(consoleExporter, {
  maxExportBatchSize: 5,
  scheduledDelayMillis: 1000,
});

// Initialize SDK with auto-instrumentation
const sdk = new NodeSDK({
  resource: resource,
  spanProcessors: [batchProcessor, consoleBatchProcessor],
  instrumentations: [getNodeAutoInstrumentations({
    // Disable some instrumentations if needed
    '@opentelemetry/instrumentation-fs': {
      enabled: false,
    },
    // Enable HTTP instrumentation specifically
    '@opentelemetry/instrumentation-http': {
      enabled: true,
    },
    '@opentelemetry/instrumentation-express': {
      enabled: true,
    },
  })],
});

// Initialize OpenTelemetry
console.log('🚀 Initializing OpenTelemetry for SignOz...');
sdk.start();
console.log('✅ OpenTelemetry initialized successfully');

// Handle process shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down OpenTelemetry...');
  await sdk.shutdown();
  console.log('✅ OpenTelemetry shutdown complete');
  process.exit(0);
});

export { sdk };