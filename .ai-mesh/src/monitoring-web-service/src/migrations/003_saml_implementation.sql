-- Migration 003: SAML 2.0 Implementation
-- Adds SAML-specific tables and enhances existing authentication system

-- SAML configuration table for enterprise SSO providers
CREATE TABLE IF NOT EXISTS saml_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'okta-saml', 'azure-saml', 'generic-saml'
    entity_id VARCHAR(500) NOT NULL, -- IdP Entity ID
    sso_url VARCHAR(500) NOT NULL, -- IdP SSO URL  
    slo_url VARCHAR(500), -- IdP Single Logout URL
    certificate TEXT NOT NULL, -- IdP signing certificate (PEM format)
    name_id_format VARCHAR(255) NOT NULL DEFAULT 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    attribute_mapping JSONB NOT NULL DEFAULT '{
        "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        "firstName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
        "lastName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
        "groups": ["http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"]
    }',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(organization_id, provider)
);

-- Create indexes for saml_configs
CREATE INDEX IF NOT EXISTS idx_saml_configs_org ON saml_configs(organization_id);
CREATE INDEX IF NOT EXISTS idx_saml_configs_provider ON saml_configs(provider);
CREATE INDEX IF NOT EXISTS idx_saml_configs_active ON saml_configs(organization_id, is_active) WHERE is_active = true;

-- SAML sessions table for tracking active SAML sessions
CREATE TABLE IF NOT EXISTS saml_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) NOT NULL UNIQUE, -- SAML session ID
    name_id VARCHAR(255) NOT NULL, -- SAML NameID
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    attributes JSONB, -- SAML attributes received
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for saml_sessions
CREATE INDEX IF NOT EXISTS idx_saml_sessions_session_id ON saml_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_saml_sessions_user ON saml_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_saml_sessions_org ON saml_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_saml_sessions_expires ON saml_sessions(expires_at);

-- SAML requests table for replay attack protection
CREATE TABLE IF NOT EXISTS saml_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(255) NOT NULL UNIQUE, -- SAML Request ID
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    destination VARCHAR(500) NOT NULL,
    relay_state VARCHAR(500), -- Optional relay state
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create indexes for saml_requests
CREATE INDEX IF NOT EXISTS idx_saml_requests_id ON saml_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_saml_requests_org ON saml_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_saml_requests_expires ON saml_requests(expires_at);

-- SAML certificates table for managing SP signing certificates
CREATE TABLE IF NOT EXISTS saml_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    certificate_type VARCHAR(20) NOT NULL CHECK (certificate_type IN ('signing', 'encryption')),
    certificate TEXT NOT NULL, -- X.509 certificate in PEM format
    private_key_encrypted TEXT NOT NULL, -- Encrypted private key
    thumbprint VARCHAR(64) NOT NULL, -- SHA-256 thumbprint
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for saml_certificates
CREATE INDEX IF NOT EXISTS idx_saml_certs_org ON saml_certificates(organization_id);
CREATE INDEX IF NOT EXISTS idx_saml_certs_type ON saml_certificates(organization_id, certificate_type, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_saml_certs_thumbprint ON saml_certificates(thumbprint);
CREATE INDEX IF NOT EXISTS idx_saml_certs_expires ON saml_certificates(expires_at);

-- User SAML identities table for linking SAML identities to users
CREATE TABLE IF NOT EXISTS user_saml_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    name_id VARCHAR(255) NOT NULL, -- SAML NameID
    name_id_format VARCHAR(255) NOT NULL,
    attributes JSONB NOT NULL DEFAULT '{}', -- SAML attributes from provider
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(provider, name_id),
    UNIQUE(user_id, provider)
);

-- Create indexes for user_saml_identities
CREATE INDEX IF NOT EXISTS idx_saml_identities_user ON user_saml_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_saml_identities_org ON user_saml_identities(organization_id);
CREATE INDEX IF NOT EXISTS idx_saml_identities_provider_nameid ON user_saml_identities(provider, name_id);

-- Enable RLS for SAML tables
ALTER TABLE saml_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE saml_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE saml_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE saml_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saml_identities ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for SAML tables
CREATE POLICY saml_configs_isolation ON saml_configs 
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

CREATE POLICY saml_sessions_isolation ON saml_sessions 
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

CREATE POLICY saml_requests_isolation ON saml_requests 
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

CREATE POLICY saml_certificates_isolation ON saml_certificates 
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

CREATE POLICY saml_identities_isolation ON user_saml_identities 
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- Add triggers for updated_at columns
CREATE TRIGGER update_saml_configs_updated_at BEFORE UPDATE ON saml_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired SAML sessions and requests
CREATE OR REPLACE FUNCTION cleanup_expired_saml_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Clean expired SAML sessions
    DELETE FROM saml_sessions WHERE expires_at <= NOW();
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- Clean expired SAML requests (replay protection)
    DELETE FROM saml_requests WHERE expires_at <= NOW();
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Update the main cleanup function to include SAML cleanup
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
    
    -- Clean expired SAML data
    SELECT cleanup_expired_saml_data() INTO temp_count;
    deleted_count := deleted_count + temp_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert sample SAML configurations for common providers
INSERT INTO saml_configs (
    organization_id, 
    provider, 
    entity_id,
    sso_url,
    certificate,
    name_id_format,
    attribute_mapping,
    is_active
) 
SELECT 
    o.id,
    'okta-saml',
    'http://www.okta.com/your-okta-entity-id',
    'https://dev-12345.okta.com/app/your-app/sso/saml',
    'SAMPLE_CERTIFICATE_PLACEHOLDER_BASE64',
    'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    '{
        "email": "email",
        "firstName": "firstName",
        "lastName": "lastName",
        "groups": ["groups"]
    }',
    false -- Disabled by default, needs proper configuration
FROM organizations o 
WHERE o.slug = 'demo-org' 
ON CONFLICT (organization_id, provider) DO NOTHING;

INSERT INTO saml_configs (
    organization_id, 
    provider, 
    entity_id,
    sso_url,
    certificate,
    name_id_format,
    attribute_mapping,
    is_active
) 
SELECT 
    o.id,
    'azure-saml',
    'https://sts.windows.net/your-tenant-id/',
    'https://login.microsoftonline.com/your-tenant-id/saml2',
    'SAMPLE_CERTIFICATE_PLACEHOLDER_BASE64',
    'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    '{
        "email": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
        "firstName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname",
        "lastName": "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname",
        "groups": ["http://schemas.microsoft.com/ws/2008/06/identity/claims/groups"]
    }',
    false -- Disabled by default, needs proper configuration
FROM organizations o 
WHERE o.slug = 'demo-org'
ON CONFLICT (organization_id, provider) DO NOTHING;

-- Migration completion log
INSERT INTO auth_audit_log (event_type, event_details, success, timestamp)
VALUES ('migration_completed', '{"migration": "003_saml_implementation", "version": "1.0.0"}', true, NOW());

-- Grant permissions for SAML tables
GRANT SELECT, INSERT, UPDATE, DELETE ON saml_configs TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON saml_sessions TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON saml_requests TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON saml_certificates TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_saml_identities TO postgres;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO postgres;