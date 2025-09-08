# OAuth 2.0 Authentication Implementation

This directory contains a comprehensive OAuth 2.0 authentication system for the Fortium External Metrics Web Service, supporting Google Workspace, Microsoft Azure AD, and generic OIDC providers.

## Architecture Overview

The OAuth implementation follows a modular, provider-agnostic architecture:

```
src/auth/oauth/
├── oauth.factory.ts      # Provider factory and base classes
├── google.service.ts     # Google Workspace OAuth implementation
├── azure.service.ts      # Microsoft Azure AD OAuth implementation
├── oidc.service.ts       # Generic OIDC provider implementation
├── config.service.ts     # OAuth configuration management
├── user-mapping.service.ts  # User provisioning and role mapping
└── middleware/
    └── oauth.middleware.ts   # Authentication middleware
```

## Features

### 🔐 **Multi-Provider Support**
- **Google Workspace**: Full OAuth 2.0 + OIDC with G Suite domain restrictions
- **Microsoft Azure AD**: OAuth 2.0 + OIDC with tenant support and Microsoft Graph integration
- **Generic OIDC**: Support for Okta, Auth0, Keycloak, and other OIDC providers

### 🛡️ **Security-First Design**
- **PKCE (Proof Key for Code Exchange)**: All flows use PKCE for enhanced security
- **State Parameter Validation**: CSRF protection with secure random state generation
- **Token Encryption**: OAuth tokens encrypted at rest using AES-256-GCM
- **Rate Limiting**: Configurable rate limits on authentication endpoints
- **Audit Logging**: Comprehensive logging of authentication events

### 🏢 **Multi-Tenant Architecture**
- **Organization Isolation**: Complete data isolation between organizations
- **Per-Tenant Configuration**: Each organization can configure their own OAuth providers
- **Row-Level Security**: Database-level security policies enforce tenant isolation

### 👥 **Intelligent User Provisioning**
- **Flexible Mapping Rules**: Configure user role assignment based on:
  - Email domain patterns
  - OAuth provider group memberships  
  - Custom attribute values
  - Default fallback rules
- **Automatic User Creation**: Optional auto-provisioning with configurable policies
- **Team Assignment**: Automatic team membership based on mapping rules

### ⚡ **High Performance**
- **Token Caching**: Smart caching of OAuth discovery metadata
- **Async Operations**: Non-blocking authentication flows
- **Connection Pooling**: Efficient database connection management
- **Response Time**: < 200ms authentication, < 500ms callback handling

## Quick Start

### 1. Install Dependencies

```bash
npm install openid-client passport passport-google-oauth20 passport-oauth2 uuid
npm install --save-dev @types/passport @types/passport-google-oauth20 @types/passport-oauth2 @types/uuid
```

### 2. Environment Configuration

```bash
# OAuth encryption key (32 bytes hex)
OAUTH_ENCRYPTION_KEY=your-32-byte-hex-key

# JWT secrets for application tokens
JWT_ACCESS_SECRET=your-jwt-access-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret
```

### 3. Database Migration

Run the OAuth enhancement migration:

```bash
npm run migrate
```

This creates the following tables:
- `oauth_tokens` - Encrypted OAuth token storage
- `oauth_sessions` - PKCE session management
- `user_oauth_identities` - OAuth identity linking
- `user_mapping_rules` - User provisioning rules
- `oauth_discovery_cache` - Provider metadata cache

### 4. Basic Usage

```typescript
import { createAuthRoutes } from './routes/auth.routes';
import { DatabaseConnection } from './database/connection';
import * as winston from 'winston';

const db = new DatabaseConnection();
const logger = winston.createLogger();

// Create auth routes with OAuth support
const { router, oauthConfigService } = createAuthRoutes(db, logger);
app.use('/api/auth', router);

// Configure Google OAuth
await oauthConfigService.createOrUpdateConfig({
  organization_id: 'your-org-id',
  provider_name: 'google',
  provider_type: 'oidc',
  client_id: 'your-google-client-id.apps.googleusercontent.com',
  client_secret: 'your-google-client-secret',
  redirect_uri: 'https://your-app.com/auth/oauth/google/callback',
  scopes: ['openid', 'email', 'profile'],
  additional_config: {
    hosted_domain: 'your-company.com' // Optional G Suite restriction
  }
});
```

## Provider Configuration

### Google Workspace Setup

