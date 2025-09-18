/**
 * Performance Monitoring Dashboard
 * Task 1.3: Performance monitoring dashboard setup for Seq to OpenTelemetry migration
 * 
 * Provides real-time performance monitoring, alerting, and visualization capabilities
 * for tracking logging system performance during migration.
 */

import express, { Express, Request, Response } from 'express';
import { performance, PerformanceObserver } from 'perf_hooks';
import { EventEmitter } from 'events';
import { getSeqHealth, getSeqMetrics } from '../../config/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Server } from 'http';
import WebSocket from 'ws';

// Performance metric types
interface PerformanceMetric {
  timestamp: number;
  name: string;
  value: number;
  unit: string;
  tags?: Record<string, string>;
}

interface AlertConfig {
  name: string;
  condition: string; // JavaScript expression
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMs: number;
}

interface DashboardConfig {
  refreshInterval: number; // ms
  retentionPeriod: number; // ms
  alerts: AlertConfig[];
  metrics: string[];
}

interface SystemSnapshot {
  timestamp: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  logging: {
    seqHealth: any;
    seqMetrics: any;
    circuitBreakerOpen: boolean;
    bufferSize: number;
  };
  performance: {
    avgResponseTime: number;
    p95ResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  custom?: Record<string, any>;
}

class PerformanceMonitoringDashboard extends EventEmitter {
  private app: Express;
  private server: Server;
  private wsServer: WebSocket.Server;
  private port: number = 0;
  private config: DashboardConfig;
  private metrics: PerformanceMetric[] = [];
  private snapshots: SystemSnapshot[] = [];
  private alerts: Map<string, { lastTriggered: number; count: number }> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private performanceObserver: PerformanceObserver | null = null;
  private requestLatencies: number[] = [];
  private requestCount: number = 0;
  private errorCount: number = 0;

  constructor(config?: Partial<DashboardConfig>) {
    super();
    
    this.config = {
      refreshInterval: 1000, // 1 second
      retentionPeriod: 3600000, // 1 hour
      alerts: [
        {
          name: 'High Response Time',
          condition: 'snapshot.performance.p95ResponseTime > threshold',
          threshold: 1000, // 1 second
          severity: 'high',
          enabled: true,
          cooldownMs: 60000 // 1 minute
        },
        {
          name: 'High Error Rate',
          condition: 'snapshot.performance.errorRate > threshold',
          threshold: 0.05, // 5%
          severity: 'critical',
          enabled: true,
          cooldownMs: 30000 // 30 seconds
        },
        {
          name: 'Memory Growth',
          condition: 'snapshot.memory.heapUsed > threshold',
          threshold: 500 * 1024 * 1024, // 500MB
          severity: 'medium',
          enabled: true,
          cooldownMs: 120000 // 2 minutes
        },
        {
          name: 'Seq Circuit Breaker Open',
          condition: 'snapshot.logging.circuitBreakerOpen === true',
          threshold: 1,
          severity: 'critical',
          enabled: true,
          cooldownMs: 30000
        },
        {
          name: 'High Buffer Utilization',
          condition: 'snapshot.logging.bufferSize > threshold',
          threshold: 500, // 500 log entries
          severity: 'medium',
          enabled: true,
          cooldownMs: 60000
        },
        {
          name: 'Low Request Throughput',
          condition: 'snapshot.performance.requestsPerSecond < threshold',
          threshold: 10, // 10 RPS
          severity: 'medium',
          enabled: true,
          cooldownMs: 120000
        }
      ],
      metrics: [
        'response_time_avg',
        'response_time_p95',
        'requests_per_second',
        'error_rate',
        'memory_heap_used',
        'seq_health_latency',
        'seq_buffer_size',
        'logging_throughput'
      ],
      ...config
    };
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Performance Monitoring Dashboard...');

    // Create Express app for dashboard
    this.app = express();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupPerformanceObserver();

    // Start HTTP server
    this.server = this.app.listen(0, () => {
      const address = this.server.address();
      this.port = typeof address === 'object' && address ? address.port : 8080;
      console.log(`✅ Performance Dashboard running on http://localhost:${this.port}`);
    });

    // Start monitoring
    this.startMonitoring();

    console.log('✅ Performance Monitoring Dashboard initialized');
  }

