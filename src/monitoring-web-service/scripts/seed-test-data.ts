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
    // Create a test tenant for localhost development
    console.log('Creating localhost development tenant...')
    const tenant = await prisma.tenant.upsert({
      where: { domain: 'localhost' },
      update: {},
      create: {
        name: 'Localhost Development',
        domain: 'localhost',
        schemaName: 'tenant_localhost',
        subscriptionPlan: 'basic',
        adminEmail: 'admin@example.com',
        metadata: {
          created_by: 'seed_script',
          environment: 'development'
        }
      }
    })
    console.log('✅ Test tenant created:', tenant.id)

    // Create a test user with hashed password
    console.log('Creating test user...')
    const hashedPassword = await bcrypt.hash('password123', 10)
    
    // First, we need to create the tenant schema and user table
    // Since we're using tenant_template schema, let's create a user there
    const user = await prisma.user.upsert({
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
    console.log('✅ Test user created:', user.id)

    console.log('🎉 Test data seeded successfully!')
    console.log('You can now login with:')
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