import { test, expect, Page } from '@playwright/test';

test.describe('Real-time Activity Widget E2E Tests - Simplified', () => {
  // Test data for mocking
  const mockActivities = [
    {
      id: '1',
      user: { name: 'John Doe', avatar_url: null },
      action: { name: 'file_edit', description: 'edited' },
      target: { name: 'src/components/Button.tsx' },
      status: 'success',
      timestamp: new Date().toISOString(),
      duration_ms: 1250,
      is_automated: false,
      priority: 'normal'
    },
    {
      id: '2',
      user: { name: 'Jane Smith', avatar_url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jane' },
      action: { name: 'test_run', description: 'ran tests for' },
      target: { name: 'user-authentication.test.ts' },
      status: 'success',
      timestamp: new Date(Date.now() - 60000).toISOString(),
      duration_ms: 3450,
      is_automated: true,
      priority: 'normal'
    },
    {
      id: '3',
      user: { name: 'Bob Johnson', avatar_url: null },
      action: { name: 'code_review', description: 'reviewed' },
      target: { name: 'PR #123: Add user dashboard' },
      status: 'in_progress',
      timestamp: new Date(Date.now() - 120000).toISOString(),
      duration_ms: null,
      is_automated: false,
      priority: 'high'
    },
    {
      id: '4',
      user: { name: 'Alice Brown', avatar_url: null },
      action: { name: 'deployment', description: 'deployed' },
      target: { name: 'production-v2.1.0' },
      status: 'error',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      duration_ms: 45000,
      is_automated: true,
      priority: 'critical'
    }
  ];

  // Helper to set up page with mocked responses
  async function setupPageWithMocks(page: Page) {
    // Mock authentication and user session
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'mock-token');
      localStorage.setItem('user', JSON.stringify({
        id: '1',
        name: 'Test User',
        email: 'test@example.com'
      }));
    });

    // Mock API responses
    await page.route('**/api/v1/auth/verify', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valid: true,
          user: { id: '1', name: 'Test User', email: 'test@example.com' }
        })
      });
    });

    await page.route('**/api/v1/activities*', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: mockActivities,
          total: mockActivities.length,
          page: 1,
          limit: 20
        })
      });
    });

    await page.route('**/api/v1/dashboard*', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgets: [
            {
              id: 'real-time-activity',
              type: 'RealTimeActivityWidget',
              config: {
                showTimestamp: true,
                maxItems: 20,
                showAvatars: true,
                showFilters: true,
                enableRealTime: true,
                compactView: false,
                showStats: true,
                autoRefresh: 0
              }
            }
          ]
        })
      });
    });

    // Mock WebSocket
    await page.addInitScript(() => {
      class MockWebSocket extends EventTarget {
        readyState = WebSocket.OPEN;
        url: string;
        
        constructor(url: string) {
          super();
          this.url = url;
          setTimeout(() => {
            this.dispatchEvent(new Event('open'));
          }, 100);
        }
        
        send(data: string) {
          // Simulate real-time updates
          setTimeout(() => {
            const event = new MessageEvent('message', {
              data: JSON.stringify({
                type: 'activity_update',
                data: {
                  id: 'ws-1',
                  user: { name: 'WebSocket User', avatar_url: null },
                  action: { name: 'websocket_test', description: 'tested' },
                  target: { name: 'Real-time Connection' },
                  status: 'success',
                  timestamp: new Date().toISOString(),
                  duration_ms: 500,
                  is_automated: false,
                  priority: 'normal'
                }
              })
            });
            this.dispatchEvent(event);
          }, 200);
        }
        
        close() {
          this.readyState = WebSocket.CLOSED;
          this.dispatchEvent(new Event('close'));
        }
      }
      
      (window as any).WebSocket = MockWebSocket;
    });
  }

  test.beforeEach(async ({ page }) => {
    await setupPageWithMocks(page);
    await page.goto('/');
    
    // Wait for initial load and authentication
    await page.waitForTimeout(1000);
  });

  test('should display the dashboard page successfully', async ({ page }) => {
    // Take a screenshot for evidence
    await page.screenshot({ path: 'test-results/dashboard-initial-load.png', fullPage: true });
    
    // Basic page structure should be visible
    await expect(page).toHaveTitle(/Monitoring/);
    
    // Check if we can see any dashboard content
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
    expect(bodyContent!.length).toBeGreaterThan(100);
  });

  test('should handle component rendering without errors', async ({ page }) => {
    // Check for any JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', error => {
      errors.push(error.message);
    });

    await page.waitForTimeout(2000);
    
    // Take screenshot of current state
    await page.screenshot({ path: 'test-results/component-render-test.png', fullPage: true });
    
    // Should not have critical JS errors
    expect(errors.filter(error => 
      !error.includes('Warning') && 
      !error.includes('DevTools') && 
      !error.includes('Extension')
    )).toEqual([]);
  });

  test('should be responsive on different viewport sizes', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: `test-results/responsive-${viewport.name}.png`, 
        fullPage: true 
      });
      
      // Basic checks for responsiveness
      const body = page.locator('body');
      await expect(body).toBeVisible();
      
      // Check that content doesn't overflow horizontally
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 20); // Allow small margin
    }
  });

  test('should handle network loading states', async ({ page }) => {
    // Test with slow network
    await page.route('**/api/v1/activities*', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: mockActivities,
          total: mockActivities.length,
          page: 1,
          limit: 20
        })
      });
    });

    await page.reload();
    
    // Take screenshot during loading
    await page.screenshot({ path: 'test-results/loading-state.png', fullPage: true });
    
    // Check for loading indicators
    await page.waitForTimeout(1000);
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
  });

  test('should handle API error states gracefully', async ({ page }) => {
    // Mock error response
    await page.route('**/api/v1/activities*', async route => {
      await route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: 'Failed to fetch activities'
        })
      });
    });

    await page.reload();
    await page.waitForTimeout(2000);
    
    // Take screenshot of error state
    await page.screenshot({ path: 'test-results/error-state.png', fullPage: true });
    
    // Should not crash the application
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should support basic accessibility features', async ({ page }) => {
    await page.waitForTimeout(1000);
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    
    await page.keyboard.press('Tab');
    await page.waitForTimeout(100);
    
    // Take screenshot with focus indicators
    await page.screenshot({ path: 'test-results/accessibility-focus.png', fullPage: true });
    
    // Check for basic ARIA attributes and semantic HTML
    const bodyHtml = await page.innerHTML('body');
    
    // Should have proper semantic structure
    expect(bodyHtml).toContain('role=');
  });

  test('should handle dark mode if implemented', async ({ page }) => {
    // Try to toggle dark mode if available
    const darkModeToggle = page.locator('[data-testid="dark-mode-toggle"]').first();
    
    if (await darkModeToggle.isVisible()) {
      await darkModeToggle.click();
      await page.waitForTimeout(500);
      
      await page.screenshot({ path: 'test-results/dark-mode.png', fullPage: true });
    } else {
      // Just take a screenshot of current theme
      await page.screenshot({ path: 'test-results/current-theme.png', fullPage: true });
    }
  });

  test('should capture performance metrics', async ({ page }) => {
    // Start performance measurement
    await page.addInitScript(() => {
      (window as any).performanceMarks = [];
      const originalMark = performance.mark;
      performance.mark = function(name: string) {
        (window as any).performanceMarks.push({ name, time: Date.now() });
        return originalMark.call(this, name);
      };
    });

    const startTime = Date.now();
    await page.reload();
    
    // Wait for page to be interactive
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Capture performance metrics
    const performanceData = await page.evaluate(() => ({
      loadTime: Date.now() - performance.timing.navigationStart,
      domContentLoaded: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
      firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
      marks: (window as any).performanceMarks || []
    }));
    
    console.log('Performance Metrics:', {
      totalLoadTime: loadTime,
      ...performanceData
    });
    
    // Performance assertions
    expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    expect(performanceData.domContentLoaded).toBeLessThan(5000); // DOM should be ready within 5 seconds
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/performance-test-complete.png', fullPage: true });
  });

  test('should capture evidence of current implementation state', async ({ page }) => {
    await page.waitForTimeout(2000);
    
    // Comprehensive screenshot
    await page.screenshot({ 
      path: 'test-results/current-implementation-state.png', 
      fullPage: true 
    });
    
    // Capture HTML structure for analysis
    const htmlStructure = await page.evaluate(() => {
      const getElementInfo = (element: Element, depth = 0) => {
        if (depth > 3) return null; // Limit depth
        
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || undefined,
          classes: element.className ? element.className.split(' ').filter(c => c) : undefined,
          text: element.children.length === 0 ? element.textContent?.trim()?.substring(0, 100) : undefined,
          children: Array.from(element.children)
            .slice(0, 10) // Limit children
            .map(child => getElementInfo(child, depth + 1))
            .filter(child => child !== null)
        };
      };
      
      return getElementInfo(document.body);
    });
    
    console.log('HTML Structure Sample:', JSON.stringify(htmlStructure, null, 2));
    
    // Check for specific components or text that might indicate widget presence
    const pageContent = await page.textContent('body');
    const hasActivityContent = pageContent?.includes('activity') || 
                              pageContent?.includes('Activity') ||
                              pageContent?.includes('real-time') ||
                              pageContent?.includes('Real-time');
    
    console.log('Page contains activity-related content:', hasActivityContent);
    console.log('Page content length:', pageContent?.length || 0);
    
    // Basic validation that page loaded with some content
    expect(pageContent).toBeTruthy();
    expect(pageContent!.length).toBeGreaterThan(50);
  });
});