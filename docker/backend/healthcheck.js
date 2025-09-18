#!/usr/bin/env node

// Health check script for Node.js backend
// Used by Docker HEALTHCHECK instruction

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  method: 'GET',
  timeout: 2000
};

const req = http.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log('Health check passed');
    process.exit(0);
  } else {
    console.log(`Health check failed with status: ${res.statusCode}`);
    process.exit(1);
  }
});

req.on('error', (err) => {
  console.log(`Health check failed: ${err.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  console.log('Health check timed out');
  req.destroy();
  process.exit(1);
});

req.end();