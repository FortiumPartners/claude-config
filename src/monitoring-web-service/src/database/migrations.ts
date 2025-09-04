import { DatabaseConnection } from './connection';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import winston from 'winston';

export interface Migration {
  version: string;
  name: string;
  up: string;
  down: string;
  timestamp: Date;
}

export interface MigrationRecord {
  version: string;
  name: string;
  applied_at: Date;
  rollback_sql?: string;
}

export class MigrationManager {
  private logger: winston.Logger;
  private migrationsPath: string;

  constructor(
    private db: DatabaseConnection,
    migrationsPath = join(__dirname, '../migrations'),
  ) {
    this.migrationsPath = migrationsPath;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console(),
      ],
    });
  }

  async initializeMigrationsTable(): Promise<void> {
    this.logger.info('Initializing migrations table');

    await this.db.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        rollback_sql TEXT
      );
    `);

    // Create index for performance
    await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_schema_migrations_applied_at 
      ON schema_migrations (applied_at DESC);
    `);

    this.logger.info('Migrations table initialized');
  }

  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.db.query<{
      version: string;
      name: string;
      applied_at: string;
      rollback_sql: string | null;
    }>(`
      SELECT version, name, applied_at, rollback_sql
      FROM schema_migrations
      ORDER BY version ASC;
    `);

    return result.rows.map(row => ({
      version: row.version,
      name: row.name,
      applied_at: new Date(row.applied_at),
      rollback_sql: row.rollback_sql || undefined,
    }));
  }

  async getAvailableMigrations(): Promise<Migration[]> {
    if (!existsSync(this.migrationsPath)) {
      this.logger.warn('Migrations directory does not exist', { path: this.migrationsPath });
      return [];
    }

    const files = readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of files) {
      const filePath = join(this.migrationsPath, file);
      const content = readFileSync(filePath, 'utf-8');
      
      // Parse migration file format: version_name.sql
      const match = file.match(/^(\d{14})_(.+)\.sql$/);
      if (!match) {
        this.logger.warn('Skipping invalid migration file', { file });
        continue;
      }

      const [, version, name] = match;
      const sections = this.parseMigrationContent(content);

      migrations.push({
        version,
        name: name.replace(/-/g, ' '),
        up: sections.up,
        down: sections.down,
        timestamp: this.parseTimestamp(version),
      });
    }

    return migrations;
  }

  private parseMigrationContent(content: string): { up: string; down: string } {
    const sections = { up: '', down: '' };
    
    // Split by -- migrate:up and -- migrate:down comments
    const upMatch = content.match(/-- migrate:up\s*\n([\s\S]*?)(?=-- migrate:down|\s*$)/);
    const downMatch = content.match(/-- migrate:down\s*\n([\s\S]*?)$/);

    if (upMatch) {
      sections.up = upMatch[1].trim();
    }

    if (downMatch) {
      sections.down = downMatch[1].trim();
    }

    // If no sections found, treat entire content as up migration
    if (!sections.up && !sections.down) {
      sections.up = content.trim();
      sections.down = '-- No rollback SQL provided';
    }

    return sections;
  }

  private parseTimestamp(version: string): Date {
    // Format: YYYYMMDDHHMMSS
    const year = parseInt(version.substr(0, 4));
    const month = parseInt(version.substr(4, 2)) - 1; // Month is 0-based
    const day = parseInt(version.substr(6, 2));
    const hour = parseInt(version.substr(8, 2));
    const minute = parseInt(version.substr(10, 2));
    const second = parseInt(version.substr(12, 2));

    return new Date(year, month, day, hour, minute, second);
  }

  async getPendingMigrations(): Promise<Migration[]> {
    const [available, applied] = await Promise.all([
      this.getAvailableMigrations(),
      this.getAppliedMigrations(),
    ]);

    const appliedVersions = new Set(applied.map(m => m.version));
    return available.filter(migration => !appliedVersions.has(migration.version));
  }

  async migrate(targetVersion?: string): Promise<{ applied: Migration[]; skipped: Migration[] }> {
    await this.initializeMigrationsTable();
    
    const pending = await this.getPendingMigrations();
    
    if (pending.length === 0) {
      this.logger.info('No pending migrations');
      return { applied: [], skipped: [] };
    }

    let migrationsToApply = pending;
    if (targetVersion) {
      migrationsToApply = pending.filter(m => m.version <= targetVersion);
    }

    const applied: Migration[] = [];
    const skipped: Migration[] = [];

    for (const migration of migrationsToApply) {
      try {
        this.logger.info('Applying migration', {
          version: migration.version,
          name: migration.name,
        });

        await this.db.withTransaction(async () => {
          // Execute the migration
          await this.db.query(migration.up);

          // Record the migration
          await this.db.query(`
            INSERT INTO schema_migrations (version, name, rollback_sql)
            VALUES ($1, $2, $3);
          `, [migration.version, migration.name, migration.down]);
        });

        applied.push(migration);
        
        this.logger.info('Migration applied successfully', {
          version: migration.version,
          name: migration.name,
        });
      } catch (error) {
        this.logger.error('Migration failed', {
          version: migration.version,
          name: migration.name,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    // Migrations that were pending but not in target range
    if (targetVersion) {
      skipped.push(...pending.filter(m => m.version > targetVersion));
    }

    return { applied, skipped };
  }

  async rollback(targetVersion?: string): Promise<{ rolledBack: Migration[]; skipped: Migration[] }> {
    const applied = await this.getAppliedMigrations();
    
    if (applied.length === 0) {
      this.logger.info('No migrations to rollback');
      return { rolledBack: [], skipped: [] };
    }

    // Determine migrations to rollback (in reverse order)
    let migrationsToRollback = [...applied].reverse();
    
    if (targetVersion) {
      // Rollback to specific version (inclusive)
      migrationsToRollback = migrationsToRollback.filter(m => m.version > targetVersion);
    } else {
      // Rollback only the last migration
      migrationsToRollback = migrationsToRollback.slice(0, 1);
    }

    const rolledBack: Migration[] = [];
    const skipped: Migration[] = [];

    for (const migration of migrationsToRollback) {
      try {
        if (!migration.rollback_sql || migration.rollback_sql.trim() === '-- No rollback SQL provided') {
          this.logger.warn('No rollback SQL available for migration', {
            version: migration.version,
            name: migration.name,
          });
          skipped.push({
            version: migration.version,
            name: migration.name,
            up: '',
            down: migration.rollback_sql || '',
            timestamp: migration.applied_at,
          });
          continue;
        }

        this.logger.info('Rolling back migration', {
          version: migration.version,
          name: migration.name,
        });

        await this.db.withTransaction(async () => {
          // Execute the rollback
          await this.db.query(migration.rollback_sql!);

          // Remove the migration record
          await this.db.query(`
            DELETE FROM schema_migrations
            WHERE version = $1;
          `, [migration.version]);
        });

        rolledBack.push({
          version: migration.version,
          name: migration.name,
          up: '',
          down: migration.rollback_sql,
          timestamp: migration.applied_at,
        });
        
        this.logger.info('Migration rolled back successfully', {
          version: migration.version,
          name: migration.name,
        });
      } catch (error) {
        this.logger.error('Migration rollback failed', {
          version: migration.version,
          name: migration.name,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    return { rolledBack, skipped };
  }

  async getStatus(): Promise<{
    applied: MigrationRecord[];
    pending: Migration[];
    total: number;
  }> {
    const [applied, pending] = await Promise.all([
      this.getAppliedMigrations(),
      this.getPendingMigrations(),
    ]);

    return {
      applied,
      pending,
      total: applied.length + pending.length,
    };
  }

  async validateMigrations(): Promise<{
    isValid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      const [available, applied] = await Promise.all([
        this.getAvailableMigrations(),
        this.getAppliedMigrations(),
      ]);

      // Check for missing migration files
      for (const appliedMigration of applied) {
        const fileExists = available.some(m => m.version === appliedMigration.version);
        if (!fileExists) {
          issues.push(`Applied migration ${appliedMigration.version} has no corresponding file`);
        }
      }

      // Check for duplicate versions
      const versions = available.map(m => m.version);
      const duplicates = versions.filter((v, i) => versions.indexOf(v) !== i);
      if (duplicates.length > 0) {
        issues.push(`Duplicate migration versions found: ${duplicates.join(', ')}`);
      }

      // Check migration order
      const sortedVersions = [...versions].sort();
      if (JSON.stringify(versions) !== JSON.stringify(sortedVersions)) {
        issues.push('Migration files are not in chronological order');
      }

    } catch (error) {
      issues.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}