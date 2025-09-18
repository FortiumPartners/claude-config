/**
 * Certificate Service
 * Manages X.509 certificates for SAML signing and encryption
 */

import * as winston from 'winston';
import * as forge from 'node-forge';
import { DatabaseConnection } from '../../database/connection';

export interface SAMLCertificate {
  id?: string;
  organization_id: string;
  certificate_type: 'signing' | 'encryption';
  certificate: string; // PEM format
  private_key_encrypted: string; // Encrypted private key
  thumbprint: string; // SHA-256 thumbprint
  is_active: boolean;
  expires_at: Date;
  created_at?: Date;
}

export interface CertificateInfo {
  subject: string;
  issuer: string;
  serialNumber: string;
  notBefore: Date;
  notAfter: Date;
  thumbprint: string;
  keyUsage: string[];
}

export class CertificateService {
  private db: DatabaseConnection;
  private logger: winston.Logger;
  private encryptionKey: string;

  constructor(db: DatabaseConnection, logger: winston.Logger) {
    this.db = db;
    this.logger = logger;
    // In production, use proper key management (AWS KMS, Azure Key Vault, etc.)
    this.encryptionKey = process.env.CERTIFICATE_ENCRYPTION_KEY || 'default-key-change-in-production';
  }

  /**
   * Generate a new RSA certificate and private key for SAML
   */
  async generateSAMLCertificate(
    organizationId: string,
    certificateType: 'signing' | 'encryption',
    commonName: string,
    keySize: number = 2048,
    validityDays: number = 365
  ): Promise<SAMLCertificate> {
    try {
      this.logger.info('Generating SAML certificate', {
        organization_id: organizationId,
        certificate_type: certificateType,
        common_name: commonName,
        key_size: keySize,
        validity_days: validityDays,
      });

      // Generate RSA key pair
      const keyPair = forge.pki.rsa.generateKeyPair(keySize);

      // Create certificate
      const cert = forge.pki.createCertificate();
      cert.publicKey = keyPair.publicKey;
      cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(9));
      
      const now = new Date();
      const expiryDate = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);
      
      cert.validity.notBefore = now;
      cert.validity.notAfter = expiryDate;

      // Set certificate attributes
      const attrs = [
        { name: 'commonName', value: commonName },
        { name: 'organizationName', value: 'Fortium Metrics Service' },
        { name: 'organizationalUnitName', value: 'SAML Authentication' },
        { name: 'countryName', value: 'US' },
      ];

      cert.setSubject(attrs);
      cert.setIssuer(attrs);

      // Set extensions
      const extensions = [
        {
          name: 'basicConstraints',
          cA: false,
        },
        {
          name: 'keyUsage',
          keyCertSign: false,
          digitalSignature: certificateType === 'signing',
          nonRepudiation: certificateType === 'signing',
          keyEncipherment: certificateType === 'encryption',
          dataEncipherment: certificateType === 'encryption',
        },
        {
          name: 'extKeyUsage',
          serverAuth: false,
          clientAuth: false,
        },
      ];

      cert.setExtensions(extensions);

      // Self-sign certificate
      cert.sign(keyPair.privateKey, forge.md.sha256.create());

      // Convert to PEM format
      const certificatePem = forge.pki.certificateToPem(cert);
      const privateKeyPem = forge.pki.privateKeyToPem(keyPair.privateKey);

      // Calculate thumbprint
      const thumbprint = this.calculateCertificateThumbprint(cert);

      // Encrypt private key
      const encryptedPrivateKey = this.encryptPrivateKey(privateKeyPem);

      // Store in database
      const samlCert = await this.storeCertificate({
        organization_id: organizationId,
        certificate_type: certificateType,
        certificate: certificatePem,
        private_key_encrypted: encryptedPrivateKey,
        thumbprint,
        is_active: true,
        expires_at: expiryDate,
      });

      this.logger.info('SAML certificate generated and stored', {
        organization_id: organizationId,
        certificate_type: certificateType,
        certificate_id: samlCert.id,
        thumbprint,
        expires_at: expiryDate,
      });

