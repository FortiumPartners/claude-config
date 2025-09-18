/**
 * Authentication Page Object
 * Sprint 9.2: End-to-end testing automation
 * Encapsulates authentication page interactions and elements
 */

import { Page, Locator, expect } from '@playwright/test';

export class AuthPageObject {
  readonly page: Page;
  
  // Form elements
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly signUpLink: Locator;
  
  // Error elements
  readonly emailError: Locator;
  readonly passwordError: Locator;
  readonly loginError: Locator;
  
  // SSO elements
  readonly googleSsoButton: Locator;
  readonly microsoftSsoButton: Locator;
  readonly oktaSsoButton: Locator;
  
  // Utility elements
  readonly passwordToggle: Locator;
  readonly rememberMeCheckbox: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Form elements
    this.emailInput = page.locator('[data-testid="email-input"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.loginButton = page.locator('[data-testid="login-submit"]');
    this.forgotPasswordLink = page.locator('[data-testid="forgot-password-link"]');
    this.signUpLink = page.locator('[data-testid="signup-link"]');
    
    // Error elements
    this.emailError = page.locator('[data-testid="email-error"]');
    this.passwordError = page.locator('[data-testid="password-error"]');
    this.loginError = page.locator('[data-testid="login-error"]');
    
    // SSO elements
    this.googleSsoButton = page.locator('[data-testid="google-sso-button"]');
    this.microsoftSsoButton = page.locator('[data-testid="microsoft-sso-button"]');
    this.oktaSsoButton = page.locator('[data-testid="okta-sso-button"]');
    
    // Utility elements
    this.passwordToggle = page.locator('[data-testid="toggle-password-visibility"]');
    this.rememberMeCheckbox = page.locator('[data-testid="remember-me-checkbox"]');
    this.loadingSpinner = page.locator('[data-testid="login-spinner"]');
  }

  /**
   * Navigate to login page
   */
  async navigateToLogin() {
    await this.page.goto('/login');
    await this.page.waitForLoadState('networkidle');
    
    // Wait for login form to be visible
    await expect(this.emailInput).toBeVisible();
  }

  /**
   * Fill email field
   */
  async fillEmail(email: string) {
    await this.emailInput.clear();
    await this.emailInput.fill(email);
    await this.page.waitForTimeout(100); // Allow validation to run
  }

  /**
   * Fill password field
   */
  async fillPassword(password: string) {
    await this.passwordInput.clear();
    await this.passwordInput.fill(password);
    await this.page.waitForTimeout(100); // Allow validation to run
  }

  /**
   * Clear the entire login form
   */
  async clearForm() {
    await this.emailInput.clear();
    await this.passwordInput.clear();
  }

  /**
   * Perform login with email and password
   */
  async loginAs(email: string, password: string) {
    await this.fillEmail(email);
    await this.fillPassword(password);
    
    // Wait for form validation
    await this.page.waitForTimeout(500);
    
    // Submit form
    await this.loginButton.click();
    
    // Wait for navigation or error
    await Promise.race([
      this.page.waitForURL(/.*\/dashboard/, { timeout: 10000 }),
      this.loginError.waitFor({ state: 'visible', timeout: 5000 })
    ]);
  }

  /**
   * Perform SSO login
   */
  async loginWithSSO(provider: 'google' | 'microsoft' | 'okta') {
    const button = {
      google: this.googleSsoButton,
      microsoft: this.microsoftSsoButton,
      okta: this.oktaSsoButton
    }[provider];

    await button.click();
    
    // Handle SSO popup/redirect
    // This would typically involve handling external authentication flows
    // For E2E tests, we might mock the SSO response
  }

  /**
   * Toggle password visibility
   */
  async togglePasswordVisibility() {
    await this.passwordToggle.click();
  }

  /**
   * Check remember me option
   */
  async checkRememberMe() {
    if (await this.rememberMeCheckbox.isVisible()) {
      await this.rememberMeCheckbox.check();
    }
  }

  /**
   * Wait for login to complete
   */
  async waitForLogin() {
    await this.page.waitForURL(/.*\/dashboard/, { timeout: 15000 });
  }

  /**
   * Wait for login error
   */
  async waitForLoginError() {
    await this.loginError.waitFor({ state: 'visible', timeout: 5000 });
  }

  /**
   * Check if login form is valid
   */
  async isFormValid(): Promise<boolean> {
    const emailValue = await this.emailInput.inputValue();
    const passwordValue = await this.passwordInput.inputValue();
    const isButtonEnabled = await this.loginButton.isEnabled();
    
    return emailValue.length > 0 && passwordValue.length > 0 && isButtonEnabled;
  }

  /**
   * Get current validation errors
   */
  async getValidationErrors(): Promise<string[]> {
    const errors: string[] = [];
    
    if (await this.emailError.isVisible()) {
      errors.push(await this.emailError.textContent() || '');
    }
    
    if (await this.passwordError.isVisible()) {
      errors.push(await this.passwordError.textContent() || '');
    }
    
    if (await this.loginError.isVisible()) {
      errors.push(await this.loginError.textContent() || '');
    }
    
    return errors;
  }

  /**
   * Check if login is in progress
   */
  async isLoading(): Promise<boolean> {
    return await this.loadingSpinner.isVisible() && await this.loginButton.isDisabled();
  }

  /**
   * Navigate to forgot password page
   */
  async navigateToForgotPassword() {
    await this.forgotPasswordLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Navigate to sign up page
   */
  async navigateToSignUp() {
    await this.signUpLink.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Check accessibility features
   */
  async checkAccessibility() {
    // Verify ARIA labels
    await expect(this.emailInput).toHaveAttribute('aria-label');
    await expect(this.passwordInput).toHaveAttribute('aria-label');
    
    // Verify form has proper role
    const form = this.page.locator('[data-testid="login-form"]');
    await expect(form).toHaveAttribute('role', 'form');
    
    // Verify error messages have ARIA live regions
    if (await this.emailError.isVisible()) {
      await expect(this.emailError).toHaveAttribute('role', 'alert');
    }
  }

  /**
   * Test keyboard navigation
   */
  async testKeyboardNavigation() {
    // Focus email input
    await this.emailInput.focus();
    await expect(this.emailInput).toBeFocused();
    
    // Tab to password
    await this.page.keyboard.press('Tab');
    await expect(this.passwordInput).toBeFocused();
    
    // Tab to login button
    await this.page.keyboard.press('Tab');
    await expect(this.loginButton).toBeFocused();
    
    // Test Enter key submission
    await this.emailInput.focus();
    await this.fillEmail('test@example.com');
    await this.fillPassword('password123');
    
    await this.page.keyboard.press('Enter');
    
    // Should trigger form submission
    await this.waitForLoginError(); // or waitForLogin() depending on credentials
  }

  /**
   * Check responsive design
   */
  async checkResponsiveDesign(viewport: { width: number; height: number }) {
    await this.page.setViewportSize(viewport);
    
    // Verify elements are still visible and accessible
    await expect(this.emailInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
    await expect(this.loginButton).toBeVisible();
    
    // Check if mobile-specific elements appear
    if (viewport.width <= 768) {
      // Mobile-specific checks
      const mobileMenu = this.page.locator('[data-testid="mobile-menu"]');
      if (await mobileMenu.isVisible()) {
        await expect(mobileMenu).toBeVisible();
      }
    }
  }
}