-- PostgreSQL initialization script for development
-- Task 1.2: Docker containerization

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create development schema
CREATE SCHEMA IF NOT EXISTS dev_metrics;

-- Set default search path
ALTER DATABASE external_metrics_dev SET search_path = dev_metrics, public;

-- Create basic tables for development (will be managed by Prisma in production)
CREATE TABLE IF NOT EXISTS dev_metrics.health_check (
    id SERIAL PRIMARY KEY,
    status VARCHAR(50) NOT NULL DEFAULT 'healthy',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial health check record
INSERT INTO dev_metrics.health_check (status) VALUES ('healthy')
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT ALL PRIVILEGES ON SCHEMA dev_metrics TO metrics_dev;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA dev_metrics TO metrics_dev;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA dev_metrics TO metrics_dev;