      return samlCert;
    } catch (error) {
      this.logger.error('Failed to generate SAML certificate', {
        organization_id: organizationId,
        certificate_type: certificateType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get active certificate for organization and type
   */
  async getActiveCertificate(
    organizationId: string,
    certificateType: 'signing' | 'encryption'
  ): Promise<SAMLCertificate | null> {
    const query = `
      SELECT * FROM saml_certificates 
      WHERE organization_id = $1 AND certificate_type = $2 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `;

    try {
      const result = await this.db.query(query, [organizationId, certificateType]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToCertificate(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get active certificate', {
        organization_id: organizationId,
        certificate_type: certificateType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get certificate by thumbprint
   */
  async getCertificateByThumbprint(thumbprint: string): Promise<SAMLCertificate | null> {
    const query = `
      SELECT * FROM saml_certificates 
      WHERE thumbprint = $1
    `;

    try {
      const result = await this.db.query(query, [thumbprint]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToCertificate(result.rows[0]);
    } catch (error) {
      this.logger.error('Failed to get certificate by thumbprint', {
        thumbprint,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get all certificates for organization
   */
  async getOrganizationCertificates(organizationId: string): Promise<SAMLCertificate[]> {
    const query = `
      SELECT * FROM saml_certificates 
      WHERE organization_id = $1
      ORDER BY certificate_type, created_at DESC
    `;

    try {
      const result = await this.db.query(query, [organizationId]);
      
      return result.rows.map(row => this.mapRowToCertificate(row));
    } catch (error) {
      this.logger.error('Failed to get organization certificates', {
        organization_id: organizationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate X.509 certificate
   */
  validateCertificate(certificatePem: string): CertificateInfo {
    try {
      const cert = forge.pki.certificateFromPem(certificatePem);
      
      return {
        subject: cert.subject.getField('CN')?.value || 'Unknown',
        issuer: cert.issuer.getField('CN')?.value || 'Unknown',
        serialNumber: cert.serialNumber,
        notBefore: cert.validity.notBefore,
        notAfter: cert.validity.notAfter,
        thumbprint: this.calculateCertificateThumbprint(cert),
        keyUsage: this.extractKeyUsage(cert),
      };
    } catch (error) {
      this.logger.error('Failed to validate certificate', {
        error: error.message,
      });
      throw new Error('Invalid certificate format');
    }
  }

  /**
   * Check if certificate is expired or expiring soon
   */
  checkCertificateExpiry(certificate: SAMLCertificate, warningDays: number = 30): {
    isExpired: boolean;
    isExpiringSoon: boolean;
    daysUntilExpiry: number;
  } {
    const now = new Date();
    const expiryDate = new Date(certificate.expires_at);
    const warningDate = new Date(expiryDate.getTime() - warningDays * 24 * 60 * 60 * 1000);
    
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    return {
      isExpired: now > expiryDate,
      isExpiringSoon: now > warningDate && now <= expiryDate,
      daysUntilExpiry,
    };
  }

  /**
   * Rotate certificate (create new, mark old as inactive)
   */
  async rotateCertificate(
    organizationId: string,
    certificateType: 'signing' | 'encryption',
    commonName: string
  ): Promise<SAMLCertificate> {
    try {
      // Deactivate old certificate
      await this.deactivateOldCertificates(organizationId, certificateType);

      // Generate new certificate
      const newCertificate = await this.generateSAMLCertificate(
        organizationId,
        certificateType,
        commonName
      );

      this.logger.info('Certificate rotated successfully', {
        organization_id: organizationId,
        certificate_type: certificateType,
        new_certificate_id: newCertificate.id,
      });

      return newCertificate;
    } catch (error) {
      this.logger.error('Failed to rotate certificate', {
        organization_id: organizationId,
        certificate_type: certificateType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get decrypted private key
   */
  async getDecryptedPrivateKey(certificate: SAMLCertificate): Promise<string> {
    try {
      return this.decryptPrivateKey(certificate.private_key_encrypted);
    } catch (error) {
      this.logger.error('Failed to decrypt private key', {
        certificate_id: certificate.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Store certificate in database
   */
  private async storeCertificate(cert: Omit<SAMLCertificate, 'id' | 'created_at'>): Promise<SAMLCertificate> {
    const query = `
      INSERT INTO saml_certificates (
        organization_id, certificate_type, certificate, private_key_encrypted,
        thumbprint, is_active, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      cert.organization_id,
      cert.certificate_type,
      cert.certificate,
      cert.private_key_encrypted,
      cert.thumbprint,
      cert.is_active,
      cert.expires_at,
    ]);

    return this.mapRowToCertificate(result.rows[0]);
  }

  /**
   * Deactivate old certificates of the same type
   */
  private async deactivateOldCertificates(
    organizationId: string,
    certificateType: 'signing' | 'encryption'
  ): Promise<void> {
    const query = `
      UPDATE saml_certificates 
      SET is_active = false 
      WHERE organization_id = $1 AND certificate_type = $2 AND is_active = true
    `;

    await this.db.query(query, [organizationId, certificateType]);
  }

  /**
   * Calculate SHA-256 thumbprint of certificate
   */
  private calculateCertificateThumbprint(cert: forge.pki.Certificate): string {
    const derBytes = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const md = forge.md.sha256.create();
    md.update(derBytes);
    return md.digest().toHex().toUpperCase();
  }

  /**
   * Extract key usage from certificate
   */
  private extractKeyUsage(cert: forge.pki.Certificate): string[] {
    const keyUsages: string[] = [];
    
    const keyUsageExt = cert.getExtension('keyUsage');
    if (keyUsageExt) {
      if (keyUsageExt.digitalSignature) keyUsages.push('digitalSignature');
      if (keyUsageExt.nonRepudiation) keyUsages.push('nonRepudiation');
      if (keyUsageExt.keyEncipherment) keyUsages.push('keyEncipherment');
      if (keyUsageExt.dataEncipherment) keyUsages.push('dataEncipherment');
    }

    return keyUsages;
  }

  /**
   * Encrypt private key
   */
  private encryptPrivateKey(privateKeyPem: string): string {
    // In production, use proper encryption with AWS KMS, Azure Key Vault, etc.
    // This is a simple implementation for demonstration
    const cipher = forge.cipher.createCipher('AES-GCM', this.encryptionKey);
    cipher.start({ iv: forge.random.getBytesSync(12) });
    cipher.update(forge.util.createBuffer(privateKeyPem));
    cipher.finish();
    
    return forge.util.encode64(cipher.output.getBytes() + cipher.mode.tag.getBytes());
  }

  /**
   * Decrypt private key
   */
  private decryptPrivateKey(encryptedPrivateKey: string): string {
    // In production, use proper decryption with AWS KMS, Azure Key Vault, etc.
    const encrypted = forge.util.decode64(encryptedPrivateKey);
    const decipher = forge.cipher.createDecipher('AES-GCM', this.encryptionKey);
    
    const encryptedBytes = encrypted.slice(0, -16);
    const tag = encrypted.slice(-16);
    
    decipher.start({ iv: forge.random.getBytesSync(12), tag });
    decipher.update(forge.util.createBuffer(encryptedBytes));
    
    if (decipher.finish()) {
      return decipher.output.toString();
    }
    
    throw new Error('Failed to decrypt private key');
  }

  /**
   * Map database row to certificate object
   */
  private mapRowToCertificate(row: any): SAMLCertificate {
    return {
      id: row.id,
      organization_id: row.organization_id,
      certificate_type: row.certificate_type,
      certificate: row.certificate,
      private_key_encrypted: row.private_key_encrypted,
      thumbprint: row.thumbprint,
      is_active: row.is_active,
      expires_at: row.expires_at,
      created_at: row.created_at,
    };
  }
}