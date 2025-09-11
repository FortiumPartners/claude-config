"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PASSWORD_CONFIG = exports.PasswordService = exports.PasswordStrength = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const logger_1 = require("../config/logger");
const error_middleware_1 = require("../middleware/error.middleware");
const PASSWORD_CONFIG = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    saltRounds: 12,
};
exports.PASSWORD_CONFIG = PASSWORD_CONFIG;
var PasswordStrength;
(function (PasswordStrength) {
    PasswordStrength["WEAK"] = "weak";
    PasswordStrength["FAIR"] = "fair";
    PasswordStrength["GOOD"] = "good";
    PasswordStrength["STRONG"] = "strong";
})(PasswordStrength || (exports.PasswordStrength = PasswordStrength = {}));
class PasswordService {
    static async hashPassword(password) {
        try {
            const validation = this.validatePassword(password);
            if (!validation.isValid) {
                throw new error_middleware_1.AppError('Password does not meet security requirements', 400, true, 'INVALID_PASSWORD', validation.errors);
            }
            const startTime = Date.now();
            const hashedPassword = await bcrypt_1.default.hash(password, PASSWORD_CONFIG.saltRounds);
            const hashTime = Date.now() - startTime;
            logger_1.logger.debug('Password hashed successfully', {
                hashTime,
                saltRounds: PASSWORD_CONFIG.saltRounds,
            });
            return hashedPassword;
        }
        catch (error) {
            if (error instanceof error_middleware_1.AppError) {
                throw error;
            }
            logger_1.logger.error('Password hashing failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw new error_middleware_1.AppError('Password hashing failed', 500, true, 'PASSWORD_HASH_ERROR');
        }
    }
    static async verifyPassword(password, hash) {
        try {
            const startTime = Date.now();
            const isValid = await bcrypt_1.default.compare(password, hash);
            const verifyTime = Date.now() - startTime;
            logger_1.logger.debug('Password verification completed', {
                isValid,
                verifyTime,
            });
            return isValid;
        }
        catch (error) {
            logger_1.logger.error('Password verification failed', {
                error: error instanceof Error ? error.message : String(error),
            });
            throw new error_middleware_1.AppError('Password verification failed', 500, true, 'PASSWORD_VERIFY_ERROR');
        }
    }
    static validatePassword(password) {
        const errors = [];
        let score = 0;
        if (password.length < PASSWORD_CONFIG.minLength) {
            errors.push(`Password must be at least ${PASSWORD_CONFIG.minLength} characters long`);
        }
        else {
            score += 20;
        }
        if (password.length > PASSWORD_CONFIG.maxLength) {
            errors.push(`Password must not exceed ${PASSWORD_CONFIG.maxLength} characters`);
        }
        if (PASSWORD_CONFIG.requireUppercase && !/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }
        else if (/[A-Z]/.test(password)) {
            score += 15;
        }
        if (PASSWORD_CONFIG.requireLowercase && !/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }
        else if (/[a-z]/.test(password)) {
            score += 15;
        }
        if (PASSWORD_CONFIG.requireNumbers && !/\d/.test(password)) {
            errors.push('Password must contain at least one number');
        }
        else if (/\d/.test(password)) {
            score += 15;
        }
        if (PASSWORD_CONFIG.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push('Password must contain at least one special character');
        }
        else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            score += 15;
        }
        if (password.length >= 12) {
            score += 10;
        }
        if (password.length >= 16) {
            score += 10;
        }
        const uniqueChars = new Set(password).size;
        if (uniqueChars >= password.length * 0.7) {
            score += 5;
        }
        if (/(.)\1{2,}/.test(password)) {
            score -= 10;
            errors.push('Avoid repeating the same character multiple times');
        }
        if (/123|abc|qwe|asd|zxc/i.test(password)) {
            score -= 15;
            errors.push('Avoid sequential characters or keyboard patterns');
        }
        let strength;
        if (score >= 80) {
            strength = PasswordStrength.STRONG;
        }
        else if (score >= 60) {
            strength = PasswordStrength.GOOD;
        }
        else if (score >= 40) {
            strength = PasswordStrength.FAIR;
        }
        else {
            strength = PasswordStrength.WEAK;
        }
        const isValid = errors.length === 0 && score >= 40;
        return {
            isValid,
            strength,
            errors,
            score: Math.max(0, Math.min(100, score)),
        };
    }
    static generateSecurePassword(length = 16) {
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const numbers = '0123456789';
        const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
        const allChars = uppercase + lowercase + numbers + special;
        let password = '';
        password += this.getRandomChar(uppercase);
        password += this.getRandomChar(lowercase);
        password += this.getRandomChar(numbers);
        password += this.getRandomChar(special);
        for (let i = 4; i < length; i++) {
            password += this.getRandomChar(allChars);
        }
        return this.shuffleString(password);
    }
    static needsRehash(hash) {
        try {
            const rounds = bcrypt_1.default.getRounds(hash);
            return rounds < PASSWORD_CONFIG.saltRounds;
        }
        catch {
            return true;
        }
    }
    static generateResetToken() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let token = '';
        for (let i = 0; i < 32; i++) {
            token += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return token;
    }
    static getRandomChar(chars) {
        return chars.charAt(Math.floor(Math.random() * chars.length));
    }
    static shuffleString(str) {
        const arr = str.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join('');
    }
}
exports.PasswordService = PasswordService;
//# sourceMappingURL=password.service.js.map