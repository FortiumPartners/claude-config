/**
 * OAuth User Mapping Service
 * Handles mapping OAuth user profiles to internal user models
 */

import * as winston from 'winston';
import { DatabaseConnection } from '../../database/connection';
import { UserRole } from '../../services/jwt.service';
import { OAuthUserProfile } from './oauth.factory';

export interface UserMappingRule {
  id: string;
  organization_id: string;
  provider: string;
  rule_type: 'email_domain' | 'group_membership' | 'attribute_value' | 'default';
  condition: string; // JSON string with rule conditions
  target_role: UserRole;
  auto_create_user: boolean;
  team_assignments: string[]; // Team IDs to assign user to
  is_active: boolean;
  priority: number; // Lower number = higher priority
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserMappingRuleRequest {
  organization_id: string;
  provider: string;
  rule_type: 'email_domain' | 'group_membership' | 'attribute_value' | 'default';
  condition: Record<string, any>;
  target_role: UserRole;
  auto_create_user?: boolean;
  team_assignments?: string[];
  priority?: number;
}

export interface UserMappingResult {
  should_create_user: boolean;
  user_role: UserRole;
  team_assignments: string[];
  additional_attributes: Record<string, any>;
}

export interface ExistingUser {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  external_id?: string;
  external_provider?: string;
  team_memberships?: Array<{
    team_id: string;
    team_role: string;
  }>;
}

export class UserMappingService {
  private db: DatabaseConnection;
  private logger: winston.Logger;

  constructor(db: DatabaseConnection, logger: winston.Logger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Find or create user from OAuth profile
   */
  async findOrCreateUser(
    organizationId: string,
    provider: string,
    profile: OAuthUserProfile
  ): Promise<{
    user: ExistingUser;
    is_new_user: boolean;
    mapping_applied: boolean;
  }> {
    await this.db.setOrganizationContext(organizationId);

    try {
      // First, try to find existing user by OAuth identity
      let user = await this.findUserByOAuthIdentity(organizationId, provider, profile.provider_user_id);
      
      if (user) {
        // Update OAuth identity with latest profile data
        await this.updateOAuthIdentity(user.id, organizationId, provider, profile);
        
        return {
          user,
          is_new_user: false,
          mapping_applied: false,
        };
      }

      // Try to find by email (for linking existing accounts)
      user = await this.findUserByEmail(organizationId, profile.email);
      
      if (user) {
        // Link OAuth identity to existing user
        await this.linkOAuthIdentity(user.id, organizationId, provider, profile);
        
        return {
          user,
          is_new_user: false,
          mapping_applied: false,
        };
      }

      // No existing user found, determine if we should create one
      const mappingResult = await this.evaluateUserMapping(organizationId, provider, profile);
      
      if (!mappingResult.should_create_user) {
        throw new Error('User creation not allowed by organization policy');
      }

      // Create new user
      user = await this.createUser(organizationId, provider, profile, mappingResult);
      
      return {
        user,
        is_new_user: true,
        mapping_applied: true,
      };

    } finally {
      await this.db.clearOrganizationContext();
    }
  }

  /**
   * Evaluate user mapping rules to determine user attributes
   */
  async evaluateUserMapping(
    organizationId: string,
    provider: string,
    profile: OAuthUserProfile
  ): Promise<UserMappingResult> {
    const rules = await this.getUserMappingRules(organizationId, provider);
    
    let result: UserMappingResult = {
      should_create_user: false,
      user_role: 'viewer', // Default role
      team_assignments: [],
      additional_attributes: {},
    };

    // Sort rules by priority (lower number = higher priority)
    const sortedRules = rules.sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      try {
        const condition = JSON.parse(rule.condition);
        const matches = await this.evaluateRuleCondition(rule.rule_type, condition, profile);
        
        if (matches) {
          result = {
            should_create_user: rule.auto_create_user,
            user_role: rule.target_role,
            team_assignments: rule.team_assignments,
            additional_attributes: {
              ...result.additional_attributes,
              applied_rule_id: rule.id,
              rule_type: rule.rule_type,
            },
          };

          this.logger.info('User mapping rule applied', {
            organization_id: organizationId,
            provider,
            rule_id: rule.id,
            rule_type: rule.rule_type,
            email: profile.email,
            assigned_role: rule.target_role,
          });

          break; // Stop at first matching rule (highest priority)
        }
      } catch (error) {
        this.logger.error('Error evaluating user mapping rule', {
          rule_id: rule.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          organization_id: organizationId,
          provider,
        });
      }
    }

    return result;
  }

