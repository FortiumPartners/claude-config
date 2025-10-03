import { test, expect } from '@playwright/test';

test.describe('WebSocket Connection Test', () => {
  test('should be able to connect to WebSocket server', async ({ page }) => {
    // Navigate to frontend
    await page.goto('http://localhost:3000');

    // Create a WebSocket connection test
    const wsConnectionResult = await page.evaluate(async () => {
      return new Promise((resolve) => {
        // Try to connect to WebSocket
        const ws = new WebSocket('ws://localhost:3001/ws');
        let connectionResult = {
          connected: false,
          error: null,
          readyState: 0
        };

        // Set timeout
        const timeout = setTimeout(() => {
          connectionResult.error = 'Connection timeout';
          connectionResult.readyState = ws.readyState;
          ws.close();
          resolve(connectionResult);
        }, 5000);

        ws.onopen = () => {
          clearTimeout(timeout);
          connectionResult.connected = true;
          connectionResult.readyState = ws.readyState;
          ws.close();
          resolve(connectionResult);
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          connectionResult.error = 'WebSocket error occurred';
          connectionResult.readyState = ws.readyState;
          resolve(connectionResult);
        };

        ws.onclose = (event) => {
          if (!connectionResult.connected && !connectionResult.error) {
            connectionResult.error = `Connection closed: ${event.code} ${event.reason}`;
            connectionResult.readyState = ws.readyState;
            clearTimeout(timeout);
            resolve(connectionResult);
          }
        };
      });
    });

    console.log('WebSocket connection result:', wsConnectionResult);

    // Check if WebSocket connected successfully
    expect(wsConnectionResult.connected).toBe(true);
  });

  test('should check if backend health endpoint is accessible', async ({ page }) => {
    // Test if backend is responding
    const response = await page.request.get('http://localhost:3001/health');
    console.log('Health endpoint status:', response.status());
    console.log('Health endpoint response:', await response.text());
  });

  test('should check if WebSocket endpoint exists', async ({ page }) => {
    // Test WebSocket HTTP endpoint
    const response = await page.request.get('http://localhost:3001/api/v1/websocket/stats');
    console.log('WebSocket stats endpoint status:', response.status());
    console.log('WebSocket stats response:', await response.text());
  });
});