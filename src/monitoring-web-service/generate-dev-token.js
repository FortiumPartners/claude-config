const jwt = require('jsonwebtoken');

// Use the same secret from .env
const JWT_SECRET = 'your-super-secure-jwt-secret-key-here-change-in-production';

// Create a development user payload matching developmentAuth middleware
const payload = {
  userId: '8985da03-bd7f-4316-9316-afd59d319c13',
  tenantId: 'a1b2c3d4-e5f6-4789-a012-345678901234',
  email: 'demo@fortium.com',
  role: 'admin',
  permissions: ['read', 'write', 'admin']
};

const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });

console.log('Development JWT Token:');
console.log(token);
console.log('\nTo use this token, set it in localStorage:');
console.log(`localStorage.setItem('access_token', '${token}');`);
console.log(`localStorage.setItem('refresh_token', '${token}');`);
