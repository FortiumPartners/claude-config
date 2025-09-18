-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "tenant_template";

-- CreateTable
CREATE TABLE "public"."tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "schema_name" VARCHAR(63) NOT NULL,
    "subscription_plan" VARCHAR(50) NOT NULL DEFAULT 'basic',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "admin_email" VARCHAR(255),
    "billing_email" VARCHAR(255),
    "data_region" VARCHAR(50) NOT NULL DEFAULT 'us-east-1',
    "compliance_settings" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'developer',
    "sso_provider" VARCHAR(50),
    "sso_user_id" VARCHAR(255),
    "last_login" TIMESTAMPTZ(6),
    "login_count" INTEGER NOT NULL DEFAULT 0,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."metrics_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "session_start" TIMESTAMPTZ(6) NOT NULL,
    "session_end" TIMESTAMPTZ(6),
    "total_duration_ms" BIGINT,
    "tools_used" JSONB,
    "productivity_score" INTEGER,
    "session_type" VARCHAR(50) NOT NULL DEFAULT 'development',
    "project_id" VARCHAR(100),
    "tags" JSONB NOT NULL DEFAULT '[]',
    "interruptions_count" INTEGER NOT NULL DEFAULT 0,
    "focus_time_ms" BIGINT NOT NULL DEFAULT 0,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."tool_metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "tool_name" VARCHAR(100) NOT NULL,
    "tool_category" VARCHAR(50),
    "execution_count" INTEGER NOT NULL DEFAULT 1,
    "total_duration_ms" BIGINT NOT NULL,
    "average_duration_ms" BIGINT NOT NULL,
    "success_rate" DECIMAL(5,4) NOT NULL,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "memory_usage_mb" INTEGER,
    "cpu_time_ms" BIGINT,
    "parameters" JSONB,
    "output_size_bytes" BIGINT,
    "command_line" TEXT,
    "working_directory" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_template"."dashboard_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "dashboard_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "widget_layout" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "refresh_interval_seconds" INTEGER NOT NULL DEFAULT 30,
    "shared_with_roles" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "public"."tenants"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_schema_name_key" ON "public"."tenants"("schema_name");

-- CreateIndex
CREATE INDEX "idx_tenants_domain" ON "public"."tenants"("domain") WHERE "is_active" = true;

-- CreateIndex
CREATE INDEX "idx_tenants_schema_name" ON "public"."tenants"("schema_name") WHERE "is_active" = true;

-- CreateIndex
CREATE INDEX "idx_tenants_subscription_plan" ON "public"."tenants"("subscription_plan") WHERE "is_active" = true;

-- CreateIndex
CREATE INDEX "idx_tenants_created_at" ON "public"."tenants"("created_at" DESC) WHERE "is_active" = true;