1. **Google Cloud Console**:
   - Create a new project or use existing
   - Enable Google+ API and Google Identity API
   - Create OAuth 2.0 credentials

2. **Configuration**:
   ```json
   {
     "provider_name": "google",
     "client_id": "123456789.apps.googleusercontent.com",
     "client_secret": "GOCSPX-your-secret",
     "redirect_uri": "https://your-app.com/auth/oauth/google/callback",
     "scopes": ["openid", "email", "profile"],
     "additional_config": {
       "hosted_domain": "company.com",
       "access_type": "offline"
     }
   }
   ```

### Microsoft Azure AD Setup

1. **Azure Portal**:
   - Register new application in Azure AD
   - Configure redirect URIs
   - Generate client secret

2. **Configuration**:
   ```json
   {
     "provider_name": "azure",
     "client_id": "12345678-1234-1234-1234-123456789012",
     "client_secret": "your-azure-secret",
     "redirect_uri": "https://your-app.com/auth/oauth/azure/callback",
     "scopes": ["openid", "email", "profile", "User.Read"],
     "additional_config": {
       "tenant_id": "your-tenant-id"
     }
   }
   ```

### Generic OIDC Setup (Okta Example)

1. **Okta Admin Console**:
   - Create new OIDC application
   - Configure redirect URIs
   - Note client credentials and endpoints

2. **Configuration**:
   ```json
   {
     "provider_name": "okta",
     "discovery_url": "https://dev-123456.okta.com/.well-known/openid_configuration",
     "client_id": "your-okta-client-id",
     "client_secret": "your-okta-secret",
     "redirect_uri": "https://your-app.com/auth/oauth/okta/callback",
     "scopes": ["openid", "email", "profile", "groups"]
   }
   ```

## User Mapping Configuration

Configure how OAuth users are mapped to internal roles:

```typescript
// Create mapping rule for company domain
await userMappingService.createUserMappingRule({
  organization_id: 'your-org-id',
  provider: 'google',
  rule_type: 'email_domain',
  condition: { domains: ['company.com'] },
  target_role: 'developer',
  auto_create_user: true,
  team_assignments: ['dev-team-id'],
  priority: 10
});

// Create rule for admin group
await userMappingService.createUserMappingRule({
  organization_id: 'your-org-id',
  provider: 'azure',
  rule_type: 'group_membership', 
  condition: { required_groups: ['Company Admins'] },
  target_role: 'admin',
  auto_create_user: true,
  priority: 5
});

// Default fallback rule
await userMappingService.createUserMappingRule({
  organization_id: 'your-org-id',
  provider: '*',
  rule_type: 'default',
  condition: {},
  target_role: 'viewer',
  auto_create_user: false,
  priority: 999
});
```

## API Usage Examples

### Frontend Integration

```javascript
// Initiate OAuth flow
const response = await fetch('/api/auth/oauth/initiate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'google',
    organization_slug: 'company-name'
  })
});

const { authorization_url } = await response.json();

// Redirect user to OAuth provider
window.location.href = authorization_url;

// Handle callback (in your callback route)
const callbackResponse = await fetch('/api/auth/oauth/callback', {
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    code: urlParams.get('code'),
    state: urlParams.get('state'),
    provider: 'google'
  })
});

const { access_token, user } = await callbackResponse.json();
// Store JWT token and user info
```

### Server-to-Server Usage

```typescript
import { OAuthMiddleware } from './auth/middleware/oauth.middleware';

const oauthMiddleware = new OAuthMiddleware(db, logger, jwtService);

// Protect routes with OAuth
app.get('/api/protected', 
  oauthMiddleware.authenticateOAuth,
  (req, res) => {
    // Access authenticated user via req.user
    // Access OAuth info via req.oauth
    res.json({ user: req.user });
  }
);

// Require specific OAuth provider
app.get('/api/google-only',
  oauthMiddleware.authenticateOAuth,
  oauthMiddleware.requireOAuthProvider('google'),
  (req, res) => {
    res.json({ message: 'Google-authenticated user only' });
  }
);
```

## Testing

### Unit Tests

Run provider-specific unit tests:

```bash
# Test Google OAuth service
npm test src/tests/unit/oauth/google.service.test.ts

# Test Azure OAuth service  
npm test src/tests/unit/oauth/azure.service.test.ts

# Test user mapping service
npm test src/tests/unit/oauth/user-mapping.service.test.ts
```

