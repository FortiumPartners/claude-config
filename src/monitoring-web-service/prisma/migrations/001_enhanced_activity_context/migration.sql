-- Migration 001: Enhanced Activity Context
-- Extends the existing activity_data table with enhanced context fields
-- This migration is reversible and safe for production deployment

BEGIN;

-- Add enhanced context columns to activity_data table
ALTER TABLE tenant_template.activity_data
ADD COLUMN IF NOT EXISTS enhanced_context JSONB,
ADD COLUMN IF NOT EXISTS performance_metrics JSONB,
ADD COLUMN IF NOT EXISTS input_data JSONB,
ADD COLUMN IF NOT EXISTS output_data JSONB,
ADD COLUMN IF NOT EXISTS error_details JSONB,
ADD COLUMN IF NOT EXISTS correlation_data JSONB,
ADD COLUMN IF NOT EXISTS business_impact JSONB;

-- Add enhanced indexes for improved query performance
CREATE INDEX IF NOT EXISTS idx_activity_enhanced_search
ON tenant_template.activity_data USING GIN (enhanced_context);

CREATE INDEX IF NOT EXISTS idx_activity_performance
ON tenant_template.activity_data USING GIN (performance_metrics);

CREATE INDEX IF NOT EXISTS idx_activity_correlation
ON tenant_template.activity_data USING GIN (correlation_data);

CREATE INDEX IF NOT EXISTS idx_activity_error_category
ON tenant_template.activity_data ((error_details->>'category'));

CREATE INDEX IF NOT EXISTS idx_activity_business_impact
ON tenant_template.activity_data USING GIN (business_impact);

CREATE INDEX IF NOT EXISTS idx_activity_workflow_id
ON tenant_template.activity_data ((correlation_data->>'workflowId'));

-- Create activity_workflows table for workflow tracking
CREATE TABLE IF NOT EXISTS tenant_template.activity_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  root_activity_id UUID,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Add foreign key constraint to activity_data
  CONSTRAINT fk_workflow_root_activity
    FOREIGN KEY (root_activity_id)
    REFERENCES tenant_template.activity_data(id)
    ON DELETE SET NULL
);

-- Add indexes for workflow table
CREATE INDEX IF NOT EXISTS idx_workflows_status
ON tenant_template.activity_workflows(status);

CREATE INDEX IF NOT EXISTS idx_workflows_root_activity
ON tenant_template.activity_workflows(root_activity_id);

CREATE INDEX IF NOT EXISTS idx_workflows_workflow_id
ON tenant_template.activity_workflows(workflow_id);

CREATE INDEX IF NOT EXISTS idx_workflows_created_at
ON tenant_template.activity_workflows(created_at DESC);

-- Add composite index for efficient workflow queries
CREATE INDEX IF NOT EXISTS idx_workflows_status_created
ON tenant_template.activity_workflows(status, created_at DESC);

-- Add performance indexes for activity queries
CREATE INDEX IF NOT EXISTS idx_activity_timestamp_status
ON tenant_template.activity_data(timestamp DESC, status);

CREATE INDEX IF NOT EXISTS idx_activity_user_timestamp
ON tenant_template.activity_data(user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_activity_automated_timestamp
ON tenant_template.activity_data(is_automated, timestamp DESC)
WHERE is_automated = true;

-- Add comment documentation
COMMENT ON COLUMN tenant_template.activity_data.enhanced_context IS
'Enhanced activity context including environment, execution details, and correlation information';

COMMENT ON COLUMN tenant_template.activity_data.performance_metrics IS
'Performance metrics including execution time, memory usage, CPU usage, and I/O statistics';

COMMENT ON COLUMN tenant_template.activity_data.input_data IS
'Input data including parameters, files, environment variables, and command line';

COMMENT ON COLUMN tenant_template.activity_data.output_data IS
'Output data including results, modified files, artifacts, and execution output';

COMMENT ON COLUMN tenant_template.activity_data.error_details IS
'Enhanced error information including category, severity, context, and recovery suggestions';

COMMENT ON COLUMN tenant_template.activity_data.correlation_data IS
'Activity correlation data including workflow ID, parent/child relationships, and sequence numbers';

COMMENT ON COLUMN tenant_template.activity_data.business_impact IS
'Business impact assessment including category, scope, confidence, and automation level';

COMMENT ON TABLE tenant_template.activity_workflows IS
'Workflow tracking table for correlating related activities and tracking execution chains';

COMMIT;