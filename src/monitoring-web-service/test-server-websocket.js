const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3002;

// Create Socket.io server with CORS configuration
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// CORS middleware for REST API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
    rooms.forEach(room => {
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
    rooms.forEach(room => {
      socket.leave(room);
      console.log(`Socket ${socket.id} left room: ${room}`);
    });
  });
  
  // Simulate periodic real-time updates
  const updateInterval = setInterval(() => {
    // Send dashboard update
    socket.emit('dashboard_update', {
      type: 'metrics',
      data: {
        activeUsers: Math.floor(Math.random() * 100),
        commandsExecuted: Math.floor(Math.random() * 1000),
        avgResponseTime: Math.random() * 500,
        timestamp: new Date()
      }
    });
    
    // Send metric ingested event
    socket.emit('metric_ingested', {
      metric_type: 'command_execution',
      value: Math.random() * 100,
      timestamp: new Date()
    });
  }, 5000); // Send updates every 5 seconds
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('🔌 WebSocket client disconnected:', socket.id);
    clearInterval(updateInterval);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'External Metrics Web Service (WebSocket Enabled)',
    version: '1.0.0',
    uptime: process.uptime(),
    websocket: {
      connected: io.engine.clientsCount,
      transport: 'socket.io'
    }
  });
});

// API version endpoint
app.get('/api/v1', (req, res) => {
  res.status(200).json({
    message: 'External Metrics Web Service API v1',
    endpoints: {
      health: '/health',
      metrics: '/api/v1/metrics',
      sessions: '/api/v1/sessions',
      dashboard: '/api/v1/dashboard',
      websocket: 'ws://localhost:' + PORT
    },
    timestamp: new Date().toISOString()
  });
});

// Mock metrics endpoint
app.get('/api/v1/metrics', (req, res) => {
  res.status(200).json({
    data: [
      {
        id: '1',
        type: 'command_execution',
        command: '/implement-trd',
        duration: 45000,
        timestamp: new Date().toISOString(),
        success: true
      },
      {
        id: '2', 
        type: 'agent_interaction',
        agent: 'tech-lead-orchestrator',
        duration: 12000,
        timestamp: new Date().toISOString(),
        success: true
      }
    ],
    total: 2,
    timestamp: new Date().toISOString()
  });
});

// Mock sessions endpoint  
app.get('/api/v1/sessions', (req, res) => {
  res.status(200).json({
    data: [
      {
        id: 'session-1',
        userId: 'test-user',
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date().toISOString(),
        duration: 3600000,
        commandsExecuted: 15,
        agentsUsed: ['tech-lead-orchestrator', 'backend-developer']
      }
    ],
    total: 1,
    timestamp: new Date().toISOString()
  });
});

// Mock dashboard endpoint
app.get('/api/v1/dashboard', (req, res) => {
  res.status(200).json({
    summary: {
      totalSessions: 142,
      totalCommands: 1205,
      avgSessionDuration: 2400000,
      topAgents: ['tech-lead-orchestrator', 'backend-developer', 'frontend-developer']
    },
    metrics: {
      productivity: 85.2,
      successRate: 94.7,
      avgResponseTime: 450
    },
    timestamp: new Date().toISOString()
  });
});

// Mock authentication endpoints
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Mock validation - accept any email/password for demo
  if (email && password) {
    const userId = 'user-1';
    const orgId = 'org-1';
    
    res.status(200).json({
      access_token: 'mock-jwt-access-token-' + Date.now(),
      refresh_token: 'mock-jwt-refresh-token-' + Date.now(),
      expires_in: 86400,
      user: {
        id: userId,
        email: email,
        name: 'Demo User',
        role: 'admin',
        organization_id: orgId,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: new Date().toISOString()
      },
      organization: {
        id: orgId,
        name: 'Demo Organization',
        domain: 'demo',
        subscription: {
          plan: 'pro',
          status: 'active'
        }
      },
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Email and password are required',
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/v1/auth/logout', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/v1/auth/refresh', (req, res) => {
  const { refresh_token } = req.body;
  
  if (refresh_token) {
    res.status(200).json({
      access_token: 'mock-jwt-access-token-refreshed-' + Date.now(),
      refresh_token: 'mock-jwt-refresh-token-refreshed-' + Date.now(),
      expires_in: 86400,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid refresh token',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/v1/auth/profile', (req, res) => {
  // Check for Authorization header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization token',
      timestamp: new Date().toISOString()
    });
  }
  
  res.status(200).json({
    user: {
      id: 'user-1',
      email: 'demo@example.com',
      name: 'Demo User',
      role: 'admin',
      organization_id: 'org-1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: new Date().toISOString()
    },
    organization: {
      id: 'org-1',
      name: 'Demo Organization',
      domain: 'demo',
      subscription: {
        plan: 'pro',
        status: 'active'
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Mock tenants endpoint for multi-tenant support
app.get('/api/v1/tenants', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization token',
      timestamp: new Date().toISOString()
    });
  }
  
  res.status(200).json({
    tenants: [
      {
        id: 'tenant-1',
        name: 'Demo Organization',
        domain: 'demo',
        settings: {
          timezone: 'UTC',
          dateFormat: 'YYYY-MM-DD',
          currency: 'USD',
          features: {
            analytics: true,
            reports: true,
            integrations: true,
            api: true,
            sso: false,
            customBranding: true
          },
          limits: {
            users: 50,
            projects: 100,
            storage: 10,
            apiRequests: 10000
          },
          branding: {
            primaryColor: '#3B82F6',
            secondaryColor: '#1E40AF',
            companyName: 'Demo Organization'
          }
        },
        subscription: {
          plan: 'pro',
          status: 'active',
          currentPeriodStart: '2024-01-01T00:00:00.000Z',
          currentPeriodEnd: '2025-01-01T00:00:00.000Z'
        },
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: new Date().toISOString()
      }
    ],
    total: 1,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Start server with WebSocket support
httpServer.listen(PORT, () => {
  console.log(`🚀 External Metrics Web Service (WebSocket Enabled) running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 API endpoint: http://localhost:${PORT}/api/v1`);
  console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`🎯 Dashboard: http://localhost:${PORT}/api/v1/dashboard`);
});

module.exports = { app, io, httpServer };