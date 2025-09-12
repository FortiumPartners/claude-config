#!/usr/bin/env npx tsx

import { Client } from 'pg'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config()

async function testDirectConnection() {
  console.log('Testing direct PostgreSQL connection...')
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  })
  
  try {
    console.log('Connecting with connectionString:', process.env.DATABASE_URL)
    
    await client.connect()
    console.log('✅ Direct connection successful')
    
    // Test a query
    const result = await client.query('SELECT version(), now() as current_time;')
    console.log('✅ Query successful:', result.rows[0])
    
    // Test tenant table
    const tenantResult = await client.query('SELECT COUNT(*) as count FROM tenants;')
    console.log('✅ Tenant count:', tenantResult.rows[0].count)
    
    // List tenants
    const tenants = await client.query('SELECT id, name, domain, schema_name FROM tenants;')
    console.log('✅ Tenants found:', tenants.rows)
    
  } catch (error) {
    console.error('❌ Direct connection failed:', error)
  } finally {
    await client.end()
  }
}

testDirectConnection()
  .then(() => {
    console.log('Direct connection test completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Direct connection test failed:', error)
    process.exit(1)
  })