/*
  Warnings:

  - You are about to drop the column `command_line` on the `tool_metrics` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."idx_tenants_active_plan_created";

-- DropIndex
DROP INDEX "tenant_template"."idx_dashboard_configs_user";

-- DropIndex
DROP INDEX "tenant_template"."idx_metrics_sessions_type";

-- DropIndex
DROP INDEX "tenant_template"."idx_metrics_sessions_user_date";

-- DropIndex
DROP INDEX "tenant_template"."idx_tool_metrics_name_date";

-- DropIndex
DROP INDEX "tenant_template"."idx_tool_metrics_session";

-- DropIndex
DROP INDEX "tenant_template"."idx_tool_metrics_success_rate";

-- AlterTable
ALTER TABLE "tenant_template"."tool_metrics" DROP COLUMN "command_line",
ADD COLUMN     "commandLine" TEXT;

-- AlterTable
ALTER TABLE "tenant_template"."users" ADD COLUMN     "password" VARCHAR(255);

-- RenameIndex
ALTER INDEX "tenant_template"."unique_default_dashboard" RENAME TO "dashboard_configs_user_id_is_default_key";
