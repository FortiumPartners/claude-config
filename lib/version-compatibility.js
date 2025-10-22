/**
 * Version Compatibility Validator
 *
 * Comprehensive semantic versioning compatibility checker for skills and agents.
 * Supports all common semver range operators: >=, >, <=, <, ^, ~, exact, *, x
 *
 * Related: TRD-006, docs/TRD/skills-based-framework-agents-trd.md
 */

/**
 * Parse a semantic version string into components
 * @param {string} version - Version string (e.g., "1.2.3", "2.0", "3.x")
 * @returns {Object} Parsed version with major, minor, patch
 */
function parseVersion(version) {
  if (!version || typeof version !== 'string') {
    throw new Error(`Invalid version: ${version}`);
  }

  // Handle wildcards
  if (version === '*' || version === 'x' || version === 'X') {
    return { major: Infinity, minor: Infinity, patch: Infinity, wildcard: true };
  }

  // Handle .x notation (e.g., "1.2.x", "2.x")
  const xMatch = version.match(/^(\d+)(?:\.(\d+|x))?(?:\.(\d+|x))?$/i);
  if (xMatch) {
    const major = parseInt(xMatch[1], 10);
    const minor = xMatch[2] === 'x' || xMatch[2] === 'X' || !xMatch[2] ? 'x' : parseInt(xMatch[2], 10);
    const patch = xMatch[3] === 'x' || xMatch[3] === 'X' || !xMatch[3] ? 'x' : parseInt(xMatch[3], 10);

    return {
      major,
      minor: minor === 'x' ? Infinity : minor,
      patch: patch === 'x' ? Infinity : patch,
      wildcard: minor === 'x' || patch === 'x'
    };
  }

  // Standard semver (1.2.3)
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (match) {
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      wildcard: false
    };
  }

  // Partial versions (1.2, 1)
  const partialMatch = version.match(/^(\d+)(?:\.(\d+))?$/);
  if (partialMatch) {
    return {
      major: parseInt(partialMatch[1], 10),
      minor: partialMatch[2] ? parseInt(partialMatch[2], 10) : 0,
      patch: 0,
      partial: true
    };
  }

  throw new Error(`Invalid version format: ${version}`);
}

/**
 * Compare two parsed versions
 * @param {Object} v1 - First version
 * @param {Object} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  // Handle wildcards
  if (v1.wildcard || v2.wildcard) {
    return 0; // Wildcards match anything
  }

  // Compare major
  if (v1.major !== v2.major) {
    return v1.major < v2.major ? -1 : 1;
  }

  // Compare minor
  if (v1.minor !== v2.minor) {
    return v1.minor < v2.minor ? -1 : 1;
  }

  // Compare patch
  if (v1.patch !== v2.patch) {
    return v1.patch < v2.patch ? -1 : 1;
  }

  return 0; // Equal
}

/**
 * Check if version satisfies a semver range
 * @param {string} version - Version to check (e.g., "3.1.0")
 * @param {string} range - Semver range (e.g., ">=3.0.0", "^2.5.0", "~1.2.3")
 * @returns {boolean} True if version satisfies range
 */
function satisfiesRange(version, range) {
  if (!range || range === '*') {
    return true; // No constraint or wildcard
  }

  // Parse version
  const v = parseVersion(version);

  // Handle exact match (no operator)
  if (!range.match(/^[><=^~*]/)) {
    const r = parseVersion(range);
    return compareVersions(v, r) === 0;
  }

  // Handle >= operator
  if (range.startsWith('>=')) {
    const r = parseVersion(range.slice(2).trim());
    return compareVersions(v, r) >= 0;
  }

  // Handle > operator
  if (range.startsWith('>')) {
    const r = parseVersion(range.slice(1).trim());
    return compareVersions(v, r) > 0;
  }

  // Handle <= operator
  if (range.startsWith('<=')) {
    const r = parseVersion(range.slice(2).trim());
    return compareVersions(v, r) <= 0;
  }

  // Handle < operator
  if (range.startsWith('<')) {
    const r = parseVersion(range.slice(1).trim());
    return compareVersions(v, r) < 0;
  }

  // Handle ^ operator (compatible with version)
  // ^1.2.3 := >=1.2.3 <2.0.0
  // ^0.2.3 := >=0.2.3 <0.3.0
  // ^0.0.3 := >=0.0.3 <0.0.4
  if (range.startsWith('^')) {
    const r = parseVersion(range.slice(1).trim());

    // Must be >= required version
    if (compareVersions(v, r) < 0) {
      return false;
    }

    // Major must match
    if (v.major !== r.major) {
      return false;
    }

    // If major is 0, minor must match (0.x.y allows patch changes only)
    if (r.major === 0) {
      if (v.minor !== r.minor) {
        return false;
      }
      // If major and minor are 0, patch must match exactly
      if (r.minor === 0) {
        return v.patch === r.patch;
      }
    }

    return true;
  }

  // Handle ~ operator (approximately equivalent)
  // ~1.2.3 := >=1.2.3 <1.3.0
  // ~1.2 := >=1.2.0 <1.3.0
  // ~1 := >=1.0.0 <2.0.0
  if (range.startsWith('~')) {
    const r = parseVersion(range.slice(1).trim());

    // Must be >= required version
    if (compareVersions(v, r) < 0) {
      return false;
    }

    // Major and minor must match
    if (v.major !== r.major || v.minor !== r.minor) {
      return false;
    }

    return true;
  }

  // Unsupported range operator
  throw new Error(`Unsupported version range: ${range}`);
}

