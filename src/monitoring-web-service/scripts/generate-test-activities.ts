#!/usr/bin/env npx tsx

/**
 * Generate Test Activities Script
 * Creates realistic development activities for testing the monitoring dashboard
 */

import { ExtendedPrismaClient } from '../src/database/prisma-client';

const prisma = new ExtendedPrismaClient();

// Realistic development activities
const activityTemplates = [
  // File Operations
  {
    actionName: 'File Read',
    actionDescription: 'Reading source code file for analysis',
    targetName: 'src/components/UserProfile.tsx',
    status: 'success',
    duration: 50,
    isAutomated: false,
    priority: 'normal'
  },
  {
    actionName: 'File Edit',
    actionDescription: 'Updating component with new authentication logic',
    targetName: 'src/auth/AuthProvider.tsx',
    status: 'success',
    duration: 1200,
    isAutomated: false,
    priority: 'high'
  },
  {
    actionName: 'File Creation',
    actionDescription: 'Created new utility function for data validation',
    targetName: 'src/utils/validators.ts',
    status: 'success',
    duration: 800,
    isAutomated: false,
    priority: 'normal'
  },

  // Git Operations
  {
    actionName: 'Git Commit',
    actionDescription: 'Committed authentication improvements with conventional commits',
    targetName: 'feature/auth-enhancement',
    status: 'success',
    duration: 300,
    isAutomated: true,
    priority: 'normal'
  },
  {
    actionName: 'Git Branch',
    actionDescription: 'Created new feature branch for user management',
    targetName: 'feature/user-management',
    status: 'success',
    duration: 150,
    isAutomated: false,
    priority: 'normal'
  },

  // Testing Activities
  {
    actionName: 'Unit Tests',
    actionDescription: 'Running Jest test suite for authentication module',
    targetName: 'auth.test.ts',
    status: 'success',
    duration: 2400,
    isAutomated: true,
    priority: 'high'
  },
  {
    actionName: 'E2E Testing',
    actionDescription: 'Playwright tests for user registration flow',
    targetName: 'user-registration.spec.ts',
    status: 'success',
    duration: 15000,
    isAutomated: true,
    priority: 'critical'
  },
  {
    actionName: 'Test Failure',
    actionDescription: 'Integration test failed due to API timeout',
    targetName: 'api-integration.test.ts',
    status: 'error',
    duration: 5000,
    isAutomated: true,
    priority: 'high'
  },

  // Build & Deploy Operations
  {
    actionName: 'Build Process',
    actionDescription: 'TypeScript compilation and bundling',
    targetName: 'Production Build',
    status: 'success',
    duration: 12000,
    isAutomated: true,
    priority: 'high'
  },
  {
    actionName: 'Lint Check',
    actionDescription: 'ESLint validation with auto-fix enabled',
    targetName: 'src/**/*.ts',
    status: 'success',
    duration: 800,
    isAutomated: true,
    priority: 'normal'
  },

  // Code Review Activities
  {
    actionName: 'Code Review',
    actionDescription: 'Reviewing authentication security implementation',
    targetName: 'PR #127: Enhanced User Authentication',
    status: 'success',
    duration: 3600,
    isAutomated: false,
    priority: 'critical'
  },
  {
    actionName: 'Security Scan',
    actionDescription: 'Automated security vulnerability scanning',
    targetName: 'Security Analysis Report',
    status: 'success',
    duration: 8000,
    isAutomated: true,
    priority: 'critical'
  },

  // Agent Activities
  {
    actionName: 'Agent Task',
    actionDescription: 'AI agent implementing React component architecture',
    targetName: 'react-component-architect',
    status: 'success',
    duration: 4500,
    isAutomated: true,
    priority: 'high'
  },
  {
    actionName: 'Code Generation',
    actionDescription: 'Auto-generating API documentation from OpenAPI spec',
    targetName: 'api-docs-generator',
    status: 'success',
    duration: 2200,
    isAutomated: true,
    priority: 'normal'
  },

  // Database Operations
  {
    actionName: 'Database Migration',
    actionDescription: 'Applied schema changes for user profile updates',
    targetName: 'migration_001_user_profiles',
    status: 'success',
    duration: 1800,
    isAutomated: false,
    priority: 'high'
  },
  {
    actionName: 'Query Optimization',
    actionDescription: 'Optimized user activity lookup query performance',
    targetName: 'activities_lookup_index',
    status: 'success',
    duration: 600,
    isAutomated: false,
    priority: 'normal'
  },

  // Performance & Monitoring
  {
    actionName: 'Performance Test',
    actionDescription: 'Load testing API endpoints under concurrent requests',
    targetName: 'API Performance Suite',
    status: 'success',
    duration: 25000,
    isAutomated: true,
    priority: 'high'
  },
  {
    actionName: 'Memory Profiling',
    actionDescription: 'Analyzing memory usage patterns in Node.js service',
    targetName: 'Memory Profile Report',
    status: 'in_progress',
    duration: null,
    isAutomated: true,
    priority: 'normal'
  },

  // Error Scenarios
  {
    actionName: 'Deployment Failed',
    actionDescription: 'Production deployment failed due to environment config',
    targetName: 'Production Environment',
    status: 'error',
    duration: 1200,
    isAutomated: true,
    priority: 'critical'
  },
  {
    actionName: 'API Timeout',
    actionDescription: 'External service integration exceeded timeout limit',
    targetName: 'External Auth Provider',
    status: 'error',
    duration: 30000,
    isAutomated: false,
    priority: 'high'
  }
];

