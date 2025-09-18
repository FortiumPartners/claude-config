import { test, expect } from '@playwright/test';

test.describe('Authentication Flow Tests', () => {
  test.beforeEach(async ({ context }) => {
    // Clear any existing authentication state
    await context.clearCookies();
  });

  test('should redirect to login page when accessing protected route', async ({ page }) => {
    // Try to access the dashboard directly
    await page.goto('http://localhost:3000/dashboard');
    
    // Should be redirected to login page
    await expect(page).toHaveURL(/\/auth\/login/);
    
    // Verify login page elements are present
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")')).toBeVisible();
  });

  test('should successfully login with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/auth/login');
    
    // Fill in credentials (our mock backend accepts any email/password)
    await page.fill('input[type="email"], input[name="email"]', 'demo@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'password123');
    
    // Submit login form
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
    
    // Should be redirected to dashboard after successful login
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Verify we're now on the dashboard
    await expect(page.locator('h1, h2, [data-testid="dashboard-title"]')).toBeVisible({ timeout: 5000 });
  });

  test('should handle empty form submission gracefully', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login');
    
    // Try to submit empty form
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
    
    // Should stay on login page and show validation errors
    await expect(page).toHaveURL(/\/auth\/login/);
    
    // Check for validation messages or error states
    const errorMessage = page.locator('[role="alert"], .error, .text-red-500, .text-danger');
    const emailField = page.locator('input[type="email"], input[name="email"]');
    const passwordField = page.locator('input[type="password"], input[name="password"]');
    
    // At least one of these should be true: error message shown or fields have error state
    const hasValidation = await Promise.race([
      errorMessage.isVisible().catch(() => false),
      emailField.evaluate(el => el.checkValidity && !el.checkValidity()).catch(() => false),
      passwordField.evaluate(el => el.checkValidity && !el.checkValidity()).catch(() => false)
    ]);
    
    expect(hasValidation).toBeTruthy();
  });

  test('should display user information after login', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/auth/login');
    await page.fill('input[type="email"], input[name="email"]', 'demo@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'password123');
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
    
    // Wait for dashboard to load
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Look for user information in the UI (header, sidebar, profile area)
    const userInfo = page.locator('[data-testid="user-name"], .user-name, .username, .user-info');
    const userEmail = page.locator('[data-testid="user-email"], .user-email');
    const userMenuTrigger = page.locator('[data-testid="user-menu"], .user-menu, .profile-dropdown');
    
    // At least one should be visible
    const hasUserInfo = await Promise.race([
      userInfo.isVisible().catch(() => false),
      userEmail.isVisible().catch(() => false),
      userMenuTrigger.isVisible().catch(() => false)
    ]);
    
    expect(hasUserInfo).toBeTruthy();
  });

  test('should be able to navigate between dashboard pages after login', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/auth/login');
    await page.fill('input[type="email"], input[name="email"]', 'test@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'testpass');
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
    
    // Wait for dashboard to load
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Try to navigate to analytics page
    const analyticsLink = page.locator('a[href="/analytics"], a:has-text("Analytics"), nav a:has-text("Analytics")');
    if (await analyticsLink.isVisible()) {
      await analyticsLink.click();
      await expect(page).toHaveURL(/\/analytics/);
    }
    
    // Try to navigate to teams page
    const teamsLink = page.locator('a[href="/teams"], a:has-text("Teams"), nav a:has-text("Teams")');
    if (await teamsLink.isVisible()) {
      await teamsLink.click();
      await expect(page).toHaveURL(/\/teams/);
    }
    
    // Navigate back to dashboard
    const dashboardLink = page.locator('a[href="/dashboard"], a:has-text("Dashboard"), nav a:has-text("Dashboard")');
    if (await dashboardLink.isVisible()) {
      await dashboardLink.click();
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/auth/login');
    await page.fill('input[type="email"], input[name="email"]', 'admin@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'admin123');
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
    
    // Wait for dashboard to load
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
    
    // Look for logout button or user menu
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), [data-testid="logout-button"]');
    const userMenuTrigger = page.locator('[data-testid="user-menu"], .user-menu, .profile-dropdown');
    
    // Try direct logout button first
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else if (await userMenuTrigger.isVisible()) {
      // Click user menu and then logout
      await userMenuTrigger.click();
      await page.waitForTimeout(500);
      const logoutInMenu = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")');
      if (await logoutInMenu.isVisible()) {
        await logoutInMenu.click();
      }
    }
    
    // Should be redirected back to login page
    await expect(page).toHaveURL(/\/auth\/login/, { timeout: 10000 });
    
    // Verify we can't access protected routes after logout
    await page.goto('http://localhost:3000/dashboard');
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});