/**
 * Validate skill compatibility with agent
 * @param {Object} skillFrontmatter - Skill frontmatter with compatible_agents field
 * @param {string} agentName - Name of the agent (e.g., "backend-developer")
 * @param {string} agentVersion - Version of the agent (e.g., "3.1.0")
 * @returns {Object} Validation result with compatible boolean and details
 */
function validateSkillCompatibility(skillFrontmatter, agentName, agentVersion) {
  if (!skillFrontmatter || !skillFrontmatter.compatible_agents) {
    // No compatibility requirements - assume compatible
    return {
      compatible: true,
      reason: 'No compatibility requirements specified'
    };
  }

  const requiredRange = skillFrontmatter.compatible_agents[agentName];
  if (!requiredRange) {
    // No requirement for this specific agent - assume compatible
    return {
      compatible: true,
      reason: `No requirement specified for ${agentName}`
    };
  }

  try {
    const compatible = satisfiesRange(agentVersion, requiredRange);

    return {
      compatible,
      reason: compatible
        ? `Agent version ${agentVersion} satisfies requirement ${requiredRange}`
        : `Agent version ${agentVersion} does not satisfy requirement ${requiredRange}`,
      agentName,
      agentVersion,
      requiredRange
    };
  } catch (error) {
    return {
      compatible: false,
      reason: `Invalid version range: ${error.message}`,
      error: error.message
    };
  }
}

/**
 * Validate framework version compatibility
 * @param {Object} skillFrontmatter - Skill frontmatter with framework_versions field
 * @param {string} detectedFrameworkVersion - Detected framework version from project
 * @returns {Object} Validation result with compatible boolean and warnings
 */
function validateFrameworkVersion(skillFrontmatter, detectedFrameworkVersion) {
  if (!skillFrontmatter || !skillFrontmatter.framework_versions) {
    return {
      compatible: true,
      reason: 'No framework version requirements specified'
    };
  }

  const { min, max, recommended } = skillFrontmatter.framework_versions;
  const warnings = [];

  try {
    // Check minimum version
    if (min && !satisfiesRange(detectedFrameworkVersion, `>=${min}`)) {
      return {
        compatible: false,
        reason: `Framework version ${detectedFrameworkVersion} is below minimum ${min}`
      };
    }

    // Check maximum version
    if (max && !satisfiesRange(detectedFrameworkVersion, `<=${max}`)) {
      warnings.push(`Framework version ${detectedFrameworkVersion} exceeds recommended maximum ${max}`);
    }

    // Check recommended version
    if (recommended && detectedFrameworkVersion !== recommended) {
      warnings.push(`Framework version ${detectedFrameworkVersion} differs from recommended ${recommended}`);
    }

    return {
      compatible: true,
      reason: 'Framework version compatible',
      warnings,
      detectedVersion: detectedFrameworkVersion,
      minVersion: min,
      maxVersion: max,
      recommendedVersion: recommended
    };
  } catch (error) {
    return {
      compatible: false,
      reason: `Invalid framework version: ${error.message}`,
      error: error.message
    };
  }
}

module.exports = {
  parseVersion,
  compareVersions,
  satisfiesRange,
  validateSkillCompatibility,
  validateFrameworkVersion
};
