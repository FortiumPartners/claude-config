/**
 * SAML Attribute Mapper
 * Maps SAML attributes to internal user model
 */

import * as winston from 'winston';
import { SAMLAssertion } from './saml.service';
import { AttributeMapping } from './saml-config.service';

export interface MappedUserProfile {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  groups: string[];
  department?: string;
  title?: string;
  phoneNumber?: string;
  locale?: string;
  attributes: { [key: string]: any };
}

export interface MappingOptions {
  defaultRole?: string;
  groupMapping?: { [samlGroup: string]: string };
  requiredGroups?: string[];
  roleMapping?: { [samlGroup: string]: string };
}

export class AttributeMapper {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  /**
   * Map SAML assertion attributes to user profile
   */
  mapAttributes(
    assertion: SAMLAssertion,
    attributeMapping: AttributeMapping,
    options: MappingOptions = {}
  ): MappedUserProfile {
    try {
      this.logger.debug('Mapping SAML attributes to user profile', {
        assertion_id: assertion.id,
        available_attributes: Object.keys(assertion.attributes || {}),
      });

      const attributes = assertion.attributes || {};

      // Map core user attributes
      const email = this.extractAttribute(attributes, attributeMapping.email);
      const firstName = this.extractAttribute(attributes, attributeMapping.firstName);
      const lastName = this.extractAttribute(attributes, attributeMapping.lastName);

      if (!email) {
        throw new Error('Email attribute is required but not found in assertion');
      }

      if (!firstName || !lastName) {
        this.logger.warn('Name attributes missing from SAML assertion', {
          has_first_name: !!firstName,
          has_last_name: !!lastName,
        });
      }

      // Build display name
      const displayName = this.buildDisplayName(firstName, lastName, email);

      // Map groups
      const groups = this.mapGroups(attributes, attributeMapping.groups, options.groupMapping);

      // Validate required groups
      if (options.requiredGroups && options.requiredGroups.length > 0) {
        this.validateRequiredGroups(groups, options.requiredGroups);
      }

      // Map optional attributes
      const department = attributeMapping.department
        ? this.extractAttribute(attributes, attributeMapping.department)
        : undefined;

      // Map additional attributes
      const additionalAttributes = this.mapAdditionalAttributes(attributes, attributeMapping);

      const mappedProfile: MappedUserProfile = {
        email,
        firstName: firstName || '',
        lastName: lastName || '',
        displayName,
        groups,
        department,
        title: additionalAttributes.title,
        phoneNumber: additionalAttributes.phoneNumber,
        locale: additionalAttributes.locale,
        attributes: {
          nameId: assertion.subject.nameId,
          nameIdFormat: assertion.subject.nameIdFormat,
          sessionIndex: assertion.authnStatement.sessionIndex,
          issuer: assertion.issuer,
          ...additionalAttributes.raw,
        },
      };

      this.logger.info('SAML attributes mapped successfully', {
        assertion_id: assertion.id,
        email: mappedProfile.email,
        display_name: mappedProfile.displayName,
        group_count: mappedProfile.groups.length,
        has_department: !!mappedProfile.department,
      });

      return mappedProfile;
    } catch (error) {
      this.logger.error('Failed to map SAML attributes', {
        assertion_id: assertion.id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Determine user role from SAML groups
   */
  determineUserRole(
    groups: string[],
    roleMapping: { [samlGroup: string]: string } = {},
    defaultRole: string = 'developer'
  ): string {
    // Check for explicit role mappings first
    for (const group of groups) {
      if (roleMapping[group]) {
        this.logger.debug('Role determined from group mapping', {
          group,
          role: roleMapping[group],
        });
        return roleMapping[group];
      }
    }

    // Check for common role patterns in group names
    const rolePatterns = {
      owner: /owner|admin|administrator/i,
      admin: /admin|administrator|superuser/i,
      manager: /manager|lead|supervisor/i,
      developer: /developer|dev|engineer/i,
      viewer: /viewer|read[-_]?only|guest/i,
    };

    for (const group of groups) {
      for (const [role, pattern] of Object.entries(rolePatterns)) {
        if (pattern.test(group)) {
          this.logger.debug('Role determined from pattern matching', {
            group,
            pattern: pattern.source,
            role,
          });
          return role;
        }
      }
    }

    this.logger.debug('Using default role', {
      groups,
      default_role: defaultRole,
    });

    return defaultRole;
  }

  /**
   * Validate user eligibility based on SAML attributes
   */
  validateUserEligibility(
    mappedProfile: MappedUserProfile,
    validationRules: {
      requiredGroups?: string[];
      allowedDomains?: string[];
      requiredAttributes?: string[];
      blockedGroups?: string[];
    } = {}
  ): { isEligible: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Check required groups
    if (validationRules.requiredGroups && validationRules.requiredGroups.length > 0) {
      const hasRequiredGroup = validationRules.requiredGroups.some(group =>
        mappedProfile.groups.includes(group)
      );
      if (!hasRequiredGroup) {
        reasons.push(`User must be member of one of: ${validationRules.requiredGroups.join(', ')}`);
      }
    }

    // Check blocked groups
    if (validationRules.blockedGroups && validationRules.blockedGroups.length > 0) {
      const hasBlockedGroup = validationRules.blockedGroups.some(group =>
        mappedProfile.groups.includes(group)
      );
      if (hasBlockedGroup) {
        const blockedGroups = mappedProfile.groups.filter(group =>
          validationRules.blockedGroups!.includes(group)
        );
        reasons.push(`User is member of blocked group(s): ${blockedGroups.join(', ')}`);
      }
    }

    // Check allowed email domains
    if (validationRules.allowedDomains && validationRules.allowedDomains.length > 0) {
      const domain = mappedProfile.email.split('@')[1]?.toLowerCase();
      if (!domain || !validationRules.allowedDomains.includes(domain)) {
        reasons.push(`Email domain '${domain}' not in allowed domains: ${validationRules.allowedDomains.join(', ')}`);
      }
    }

    // Check required attributes
    if (validationRules.requiredAttributes && validationRules.requiredAttributes.length > 0) {
      for (const requiredAttr of validationRules.requiredAttributes) {
        if (!mappedProfile.attributes[requiredAttr]) {
          reasons.push(`Required attribute missing: ${requiredAttr}`);
        }
      }
    }

    const isEligible = reasons.length === 0;

    this.logger.info('User eligibility validation completed', {
      email: mappedProfile.email,
      is_eligible: isEligible,
      reasons,
    });

    return { isEligible, reasons };
  }

  /**
   * Create default attribute mapping for provider
   */
  static createDefaultMapping(provider: string): AttributeMapping {
    const defaultMappings: { [provider: string]: AttributeMapping } = {
      'okta-saml': {
        email: 'email',
        firstName: 'firstName',
        lastName: 'lastName',
        groups: ['groups'],
        department: 'department',
      },
      'azure-saml': {
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        groups: ['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'],
        department: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/department',
      },
      'generic-saml': {
        email: 'email',
        firstName: 'givenName',
        lastName: 'sn',
        groups: ['memberOf'],
      },
    };

    return defaultMappings[provider] || defaultMappings['generic-saml'];
  }

  /**
   * Extract attribute value from SAML attributes
   */
  private extractAttribute(
    attributes: { [key: string]: string | string[] },
    mapping: string | string[]
  ): string | undefined {
    const mappingArray = Array.isArray(mapping) ? mapping : [mapping];

    for (const attributeName of mappingArray) {
      const value = attributes[attributeName];
      if (value !== undefined) {
        return Array.isArray(value) ? value[0] : value;
      }
    }

    return undefined;
  }

  /**
   * Map SAML groups to internal groups
   */
  private mapGroups(
    attributes: { [key: string]: string | string[] },
    groupsMapping: string[],
    groupMapping?: { [samlGroup: string]: string }
  ): string[] {
    const allGroups: string[] = [];

    // Extract all group values from different group attributes
    for (const groupAttribute of groupsMapping) {
      const groupValue = attributes[groupAttribute];
      if (groupValue) {
        const groups = Array.isArray(groupValue) ? groupValue : [groupValue];
        allGroups.push(...groups);
      }
    }

    // Apply group mapping if provided
    if (groupMapping) {
      return allGroups
        .map(group => groupMapping[group] || group)
        .filter((group, index, array) => array.indexOf(group) === index); // Remove duplicates
    }

    return [...new Set(allGroups)]; // Remove duplicates
  }

  /**
   * Validate required groups
   */
  private validateRequiredGroups(userGroups: string[], requiredGroups: string[]): void {
    const hasRequiredGroup = requiredGroups.some(group => userGroups.includes(group));
    if (!hasRequiredGroup) {
      throw new Error(`User must be member of at least one required group: ${requiredGroups.join(', ')}`);
    }
  }

  /**
   * Build display name from name components
   */
  private buildDisplayName(firstName?: string, lastName?: string, email?: string): string {
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    } else if (email) {
      return email.split('@')[0];
    } else {
      return 'Unknown User';
    }
  }

  /**
   * Map additional attributes beyond core user profile
   */
  private mapAdditionalAttributes(
    attributes: { [key: string]: string | string[] },
    attributeMapping: AttributeMapping
  ): {
    title?: string;
    phoneNumber?: string;
    locale?: string;
    raw: { [key: string]: any };
  } {
    const commonAttributes = ['title', 'jobTitle', 'phone', 'phoneNumber', 'locale', 'language'];
    const additional: any = {};
    const raw: { [key: string]: any } = {};

    // Extract common attributes
    for (const [key, value] of Object.entries(attributes)) {
      // Store all attributes in raw
      raw[key] = value;

      // Extract specific common attributes
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      if (normalizedKey.includes('title') || normalizedKey.includes('jobtitle')) {
        additional.title = Array.isArray(value) ? value[0] : value;
      } else if (normalizedKey.includes('phone')) {
        additional.phoneNumber = Array.isArray(value) ? value[0] : value;
      } else if (normalizedKey.includes('locale') || normalizedKey.includes('language')) {
        additional.locale = Array.isArray(value) ? value[0] : value;
      }
    }

    return { ...additional, raw };
  }
}