  /**
   * Create user mapping rule
   */
  async createUserMappingRule(request: CreateUserMappingRuleRequest): Promise<UserMappingRule> {
    await this.db.setOrganizationContext(request.organization_id);

    try {
      const query = `
        INSERT INTO user_mapping_rules (
          organization_id, provider, rule_type, condition, target_role,
          auto_create_user, team_assignments, priority, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        RETURNING *
      `;

      const result = await this.db.query(query, [
        request.organization_id,
        request.provider,
        request.rule_type,
        JSON.stringify(request.condition),
        request.target_role,
        request.auto_create_user !== false,
        JSON.stringify(request.team_assignments || []),
        request.priority || 100,
      ]);

      const rule = this.mapRowToMappingRule(result.rows[0]);

      this.logger.info('User mapping rule created', {
        organization_id: request.organization_id,
        provider: request.provider,
        rule_type: request.rule_type,
        target_role: request.target_role,
      });

      return rule;
    } finally {
      await this.db.clearOrganizationContext();
    }
  }

  /**
   * Sync user attributes from OAuth profile
   */
  async syncUserAttributes(
    userId: string,
    organizationId: string,
    provider: string,
    profile: OAuthUserProfile
  ): Promise<void> {
    await this.db.setOrganizationContext(organizationId);

    try {
      // Update basic user information
      const updateQuery = `
        UPDATE users 
        SET name = $2, updated_at = NOW()
        WHERE id = $1 AND organization_id = $3
      `;

      await this.db.query(updateQuery, [userId, profile.name, organizationId]);

      // Update OAuth identity
      await this.updateOAuthIdentity(userId, organizationId, provider, profile);

      // Re-evaluate mapping rules to check for role/team changes
      const mappingResult = await this.evaluateUserMapping(organizationId, provider, profile);
      
      // Update user role if mapping rules suggest a change
      const currentUser = await this.findUserById(userId);
      if (currentUser && currentUser.role !== mappingResult.user_role) {
        await this.updateUserRole(userId, mappingResult.user_role);
        
        this.logger.info('User role updated via mapping sync', {
          user_id: userId,
          old_role: currentUser.role,
          new_role: mappingResult.user_role,
          provider,
        });
      }

      // Sync team assignments (simplified - would need more complex logic in production)
      await this.syncTeamMemberships(userId, mappingResult.team_assignments);

      this.logger.info('User attributes synced from OAuth', {
        user_id: userId,
        provider,
        email: profile.email,
      });

    } finally {
      await this.db.clearOrganizationContext();
    }
  }

  // Private helper methods

