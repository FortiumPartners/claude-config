"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthPageObject = void 0;
const test_1 = require("@playwright/test");
class AuthPageObject {
    page;
    emailInput;
    passwordInput;
    loginButton;
    forgotPasswordLink;
    signUpLink;
    emailError;
    passwordError;
    loginError;
    googleSsoButton;
    microsoftSsoButton;
    oktaSsoButton;
    passwordToggle;
    rememberMeCheckbox;
    loadingSpinner;
    constructor(page) {
        this.page = page;
        this.emailInput = page.locator('[data-testid="email-input"]');
        this.passwordInput = page.locator('[data-testid="password-input"]');
        this.loginButton = page.locator('[data-testid="login-submit"]');
        this.forgotPasswordLink = page.locator('[data-testid="forgot-password-link"]');
        this.signUpLink = page.locator('[data-testid="signup-link"]');
        this.emailError = page.locator('[data-testid="email-error"]');
        this.passwordError = page.locator('[data-testid="password-error"]');
        this.loginError = page.locator('[data-testid="login-error"]');
        this.googleSsoButton = page.locator('[data-testid="google-sso-button"]');
        this.microsoftSsoButton = page.locator('[data-testid="microsoft-sso-button"]');
        this.oktaSsoButton = page.locator('[data-testid="okta-sso-button"]');
        this.passwordToggle = page.locator('[data-testid="toggle-password-visibility"]');
        this.rememberMeCheckbox = page.locator('[data-testid="remember-me-checkbox"]');
        this.loadingSpinner = page.locator('[data-testid="login-spinner"]');
    }
    async navigateToLogin() {
        await this.page.goto('/login');
        await this.page.waitForLoadState('networkidle');
        await (0, test_1.expect)(this.emailInput).toBeVisible();
    }
    async fillEmail(email) {
        await this.emailInput.clear();
        await this.emailInput.fill(email);
        await this.page.waitForTimeout(100);
    }
    async fillPassword(password) {
        await this.passwordInput.clear();
        await this.passwordInput.fill(password);
        await this.page.waitForTimeout(100);
    }
    async clearForm() {
        await this.emailInput.clear();
        await this.passwordInput.clear();
    }
    async loginAs(email, password) {
        await this.fillEmail(email);
        await this.fillPassword(password);
        await this.page.waitForTimeout(500);
        await this.loginButton.click();
        await Promise.race([
            this.page.waitForURL(/.*\/dashboard/, { timeout: 10000 }),
            this.loginError.waitFor({ state: 'visible', timeout: 5000 })
        ]);
    }
    async loginWithSSO(provider) {
        const button = {
            google: this.googleSsoButton,
            microsoft: this.microsoftSsoButton,
            okta: this.oktaSsoButton
        }[provider];
        await button.click();
    }
    async togglePasswordVisibility() {
        await this.passwordToggle.click();
    }
    async checkRememberMe() {
        if (await this.rememberMeCheckbox.isVisible()) {
            await this.rememberMeCheckbox.check();
        }
    }
    async waitForLogin() {
        await this.page.waitForURL(/.*\/dashboard/, { timeout: 15000 });
    }
    async waitForLoginError() {
        await this.loginError.waitFor({ state: 'visible', timeout: 5000 });
    }
    async isFormValid() {
        const emailValue = await this.emailInput.inputValue();
        const passwordValue = await this.passwordInput.inputValue();
        const isButtonEnabled = await this.loginButton.isEnabled();
        return emailValue.length > 0 && passwordValue.length > 0 && isButtonEnabled;
    }
    async getValidationErrors() {
        const errors = [];
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
    async isLoading() {
        return await this.loadingSpinner.isVisible() && await this.loginButton.isDisabled();
    }
    async navigateToForgotPassword() {
        await this.forgotPasswordLink.click();
        await this.page.waitForLoadState('networkidle');
    }
    async navigateToSignUp() {
        await this.signUpLink.click();
        await this.page.waitForLoadState('networkidle');
    }
    async checkAccessibility() {
        await (0, test_1.expect)(this.emailInput).toHaveAttribute('aria-label');
        await (0, test_1.expect)(this.passwordInput).toHaveAttribute('aria-label');
        const form = this.page.locator('[data-testid="login-form"]');
        await (0, test_1.expect)(form).toHaveAttribute('role', 'form');
        if (await this.emailError.isVisible()) {
            await (0, test_1.expect)(this.emailError).toHaveAttribute('role', 'alert');
        }
    }
    async testKeyboardNavigation() {
        await this.emailInput.focus();
        await (0, test_1.expect)(this.emailInput).toBeFocused();
        await this.page.keyboard.press('Tab');
        await (0, test_1.expect)(this.passwordInput).toBeFocused();
        await this.page.keyboard.press('Tab');
        await (0, test_1.expect)(this.loginButton).toBeFocused();
        await this.emailInput.focus();
        await this.fillEmail('test@example.com');
        await this.fillPassword('password123');
        await this.page.keyboard.press('Enter');
        await this.waitForLoginError();
    }
    async checkResponsiveDesign(viewport) {
        await this.page.setViewportSize(viewport);
        await (0, test_1.expect)(this.emailInput).toBeVisible();
        await (0, test_1.expect)(this.passwordInput).toBeVisible();
        await (0, test_1.expect)(this.loginButton).toBeVisible();
        if (viewport.width <= 768) {
            const mobileMenu = this.page.locator('[data-testid="mobile-menu"]');
            if (await mobileMenu.isVisible()) {
                await (0, test_1.expect)(mobileMenu).toBeVisible();
            }
        }
    }
}
exports.AuthPageObject = AuthPageObject;
//# sourceMappingURL=auth.page.js.map