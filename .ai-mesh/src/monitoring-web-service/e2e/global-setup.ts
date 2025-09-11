import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test suite setup...');
  console.log('Frontend URL:', 'http://localhost:3001');
  console.log('Backend URL:', 'http://localhost:3002');
  
  // Create test results directory
  const fs = require('fs');
  const path = require('path');
  const testResultsDir = path.join(__dirname, '..', 'test-results');
  
  if (!fs.existsSync(testResultsDir)) {
    fs.mkdirSync(testResultsDir, { recursive: true });
    console.log('📁 Created test-results directory');
  }
  
  // Wait a moment for servers to fully initialize
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('✅ Global setup completed');
}

export default globalSetup;