/**
 * Unit tests for version-compatibility module
 * Target: 80% code coverage
 *
 * Related: TRD-008, docs/TRD/skills-based-framework-agents-trd.md
 */

const {
  parseVersion,
  compareVersions,
  satisfiesRange,
  validateSkillCompatibility,
  validateFrameworkVersion
} = require('../version-compatibility');

describe('version-compatibility', () => {
  describe('parseVersion()', () => {
    test('should parse standard semver', () => {
      const version = parseVersion('1.2.3');

      expect(version.major).toBe(1);
      expect(version.minor).toBe(2);
      expect(version.patch).toBe(3);
      expect(version.wildcard).toBe(false);
    });

    test('should parse partial versions as wildcards', () => {
      const v1 = parseVersion('1.2');
      expect(v1.major).toBe(1);
      expect(v1.minor).toBe(2);
      expect(v1.patch).toBe(Infinity); // Partial versions treated as wildcards

      const v2 = parseVersion('3');
      expect(v2.major).toBe(3);
      expect(v2.minor).toBe(Infinity);
      expect(v2.patch).toBe(Infinity);
    });

    test('should parse wildcard versions', () => {
      const v1 = parseVersion('*');
      expect(v1.wildcard).toBe(true);

      const v2 = parseVersion('1.x');
      expect(v2.major).toBe(1);
      expect(v2.minor).toBe(Infinity);
      expect(v2.wildcard).toBe(true);

      const v3 = parseVersion('2.3.x');
      expect(v3.major).toBe(2);
      expect(v3.minor).toBe(3);
      expect(v3.patch).toBe(Infinity);
      expect(v3.wildcard).toBe(true);
    });

    test('should throw error for invalid version', () => {
      expect(() => parseVersion('invalid')).toThrow('Invalid version format');
      expect(() => parseVersion(null)).toThrow('Invalid version');
      expect(() => parseVersion('')).toThrow('Invalid version');
    });
  });

  describe('compareVersions()', () => {
    test('should return -1 when v1 < v2', () => {
      const v1 = parseVersion('1.0.0');
      const v2 = parseVersion('2.0.0');

      expect(compareVersions(v1, v2)).toBe(-1);
    });

    test('should return 1 when v1 > v2', () => {
      const v1 = parseVersion('2.0.0');
      const v2 = parseVersion('1.0.0');

      expect(compareVersions(v1, v2)).toBe(1);
    });

    test('should return 0 when v1 === v2', () => {
      const v1 = parseVersion('1.2.3');
      const v2 = parseVersion('1.2.3');

      expect(compareVersions(v1, v2)).toBe(0);
    });

    test('should compare minor versions correctly', () => {
      const v1 = parseVersion('1.1.0');
      const v2 = parseVersion('1.2.0');

      expect(compareVersions(v1, v2)).toBe(-1);
    });

    test('should compare patch versions correctly', () => {
      const v1 = parseVersion('1.2.3');
      const v2 = parseVersion('1.2.4');

      expect(compareVersions(v1, v2)).toBe(-1);
    });

    test('should return 0 for wildcards', () => {
      const v1 = parseVersion('1.2.3');
      const v2 = parseVersion('*');

      expect(compareVersions(v1, v2)).toBe(0);
    });
  });

  describe('satisfiesRange()', () => {
    describe('Exact match', () => {
      test('should match exact versions', () => {
        expect(satisfiesRange('1.2.3', '1.2.3')).toBe(true);
        expect(satisfiesRange('1.2.3', '1.2.4')).toBe(false);
      });
    });

    describe('>= operator', () => {
      test('should match >= range', () => {
        expect(satisfiesRange('2.0.0', '>=1.0.0')).toBe(true);
        expect(satisfiesRange('1.0.0', '>=1.0.0')).toBe(true);
        expect(satisfiesRange('0.9.0', '>=1.0.0')).toBe(false);
      });
    });

    describe('> operator', () => {
      test('should match > range', () => {
        expect(satisfiesRange('2.0.0', '>1.0.0')).toBe(true);
        expect(satisfiesRange('1.0.0', '>1.0.0')).toBe(false);
        expect(satisfiesRange('0.9.0', '>1.0.0')).toBe(false);
      });
    });

    describe('<= operator', () => {
      test('should match <= range', () => {
        expect(satisfiesRange('1.0.0', '<=2.0.0')).toBe(true);
        expect(satisfiesRange('2.0.0', '<=2.0.0')).toBe(true);
        expect(satisfiesRange('3.0.0', '<=2.0.0')).toBe(false);
      });
    });

    describe('< operator', () => {
      test('should match < range', () => {
        expect(satisfiesRange('1.0.0', '<2.0.0')).toBe(true);
        expect(satisfiesRange('2.0.0', '<2.0.0')).toBe(false);
        expect(satisfiesRange('3.0.0', '<2.0.0')).toBe(false);
      });
    });

    describe('^ operator (caret)', () => {
      test('should match compatible versions for major > 0', () => {
        expect(satisfiesRange('1.2.3', '^1.2.3')).toBe(true);
        expect(satisfiesRange('1.2.4', '^1.2.3')).toBe(true);
        expect(satisfiesRange('1.3.0', '^1.2.3')).toBe(true);
        expect(satisfiesRange('2.0.0', '^1.2.3')).toBe(false);
      });

      test('should match compatible versions for 0.x', () => {
        expect(satisfiesRange('0.2.3', '^0.2.3')).toBe(true);
        expect(satisfiesRange('0.2.4', '^0.2.3')).toBe(true);
        expect(satisfiesRange('0.3.0', '^0.2.3')).toBe(false);
      });

      test('should match exact version for 0.0.x', () => {
        expect(satisfiesRange('0.0.3', '^0.0.3')).toBe(true);
        expect(satisfiesRange('0.0.4', '^0.0.3')).toBe(false);
      });
    });

    describe('~ operator (tilde)', () => {
      test('should match approximately equivalent versions', () => {
        expect(satisfiesRange('1.2.3', '~1.2.3')).toBe(true);
        expect(satisfiesRange('1.2.4', '~1.2.3')).toBe(true);
        expect(satisfiesRange('1.3.0', '~1.2.3')).toBe(false);
        expect(satisfiesRange('2.0.0', '~1.2.3')).toBe(false);
      });
    });

    describe('Wildcard', () => {
      test('should match any version for *', () => {
        expect(satisfiesRange('1.2.3', '*')).toBe(true);
        expect(satisfiesRange('0.0.1', '*')).toBe(true);
        expect(satisfiesRange('99.99.99', '*')).toBe(true);
      });

      test('should match any version when no range specified', () => {
        expect(satisfiesRange('1.2.3', '')).toBe(true);
        expect(satisfiesRange('1.2.3', null)).toBe(true);
      });
    });

    describe('Error handling', () => {
      test('should throw for invalid version format in range', () => {
        expect(() => satisfiesRange('1.2.3', '!1.0.0')).toThrow('Invalid version format');
      });
    });
  });

  describe('validateSkillCompatibility()', () => {
    test('should pass when no requirements specified', () => {
      const result = validateSkillCompatibility({}, 'backend-developer', '3.0.0');

      expect(result.compatible).toBe(true);
      expect(result.reason).toContain('No compatibility requirements');
    });

    test('should pass when agent not in requirements', () => {
      const frontmatter = {
        compatible_agents: {
          'other-agent': '>=1.0.0'
        }
      };

      const result = validateSkillCompatibility(frontmatter, 'backend-developer', '3.0.0');

      expect(result.compatible).toBe(true);
      expect(result.reason).toContain('No requirement specified');
    });

    test('should pass when version satisfies requirement', () => {
      const frontmatter = {
        compatible_agents: {
          'backend-developer': '>=3.0.0'
        }
      };

      const result = validateSkillCompatibility(frontmatter, 'backend-developer', '3.1.0');

      expect(result.compatible).toBe(true);
      expect(result.reason).toContain('satisfies requirement');
      expect(result.agentName).toBe('backend-developer');
      expect(result.agentVersion).toBe('3.1.0');
      expect(result.requiredRange).toBe('>=3.0.0');
    });

    test('should fail when version does not satisfy requirement', () => {
      const frontmatter = {
        compatible_agents: {
          'backend-developer': '>=3.0.0'
        }
      };

      const result = validateSkillCompatibility(frontmatter, 'backend-developer', '2.0.0');

      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('does not satisfy requirement');
    });

    test('should handle invalid version range', () => {
      const frontmatter = {
        compatible_agents: {
          'backend-developer': 'invalid-range'
        }
      };

      const result = validateSkillCompatibility(frontmatter, 'backend-developer', '3.0.0');

      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('Invalid version format');
    });
  });

  describe('validateFrameworkVersion()', () => {
    test('should pass when no requirements specified', () => {
      const result = validateFrameworkVersion({}, '11.0.0');

      expect(result.compatible).toBe(true);
      expect(result.reason).toContain('No framework version requirements');
    });

    test('should pass when version meets minimum requirement', () => {
      const frontmatter = {
        framework_versions: {
          min: '10.0.0',
          recommended: '11.4.0'
        }
      };

      const result = validateFrameworkVersion(frontmatter, '11.0.0');

      expect(result.compatible).toBe(true);
      expect(result.warnings).toBeDefined();
    });

    test('should fail when version below minimum', () => {
      const frontmatter = {
        framework_versions: {
          min: '10.0.0'
        }
      };

      const result = validateFrameworkVersion(frontmatter, '9.0.0');

      expect(result.compatible).toBe(false);
      expect(result.reason).toContain('below minimum');
    });

    test('should warn when version exceeds maximum', () => {
      const frontmatter = {
        framework_versions: {
          min: '10.0.0',
          max: '11.x',
          recommended: '11.4.0'
        }
      };

      const result = validateFrameworkVersion(frontmatter, '12.0.0');

      expect(result.compatible).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('differs from recommended'))).toBe(true);
    });

    test('should warn when version differs from recommended', () => {
      const frontmatter = {
        framework_versions: {
          min: '10.0.0',
          recommended: '11.4.0'
        }
      };

      const result = validateFrameworkVersion(frontmatter, '11.0.0');

      expect(result.compatible).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('differs from recommended'))).toBe(true);
    });

    test('should include version details in result', () => {
      const frontmatter = {
        framework_versions: {
          min: '10.0.0',
          max: '11.x',
          recommended: '11.4.0'
        }
      };

      const result = validateFrameworkVersion(frontmatter, '11.0.0');

      expect(result.detectedVersion).toBe('11.0.0');
      expect(result.minVersion).toBe('10.0.0');
      expect(result.maxVersion).toBe('11.x');
      expect(result.recommendedVersion).toBe('11.4.0');
    });

    test('should handle invalid framework version', () => {
      const frontmatter = {
        framework_versions: {
          min: '10.0.0'
        }
      };

      const result = validateFrameworkVersion(frontmatter, 'invalid');

      expect(result.compatible).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Integration tests', () => {
    test('should validate complex compatibility scenario', () => {
      const frontmatter = {
        compatible_agents: {
          'backend-developer': '^3.0.0',
          'frontend-developer': '>=2.5.0'
        },
        framework_versions: {
          min: '10.0.0',
          max: '12.x',
          recommended: '11.4.0'
        }
      };

      // Test backend-developer compatibility
      const backendResult = validateSkillCompatibility(
        frontmatter,
        'backend-developer',
        '3.1.0'
      );
      expect(backendResult.compatible).toBe(true);

      // Test frontend-developer compatibility
      const frontendResult = validateSkillCompatibility(
        frontmatter,
        'frontend-developer',
        '2.8.0'
      );
      expect(frontendResult.compatible).toBe(true);

      // Test framework version
      const frameworkResult = validateFrameworkVersion(frontmatter, '11.2.0');
      expect(frameworkResult.compatible).toBe(true);
      expect(frameworkResult.warnings.length).toBeGreaterThan(0);
    });
  });
});