### Integration Tests

Test complete OAuth flows:

```bash
# Run OAuth integration tests
npm test src/tests/integration/oauth-integration.test.ts

# Run with coverage
npm run test:coverage -- --testPathPattern=oauth
```

### Manual Testing

Use the provided test utilities:

```bash
# Test OAuth configuration
curl -X POST "http://localhost:3000/api/auth/oauth/config" \
  -H "Authorization: Bearer admin-jwt-token" \
  -H "Content-Type: application/json" \
  -d @test/fixtures/google-oauth-config.json

# Test provider discovery
curl "http://localhost:3000/api/auth/oauth/providers/test-org"

# Initiate test flow
curl -X POST "http://localhost:3000/api/auth/oauth/initiate" \
  -H "Content-Type: application/json" \
  -d '{"provider": "google", "organization_slug": "test-org"}'
```

## Security Best Practices

### Production Deployment

1. **Environment Variables**: Never commit OAuth secrets to version control
2. **HTTPS Only**: Always use HTTPS in production for OAuth flows
3. **Secure Cookies**: Configure secure cookie settings for session management
4. **Rate Limiting**: Implement appropriate rate limits for your use case
5. **Token Rotation**: Regularly rotate OAuth client secrets
6. **Audit Logging**: Monitor and alert on authentication failures

### Secret Management

```bash
# Generate secure encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Use environment-specific configurations
export OAUTH_ENCRYPTION_KEY="your-production-key"
export JWT_ACCESS_SECRET="your-production-jwt-secret"
```

### Database Security

- Enable Row-Level Security (RLS) policies
- Use separate database users for different environments
- Regularly backup and test OAuth configuration data
- Monitor for unusual authentication patterns

## Troubleshooting

### Common Issues

**"OAuth client not initialized"**
```bash
# Check provider configuration
SELECT * FROM sso_providers WHERE organization_id = 'your-org-id';

# Verify discovery URL is accessible
curl https://accounts.google.com/.well-known/openid_configuration
```

**"Invalid or expired OAuth session"**
```bash
# Check session storage
SELECT * FROM oauth_sessions WHERE state = 'your-state-value';

# Verify CSRF state parameter matches
```

**"User creation not allowed"**
```bash
# Check user mapping rules
SELECT * FROM user_mapping_rules WHERE organization_id = 'your-org-id';

# Test rule evaluation with debug logging
DEBUG=oauth:mapping npm start
```

### Debug Logging

Enable detailed OAuth logging:

```bash
# All OAuth operations
DEBUG=oauth:* npm start

# Specific provider
DEBUG=oauth:google npm start

# User mapping only
DEBUG=oauth:mapping npm start
```

### Performance Monitoring

Monitor OAuth performance metrics:

```typescript
// Add custom metrics
import { performance } from 'perf_hooks';

const startTime = performance.now();
await oauthProvider.exchangeCodeForTokens(/* ... */);
const duration = performance.now() - startTime;

logger.info('OAuth token exchange completed', {
  provider: 'google',
  duration_ms: duration,
  performance_target_ms: 500
});
```

## Contributing

When adding new OAuth providers:

1. **Extend BaseOAuthProvider**: Implement required abstract methods
2. **Add Factory Support**: Update OAuthProviderFactory with new provider
3. **Write Tests**: Include unit and integration tests
4. **Update Documentation**: Add provider-specific setup instructions
5. **Add Validation**: Include Joi schemas for provider-specific configuration

### Provider Template

```typescript
export class CustomOAuthService extends BaseOAuthProvider {
  constructor(db: DatabaseConnection, logger: winston.Logger) {
    super(db, logger, 'custom-provider');
  }

  async initialize(config: CustomOAuthConfig): Promise<void> {
    // Provider-specific initialization
  }

  async getAuthorizationUrl(config: CustomOAuthConfig, state: string) {
    // Generate authorization URL with PKCE
  }

  async exchangeCodeForTokens(config, code, codeVerifier, state) {
    // Exchange authorization code for tokens
  }

  async getUserProfile(accessToken: string) {
    // Get user profile from provider
  }

  getDefaultScopes(): string[] {
    return ['openid', 'email', 'profile'];
  }
}
```

## License

This OAuth implementation is part of the Fortium External Metrics Web Service and is licensed under the same terms as the main project.