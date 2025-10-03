#!/usr/bin/env npx tsx

/**
 * Create Test User for Development
 * Creates a test user with proper UUID for testing activities
 */

import { ExtendedPrismaClient } from '../src/database/prisma-client';

const prisma = new ExtendedPrismaClient();

const TEST_USER_ID = '00000000-0000-0000-0000-000000000123';

async function createTestUser() {
  try {
    console.log('🔧 Creating test user...');

    // First check if user already exists
    const existingUser = await prisma.userData.findFirst({
      where: {
        OR: [
          { id: TEST_USER_ID },
          { email: 'dev@fortium.test' }
        ]
      }
    });

    if (existingUser) {
      console.log('✅ Test user already exists:', {
        id: existingUser.id,
        email: existingUser.email,
        name: `${existingUser.firstName} ${existingUser.lastName}`
      });
      return existingUser;
    }

    // Create the test user
    const user = await prisma.userData.create({
      data: {
        id: TEST_USER_ID,
        email: 'dev@fortium.test',
        firstName: 'Development',
        lastName: 'User',
        role: 'admin'
      }
    });

    console.log('✅ Test user created successfully:', {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role
    });

    return user;

  } catch (error) {
    console.error('❌ Error creating test user:', error);

    if (error instanceof Error && error.message.includes('Unique constraint')) {
      console.log('💡 User might already exist with different email, checking...');
      try {
        const existingUser = await prisma.userData.findUnique({
          where: { id: TEST_USER_ID }
        });

        if (existingUser) {
          console.log('✅ Found existing user with UUID:', {
            id: existingUser.id,
            email: existingUser.email,
            name: `${existingUser.firstName} ${existingUser.lastName}`
          });
          return existingUser;
        }
      } catch (checkError) {
        console.error('❌ Error checking existing user:', checkError);
      }
    }

    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  createTestUser()
    .then(() => {
      console.log('\n🎉 Test user setup complete!');
      console.log('Now you can create test activities with the API endpoints.');
    })
    .catch((error) => {
      console.error('\n💥 Failed to create test user:', error);
      process.exit(1);
    });
}

export { createTestUser };