#!/usr/bin/env npx tsx

/**
 * Create Test Activities via API
 * Uses the existing /api/v1/activities endpoint to create realistic test data
 */

const API_BASE_URL = 'http://localhost:3001/api/v1';

// Realistic development activities
const activityTemplates = [
  // File Operations
  {
    actionName: 'File Read',
    actionDescription: 'Reading source code file for analysis',
    targetName: 'src/components/UserProfile.tsx',
    status: 'success',
    duration: 45,
    isAutomated: false,
    priority: 'normal'
  },
  {
    actionName: 'File Edit',
    actionDescription: 'Updating authentication logic with security improvements',
    targetName: 'src/auth/AuthProvider.tsx',
    status: 'success',
    duration: 1200,
    isAutomated: false,
    priority: 'high'
  },
  {
    actionName: 'File Creation',
    actionDescription: 'Created new utility function for input validation',
    targetName: 'src/utils/validators.ts',
    status: 'success',
    duration: 850,
    isAutomated: false,
    priority: 'normal'
  },

  // Git Operations
  {
    actionName: 'Git Commit',
    actionDescription: 'Committed feature implementation with conventional commits',
    targetName: 'feature/user-dashboard',
    status: 'success',
    duration: 280,
    isAutomated: true,
    priority: 'normal'
  },
  {
    actionName: 'Git Merge',
    actionDescription: 'Merged feature branch to main after code review',
    targetName: 'main',
    status: 'success',
    duration: 320,
    isAutomated: false,
    priority: 'high'
  },

  // Testing Activities
  {
    actionName: 'Unit Tests',
    actionDescription: 'Running Jest test suite for API endpoints',
    targetName: 'api.test.ts',
    status: 'success',
    duration: 3200,
    isAutomated: true,
    priority: 'high'
  },
  {
    actionName: 'E2E Testing',
    actionDescription: 'Playwright tests for complete user journey',
    targetName: 'user-flow.spec.ts',
    status: 'success',
    duration: 18000,
    isAutomated: true,
    priority: 'critical'
  },
  {
    actionName: 'Test Failure',
    actionDescription: 'Integration test failed - database connection timeout',
    targetName: 'db-integration.test.ts',
    status: 'error',
    duration: 8000,
    isAutomated: true,
    priority: 'high'
  },

  // Build & Deploy
  {
    actionName: 'Build Process',
    actionDescription: 'TypeScript compilation and asset optimization',
    targetName: 'Production Build',
    status: 'success',
    duration: 15000,
    isAutomated: true,
    priority: 'high'
  },
  {
    actionName: 'Lint Check',
    actionDescription: 'ESLint validation with automatic fixes applied',
    targetName: 'src/**/*.{ts,tsx}',
    status: 'success',
    duration: 650,
    isAutomated: true,
    priority: 'normal'
  },
  {
    actionName: 'Type Check',
    actionDescription: 'TypeScript type checking across entire codebase',
    targetName: 'TypeScript Compiler',
    status: 'success',
    duration: 1200,
    isAutomated: true,
    priority: 'normal'
  },

  // Code Review & Security
  {
    actionName: 'Code Review',
    actionDescription: 'Manual code review focusing on security best practices',
    targetName: 'PR #143: Authentication Enhancement',
    status: 'success',
    duration: 2800,
    isAutomated: false,
    priority: 'critical'
  },
  {
    actionName: 'Security Scan',
    actionDescription: 'Automated vulnerability scanning with dependency check',
    targetName: 'Security Analysis Report',
    status: 'success',
    duration: 12000,
    isAutomated: true,
    priority: 'critical'
  },

  // AI Agent Activities
  {
    actionName: 'Agent Task',
    actionDescription: 'AI agent optimizing React component performance',
    targetName: 'react-component-architect',
    status: 'success',
    duration: 5500,
    isAutomated: true,
    priority: 'high'
  },
  {
    actionName: 'Code Generation',
    actionDescription: 'Auto-generating comprehensive API documentation',
    targetName: 'OpenAPI Specification',
    status: 'success',
    duration: 3200,
    isAutomated: true,
    priority: 'normal'
  },
  {
    actionName: 'Infrastructure Automation',
    actionDescription: 'Automated Kubernetes deployment configuration',
    targetName: 'k8s-deployment.yaml',
    status: 'success',
    duration: 4200,
    isAutomated: true,
    priority: 'high'
  },

  // Database Operations
  {
    actionName: 'Database Migration',
    actionDescription: 'Applied schema updates for new user features',
    targetName: 'migration_003_user_preferences',
    status: 'success',
    duration: 2400,
    isAutomated: false,
    priority: 'high'
  },
  {
    actionName: 'Query Optimization',
    actionDescription: 'Optimized activity feed query with proper indexing',
    targetName: 'activity_feed_query',
    status: 'success',
    duration: 800,
    isAutomated: false,
    priority: 'normal'
  },

  // Performance & Monitoring
  {
    actionName: 'Load Testing',
    actionDescription: 'Stress testing API under 1000+ concurrent users',
    targetName: 'Performance Test Suite',
    status: 'success',
    duration: 32000,
    isAutomated: true,
    priority: 'critical'
  },
  {
    actionName: 'Memory Analysis',
    actionDescription: 'Profiling memory usage patterns and leak detection',
    targetName: 'Memory Profile Report',
    status: 'in_progress',
    duration: null,
    isAutomated: true,
    priority: 'normal'
  },

  // Error Scenarios for realistic testing
  {
    actionName: 'Deployment Failure',
    actionDescription: 'Production deployment failed - configuration mismatch',
    targetName: 'Production Environment',
    status: 'error',
    duration: 2200,
    isAutomated: true,
    priority: 'critical'
  },
  {
    actionName: 'API Timeout',
    actionDescription: 'External payment service integration timeout',
    targetName: 'Payment Gateway API',
    status: 'error',
    duration: 30000,
    isAutomated: false,
    priority: 'high'
  }
];

