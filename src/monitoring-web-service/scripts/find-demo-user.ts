#!/usr/bin/env npx tsx

/**
 * Find Demo User ID
 * Simple script to find the demo@fortium.com user's UUID
 */

import { ExtendedPrismaClient } from '../src/database/prisma-client';

const prisma = new ExtendedPrismaClient();

async function findDemoUser() {
  try {
    console.log('🔍 Looking for demo@fortium.com user...');

    // Look for demo user by email
    const demoUser = await prisma.userData.findFirst({
      where: {
        OR: [
          { email: 'demo@fortium.com' },
          { email: 'demo@fortium.test' },
          { firstName: 'Demo' }
        ]
      }
    });

    if (demoUser) {
      console.log('✅ Found demo user:', {
        id: demoUser.id,
        email: demoUser.email,
        name: `${demoUser.firstName} ${demoUser.lastName}`,
        role: demoUser.role
      });
      return demoUser;
    }

    // If not found, check what users exist
    console.log('❓ Demo user not found, checking all users...');
    const allUsers = await prisma.userData.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    console.log(`📋 Found ${allUsers.length} users:`, allUsers);

    if (allUsers.length === 0) {
      console.log('💡 No users found, need to create demo user');
      return null;
    }

    return allUsers[0]; // Return first user if demo not found

  } catch (error) {
    console.error('❌ Error finding demo user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  findDemoUser()
    .then((user) => {
      if (user) {
        console.log(`\n🎯 Use this UUID for testing: ${user.id}`);
      }
    })
    .catch((error) => {
      console.error('\n💥 Failed to find demo user:', error);
      process.exit(1);
    });
}

export { findDemoUser };