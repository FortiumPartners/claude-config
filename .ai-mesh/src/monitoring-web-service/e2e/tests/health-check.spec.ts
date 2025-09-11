import { test, expect } from '@playwright/test';

test.describe('External Metrics Web Service E2E Tests', () => {
  test('health endpoint should return healthy status', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('External Metrics Web Service');
    expect(body.version).toBe('1.0.0');
    expect(body.uptime).toBeGreaterThan(0);
  });

  test('API v1 endpoint should return service info', async ({ request }) => {
    const response = await request.get('/api/v1');
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.message).toBe('External Metrics Web Service API v1');
    expect(body.endpoints).toHaveProperty('health');
    expect(body.endpoints).toHaveProperty('metrics');
    expect(body.endpoints).toHaveProperty('sessions');
    expect(body.endpoints).toHaveProperty('dashboard');
  });

  test('metrics endpoint should return mock data', async ({ request }) => {
    const response = await request.get('/api/v1/metrics');
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.data).toHaveLength(2);
    expect(body.total).toBe(2);
    expect(body.data[0]).toHaveProperty('type');
    expect(body.data[0]).toHaveProperty('duration');
    expect(body.data[0]).toHaveProperty('success');
  });

  test('sessions endpoint should return session data', async ({ request }) => {
    const response = await request.get('/api/v1/sessions');
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.data[0]).toHaveProperty('id');
    expect(body.data[0]).toHaveProperty('userId');
    expect(body.data[0]).toHaveProperty('duration');
  });

  test('dashboard endpoint should return analytics summary', async ({ request }) => {
    const response = await request.get('/api/v1/dashboard');
    expect(response.status()).toBe(200);
    
    const body = await response.json();
    expect(body.summary).toHaveProperty('totalSessions');
    expect(body.summary).toHaveProperty('totalCommands');
    expect(body.summary).toHaveProperty('avgSessionDuration');
    expect(body.metrics).toHaveProperty('productivity');
    expect(body.metrics).toHaveProperty('successRate');
  });

  test('404 endpoint should return not found', async ({ request }) => {
    const response = await request.get('/api/v1/nonexistent');
    expect(response.status()).toBe(404);
    
    const body = await response.json();
    expect(body.error).toBe('Not Found');
    expect(body.message).toContain('not found');
  });
});