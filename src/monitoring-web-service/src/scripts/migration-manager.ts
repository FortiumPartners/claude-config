#!/usr/bin/env node
import { MigrationManager } from '../database/migrations';
import { database } from '../database';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

interface CommandOptions {
  target?: string;
  name?: string;
  verbose?: boolean;
}

async function createMigration(options: CommandOptions): Promise<void> {
  if (!options.name) {
    console.error('❌ Migration name is required');
    console.log('Usage: npm run migrate:create -- --name "add_user_preferences"');
    process.exit(1);
  }

  const migrationsDir = join(__dirname, '../migrations');
  if (!existsSync(migrationsDir)) {
    mkdirSync(migrationsDir, { recursive: true });
    console.log(`📁 Created migrations directory: ${migrationsDir}`);
  }

  // Generate timestamp version (YYYYMMDDHHMMSS)
  const now = new Date();
  const version = [
    now.getFullYear().toString(),
    (now.getMonth() + 1).toString().padStart(2, '0'),
    now.getDate().toString().padStart(2, '0'),
    now.getHours().toString().padStart(2, '0'),
    now.getMinutes().toString().padStart(2, '0'),
    now.getSeconds().toString().padStart(2, '0'),
  ].join('');

  // Sanitize name for filename
  const sanitizedName = options.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const filename = `${version}_${sanitizedName}.sql`;
  const filepath = join(migrationsDir, filename);

  const template = `-- migrate:up
-- Add your migration SQL here
-- Example:
-- CREATE TABLE example_table (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- migrate:down
-- Add your rollback SQL here
-- Example:
-- DROP TABLE IF EXISTS example_table;
`;

  writeFileSync(filepath, template);

  console.log('✅ Migration created successfully!');
  console.log(`📄 File: ${filename}`);
  console.log(`📁 Path: ${filepath}`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Edit the migration file and add your SQL');
  console.log('2. Run: npm run migrate:up');
}

async function showStatus(options: CommandOptions): Promise<void> {
  console.log('📊 Migration Status');
  console.log('==================\\n');

  const migrationManager = new MigrationManager(database.conn);
  const status = await migrationManager.getStatus();

  console.log(`Total migrations: ${status.total}`);
  console.log(`Applied: ${status.applied.length}`);
  console.log(`Pending: ${status.pending.length}\\n`);

  if (status.applied.length > 0) {
    console.log('✅ Applied Migrations:');
    status.applied.forEach(migration => {
      console.log(`  ${migration.version}: ${migration.name} (${migration.applied_at.toISOString()})`);
    });
    console.log();
  }

  if (status.pending.length > 0) {
    console.log('⏳ Pending Migrations:');
    status.pending.forEach(migration => {
      console.log(`  ${migration.version}: ${migration.name}`);
    });
    console.log();
  }

  if (options.verbose) {
    console.log('🔍 Validation:');
    const validation = await migrationManager.validateMigrations();
    if (validation.isValid) {
      console.log('  ✅ All migrations are valid');
    } else {
      console.log('  ⚠️  Validation issues found:');
      validation.issues.forEach(issue => {
        console.log(`    - ${issue}`);
      });
    }
    console.log();
  }
}

async function migrateUp(options: CommandOptions): Promise<void> {
  console.log('🚀 Running Migrations');
  console.log('====================\\n');

  const migrationManager = new MigrationManager(database.conn);

  if (options.target) {
    console.log(`Migrating to version: ${options.target}\\n`);
  } else {
    console.log('Applying all pending migrations\\n');
  }

  const result = await migrationManager.migrate(options.target);

  if (result.applied.length === 0) {
    console.log('✨ No migrations to apply - database is up to date!');
  } else {
    console.log(`✅ Applied ${result.applied.length} migration(s):`);
    result.applied.forEach(migration => {
      console.log(`  ${migration.version}: ${migration.name}`);
    });
  }

  if (result.skipped.length > 0) {
    console.log(`\\n⏭️  Skipped ${result.skipped.length} migration(s) beyond target version:`);
    result.skipped.forEach(migration => {
      console.log(`  ${migration.version}: ${migration.name}`);
    });
  }

  console.log('\\n🎉 Migration completed successfully!');
}

async function migrateDown(options: CommandOptions): Promise<void> {
  console.log('⏪ Rolling Back Migrations');
  console.log('=========================\\n');

  const migrationManager = new MigrationManager(database.conn);

  if (options.target) {
    console.log(`Rolling back to version: ${options.target}\\n`);
  } else {
    console.log('Rolling back last migration\\n');
  }

  const result = await migrationManager.rollback(options.target);

  if (result.rolledBack.length === 0) {
    console.log('✨ No migrations to rollback!');
  } else {
    console.log(`✅ Rolled back ${result.rolledBack.length} migration(s):`);
    result.rolledBack.forEach(migration => {
      console.log(`  ${migration.version}: ${migration.name}`);
    });
  }

  if (result.skipped.length > 0) {
    console.log(`\\n⚠️  Skipped ${result.skipped.length} migration(s) (no rollback SQL):`);
    result.skipped.forEach(migration => {
      console.log(`  ${migration.version}: ${migration.name}`);
    });
  }

  console.log('\\n🎉 Rollback completed successfully!');
}

async function validateMigrations(): Promise<void> {
  console.log('🔍 Validating Migrations');
  console.log('========================\\n');

  const migrationManager = new MigrationManager(database.conn);
  const validation = await migrationManager.validateMigrations();

  if (validation.isValid) {
    console.log('✅ All migrations are valid!');
  } else {
    console.log('❌ Validation failed with issues:');
    validation.issues.forEach(issue => {
      console.log(`  - ${issue}`);
    });
    console.log('\\nPlease fix these issues before proceeding with migrations.');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  const options: CommandOptions = {};

  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--target' && i + 1 < args.length) {
      options.target = args[++i];
    } else if (arg === '--name' && i + 1 < args.length) {
      options.name = args[++i];
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }

  try {
    switch (command) {
      case 'create':
        await createMigration(options);
        break;

      case 'status':
        await showStatus(options);
        break;

      case 'up':
        await migrateUp(options);
        break;

      case 'down':
        await migrateDown(options);
        break;

      case 'validate':
        await validateMigrations();
        break;

      default:
        console.log('📦 Migration Manager CLI');
        console.log('========================\\n');
        console.log('Usage: npm run migrate <command> [options]\\n');
        console.log('Commands:');
        console.log('  create        Create a new migration file');
        console.log('  status        Show migration status');
        console.log('  up            Apply pending migrations');
        console.log('  down          Rollback migrations');
        console.log('  validate      Validate migration consistency\\n');
        console.log('Options:');
        console.log('  --name <name>       Migration name (for create command)');
        console.log('  --target <version>  Target version (for up/down commands)');
        console.log('  --verbose, -v       Show detailed output\\n');
        console.log('Examples:');
        console.log('  npm run migrate create -- --name "add_user_preferences"');
        console.log('  npm run migrate status --verbose');
        console.log('  npm run migrate up');
        console.log('  npm run migrate down --target 20250903120000');
        console.log('  npm run migrate validate\\n');
        process.exit(0);
    }

    console.log('🎉 Operation completed successfully!');
  } catch (error) {
    console.error('❌ Operation failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await database.close();
  }
}

// Handle uncaught errors gracefully
process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  await database.close();
  process.exit(1);
});

process.on('uncaughtException', async (error) => {
  console.error('❌ Uncaught Exception:', error);
  await database.close();
  process.exit(1);
});

if (require.main === module) {
  main();
}