// User profiles for variety
const userProfiles = [
  { firstName: 'Alex', lastName: 'Chen', email: 'alex.chen@fortium.dev' },
  { firstName: 'Sarah', lastName: 'Rodriguez', email: 'sarah.rodriguez@fortium.dev' },
  { firstName: 'Marcus', lastName: 'Johnson', email: 'marcus.johnson@fortium.dev' },
  { firstName: 'Emily', lastName: 'Zhang', email: 'emily.zhang@fortium.dev' },
  { firstName: 'David', lastName: 'Kim', email: 'david.kim@fortium.dev' }
];

const organizationId = 'dev-tenant-123';

async function ensureUsersExist() {
  console.log('🔍 Ensuring test users exist...');

  for (const userProfile of userProfiles) {
    const existingUser = await prisma.userData.findFirst({
      where: { email: userProfile.email }
    });

    if (!existingUser) {
      await prisma.userData.create({
        data: {
          ...userProfile,
          organizationId,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      console.log(`✅ Created user: ${userProfile.firstName} ${userProfile.lastName}`);
    } else {
      console.log(`👍 User exists: ${userProfile.firstName} ${userProfile.lastName}`);
    }
  }
}

async function generateActivities(count: number = 50) {
  console.log(`🎭 Generating ${count} test activities...`);

  const users = await prisma.userData.findMany({
    where: { organizationId }
  });

  if (users.length === 0) {
    throw new Error('No users found. Please run ensureUsersExist() first.');
  }

  const activities = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const template = activityTemplates[Math.floor(Math.random() * activityTemplates.length)];
    const user = users[Math.floor(Math.random() * users.length)];

    // Generate timestamps spread over the last 7 days
    const daysAgo = Math.random() * 7;
    const hoursOffset = Math.random() * 24;
    const timestamp = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000) - (hoursOffset * 60 * 60 * 1000));

    // Add some randomness to durations and statuses
    let duration = template.duration;
    let status = template.status;

    // 10% chance of making non-error activities take longer
    if (status === 'success' && Math.random() < 0.1) {
      duration = duration ? duration * (2 + Math.random() * 3) : 1000 + Math.random() * 5000;
    }

    // 5% chance of making success activities fail
    if (status === 'success' && Math.random() < 0.05) {
      status = 'error';
    }

    // 3% chance of making activities in progress
    if (Math.random() < 0.03) {
      status = 'in_progress';
      duration = null;
    }

    // Convert priority string to number
    const priorityMapping: { [key: string]: number } = {
      'low': 1,
      'normal': 0,
      'high': 2,
      'critical': 3
    };

    activities.push({
      actionName: template.actionName,
      actionDescription: template.actionDescription,
      targetName: template.targetName,
      status,
      duration: duration ? Math.floor(duration) : null,
      isAutomated: template.isAutomated,
      priority: priorityMapping[template.priority] || 0,
      timestamp,
      userId: user.id,
      organizationId
    });
  }

  // Create activities in batch
  const created = await prisma.activityData.createMany({
    data: activities,
    skipDuplicates: true
  });

  console.log(`✅ Successfully created ${created.count} activities`);
  return created.count;
}

async function showSummary() {
  console.log('\n📊 Activity Summary:');

  const [
    total,
    automated,
    manual,
    success,
    errors,
    inProgress,
    recent
  ] = await Promise.all([
    prisma.activityData.count(),
    prisma.activityData.count({ where: { isAutomated: true } }),
    prisma.activityData.count({ where: { isAutomated: false } }),
    prisma.activityData.count({ where: { status: 'success' } }),
    prisma.activityData.count({ where: { status: 'error' } }),
    prisma.activityData.count({ where: { status: 'in_progress' } }),
    prisma.activityData.count({
      where: {
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    })
  ]);

  console.log(`  Total Activities: ${total}`);
  console.log(`  Automated: ${automated} (${((automated/total) * 100).toFixed(1)}%)`);
  console.log(`  Manual: ${manual} (${((manual/total) * 100).toFixed(1)}%)`);
  console.log(`  Success: ${success} (${((success/total) * 100).toFixed(1)}%)`);
  console.log(`  Errors: ${errors} (${((errors/total) * 100).toFixed(1)}%)`);
  console.log(`  In Progress: ${inProgress} (${((inProgress/total) * 100).toFixed(1)}%)`);
  console.log(`  Recent (24h): ${recent}`);
}

async function main() {
  try {
    console.log('🚀 Starting test activity generation...\n');

    // Ensure users exist
    await ensureUsersExist();

    // Generate activities
    const activityCount = process.argv[2] ? parseInt(process.argv[2]) : 50;
    await generateActivities(activityCount);

    // Show summary
    await showSummary();

    console.log('\n🎉 Test data generation complete!');
    console.log('\n🔗 You can now:');
    console.log('  • Start the monitoring service: make dev');
    console.log('  • View activities: http://localhost:3001/api/v1/activities');
    console.log('  • Check summary: http://localhost:3001/api/v1/activities/summary');
    console.log('  • Open dashboard: http://localhost:3000');

  } catch (error) {
    console.error('❌ Error generating test activities:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Allow running with custom count: npx tsx scripts/generate-test-activities.ts 100
if (require.main === module) {
  main();
}

export { generateActivities, ensureUsersExist, showSummary };