/**
 * Security Validator - Enhanced for Task 3.2
 * 
 * Comprehensive security validation for Kubernetes deployments:
 * - Pod security standards and policies
 * - Container image security scanning
 * - Network policy validation
 * - RBAC and service account verification
 * 
 * Part of: Phase 2 - Week 5 - Sprint 3: Deployment Automation
 * Task: 3.2 Pre-deployment Validation Enhancement
 */

/**
 * Security Validator Class
 * 
 * Validates security policies and compliance for deployments
 */
class SecurityValidator {
  constructor(config = {}) {
    this.config = {
      enableImageScanning: config.enableImageScanning !== false,
      allowedRegistries: config.allowedRegistries || [],
      requiredSecurityPolicies: config.requiredSecurityPolicies || {},
      vulnerabilityThreshold: config.vulnerabilityThreshold || 'medium',
      enableNetworkPolicyValidation: config.enableNetworkPolicyValidation !== false,
      ...config
    };
  }

  /**
   * Validate pod security policies and standards
   */
  async validatePodSecurity(podSpec, namespace) {
    const validation = {
      passed: true,
      issues: [],
      warnings: [],
      securityScore: 100
    };

    // Check security context
    const securityContextCheck = this._validateSecurityContext(podSpec.securityContext);
    if (!securityContextCheck.passed) {
      validation.passed = false;
      validation.issues.push(securityContextCheck);
      validation.securityScore -= 20;
    } else if (securityContextCheck.warning) {
      validation.warnings.push(securityContextCheck);
      validation.securityScore -= 5;
    }

    // Check container security contexts
    if (podSpec.containers) {
      for (const container of podSpec.containers) {
        const containerSecurityCheck = this._validateContainerSecurity(container);
        if (!containerSecurityCheck.passed) {
          validation.passed = false;
          validation.issues.push(containerSecurityCheck);
          validation.securityScore -= 15;
        } else if (containerSecurityCheck.warning) {
          validation.warnings.push(containerSecurityCheck);
          validation.securityScore -= 3;
        }
      }
    }

    // Check for privileged containers
    const privilegedCheck = this._checkPrivilegedContainers(podSpec);
    if (!privilegedCheck.passed) {
      validation.passed = false;
      validation.issues.push(privilegedCheck);
      validation.securityScore -= 30;
    }

    // Check capabilities
    const capabilitiesCheck = this._validateCapabilities(podSpec);
    if (!capabilitiesCheck.passed) {
      validation.passed = false;
      validation.issues.push(capabilitiesCheck);
      validation.securityScore -= 10;
    }

    validation.securityScore = Math.max(0, validation.securityScore);
    return validation;
  }

  /**
   * Validate container images for security vulnerabilities
   */
  async validateImageSecurity(images) {
    const validation = {
      passed: true,
      issues: [],
      warnings: [],
      imageReports: []
    };

    if (!this.config.enableImageScanning) {
      validation.warnings.push({
        message: 'Image security scanning is disabled',
        severity: 'info'
      });
      return validation;
    }

    for (const image of images) {
      const imageValidation = await this._validateSingleImage(image);
      validation.imageReports.push(imageValidation);

      if (!imageValidation.passed) {
        validation.passed = false;
        validation.issues.push(...imageValidation.issues);
      }

      validation.warnings.push(...imageValidation.warnings);
    }

    return validation;
  }

  /**
   * Validate network policies for security compliance
   */
  async validateNetworkSecurity(namespace, networkPolicies, podLabels) {
    const validation = {
      passed: true,
      issues: [],
      warnings: [],
      recommendations: []
    };

    if (!this.config.enableNetworkPolicyValidation) {
      return validation;
    }

    // Check if network policies exist for production environments
    if (this.config.environment === 'production' && networkPolicies.length === 0) {
      validation.warnings.push({
        message: 'No network policies defined for production environment',
        severity: 'warning',
        recommendation: 'Implement network policies to restrict pod-to-pod communication'
      });
    }

    // Validate existing network policies
    for (const policy of networkPolicies) {
      const policyValidation = this._validateNetworkPolicy(policy);
      if (!policyValidation.passed) {
        validation.issues.push(policyValidation);
      }
      if (policyValidation.warnings) {
        validation.warnings.push(...policyValidation.warnings);
      }
    }

    // Check for overly permissive policies
    const permissiveCheck = this._checkPermissivePolicies(networkPolicies);
    if (!permissiveCheck.passed) {
      validation.warnings.push(permissiveCheck);
    }

    return validation;
  }

