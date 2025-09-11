import { Page, Locator } from '@playwright/test';
export declare class AuthPageObject {
    readonly page: Page;
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly loginButton: Locator;
    readonly forgotPasswordLink: Locator;
    readonly signUpLink: Locator;
    readonly emailError: Locator;
    readonly passwordError: Locator;
    readonly loginError: Locator;
    readonly googleSsoButton: Locator;
    readonly microsoftSsoButton: Locator;
    readonly oktaSsoButton: Locator;
    readonly passwordToggle: Locator;
    readonly rememberMeCheckbox: Locator;
    readonly loadingSpinner: Locator;
    constructor(page: Page);
    navigateToLogin(): Promise<void>;
    fillEmail(email: string): Promise<void>;
    fillPassword(password: string): Promise<void>;
    clearForm(): Promise<void>;
    loginAs(email: string, password: string): Promise<void>;
    loginWithSSO(provider: 'google' | 'microsoft' | 'okta'): Promise<void>;
    togglePasswordVisibility(): Promise<void>;
    checkRememberMe(): Promise<void>;
    waitForLogin(): Promise<void>;
    waitForLoginError(): Promise<void>;
    isFormValid(): Promise<boolean>;
    getValidationErrors(): Promise<string[]>;
    isLoading(): Promise<boolean>;
    navigateToForgotPassword(): Promise<void>;
    navigateToSignUp(): Promise<void>;
    checkAccessibility(): Promise<void>;
    testKeyboardNavigation(): Promise<void>;
    checkResponsiveDesign(viewport: {
        width: number;
        height: number;
    }): Promise<void>;
}
//# sourceMappingURL=auth.page.d.ts.map