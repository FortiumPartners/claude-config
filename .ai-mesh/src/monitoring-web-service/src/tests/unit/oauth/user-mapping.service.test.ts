/**
 * User Mapping Service Unit Tests
 */

import { UserMappingService } from '../../../auth/oauth/user-mapping.service';
import { DatabaseConnection } from '../../../database/connection';
import * as winston from 'winston';

const mockDb = {
  query: jest.fn(),
  setOrganizationContext: jest.fn(),
  clearOrganizationContext: jest.fn(),
} as unknown as jest.Mocked<DatabaseConnection>;

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as winston.Logger;

describe('UserMappingService', () => {
  let userMappingService: UserMappingService;
  
  beforeEach(() => {
    userMappingService = new UserMappingService(mockDb, mockLogger);
    jest.clearAllMocks();
  });

  const mockProfile = {
    provider_user_id: '123456789',
    email: 'user@company.com',
    name: 'Test User',
    first_name: 'Test',
    last_name: 'User',
    email_verified: true,
    profile_data: {
      hosted_domain: 'company.com',
      groups: ['developers', 'team-alpha'],
    },
  };

  describe('findOrCreateUser', () => {
    it('should return existing user by OAuth identity', async () => {
      const existingUser = {
        id: 'user-123',
        organization_id: 'org-123',
        email: 'user@company.com',
        name: 'Test User',
        role: 'developer',
        is_active: true,
        team_memberships: [],
      };

      mockDb.query.mockResolvedValueOnce({
        rows: [existingUser],
      });

      const result = await userMappingService.findOrCreateUser(
        'org-123',
        'google',
        mockProfile
      );

      expect(result).toEqual({
        user: existingUser,
        is_new_user: false,
        mapping_applied: false,
      });

      expect(mockDb.setOrganizationContext).toHaveBeenCalledWith('org-123');
      expect(mockDb.clearOrganizationContext).toHaveBeenCalled();
    });

    it('should link OAuth identity to existing user by email', async () => {
      const existingUser = {
        id: 'user-123',
        organization_id: 'org-123',
        email: 'user@company.com',
        name: 'Test User',
        role: 'developer',
        is_active: true,
        team_memberships: [],
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // No OAuth identity found
        .mockResolvedValueOnce({ rows: [existingUser] }) // User found by email
        .mockResolvedValueOnce({ rows: [] }); // Link OAuth identity

      const result = await userMappingService.findOrCreateUser(
        'org-123',
        'google',
        mockProfile
      );

      expect(result).toEqual({
        user: existingUser,
        is_new_user: false,
        mapping_applied: false,
      });
    });

    it('should create new user when mapping allows', async () => {
      const newUser = {
        id: 'user-456',
        organization_id: 'org-123',
        email: 'user@company.com',
        name: 'Test User',
        role: 'developer',
        is_active: true,
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // No OAuth identity
        .mockResolvedValueOnce({ rows: [] }) // No user by email
        .mockResolvedValueOnce({ // Mapping rules query
          rows: [{
            id: 'rule-123',
            rule_type: 'email_domain',
            condition: '{"domains": ["company.com"]}',
            target_role: 'developer',
            auto_create_user: true,
            team_assignments: '[]',
            priority: 10,
            is_active: true,
          }],
        })
        .mockResolvedValueOnce({ rows: [newUser] }) // Create user
        .mockResolvedValueOnce({ rows: [] }) // Link OAuth identity
        .mockResolvedValueOnce({ rows: [] }); // Sync team memberships

      const result = await userMappingService.findOrCreateUser(
        'org-123',
        'google',
        mockProfile
      );

      expect(result).toEqual({
        user: newUser,
        is_new_user: true,
        mapping_applied: true,
      });
    });

    it('should reject user creation when mapping disallows', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // No OAuth identity
        .mockResolvedValueOnce({ rows: [] }) // No user by email
        .mockResolvedValueOnce({ // Mapping rules - no auto-create
          rows: [{
            id: 'rule-123',
            rule_type: 'default',
            condition: '{}',
            target_role: 'viewer',
            auto_create_user: false,
            team_assignments: '[]',
            priority: 999,
            is_active: true,
          }],
        });

      await expect(
        userMappingService.findOrCreateUser('org-123', 'google', mockProfile)
      ).rejects.toThrow('User creation not allowed by organization policy');
    });
  });

  describe('evaluateUserMapping', () => {
    beforeEach(() => {
      mockDb.query.mockResolvedValue({
        rows: [],
      });
    });

    it('should apply email domain mapping rule', async () => {
      const mappingRules = [{
        id: 'rule-123',
        rule_type: 'email_domain',
        condition: '{"domains": ["company.com"]}',
        target_role: 'developer',
        auto_create_user: true,
        team_assignments: '["team-123"]',
        priority: 10,
        is_active: true,
      }];

      mockDb.query.mockResolvedValue({ rows: mappingRules });

      const result = await userMappingService.evaluateUserMapping(
        'org-123',
        'google',
        mockProfile
      );

      expect(result).toEqual({
        should_create_user: true,
        user_role: 'developer',
        team_assignments: ['team-123'],
        additional_attributes: {
          applied_rule_id: 'rule-123',
          rule_type: 'email_domain',
        },
      });
    });

    it('should apply group membership mapping rule', async () => {
      const mappingRules = [{
        id: 'rule-456',
        rule_type: 'group_membership',
        condition: '{"required_groups": ["developers"]}',
        target_role: 'admin',
        auto_create_user: true,
        team_assignments: '[]',
        priority: 5,
        is_active: true,
      }];

      mockDb.query.mockResolvedValue({ rows: mappingRules });

      const result = await userMappingService.evaluateUserMapping(
        'org-123',
        'google',
        mockProfile
      );

      expect(result).toEqual({
        should_create_user: true,
        user_role: 'admin',
        team_assignments: [],
        additional_attributes: {
          applied_rule_id: 'rule-456',
          rule_type: 'group_membership',
        },
      });
    });

    it('should apply attribute value mapping rule', async () => {
      const mappingRules = [{
        id: 'rule-789',
        rule_type: 'attribute_value',
        condition: '{"attribute_path": "profile_data.hosted_domain", "expected_value": "company.com"}',
        target_role: 'manager',
        auto_create_user: true,
        team_assignments: '[]',
        priority: 1,
        is_active: true,
      }];

      mockDb.query.mockResolvedValue({ rows: mappingRules });

      const result = await userMappingService.evaluateUserMapping(
        'org-123',
        'google',
        mockProfile
      );

      expect(result).toEqual({
        should_create_user: true,
        user_role: 'manager',
        team_assignments: [],
        additional_attributes: {
          applied_rule_id: 'rule-789',
          rule_type: 'attribute_value',
        },
      });
    });

    it('should fall back to default rule', async () => {
      const mappingRules = [
        {
          id: 'rule-specific',
          rule_type: 'email_domain',
          condition: '{"domains": ["other.com"]}',
          target_role: 'admin',
          auto_create_user: true,
          team_assignments: '[]',
          priority: 10,
          is_active: true,
        },
        {
          id: 'rule-default',
          rule_type: 'default',
          condition: '{}',
          target_role: 'viewer',
          auto_create_user: false,
          team_assignments: '[]',
          priority: 999,
          is_active: true,
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mappingRules });

      const result = await userMappingService.evaluateUserMapping(
        'org-123',
        'google',
        mockProfile
      );

      expect(result).toEqual({
        should_create_user: false,
        user_role: 'viewer',
        team_assignments: [],
        additional_attributes: {
          applied_rule_id: 'rule-default',
          rule_type: 'default',
        },
      });
    });

    it('should respect rule priority order', async () => {
      const mappingRules = [
        {
          id: 'rule-low-priority',
          rule_type: 'default',
          condition: '{}',
          target_role: 'viewer',
          auto_create_user: false,
          team_assignments: '[]',
          priority: 999,
          is_active: true,
        },
        {
          id: 'rule-high-priority',
          rule_type: 'email_domain',
          condition: '{"domains": ["company.com"]}',
          target_role: 'admin',
          auto_create_user: true,
          team_assignments: '[]',
          priority: 1,
          is_active: true,
        },
      ];

      mockDb.query.mockResolvedValue({ rows: mappingRules });

      const result = await userMappingService.evaluateUserMapping(
        'org-123',
        'google',
        mockProfile
      );

      // Should apply the high-priority rule first
      expect(result.user_role).toBe('admin');
      expect(result.additional_attributes.applied_rule_id).toBe('rule-high-priority');
    });
  });

  describe('createUserMappingRule', () => {
    it('should create mapping rule successfully', async () => {
      const ruleData = {
        organization_id: 'org-123',
        provider: 'google',
        rule_type: 'email_domain' as const,
        condition: { domains: ['company.com'] },
        target_role: 'developer' as const,
        auto_create_user: true,
        team_assignments: ['team-123'],
        priority: 10,
      };

      const createdRule = {
        id: 'rule-123',
        ...ruleData,
        condition: JSON.stringify(ruleData.condition),
        team_assignments: JSON.stringify(ruleData.team_assignments),
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockDb.query.mockResolvedValue({ rows: [createdRule] });

      const result = await userMappingService.createUserMappingRule(ruleData);

      expect(result.id).toBe('rule-123');
      expect(result.rule_type).toBe('email_domain');
      expect(result.target_role).toBe('developer');
      expect(mockDb.setOrganizationContext).toHaveBeenCalledWith('org-123');
    });
  });

  describe('syncUserAttributes', () => {
    it('should sync user attributes and update role', async () => {
      const currentUser = {
        id: 'user-123',
        role: 'viewer',
      };

      const mappingResult = {
        should_create_user: true,
        user_role: 'developer',
        team_assignments: ['team-456'],
        additional_attributes: {},
      };

      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // Update user query
        .mockResolvedValueOnce({ rows: [] }) // Update OAuth identity
        .mockResolvedValueOnce({ rows: mappingResult }) // Get mapping rules (mocked)
        .mockResolvedValueOnce({ rows: [currentUser] }) // Find user by ID
        .mockResolvedValueOnce({ rows: [] }) // Update user role
        .mockResolvedValueOnce({ rows: [] }); // Sync team memberships

      // Mock the evaluateUserMapping method
      jest.spyOn(userMappingService, 'evaluateUserMapping')
        .mockResolvedValue({
          should_create_user: true,
          user_role: 'developer',
          team_assignments: ['team-456'],
          additional_attributes: {},
        });

      await userMappingService.syncUserAttributes(
        'user-123',
        'org-123',
        'google',
        mockProfile
      );

      expect(mockDb.setOrganizationContext).toHaveBeenCalledWith('org-123');
      expect(mockDb.clearOrganizationContext).toHaveBeenCalled();
    });
  });

  describe('Rule evaluation logic', () => {
    let evaluateRuleCondition: any;

    beforeEach(() => {
      // Access the private method for testing
      evaluateRuleCondition = (userMappingService as any).evaluateRuleCondition.bind(userMappingService);
    });

    it('should evaluate email domain condition correctly', async () => {
      const condition = { domains: ['company.com', 'partner.com'] };
      
      let result = await evaluateRuleCondition('email_domain', condition, mockProfile);
      expect(result).toBe(true);

      const profileOtherDomain = {
        ...mockProfile,
        email: 'user@other.com',
      };
      result = await evaluateRuleCondition('email_domain', condition, profileOtherDomain);
      expect(result).toBe(false);
    });

    it('should evaluate group membership condition correctly', async () => {
      const condition = { required_groups: ['developers', 'admins'] };
      
      let result = await evaluateRuleCondition('group_membership', condition, mockProfile);
      expect(result).toBe(true);

      const profileNoGroups = {
        ...mockProfile,
        profile_data: { groups: ['users'] },
      };
      result = await evaluateRuleCondition('group_membership', condition, profileNoGroups);
      expect(result).toBe(false);
    });

    it('should evaluate attribute value condition correctly', async () => {
      const condition = {
        attribute_path: 'profile_data.hosted_domain',
        expected_value: 'company.com',
      };
      
      let result = await evaluateRuleCondition('attribute_value', condition, mockProfile);
      expect(result).toBe(true);

      const condition2 = {
        attribute_path: 'profile_data.hosted_domain',
        expected_value: 'other.com',
      };
      result = await evaluateRuleCondition('attribute_value', condition2, mockProfile);
      expect(result).toBe(false);
    });

    it('should always match default condition', async () => {
      const result = await evaluateRuleCondition('default', {}, mockProfile);
      expect(result).toBe(true);
    });

    it('should handle unknown rule types', async () => {
      const result = await evaluateRuleCondition('unknown_type', {}, mockProfile);
      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('getDefaultMappingRules', () => {
    it('should return default mapping rule templates', () => {
      const rules = UserMappingService.getDefaultMappingRules();
      
      expect(rules).toHaveProperty('email_domain_admin');
      expect(rules).toHaveProperty('email_domain_developer');
      expect(rules).toHaveProperty('default_viewer');
      
      expect(rules.email_domain_admin.target_role).toBe('admin');
      expect(rules.email_domain_developer.target_role).toBe('developer');
      expect(rules.default_viewer.target_role).toBe('viewer');
      expect(rules.default_viewer.auto_create_user).toBe(false);
    });
  });
});