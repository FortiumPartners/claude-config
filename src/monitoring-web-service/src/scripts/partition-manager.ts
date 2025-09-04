#!/usr/bin/env node
import { database } from '../database';
import { timescaleConfig } from '../database/config';

interface CommandOptions {
  table?: string;
  days?: number;
  verbose?: boolean;
}

async function showStats(options: CommandOptions): Promise<void> {
  const { table, verbose } = options;
  
  console.log('📊 Partition Statistics');
  console.log('========================\n');
  
  const stats = await database.partitionManager.getPartitionStats(table);
  
  for (const stat of stats) {
    console.log(`Table: ${stat.tableName}`);
    console.log(`  Total Chunks: ${stat.totalChunks}`);
    console.log(`  Compressed: ${stat.compressedChunks}`);
    console.log(`  Uncompressed: ${stat.uncompressedChunks}`);
    console.log(`  Total Size: ${stat.totalSize}`);
    console.log(`  Date Range: ${stat.oldestChunk.toISOString()} → ${stat.newestChunk.toISOString()}\n`);
    
    if (verbose) {
      const partitions = await database.partitionManager.getPartitionInfo(stat.tableName);
      console.log('  Recent Partitions:');
      partitions.slice(0, 5).forEach(p => {
        console.log(`    ${p.chunkName}: ${p.rangeStart.toISOString()} → ${p.rangeEnd.toISOString()} (${p.size}${p.isCompressed ? ' compressed' : ''})`);
      });
      console.log();
    }
  }
}

async function compress(options: CommandOptions): Promise<void> {
  const { table, days } = options;
  
  console.log('🗜️  Compressing Old Partitions');
  console.log('==============================\n');
  
  const compressionAge = days ?? timescaleConfig.compressionAfterDays;
  console.log(`Compressing partitions older than ${compressionAge} days${table ? ` for table: ${table}` : ' (all tables)'}\n`);
  
  const compressedCount = await database.partitionManager.compressOldPartitions(table, compressionAge);
  
  console.log(`✅ Compressed ${compressedCount} partition(s)\n`);
}

async function cleanup(options: CommandOptions): Promise<void> {
  const { table, days } = options;
  
  console.log('🗑️  Cleaning Up Old Partitions');
  console.log('===============================\n');
  
  const retentionDays = days ?? timescaleConfig.retentionDays;
  console.log(`Dropping partitions older than ${retentionDays} days${table ? ` for table: ${table}` : ' (all tables)'}\n`);
  
  const droppedCount = await database.partitionManager.dropOldPartitions(table, retentionDays);
  
  console.log(`✅ Dropped ${droppedCount} partition(s)\n`);
}

async function preCreate(options: CommandOptions): Promise<void> {
  const { days } = options;
  
  console.log('🔮 Pre-creating Future Partitions');
  console.log('==================================\n');
  
  const preCreateDays = days ?? 7;
  console.log(`Pre-creating partitions for the next ${preCreateDays} days\n`);
  
  await database.partitionManager.preCreatePartitions(preCreateDays);
  
  console.log(`✅ Pre-created partitions for ${preCreateDays} days\n`);
}

async function maintenance(_options: CommandOptions): Promise<void> {
  console.log('🔧 Running Full Maintenance Job');
  console.log('================================\n');
  
  const result = await database.partitionManager.runMaintenanceJob();
  
  console.log('✅ Maintenance completed:');
  console.log(`   Compressed: ${result.compressedChunks} chunk(s)`);
  console.log(`   Dropped: ${result.droppedChunks} chunk(s)`);
  console.log(`   Pre-created: ${result.preCreatedDays} days of partitions\n`);
}

async function healthCheck(): Promise<void> {
  console.log('🏥 Partition Health Check');
  console.log('=========================\n');
  
  const health = await database.partitionManager.validatePartitionHealth();
  
  console.log(`Status: ${health.isHealthy ? '✅ Healthy' : '⚠️  Issues Found'}\n`);
  
  if (health.issues.length > 0) {
    console.log('Issues:');
    health.issues.forEach(issue => console.log(`  ⚠️  ${issue}`));
    console.log();
  }
  
  console.log('Table Statistics:');
  health.stats.forEach(stat => {
    console.log(`  ${stat.tableName}: ${stat.totalChunks} chunks, ${stat.totalSize}`);
  });
  console.log();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const options: CommandOptions = {};
  
  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--table' && i + 1 < args.length) {
      options.table = args[++i];
    } else if (arg === '--days' && i + 1 < args.length) {
      options.days = parseInt(args[++i], 10);
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    }
  }
  
  try {
    switch (command) {
      case 'stats':
        await showStats(options);
        break;
        
      case 'compress':
        await compress(options);
        break;
        
      case 'cleanup':
        await cleanup(options);
        break;
        
      case 'pre-create':
        await preCreate(options);
        break;
        
      case 'maintenance':
        await maintenance(options);
        break;
        
      case 'health':
        await healthCheck();
        break;
        
      default:
        console.log('📦 Partition Manager CLI');
        console.log('========================\n');
        console.log('Usage: npm run partition:manager <command> [options]\n');
        console.log('Commands:');
        console.log('  stats         Show partition statistics');
        console.log('  compress      Compress old partitions');
        console.log('  cleanup       Drop old partitions (retention cleanup)');
        console.log('  pre-create    Pre-create future partitions');
        console.log('  maintenance   Run full maintenance job (compress + cleanup + pre-create)');
        console.log('  health        Check partition health status\n');
        console.log('Options:');
        console.log('  --table <name>    Target specific table (default: all tables)');
        console.log('  --days <num>      Number of days for age thresholds');
        console.log('  --verbose, -v     Show detailed output\n');
        console.log('Examples:');
        console.log('  npm run partition:manager stats --verbose');
        console.log('  npm run partition:manager compress --table command_executions --days 7');
        console.log('  npm run partition:manager maintenance');
        console.log('  npm run partition:manager health\n');
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