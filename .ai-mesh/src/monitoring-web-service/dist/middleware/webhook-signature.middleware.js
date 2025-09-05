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
Object.defineProperty(exports, "__esModule", { value: true });
exports.captureRawBody = captureRawBody;
exports.createWebhookSignatureMiddleware = createWebhookSignatureMiddleware;
exports.createClaudeCodeWebhookMiddleware = createClaudeCodeWebhookMiddleware;
exports.createAgentEventWebhookMiddleware = createAgentEventWebhookMiddleware;
exports.webhookSignatureMiddleware = webhookSignatureMiddleware;
const crypto = __importStar(require("crypto"));
function captureRawBody(req, res, next) {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
        data += chunk;
    });
    req.on('end', () => {
        req.rawBody = Buffer.from(data, 'utf8');
        try {
            req.body = JSON.parse(data);
        }
        catch (error) {
            req.body = {};
        }
        next();
    });
}
function createWebhookSignatureMiddleware(db, logger, options = {}) {
    const { required = true, allowedSources = ['claude-code', 'fortium-metrics-server', 'test'], secretHeader = 'X-Fortium-Secret', signatureHeader = 'X-Fortium-Signature', timestampHeader = 'X-Fortium-Timestamp', timestampTolerance = 300000 } = options;
    return async function webhookSignatureMiddleware(req, res, next) {
        try {
            const signature = req.headers[signatureHeader.toLowerCase()];
            const timestamp = req.headers[timestampHeader.toLowerCase()];
            const source = req.body?.source || req.headers['user-agent'] || 'unknown';
            if (process.env.NODE_ENV === 'test' && !required) {
                req.webhookSource = source;
                return next();
            }
            if (!allowedSources.includes(source)) {
                logger.warn(`Webhook from unauthorized source: ${source}`, {
                    ip: req.ip,
                    user_agent: req.headers['user-agent']
                });
                return res.status(403).json({
                    error: 'Unauthorized webhook source',
                    message: 'Webhook source not in allowed list'
                });
            }
            if (timestamp) {
                const timestampMs = parseInt(timestamp);
                const now = Date.now();
                if (isNaN(timestampMs) || Math.abs(now - timestampMs) > timestampTolerance) {
                    logger.warn('Webhook timestamp validation failed', {
                        timestamp: timestampMs,
                        now,
                        difference: Math.abs(now - timestampMs),
                        tolerance: timestampTolerance
                    });
                    return res.status(400).json({
                        error: 'Invalid timestamp',
                        message: 'Webhook timestamp is missing or outside tolerance window'
                    });
                }
            }
            if (signature) {
                const isValid = await validateWebhookSignature(req, signature, db, logger);
                if (!isValid) {
                    logger.warn('Webhook signature validation failed', {
                        source,
                        ip: req.ip,
                        signature_provided: !!signature
                    });
                    return res.status(403).json({
                        error: 'Invalid signature',
                        message: 'Webhook signature validation failed'
                    });
                }
            }
            else if (required) {
                logger.warn('Webhook signature missing when required', {
                    source,
                    ip: req.ip
                });
                return res.status(400).json({
                    error: 'Missing signature',
                    message: 'Webhook signature is required',
                    headers_required: [signatureHeader, timestampHeader]
                });
            }
            req.webhookSource = source;
            next();
        }
        catch (error) {
            logger.error('Webhook signature middleware error:', error);
            res.status(500).json({
                error: 'Signature validation error',
                message: 'Failed to validate webhook signature'
            });
        }
    };
}
async function validateWebhookSignature(req, providedSignature, db, logger) {
    const source = req.webhookSource || req.body?.source;
    if (!req.rawBody) {
        logger.error('Raw body not available for signature validation');
        return false;
    }
    try {
        const secrets = await getWebhookSecrets(source, db);
        if (secrets.length === 0) {
            logger.warn(`No secrets configured for webhook source: ${source}`);
            return false;
        }
        for (const secret of secrets) {
            const expectedSignature = generateSignature(req.rawBody, secret);
            if (secureCompare(providedSignature, expectedSignature)) {
                logger.debug(`Webhook signature validated for source: ${source}`);
                req.webhookSecret = secret;
                return true;
            }
        }
        logger.warn(`Webhook signature validation failed for source: ${source}`);
        return false;
    }
    catch (error) {
        logger.error('Error validating webhook signature:', error);
        return false;
    }
}
async function getWebhookSecrets(source, db) {
    try {
        const query = `
      SELECT secret FROM webhook_secrets 
      WHERE source = $1 AND active = true 
      ORDER BY created_at DESC
    `;
        const result = await db.query(query, [source]);
        if (result.rows.length > 0) {
            return result.rows.map(row => row.secret);
        }
        const envSecret = process.env[`WEBHOOK_SECRET_${source.toUpperCase().replace('-', '_')}`];
        if (envSecret) {
            return [envSecret];
        }
        if (process.env.NODE_ENV !== 'production') {
            const defaultSecrets = {
                'claude-code': process.env.CLAUDE_CODE_WEBHOOK_SECRET || 'claude-code-dev-secret',
                'fortium-metrics-server': process.env.FORTIUM_WEBHOOK_SECRET || 'fortium-metrics-dev-secret',
                'test': 'test-webhook-secret'
            };
            return [defaultSecrets[source]].filter(Boolean);
        }
        return [];
    }
    catch (error) {
        throw new Error(`Failed to retrieve webhook secrets: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}
function generateSignature(payload, secret) {
    return crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');
}
function secureCompare(provided, expected) {
    if (provided.length !== expected.length) {
        return false;
    }
    const cleanProvided = provided.replace(/^sha256=/, '');
    const cleanExpected = expected.replace(/^sha256=/, '');
    return crypto.timingSafeEqual(Buffer.from(cleanProvided, 'hex'), Buffer.from(cleanExpected, 'hex'));
}
function createClaudeCodeWebhookMiddleware(db, logger) {
    return createWebhookSignatureMiddleware(db, logger, {
        required: process.env.NODE_ENV === 'production',
        allowedSources: ['claude-code', 'test'],
        secretHeader: 'X-Claude-Signature',
        timestampHeader: 'X-Claude-Timestamp'
    });
}
function createAgentEventWebhookMiddleware(db, logger) {
    return createWebhookSignatureMiddleware(db, logger, {
        required: false,
        allowedSources: ['claude-code', 'ai-mesh-orchestrator', 'fortium-agent', 'test'],
        timestampTolerance: 600000
    });
}
function webhookSignatureMiddleware(req, res, next) {
    const signature = req.headers['x-fortium-signature'];
    const source = req.body?.source || 'unknown';
    req.webhookSource = source;
    if (process.env.NODE_ENV === 'test' || !signature) {
        return next();
    }
    next();
}
//# sourceMappingURL=webhook-signature.middleware.js.map