  private async findUserByOAuthIdentity(
    organizationId: string,
    provider: string,
    providerUserId: string
  ): Promise<ExistingUser | null> {
    const query = `
      SELECT u.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'team_id', tm.team_id,
                   'team_role', tm.role
                 )
               ) FILTER (WHERE tm.team_id IS NOT NULL),
               '[]'::json
             ) as team_memberships
      FROM users u
      LEFT JOIN user_oauth_identities uoi ON u.id = uoi.user_id
      LEFT JOIN team_memberships tm ON u.id = tm.user_id
      WHERE u.organization_id = $1 
        AND uoi.provider = $2 
        AND uoi.provider_user_id = $3
        AND u.is_active = true
      GROUP BY u.id
    `;

    const result = await this.db.query(query, [organizationId, provider, providerUserId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  private async findUserByEmail(organizationId: string, email: string): Promise<ExistingUser | null> {
    const query = `
      SELECT u.*, 
             COALESCE(
               json_agg(
                 json_build_object(
                   'team_id', tm.team_id,
                   'team_role', tm.role
                 )
               ) FILTER (WHERE tm.team_id IS NOT NULL),
               '[]'::json
             ) as team_memberships
      FROM users u
      LEFT JOIN team_memberships tm ON u.id = tm.user_id
      WHERE u.organization_id = $1 AND u.email = $2 AND u.is_active = true
      GROUP BY u.id
    `;

    const result = await this.db.query(query, [organizationId, email]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  private async findUserById(userId: string): Promise<ExistingUser | null> {
    const query = `
      SELECT * FROM users WHERE id = $1
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  private async createUser(
    organizationId: string,
    provider: string,
    profile: OAuthUserProfile,
    mapping: UserMappingResult
  ): Promise<ExistingUser> {
    const query = `
      INSERT INTO users (
        organization_id, email, name, role, external_id, external_provider,
        is_active, email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, true, $7)
      RETURNING *
    `;

    const result = await this.db.query(query, [
      organizationId,
      profile.email,
      profile.name,
      mapping.user_role,
      profile.provider_user_id,
      provider,
      profile.email_verified,
    ]);

    const user = result.rows[0];

    // Create OAuth identity
    await this.linkOAuthIdentity(user.id, organizationId, provider, profile);

    // Assign to teams
    await this.syncTeamMemberships(user.id, mapping.team_assignments);

    this.logger.info('User created from OAuth profile', {
      user_id: user.id,
      organization_id: organizationId,
      provider,
      email: profile.email,
      role: mapping.user_role,
    });

    return user;
  }

  private async linkOAuthIdentity(
    userId: string,
    organizationId: string,
    provider: string,
    profile: OAuthUserProfile
  ): Promise<void> {
    const query = `
      INSERT INTO user_oauth_identities (
        user_id, organization_id, provider, provider_user_id,
        email, name, picture_url, profile_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, provider) DO UPDATE SET
        provider_user_id = EXCLUDED.provider_user_id,
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        picture_url = EXCLUDED.picture_url,
        profile_data = EXCLUDED.profile_data,
        last_sync_at = NOW()
    `;

    await this.db.query(query, [
      userId,
      organizationId,
      provider,
      profile.provider_user_id,
      profile.email,
      profile.name,
      profile.picture,
      JSON.stringify(profile.profile_data),
    ]);
  }

  private async updateOAuthIdentity(
    userId: string,
    organizationId: string,
    provider: string,
    profile: OAuthUserProfile
  ): Promise<void> {
    await this.linkOAuthIdentity(userId, organizationId, provider, profile);
  }

  private async getUserMappingRules(
    organizationId: string,
    provider: string
  ): Promise<UserMappingRule[]> {
    const query = `
      SELECT * FROM user_mapping_rules
      WHERE organization_id = $1 
        AND (provider = $2 OR provider = '*')
        AND is_active = true
      ORDER BY priority ASC
    `;

    const result = await this.db.query(query, [organizationId, provider]);
    return result.rows.map(row => this.mapRowToMappingRule(row));
  }

  private async evaluateRuleCondition(
    ruleType: string,
    condition: Record<string, any>,
    profile: OAuthUserProfile
  ): Promise<boolean> {
    switch (ruleType) {
      case 'email_domain':
        const domain = profile.email.split('@')[1];
        return condition.domains?.includes(domain) || condition.domain === domain;

      case 'group_membership':
        const userGroups = profile.profile_data?.groups || [];
        return condition.required_groups?.some((group: string) => 
          userGroups.includes(group)
        );

      case 'attribute_value':
        const attrPath = condition.attribute_path;
        const expectedValue = condition.expected_value;
        const actualValue = this.getNestedAttribute(profile, attrPath);
        return actualValue === expectedValue;

      case 'default':
        return true; // Default rule always matches

      default:
        this.logger.warn('Unknown mapping rule type', { rule_type: ruleType });
        return false;
    }
  }

  private getNestedAttribute(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async updateUserRole(userId: string, newRole: UserRole): Promise<void> {
    const query = `
      UPDATE users 
      SET role = $2, updated_at = NOW()
      WHERE id = $1
    `;

    await this.db.query(query, [userId, newRole]);
  }

  private async syncTeamMemberships(userId: string, teamIds: string[]): Promise<void> {
    if (teamIds.length === 0) return;

    // This is simplified - in production you'd want more sophisticated team sync logic
    for (const teamId of teamIds) {
      const query = `
        INSERT INTO team_memberships (team_id, user_id, role)
        VALUES ($1, $2, 'member')
        ON CONFLICT (team_id, user_id) DO NOTHING
      `;

      await this.db.query(query, [teamId, userId]);
    }
  }

  private mapRowToMappingRule(row: any): UserMappingRule {
    return {
      id: row.id,
      organization_id: row.organization_id,
      provider: row.provider,
      rule_type: row.rule_type,
      condition: row.condition,
      target_role: row.target_role,
      auto_create_user: row.auto_create_user,
      team_assignments: JSON.parse(row.team_assignments),
      is_active: row.is_active,
      priority: row.priority,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /**
   * Get default mapping rules for common scenarios
   */
  static getDefaultMappingRules() {
    return {
      email_domain_admin: {
        rule_type: 'email_domain',
        condition: { domains: ['admin.company.com'] },
        target_role: 'admin',
        auto_create_user: true,
        priority: 10,
      },
      email_domain_developer: {
        rule_type: 'email_domain',
        condition: { domains: ['company.com'] },
        target_role: 'developer',
        auto_create_user: true,
        priority: 20,
      },
      default_viewer: {
        rule_type: 'default',
        condition: {},
        target_role: 'viewer',
        auto_create_user: false,
        priority: 999,
      },
    };
  }
}