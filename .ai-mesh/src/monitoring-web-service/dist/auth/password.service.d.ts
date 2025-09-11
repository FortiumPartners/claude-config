declare const PASSWORD_CONFIG: {
    readonly minLength: 8;
    readonly maxLength: 128;
    readonly requireUppercase: true;
    readonly requireLowercase: true;
    readonly requireNumbers: true;
    readonly requireSpecialChars: true;
    readonly saltRounds: 12;
};
export declare enum PasswordStrength {
    WEAK = "weak",
    FAIR = "fair",
    GOOD = "good",
    STRONG = "strong"
}
export interface PasswordValidation {
    isValid: boolean;
    strength: PasswordStrength;
    errors: string[];
    score: number;
}
export declare class PasswordService {
    static hashPassword(password: string): Promise<string>;
    static verifyPassword(password: string, hash: string): Promise<boolean>;
    static validatePassword(password: string): PasswordValidation;
    static generateSecurePassword(length?: number): string;
    static needsRehash(hash: string): boolean;
    static generateResetToken(): string;
    private static getRandomChar;
    private static shuffleString;
}
export { PASSWORD_CONFIG };
//# sourceMappingURL=password.service.d.ts.map