-- CreateIndex
CREATE INDEX "idx_tenants_active_plan_created" ON "public"."tenants"("is_active", "subscription_plan", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "tenant_template"."users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "tenant_template"."users"("email") WHERE "is_active" = true;

-- CreateIndex
CREATE INDEX "idx_users_sso" ON "tenant_template"."users"("sso_provider", "sso_user_id") WHERE "is_active" = true;

-- CreateIndex
CREATE INDEX "idx_users_role" ON "tenant_template"."users"("role") WHERE "is_active" = true;

-- CreateIndex
CREATE INDEX "idx_users_last_login" ON "tenant_template"."users"("last_login" DESC) WHERE "is_active" = true;

-- CreateIndex
CREATE INDEX "idx_metrics_sessions_user_date" ON "tenant_template"."metrics_sessions"("user_id", "session_start" DESC);

-- CreateIndex
CREATE INDEX "idx_metrics_sessions_date_range" ON "tenant_template"."metrics_sessions"("session_start", "session_end") WHERE "session_end" IS NOT NULL;

-- CreateIndex
CREATE INDEX "idx_metrics_sessions_type" ON "tenant_template"."metrics_sessions"("session_type", "session_start" DESC);

-- CreateIndex
CREATE INDEX "idx_metrics_sessions_project" ON "tenant_template"."metrics_sessions"("project_id", "session_start" DESC) WHERE "project_id" IS NOT NULL;

-- CreateIndex
CREATE INDEX "idx_metrics_sessions_productivity" ON "tenant_template"."metrics_sessions"("productivity_score" DESC, "session_start" DESC) WHERE "productivity_score" IS NOT NULL;

-- CreateIndex
CREATE INDEX "idx_tool_metrics_session" ON "tenant_template"."tool_metrics"("session_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_tool_metrics_name_date" ON "tenant_template"."tool_metrics"("tool_name", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_tool_metrics_category_date" ON "tenant_template"."tool_metrics"("tool_category", "created_at" DESC) WHERE "tool_category" IS NOT NULL;

-- CreateIndex
CREATE INDEX "idx_tool_metrics_success_rate" ON "tenant_template"."tool_metrics"("success_rate" DESC, "total_duration_ms" ASC);

-- CreateIndex
CREATE INDEX "idx_dashboard_configs_user" ON "tenant_template"."dashboard_configs"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "idx_dashboard_configs_default" ON "tenant_template"."dashboard_configs"("user_id", "is_default") WHERE "is_default" = true;

-- CreateIndex
CREATE INDEX "idx_dashboard_configs_public" ON "tenant_template"."dashboard_configs"("is_public", "updated_at" DESC) WHERE "is_public" = true;

-- CreateIndex
CREATE UNIQUE INDEX "unique_default_dashboard" ON "tenant_template"."dashboard_configs"("user_id", "is_default");

-- AddForeignKey
ALTER TABLE "tenant_template"."metrics_sessions" ADD CONSTRAINT "metrics_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant_template"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."tool_metrics" ADD CONSTRAINT "tool_metrics_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "tenant_template"."metrics_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_template"."dashboard_configs" ADD CONSTRAINT "dashboard_configs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant_template"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add constraints from original SQL schemas
ALTER TABLE "public"."tenants" ADD CONSTRAINT "chk_domain_format" 
CHECK ("domain" ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND length("domain") >= 2);

ALTER TABLE "public"."tenants" ADD CONSTRAINT "chk_schema_name_format" 
CHECK ("schema_name" ~ '^[a-zA-Z][a-zA-Z0-9_]*$' AND length("schema_name") <= 63);

ALTER TABLE "public"."tenants" ADD CONSTRAINT "chk_subscription_plan_values" 
CHECK ("subscription_plan" IN ('basic', 'professional', 'enterprise', 'custom'));

ALTER TABLE "public"."tenants" ADD CONSTRAINT "chk_admin_email_format" 
CHECK ("admin_email" IS NULL OR "admin_email" ~ '^[^@]+@[^@]+\.[^@]+$');

ALTER TABLE "public"."tenants" ADD CONSTRAINT "chk_billing_email_format" 
CHECK ("billing_email" IS NULL OR "billing_email" ~ '^[^@]+@[^@]+\.[^@]+$');

ALTER TABLE "tenant_template"."users" ADD CONSTRAINT "chk_user_role_values" 
CHECK ("role" IN ('admin', 'manager', 'developer', 'viewer'));

ALTER TABLE "tenant_template"."metrics_sessions" ADD CONSTRAINT "chk_session_timing" 
CHECK ("session_end" IS NULL OR "session_end" >= "session_start");

ALTER TABLE "tenant_template"."metrics_sessions" ADD CONSTRAINT "chk_session_duration" 
CHECK (
    ("session_end" IS NULL OR "total_duration_ms" IS NULL) OR 
    ("total_duration_ms" >= 0 AND "total_duration_ms" <= EXTRACT(EPOCH FROM ("session_end" - "session_start")) * 1000 + 1000)
);

ALTER TABLE "tenant_template"."metrics_sessions" ADD CONSTRAINT "chk_productivity_score" 
CHECK ("productivity_score" IS NULL OR ("productivity_score" >= 0 AND "productivity_score" <= 100));

ALTER TABLE "tenant_template"."tool_metrics" ADD CONSTRAINT "chk_tool_execution_count" 
CHECK ("execution_count" > 0);

ALTER TABLE "tenant_template"."tool_metrics" ADD CONSTRAINT "chk_tool_duration" 
CHECK ("total_duration_ms" >= 0);

ALTER TABLE "tenant_template"."tool_metrics" ADD CONSTRAINT "chk_tool_success_rate" 
CHECK ("success_rate" >= 0 AND "success_rate" <= 1);

ALTER TABLE "tenant_template"."dashboard_configs" ADD CONSTRAINT "chk_refresh_interval" 
CHECK ("refresh_interval_seconds" >= 5 AND "refresh_interval_seconds" <= 3600);

-- Add trigger functions for updated_at
CREATE OR REPLACE FUNCTION update_tenant_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION tenant_template.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER trigger_update_tenant_updated_at
    BEFORE UPDATE ON "public"."tenants"
    FOR EACH ROW
    EXECUTE FUNCTION update_tenant_updated_at();

CREATE TRIGGER trigger_update_users_updated_at
    BEFORE UPDATE ON "tenant_template"."users"
    FOR EACH ROW
    EXECUTE FUNCTION tenant_template.update_updated_at();

CREATE TRIGGER trigger_update_sessions_updated_at
    BEFORE UPDATE ON "tenant_template"."metrics_sessions"
    FOR EACH ROW
    EXECUTE FUNCTION tenant_template.update_updated_at();

CREATE TRIGGER trigger_update_dashboard_configs_updated_at
    BEFORE UPDATE ON "tenant_template"."dashboard_configs"
    FOR EACH ROW
    EXECUTE FUNCTION tenant_template.update_updated_at();

-- Add table comments for documentation
COMMENT ON TABLE "public"."tenants" IS 'Master registry of all tenant organizations in the multi-tenant SaaS platform';
COMMENT ON COLUMN "public"."tenants"."id" IS 'Unique identifier for the tenant organization';
COMMENT ON COLUMN "public"."tenants"."name" IS 'Human-readable organization name for display and billing';
COMMENT ON COLUMN "public"."tenants"."domain" IS 'Unique domain identifier used for tenant resolution';
COMMENT ON COLUMN "public"."tenants"."schema_name" IS 'PostgreSQL schema name containing tenant data';
COMMENT ON COLUMN "public"."tenants"."subscription_plan" IS 'Current subscription tier determining feature access';
COMMENT ON COLUMN "public"."tenants"."metadata" IS 'Flexible JSON storage for tenant-specific configuration';
COMMENT ON COLUMN "public"."tenants"."is_active" IS 'Soft delete flag - inactive tenants retain data but block access';

COMMENT ON TABLE "tenant_template"."users" IS 'User accounts within tenant organization with SSO support';
COMMENT ON COLUMN "tenant_template"."users"."role" IS 'User role determining access permissions: admin, manager, developer, viewer';
COMMENT ON COLUMN "tenant_template"."users"."sso_provider" IS 'External SSO provider integration (google, microsoft, okta, etc.)';
COMMENT ON COLUMN "tenant_template"."users"."preferences" IS 'User-specific UI and behavior preferences stored as JSON';

COMMENT ON TABLE "tenant_template"."metrics_sessions" IS 'Individual work sessions with productivity tracking and analytics';
COMMENT ON COLUMN "tenant_template"."metrics_sessions"."tools_used" IS 'JSON array of tools used during this session';
COMMENT ON COLUMN "tenant_template"."metrics_sessions"."productivity_score" IS 'Calculated productivity score (0-100) based on session metrics';
COMMENT ON COLUMN "tenant_template"."metrics_sessions"."focus_time_ms" IS 'Time spent in focused work state without interruptions';

COMMENT ON TABLE "tenant_template"."tool_metrics" IS 'Detailed tool usage statistics within work sessions';
COMMENT ON COLUMN "tenant_template"."tool_metrics"."success_rate" IS 'Decimal rate (0.0-1.0) of successful tool executions';
COMMENT ON COLUMN "tenant_template"."tool_metrics"."parameters" IS 'JSON storage of tool parameters and configuration used';

COMMENT ON TABLE "tenant_template"."dashboard_configs" IS 'Customizable dashboard layouts and widget configurations';
COMMENT ON COLUMN "tenant_template"."dashboard_configs"."widget_layout" IS 'Complete JSON specification of dashboard layout and widgets';
COMMENT ON COLUMN "tenant_template"."dashboard_configs"."shared_with_roles" IS 'JSON array of user roles that can access this dashboard';