  /**
   * Validate RBAC configuration
   */
  async validateRBACConfiguration(serviceAccount, roles, roleBindings) {
    const validation = {
      passed: true,
      issues: [],
      warnings: [],
      riskLevel: 'low'
    };

    // Check service account configuration
    if (serviceAccount) {
      const saValidation = this._validateServiceAccount(serviceAccount);
      if (!saValidation.passed) {
        validation.issues.push(saValidation);
      }
    }

    // Validate roles and permissions
    for (const role of roles || []) {
      const roleValidation = this._validateRole(role);
      if (!roleValidation.passed) {
        validation.passed = false;
        validation.issues.push(roleValidation);
      }
      if (roleValidation.warnings) {
        validation.warnings.push(...roleValidation.warnings);
      }
    }

    // Check for overly broad permissions
    const permissionsCheck = this._checkExcessivePermissions(roles || []);
    if (!permissionsCheck.passed) {
      validation.riskLevel = 'high';
      validation.warnings.push(permissionsCheck);
    }

    return validation;
  }

  /**
   * Validate secrets and sensitive data handling
   */
  async validateSecretsHandling(manifests) {
    const validation = {
      passed: true,
      issues: [],
      warnings: [],
      secretsFound: 0
    };

    for (const manifest of manifests) {
      if (manifest.kind === 'Secret') {
        validation.secretsFound++;
        const secretValidation = this._validateSecret(manifest);
        if (!secretValidation.passed) {
          validation.passed = false;
          validation.issues.push(secretValidation);
        }
      }

      // Check for hardcoded secrets in other resources
      const hardcodedCheck = this._checkHardcodedSecrets(manifest);
      if (!hardcodedCheck.passed) {
        validation.passed = false;
        validation.issues.push(hardcodedCheck);
      }
    }

    return validation;
  }

  // Private helper methods

  _validateSecurityContext(securityContext) {
    if (!securityContext) {
      return {
        passed: false,
        message: 'No security context defined',
        severity: 'error',
        recommendation: 'Define security context with appropriate settings'
      };
    }

    const issues = [];
    const warnings = [];

    // Check runAsNonRoot
    if (securityContext.runAsNonRoot !== true) {
      issues.push('Container should run as non-root user');
    }

    // Check runAsUser
    if (securityContext.runAsUser === 0 || securityContext.runAsUser === undefined) {
      warnings.push('Consider specifying a non-root user ID');
    }

    // Check fsGroup
    if (securityContext.fsGroup === undefined) {
      warnings.push('Consider setting fsGroup for proper file permissions');
    }

    if (issues.length > 0) {
      return {
        passed: false,
        message: `Security context issues: ${issues.join(', ')}`,
        severity: 'error'
      };
    }

    if (warnings.length > 0) {
      return {
        passed: true,
        warning: true,
        message: `Security context warnings: ${warnings.join(', ')}`,
        severity: 'warning'
      };
    }

    return {
      passed: true,
      message: 'Security context is properly configured',
      severity: 'info'
    };
  }

  _validateContainerSecurity(container) {
    const issues = [];
    const warnings = [];

    if (container.securityContext) {
      const sc = container.securityContext;

      // Check privileged flag
      if (sc.privileged === true) {
        issues.push('Container runs in privileged mode');
      }

      // Check allowPrivilegeEscalation
      if (sc.allowPrivilegeEscalation !== false) {
        warnings.push('allowPrivilegeEscalation should be set to false');
      }

      // Check readOnlyRootFilesystem
      if (sc.readOnlyRootFilesystem !== true) {
        warnings.push('Consider setting readOnlyRootFilesystem to true');
      }

      // Check capabilities
      if (sc.capabilities && sc.capabilities.add && sc.capabilities.add.length > 0) {
        const dangerousCaps = ['SYS_ADMIN', 'NET_ADMIN', 'SYS_PTRACE'];
        const addedDangerousCaps = sc.capabilities.add.filter(cap => 
          dangerousCaps.includes(cap)
        );
        if (addedDangerousCaps.length > 0) {
          issues.push(`Dangerous capabilities added: ${addedDangerousCaps.join(', ')}`);
        }
      }
    } else {
      warnings.push('No security context defined for container');
    }

    if (issues.length > 0) {
      return {
        passed: false,
        message: `Container '${container.name}' security issues: ${issues.join(', ')}`,
        severity: 'error'
      };
    }

    if (warnings.length > 0) {
      return {
        passed: true,
        warning: true,
        message: `Container '${container.name}' security warnings: ${warnings.join(', ')}`,
        severity: 'warning'
      };
    }

    return {
      passed: true,
      message: `Container '${container.name}' security is properly configured`,
      severity: 'info'
    };
  }

