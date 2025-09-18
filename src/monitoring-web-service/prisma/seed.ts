/**
 * Database Seeding Script
 * External Metrics Web Service - Generate Demo Data
 */

import { createPrismaClient } from '../src/database/prisma-client';
import { ormUtils } from '../src/database/orm-utils';
import * as winston from 'winston';

// Seed data configuration
const SEED_CONFIG = {
  tenants: [
    {
      name: 'Fortium Partners Demo',
      domain: 'fortium-demo',
      subscriptionPlan: 'enterprise' as const,
      adminEmail: 'admin@fortium.example',
      billingEmail: 'billing@fortium.example',
    },
    {
      name: 'Acme Corporation',
      domain: 'acme-corp',
      subscriptionPlan: 'professional' as const,
      adminEmail: 'admin@acme.example',
      billingEmail: 'billing@acme.example',
    },
    {
      name: 'Startup XYZ',
      domain: 'startup-xyz',
      subscriptionPlan: 'basic' as const,
      adminEmail: 'founder@startupxyz.example',
      billingEmail: 'founder@startupxyz.example',
    },
  ],
  usersPerTenant: 5,
  sessionsPerUser: 30,
  toolsPerSession: [3, 8], // min, max
};

// User role distribution
const USER_ROLES = ['admin', 'manager', 'developer', 'developer', 'viewer'];

// Common tools used in sessions
const COMMON_TOOLS = [
  { name: 'Read', category: 'file-ops', avgDuration: 150, successRate: 0.98 },
  { name: 'Write', category: 'file-ops', avgDuration: 300, successRate: 0.95 },
  { name: 'Edit', category: 'file-ops', avgDuration: 250, successRate: 0.97 },
  { name: 'Bash', category: 'execution', avgDuration: 1200, successRate: 0.92 },
  { name: 'Grep', category: 'search', avgDuration: 400, successRate: 0.99 },
  { name: 'Glob', category: 'search', avgDuration: 200, successRate: 0.99 },
];

// Session types and their characteristics
const SESSION_TYPES = [
  { type: 'development', weight: 60, avgDuration: 7200000, productivityRange: [60, 90] },
  { type: 'meeting', weight: 20, avgDuration: 3600000, productivityRange: [40, 70] },
  { type: 'research', weight: 15, avgDuration: 5400000, productivityRange: [50, 80] },
  { type: 'debugging', weight: 5, avgDuration: 4800000, productivityRange: [30, 85] },
];

// Dashboard configurations
const DASHBOARD_CONFIGS = [
  {
    name: 'Developer Dashboard',
    description: 'Focused on development productivity metrics',
    widgetLayout: {
      widgets: [
        { id: 'productivity-trend', type: 'line-chart', position: { x: 0, y: 0, w: 6, h: 4 } },
        { id: 'tool-usage', type: 'pie-chart', position: { x: 6, y: 0, w: 6, h: 4 } },
        { id: 'session-breakdown', type: 'bar-chart', position: { x: 0, y: 4, w: 12, h: 4 } },
        { id: 'recent-sessions', type: 'table', position: { x: 0, y: 8, w: 12, h: 4 } },
      ],
      layout: 'grid',
    },
    isDefault: true,
  },
  {
    name: 'Manager Overview',
    description: 'Team productivity and performance overview',
    widgetLayout: {
      widgets: [
        { id: 'team-productivity', type: 'gauge', position: { x: 0, y: 0, w: 4, h: 4 } },
        { id: 'user-comparison', type: 'bar-chart', position: { x: 4, y: 0, w: 8, h: 4 } },
        { id: 'project-progress', type: 'kanban', position: { x: 0, y: 4, w: 12, h: 6 } },
      ],
      layout: 'grid',
    },
    isDefault: false,
  },
];

/**
 * Generate realistic user data
 */