  private setupRoutes(): void {
    // Serve static dashboard files
    this.app.use(express.static(path.join(__dirname, 'dashboard-assets')));
    this.app.use(express.json());

    // Dashboard HTML
    this.app.get('/', (req: Request, res: Response) => {
      res.send(this.generateDashboardHTML());
    });

    // API endpoints
    this.app.get('/api/metrics', (req: Request, res: Response) => {
      const since = parseInt(req.query.since as string) || Date.now() - 300000; // 5 minutes
      const filteredMetrics = this.metrics.filter(m => m.timestamp >= since);
      res.json(filteredMetrics);
    });

    this.app.get('/api/snapshots', (req: Request, res: Response) => {
      const since = parseInt(req.query.since as string) || Date.now() - 300000;
      const filteredSnapshots = this.snapshots.filter(s => s.timestamp >= since);
      res.json(filteredSnapshots);
    });

    this.app.get('/api/alerts', (req: Request, res: Response) => {
      res.json({
        config: this.config.alerts,
        active: Array.from(this.alerts.entries()).map(([name, data]) => ({
          name,
          lastTriggered: data.lastTriggered,
          count: data.count
        }))
      });
    });

    this.app.post('/api/alerts/:alertName/toggle', (req: Request, res: Response) => {
      const alertName = req.params.alertName;
      const alert = this.config.alerts.find(a => a.name === alertName);
      
      if (alert) {
        alert.enabled = !alert.enabled;
        res.json({ success: true, enabled: alert.enabled });
      } else {
        res.status(404).json({ error: 'Alert not found' });
      }
    });

    // Real-time metrics endpoint for testing
    this.app.post('/api/test-metric', (req: Request, res: Response) => {
      const { name, value, unit, tags } = req.body;
      
      this.recordMetric(name, value, unit, tags);
      res.json({ success: true });
    });

    // Health endpoint
    this.app.get('/api/health', (req: Request, res: Response) => {
      res.json({
        status: 'healthy',
        uptime: process.uptime(),
        metricsCount: this.metrics.length,
        snapshotsCount: this.snapshots.length,
        activeAlerts: this.alerts.size
      });
    });
  }

