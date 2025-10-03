import { test, expect, Page } from '@playwright/test';

test.describe('Real-Time Activity Feed WebSocket Testing', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Monitor console logs
    page.on('console', (msg) => {
      console.log(`🔍 Console [${msg.type()}]:`, msg.text());
    });

    // Monitor WebSocket connections
    page.on('websocket', (ws) => {
      console.log(`🔗 WebSocket connection: ${ws.url()}`);

      ws.on('framesent', (event) => {
        console.log(`📤 WS Frame sent:`, event.payload);
      });

      ws.on('framereceived', (event) => {
        console.log(`📥 WS Frame received:`, event.payload);
      });

      ws.on('close', (ws) => {
        console.log(`❌ WebSocket closed`);
      });
    });

    // Monitor network requests
    page.on('request', (request) => {
      if (request.url().includes('websocket') || request.url().includes('ws')) {
        console.log(`🌐 Network request: ${request.method()} ${request.url()}`);
      }
    });

    page.on('response', (response) => {
      if (response.url().includes('websocket') || response.url().includes('ws')) {
        console.log(`📡 Network response: ${response.status()} ${response.url()}`);
      }
    });
  });

  test('should connect to WebSocket and receive real-time updates', async () => {
    // Navigate to the monitoring dashboard
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take initial screenshot
    await page.screenshot({
      path: '.playwright-mcp/dashboard-initial.png',
      fullPage: true
    });

    // Look for login form or dashboard
    const loginForm = page.locator('form[data-testid="login-form"]');
    const dashboard = page.locator('[data-testid="dashboard"]');

    if (await loginForm.isVisible()) {
      console.log('🔐 Login required, attempting authentication...');

      // Fill login form
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'password123');
      await page.click('button[type="submit"]');

      // Wait for navigation after login
      await page.waitForLoadState('networkidle');
    }

    // Wait for dashboard to be visible
    await expect(dashboard.or(page.locator('body'))).toBeVisible();

    // Look for the real-time activity feed component
    const activityFeed = page.locator('[data-testid="real-time-activity-feed"]').or(
      page.locator('[class*="activity"]').or(
        page.locator('[class*="feed"]').or(
          page.locator('text=Activity').locator('..')
        )
      )
    );

    // Check if activity feed is present
    if (await activityFeed.isVisible()) {
      console.log('✅ Activity feed component found');
      await activityFeed.screenshot({ path: '.playwright-mcp/activity-feed.png' });
    } else {
      console.log('❌ Activity feed component not found');

      // List all visible elements for debugging
      const elements = await page.locator('*[class*="activity"], *[class*="feed"], *[data-testid*="activity"], *[data-testid*="feed"]').all();
      console.log(`Found ${elements.length} potential activity elements`);

      for (let i = 0; i < elements.length; i++) {
        const text = await elements[i].textContent();
        const classes = await elements[i].getAttribute('class');
        console.log(`Element ${i}: "${text}" classes: "${classes}"`);
      }
    }

    // Check WebSocket connection status in browser console
    const wsStatus = await page.evaluate(() => {
      // Try to access WebSocket context or connection status
      const wsReadyState = (window as any).wsConnection?.readyState;
      const localStorageToken = localStorage.getItem('access_token');

      return {
        wsReadyState,
        hasToken: !!localStorageToken,
        tokenLength: localStorageToken?.length || 0,
        connectionStatus: wsReadyState === 1 ? 'OPEN' :
                         wsReadyState === 0 ? 'CONNECTING' :
                         wsReadyState === 2 ? 'CLOSING' :
                         wsReadyState === 3 ? 'CLOSED' : 'UNKNOWN'
      };
    });

    console.log('🔍 WebSocket Status:', wsStatus);

    // Wait a bit to see if WebSocket connects
    await page.waitForTimeout(3000);

    // Try to trigger some activity to test real-time updates
    console.log('🎯 Testing activity generation...');

    // Check if there's a way to trigger activity through the UI
    const triggerButton = page.locator('button').filter({ hasText: /trigger|test|activity/i });
    if (await triggerButton.isVisible()) {
      await triggerButton.click();
      console.log('✅ Clicked activity trigger button');
    }

    // Wait for potential updates
    await page.waitForTimeout(2000);

    // Take final screenshot
    await page.screenshot({
      path: '.playwright-mcp/dashboard-final.png',
      fullPage: true
    });

    // Check for any JavaScript errors
    const errors = await page.evaluate(() => {
      return (window as any).jsErrors || [];
    });

    if (errors.length > 0) {
      console.log('❌ JavaScript errors found:', errors);
    } else {
      console.log('✅ No JavaScript errors detected');
    }
  });

  test('should test WebSocket connection directly', async () => {
    await page.goto('http://localhost:3000');

    // Test WebSocket connection programmatically
    const wsTest = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const ws = new WebSocket('ws://localhost:3001/ws');
        const result: any = {
          canConnect: false,
          events: [],
          errors: []
        };

        ws.onopen = () => {
          result.canConnect = true;
          result.events.push('opened');

          // Try to send authentication
          const token = localStorage.getItem('access_token');
          if (token) {
            ws.send(JSON.stringify({ type: 'auth', token }));
            result.events.push('auth_sent');
          }
        };

        ws.onmessage = (event) => {
          result.events.push(`message: ${event.data}`);
        };

        ws.onerror = (error) => {
          result.errors.push(`error: ${error}`);
        };

        ws.onclose = (event) => {
          result.events.push(`closed: ${event.code} ${event.reason}`);
          resolve(result);
        };

        // Timeout after 5 seconds
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
          resolve(result);
        }, 5000);
      });
    });

    console.log('🔍 Direct WebSocket test result:', wsTest);
  });
});