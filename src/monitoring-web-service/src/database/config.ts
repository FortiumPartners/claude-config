import { config } from 'dotenv';

config();

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean | object;
  maxConnections: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
  statementTimeout: number;
  queryTimeout: number;
  maxRetries: number;
  retryDelayMs: number;
  enableLogging: boolean;
}

export interface TimescaleConfig {
  compressionEnabled: boolean;
  retentionDays: number;
  chunkTimeInterval: string;
  compressionAfterDays: number;
  continuousAggregates: boolean;
}

export interface SecurityConfig {
  enableRLS: boolean;
  encryptionKey: string;
  sessionTimeout: number;
  maxFailedLogins: number;
  passwordMinLength: number;
  jwtSecret: string;
  jwtExpiresIn: string;
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  return value ? parseInt(value, 10) : defaultValue;
}

function getEnvBoolean(name: string, defaultValue: boolean): boolean {
  const value = process.env[name];
  return value ? value.toLowerCase() === 'true' : defaultValue;
}

export const databaseConfig: DatabaseConfig = {
  host: getEnvVar('DB_HOST', 'localhost'),
  port: getEnvNumber('DB_PORT', 5432),
  database: getEnvVar('DB_NAME', 'monitoring_service'),
  username: getEnvVar('DB_USER', 'postgres'),
  password: getEnvVar('DB_PASSWORD', process.env.NODE_ENV === 'test' ? 'test_password' : undefined),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  maxConnections: getEnvNumber('DB_MAX_CONNECTIONS', 20),
  idleTimeoutMillis: getEnvNumber('DB_IDLE_TIMEOUT_MS', 30000),
  connectionTimeoutMillis: getEnvNumber('DB_CONNECTION_TIMEOUT_MS', 2000),
  statementTimeout: getEnvNumber('DB_STATEMENT_TIMEOUT_MS', 30000),
  queryTimeout: getEnvNumber('DB_QUERY_TIMEOUT_MS', 30000),
  maxRetries: getEnvNumber('DB_MAX_RETRIES', 3),
  retryDelayMs: getEnvNumber('DB_RETRY_DELAY_MS', 1000),
  enableLogging: getEnvBoolean('DB_ENABLE_LOGGING', process.env.NODE_ENV !== 'production'),
};

export const timescaleConfig: TimescaleConfig = {
  compressionEnabled: getEnvBoolean('TIMESCALE_COMPRESSION_ENABLED', true),
  retentionDays: getEnvNumber('TIMESCALE_RETENTION_DAYS', 365),
  chunkTimeInterval: getEnvVar('TIMESCALE_CHUNK_INTERVAL', '1 day'),
  compressionAfterDays: getEnvNumber('TIMESCALE_COMPRESSION_AFTER_DAYS', 7),
  continuousAggregates: getEnvBoolean('TIMESCALE_CONTINUOUS_AGGREGATES', true),
};

export const securityConfig: SecurityConfig = {
  enableRLS: getEnvBoolean('SECURITY_ENABLE_RLS', true),
  encryptionKey: getEnvVar('ENCRYPTION_KEY', process.env.NODE_ENV === 'test' ? 'test-encryption-key-32-chars-long' : undefined),
  sessionTimeout: getEnvNumber('SESSION_TIMEOUT_MINUTES', 480),
  maxFailedLogins: getEnvNumber('MAX_FAILED_LOGINS', 5),
  passwordMinLength: getEnvNumber('PASSWORD_MIN_LENGTH', 12),
  jwtSecret: getEnvVar('JWT_SECRET', process.env.NODE_ENV === 'test' ? 'test-jwt-secret-32-characters-long!' : undefined),
  jwtExpiresIn: getEnvVar('JWT_EXPIRES_IN', '8h'),
};

export const isDevelopment = process.env.NODE_ENV === 'development';
export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';