  private setupWebSocket(): void {
    this.wsServer = new WebSocket.Server({ 
      port: this.port + 1,
      perMessageDeflate: false 
    });

    this.wsServer.on('connection', (ws: WebSocket) => {
      console.log('📊 Dashboard client connected');

      // Send initial data
      ws.send(JSON.stringify({
        type: 'initial',
        metrics: this.metrics.slice(-100), // Last 100 metrics
        snapshots: this.snapshots.slice(-60), // Last 60 snapshots
        config: this.config
      }));

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid JSON message'
          }));
        }
      });

      ws.on('close', () => {
        console.log('📊 Dashboard client disconnected');
      });
    });

    console.log(`📡 WebSocket server listening on port ${this.port + 1}`);
  }

  private handleWebSocketMessage(ws: WebSocket, data: any): void {
    switch (data.type) {
      case 'subscribe':
        // Client wants to subscribe to specific metrics
        break;
      case 'alert_config':
        // Update alert configuration
        if (data.alerts) {
          this.config.alerts = data.alerts;
          this.broadcast({ type: 'alert_config_updated', alerts: this.config.alerts });
        }
        break;
      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `Unknown message type: ${data.type}`
        }));
    }
  }

  private setupPerformanceObserver(): void {
    this.performanceObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'measure') {
          this.recordMetric(
            entry.name,
            entry.duration,
            'ms',
            { type: 'performance_measure' }
          );
        }
      }
    });

    this.performanceObserver.observe({ entryTypes: ['measure'] });
  }

  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        const snapshot = await this.createSystemSnapshot();
        this.snapshots.push(snapshot);
        
        // Clean old snapshots
        const cutoff = Date.now() - this.config.retentionPeriod;
        this.snapshots = this.snapshots.filter(s => s.timestamp >= cutoff);
        this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
        
        // Check alerts
        this.checkAlerts(snapshot);
        
        // Broadcast to connected clients
        this.broadcast({
          type: 'snapshot',
          data: snapshot
        });
        
      } catch (error) {
        console.error('❌ Monitoring error:', error);
      }
    }, this.config.refreshInterval);
  }

  private async createSystemSnapshot(): Promise<SystemSnapshot> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Get logging metrics
    let seqHealth, seqMetrics;
    try {
      seqHealth = await getSeqHealth();
      seqMetrics = getSeqMetrics();
    } catch (error) {
      seqHealth = { status: 'unknown', error: 'Unable to check' };
      seqMetrics = null;
    }

    // Calculate performance metrics from recent data
    const recentLatencies = this.requestLatencies.slice(-100); // Last 100 requests
    const avgResponseTime = recentLatencies.length > 0 ? 
      recentLatencies.reduce((sum, val) => sum + val, 0) / recentLatencies.length : 0;
    
    const sortedLatencies = [...recentLatencies].sort((a, b) => a - b);
    const p95ResponseTime = sortedLatencies.length > 0 ? 
      sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0 : 0;

    const now = Date.now();
    const requestsInLastSecond = this.requestLatencies.filter(
      (_, index, arr) => now - arr.length + index < 1000
    ).length;

    return {
      timestamp: now,
      memory: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        rss: memoryUsage.rss,
        external: memoryUsage.external
      },
      cpu: {
        user: cpuUsage.user / 1000, // Convert to milliseconds
        system: cpuUsage.system / 1000
      },
      logging: {
        seqHealth,
        seqMetrics,
        circuitBreakerOpen: seqMetrics?.circuitBreakerOpen || false,
        bufferSize: seqMetrics?.bufferSize || 0
      },
      performance: {
        avgResponseTime,
        p95ResponseTime,
        requestsPerSecond: requestsInLastSecond,
        errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0
      }
    };
  }

  private checkAlerts(snapshot: SystemSnapshot): void {
    for (const alert of this.config.alerts) {
      if (!alert.enabled) continue;

      const alertData = this.alerts.get(alert.name) || { lastTriggered: 0, count: 0 };
      const now = Date.now();
      
      // Check cooldown
      if (now - alertData.lastTriggered < alert.cooldownMs) {
        continue;
      }

      try {
        // Evaluate alert condition
        const threshold = alert.threshold;
        const isTriggered = eval(alert.condition.replace(/snapshot\./g, 'snapshot.'));
        
        if (isTriggered) {
          alertData.lastTriggered = now;
          alertData.count++;
          this.alerts.set(alert.name, alertData);
          
          this.emit('alert', {
            name: alert.name,
            severity: alert.severity,
            timestamp: now,
            snapshot,
            count: alertData.count
          });

          // Broadcast alert to clients
          this.broadcast({
            type: 'alert',
            data: {
              name: alert.name,
              severity: alert.severity,
              timestamp: now,
              message: this.generateAlertMessage(alert, snapshot)
            }
          });

          console.log(`🚨 Alert triggered: ${alert.name} (${alert.severity})`);
        }
      } catch (error) {
        console.error(`❌ Error evaluating alert "${alert.name}":`, error);
      }
    }
  }

  private generateAlertMessage(alert: AlertConfig, snapshot: SystemSnapshot): string {
    switch (alert.name) {
      case 'High Response Time':
        return `P95 response time is ${snapshot.performance.p95ResponseTime.toFixed(2)}ms (threshold: ${alert.threshold}ms)`;
      case 'High Error Rate':
        return `Error rate is ${(snapshot.performance.errorRate * 100).toFixed(2)}% (threshold: ${(alert.threshold * 100).toFixed(2)}%)`;
      case 'Memory Growth':
        return `Heap usage is ${(snapshot.memory.heapUsed / 1024 / 1024).toFixed(1)}MB (threshold: ${(alert.threshold / 1024 / 1024).toFixed(1)}MB)`;
      case 'Seq Circuit Breaker Open':
        return 'Seq logging circuit breaker is open - logs may be lost';
      case 'High Buffer Utilization':
        return `Seq buffer has ${snapshot.logging.bufferSize} entries (threshold: ${alert.threshold})`;
      case 'Low Request Throughput':
        return `Request rate is ${snapshot.performance.requestsPerSecond.toFixed(1)} RPS (threshold: ${alert.threshold} RPS)`;
      default:
        return `Alert condition met: ${alert.condition}`;
    }
  }

  recordMetric(name: string, value: number, unit: string = '', tags?: Record<string, string>): void {
    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      name,
      value,
      unit,
      tags
    };

    this.metrics.push(metric);

    // Broadcast to clients
    this.broadcast({
      type: 'metric',
      data: metric
    });
  }

  recordRequestLatency(latency: number, isError: boolean = false): void {
    this.requestLatencies.push(latency);
    this.requestCount++;
    
    if (isError) {
      this.errorCount++;
    }

    // Keep only recent latencies in memory
    if (this.requestLatencies.length > 1000) {
      this.requestLatencies = this.requestLatencies.slice(-500);
    }

    this.recordMetric('request_latency', latency, 'ms', { 
      error: isError.toString() 
    });
  }

  private broadcast(message: any): void {
    const messageStr = JSON.stringify(message);
    
    this.wsServer.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  private generateDashboardHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Monitoring Dashboard</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .dashboard {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            max-width: 1400px;
            margin: 0 auto;
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .card h3 {
            margin: 0 0 15px 0;
            color: #333;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
        }
        .metric:last-child {
            border-bottom: none;
        }
        .metric-value {
            font-weight: bold;
            color: #007bff;
        }
        .alert {
            padding: 12px;
            margin: 8px 0;
            border-radius: 4px;
            border-left: 4px solid;
        }
        .alert.critical {
            background-color: #fee;
            border-color: #dc3545;
            color: #721c24;
        }
        .alert.high {
            background-color: #fff3cd;
            border-color: #ffc107;
            color: #856404;
        }
        .alert.medium {
            background-color: #cce7ff;
            border-color: #007bff;
            color: #004085;
        }
        .alert.low {
            background-color: #d1ecf1;
            border-color: #17a2b8;
            color: #0c5460;
        }
        .status {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
        }
        .status.healthy {
            background-color: #d4edda;
            color: #155724;
        }
        .status.degraded {
            background-color: #fff3cd;
            color: #856404;
        }
        .status.unhealthy {
            background-color: #fee;
            color: #721c24;
        }
        .chart {
            height: 200px;
            margin: 15px 0;
            background: linear-gradient(to right, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #666;
        }
        .controls {
            margin-bottom: 20px;
        }
        .controls button {
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            margin-right: 10px;
            cursor: pointer;
        }
        .controls button:hover {
            background: #0056b3;
        }
        .connection-status {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 8px 12px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
        }
        .connected {
            background-color: #28a745;
        }
        .disconnected {
            background-color: #dc3545;
        }
    </style>
</head>
<body>
    <div class="connection-status" id="connectionStatus">Connecting...</div>
    
    <h1>Performance Monitoring Dashboard</h1>
    <div class="controls">
        <button onclick="toggleAlerts()">Toggle Alerts</button>
        <button onclick="clearMetrics()">Clear Metrics</button>
        <button onclick="exportData()">Export Data</button>
    </div>

    <div class="dashboard">
        <div class="card">
            <h3>System Overview</h3>
            <div class="metric">
                <span>Memory Usage</span>
                <span class="metric-value" id="memoryUsage">--</span>
            </div>
            <div class="metric">
                <span>CPU Usage</span>
                <span class="metric-value" id="cpuUsage">--</span>
            </div>
            <div class="metric">
                <span>Request Rate</span>
                <span class="metric-value" id="requestRate">--</span>
            </div>
            <div class="metric">
                <span>Error Rate</span>
                <span class="metric-value" id="errorRate">--</span>
            </div>
        </div>

        <div class="card">
            <h3>Response Time</h3>
            <div class="metric">
                <span>Average</span>
                <span class="metric-value" id="avgResponseTime">--</span>
            </div>
            <div class="metric">
                <span>P95</span>
                <span class="metric-value" id="p95ResponseTime">--</span>
            </div>
            <div class="chart" id="responseTimeChart">Response Time Chart</div>
        </div>

        <div class="card">
            <h3>Logging Status</h3>
            <div class="metric">
                <span>Seq Health</span>
                <span class="metric-value" id="seqHealth">--</span>
            </div>
            <div class="metric">
                <span>Buffer Size</span>
                <span class="metric-value" id="bufferSize">--</span>
            </div>
            <div class="metric">
                <span>Circuit Breaker</span>
                <span class="metric-value" id="circuitBreaker">--</span>
            </div>
        </div>

        <div class="card">
            <h3>Active Alerts</h3>
            <div id="alertsList">No active alerts</div>
        </div>
    </div>

    <script>
        let ws;
        let isConnected = false;
        let recentSnapshots = [];

        function connect() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            ws = new WebSocket(protocol + '//' + window.location.hostname + ':${this.port + 1}');
            
            ws.onopen = function() {
                console.log('Connected to performance monitoring');
                isConnected = true;
                updateConnectionStatus();
            };
            
            ws.onmessage = function(event) {
                const message = JSON.parse(event.data);
                handleMessage(message);
            };
            
            ws.onclose = function() {
                console.log('Disconnected from performance monitoring');
                isConnected = false;
                updateConnectionStatus();
                setTimeout(connect, 5000); // Reconnect after 5 seconds
            };
            
            ws.onerror = function(error) {
                console.error('WebSocket error:', error);
            };
        }

        function updateConnectionStatus() {
            const status = document.getElementById('connectionStatus');
            if (isConnected) {
                status.textContent = 'Connected';
                status.className = 'connection-status connected';
            } else {
                status.textContent = 'Disconnected';
                status.className = 'connection-status disconnected';
            }
        }

        function handleMessage(message) {
            switch (message.type) {
                case 'initial':
                    recentSnapshots = message.snapshots || [];
                    updateDashboard();
                    break;
                case 'snapshot':
                    recentSnapshots.push(message.data);
                    if (recentSnapshots.length > 100) {
                        recentSnapshots = recentSnapshots.slice(-60);
                    }
                    updateDashboard();
                    break;
                case 'alert':
                    showAlert(message.data);
                    break;
                case 'metric':
                    // Handle individual metrics if needed
                    break;
            }
        }

        function updateDashboard() {
            if (recentSnapshots.length === 0) return;
            
            const latest = recentSnapshots[recentSnapshots.length - 1];
            
            // Update system overview
            document.getElementById('memoryUsage').textContent = 
                (latest.memory.heapUsed / 1024 / 1024).toFixed(1) + ' MB';
            document.getElementById('requestRate').textContent = 
                latest.performance.requestsPerSecond.toFixed(1) + ' RPS';
            document.getElementById('errorRate').textContent = 
                (latest.performance.errorRate * 100).toFixed(2) + '%';
            
            // Update response time
            document.getElementById('avgResponseTime').textContent = 
                latest.performance.avgResponseTime.toFixed(1) + ' ms';
            document.getElementById('p95ResponseTime').textContent = 
                latest.performance.p95ResponseTime.toFixed(1) + ' ms';
            
            // Update logging status
            const seqStatus = latest.logging.seqHealth.status || 'unknown';
            document.getElementById('seqHealth').innerHTML = 
                '<span class="status ' + seqStatus + '">' + seqStatus + '</span>';
            document.getElementById('bufferSize').textContent = 
                latest.logging.bufferSize + ' entries';
            document.getElementById('circuitBreaker').textContent = 
                latest.logging.circuitBreakerOpen ? 'OPEN' : 'CLOSED';
        }

        function showAlert(alert) {
            const alertsList = document.getElementById('alertsList');
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert ' + alert.severity;
            alertDiv.innerHTML = '<strong>' + alert.name + '</strong><br>' + alert.message;
            
            alertsList.appendChild(alertDiv);
            
            // Remove alert after 30 seconds
            setTimeout(() => {
                alertDiv.remove();
                if (alertsList.children.length === 0) {
                    alertsList.textContent = 'No active alerts';
                }
            }, 30000);
        }

        function toggleAlerts() {
            alert('Alert configuration not implemented in this demo');
        }

        function clearMetrics() {
            if (confirm('Clear all metrics data?')) {
                fetch('/api/clear-metrics', { method: 'POST' })
                    .then(() => location.reload());
            }
        }

        function exportData() {
            const data = {
                snapshots: recentSnapshots,
                timestamp: new Date().toISOString()
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'performance-data-' + Date.now() + '.json';
            a.click();
            URL.revokeObjectURL(url);
        }

        // Start connection
        connect();
        updateConnectionStatus();
    </script>
</body>
</html>
`;
  }

  async generateReport(): Promise<string> {
    const recentSnapshots = this.snapshots.slice(-100);
    const recentMetrics = this.metrics.slice(-500);
    
    if (recentSnapshots.length === 0) {
      return 'No performance data available';
    }

    const latest = recentSnapshots[recentSnapshots.length - 1];
    const oldest = recentSnapshots[0];
    
    // Calculate trends
    const memoryGrowth = latest.memory.heapUsed - oldest.memory.heapUsed;
    const avgResponseTime = recentSnapshots.reduce((sum, s) => sum + s.performance.avgResponseTime, 0) / recentSnapshots.length;
    const avgErrorRate = recentSnapshots.reduce((sum, s) => sum + s.performance.errorRate, 0) / recentSnapshots.length;
    const avgThroughput = recentSnapshots.reduce((sum, s) => sum + s.performance.requestsPerSecond, 0) / recentSnapshots.length;

    return `
# Performance Monitoring Report

Generated: ${new Date().toISOString()}
Monitoring Period: ${new Date(oldest.timestamp).toISOString()} to ${new Date(latest.timestamp).toISOString()}
Snapshots Analyzed: ${recentSnapshots.length}

## Current Status

### System Resources
- **Memory Usage**: ${(latest.memory.heapUsed / 1024 / 1024).toFixed(1)} MB
- **Memory Growth**: ${(memoryGrowth / 1024 / 1024).toFixed(1)} MB
- **CPU Usage**: User ${(latest.cpu.user / 1000).toFixed(1)}ms, System ${(latest.cpu.system / 1000).toFixed(1)}ms

### Performance Metrics
- **Average Response Time**: ${avgResponseTime.toFixed(2)} ms
- **P95 Response Time**: ${latest.performance.p95ResponseTime.toFixed(2)} ms
- **Request Throughput**: ${avgThroughput.toFixed(1)} RPS
- **Error Rate**: ${(avgErrorRate * 100).toFixed(2)}%

### Logging System
- **Seq Health**: ${latest.logging.seqHealth.status}
- **Buffer Utilization**: ${latest.logging.bufferSize} entries
- **Circuit Breaker**: ${latest.logging.circuitBreakerOpen ? 'OPEN (⚠️)' : 'CLOSED (✅)'}

## Performance Trends

${recentSnapshots.length > 1 ? `
- **Memory**: ${memoryGrowth > 0 ? '📈' : '📉'} ${(Math.abs(memoryGrowth) / 1024 / 1024).toFixed(1)} MB change
- **Response Time**: ${latest.performance.avgResponseTime > oldest.performance.avgResponseTime ? '📈' : '📉'} ${Math.abs(latest.performance.avgResponseTime - oldest.performance.avgResponseTime).toFixed(2)} ms change
- **Throughput**: ${latest.performance.requestsPerSecond > oldest.performance.requestsPerSecond ? '📈' : '📉'} ${Math.abs(latest.performance.requestsPerSecond - oldest.performance.requestsPerSecond).toFixed(1)} RPS change
` : 'Insufficient data for trend analysis'}

## Alert Summary

Total Alert Types: ${this.config.alerts.length}
Active Alerts: ${this.alerts.size}

${Array.from(this.alerts.entries()).map(([name, data]) => `
- **${name}**: Triggered ${data.count} times, last at ${new Date(data.lastTriggered).toISOString()}
`).join('')}

## Key Metrics Over Time

${this.config.metrics.map(metric => {
  const metricData = recentMetrics.filter(m => m.name === metric);
  if (metricData.length === 0) return `- **${metric}**: No data`;
  
  const values = metricData.map(m => m.value);
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  
  return `- **${metric}**: Avg ${avg.toFixed(2)}, Min ${min.toFixed(2)}, Max ${max.toFixed(2)}`;
}).join('\n')}

## Recommendations

${this.generateRecommendations(latest, recentSnapshots)}

---
*Generated by Performance Monitoring Dashboard*
`;
  }

  private generateRecommendations(latest: SystemSnapshot, snapshots: SystemSnapshot[]): string {
    const recommendations: string[] = [];

    // Memory recommendations
    if (latest.memory.heapUsed > 500 * 1024 * 1024) { // 500MB
      recommendations.push('• Consider investigating memory usage - heap size is over 500MB');
    }

    // Response time recommendations
    if (latest.performance.p95ResponseTime > 1000) {
      recommendations.push('• P95 response time exceeds 1 second - investigate slow endpoints');
    }

    // Error rate recommendations
    if (latest.performance.errorRate > 0.05) {
      recommendations.push('• Error rate is above 5% - check application logs for recurring issues');
    }

    // Logging recommendations
    if (latest.logging.circuitBreakerOpen) {
      recommendations.push('• Seq logging circuit breaker is open - check Seq connectivity and health');
    }

    if (latest.logging.bufferSize > 1000) {
      recommendations.push('• Logging buffer is highly utilized - consider increasing flush frequency or investigating Seq performance');
    }

    // Throughput recommendations
    if (latest.performance.requestsPerSecond < 10 && snapshots.length > 10) {
      recommendations.push('• Low request throughput detected - verify application is receiving traffic');
    }

    return recommendations.length > 0 ? 
      recommendations.join('\n') : 
      '• System performance appears normal - no specific recommendations at this time';
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up performance monitoring dashboard...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    if (this.wsServer) {
      this.wsServer.close();
    }
    
    if (this.server) {
      this.server.close();
    }
    
    console.log('✅ Performance monitoring cleanup complete');
  }
}

export { 
  PerformanceMonitoringDashboard, 
  PerformanceMetric, 
  AlertConfig, 
  DashboardConfig,
  SystemSnapshot 
};

// Standalone execution
if (require.main === module) {
  async function runMonitoringDashboard() {
    const dashboard = new PerformanceMonitoringDashboard();
    
    try {
      await dashboard.initialize();
      
      // Set up alert handlers
      dashboard.on('alert', (alert) => {
        console.log(`🚨 ALERT [${alert.severity.toUpperCase()}]: ${alert.name}`);
        console.log(`   Timestamp: ${new Date(alert.timestamp).toISOString()}`);
        console.log(`   Count: ${alert.count}`);
      });
      
      console.log('📊 Performance Monitoring Dashboard is running');
      console.log(`   Dashboard: http://localhost:${dashboard.port || 8080}`);
      console.log('   Press Ctrl+C to stop');
      
      // Keep the process running
      process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down dashboard...');
        await dashboard.cleanup();
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Failed to start monitoring dashboard:', error);
      process.exit(1);
    }
  }

  runMonitoringDashboard().catch(console.error);
}