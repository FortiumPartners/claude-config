import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test suite teardown...');
  
  // Generate summary report
  const fs = require('fs');
  const path = require('path');
  
  try {
    const testResultsDir = path.join(__dirname, '..', 'test-results');
    const summaryFile = path.join(testResultsDir, 'test-summary.json');
    
    const summary = {
      timestamp: new Date().toISOString(),
      testSuite: 'Real-time Activity Widget E2E Tests',
      environment: {
        frontend: 'http://localhost:3001',
        backend: 'http://localhost:3002'
      },
      completed: true
    };
    
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log('📊 Test summary written to test-summary.json');
  } catch (error) {
    console.error('❌ Error writing test summary:', error);
  }
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;