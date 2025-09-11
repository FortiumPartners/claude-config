"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMigrationRoutes = createMigrationRoutes;
const express_1 = require("express");
const migration_service_1 = require("../services/migration.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const multer_1 = __importDefault(require("multer"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const upload = (0, multer_1.default)({
    dest: 'temp/uploads/',
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 10
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.json', '.yml', '.yaml', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only JSON, YAML, and CSV files are allowed'));
        }
    }
});
function createMigrationRoutes(db, logger) {
    const router = (0, express_1.Router)();
    const migrationService = new migration_service_1.MigrationService(db, logger);
    const migrationRateLimit = (0, express_rate_limit_1.default)({
        windowMs: 15 * 60 * 1000,
        max: 10,
        message: {
            error: 'Too many migration attempts',
            retry_after: 15 * 60
        },
        standardHeaders: true,
        legacyHeaders: false
    });
    router.get('/validate', auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const validation = await migrationService.validateMigrationPrerequisites(req.user.organization_id);
            res.json({
                valid: validation.valid,
                issues: validation.issues,
                suggestions: validation.suggestions,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Migration validation error:', error);
            res.status(500).json({
                error: 'Failed to validate migration prerequisites',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/start', migrationRateLimit, auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const { local_config_path, legacy_format, preserve_local = true, dry_run = false, batch_size = 100 } = req.body;
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
                organization_id: req.user.organization_id,
                user_id: req.user.id,
                options: migrationOptions
            });
            const result = await migrationService.migrateLocalMetrics(req.user.organization_id, req.user.id, migrationOptions);
            logger.info('Migration completed', {
                organization_id: req.user.organization_id,
                result: {
                    success: result.success,
                    metrics_migrated: result.metrics_migrated,
                    config_migrated: result.config_migrated,
                    errors_count: result.errors.length,
                    warnings_count: result.warnings.length
                }
            });
            res.json({
                migration_id: crypto_1.default.randomUUID(),
                success: result.success,
                metrics_migrated: result.metrics_migrated,
                config_migrated: result.config_migrated,
                backup_location: result.backup_location,
                errors: result.errors,
                warnings: result.warnings,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Migration execution error:', error);
            res.status(500).json({
                error: 'Migration failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/upload', migrationRateLimit, auth_middleware_1.authMiddleware, upload.array('metrics_files', 10), async (req, res) => {
        try {
            const files = req.files;
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
                errors: [],
                warnings: []
            };
            for (const file of files) {
                try {
                    const content = fs.readFileSync(file.path, 'utf8');
                    let data;
                    const ext = path.extname(file.originalname).toLowerCase();
                    if (ext === '.json') {
                        data = JSON.parse(content);
                    }
                    else if (['.yml', '.yaml'].includes(ext)) {
                        const yaml = require('js-yaml');
                        data = yaml.load(content);
                    }
                    else if (ext === '.csv') {
                        const lines = content.split('\n');
                        const headers = lines[0].split(',');
                        data = lines.slice(1).map(line => {
                            const values = line.split(',');
                            const obj = {};
                            headers.forEach((header, index) => {
                                obj[header.trim()] = values[index]?.trim();
                            });
                            return obj;
                        });
                    }
                    const migrationResult = await migrationService.migrateLocalMetrics(req.user.organization_id, req.user.id, { legacy_format: data });
                    results.processed_files++;
                    results.total_metrics += migrationResult.metrics_migrated;
                    if (migrationResult.success) {
                        results.successful_migrations++;
                    }
                    results.errors.push(...migrationResult.errors);
                    results.warnings.push(...migrationResult.warnings);
                    fs.unlinkSync(file.path);
                }
                catch (error) {
                    results.errors.push(`Failed to process file ${file.originalname}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                    }
                }
            }
            res.json({
                upload_id: crypto_1.default.randomUUID(),
                results,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            const files = req.files;
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
    });
    router.get('/discover', auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const { base_path } = req.query;
            if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_SERVER_DISCOVERY) {
                return res.status(403).json({
                    error: 'Server-side discovery not allowed in production'
                });
            }
            const basePaths = base_path
                ? [base_path]
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
                        const files = fs.readdirSync(basePath, { recursive: true })
                            .filter(file => {
                            const fileName = file.toString().toLowerCase();
                            return fileName.includes('metric') ||
                                fileName.includes('dashboard') ||
                                fileName.includes('command') ||
                                fileName.endsWith('.json');
                        })
                            .slice(0, 50);
                        discoveries.push({
                            base_path: basePath,
                            exists: true,
                            files: files.map(file => ({
                                path: path.join(basePath, file.toString()),
                                name: path.basename(file.toString()),
                                size: fs.statSync(path.join(basePath, file.toString())).size
                            }))
                        });
                    }
                    else {
                        discoveries.push({
                            base_path: basePath,
                            exists: false,
                            files: []
                        });
                    }
                }
                catch (error) {
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
        }
        catch (error) {
            logger.error('Discovery error:', error);
            res.status(500).json({
                error: 'Failed to discover local files',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.post('/legacy-format', migrationRateLimit, auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const { format_type, data } = req.body;
            if (!format_type || !data) {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: 'format_type and data are required'
                });
            }
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
                    processedData = data;
            }
            const result = await migrationService.migrateLocalMetrics(req.user.organization_id, req.user.id, { legacy_format: processedData });
            res.json({
                format_type,
                migration_result: result,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            logger.error('Legacy format migration error:', error);
            res.status(500).json({
                error: 'Legacy format migration failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    router.get('/history', auth_middleware_1.authMiddleware, async (req, res) => {
        try {
            const { limit = 50, offset = 0 } = req.query;
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
                db.query(query, [req.user.organization_id, limit, offset]),
                db.query(countQuery, [req.user.organization_id])
            ]);
            res.json({
                history: historyResult.rows,
                total: parseInt(countResult.rows[0].total),
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        }
        catch (error) {
            logger.error('Migration history error:', error);
            res.status(500).json({
                error: 'Failed to retrieve migration history',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    const convertClaudeV1Format = (data) => {
        if (data.commands && Array.isArray(data.commands)) {
            return data.commands.map((cmd) => ({
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
    const convertAgentOSV1Format = (data) => {
        if (data.metrics && Array.isArray(data.metrics)) {
            return data.metrics.map((metric) => ({
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
    const convertDashboardMetricsFormat = (data) => {
        if (data.productivity_data) {
            return Object.entries(data.productivity_data).map(([key, value]) => ({
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
//# sourceMappingURL=migration.routes.js.map