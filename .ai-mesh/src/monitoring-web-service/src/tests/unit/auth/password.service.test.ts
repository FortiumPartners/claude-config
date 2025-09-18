/**
 * Password Service Unit Tests
 * Sprint 9.1: Comprehensive Test Suite Development
 * Coverage Target: >95% for authentication system
 */

import { PasswordService } from '../../../auth/password.service';
import { TEST_CONSTANTS } from '../../setup';
import bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('PasswordService', () => {
  let passwordService: PasswordService;

  beforeEach(() => {
    passwordService = new PasswordService();
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    const plainPassword = TEST_CONSTANTS.VALID_PASSWORD;
    const mockHashedPassword = '$2b$12$hashedpasswordexample';

    it('should hash password successfully', async () => {
      mockedBcrypt.hash.mockResolvedValue(mockHashedPassword);

      const hashedPassword = await passwordService.hashPassword(plainPassword);

      expect(hashedPassword).toBe(mockHashedPassword);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(plainPassword, 12);
    });

    it('should use default salt rounds', async () => {
      mockedBcrypt.hash.mockResolvedValue(mockHashedPassword);

      await passwordService.hashPassword(plainPassword);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(plainPassword, 12);
    });

    it('should use custom salt rounds', async () => {
      mockedBcrypt.hash.mockResolvedValue(mockHashedPassword);

      await passwordService.hashPassword(plainPassword, 10);

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(plainPassword, 10);
    });

    it('should handle empty password', async () => {
      await expect(passwordService.hashPassword(''))
        .rejects.toThrow('Password cannot be empty');
    });

    it('should handle null password', async () => {
      await expect(passwordService.hashPassword(null as any))
        .rejects.toThrow('Password cannot be empty');
    });

    it('should handle undefined password', async () => {
      await expect(passwordService.hashPassword(undefined as any))
        .rejects.toThrow('Password cannot be empty');
    });

    it('should handle bcrypt errors', async () => {
      const bcryptError = new Error('Bcrypt hashing failed');
      mockedBcrypt.hash.mockRejectedValue(bcryptError);

      await expect(passwordService.hashPassword(plainPassword))
        .rejects.toThrow('Password hashing failed');
    });
  });

  describe('verifyPassword', () => {
    const plainPassword = TEST_CONSTANTS.VALID_PASSWORD;
    const hashedPassword = '$2b$12$hashedpasswordexample';

    it('should verify correct password', async () => {
      mockedBcrypt.compare.mockResolvedValue(true);

      const isValid = await passwordService.verifyPassword(plainPassword, hashedPassword);

      expect(isValid).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(plainPassword, hashedPassword);
    });

    it('should reject incorrect password', async () => {
      mockedBcrypt.compare.mockResolvedValue(false);

      const isValid = await passwordService.verifyPassword('wrongpassword', hashedPassword);

      expect(isValid).toBe(false);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('wrongpassword', hashedPassword);
    });

    it('should handle empty plain password', async () => {
      await expect(passwordService.verifyPassword('', hashedPassword))
        .rejects.toThrow('Password cannot be empty');
    });

    it('should handle empty hashed password', async () => {
      await expect(passwordService.verifyPassword(plainPassword, ''))
        .rejects.toThrow('Hashed password cannot be empty');
    });

    it('should handle null parameters', async () => {
      await expect(passwordService.verifyPassword(null as any, hashedPassword))
        .rejects.toThrow('Password cannot be empty');

      await expect(passwordService.verifyPassword(plainPassword, null as any))
        .rejects.toThrow('Hashed password cannot be empty');
    });

    it('should handle bcrypt comparison errors', async () => {
      const bcryptError = new Error('Bcrypt comparison failed');
      mockedBcrypt.compare.mockRejectedValue(bcryptError);

      await expect(passwordService.verifyPassword(plainPassword, hashedPassword))
        .rejects.toThrow('Password verification failed');
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong password', () => {
      const strongPasswords = [
        'StrongPassword123!',
        'MyP@ssw0rd2024',
        'Test123!@#$%',
        'ComplexP@ss1'
      ];

      strongPasswords.forEach(password => {
        const result = passwordService.validatePasswordStrength(password);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('should reject password without minimum length', () => {
      const shortPassword = 'Abc1!';
      
      const result = passwordService.validatePasswordStrength(shortPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password without uppercase letter', () => {
      const noUppercase = 'password123!';
      
      const result = passwordService.validatePasswordStrength(noUppercase);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letter', () => {
      const noLowercase = 'PASSWORD123!';
      
      const result = passwordService.validatePasswordStrength(noLowercase);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const noNumber = 'Password!';
      
      const result = passwordService.validatePasswordStrength(noNumber);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password without special character', () => {
      const noSpecialChar = 'Password123';
      
      const result = passwordService.validatePasswordStrength(noSpecialChar);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one special character');
    });

    it('should reject common weak passwords', () => {
      const weakPasswords = [
        'Password123!',
        'Qwerty123!',
        '123456789!A'
      ];

      weakPasswords.forEach(password => {
        const result = passwordService.validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Password is too common or predictable');
      });
    });

    it('should handle empty password', () => {
      const result = passwordService.validatePasswordStrength('');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password cannot be empty');
    });

    it('should handle null/undefined password', () => {
      const nullResult = passwordService.validatePasswordStrength(null as any);
      const undefinedResult = passwordService.validatePasswordStrength(undefined as any);
      
      expect(nullResult.isValid).toBe(false);
      expect(nullResult.errors).toContain('Password cannot be empty');
      
      expect(undefinedResult.isValid).toBe(false);
      expect(undefinedResult.errors).toContain('Password cannot be empty');
    });

    it('should accumulate multiple errors', () => {
      const weakPassword = 'abc'; // Short, no uppercase, no number, no special char
      
      const result = passwordService.validatePasswordStrength(weakPassword);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password with default length', () => {
      const password = passwordService.generateSecurePassword();
      
      expect(typeof password).toBe('string');
      expect(password.length).toBe(12); // Default length
      
      const validation = passwordService.validatePasswordStrength(password);
      expect(validation.isValid).toBe(true);
    });

    it('should generate password with custom length', () => {
      const customLength = 16;
      const password = passwordService.generateSecurePassword(customLength);
      
      expect(password.length).toBe(customLength);
      
      const validation = passwordService.validatePasswordStrength(password);
      expect(validation.isValid).toBe(true);
    });

    it('should generate different passwords each time', () => {
      const password1 = passwordService.generateSecurePassword();
      const password2 = passwordService.generateSecurePassword();
      
      expect(password1).not.toBe(password2);
    });

    it('should handle minimum length constraint', () => {
      expect(() => passwordService.generateSecurePassword(3))
        .toThrow('Password length must be at least 8 characters');
    });

    it('should handle maximum length constraint', () => {
      expect(() => passwordService.generateSecurePassword(129))
        .toThrow('Password length cannot exceed 128 characters');
    });

    it('should generate passwords that pass strength validation', () => {
      // Test multiple generations to ensure consistency
      for (let i = 0; i < 10; i++) {
        const password = passwordService.generateSecurePassword(12);
        const validation = passwordService.validatePasswordStrength(password);
        
        expect(validation.isValid).toBe(true);
        expect(validation.errors).toHaveLength(0);
      }
    });
  });

  describe('checkPasswordHistory', () => {
    const currentPassword = 'CurrentPassword123!';
    const hashedCurrentPassword = '$2b$12$currenthashedpassword';
    const passwordHistory = [
      '$2b$12$oldpassword1',
      '$2b$12$oldpassword2',
      '$2b$12$oldpassword3'
    ];

    it('should allow new password that was not used recently', async () => {
      mockedBcrypt.compare.mockResolvedValue(false); // Not matching any history

      const isReused = await passwordService.checkPasswordHistory(
        currentPassword, 
        passwordHistory
      );

      expect(isReused).toBe(false);
    });

    it('should detect reused password in history', async () => {
      mockedBcrypt.compare
        .mockResolvedValueOnce(false) // First history item
        .mockResolvedValueOnce(true)  // Second history item matches
        .mockResolvedValueOnce(false); // Third history item

      const isReused = await passwordService.checkPasswordHistory(
        currentPassword, 
        passwordHistory
      );

      expect(isReused).toBe(true);
    });

    it('should handle empty password history', async () => {
      const isReused = await passwordService.checkPasswordHistory(
        currentPassword, 
        []
      );

      expect(isReused).toBe(false);
    });

    it('should handle null password history', async () => {
      const isReused = await passwordService.checkPasswordHistory(
        currentPassword, 
        null as any
      );

      expect(isReused).toBe(false);
    });

    it('should handle comparison errors gracefully', async () => {
      const bcryptError = new Error('Comparison failed');
      mockedBcrypt.compare.mockRejectedValue(bcryptError);

      await expect(passwordService.checkPasswordHistory(currentPassword, passwordHistory))
        .rejects.toThrow('Password history check failed');
    });
  });

  describe('hashPasswordWithSalt', () => {
    const password = TEST_CONSTANTS.VALID_PASSWORD;
    const customSalt = '$2b$12$customsaltvaluehere';

    it('should hash password with custom salt', async () => {
      const mockHash = '$2b$12$hashedwithcustomsalt';
      mockedBcrypt.hash.mockResolvedValue(mockHash);

      const result = await passwordService.hashPasswordWithSalt(password, customSalt);

      expect(result).toBe(mockHash);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, customSalt);
    });

    it('should handle invalid salt format', async () => {
      const invalidSalt = 'invalidsalt';

      await expect(passwordService.hashPasswordWithSalt(password, invalidSalt))
        .rejects.toThrow('Invalid salt format');
    });

    it('should handle bcrypt errors with custom salt', async () => {
      const bcryptError = new Error('Salt hashing failed');
      mockedBcrypt.hash.mockRejectedValue(bcryptError);

      await expect(passwordService.hashPasswordWithSalt(password, customSalt))
        .rejects.toThrow('Password hashing with salt failed');
    });
  });
});