#!/usr/bin/env npx tsx

import { PrismaClient } from '../src/generated/prisma-client'
import bcrypt from 'bcrypt'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const prisma = new PrismaClient()

async function seedTestData() {
  console.log('🌱 Seeding test data...')

  try {
    // Create a test tenant for demo subdomain development
    console.log('Creating demo tenant for development...')
    const tenant = await prisma.tenant.upsert({
      where: { domain: 'demo' },
      update: {},
      create: {
        name: 'Demo Tenant',
        domain: 'demo',
        schemaName: 'tenant_demo',
        subscriptionPlan: 'enterprise',
        adminEmail: 'admin@fortium.com',
        metadata: {
          created_by: 'seed_script',
          environment: 'development'
        }
      }
    })
    console.log('✅ Test tenant created:', tenant.id)

    // Create test users with hashed password
    console.log('Creating test users...')
    const hashedPassword = await bcrypt.hash('password123', 10)
    
    // Create the demo user that matches frontend expectations
    const demoUser = await prisma.user.upsert({
      where: { email: 'demo@fortium.com' },
      update: {},
      create: {
        email: 'demo@fortium.com',
        firstName: 'Demo',
        lastName: 'User',
        password: hashedPassword,
        role: 'admin',
        timezone: 'America/Chicago',
        preferences: {
          theme: 'light',
          language: 'en'
        }
      }
    })
    console.log('✅ Demo user created:', demoUser.id)

    // Create the admin user for backup
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        password: hashedPassword,
        role: 'admin',
        timezone: 'America/Chicago',
        preferences: {
          theme: 'light',
          language: 'en'
        }
      }
    })
    console.log('✅ Admin user created:', adminUser.id)

    // Create sample activity data
    console.log('Creating sample activity data...')
    const activities = [
      {
        userId: demoUser.id,
        actionName: 'File Update',
        actionDescription: 'Updated configuration file for production deployment',
        targetName: 'config/production.yml',
        status: 'success',
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        duration: 2500
      },
      {
        userId: demoUser.id,
        actionName: 'Code Review',
        actionDescription: 'Reviewed pull request #247 for real-time dashboard improvements',
        targetName: 'PR #247: Real-time Dashboard',
        status: 'success',
        timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        duration: 8200
      },
      {
        userId: demoUser.id,
        actionName: 'Test Execution',
        actionDescription: 'Running end-to-end tests for user authentication flow',
        targetName: 'Authentication E2E Suite',
        status: 'in_progress',
        timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
        duration: null
      },
      {
        userId: demoUser.id,
        actionName: 'Database Migration',
        actionDescription: 'Applied migration to add activity tracking tables',
        targetName: 'add-activity-data-model',
        status: 'success',
        timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        duration: 1800
      },
      {
        userId: demoUser.id,
        actionName: 'API Deployment',
        actionDescription: 'Deploying updated API endpoints to staging environment',
        targetName: 'Staging Environment',
        status: 'success',
        timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
        duration: 12000,
        isAutomated: true
      },
      {
        userId: adminUser.id,
        actionName: 'Security Scan',
        actionDescription: 'Automated security vulnerability scan completed',
        targetName: 'Full Codebase',
        status: 'success',
        timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        duration: 45000,
        isAutomated: true
      },
      {
        userId: demoUser.id,
        actionName: 'Performance Test',
        actionDescription: 'Load testing the real-time activity feed endpoint',
        targetName: '/api/v1/activities',
        status: 'error',
        timestamp: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        duration: 3000,
        errorMessage: 'Timeout after 3 seconds - server overloaded',
        errorCode: 'TIMEOUT_ERROR'
      }
    ]

    for (const activity of activities) {
      await prisma.activityData.create({
        data: activity
      })
    }
    console.log('✅ Sample activity data created:', activities.length, 'activities')

    console.log('🎉 Test data seeded successfully!')
    console.log('You can now login with:')
    console.log('  Email: demo@fortium.com')
    console.log('  Password: password123')
    console.log('  OR')
    console.log('  Email: admin@example.com')
    console.log('  Password: password123')

  } catch (error) {
    console.error('❌ Error seeding test data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  seedTestData()
    .then(() => {
      console.log('Seed completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Seed failed:', error)
      process.exit(1)
    })
}

export default seedTestData