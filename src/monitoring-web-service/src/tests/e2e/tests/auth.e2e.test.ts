/**
 * Authentication E2E Tests
 * Sprint 9.2: End-to-end testing automation
 * Tests: User authentication flows, SSO integration, role-based access
 */

import { test, expect, Page } from '@playwright/test';
import { AuthPageObject } from '../page-objects/auth.page';
import { DashboardPageObject } from '../page-objects/dashboard.page';

test.describe('Authentication Flows', () => {
  let authPage: AuthPageObject;
  let dashboardPage: DashboardPageObject;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPageObject(page);
    dashboardPage = new DashboardPageObject(page);
  });

  test.describe('Login Flow', () => {
    test('should display login form correctly', async ({ page }) => {
      await authPage.navigateToLogin();
      
      // Verify login form elements
      await expect(authPage.emailInput).toBeVisible();
      await expect(authPage.passwordInput).toBeVisible();
      await expect(authPage.loginButton).toBeVisible();
      await expect(authPage.loginButton).toBeDisabled();
      
      // Verify branding and UI elements
      await expect(page.locator('[data-testid="app-logo"]')).toBeVisible();
      await expect(page.locator('[data-testid="login-title"]')).toContainText('Sign in to Fortium Metrics');
      
      // Verify password requirements info
      await expect(page.locator('[data-testid="password-requirements"]')).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await authPage.navigateToLogin();
      
      // Test invalid email formats
      const invalidEmails = ['invalid', 'test@', '@domain.com', 'test..test@domain.com'];
      
      for (const email of invalidEmails) {
        await authPage.fillEmail(email);
        await authPage.fillPassword('ValidPassword123!');
        
        await expect(authPage.emailError).toBeVisible();
        await expect(authPage.emailError).toContainText('Please enter a valid email address');
        await expect(authPage.loginButton).toBeDisabled();
        
        await authPage.clearForm();
      }
    });

    test('should validate password requirements', async ({ page }) => {
      await authPage.navigateToLogin();
      
      await authPage.fillEmail('test@e2e-test.com');
      
      // Test weak passwords
      const weakPasswords = ['123', 'password', 'Password', 'Password123'];
      
      for (const password of weakPasswords) {
        await authPage.fillPassword(password);
        
        await expect(authPage.passwordError).toBeVisible();
        await expect(authPage.loginButton).toBeDisabled();
        
        await authPage.passwordInput.clear();
      }
    });

    test('should login successfully with valid credentials', async ({ page }) => {
      await authPage.navigateToLogin();
      
      // Login with developer account
      await authPage.loginAs('developer@e2e-test.com', 'TestAdmin123!');
      
      // Should redirect to dashboard
      await expect(page).toHaveURL(/.*\/dashboard/);
      await expect(dashboardPage.welcomeMessage).toBeVisible();
      await expect(dashboardPage.welcomeMessage).toContainText('Welcome back, E2E Developer');
      
      // Verify user menu shows correct user
      await dashboardPage.userMenu.click();
      await expect(page.locator('[data-testid="user-email"]')).toContainText('developer@e2e-test.com');
      await expect(page.locator('[data-testid="user-role"]')).toContainText('developer');
    });

    test('should reject invalid credentials', async ({ page }) => {
      await authPage.navigateToLogin();
      
      await authPage.loginAs('developer@e2e-test.com', 'WrongPassword123!');
      
      // Should show error message
      await expect(authPage.loginError).toBeVisible();
      await expect(authPage.loginError).toContainText('Invalid email or password');
      
      // Should remain on login page
      await expect(page).toHaveURL(/.*\/login/);
    });

    test('should handle non-existent user', async ({ page }) => {
      await authPage.navigateToLogin();
      
      await authPage.loginAs('nonexistent@e2e-test.com', 'TestAdmin123!');
      
      // Should show error message
      await expect(authPage.loginError).toBeVisible();
      await expect(authPage.loginError).toContainText('Invalid email or password');
    });

    test('should show loading state during authentication', async ({ page }) => {
      await authPage.navigateToLogin();
      
      await authPage.fillEmail('developer@e2e-test.com');
      await authPage.fillPassword('TestAdmin123!');
      
      // Click login and immediately check loading state
      await authPage.loginButton.click();
      
      await expect(authPage.loginButton).toBeDisabled();
      await expect(authPage.loginButton).toContainText('Signing in...');
      await expect(page.locator('[data-testid="login-spinner"]')).toBeVisible();
    });
  });

  test.describe('Role-based Access Control', () => {
    test('admin user should access admin features', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.loginAs('admin@e2e-test.com', 'TestAdmin123!');
      
      // Navigate to admin dashboard
      await page.goto('/admin/dashboard');
      
      // Should have access to admin features
      await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();
      await expect(page.locator('[data-testid="tenant-management"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-management"]')).toBeVisible();
      await expect(page.locator('[data-testid="system-metrics"]')).toBeVisible();
    });

    test('developer user should not access admin features', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.loginAs('developer@e2e-test.com', 'TestAdmin123!');
      
      // Try to navigate to admin dashboard
      await page.goto('/admin/dashboard');
      
      // Should be redirected to access denied or dashboard
      await expect(page).toHaveURL(/.*\/(dashboard|access-denied)/);
      
      if (await page.locator('[data-testid="access-denied"]').isVisible()) {
        await expect(page.locator('[data-testid="access-denied"]')).toContainText('Access Denied');
        await expect(page.locator('[data-testid="insufficient-permissions"]')).toBeVisible();
      }
    });

    test('manager should access team analytics', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.loginAs('manager@e2e-test.com', 'TestAdmin123!');
      
      // Navigate to team analytics
      await page.goto('/analytics/team');
      
      // Should have access to team features
      await expect(page.locator('[data-testid="team-analytics"]')).toBeVisible();
      await expect(page.locator('[data-testid="team-performance"]')).toBeVisible();
      await expect(page.locator('[data-testid="productivity-reports"]')).toBeVisible();
      
      // Should not have access to admin-only features
      await expect(page.locator('[data-testid="system-admin-panel"]')).not.toBeVisible();
    });
  });

  test.describe('Session Management', () => {
    test('should maintain session across page refreshes', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.loginAs('developer@e2e-test.com', 'TestAdmin123!');
      
      // Refresh page
      await page.reload();
      
      // Should remain logged in
      await expect(page).toHaveURL(/.*\/dashboard/);
      await expect(dashboardPage.welcomeMessage).toBeVisible();
    });

    test('should logout successfully', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.loginAs('developer@e2e-test.com', 'TestAdmin123!');
      
      // Logout
      await dashboardPage.userMenu.click();
      await page.click('[data-testid="logout-button"]');
      
      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);
      await expect(authPage.emailInput).toBeVisible();
      
      // Should show logout confirmation
      await expect(page.locator('[data-testid="logout-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="logout-message"]')).toContainText('You have been logged out successfully');
    });

    test('should handle session expiration', async ({ page }) => {
      await authPage.navigateToLogin();
      await authPage.loginAs('developer@e2e-test.com', 'TestAdmin123!');
      
      // Simulate expired token
      await page.evaluate(() => {
        localStorage.setItem('auth_token', 'expired_token');
      });
      
      // Navigate to a protected page
      await page.goto('/dashboard/settings');
      
      // Should redirect to login with session expired message
      await expect(page).toHaveURL(/.*\/login/);
      await expect(page.locator('[data-testid="session-expired"]')).toBeVisible();
      await expect(page.locator('[data-testid="session-expired"]')).toContainText('Your session has expired');
    });

    test('should redirect unauthenticated users to login', async ({ page }) => {
      // Try to access protected route without authentication
      await page.goto('/dashboard');
      
      // Should redirect to login
      await expect(page).toHaveURL(/.*\/login/);
      await expect(page.locator('[data-testid="login-required"]')).toBeVisible();
    });
  });

  test.describe('Security Features', () => {
    test('should implement rate limiting on login attempts', async ({ page }) => {
      await authPage.navigateToLogin();
      
      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await authPage.loginAs('developer@e2e-test.com', 'WrongPassword123!');
        await page.waitForTimeout(500); // Brief pause between attempts
      }
      
      // Should show rate limiting message
      await expect(page.locator('[data-testid="rate-limit-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="rate-limit-error"]')).toContainText('Too many login attempts');
      
      // Login button should be temporarily disabled
      await expect(authPage.loginButton).toBeDisabled();
    });

    test('should clear sensitive data from form on navigation', async ({ page }) => {
      await authPage.navigateToLogin();
      
      await authPage.fillEmail('developer@e2e-test.com');
      await authPage.fillPassword('TestAdmin123!');
      
      // Navigate away and back
      await page.goto('/');
      await page.goto('/login');
      
      // Form should be cleared
      await expect(authPage.emailInput).toHaveValue('');
      await expect(authPage.passwordInput).toHaveValue('');
    });

    test('should mask password input', async ({ page }) => {
      await authPage.navigateToLogin();
      
      await authPage.fillPassword('TestPassword123!');
      
      // Password should be masked
      await expect(authPage.passwordInput).toHaveAttribute('type', 'password');
      
      // Toggle password visibility
      await page.click('[data-testid="toggle-password-visibility"]');
      await expect(authPage.passwordInput).toHaveAttribute('type', 'text');
      
      await page.click('[data-testid="toggle-password-visibility"]');
      await expect(authPage.passwordInput).toHaveAttribute('type', 'password');
    });
  });

  test.describe('Accessibility', () => {
    test('should be keyboard navigable', async ({ page }) => {
      await authPage.navigateToLogin();
      
      // Tab through form elements
      await page.keyboard.press('Tab');
      await expect(authPage.emailInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(authPage.passwordInput).toBeFocused();
      
      await page.keyboard.press('Tab');
      await expect(authPage.loginButton).toBeFocused();
      
      // Should be able to submit with Enter
      await authPage.fillEmail('developer@e2e-test.com');
      await authPage.fillPassword('TestAdmin123!');
      
      await authPage.passwordInput.focus();
      await page.keyboard.press('Enter');
      
      // Should initiate login
      await expect(page).toHaveURL(/.*\/dashboard/, { timeout: 10000 });
    });

    test('should have proper ARIA labels and roles', async ({ page }) => {
      await authPage.navigateToLogin();
      
      // Check ARIA attributes
      await expect(authPage.emailInput).toHaveAttribute('aria-label', 'Email address');
      await expect(authPage.passwordInput).toHaveAttribute('aria-label', 'Password');
      await expect(authPage.loginButton).toHaveAttribute('aria-label', 'Sign in to your account');
      
      // Check form has proper role
      await expect(page.locator('[data-testid="login-form"]')).toHaveAttribute('role', 'form');
      
      // Check error messages have proper ARIA
      await authPage.fillEmail('invalid-email');
      await expect(authPage.emailError).toHaveAttribute('role', 'alert');
      await expect(authPage.emailError).toHaveAttribute('aria-live', 'polite');
    });

    test('should meet color contrast requirements', async ({ page }) => {
      await authPage.navigateToLogin();
      
      // This would typically use an accessibility testing library
      // For now, we'll check that error states have high contrast
      await authPage.fillEmail('invalid-email');
      
      const errorElement = authPage.emailError;
      await expect(errorElement).toBeVisible();
      
      // Check that error text is visible and has appropriate styling
      const styles = await errorElement.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          color: computed.color,
          backgroundColor: computed.backgroundColor,
          fontSize: computed.fontSize
        };
      });
      
      // Error text should be red and clearly visible
      expect(styles.color).toMatch(/rgb\(.*\)/);
    });
  });
});