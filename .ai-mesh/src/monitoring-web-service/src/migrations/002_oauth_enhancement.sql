-- Migration 002: OAuth 2.0 Enhancement
-- Extends authentication foundation with OAuth-specific tables and improvements

-- OAuth configuration table (enhanced from existing sso_providers)
-- Adding OAuth-specific fields if they don't exist
DO $$ 
BEGIN
    -- Add OAuth-specific columns to sso_providers table
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_providers' AND column_name = 'authorization_endpoint') THEN
        ALTER TABLE sso_providers ADD COLUMN authorization_endpoint VARCHAR(500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_providers' AND column_name = 'token_endpoint') THEN
        ALTER TABLE sso_providers ADD COLUMN token_endpoint VARCHAR(500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_providers' AND column_name = 'userinfo_endpoint') THEN
        ALTER TABLE sso_providers ADD COLUMN userinfo_endpoint VARCHAR(500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_providers' AND column_name = 'jwks_uri') THEN
        ALTER TABLE sso_providers ADD COLUMN jwks_uri VARCHAR(500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_providers' AND column_name = 'issuer') THEN
        ALTER TABLE sso_providers ADD COLUMN issuer VARCHAR(500);
    END IF;
END $$;

-- OAuth tokens storage table for user OAuth tokens
CREATE TABLE IF NOT EXISTS oauth_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google', 'azure', 'oidc'
    access_token_encrypted TEXT NOT NULL, -- Encrypted OAuth access token
    refresh_token_encrypted TEXT, -- Encrypted OAuth refresh token
    token_type VARCHAR(50) NOT NULL DEFAULT 'Bearer',
    scope VARCHAR(500),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, provider)
);

-- Create indexes for oauth_tokens
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_org ON oauth_tokens(organization_id);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_provider ON oauth_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_tokens_expires ON oauth_tokens(expires_at);

-- OAuth sessions table for PKCE and state management
CREATE TABLE IF NOT EXISTS oauth_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state VARCHAR(255) NOT NULL UNIQUE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    code_verifier VARCHAR(255) NOT NULL, -- PKCE code verifier
    code_challenge VARCHAR(255) NOT NULL, -- PKCE code challenge
    redirect_uri VARCHAR(500) NOT NULL,
    nonce VARCHAR(255), -- OIDC nonce for replay protection
    scopes VARCHAR(500),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for oauth_sessions
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_state ON oauth_sessions(state);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_org ON oauth_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_expires ON oauth_sessions(expires_at);

-- User identity mappings table for linking OAuth identities
CREATE TABLE IF NOT EXISTS user_oauth_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL, -- External user ID from OAuth provider
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    picture_url VARCHAR(500),
    profile_data JSONB NOT NULL DEFAULT '{}', -- Additional profile data from provider
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(provider, provider_user_id),
    UNIQUE(user_id, provider)
);

-- Create indexes for user_oauth_identities
CREATE INDEX IF NOT EXISTS idx_oauth_identities_user ON user_oauth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_identities_org ON user_oauth_identities(organization_id);
CREATE INDEX IF NOT EXISTS idx_oauth_identities_provider_id ON user_oauth_identities(provider, provider_user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_identities_email ON user_oauth_identities(email);

-- OAuth provider discovery cache table
CREATE TABLE IF NOT EXISTS oauth_discovery_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL,
    issuer VARCHAR(500) NOT NULL,
    discovery_data JSONB NOT NULL,
    cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    UNIQUE(provider, issuer)
);

-- Create indexes for oauth_discovery_cache
CREATE INDEX IF NOT EXISTS idx_oauth_discovery_provider ON oauth_discovery_cache(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_discovery_expires ON oauth_discovery_cache(expires_at);

-- User mapping rules table for OAuth user provisioning
CREATE TABLE IF NOT EXISTS user_mapping_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- Specific provider or '*' for all
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('email_domain', 'group_membership', 'attribute_value', 'default')),
    condition JSONB NOT NULL, -- Rule conditions as JSON
    target_role VARCHAR(50) NOT NULL CHECK (target_role IN ('owner', 'admin', 'manager', 'developer', 'viewer')),
    auto_create_user BOOLEAN NOT NULL DEFAULT false,
    team_assignments JSONB NOT NULL DEFAULT '[]', -- Array of team IDs
    priority INTEGER NOT NULL DEFAULT 100, -- Lower number = higher priority
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for user_mapping_rules
CREATE INDEX IF NOT EXISTS idx_mapping_rules_org_provider ON user_mapping_rules(organization_id, provider);
CREATE INDEX IF NOT EXISTS idx_mapping_rules_priority ON user_mapping_rules(organization_id, priority);
CREATE INDEX IF NOT EXISTS idx_mapping_rules_active ON user_mapping_rules(organization_id, is_active) WHERE is_active = true;

-- Enable RLS for OAuth tables
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_oauth_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_mapping_rules ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for OAuth tables
CREATE POLICY oauth_tokens_isolation ON oauth_tokens 
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

CREATE POLICY oauth_sessions_isolation ON oauth_sessions 
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

CREATE POLICY oauth_identities_isolation ON user_oauth_identities 
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

CREATE POLICY user_mapping_rules_isolation ON user_mapping_rules 
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- Add triggers for updated_at columns
CREATE TRIGGER update_oauth_tokens_updated_at BEFORE UPDATE ON oauth_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_mapping_rules_updated_at BEFORE UPDATE ON user_mapping_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired OAuth sessions
CREATE OR REPLACE FUNCTION cleanup_expired_oauth_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Clean expired OAuth sessions
    DELETE FROM oauth_sessions WHERE expires_at <= NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean expired discovery cache
    DELETE FROM oauth_discovery_cache WHERE expires_at <= NOW();
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Update existing cleanup function to include OAuth cleanup
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Clean expired refresh tokens
    DELETE FROM refresh_tokens WHERE expires_at <= NOW();
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- Clean expired blacklist entries
    DELETE FROM token_blacklist WHERE expires_at <= NOW();
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- Clean expired user sessions
    DELETE FROM user_sessions WHERE expires_at <= NOW();
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- Clean expired OAuth sessions
    SELECT cleanup_expired_oauth_sessions() INTO temp_count;
    deleted_count := deleted_count + temp_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert sample OAuth configurations for common providers
INSERT INTO sso_providers (
    organization_id, 
    provider_name, 
    provider_type, 
    client_id, 
    client_secret_encrypted, 
    discovery_url, 
    redirect_uri, 
    scopes,
    additional_config,
    authorization_endpoint,
    token_endpoint,
    userinfo_endpoint,
    issuer,
    is_active
) 
SELECT 
    o.id,
    'google',
    'oidc',
    'your-google-client-id.apps.googleusercontent.com',
    'encrypted_secret_placeholder',
    'https://accounts.google.com/.well-known/openid_configuration',
    'https://your-domain.com/auth/oauth/google/callback',
    '["openid", "email", "profile"]',
    '{"hosted_domain": null}',
    'https://accounts.google.com/o/oauth2/v2/auth',
    'https://oauth2.googleapis.com/token',
    'https://www.googleapis.com/oauth2/v2/userinfo',
    'https://accounts.google.com',
    false -- Disabled by default, needs proper configuration
FROM organizations o 
WHERE o.slug = 'demo-org' 
ON CONFLICT (organization_id, provider_name) DO NOTHING;

INSERT INTO sso_providers (
    organization_id, 
    provider_name, 
    provider_type, 
    client_id, 
    client_secret_encrypted, 
    discovery_url, 
    redirect_uri, 
    scopes,
    additional_config,
    authorization_endpoint,
    token_endpoint,
    userinfo_endpoint,
    issuer,
    is_active
) 
SELECT 
    o.id,
    'azure',
    'oidc',
    'your-azure-client-id',
    'encrypted_secret_placeholder',
    'https://login.microsoftonline.com/common/v2.0/.well-known/openid_configuration',
    'https://your-domain.com/auth/oauth/azure/callback',
    '["openid", "email", "profile", "User.Read"]',
    '{"tenant_id": "common"}',
    'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    'https://graph.microsoft.com/v1.0/me',
    'https://login.microsoftonline.com/common/v2.0',
    false -- Disabled by default, needs proper configuration
FROM organizations o 
WHERE o.slug = 'demo-org'
ON CONFLICT (organization_id, provider_name) DO NOTHING;

-- Migration completion log
INSERT INTO auth_audit_log (event_type, event_details, success, timestamp)
VALUES ('migration_completed', '{"migration": "002_oauth_enhancement", "version": "1.0.0"}', true, NOW());

-- Grant permissions for OAuth tables
GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_tokens TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_sessions TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_oauth_identities TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON oauth_discovery_cache TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_mapping_rules TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;