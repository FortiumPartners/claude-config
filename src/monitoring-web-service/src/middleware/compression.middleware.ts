/**
 * Compression Middleware Configuration
 * Fortium External Metrics Web Service - Task 1.6: Express.js Server Foundation
 */

import compression from 'compression';
import { config } from '../config/environment';
import { Request, Response } from 'express';

// Compression configuration
export const compressionMiddleware = compression({
  // Compression level (0-9, -1 for default)
  level: config.compression.level,

  // Minimum response size to compress (in bytes)
  threshold: 1024, // 1KB

  // Custom filter function to determine what to compress
  filter: (req: Request, res: Response) => {
    // Don't compress responses if the request includes a 'x-no-compression' header
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Don't compress already compressed content
    const contentEncoding = res.getHeader('content-encoding');
    if (contentEncoding) {
      return false;
    }

    // Don't compress images, videos, or already compressed files
    const contentType = res.getHeader('content-type') as string;
    if (contentType) {
      const type = contentType.split(';')[0].toLowerCase();
      
      const noCompressTypes = [
        'image/',
        'video/',
        'audio/',
        'application/zip',
        'application/gzip',
        'application/x-gzip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        'application/pdf',
      ];

      if (noCompressTypes.some(noCompress => type.startsWith(noCompress))) {
        return false;
      }
    }

    // Use default compression filter for everything else
    return compression.filter(req, res);
  },

  // Memory level (1-9, affects memory usage vs compression speed)
  memLevel: 8,

  // Window bits (affects memory usage)
  windowBits: 15,

  // Compression strategy
  strategy: compression.constants.Z_DEFAULT_STRATEGY,

  // Chunk size for compression
  chunkSize: 1024,
});

// Alternative gzip middleware for specific routes that need high compression
export const highCompressionMiddleware = compression({
  level: 9, // Maximum compression
  threshold: 512, // Compress smaller responses
  memLevel: 9, // Use more memory for better compression
  filter: compression.filter,
});

// No compression middleware for specific routes
export const noCompressionMiddleware = (req: Request, res: Response, next: any) => {
  // Set header to skip compression
  req.headers['x-no-compression'] = 'true';
  next();
};