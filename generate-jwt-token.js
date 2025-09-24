#!/usr/bin/env node
/**
 * Generate JWT token for existing user profile
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Read the existing user profile
const profilePath = path.join(os.homedir(), '.ai-mesh', 'profile', 'user.json');

if (!fs.existsSync(profilePath)) {
    console.error('❌ User profile not found at:', profilePath);
    process.exit(1);
}

const userProfile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

// Create JWT payload matching the backend's JwtPayload interface
const jwtPayload = {
    userId: userProfile.userId,
    tenantId: userProfile.organizationId,
    email: userProfile.email,
    role: 'developer',
    permissions: ['read', 'write']
};

console.log('📋 User Profile Data:');
console.log(JSON.stringify(userProfile, null, 2));
console.log('\n🎫 JWT Payload:');
console.log(JSON.stringify(jwtPayload, null, 2));

// We need to use the backend's JWT service to generate the token
console.log('\n📝 To generate the JWT token, run this in the monitoring-web-service directory:');
console.log(`node -e "
const { JwtService } = require('./src/auth/jwt.service');
const token = JwtService.generateAccessToken(${JSON.stringify(jwtPayload)});
console.log('JWT Token:', token);
"`);