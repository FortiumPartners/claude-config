/**
 * MCP (Model Context Protocol) Routes
 * Task 4.2: MCP server interface maintaining backward compatibility
 * 
 * Implements MCP 2024-11-05 protocol specification for Claude Code integration
 */

import { Router, Request, Response } from 'express';
import { McpServerService } from '../services/mcp-server.service';
import { DatabaseConnection } from '../database/connection';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import rateLimit from 'express-rate-limit';
import * as winston from 'winston';

export interface McpRoutes {
  router: Router;
}

export interface McpRequest {
  jsonrpc: '2.0';
  id?: number | string;
  method: string;
  params?: any;
}

export interface McpResponse {
  jsonrpc: '2.0';
  id?: number | string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface McpNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

export function createMcpRoutes(
  db: DatabaseConnection,
  logger: winston.Logger
): McpRoutes {
  const router = Router();
  const mcpService = new McpServerService(db, logger);

  // MCP-specific rate limiting
  const mcpRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 500, // 500 MCP requests per minute per organization
    message: {
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Rate limit exceeded',
        data: {
          retry_after: 60,
          limit_type: 'mcp_requests'
        }
      }
    },
    standardHeaders: false, // MCP uses its own error format
    legacyHeaders: false,
    keyGenerator: (req: AuthenticatedRequest) => {
      return req.user?.organization_id || req.ip;
    },
    handler: (req: Request, res: Response) => {
      const rateLimitResponse: McpResponse = {
        jsonrpc: '2.0',
        id: (req.body as McpRequest)?.id,
        error: {
          code: -32000,
          message: 'Rate limit exceeded',
          data: {
            retry_after: 60,
            limit_type: 'mcp_requests'
          }
        }
      };
      res.status(200).json(rateLimitResponse); // MCP errors are 200 OK with error objects
    }
  });

  /**
   * POST /api/mcp/rpc
   * Main MCP JSON-RPC 2.0 endpoint
   */
  router.post('/rpc',
    mcpRateLimit,
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const mcpRequest = req.body as McpRequest;
        
        // Validate JSON-RPC 2.0 format
        if (!mcpRequest.jsonrpc || mcpRequest.jsonrpc !== '2.0') {
          const errorResponse: McpResponse = {
            jsonrpc: '2.0',
            id: mcpRequest.id,
            error: {
              code: -32600,
              message: 'Invalid Request',
              data: { reason: 'Missing or invalid jsonrpc field' }
            }
          };
          return res.status(200).json(errorResponse);
        }

        if (!mcpRequest.method || typeof mcpRequest.method !== 'string') {
          const errorResponse: McpResponse = {
            jsonrpc: '2.0',
            id: mcpRequest.id,
            error: {
              code: -32600,
              message: 'Invalid Request',
              data: { reason: 'Missing or invalid method field' }
            }
          };
          return res.status(200).json(errorResponse);
        }

        // Route to appropriate MCP method handler
        const response = await mcpService.handleRequest(
          mcpRequest,
          req.user!.organization_id,
          req.user!.id
        );

        res.status(200).json(response);
        
      } catch (error) {
        logger.error('MCP request error:', error);
        
        const errorResponse: McpResponse = {
          jsonrpc: '2.0',
          id: (req.body as McpRequest)?.id,
          error: {
            code: -32603,
            message: 'Internal error',
            data: { 
              error: error instanceof Error ? error.message : 'Unknown error' 
            }
          }
        };
        
        res.status(200).json(errorResponse);
      }
    }
  );

  /**
   * WebSocket endpoint for MCP notifications (future enhancement)
   * GET /api/mcp/ws
   */
  router.get('/ws', async (req: Request, res: Response) => {
    res.status(501).json({
      error: 'WebSocket notifications not yet implemented',
      message: 'Use HTTP JSON-RPC for now. WebSocket support coming soon.'
    });
  });

  /**
   * GET /api/mcp/capabilities
   * Returns server capabilities for Claude Code discovery
   */
  router.get('/capabilities',
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const capabilities = await mcpService.getServerCapabilities();
        res.json({
          server_info: {
            name: 'fortium-metrics-server',
            version: '1.0.0',
            description: 'Fortium External Metrics Web Service MCP Server'
          },
          protocol_version: '2024-11-05',
          capabilities,
          endpoints: {
            rpc: '/api/mcp/rpc',
            websocket: '/api/mcp/ws'  // Not yet implemented
          }
        });
      } catch (error) {
        logger.error('Error getting MCP capabilities:', error);
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Unable to retrieve server capabilities'
        });
      }
    }
  );

  /**
   * GET /api/mcp/health
   * MCP server health check
   */
  router.get('/health', async (req: Request, res: Response) => {
    try {
      const health = await mcpService.getServerHealth();
      res.json(health);
    } catch (error) {
      logger.error('MCP health check error:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * POST /api/mcp/batch
   * Batch MCP requests (extension to standard)
   */
  router.post('/batch',
    mcpRateLimit,
    authMiddleware,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const requests = req.body as McpRequest[];
        
        if (!Array.isArray(requests)) {
          const errorResponse: McpResponse = {
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Invalid Request',
              data: { reason: 'Batch request must be an array' }
            }
          };
          return res.status(200).json(errorResponse);
        }

        // Process batch with concurrency limit
        const responses = await mcpService.handleBatchRequests(
          requests,
          req.user!.organization_id,
          req.user!.id
        );

        res.status(200).json(responses);
        
      } catch (error) {
        logger.error('MCP batch request error:', error);
        
        const errorResponse: McpResponse = {
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: { 
              error: error instanceof Error ? error.message : 'Unknown error' 
            }
          }
        };
        
        res.status(200).json(errorResponse);
      }
    }
  );

  return { router };
}

// MCP Error Codes (JSON-RPC 2.0 standard + MCP extensions)
export const MCP_ERROR_CODES = {
  // JSON-RPC 2.0 standard errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600, 
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // MCP-specific errors
  SERVER_ERROR: -32000,
  RESOURCE_NOT_FOUND: -32001,
  TOOL_NOT_FOUND: -32002,
  AUTHENTICATION_ERROR: -32003,
  AUTHORIZATION_ERROR: -32004,
  RATE_LIMIT_ERROR: -32005,
  VALIDATION_ERROR: -32006,
  
  // Fortium-specific extensions  
  ORGANIZATION_ERROR: -33000,
  MIGRATION_ERROR: -33001,
  COMPATIBILITY_ERROR: -33002
} as const;