#!/usr/bin/env npx tsx

import { PrismaClient } from '../src/generated/prisma-client'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

console.log('Testing database connection...')
console.log('DATABASE_URL from env:', process.env.DATABASE_URL ? 'loaded' : 'missing')
console.log('DATABASE_URL value:', process.env.DATABASE_URL)
console.log('All env keys:', Object.keys(process.env).filter(k => k.includes('DATABASE')).join(', '))

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

async function testConnection() {
  try {
    console.log('Connecting to database...')
    
    // Test raw connection
    await prisma.$connect()
    console.log('✅ Prisma connected successfully')
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT version(), now() as current_time;`
    console.log('✅ Database query successful:', result)
    
    // Test tenant table
    const tenantCount = await prisma.tenant.count()
    console.log('✅ Tenant table accessible, count:', tenantCount)
    
    // List all tenants
    const tenants = await prisma.tenant.findMany()
    console.log('✅ Found tenants:', tenants.map(t => ({ id: t.id, name: t.name, domain: t.domain })))
    
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    })
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
  .then(() => {
    console.log('Connection test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Connection test failed:', error)
    process.exit(1)
  })