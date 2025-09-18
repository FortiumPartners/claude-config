#!/usr/bin/env node

/**
 * Trace to ClickHouse Workaround Script
 *
 * This script reads traces from the file exporter and inserts them directly
 * into ClickHouse, bypassing the broken clickhousetraces exporter.
 */

const fs = require('fs');
const { spawn } = require('child_process');

const TRACE_FILE = '/tmp/traces.json';
const CLICKHOUSE_HOST = 'localhost';
const CLICKHOUSE_PORT = '9000';
const DATABASE = 'signoz_traces';
const TABLE = 'signoz_spans';

/**
 * Convert trace ID from hex string to FixedString(32) format
 */
function formatTraceId(traceId) {
  // Ensure traceId is exactly 32 characters (pad with zeros if needed)
  return traceId.padStart(32, '0');
}

/**
 * Extract timestamp from span startTimeUnixNano
 */
function extractTimestamp(startTimeUnixNano) {
  // Convert nanoseconds to seconds with nanosecond precision
  const nanoseconds = BigInt(startTimeUnixNano);
  const seconds = nanoseconds / BigInt(1000000000);
  const nanos = nanoseconds % BigInt(1000000000);
  return `${seconds}.${nanos.toString().padStart(9, '0')}`;
}

/**
 * Insert trace into ClickHouse
 */
async function insertTrace(trace) {
  try {
    for (const resourceSpan of trace.resourceSpans || []) {
      for (const scopeSpan of resourceSpan.scopeSpans || []) {
        for (const span of scopeSpan.spans || []) {
          const traceId = formatTraceId(span.traceId);
          const timestamp = extractTimestamp(span.startTimeUnixNano);
          const model = JSON.stringify({
            traceId: span.traceId,
            spanId: span.spanId,
            parentSpanId: span.parentSpanId || '',
            operationName: span.name,
            startTime: span.startTimeUnixNano,
            endTime: span.endTimeUnixNano,
            duration: (BigInt(span.endTimeUnixNano) - BigInt(span.startTimeUnixNano)).toString(),
            serviceName: getServiceName(resourceSpan.resource),
            kind: span.kind || 1,
            status: span.status || { code: 1 },
            resource: resourceSpan.resource,
            scope: scopeSpan.scope
          });

          const query = `INSERT INTO ${DATABASE}.${TABLE} (timestamp, traceID, model) VALUES ('${timestamp}', '${traceId}', '${model.replace(/'/g, "\\'")}')`;

          console.log(`Inserting trace: ${span.traceId} (${span.name})`);

          await executeClickHouseQuery(query);
        }
      }
    }
  } catch (error) {
    console.error('Error inserting trace:', error.message);
  }
}

/**
 * Extract service name from resource attributes
 */
function getServiceName(resource) {
  if (!resource || !resource.attributes) return 'unknown-service';

  const serviceNameAttr = resource.attributes.find(attr => attr.key === 'service.name');
  return serviceNameAttr ? serviceNameAttr.value.stringValue : 'unknown-service';
}

/**
 * Execute ClickHouse query
 */
function executeClickHouseQuery(query) {
  return new Promise((resolve, reject) => {
    const clickhouse = spawn('docker', [
      'exec', 'signoz-clickhouse',
      'clickhouse-client',
      '--query', query
    ]);

    let error = '';

    clickhouse.stderr.on('data', (data) => {
      error += data.toString();
    });

    clickhouse.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ClickHouse query failed: ${error}`));
      } else {
        resolve();
      }
    });
  });
}

/**
 * Process traces from file exporter
 */
async function processTraceFile() {
  try {
    // Check if trace file exists in the container
    const checkFile = spawn('docker', [
      'exec', 'signoz-otel-collector',
      'test', '-f', TRACE_FILE
    ]);

    checkFile.on('close', async (code) => {
      if (code === 0) {
        // File exists, read it
        const readFile = spawn('docker', [
          'exec', 'signoz-otel-collector',
          'cat', TRACE_FILE
        ]);

        let traceData = '';
        readFile.stdout.on('data', (data) => {
          traceData += data.toString();
        });

        readFile.on('close', async (code) => {
          if (code === 0 && traceData.trim()) {
            try {
              const traces = traceData.trim().split('\n').map(line => JSON.parse(line));
              console.log(`Found ${traces.length} traces to process`);

              for (const trace of traces) {
                await insertTrace(trace);
              }

              console.log('✅ All traces processed successfully');

              // Clear the trace file after processing
              spawn('docker', [
                'exec', 'signoz-otel-collector',
                'sh', '-c', `> ${TRACE_FILE}`
              ]);

            } catch (error) {
              console.error('Error parsing trace data:', error.message);
            }
          }
        });
      } else {
        console.log('No trace file found, waiting...');
      }
    });
  } catch (error) {
    console.error('Error processing trace file:', error.message);
  }
}

/**
 * Main function - run continuously to monitor for new traces
 */
async function main() {
  console.log('🔄 Starting trace-to-clickhouse workaround...');
  console.log(`Monitoring: ${TRACE_FILE}`);
  console.log(`Target: ${CLICKHOUSE_HOST}:${CLICKHOUSE_PORT}/${DATABASE}.${TABLE}`);

  // Process traces every 5 seconds
  setInterval(processTraceFile, 5000);

  // Initial process
  processTraceFile();
}

// Run the script
main().catch(console.error);