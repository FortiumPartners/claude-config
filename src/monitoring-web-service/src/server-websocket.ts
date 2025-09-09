/**
 * WebSocket-Enabled Server
 * Fortium External Metrics Web Service - Real-time WebSocket Integration
 */

import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app';
import { config } from './config/environment';
import { logger } from './config/logger';

async function startServer() {
  try {
    // Create Express app
    const app = await createApp();
    
    // Create HTTP server
    const httpServer = createServer(app);
    
    // Create Socket.io server with CORS configuration
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Make Socket.IO instance available to the app
    app.set('io', io);

    // Socket.io connection handling
    io.on('connection', (socket) => {
      console.log('🔌 WebSocket client connected:', socket.id);
      
      // Extract auth info from handshake
      const { token, user_id, organization_id } = socket.handshake.auth || {};
      console.log('Auth info:', { user_id, organization_id });
      
      // Join organization room if available
      if (organization_id) {
        socket.join(`org:${organization_id}`);
        console.log(`Socket ${socket.id} joined room: org:${organization_id}`);
      }
      
      // Handle subscription requests
      socket.on('subscribe', (data) => {
        console.log('Subscribe request:', data);
        const { rooms = [] } = data;
        rooms.forEach((room: string) => {
          socket.join(room);
          console.log(`Socket ${socket.id} joined room: ${room}`);
        });
        
        // Send confirmation
        socket.emit('subscribed', { rooms, timestamp: new Date() });
      });
      
      // Handle unsubscribe requests
      socket.on('unsubscribe', (data) => {
        console.log('Unsubscribe request:', data);
        const { rooms = [] } = data;
        rooms.forEach((room: string) => {
          socket.leave(room);
          console.log(`Socket ${socket.id} left room: ${room}`);
        });
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        console.log('🔌 WebSocket client disconnected:', socket.id);
      });
    });

    // Start server
    const PORT = process.env.PORT || config.port || 3000;
    httpServer.listen(PORT, () => {
      logger.info(`🚀 External Metrics Web Service (WebSocket Enabled) running on http://localhost:${PORT}`);
      logger.info(`📊 Health check: http://localhost:${PORT}${config.healthCheck?.path || '/health'}`);
      logger.info(`📈 API endpoint: http://localhost:${PORT}/api/v1`);
      logger.info(`🔌 WebSocket endpoint: ws://localhost:${PORT}`);
      logger.info(`🎯 Dashboard: http://localhost:${PORT}/api/v1/dashboard`);
      
      console.log(`🚀 External Metrics Web Service (WebSocket Enabled) running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}${config.healthCheck?.path || '/health'}`);
      console.log(`📈 API endpoint: http://localhost:${PORT}/api/v1`);
      console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}`);
      console.log(`🎯 Dashboard: http://localhost:${PORT}/api/v1/dashboard`);
    });

    // Export for external access
    return { app, io, httpServer };
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export { startServer };