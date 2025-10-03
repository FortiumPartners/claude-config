#!/usr/bin/env npx tsx

/**
 * Reset Demo User Password
 * Generates a secure password and updates demo@fortium.com user
 * Password meets all application security requirements:
 * - At least 8 characters
 * - Contains uppercase, lowercase, numbers, and special characters
 * - Avoids common patterns
 */

import { PrismaClient } from '../src/generated/prisma-client';
import { PasswordService } from '../src/auth/password.service';

const prisma = new PrismaClient();

interface ResetOptions {
    generateNew?: boolean;
    customPassword?: string;
    showPassword?: boolean;
}

async function resetDemoPassword(options: ResetOptions = {}) {
    try {
        console.log('🔧 Resetting demo@fortium.com password...');

        // Generate or use provided password
        let newPassword: string;

        if (options.customPassword) {
            newPassword = options.customPassword;
            console.log('📝 Using provided custom password');
        } else if (options.generateNew) {
            // Generate a secure password that meets all requirements
            newPassword = PasswordService.generateSecurePassword(12);
            console.log('🎲 Generated new secure password');
        } else {
            // Use a default secure password for demo purposes
            newPassword = 'DemoFortium2024!';
            console.log('🔒 Using default demo password');
        }

        // Validate the password against application requirements
        const validation = PasswordService.validatePassword(newPassword);
        console.log('🔍 Password validation:', {
            isValid: validation.isValid,
            strength: validation.strength,
            score: validation.score,
            errors: validation.errors.length > 0 ? validation.errors : ['None'],
        });

        if (!validation.isValid) {
            throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
        }

        // Hash the password using the service
        console.log('🔐 Hashing password...');
        const passwordHash = await PasswordService.hashPassword(newPassword);
        console.log('✅ Password hashed successfully');

        // Check if user exists first
        const users = await prisma.$queryRaw<
            Array<{
                id: string;
                email: string;
                first_name: string;
                last_name: string;
                is_active: boolean;
                password_hash: string | null;
            }>
        >`
      SELECT id, email, first_name, last_name, is_active, password_hash
      FROM fortium_schema.users
      WHERE email = 'demo@fortium.com'
    `;

        if (users.length === 0) {
            console.log('❌ User demo@fortium.com not found in database');
            console.log('💡 Try running the seed script first to create the demo user');
            return;
        }

        const user = users[0];
        console.log('👤 Found demo user:', {
            id: user.id,
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
            isActive: user.is_active,
            hasPassword: !!user.password_hash,
        });

        // Update the password in the database
        console.log('💾 Updating password in database...');
        await prisma.$queryRaw`
      UPDATE fortium_schema.users
      SET password_hash = ${passwordHash}, updated_at = NOW()
      WHERE email = 'demo@fortium.com'
    `;

        console.log('✅ Password updated successfully in database!');

        // Verify the password works by testing the hash
        console.log('\n🧪 Verifying password hash...');
        const isValid = await PasswordService.verifyPassword(newPassword, passwordHash);
        console.log('Hash verification:', isValid ? '✅ SUCCESS' : '❌ FAILED');

        if (isValid) {
            console.log('\n🎉 Password reset complete!');
            console.log('📧 Login credentials for demo@fortium.com:');
            console.log('   Email: demo@fortium.com');

            if (options.showPassword || options.generateNew) {
                console.log(`   Password: ${newPassword}`);
            } else {
                console.log('   Password: [Use --show-password flag to display]');
            }

            console.log(
                `\n📊 Password strength: ${validation.strength.toUpperCase()} (${validation.score}/100)`
            );

            if (validation.strength === 'strong') {
                console.log('🔒 Excellent! This password meets all security requirements.');
            } else if (validation.strength === 'good') {
                console.log(
                    '👍 Good password strength. Consider using a longer password for even better security.'
                );
            }
        } else {
            throw new Error('Password verification failed after update');
        }
    } catch (error) {
        console.error('❌ Error resetting demo password:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    const options: ResetOptions = {};

    // Parse command line arguments
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--generate':
            case '-g':
                options.generateNew = true;
                break;
            case '--password':
            case '-p':
                if (i + 1 < args.length) {
                    options.customPassword = args[i + 1];
                    i++; // Skip the next argument
                }
                break;
            case '--show-password':
            case '-s':
                options.showPassword = true;
                break;
            case '--help':
            case '-h':
                console.log(`
🔧 Demo Password Reset Tool

Usage: npx tsx scripts/reset-demo-password.ts [options]

Options:
  --generate, -g              Generate a new random secure password
  --password, -p <password>   Use a specific password
  --show-password, -s         Display the password in output
  --help, -h                  Show this help message

Examples:
  npx tsx scripts/reset-demo-password.ts
  npx tsx scripts/reset-demo-password.ts --generate --show-password
  npx tsx scripts/reset-demo-password.ts --password "MySecurePass123!"
        `);
                process.exit(0);
                break;
        }
    }

    await resetDemoPassword(options);
}

if (require.main === module) {
    main()
        .then(() => {
            console.log('\n🎯 Password reset operation completed successfully!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Password reset failed:', error);
            process.exit(1);
        });
}

export { resetDemoPassword };
