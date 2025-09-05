/**
 * Migration Routes
 * Task 4.4: Web API endpoints for migration management and monitoring
 * 
 * Provides REST endpoints for managing data migration from local to web service
 */

import { Router, Request, Response } from 'express';
import { MigrationService } from '../services/migration.service';
import { DatabaseConnection } from '../database/connection';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';
import * as winston from 'winston';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

export interface MigrationRoutes {
  router: Router;
}

// Configure multer for file uploads
const upload = multer({
  dest: 'temp/uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    // Allow JSON and YAML files
    const allowedTypes = ['.json', '.yml', '.yaml', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only JSON, YAML, and CSV files are allowed'));
    }
  }
});

export function createMigrationRoutes(
  db: DatabaseConnection,
  logger: winston.Logger
): MigrationRoutes {
  const router = Router();
  const migrationService = new MigrationService(db, logger);

  // Rate limiting for migration endpoints
  const migrationRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 migration attempts per 15 minutes
    message: {
      error: 'Too many migration attempts',
      retry_after: 15 * 60
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  /**
   * GET /api/migration/validate
   * Validate migration prerequisites for organization
   */
  router.get('/validate',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const validation = await migrationService.validateMigrationPrerequisites(
          req.user!.organization_id
        );

        res.json({
          valid: validation.valid,
          issues: validation.issues,
          suggestions: validation.suggestions,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Migration validation error:', error);
        res.status(500).json({
          error: 'Failed to validate migration prerequisites',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/migration/start
   * Start migration process with options
   */
  router.post('/start',
    migrationRateLimit,
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const {
          local_config_path,
          legacy_format,
          preserve_local = true,
          dry_run = false,
          batch_size = 100
        } = req.body;

        // Validate request
        if (!local_config_path && !legacy_format) {
          return res.status(400).json({
            error: 'Invalid migration request',
            message: 'Either local_config_path or legacy_format must be provided'
          });
        }

        const migrationOptions = {
          local_config_path,
          legacy_format,
          preserve_local,
          dry_run,
          batch_size
        };

        logger.info('Starting migration', {
          organization_id: req.user!.organization_id,
          user_id: req.user!.id,
          options: migrationOptions
        });

        const result = await migrationService.migrateLocalMetrics(
          req.user!.organization_id,
          req.user!.id,
          migrationOptions
        );

        // Log migration result
        logger.info('Migration completed', {
          organization_id: req.user!.organization_id,
          result: {
            success: result.success,
            metrics_migrated: result.metrics_migrated,
            config_migrated: result.config_migrated,
            errors_count: result.errors.length,
            warnings_count: result.warnings.length
          }
        });

        res.json({
          migration_id: crypto.randomUUID(),
          success: result.success,
          metrics_migrated: result.metrics_migrated,
          config_migrated: result.config_migrated,
          backup_location: result.backup_location,
          errors: result.errors,
          warnings: result.warnings,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Migration execution error:', error);
        res.status(500).json({
          error: 'Migration failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/migration/upload
   * Upload local metrics files for migration
   */
  router.post('/upload',
    migrationRateLimit,
    authMiddleware,
    upload.array('metrics_files', 10),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        
        if (!files || files.length === 0) {
          return res.status(400).json({
            error: 'No files uploaded',
            message: 'At least one metrics file is required'
          });
        }

        const results = {
          total_files: files.length,
          processed_files: 0,
          total_metrics: 0,
          successful_migrations: 0,
          errors: [] as string[],
          warnings: [] as string[]
        };

        // Process each uploaded file
        for (const file of files) {
          try {
            const content = fs.readFileSync(file.path, 'utf8');
            let data: any;

            // Parse based on file extension
            const ext = path.extname(file.originalname).toLowerCase();
            if (ext === '.json') {
              data = JSON.parse(content);
            } else if (['.yml', '.yaml'].includes(ext)) {
              const yaml = require('js-yaml');
              data = yaml.load(content);
            } else if (ext === '.csv') {
              // Simple CSV parsing - in production, use a proper CSV parser
              const lines = content.split('\n');
              const headers = lines[0].split(',');
              data = lines.slice(1).map(line => {
                const values = line.split(',');
                const obj: any = {};
                headers.forEach((header, index) => {
                  obj[header.trim()] = values[index]?.trim();
                });
                return obj;
              });
            }

            // Migrate the data
            const migrationResult = await migrationService.migrateLocalMetrics(
              req.user!.organization_id,
              req.user!.id,
              { legacy_format: data }
            );

            results.processed_files++;
            results.total_metrics += migrationResult.metrics_migrated;
            if (migrationResult.success) {
              results.successful_migrations++;
            }

            results.errors.push(...migrationResult.errors);
            results.warnings.push(...migrationResult.warnings);

            // Clean up temporary file
            fs.unlinkSync(file.path);

          } catch (error) {
            results.errors.push(`Failed to process file ${file.originalname}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            
            // Clean up temporary file
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          }
        }

        res.json({
          upload_id: crypto.randomUUID(),
          results,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        // Clean up any remaining temporary files
        const files = req.files as Express.Multer.File[];
        if (files) {
          files.forEach(file => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });
        }

        logger.error('File upload migration error:', error);
        res.status(500).json({
          error: 'File upload migration failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * GET /api/migration/discover
   * Discover local metrics files on server (for development/testing)
   */
  router.get('/discover',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { base_path } = req.query;
        
        // In production, this should be restricted or removed for security
        if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SERVER_DISCOVERY) {
          return res.status(403).json({
            error: 'Server-side discovery not allowed in production'
          });
        }

        const basePaths = base_path 
          ? [base_path as string]
          : [
              path.join(process.env.HOME || '~', '.agent-os'),
              path.join(process.env.HOME || '~', '.claude'),
              path.join(process.cwd(), '.agent-os'),
              path.join(process.cwd(), '.claude')
            ];

        const discoveries = [];

        for (const basePath of basePaths) {
          try {
            if (fs.existsSync(basePath)) {
              // Use a simplified discovery for this API endpoint
              const files = fs.readdirSync(basePath, { recursive: true })
                .filter(file => {
                  const fileName = file.toString().toLowerCase();
                  return fileName.includes('metric') || 
                         fileName.includes('dashboard') || 
                         fileName.includes('command') ||
                         fileName.endsWith('.json');
                })
                .slice(0, 50); // Limit results

              discoveries.push({
                base_path: basePath,
                exists: true,
                files: files.map(file => ({
                  path: path.join(basePath, file.toString()),
                  name: path.basename(file.toString()),
                  size: fs.statSync(path.join(basePath, file.toString())).size
                }))
              });
            } else {
              discoveries.push({
                base_path: basePath,
                exists: false,
                files: []
              });
            }
          } catch (error) {
            discoveries.push({
              base_path: basePath,
              exists: false,
              error: error instanceof Error ? error.message : 'Access denied',
              files: []
            });
          }
        }

        res.json({
          discoveries,
          total_files: discoveries.reduce((sum, d) => sum + d.files.length, 0),
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Discovery error:', error);
        res.status(500).json({
          error: 'Failed to discover local files',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * POST /api/migration/legacy-format
   * Migrate specific legacy format data
   */
  router.post('/legacy-format',
    migrationRateLimit,
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { format_type, data } = req.body;

        if (!format_type || !data) {
          return res.status(400).json({
            error: 'Invalid request',
            message: 'format_type and data are required'
          });
        }

        // Process different legacy formats
        let processedData = data;
        
        switch (format_type) {
          case 'claude_v1':
            processedData = this.convertClaudeV1Format(data);
            break;
          case 'agent_os_v1':
            processedData = this.convertAgentOSV1Format(data);
            break;
          case 'dashboard_metrics':
            processedData = this.convertDashboardMetricsFormat(data);
            break;
          default:
            // Try generic conversion
            processedData = data;
        }

        const result = await migrationService.migrateLocalMetrics(
          req.user!.organization_id,
          req.user!.id,
          { legacy_format: processedData }
        );

        res.json({
          format_type,
          migration_result: result,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        logger.error('Legacy format migration error:', error);
        res.status(500).json({
          error: 'Legacy format migration failed',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * GET /api/migration/history
   * Get migration history for organization
   */
  router.get('/history',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { limit = 50, offset = 0 } = req.query;

        // Query migration history from database
        const query = `
          SELECT 
            id, created_at, migration_type, metrics_count, 
            success, error_message, user_id
          FROM migration_history 
          WHERE organization_id = $1 
          ORDER BY created_at DESC 
          LIMIT $2 OFFSET $3
        `;

        const countQuery = `
          SELECT COUNT(*) as total 
          FROM migration_history 
          WHERE organization_id = $1
        `;

        const [historyResult, countResult] = await Promise.all([
          db.query(query, [req.user!.organization_id, limit, offset]),
          db.query(countQuery, [req.user!.organization_id])
        ]);

        res.json({
          history: historyResult.rows,
          total: parseInt(countResult.rows[0].total),
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        });

      } catch (error) {
        logger.error('Migration history error:', error);
        res.status(500).json({
          error: 'Failed to retrieve migration history',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  );

  /**
   * Helper methods for format conversion
   */
  const convertClaudeV1Format = (data: any) => {
    // Convert Claude v1 format to current format
    if (data.commands && Array.isArray(data.commands)) {
      return data.commands.map((cmd: any) => ({
        timestamp: cmd.timestamp || Date.now(),
        command: cmd.name || cmd.command,
        duration: cmd.duration_ms || cmd.duration || 0,
        success: cmd.success !== false,
        agent: cmd.agent || 'unknown',
        context: cmd.context || {}
      }));
    }
    return [data];
  };

  const convertAgentOSV1Format = (data: any) => {
    // Convert Agent OS v1 format to current format
    if (data.metrics && Array.isArray(data.metrics)) {
      return data.metrics.map((metric: any) => ({
        timestamp: metric.timestamp || Date.now(),
        command: metric.action || metric.command || 'unknown',
        duration: metric.execution_time || metric.duration || 0,
        success: metric.result === 'success' || metric.success !== false,
        agent: metric.agent_id || metric.agent || 'unknown',
        context: {
          ...metric.metadata,
          session_id: metric.session_id
        }
      }));
    }
    return [data];
  };

  const convertDashboardMetricsFormat = (data: any) => {
    // Convert dashboard metrics format to current format
    if (data.productivity_data) {
      return Object.entries(data.productivity_data).map(([key, value]: [string, any]) => ({
        timestamp: value.timestamp || Date.now(),
        command: key,
        duration: value.avg_time || value.duration || 0,
        success: value.success_rate > 0.5,
        agent: value.agent || 'dashboard',
        context: {
          success_rate: value.success_rate,
          total_executions: value.count
        }
      }));
    }
    return [data];
  };

  return { router };
}