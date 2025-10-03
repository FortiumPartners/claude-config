/**
 * Simple Development Server
 * Bypasses complex initialization for quick development
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { config } from './config/environment';
import { logger } from './config/logger';

const app = express();
const server = createServer(app);

// Basic middleware
app.use(cors());
app.use(express.json());

// Mock authentication endpoint
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;

  // Simple mock authentication
  if (email === 'demo@example.com' && password === 'password123') {
    res.json({
      success: true,
      data: {
        user: {
          id: '1',
          email: 'demo@example.com',
          name: 'Demo User',
          role: 'admin'
        },
        tokens: {
          accessToken: 'mock-jwt-token-' + Date.now(),
          refreshToken: 'mock-refresh-token-' + Date.now()
        }
      },
      message: 'Login successful'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// Mock analytics endpoint (already in routes/index.ts)
app.get('/api/v1/analytics/productivity-trends', (req, res) => {
  const mockData = Array.from({ length: 30 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - i));
    return {
      date: date.toISOString().split('T')[0],
      productivity_score: Math.floor(Math.random() * 20) + 70,
      total_activities: Math.floor(Math.random() * 50) + 20,
      success_rate: Math.floor(Math.random() * 20) + 80,
      avg_duration: Math.floor(Math.random() * 300) + 100
    };
  });

  res.json({
    success: true,
    data: mockData,
    meta: {
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end_date: new Date().toISOString(),
      total_days: 30,
      average_score: Math.floor(mockData.reduce((sum, item) => sum + item.productivity_score, 0) / mockData.length),
      note: 'Mock data for development'
    },
    message: 'Productivity trends retrieved successfully (mock data)'
  });
});

// Mock profile endpoint
app.get('/api/v1/auth/profile', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  // Simple mock profile response
  res.json({
    success: true,
    data: {
      id: '1',
      email: 'demo@example.com',
      firstName: 'Demo',
      lastName: 'User',
      role: 'admin',
      permissions: ['dashboard.view', 'metrics.view', 'reports.view'],
      lastLogin: new Date().toISOString(),
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true,
      timezone: 'America/Chicago',
      preferences: {
        theme: 'light',
        language: 'en'
      }
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket Server Setup
const wss = new WebSocketServer({
  server,
  path: '/ws'
});

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected');

  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connected',
    message: 'WebSocket connection established'
  }));

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('WebSocket message received:', message);

      // Handle different message types
      switch (message.type) {
        case 'subscribe':
          // Handle subscription to rooms/channels
          const rooms = message.data?.rooms || [];
          console.log('Client subscribing to rooms:', rooms);
          ws.send(JSON.stringify({
            type: 'subscribed',
            data: { rooms, success: true }
          }));
          break;

        case 'unsubscribe':
          // Handle unsubscription from rooms/channels
          const unsubRooms = message.data?.rooms || [];
          console.log('Client unsubscribing from rooms:', unsubRooms);
          ws.send(JSON.stringify({
            type: 'unsubscribed',
            data: { rooms: unsubRooms, success: true }
          }));
          break;

        case 'ping':
          // Respond to ping with pong
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          // Echo back unknown message types for development
          ws.send(JSON.stringify({
            type: 'response',
            data: {
              success: true,
              message: `Received message of type: ${message.type}`,
              originalMessage: message
            }
          }));
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        data: {
          message: 'Invalid message format',
          error: error.message
        }
      }));
    }
  });

  // Handle connection close
  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Send periodic heartbeat to keep connection alive
  const heartbeat = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString()
      }));
    } else {
      clearInterval(heartbeat);
    }
  }, 30000); // Every 30 seconds
});

// Broadcast function for sending messages to all connected clients
const broadcast = (message: any) => {
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
};

// Mock real-time data generation for development
setInterval(() => {
  // Send mock dashboard update
  broadcast({
    type: 'dashboard_update',
    data: {
      dashboard_id: 'default',
      widget_id: 'productivity-trends',
      data: {
        timestamp: new Date().toISOString(),
        productivity_score: Math.floor(Math.random() * 20) + 70,
        activity_count: Math.floor(Math.random() * 10) + 1
      }
    }
  });
}, 15000); // Every 15 seconds

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  logger.info(`Simple development server running on port ${PORT}`);
  console.log(`🚀 Simple development server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket server running on ws://localhost:${PORT}/ws`);
});