  _checkPrivilegedContainers(podSpec) {
    const privilegedContainers = [];

    if (podSpec.containers) {
      for (const container of podSpec.containers) {
        if (container.securityContext && container.securityContext.privileged === true) {
          privilegedContainers.push(container.name);
        }
      }
    }

    if (privilegedContainers.length > 0) {
      return {
        passed: false,
        message: `Privileged containers detected: ${privilegedContainers.join(', ')}`,
        severity: 'error',
        containers: privilegedContainers
      };
    }

    return {
      passed: true,
      message: 'No privileged containers detected',
      severity: 'info'
    };
  }

  _validateCapabilities(podSpec) {
    const issues = [];
    const warnings = [];

    if (podSpec.containers) {
      for (const container of podSpec.containers) {
        if (container.securityContext && container.securityContext.capabilities) {
          const caps = container.securityContext.capabilities;
          
          // Check for dangerous capabilities
          const dangerousCaps = ['SYS_ADMIN', 'NET_ADMIN', 'SYS_PTRACE', 'DAC_OVERRIDE'];
          if (caps.add) {
            const dangerous = caps.add.filter(cap => dangerousCaps.includes(cap));
            if (dangerous.length > 0) {
              issues.push(`Container '${container.name}' has dangerous capabilities: ${dangerous.join(', ')}`);
            }
          }

          // Recommend dropping all capabilities
          if (!caps.drop || !caps.drop.includes('ALL')) {
            warnings.push(`Container '${container.name}' should drop all capabilities by default`);
          }
        }
      }
    }

    if (issues.length > 0) {
      return {
        passed: false,
        message: issues.join(', '),
        severity: 'error'
      };
    }

    if (warnings.length > 0) {
      return {
        passed: true,
        warning: true,
        message: warnings.join(', '),
        severity: 'warning'
      };
    }

    return {
      passed: true,
      message: 'Capabilities are properly configured',
      severity: 'info'
    };
  }

  async _validateSingleImage(image) {
    const validation = {
      passed: true,
      issues: [],
      warnings: [],
      image,
      vulnerabilities: []
    };

    // Check if image is from allowed registry
    if (this.config.allowedRegistries.length > 0) {
      const isAllowed = this.config.allowedRegistries.some(registry => 
        image.startsWith(registry)
      );
      
      if (!isAllowed) {
        validation.passed = false;
        validation.issues.push({
          message: `Image '${image}' is not from an allowed registry`,
          severity: 'error',
          allowedRegistries: this.config.allowedRegistries
        });
      }
    }

    // Check for latest tag (security best practice)
    if (image.endsWith(':latest') || !image.includes(':')) {
      validation.warnings.push({
        message: `Image '${image}' uses 'latest' tag, consider using specific version`,
        severity: 'warning'
      });
    }

    // Mock vulnerability scanning (would integrate with actual scanner)
    const vulnerabilityCheck = this._mockVulnerabilityScanning(image);
    validation.vulnerabilities = vulnerabilityCheck.vulnerabilities;

    const highVulns = vulnerabilityCheck.vulnerabilities.filter(v => 
      v.severity === 'high' || v.severity === 'critical'
    );

    if (highVulns.length > 0) {
      validation.passed = false;
      validation.issues.push({
        message: `Image '${image}' has ${highVulns.length} high/critical vulnerabilities`,
        severity: 'error',
        vulnerabilities: highVulns
      });
    }

    return validation;
  }

  _validateNetworkPolicy(policy) {
    const validation = {
      passed: true,
      warnings: []
    };

    // Check for overly broad selectors
    if (!policy.spec.podSelector || Object.keys(policy.spec.podSelector).length === 0) {
      validation.warnings.push({
        message: `Network policy '${policy.metadata.name}' has empty pod selector (applies to all pods)`,
        severity: 'warning'
      });
    }

    // Check for allow-all rules
    if (policy.spec.ingress && policy.spec.ingress.some(rule => !rule.from)) {
      validation.warnings.push({
        message: `Network policy '${policy.metadata.name}' has allow-all ingress rule`,
        severity: 'warning'
      });
    }

    if (policy.spec.egress && policy.spec.egress.some(rule => !rule.to)) {
      validation.warnings.push({
        message: `Network policy '${policy.metadata.name}' has allow-all egress rule`,
        severity: 'warning'
      });
    }

    return validation;
  }

