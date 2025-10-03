#!/usr/bin/env npx tsx

import { ExtendedPrismaClient } from '../src/database/prisma-client';

const prisma = new ExtendedPrismaClient();

async function main() {
  try {
    console.log('🔍 Checking for development user...');

    // Check if dev-user-123 exists
    const existingUser = await prisma.userData.findUnique({
      where: { id: 'dev-user-123' }
    });

    if (existingUser) {
      console.log('✅ Development user already exists:', {
        id: existingUser.id,
        email: existingUser.email,
        name: `${existingUser.firstName} ${existingUser.lastName}`
      });
      return existingUser;
    }

    console.log('🔧 Creating development user...');

    const user = await prisma.userData.create({
      data: {
        id: 'dev-user-123',
        email: 'dev@fortium.test',
        firstName: 'Development',
        lastName: 'User',
        role: 'admin'
      }
    });

    console.log('✅ Development user created:', {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`
    });

    return user;

  } catch (error) {
    console.error('❌ Error with development user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { main as ensureDevUser };