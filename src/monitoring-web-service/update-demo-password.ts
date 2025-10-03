#!/usr/bin/env npx tsx

/**
 * Update Demo User Password
 * Sets a proper bcrypted password for demo@fortium.com user
 */

import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PasswordService } from './src/auth/password.service';

const prisma = new PrismaClient();

async function updateDemoPassword() {
  try {
    console.log('🔧 Updating demo@fortium.com password...');

    // The password that meets all requirements
    const newPassword = 'Demo123!';

    // Validate the password
    const validation = PasswordService.validatePassword(newPassword);
    console.log('Password validation:', {
      isValid: validation.isValid,
      strength: validation.strength,
      score: validation.score,
      errors: validation.errors
    });

    if (!validation.isValid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
    }

    // Hash the password
    console.log('Hashing password...');
    const passwordHash = await PasswordService.hashPassword(newPassword);
    console.log('Password hashed successfully');

    // Check if user exists first
    const users = await prisma.$queryRaw<Array<{
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      is_active: boolean;
    }>>`
      SELECT id, email, first_name, last_name, is_active
      FROM fortium_schema.users
      WHERE email = 'demo@fortium.com'
    `;

    if (users.length === 0) {
      console.log('❌ User demo@fortium.com not found');
      return;
    }

    const user = users[0];
    console.log('Found user:', {
      id: user.id,
      email: user.email,
      name: `${user.first_name} ${user.last_name}`,
      isActive: user.is_active
    });

    // Update the password
    await prisma.$queryRaw`
      UPDATE fortium_schema.users
      SET password_hash = ${passwordHash}, updated_at = NOW()
      WHERE email = 'demo@fortium.com'
    `;

    console.log('✅ Password updated successfully!');
    console.log('🎯 You can now login with:');
    console.log('   Email: demo@fortium.com');
    console.log('   Password: Demo123!');

    // Verify the password works
    console.log('\n🔍 Verifying password...');
    const isValid = await PasswordService.verifyPassword(newPassword, passwordHash);
    console.log('Password verification:', isValid ? '✅ SUCCESS' : '❌ FAILED');

  } catch (error) {
    console.error('❌ Error updating demo password:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  updateDemoPassword()
    .then(() => {
      console.log('\n🎉 Demo password update complete!');
    })
    .catch((error) => {
      console.error('\n💥 Failed to update demo password:', error);
      process.exit(1);
    });
}

export { updateDemoPassword };