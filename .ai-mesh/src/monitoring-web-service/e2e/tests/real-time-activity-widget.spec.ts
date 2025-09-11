import { test, expect, Page } from '@playwright/test';

test.describe('Real-time Activity Widget E2E Tests', () => {
  // Test data and setup
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

  // Helper functions
  async function mockWebSocket(page: Page) {
    await page.addInitScript(() => {
      // Mock WebSocket for testing
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
          // Echo back activity updates for testing
          setTimeout(() => {
            const event = new MessageEvent('message', {
              data: JSON.stringify({
                type: 'activity_update',
                data: JSON.parse(data)
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

  async function mockAPIResponses(page: Page) {
    // Mock activity API responses
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

    // Mock WebSocket endpoint
    await page.route('**/ws/activities', async route => {
      await route.fulfill({
        status: 101,
        headers: { 'Connection': 'Upgrade', 'Upgrade': 'websocket' }
      });
    });
  }

  async function loginUser(page: Page) {
    // Mock authentication
    await page.route('**/api/v1/auth/login', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'mock-jwt-token',
          user: { id: '1', name: 'Test User', email: 'test@example.com' }
        })
      });
    });

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="login-button"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard');
  }

  test.beforeEach(async ({ page }) => {
    await mockWebSocket(page);
    await mockAPIResponses(page);
    await loginUser(page);
  });

  test('should display widget with correct header and live indicator', async ({ page }) => {
    // Wait for widget to be visible
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    // Check header elements
    await expect(page.locator('h3:has-text("Real-time Activity")')).toBeVisible();
    await expect(page.locator('text=Live updates')).toBeVisible();
    
    // Check live connection indicator (green dot)
    const liveIndicator = page.locator('.bg-green-500.rounded-full.animate-pulse');
    await expect(liveIndicator).toBeVisible();
  });

  test('should load and display activity items', async ({ page }) => {
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    // Wait for activities to load
    await page.waitForTimeout(1000);

    // Check that activity items are displayed
    const activityItems = page.locator('[role="button"][aria-label*="View details"]');
    await expect(activityItems).toHaveCount(4);

    // Check first activity item content
    const firstActivity = activityItems.first();
    await expect(firstActivity).toContainText('John Doe');
    await expect(firstActivity).toContainText('edited');
    await expect(firstActivity).toContainText('src/components/Button.tsx');
    
    // Check status icons
    await expect(page.locator('[aria-label="Success"]')).toBeVisible();
    await expect(page.locator('[aria-label="In Progress"]')).toBeVisible();
    await expect(page.locator('[aria-label="Error"]')).toBeVisible();
  });

  test('should display user avatars and initials correctly', async ({ page }) => {
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    await page.waitForTimeout(1000);

    // Check avatar image for Jane Smith
    const avatarImg = page.locator('img[alt="Jane Smith"]');
    await expect(avatarImg).toBeVisible();
    await expect(avatarImg).toHaveAttribute('src', /dicebear/);

    // Check initials for users without avatars
    await expect(page.locator('text=JD').first()).toBeVisible(); // John Doe
    await expect(page.locator('text=BJ')).toBeVisible(); // Bob Johnson
    await expect(page.locator('text=AB')).toBeVisible(); // Alice Brown
  });

  test('should show activity stats when enabled', async ({ page }) => {
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    // Check stats section
    const statsSection = page.locator('.bg-slate-100.dark\\:bg-slate-700.rounded-lg');
    await expect(statsSection).toBeVisible();

    // Check success rate (should be 50% - 2 success out of 4 total)
    await expect(page.locator('text=50%')).toBeVisible();
    
    // Check total count
    await expect(page.locator('.text-slate-500:has-text("4")')).toBeVisible();
    
    // Check automated count (2 automated activities)
    await expect(page.locator('.text-blue-600:has-text("2")')).toBeVisible();
  });

  test('should handle activity filtering', async ({ page }) => {
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    // Click filter button
    const filterButton = page.locator('[aria-label="Toggle filters"]');
    await filterButton.click();

    // Wait for filter panel to appear
    const filterPanel = page.locator('[data-testid="activity-filter-panel"]');
    await expect(filterPanel).toBeVisible();

    // Test status filter
    await page.click('[data-testid="status-filter-success"]');
    await page.waitForTimeout(500);

    // Should only show success activities (2 items)
    const activityItems = page.locator('[role="button"][aria-label*="View details"]');
    await expect(activityItems).toHaveCount(2);

    // Test user filter
    await page.selectOption('[data-testid="user-filter"]', 'John Doe');
    await page.waitForTimeout(500);

    // Should only show John Doe's activities (1 item)
    await expect(activityItems).toHaveCount(1);
    await expect(page.locator('text=John Doe')).toBeVisible();

    // Clear filters
    await page.click('[data-testid="clear-filters-button"]');
    await page.waitForTimeout(500);

    // Should show all activities again
    await expect(activityItems).toHaveCount(4);
  });

  test('should open activity detail modal on click', async ({ page }) => {
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    await page.waitForTimeout(1000);

    // Click on first activity
    const firstActivity = page.locator('[role="button"][aria-label*="View details"]').first();
    await firstActivity.click();

    // Check modal opens
    const modal = page.locator('[data-testid="activity-detail-modal"]');
    await expect(modal).toBeVisible();

    // Check modal content
    await expect(modal).toContainText('John Doe');
    await expect(modal).toContainText('edited');
    await expect(modal).toContainText('src/components/Button.tsx');
    await expect(modal).toContainText('1.25s'); // Duration formatting

    // Close modal
    const closeButton = page.locator('[data-testid="modal-close-button"]');
    await closeButton.click();
    
    await expect(modal).toBeHidden();
  });

  test('should handle refresh functionality', async ({ page }) => {
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    // Click refresh button
    const refreshButton = page.locator('[aria-label="Refresh activities"]');
    await refreshButton.click();

    // Check loading spinner appears
    const spinner = page.locator('.animate-spin');
    await expect(spinner).toBeVisible();

    // Wait for refresh to complete
    await page.waitForTimeout(1000);
    await expect(spinner).toBeHidden();

    // Activities should still be visible
    const activityItems = page.locator('[role="button"][aria-label*="View details"]');
    await expect(activityItems).toHaveCount(4);
  });

  test('should show priority indicators for high/critical items', async ({ page }) => {
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    await page.waitForTimeout(1000);

    // Check high priority badge for Bob Johnson's code review
    const highPriorityBadge = page.locator('.text-orange-600:has-text("high")');
    await expect(highPriorityBadge).toBeVisible();

    // Check critical priority badge for Alice Brown's deployment
    const criticalPriorityBadge = page.locator('.text-red-600:has-text("critical")');
    await expect(criticalPriorityBadge).toBeVisible();
  });

  test('should display automated activity indicators', async ({ page }) => {
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    await page.waitForTimeout(1000);

    // Check for automation indicators (Zap icons)
    const automationIcons = page.locator('[title="Automated"]');
    await expect(automationIcons).toHaveCount(2); // Jane's test and Alice's deployment
  });

  test('should handle WebSocket real-time updates', async ({ page }) => {
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    await page.waitForTimeout(1000);

    // Simulate new activity via WebSocket
    await page.evaluate(() => {
      const ws = new WebSocket('ws://localhost:3001/ws/activities');
      ws.onopen = () => {
        ws.send(JSON.stringify({
          type: 'new_activity',
          data: {
            id: '5',
            user: { name: 'Real Time User', avatar_url: null },
            action: { name: 'websocket_test', description: 'tested' },
            target: { name: 'WebSocket Connection' },
            status: 'success',
            timestamp: new Date().toISOString(),
            duration_ms: 500,
            is_automated: false,
            priority: 'normal'
          }
        }));
      };
    });

    // Wait for update counter to increment
    await page.waitForTimeout(1500);
    
    // Check that update count is displayed
    await expect(page.locator('text=/\\d+ updates/')).toBeVisible();
  });

  test('should be responsive on different viewport sizes', async ({ page }) => {
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(widget).toBeVisible();
    
    // In compact view, some elements should be hidden or modified
    await page.waitForTimeout(500);

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(widget).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(widget).toBeVisible();
  });

  test('should handle error states gracefully', async ({ page }) => {
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

    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    // Check error state
    await expect(page.locator('text=Error loading activities')).toBeVisible();
    await expect(page.locator('text=Failed to fetch activities')).toBeVisible();

    // Check try again button
    const tryAgainButton = page.locator('text=Try Again');
    await expect(tryAgainButton).toBeVisible();
    await tryAgainButton.click();
  });

  test('should handle empty state correctly', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/v1/activities*', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [],
          total: 0,
          page: 1,
          limit: 20
        })
      });
    });

    await page.reload();

    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    // Check empty state
    await expect(page.locator('text=No recent activity')).toBeVisible();
  });

  test('should pass accessibility audit', async ({ page }) => {
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    await page.waitForTimeout(1000);

    // Inject axe-core for accessibility testing
    await page.addScriptTag({ url: 'https://unpkg.com/axe-core@4.7.2/axe.min.js' });
    
    // Run accessibility audit
    const violations = await page.evaluate(() => {
      return new Promise((resolve) => {
        // @ts-ignore
        window.axe.run(document, (err: any, results: any) => {
          if (err) throw err;
          resolve(results.violations);
        });
      });
    });

    // Check for critical accessibility violations
    expect(violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    await page.waitForTimeout(1000);

    // Tab through activities
    await page.keyboard.press('Tab');
    const firstActivity = page.locator('[role="button"][aria-label*="View details"]').first();
    await expect(firstActivity).toBeFocused();

    // Press Enter to open modal
    await page.keyboard.press('Enter');
    const modal = page.locator('[data-testid="activity-detail-modal"]');
    await expect(modal).toBeVisible();

    // Press Escape to close modal
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('should handle performance with large datasets', async ({ page }) => {
    // Mock large dataset (1000 items)
    const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
      id: `large-${i}`,
      user: { name: `User ${i}`, avatar_url: null },
      action: { name: 'performance_test', description: 'tested performance with' },
      target: { name: `file-${i}.ts` },
      status: i % 3 === 0 ? 'success' : i % 3 === 1 ? 'error' : 'in_progress',
      timestamp: new Date(Date.now() - i * 1000).toISOString(),
      duration_ms: Math.floor(Math.random() * 5000),
      is_automated: i % 2 === 0,
      priority: i % 10 === 0 ? 'high' : 'normal'
    }));

    await page.route('**/api/v1/activities*', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: largeDataset.slice(0, 20), // Only show first 20 per page
          total: largeDataset.length,
          page: 1,
          limit: 20
        })
      });
    });

    // Measure page load time
    const startTime = Date.now();
    await page.reload();

    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    // Wait for activities to render
    await page.waitForTimeout(1000);
    const loadTime = Date.now() - startTime;

    // Should load within reasonable time (under 3 seconds)
    expect(loadTime).toBeLessThan(3000);

    // Should still show limited number of items (20)
    const activityItems = page.locator('[role="button"][aria-label*="View details"]');
    await expect(activityItems).toHaveCount(20);

    // Should show correct total count
    await expect(page.locator('text=1000')).toBeVisible();
  });

  test('should handle expand widget functionality', async ({ page }) => {
    const widget = page.locator('[data-testid="real-time-activity-widget"]').first();
    await expect(widget).toBeVisible();

    // Click expand button
    const expandButton = page.locator('[aria-label="Expand widget"]');
    await expect(expandButton).toBeVisible();
    await expandButton.click();

    // Should trigger expand functionality (implementation dependent)
    // This test validates the button exists and is clickable
  });
});