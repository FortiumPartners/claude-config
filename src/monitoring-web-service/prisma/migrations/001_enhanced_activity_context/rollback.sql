-- Rollback Migration 001: Enhanced Activity Context
-- This script safely removes the enhanced activity context extensions
-- Use this script if you need to rollback the enhanced activity features

BEGIN;

-- Drop indexes first
DROP INDEX IF EXISTS tenant_template.idx_activity_enhanced_search;
DROP INDEX IF EXISTS tenant_template.idx_activity_performance;
DROP INDEX IF EXISTS tenant_template.idx_activity_correlation;
DROP INDEX IF EXISTS tenant_template.idx_activity_error_category;
DROP INDEX IF EXISTS tenant_template.idx_activity_business_impact;
DROP INDEX IF EXISTS tenant_template.idx_activity_workflow_id;
DROP INDEX IF EXISTS tenant_template.idx_workflows_status;
DROP INDEX IF EXISTS tenant_template.idx_workflows_root_activity;
DROP INDEX IF EXISTS tenant_template.idx_workflows_workflow_id;
DROP INDEX IF EXISTS tenant_template.idx_workflows_created_at;
DROP INDEX IF EXISTS tenant_template.idx_workflows_status_created;
DROP INDEX IF EXISTS tenant_template.idx_activity_timestamp_status;
DROP INDEX IF EXISTS tenant_template.idx_activity_user_timestamp;
DROP INDEX IF EXISTS tenant_template.idx_activity_automated_timestamp;

-- Drop the workflow table
DROP TABLE IF EXISTS tenant_template.activity_workflows;

-- Remove enhanced context columns from activity_data
ALTER TABLE tenant_template.activity_data
DROP COLUMN IF EXISTS enhanced_context,
DROP COLUMN IF EXISTS performance_metrics,
DROP COLUMN IF EXISTS input_data,
DROP COLUMN IF EXISTS output_data,
DROP COLUMN IF EXISTS error_details,
DROP COLUMN IF EXISTS correlation_data,
DROP COLUMN IF EXISTS business_impact;

COMMIT;