  _checkPermissivePolicies(networkPolicies) {
    const permissivePolicies = networkPolicies.filter(policy => {
      // Check for empty selectors or allow-all rules
      const emptySelector = !policy.spec.podSelector || 
        Object.keys(policy.spec.podSelector).length === 0;
      
      const allowAllIngress = policy.spec.ingress && 
        policy.spec.ingress.some(rule => !rule.from || rule.from.length === 0);
      
      const allowAllEgress = policy.spec.egress && 
        policy.spec.egress.some(rule => !rule.to || rule.to.length === 0);

      return emptySelector || allowAllIngress || allowAllEgress;
    });

    if (permissivePolicies.length > 0) {
      return {
        passed: false,
        message: `Found ${permissivePolicies.length} overly permissive network policies`,
        severity: 'warning',
        policies: permissivePolicies.map(p => p.metadata.name)
      };
    }

    return { passed: true };
  }

  _validateServiceAccount(serviceAccount) {
    const validation = {
      passed: true,
      issues: []
    };

    // Check for automount service account token
    if (serviceAccount.automountServiceAccountToken !== false) {
      validation.issues.push({
        message: 'Service account should disable automount of service account token if not needed',
        severity: 'warning'
      });
    }

    return validation;
  }

  _validateRole(role) {
    const validation = {
      passed: true,
      warnings: []
    };

    const dangerousVerbs = ['*', 'create', 'delete', 'update'];
    const dangerousResources = ['*', 'secrets', 'pods/exec', 'pods/attach'];

    role.rules?.forEach((rule, index) => {
      const hasWildcardVerb = rule.verbs?.includes('*');
      const hasWildcardResource = rule.resources?.includes('*');
      
      if (hasWildcardVerb || hasWildcardResource) {
        validation.warnings.push({
          message: `Rule ${index + 1} in role '${role.metadata.name}' uses wildcard permissions`,
          severity: 'warning',
          rule: rule
        });
      }

      const hasDangerousVerbs = rule.verbs?.some(verb => dangerousVerbs.includes(verb));
      const hasDangerousResources = rule.resources?.some(resource => 
        dangerousResources.includes(resource)
      );

      if (hasDangerousVerbs && hasDangerousResources) {
        validation.warnings.push({
          message: `Rule ${index + 1} in role '${role.metadata.name}' has potentially dangerous permissions`,
          severity: 'warning',
          rule: rule
        });
      }
    });

    return validation;
  }

  _checkExcessivePermissions(roles) {
    const adminRoles = roles.filter(role => 
      role.rules?.some(rule => 
        rule.verbs?.includes('*') && rule.resources?.includes('*')
      )
    );

    if (adminRoles.length > 0) {
      return {
        passed: false,
        message: `Found ${adminRoles.length} roles with admin-level permissions`,
        severity: 'warning',
        roles: adminRoles.map(r => r.metadata.name)
      };
    }

    return { passed: true };
  }

  _validateSecret(secret) {
    const validation = {
      passed: true,
      issues: []
    };

    // Check secret type
    if (secret.type === 'Opaque' && secret.data) {
      // Check for potentially sensitive keys
      const sensitiveKeys = Object.keys(secret.data).filter(key => 
        key.toLowerCase().includes('password') || 
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('key')
      );

      if (sensitiveKeys.length > 0) {
        validation.issues.push({
          message: `Secret '${secret.metadata.name}' contains potentially sensitive data`,
          severity: 'info',
          keys: sensitiveKeys
        });
      }
    }

    return validation;
  }

  _checkHardcodedSecrets(manifest) {
    const validation = {
      passed: true,
      issues: []
    };

    const manifestString = JSON.stringify(manifest);
    const secretPatterns = [
      /password\s*[:=]\s*['"]\w{8,}['"]/gi,
      /token\s*[:=]\s*['"]\w{16,}['"]/gi,
      /secret\s*[:=]\s*['"]\w{16,}['"]/gi,
      /key\s*[:=]\s*['"]\w{16,}['"]/gi
    ];

    secretPatterns.forEach((pattern, index) => {
      const matches = manifestString.match(pattern);
      if (matches) {
        validation.passed = false;
        validation.issues.push({
          message: `Potential hardcoded secret found in ${manifest.kind}/${manifest.metadata?.name}`,
          severity: 'error',
          matches: matches.length
        });
      }
    });

    return validation;
  }

  _mockVulnerabilityScanning(image) {
    // Mock vulnerability scanning - would integrate with actual scanner like Trivy, Clair, etc.
    const mockVulnerabilities = [
      {
        id: 'CVE-2021-12345',
        severity: 'medium',
        package: 'openssl',
        description: 'Example vulnerability'
      }
    ];

    // Simulate different vulnerability levels based on image
    if (image.includes('nginx')) {
      return { vulnerabilities: [] }; // Assume nginx is secure
    }

    if (image.includes('alpine')) {
      return { vulnerabilities: mockVulnerabilities };
    }

    return { vulnerabilities: [] };
  }
}

module.exports = { SecurityValidator };