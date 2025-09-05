-- Migration 006: Webhook System
-- Task 4.3: Create webhook system tables for Claude Code integration

-- Webhook subscriptions table
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    webhook_url TEXT NOT NULL,
    event_types JSONB NOT NULL DEFAULT '[]'::jsonb,
    secret TEXT, -- HMAC secret for signature verification
    active BOOLEAN NOT NULL DEFAULT true,
    retry_settings JSONB NOT NULL DEFAULT '{
        "max_retries": 3,
        "retry_delay_ms": 5000,
        "exponential_backoff": true
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_webhook_url CHECK (webhook_url ~* '^https?://'),
    CONSTRAINT valid_retry_settings CHECK (
        (retry_settings->>'max_retries')::int >= 0 AND 
        (retry_settings->>'max_retries')::int <= 10 AND
        (retry_settings->>'retry_delay_ms')::int >= 1000 AND
        (retry_settings->>'retry_delay_ms')::int <= 300000
    )
);

-- Webhook events table
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES webhook_subscriptions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    response_status INTEGER,
    response_body TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Webhook secrets table for multiple secret management
CREATE TABLE IF NOT EXISTS webhook_secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL, -- claude-code, fortium-metrics-server, etc.
    secret TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Unique active secret per source
    CONSTRAINT unique_active_secret_per_source EXCLUDE USING btree (source WITH =) WHERE (active = true)
);

-- Productivity alerts table
CREATE TABLE IF NOT EXISTS productivity_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL, -- productivity_decline, threshold_breach, anomaly_detected
    threshold_value DECIMAL,
    current_value DECIMAL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- MCP sessions table for tracking Claude Code sessions
CREATE TABLE IF NOT EXISTS mcp_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL, -- Claude session identifier
    client_info JSONB, -- Client information from MCP initialize
    capabilities JSONB, -- Client capabilities
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    commands_executed INTEGER NOT NULL DEFAULT 0,
    total_execution_time_ms BIGINT NOT NULL DEFAULT 0,
    
    -- Unique session per organization
    CONSTRAINT unique_session_per_org UNIQUE (organization_id, session_id)
);

-- MCP requests table for tracking all MCP protocol requests
CREATE TABLE IF NOT EXISTS mcp_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    session_id UUID REFERENCES mcp_sessions(id) ON DELETE SET NULL,
    request_id TEXT, -- JSON-RPC request ID
    method TEXT NOT NULL,
    params JSONB,
    response JSONB,
    success BOOLEAN NOT NULL,
    execution_time_ms INTEGER,
    error_code INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_org ON webhook_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_active ON webhook_subscriptions(organization_id, active) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_webhook_events_org ON webhook_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry ON webhook_events(next_retry_at) WHERE status = 'retrying';

CREATE INDEX IF NOT EXISTS idx_webhook_secrets_source ON webhook_secrets(source);
CREATE INDEX IF NOT EXISTS idx_webhook_secrets_active ON webhook_secrets(source, active) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_productivity_alerts_org ON productivity_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_productivity_alerts_type ON productivity_alerts(organization_id, alert_type);
CREATE INDEX IF NOT EXISTS idx_productivity_alerts_severity ON productivity_alerts(organization_id, severity);
CREATE INDEX IF NOT EXISTS idx_productivity_alerts_unack ON productivity_alerts(organization_id, acknowledged) WHERE acknowledged = false;

CREATE INDEX IF NOT EXISTS idx_mcp_sessions_org ON mcp_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_session_id ON mcp_sessions(organization_id, session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_sessions_active ON mcp_sessions(organization_id, ended_at) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mcp_requests_org ON mcp_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_mcp_requests_session ON mcp_requests(session_id);
CREATE INDEX IF NOT EXISTS idx_mcp_requests_method ON mcp_requests(organization_id, method);
CREATE INDEX IF NOT EXISTS idx_mcp_requests_created ON mcp_requests(created_at);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_webhook_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER webhook_subscriptions_updated_at
    BEFORE UPDATE ON webhook_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_webhook_subscriptions_updated_at();

-- Function to clean up old webhook events
CREATE OR REPLACE FUNCTION cleanup_webhook_events()
RETURNS void AS $$
BEGIN
    -- Delete webhook events older than 30 days
    DELETE FROM webhook_events 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete MCP requests older than 7 days (keep recent for debugging)
    DELETE FROM mcp_requests 
    WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Function to automatically retry failed webhooks
CREATE OR REPLACE FUNCTION retry_failed_webhooks()
RETURNS void AS $$
BEGIN
    -- Update webhook events that are ready for retry
    UPDATE webhook_events 
    SET 
        status = 'retrying',
        next_retry_at = NOW() + INTERVAL '5 minutes'
    WHERE 
        status = 'failed' 
        AND attempts < 3
        AND (next_retry_at IS NULL OR next_retry_at <= NOW());
END;
$$ LANGUAGE plpgsql;

-- Insert default webhook secrets for development
INSERT INTO webhook_secrets (source, secret, active) VALUES
    ('claude-code', 'claude-code-dev-secret', true),
    ('fortium-metrics-server', 'fortium-metrics-dev-secret', true),
    ('test', 'test-webhook-secret', true)
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON webhook_subscriptions TO fortium_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON webhook_events TO fortium_app;
GRANT SELECT ON webhook_secrets TO fortium_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON productivity_alerts TO fortium_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON mcp_sessions TO fortium_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON mcp_requests TO fortium_app;

-- Migration metadata
INSERT INTO schema_migrations (version, description, applied_at) 
VALUES (6, 'Webhook system and MCP integration tables', NOW())
ON CONFLICT (version) DO NOTHING;