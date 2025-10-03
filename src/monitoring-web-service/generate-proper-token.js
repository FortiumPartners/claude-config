const jwt = require('jsonwebtoken');

// Use the same configuration as the JWT service
const JWT_SECRET = 'your-super-secure-jwt-secret-key-here-change-in-production';

// Create a proper payload with the correct structure
const payload = {
  userId: '8985da03-bd7f-4316-9316-afd59d319c13',
  tenantId: 'a1b2c3d4-e5f6-4789-a012-345678901234',
  email: 'demo@fortium.com',
  role: 'admin',
  permissions: ['read', 'write', 'admin']
};

// Generate token with the same options as the JWT service
const token = jwt.sign(
  payload,
  JWT_SECRET,
  {
    expiresIn: '24h',
    issuer: 'fortium-metrics-service',
    audience: 'fortium-client',
    subject: payload.userId,
  }
);

console.log('Proper Development JWT Token:');
console.log(token);
console.log('\nTo use this token, set it in localStorage:');
console.log(`localStorage.setItem('access_token', '${token}');`);
console.log(`localStorage.setItem('refresh_token', '${token}');`);
