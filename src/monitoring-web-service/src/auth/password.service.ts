/**
 * Password Service
 * Fortium External Metrics Web Service - Task 1.7: Authentication Foundation
 */

import bcrypt from 'bcrypt';
import { logger } from '../config/logger';
import { AppError } from '../middleware/error.middleware';

// Password validation configuration
const PASSWORD_CONFIG = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  saltRounds: 12, // Higher for better security, but slower
} as const;

// Password strength levels
export enum PasswordStrength {
  WEAK = 'weak',
  FAIR = 'fair',
  GOOD = 'good',
  STRONG = 'strong',
}

// Password validation result
export interface PasswordValidation {
  isValid: boolean;
  strength: PasswordStrength;
  errors: string[];
  score: number; // 0-100
}

export class PasswordService {
  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      // Validate password before hashing
      const validation = this.validatePassword(password);
      if (!validation.isValid) {
        throw new AppError(
          'Password does not meet security requirements',
          400,
          true,
          'INVALID_PASSWORD',
          validation.errors
        );
      }

      const startTime = Date.now();
      const hashedPassword = await bcrypt.hash(password, PASSWORD_CONFIG.saltRounds);
      const hashTime = Date.now() - startTime;

      logger.debug('Password hashed successfully', {
        hashTime,
        saltRounds: PASSWORD_CONFIG.saltRounds,
      });

      return hashedPassword;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Password hashing failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new AppError('Password hashing failed', 500, true, 'PASSWORD_HASH_ERROR');
    }
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const startTime = Date.now();
      const isValid = await bcrypt.compare(password, hash);
      const verifyTime = Date.now() - startTime;

      logger.debug('Password verification completed', {
        isValid,
        verifyTime,
      });

      return isValid;
    } catch (error) {
      logger.error('Password verification failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new AppError('Password verification failed', 500, true, 'PASSWORD_VERIFY_ERROR');
    }
  }

  /**
   * Validate password strength and requirements
   */
  static validatePassword(password: string): PasswordValidation {
    const errors: string[] = [];
    let score = 0;

    // Check length
    if (password.length < PASSWORD_CONFIG.minLength) {
      errors.push(`Password must be at least ${PASSWORD_CONFIG.minLength} characters long`);
    } else {
      score += 20;
    }

    if (password.length > PASSWORD_CONFIG.maxLength) {
      errors.push(`Password must not exceed ${PASSWORD_CONFIG.maxLength} characters`);
    }

    // Check for uppercase letters
    if (PASSWORD_CONFIG.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      score += 15;
    }

    // Check for lowercase letters
    if (PASSWORD_CONFIG.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      score += 15;
    }

    // Check for numbers
    if (PASSWORD_CONFIG.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else if (/\d/.test(password)) {
      score += 15;
    }

    // Check for special characters
    if (PASSWORD_CONFIG.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 15;
    }

    // Additional strength checks
    // Bonus for length
    if (password.length >= 12) {
      score += 10;
    }
    if (password.length >= 16) {
      score += 10;
    }

    // Bonus for character variety
    const uniqueChars = new Set(password).size;
    if (uniqueChars >= password.length * 0.7) {
      score += 5;
    }

    // Penalty for common patterns
    if (/(.)\1{2,}/.test(password)) {
      score -= 10; // Repeated characters
      errors.push('Avoid repeating the same character multiple times');
    }

    if (/123|abc|qwe|asd|zxc/i.test(password)) {
      score -= 15; // Sequential or keyboard patterns
      errors.push('Avoid sequential characters or keyboard patterns');
    }

    // Determine strength
    let strength: PasswordStrength;
    if (score >= 80) {
      strength = PasswordStrength.STRONG;
    } else if (score >= 60) {
      strength = PasswordStrength.GOOD;
    } else if (score >= 40) {
      strength = PasswordStrength.FAIR;
    } else {
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

  /**
   * Generate secure random password
   */
  static generateSecurePassword(length: number = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    const allChars = uppercase + lowercase + numbers + special;
    
    let password = '';
    
    // Ensure at least one character from each required set
    password += this.getRandomChar(uppercase);
    password += this.getRandomChar(lowercase);
    password += this.getRandomChar(numbers);
    password += this.getRandomChar(special);
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += this.getRandomChar(allChars);
    }
    
    // Shuffle the password to avoid predictable patterns
    return this.shuffleString(password);
  }

  /**
   * Check if password needs to be rehashed (e.g., salt rounds changed)
   */
  static needsRehash(hash: string): boolean {
    try {
      // Check if the hash was created with different salt rounds
      const rounds = bcrypt.getRounds(hash);
      return rounds < PASSWORD_CONFIG.saltRounds;
    } catch {
      // If we can't determine the rounds, assume it needs rehashing
      return true;
    }
  }

  /**
   * Generate password reset token (not JWT)
   */
  static generateResetToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return token;
  }

  /**
   * Get random character from character set
   */
  private static getRandomChar(chars: string): string {
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }

  /**
   * Shuffle string characters
   */
  private static shuffleString(str: string): string {
    const arr = str.split('');
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.join('');
  }
}

// Export password configuration for reference
export { PASSWORD_CONFIG };