async function createActivity(activityData: any) {
  const response = await fetch(`${API_BASE_URL}/activities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer dev-token-123' // Development token
    },
    body: JSON.stringify(activityData)
  });

  if (!response.ok) {
    throw new Error(`Failed to create activity: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function createTestActivity() {
  const response = await fetch(`${API_BASE_URL}/activities/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to create test activity: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function generateActivities(count: number = 25) {
  console.log(`🎭 Generating ${count} realistic development activities...`);

  const created = [];
  const errors = [];

  for (let i = 0; i < count; i++) {
    try {
      // Pick a random template
      const template = activityTemplates[Math.floor(Math.random() * activityTemplates.length)];

      // Add some randomness
      let activityData = { ...template };

      // 15% chance to increase duration for realism
      if (activityData.duration && Math.random() < 0.15) {
        activityData.duration = Math.floor(activityData.duration * (1.5 + Math.random()));
      }

      // 8% chance to change success to error for variety
      if (activityData.status === 'success' && Math.random() < 0.08) {
        activityData.status = 'error';
      }

      // 5% chance to make in_progress
      if (Math.random() < 0.05) {
        activityData.status = 'in_progress';
        activityData.duration = null;
      }

      const result = await createActivity(activityData);
      created.push(result.data);

      // Small delay to make activities feel more natural
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

      if ((i + 1) % 10 === 0) {
        console.log(`✅ Created ${i + 1}/${count} activities...`);
      }

    } catch (error) {
      console.warn(`⚠️  Failed to create activity ${i + 1}:`, error instanceof Error ? error.message : error);
      errors.push(error);
    }
  }

  console.log(`\n🎉 Successfully created ${created.length} activities!`);
  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} activities failed to create`);
  }

  return { created: created.length, errors: errors.length };
}

async function generateQuickTestActivities() {
  console.log('🚀 Creating quick WebSocket test activities...');

  const testActivities = [];

  for (let i = 0; i < 5; i++) {
    try {
      const result = await createTestActivity();
      testActivities.push(result.data);
      console.log(`✅ Test activity ${i + 1}: ${result.data.action.name}`);

      // Short delay between test activities
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`⚠️  Failed to create test activity ${i + 1}:`, error instanceof Error ? error.message : error);
    }
  }

  return testActivities;
}

async function showActivitySummary() {
  try {
    const response = await fetch(`${API_BASE_URL}/activities/summary`);
    if (!response.ok) {
      throw new Error(`Failed to fetch summary: ${response.status}`);
    }

    const summary = await response.json();

    console.log('\n📊 Activity Dashboard Summary:');
    console.log(`  Total Activities: ${summary.total_activities}`);
    console.log(`  Automated: ${summary.automated_activities} (${summary.automation_rate.toFixed(1)}%)`);
    console.log(`  Error Rate: ${summary.error_activities} (${summary.error_rate.toFixed(1)}%)`);
    console.log(`  Recent (24h): ${summary.recent_activities}`);

  } catch (error) {
    console.warn('⚠️  Could not fetch activity summary:', error instanceof Error ? error.message : error);
  }
}

async function main() {
  console.log('🚀 Starting test activity generation...\n');

  const command = process.argv[2];
  const count = parseInt(process.argv[3]) || 25;

  try {
    if (command === 'quick' || command === 'test') {
      // Generate quick WebSocket test activities
      await generateQuickTestActivities();
    } else {
      // Generate realistic development activities
      await generateActivities(count);
    }

    // Show summary
    await showActivitySummary();

    console.log('\n🎉 Test data generation complete!');
    console.log('\n🔗 Next steps:');
    console.log('  • View activities: http://localhost:3001/api/v1/activities');
    console.log('  • Open dashboard: http://localhost:3000');
    console.log('  • Test real-time feed with: npm run test:websocket');

  } catch (error) {
    console.error('❌ Error generating test activities:', error);
    process.exit(1);
  }
}

// Usage examples:
// npx tsx scripts/create-test-activities-api.ts           # Create 25 realistic activities
// npx tsx scripts/create-test-activities-api.ts 50       # Create 50 activities
// npx tsx scripts/create-test-activities-api.ts quick    # Create 5 WebSocket test activities

if (require.main === module) {
  main();
}