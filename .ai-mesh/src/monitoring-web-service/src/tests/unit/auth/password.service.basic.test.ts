/**
 * Password Service Basic Unit Tests
 * Sprint 9.1: Comprehensive Test Suite Development
 * Coverage Target: >95% for authentication system
 */

import { PasswordService, PasswordStrength } from '../../../auth/password.service';
import bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('PasswordService (Basic)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePassword', () => {
    it('should validate strong password', () => {
      const strongPassword = 'StrongPassword123!';
      
      const result = PasswordService.validatePassword(strongPassword);
      
      expect(result.isValid).toBe(true);
      expect(result.strength).toBe(PasswordStrength.STRONG);
      expect(result.score).toBeGreaterThan(80);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject password that is too short', () => {
      const shortPassword = 'Abc1!';
      
      const result = PasswordService.validatePassword(shortPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase letter', () => {
      const noUppercase = 'password123!';
      
      const result = PasswordService.validatePassword(noUppercase);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      const noLowercase = 'PASSWORD123!';
      
      const result = PasswordService.validatePassword(noLowercase);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const noNumber = 'StrongPassword!';
      
      const result = PasswordService.validatePassword(noNumber);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const noSpecialChar = 'StrongPassword123';
      
      const result = PasswordService.validatePassword(noSpecialChar);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should detect common passwords', () => {
      const commonPasswords = [
        'Password123!',
        'Qwerty123!',
        '123456789!A'
      ];

      commonPasswords.forEach(password => {
        const result = PasswordService.validatePassword(password);
        expect(result.strength).toBe(PasswordStrength.WEAK);
      });
    });

    it('should calculate password strength correctly', () => {
      const passwords = [
        { pwd: 'Abc123!', expected: PasswordStrength.FAIR },
        { pwd: 'MyStr0ngP@ssw0rd!', expected: PasswordStrength.STRONG },
        { pwd: 'password', expected: PasswordStrength.WEAK }
      ];

      passwords.forEach(({ pwd, expected }) => {
        const result = PasswordService.validatePassword(pwd);
        expect(result.strength).toBe(expected);
      });
    });
  });

  describe('hashPassword', () => {
    it('should hash valid password successfully', async () => {
      const password = 'StrongPassword123!';
      const hashedPassword = '$2b$12$hashedpassword';

      mockedBcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await PasswordService.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });

    it('should throw error for invalid password', async () => {
      const invalidPassword = 'weak';

      await expect(PasswordService.hashPassword(invalidPassword))
        .rejects.toThrow('Password does not meet security requirements');
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'StrongPassword123!';
      const hashedPassword = '$2b$12$hashedpassword';

      mockedBcrypt.compare.mockResolvedValue(true);

      const result = await PasswordService.verifyPassword(password, hashedPassword);

      expect(result).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });

    it('should reject incorrect password', async () => {
      const password = 'WrongPassword123!';
      const hashedPassword = '$2b$12$hashedpassword';

      mockedBcrypt.compare.mockResolvedValue(false);

      const result = await PasswordService.verifyPassword(password, hashedPassword);

      expect(result).toBe(false);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password with default length', () => {
      const password = PasswordService.generateSecurePassword();
      
      expect(typeof password).toBe('string');
      expect(password.length).toBeGreaterThanOrEqual(12);
      
      const validation = PasswordService.validatePassword(password);
      expect(validation.isValid).toBe(true);
    });

    it('should generate password with custom length', () => {
      const length = 16;
      const password = PasswordService.generateSecurePassword(length);
      
      expect(password.length).toBe(length);
      
      const validation = PasswordService.validatePassword(password);
      expect(validation.isValid).toBe(true);
    });

    it('should generate different passwords each time', () => {
      const password1 = PasswordService.generateSecurePassword();
      const password2 = PasswordService.generateSecurePassword();
      
      expect(password1).not.toBe(password2);
    });
  });

  describe('checkPasswordHistory', () => {
    it('should allow new password not in history', async () => {
      const newPassword = 'NewPassword123!';
      const passwordHistory = [
        '$2b$12$oldpassword1',
        '$2b$12$oldpassword2'
      ];

      mockedBcrypt.compare.mockResolvedValue(false);

      const isReused = await PasswordService.checkPasswordHistory(newPassword, passwordHistory);

      expect(isReused).toBe(false);
    });

    it('should detect reused password in history', async () => {
      const reusedPassword = 'ReusedPassword123!';
      const passwordHistory = [
        '$2b$12$oldpassword1',
        '$2b$12$reusedpassword',
        '$2b$12$oldpassword2'
      ];

      mockedBcrypt.compare
        .mockResolvedValueOnce(false) // First check
        .mockResolvedValueOnce(true)  // Second check - match
        .mockResolvedValueOnce(false); // Third check

      const isReused = await PasswordService.checkPasswordHistory(reusedPassword, passwordHistory);

      expect(isReused).toBe(true);
    });
  });
});