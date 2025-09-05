/**
 * Webhook Signature Middleware
 * Task 4.3: Security middleware for webhook endpoint validation
 * 
 * Validates webhook signatures to ensure requests are from trusted sources
 */

import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { DatabaseConnection } from '../database/connection';
import * as winston from 'winston';

export interface WebhookSignatureRequest extends Request {
  rawBody?: Buffer;
  webhookSource?: string;
  webhookSecret?: string;
}

/**
 * Middleware to capture raw body for signature verification
 */
export function captureRawBody(req: WebhookSignatureRequest, res: Response, next: NextFunction): void {
  let data = '';
  req.setEncoding('utf8');
  
  req.on('data', (chunk) => {
    data += chunk;
  });

  req.on('end', () => {
    req.rawBody = Buffer.from(data, 'utf8');
    try {
      req.body = JSON.parse(data);
    } catch (error) {
      req.body = {};
    }
    next();
  });
}

/**
 * Create webhook signature validation middleware
 */
export function createWebhookSignatureMiddleware(
  db: DatabaseConnection,
  logger: winston.Logger,
  options: {
    required?: boolean;
    allowedSources?: string[];
    secretHeader?: string;
    signatureHeader?: string;
    timestampHeader?: string;
    timestampTolerance?: number;
  } = {}
) {
  const {
    required = true,
    allowedSources = ['claude-code', 'fortium-metrics-server', 'test'],
    secretHeader = 'X-Fortium-Secret',
    signatureHeader = 'X-Fortium-Signature', 
    timestampHeader = 'X-Fortium-Timestamp',
    timestampTolerance = 300000 // 5 minutes in milliseconds
  } = options;

  return async function webhookSignatureMiddleware(
    req: WebhookSignatureRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const signature = req.headers[signatureHeader.toLowerCase()] as string;
      const timestamp = req.headers[timestampHeader.toLowerCase()] as string;
      const source = req.body?.source || req.headers['user-agent'] || 'unknown';

      // Skip validation for test environments if configured
      if (process.env.NODE_ENV === 'test' && !required) {
        req.webhookSource = source;
        return next();
      }

      // Check if source is allowed
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

      // Validate timestamp if provided
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

      // If signature is provided, validate it
      if (signature) {
        const isValid = await validateWebhookSignature(
          req,
          signature,
          db,
          logger
        );

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
      } else if (required) {
        // Signature required but not provided
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

      // Store validated source and secret for use in handlers
      req.webhookSource = source;
      next();

    } catch (error) {
      logger.error('Webhook signature middleware error:', error);
      
      res.status(500).json({
        error: 'Signature validation error',
        message: 'Failed to validate webhook signature'
      });
    }
  };
}

/**
 * Validate webhook signature against known secrets
 */
async function validateWebhookSignature(
  req: WebhookSignatureRequest,
  providedSignature: string,
  db: DatabaseConnection,
  logger: winston.Logger
): Promise<boolean> {
  const source = req.webhookSource || req.body?.source;
  
  if (!req.rawBody) {
    logger.error('Raw body not available for signature validation');
    return false;
  }

  try {
    // Get secrets for this source from database or environment
    const secrets = await getWebhookSecrets(source, db);
    
    if (secrets.length === 0) {
      logger.warn(`No secrets configured for webhook source: ${source}`);
      return false;
    }

    // Try each secret (allows for key rotation)
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

  } catch (error) {
    logger.error('Error validating webhook signature:', error);
    return false;
  }
}

/**
 * Get webhook secrets for source
 */
async function getWebhookSecrets(source: string, db: DatabaseConnection): Promise<string[]> {
  try {
    // First try database
    const query = `
      SELECT secret FROM webhook_secrets 
      WHERE source = $1 AND active = true 
      ORDER BY created_at DESC
    `;
    
    const result = await db.query(query, [source]);
    
    if (result.rows.length > 0) {
      return result.rows.map(row => row.secret);
    }

    // Fallback to environment variables
    const envSecret = process.env[`WEBHOOK_SECRET_${source.toUpperCase().replace('-', '_')}`];
    if (envSecret) {
      return [envSecret];
    }

    // Default secrets for development/testing
    if (process.env.NODE_ENV !== 'production') {
      const defaultSecrets = {
        'claude-code': process.env.CLAUDE_CODE_WEBHOOK_SECRET || 'claude-code-dev-secret',
        'fortium-metrics-server': process.env.FORTIUM_WEBHOOK_SECRET || 'fortium-metrics-dev-secret',
        'test': 'test-webhook-secret'
      };

      return [(defaultSecrets as any)[source]].filter(Boolean);
    }

    return [];

  } catch (error) {
    throw new Error(`Failed to retrieve webhook secrets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate HMAC signature for payload
 */
function generateSignature(payload: Buffer, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Secure comparison to prevent timing attacks
 */
function secureCompare(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) {
    return false;
  }

  // Remove common prefixes (e.g., "sha256=")
  const cleanProvided = provided.replace(/^sha256=/, '');
  const cleanExpected = expected.replace(/^sha256=/, '');

  return crypto.timingSafeEqual(
    Buffer.from(cleanProvided, 'hex'),
    Buffer.from(cleanExpected, 'hex')
  );
}

/**
 * Middleware factory for specific webhook sources
 */
export function createClaudeCodeWebhookMiddleware(
  db: DatabaseConnection,
  logger: winston.Logger
) {
  return createWebhookSignatureMiddleware(db, logger, {
    required: process.env.NODE_ENV === 'production',
    allowedSources: ['claude-code', 'test'],
    secretHeader: 'X-Claude-Signature',
    timestampHeader: 'X-Claude-Timestamp'
  });
}

/**
 * Middleware for agent events
 */
export function createAgentEventWebhookMiddleware(
  db: DatabaseConnection,
  logger: winston.Logger
) {
  return createWebhookSignatureMiddleware(db, logger, {
    required: false, // Agent events may not always have signatures
    allowedSources: ['claude-code', 'ai-mesh-orchestrator', 'fortium-agent', 'test'],
    timestampTolerance: 600000 // 10 minutes for agent events
  });
}

/**
 * Simple webhook middleware for testing
 */
export function webhookSignatureMiddleware(
  req: WebhookSignatureRequest,
  res: Response,
  next: NextFunction
): void {
  // Simple implementation for testing
  const signature = req.headers['x-fortium-signature'] as string;
  const source = req.body?.source || 'unknown';

  req.webhookSource = source;

  if (process.env.NODE_ENV === 'test' || !signature) {
    return next();
  }

  // In production, would validate against known secrets
  next();
}