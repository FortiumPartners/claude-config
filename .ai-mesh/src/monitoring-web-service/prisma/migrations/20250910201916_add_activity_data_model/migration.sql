-- CreateTable
CREATE TABLE "tenant_template"."activity_data" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "action_name" VARCHAR(100) NOT NULL,
    "action_description" TEXT NOT NULL,
    "target_name" VARCHAR(200) NOT NULL,
    "target_type" VARCHAR(50) NOT NULL DEFAULT 'unknown',
    "status" VARCHAR(20) NOT NULL DEFAULT 'success',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "is_automated" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration" INTEGER,
    "completed_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "project_id" VARCHAR(100),
    "error_message" TEXT,
    "error_code" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_data_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tenant_template"."activity_data" ADD CONSTRAINT "activity_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "tenant_template"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
