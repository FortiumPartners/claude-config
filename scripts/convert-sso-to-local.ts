#!/usr/bin/env npx tsx

/**
 * Convert SSO User to Local Authentication
 * Removes SSO provider settings and enables local password authentication
 */

import { PrismaClient } from '../src/generated/prisma-client';

const prisma = new PrismaClient();

async function convertSsoToLocal(email: string) {
    try {
        console.log(`🔄 Converting ${email} from SSO to local authentication...`);

        // Check if user exists first
        const users = await prisma.$queryRaw<
            Array<{
                id: string;
                email: string;
                first_name: string;
                last_name: string;
                is_active: boolean;
                password_hash: string | null;
                sso_provider: string | null;
                sso_user_id: string | null;
            }>
        >`
            SELECT id, email, first_name, last_name, is_active, password_hash, sso_provider, sso_user_id
            FROM fortium_schema.users
            WHERE email = ${email.toLowerCase()}
        `;

        if (users.length === 0) {
            console.log(`❌ User ${email} not found in database`);
            return;
        }

        const user = users[0];
        console.log('👤 Current user status:', {
            id: user.id,
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
            isActive: user.is_active,
            hasPassword: !!user.password_hash,
            ssoProvider: user.sso_provider,
            ssoUserId: user.sso_user_id,
        });

        if (!user.password_hash) {
            console.log('⚠️  User has no password set. Please run reset-demo-password.ts first.');
            return;
        }

        // Clear SSO settings to enable local authentication
        console.log('🔧 Removing SSO configuration...');
        await prisma.$queryRaw`
            UPDATE fortium_schema.users
            SET 
                sso_provider = NULL,
                sso_user_id = NULL,
                updated_at = NOW()
            WHERE email = ${email.toLowerCase()}
        `;

        console.log('✅ Successfully converted user to local authentication!');
        console.log('🎯 User can now login with email/password combination');

        // Verify the change
        const updatedUsers = await prisma.$queryRaw<
            Array<{
                id: string;
                email: string;
                sso_provider: string | null;
                sso_user_id: string | null;
            }>
        >`
            SELECT id, email, sso_provider, sso_user_id
            FROM fortium_schema.users
            WHERE email = ${email.toLowerCase()}
        `;

        if (updatedUsers.length > 0) {
            const updatedUser = updatedUsers[0];
            console.log('🔍 Verification - Updated user status:', {
                id: updatedUser.id,
                email: updatedUser.email,
                ssoProvider: updatedUser.sso_provider,
                ssoUserId: updatedUser.sso_user_id,
                authType: updatedUser.sso_provider ? 'SSO' : 'LOCAL',
            });
        }

    } catch (error) {
        console.error('❌ Error converting user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the conversion
const email = process.argv[2] || 'demo@fortium.com';
convertSsoToLocal(email);
