/**
 * SAML Assertion Validator
 * Validates SAML assertions according to SAML 2.0 specification
 */

import * as winston from 'winston';
import * as forge from 'node-forge';
import { SAMLAssertion } from './saml.service';
import { SAMLConfig } from './saml-config.service';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationOptions {
  maxClockSkew?: number; // seconds
  maxAssertionAge?: number; // seconds
  requireEncryption?: boolean;
  requireSignature?: boolean;
  validateAudience?: boolean;
  expectedAudience?: string;
}

export class AssertionValidator {
  private logger: winston.Logger;
  private defaultOptions: Required<ValidationOptions>;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.defaultOptions = {
      maxClockSkew: 300, // 5 minutes
      maxAssertionAge: 3600, // 1 hour
      requireEncryption: false,
      requireSignature: true,
      validateAudience: true,
      expectedAudience: '',
    };
  }

  /**
   * Validate SAML assertion
   */
  async validateAssertion(
    assertion: SAMLAssertion,
    config: SAMLConfig,
    options: Partial<ValidationOptions> = {}
  ): Promise<ValidationResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      this.logger.debug('Validating SAML assertion', {
        assertion_id: assertion.id,
        provider: config.provider,
      });

      // 1. Validate assertion structure
      const structureResult = this.validateAssertionStructure(assertion);
      errors.push(...structureResult.errors);
      warnings.push(...structureResult.warnings);

      // 2. Validate time constraints
      const timeResult = this.validateTimeConstraints(assertion, mergedOptions.maxClockSkew);
      errors.push(...timeResult.errors);
      warnings.push(...timeResult.warnings);

      // 3. Validate subject confirmation
      const subjectResult = this.validateSubjectConfirmation(assertion, mergedOptions.maxClockSkew);
      errors.push(...subjectResult.errors);
      warnings.push(...subjectResult.warnings);

      // 4. Validate conditions
      const conditionsResult = this.validateConditions(assertion, mergedOptions);
      errors.push(...conditionsResult.errors);
      warnings.push(...conditionsResult.warnings);

      // 5. Validate issuer
      const issuerResult = this.validateIssuer(assertion, config);
      errors.push(...issuerResult.errors);
      warnings.push(...issuerResult.warnings);

      // 6. Validate attributes
      const attributesResult = this.validateAttributes(assertion, config);
      errors.push(...attributesResult.errors);
      warnings.push(...attributesResult.warnings);

      // 7. Validate authentication statement
      const authnResult = this.validateAuthnStatement(assertion);
      errors.push(...authnResult.errors);
      warnings.push(...authnResult.warnings);

      const isValid = errors.length === 0;

      this.logger.info('SAML assertion validation completed', {
        assertion_id: assertion.id,
        is_valid: isValid,
        error_count: errors.length,
        warning_count: warnings.length,
      });

      return {
        isValid,
        errors,
        warnings,
      };
    } catch (error) {
      this.logger.error('SAML assertion validation failed', {
        assertion_id: assertion.id,
        error: error.message,
      });
      
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings,
      };
    }
  }

  /**
   * Validate certificate chain and signature
   */
  async validateCertificateAndSignature(
    signedXml: string,
    certificate: string,
    options: { requireSignature?: boolean } = {}
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Parse certificate
      const cert = forge.pki.certificateFromPem(certificate);
      
      // Validate certificate itself
      const certResult = this.validateCertificate(cert);
      errors.push(...certResult.errors);
      warnings.push(...certResult.warnings);

      // TODO: Implement XML signature validation
      // This is a complex operation that requires a proper XML-DSig library
      if (options.requireSignature) {
        warnings.push('XML signature validation not fully implemented');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [`Certificate validation error: ${error.message}`],
        warnings,
      };
    }
  }

  /**
   * Validate assertion structure
   */
  private validateAssertionStructure(assertion: SAMLAssertion): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!assertion.id) {
      errors.push('Assertion ID is missing');
    }

    if (!assertion.issuer) {
      errors.push('Assertion issuer is missing');
    }

    if (!assertion.subject) {
      errors.push('Assertion subject is missing');
    } else {
      if (!assertion.subject.nameId) {
        errors.push('Subject NameID is missing');
      }
      if (!assertion.subject.nameIdFormat) {
        errors.push('Subject NameID format is missing');
      }
    }

    if (!assertion.conditions) {
      errors.push('Assertion conditions are missing');
    }

    if (!assertion.authnStatement) {
      errors.push('Authentication statement is missing');
    }

    // Validate ID format
    if (assertion.id && !assertion.id.match(/^[a-zA-Z0-9._-]+$/)) {
      warnings.push('Assertion ID contains unusual characters');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate time constraints
   */
  private validateTimeConstraints(assertion: SAMLAssertion, maxClockSkew: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const now = new Date();
    const clockSkew = maxClockSkew * 1000; // Convert to milliseconds

    // Validate assertion conditions time bounds
    if (assertion.conditions) {
      const notBefore = new Date(assertion.conditions.notBefore);
      const notOnOrAfter = new Date(assertion.conditions.notOnOrAfter);

      if (now.getTime() < notBefore.getTime() - clockSkew) {
        errors.push(`Assertion not yet valid (NotBefore: ${notBefore.toISOString()})`);
      }

      if (now.getTime() >= notOnOrAfter.getTime() + clockSkew) {
        errors.push(`Assertion has expired (NotOnOrAfter: ${notOnOrAfter.toISOString()})`);
      }

      // Check assertion lifetime
      const lifetime = notOnOrAfter.getTime() - notBefore.getTime();
      if (lifetime > 24 * 60 * 60 * 1000) { // 24 hours
        warnings.push('Assertion has unusually long lifetime');
      }
    }

    // Validate authentication statement time
    if (assertion.authnStatement && assertion.authnStatement.authnInstant) {
      const authnInstant = new Date(assertion.authnStatement.authnInstant);
      const authnAge = now.getTime() - authnInstant.getTime();
      
      if (authnAge > 24 * 60 * 60 * 1000) { // 24 hours
        warnings.push('Authentication is very old');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate subject confirmation
   */
  private validateSubjectConfirmation(assertion: SAMLAssertion, maxClockSkew: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!assertion.subject.subjectConfirmation) {
      errors.push('Subject confirmation is missing');
      return { isValid: false, errors, warnings };
    }

    const confirmation = assertion.subject.subjectConfirmation;
    const now = new Date();
    const clockSkew = maxClockSkew * 1000;

    // Validate method
    if (confirmation.method !== 'urn:oasis:names:tc:SAML:2.0:cm:bearer') {
      warnings.push(`Unusual subject confirmation method: ${confirmation.method}`);
    }

    // Validate time constraint
    if (confirmation.notOnOrAfter && now.getTime() >= confirmation.notOnOrAfter.getTime() + clockSkew) {
      errors.push(`Subject confirmation has expired (NotOnOrAfter: ${confirmation.notOnOrAfter.toISOString()})`);
    }

    // Validate recipient (if provided)
    if (confirmation.recipient && !this.isValidUrl(confirmation.recipient)) {
      warnings.push('Subject confirmation recipient is not a valid URL');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate assertion conditions
   */
  private validateConditions(assertion: SAMLAssertion, options: ValidationOptions): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!assertion.conditions) {
      return { isValid: true, errors, warnings };
    }

    const conditions = assertion.conditions;

    // Validate audience restriction
    if (options.validateAudience && options.expectedAudience) {
      if (conditions.audienceRestriction && conditions.audienceRestriction.length > 0) {
        if (!conditions.audienceRestriction.includes(options.expectedAudience)) {
          errors.push(`Audience restriction does not include expected audience: ${options.expectedAudience}`);
        }
      } else {
        warnings.push('No audience restriction present in assertion');
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate issuer
   */
  private validateIssuer(assertion: SAMLAssertion, config: SAMLConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!assertion.issuer) {
      errors.push('Assertion issuer is missing');
      return { isValid: false, errors, warnings };
    }

    // Check if issuer matches expected entity ID
    if (config.entity_id && assertion.issuer !== config.entity_id) {
      errors.push(`Issuer mismatch: expected ${config.entity_id}, got ${assertion.issuer}`);
    }

    // Validate issuer format (should be URI)
    if (!this.isValidUri(assertion.issuer)) {
      warnings.push('Issuer is not in URI format');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate attributes
   */
  private validateAttributes(assertion: SAMLAssertion, config: SAMLConfig): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!assertion.attributes) {
      warnings.push('No attributes present in assertion');
      return { isValid: true, errors, warnings };
    }

    const attributes = assertion.attributes;
    const requiredAttributes = ['email']; // Minimum required attributes

    // Check for required attributes
    for (const required of requiredAttributes) {
      if (!attributes[required]) {
        errors.push(`Required attribute missing: ${required}`);
      }
    }

    // Validate email format if present
    if (attributes.email) {
      const email = Array.isArray(attributes.email) ? attributes.email[0] : attributes.email;
      if (!this.isValidEmail(email)) {
        errors.push(`Invalid email format: ${email}`);
      }
    }

    // Check for empty attribute values
    for (const [name, value] of Object.entries(attributes)) {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        warnings.push(`Attribute has empty value: ${name}`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate authentication statement
   */
  private validateAuthnStatement(assertion: SAMLAssertion): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!assertion.authnStatement) {
      errors.push('Authentication statement is missing');
      return { isValid: false, errors, warnings };
    }

    const authnStmt = assertion.authnStatement;

    // Validate authentication instant
    if (!authnStmt.authnInstant) {
      errors.push('Authentication instant is missing');
    }

    // Validate authentication context
    if (!authnStmt.authnContext || !authnStmt.authnContext.authnContextClassRef) {
      errors.push('Authentication context class reference is missing');
    }

    // Validate session index (if present)
    if (authnStmt.sessionIndex && !authnStmt.sessionIndex.match(/^[a-zA-Z0-9._-]+$/)) {
      warnings.push('Session index contains unusual characters');
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate X.509 certificate
   */
  private validateCertificate(cert: forge.pki.Certificate): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const now = new Date();

    // Check certificate validity period
    if (now < cert.validity.notBefore) {
      errors.push(`Certificate not yet valid (NotBefore: ${cert.validity.notBefore.toISOString()})`);
    }

    if (now > cert.validity.notAfter) {
      errors.push(`Certificate has expired (NotAfter: ${cert.validity.notAfter.toISOString()})`);
    }

    // Check if certificate is expiring soon (within 30 days)
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (cert.validity.notAfter.getTime() - now.getTime() < thirtyDays) {
      warnings.push('Certificate is expiring within 30 days');
    }

    // Check key size
    if (cert.publicKey && (cert.publicKey as any).n) {
      const keySize = (cert.publicKey as any).n.bitLength();
      if (keySize < 2048) {
        warnings.push(`Certificate uses weak key size: ${keySize} bits`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate URI format
   */
  private isValidUri(uri: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uri);
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}