function generateUser(index: number, role: string) {
  const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
  
  const firstName = firstNames[index % firstNames.length];
  const lastName = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.example`;

  return {
    email,
    firstName,
    lastName,
    role,
    timezone: ['UTC', 'America/New_York', 'America/Los_Angeles', 'Europe/London'][index % 4],
    preferences: {
      theme: ['light', 'dark'][index % 2],
      language: 'en',
      dateFormat: 'MM/dd/yyyy',
      notifications: {
        email: true,
        inApp: true,
        desktop: index % 3 === 0,
      },
    },
    lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    loginCount: Math.floor(Math.random() * 100) + 10,
  };
}

/**
 * Generate realistic session data
 */
function generateSession(userId: string, dayOffset: number) {
  const sessionTypeData = SESSION_TYPES[
    Math.floor(Math.random() * SESSION_TYPES.reduce((sum, st) => sum + st.weight, 0))
  ];
  
  // Create session start time (business hours)
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - dayOffset);
  baseDate.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);
  
  const sessionStart = baseDate;
  const duration = Math.floor(
    sessionTypeData.avgDuration * (0.5 + Math.random())
  );
  const sessionEnd = new Date(sessionStart.getTime() + duration);

  const productivityScore = Math.floor(
    sessionTypeData.productivityRange[0] + 
    Math.random() * (sessionTypeData.productivityRange[1] - sessionTypeData.productivityRange[0])
  );

  return {
    userId,
    sessionStart,
    sessionEnd,
    totalDurationMs: BigInt(duration),
    sessionType: sessionTypeData.type,
    productivityScore,
    projectId: ['project-alpha', 'project-beta', 'project-gamma', null][Math.floor(Math.random() * 4)],
    tags: [
      ['frontend', 'react'],
      ['backend', 'api'],
      ['database', 'optimization'],
      ['testing', 'e2e'],
      ['deployment', 'cicd'],
    ][Math.floor(Math.random() * 5)],
    interruptionsCount: Math.floor(Math.random() * 5),
    focusTimeMs: BigInt(Math.floor(duration * (0.6 + Math.random() * 0.3))),
    description: [
      'Working on user authentication features',
      'Implementing dashboard analytics',
      'Debugging performance issues',
      'Code review and refactoring',
      'Planning next sprint features',
    ][Math.floor(Math.random() * 5)],
  };
}

/**
 * Generate tool metrics for a session
 */
function generateToolMetrics(sessionId: string, sessionDuration: number) {
  const toolCount = SEED_CONFIG.toolsPerSession[0] + 
    Math.floor(Math.random() * (SEED_CONFIG.toolsPerSession[1] - SEED_CONFIG.toolsPerSession[0]));
  
  const toolMetrics = [];
  let remainingDuration = sessionDuration;

  for (let i = 0; i < toolCount; i++) {
    const tool = COMMON_TOOLS[Math.floor(Math.random() * COMMON_TOOLS.length)];
    const executionCount = Math.floor(Math.random() * 10) + 1;
    const toolDuration = Math.min(
      remainingDuration * 0.4,
      tool.avgDuration * executionCount * (0.5 + Math.random())
    );
    
    remainingDuration -= toolDuration;

    const errorCount = Math.floor(executionCount * (1 - tool.successRate));
    
    toolMetrics.push({
      sessionId,
      toolName: tool.name,
      toolCategory: tool.category,
      executionCount,
      totalDurationMs: BigInt(Math.floor(toolDuration)),
      averageDurationMs: BigInt(Math.floor(toolDuration / executionCount)),
      successRate: tool.successRate + (Math.random() - 0.5) * 0.1,
      errorCount,
      memoryUsageMb: Math.floor(Math.random() * 100) + 10,
      cpuTimeMs: BigInt(Math.floor(toolDuration * 0.3)),
      parameters: {
        flags: ['--verbose', '--recursive'][Math.floor(Math.random() * 2)],
        path: `/project/${tool.category}`,
      },
      outputSizeBytes: BigInt(Math.floor(Math.random() * 10000) + 100),
    });
  }

  return toolMetrics;
}

/**
 * Main seeding function
 */
async function seed() {
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${message} ${
          Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
        }`;
      })
    ),
    transports: [new winston.transports.Console()],
  });

  const client = createPrismaClient({ logger });

  try {
    logger.info('Starting database seeding...');

    // Step 1: Create tenants
    logger.info('Creating tenants...');
    const createdTenants = [];
    
    for (const tenantData of SEED_CONFIG.tenants) {
      const tenant = await client.tenant.create({
        data: {
          name: tenantData.name,
          domain: tenantData.domain,
          schemaName: `tenant_${tenantData.domain.replace('-', '_')}`,
          subscriptionPlan: tenantData.subscriptionPlan,
          adminEmail: tenantData.adminEmail,
          billingEmail: tenantData.billingEmail,
          metadata: {
            seed_data: true,
            created_at: new Date().toISOString(),
          },
        },
      });
      
      createdTenants.push(tenant);
      logger.info(`Created tenant: ${tenant.name} (${tenant.domain})`);
    }

    // Step 2: For each tenant, create users and their data
    for (const tenant of createdTenants) {
      logger.info(`Seeding data for tenant: ${tenant.name}`);
      
      // Set tenant context
      await client.setTenantContext({
        tenantId: tenant.id,
        schemaName: tenant.schemaName,
        domain: tenant.domain,
      });

      // Create users
      const createdUsers = [];
      for (let i = 0; i < SEED_CONFIG.usersPerTenant; i++) {
        const role = USER_ROLES[i % USER_ROLES.length];
        const userData = generateUser(i, role);
        
        const user = await client.user.create({
          data: userData,
        });
        
        createdUsers.push(user);
      }
      
      logger.info(`Created ${createdUsers.length} users for ${tenant.name}`);

      // Create sessions and tool metrics for each user
      let totalSessions = 0;
      let totalToolMetrics = 0;

      for (const user of createdUsers) {
        const sessions = [];
        
        // Generate sessions over the last 30 days
        for (let day = 0; day < SEED_CONFIG.sessionsPerUser; day++) {
          if (Math.random() > 0.8) continue; // Skip some days randomly
          
          const sessionData = generateSession(user.id, day);
          sessions.push(sessionData);
        }

        // Bulk insert sessions
        if (sessions.length > 0) {
          await ormUtils.batchProcess(
            sessions,
            async (sessionBatch) => {
              const createdSessions = [];
              for (const sessionData of sessionBatch) {
                const session = await client.metricsSession.create({
                  data: sessionData,
                });
                createdSessions.push(session);
              }
              return createdSessions;
            },
            { batchSize: 10 }
          );

          totalSessions += sessions.length;

          // Generate tool metrics for sessions
          for (const sessionData of sessions) {
            const toolMetrics = generateToolMetrics(
              sessionData.sessionId || 'temp-id',
              Number(sessionData.totalDurationMs || 0)
            );

            if (toolMetrics.length > 0) {
              await client.toolMetric.createMany({
                data: toolMetrics,
                skipDuplicates: true,
              });
              totalToolMetrics += toolMetrics.length;
            }
          }
        }

        // Create dashboard configurations for first user (admin)
        if (user.role === 'admin') {
          for (const dashConfig of DASHBOARD_CONFIGS) {
            await client.dashboardConfig.create({
              data: {
                ...dashConfig,
                userId: user.id,
                sharedWithRoles: user.role === 'admin' ? ['manager', 'developer'] : [],
              },
            });
          }
        }
      }
      
      logger.info(`Created ${totalSessions} sessions and ${totalToolMetrics} tool metrics for ${tenant.name}`);
    }

    // Clear tenant context
    await client.clearTenantContext();

    logger.info('Database seeding completed successfully!');
    logger.info('Seed summary:', {
      tenants: createdTenants.length,
      usersPerTenant: SEED_CONFIG.usersPerTenant,
      sessionsGenerated: 'Variable per user',
      dashboardConfigs: DASHBOARD_CONFIGS.length,
    });

  } catch (error) {
    logger.error('Database seeding failed:', error);
    throw error;
  } finally {
    await client.shutdown();
  }
}

// Execute seeding if run directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('✅ Database seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Database seeding failed:', error);
      process.exit(1);
    });
}

export default seed;