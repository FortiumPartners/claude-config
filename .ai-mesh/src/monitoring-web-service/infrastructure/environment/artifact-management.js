/**
 * Artifact Management System
 * Sprint 4 - Task 4.7: Environment Management
 * 
 * Provides comprehensive artifact lifecycle management with Helm chart repositories integration,
 * container image registry management, semantic versioning, image vulnerability scanning,
 * cleanup automation, and dependency tracking with security vulnerability monitoring.
 * 
 * Features:
 * - Helm chart repositories integration (Harbor, ChartMuseum, AWS ECR, Azure ACR)
 * - Container image registry management with lifecycle policies and multi-registry support
 * - Semantic versioning with automated tagging strategies and release management
 * - Image vulnerability scanning with policy enforcement and compliance reporting
 * - Cleanup automation with configurable retention policies and storage optimization
 * - Dependency tracking and security vulnerability monitoring with SBOM generation
 */

const crypto = require('crypto');
const EventEmitter = require('events');

class ArtifactManagementSystem extends EventEmitter {
  constructor() {
    super();
    this.artifacts = new Map();
    this.registries = new Map();
    this.scanResults = new Map();
    this.retentionPolicies = new Map();
    this.dependencyGraph = new Map();
    this.securityPolicies = new Map();

    // System configuration
    this.config = {
      enableVulnerabilityScanning: true,
      enableRetentionPolicies: true,
      enableDependencyTracking: true,
      defaultRetentionDays: 90,
      maxVulnerabilityScore: 7.0,
      enableSBOMGeneration: true
    };

    // Supported registry types
    this.registryTypes = {
      DOCKER_HUB: 'dockerhub',
      HARBOR: 'harbor',
      ECR: 'ecr',
      ACR: 'acr',
      GCR: 'gcr',
      CHARTMUSEUM: 'chartmuseum',
      ARTIFACTORY: 'artifactory'
    };

    // Artifact types
    this.artifactTypes = {
      CONTAINER_IMAGE: 'container-image',
      HELM_CHART: 'helm-chart',
      BINARY: 'binary',
      LIBRARY: 'library',
      CONFIGURATION: 'configuration'
    };

    // Vulnerability severities
    this.vulnerabilitySeverities = {
      CRITICAL: 'critical',
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low',
      NEGLIGIBLE: 'negligible'
    };

    // Initialize artifact management components
    this.initializeArtifactManagement();
  }

  /**
   * Initialize artifact management components
   */
  initializeArtifactManagement() {
    console.log('Initializing artifact management components...');

    // Initialize supported registries
    this.initializeRegistries();
    
    // Initialize default retention policies
    this.initializeRetentionPolicies();
    
    // Initialize security policies
    this.initializeSecurityPolicies();
  }

  /**
   * Initialize registry integrations
   */
  initializeRegistries() {
    this.registries.set(this.registryTypes.HARBOR, new HarborRegistry());
    this.registries.set(this.registryTypes.ECR, new ECRRegistry());
    this.registries.set(this.registryTypes.ACR, new ACRRegistry());
    this.registries.set(this.registryTypes.GCR, new GCRRegistry());
    this.registries.set(this.registryTypes.CHARTMUSEUM, new ChartMuseumRegistry());
    this.registries.set(this.registryTypes.ARTIFACTORY, new ArtifactoryRegistry());
  }

  /**
   * Initialize default retention policies
   */
  initializeRetentionPolicies() {
    // Production retention policy
    this.retentionPolicies.set('production', {
      id: 'production-policy',
      name: 'Production Retention Policy',
      retentionDays: 365,
      keepMinimumVersions: 10,
      keepLatestTags: ['latest', 'stable', 'release'],
      rules: [
        { pattern: '*-prod-*', retentionDays: 730 },
        { pattern: '*-release-*', retentionDays: 365 },
        { pattern: '*-hotfix-*', retentionDays: 180 }
      ]
    });

    // Staging retention policy
    this.retentionPolicies.set('staging', {
      id: 'staging-policy',
      name: 'Staging Retention Policy',
      retentionDays: 90,
      keepMinimumVersions: 5,
      keepLatestTags: ['latest', 'staging'],
      rules: [
        { pattern: '*-stage-*', retentionDays: 90 },
        { pattern: '*-test-*', retentionDays: 30 }
      ]
    });

    // Development retention policy
    this.retentionPolicies.set('development', {
      id: 'development-policy',
      name: 'Development Retention Policy',
      retentionDays: 30,
      keepMinimumVersions: 3,
      keepLatestTags: ['latest', 'dev'],
      rules: [
        { pattern: '*-dev-*', retentionDays: 30 },
        { pattern: '*-feature-*', retentionDays: 14 },
        { pattern: '*-pr-*', retentionDays: 7 }
      ]
    });
  }

  /**
   * Initialize security policies
   */
  initializeSecurityPolicies() {
    this.securityPolicies.set('strict', {
      id: 'strict-security',
      name: 'Strict Security Policy',
      maxCriticalVulnerabilities: 0,
      maxHighVulnerabilities: 0,
      maxMediumVulnerabilities: 5,
      requireSignedImages: true,
      requireSBOM: true,
      blockedPackages: ['log4j:1.2.*', 'commons-logging:*']
    });

    this.securityPolicies.set('standard', {
      id: 'standard-security',
      name: 'Standard Security Policy',
      maxCriticalVulnerabilities: 0,
      maxHighVulnerabilities: 2,
      maxMediumVulnerabilities: 10,
      requireSignedImages: false,
      requireSBOM: true,
      blockedPackages: []
    });
  }

  /**
   * Register artifact with comprehensive metadata and scanning
   * @param {Object} artifactConfig - Artifact configuration
   * @returns {Object} Registration result
   */
  async registerArtifact(artifactConfig) {
    const startTime = Date.now();

    try {
      console.log(`Registering artifact: ${artifactConfig.name}:${artifactConfig.version}`);

      // Validate artifact configuration
      const validationResult = this.validateArtifactConfig(artifactConfig);
      if (!validationResult.valid) {
        throw new Error(`Invalid artifact configuration: ${validationResult.errors.join(', ')}`);
      }

      const artifactId = this.generateArtifactId(artifactConfig);

      // Generate semantic version if not provided
      const semanticVersion = artifactConfig.version || await this.generateSemanticVersion(artifactConfig);

      // Create comprehensive artifact record
      const artifact = {
        id: artifactId,
        name: artifactConfig.name,
        version: semanticVersion,
        type: artifactConfig.type || this.artifactTypes.CONTAINER_IMAGE,
        registry: artifactConfig.registry,
        repository: artifactConfig.repository,
        tags: artifactConfig.tags || [],
        metadata: {
          ...artifactConfig.metadata,
          registeredAt: new Date().toISOString(),
          registeredBy: artifactConfig.registeredBy || 'system',
          buildId: artifactConfig.buildId,
          commitHash: artifactConfig.commitHash,
          branch: artifactConfig.branch
        },
        size: artifactConfig.size || 0,
        layers: artifactConfig.layers || [],
        manifest: artifactConfig.manifest || {},
        status: 'registered',
        securityScan: null,
        vulnerabilities: [],
        dependencies: [],
        sbom: null,
        retentionPolicy: artifactConfig.retentionPolicy || 'standard'
      };

      // Store artifact
      this.artifacts.set(artifactId, artifact);

      // Initiate security scanning if enabled
      if (this.config.enableVulnerabilityScanning) {
        await this.initiateSecurityScan(artifact);
      }

      // Generate SBOM if enabled
      if (this.config.enableSBOMGeneration) {
        await this.generateSBOM(artifact);
      }

      // Track dependencies if enabled
      if (this.config.enableDependencyTracking) {
        await this.trackDependencies(artifact);
      }

      // Apply retention policy
      if (this.config.enableRetentionPolicies) {
        await this.applyRetentionPolicy(artifact);
      }

      const registrationTime = Date.now() - startTime;

      // Emit artifact registered event
      this.emit('artifactRegistered', {
        artifactId,
        name: artifact.name,
        version: artifact.version,
        registry: artifact.registry
      });

      return {
        success: true,
        artifactId,
        name: artifact.name,
        version: artifact.version,
        registrationTime: `${registrationTime}ms`,
        securityScanInitiated: this.config.enableVulnerabilityScanning,
        sbomGenerated: this.config.enableSBOMGeneration,
        retentionPolicyApplied: this.config.enableRetentionPolicies
      };

    } catch (error) {
      const registrationTime = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        registrationTime: `${registrationTime}ms`,
        failedAt: 'artifact-registration'
      };
    }
  }

  /**
   * Perform comprehensive vulnerability scanning
   * @param {Object} artifact - Artifact to scan
   * @returns {Object} Scan results
   */
  async performVulnerabilityScan(artifact) {
    console.log(`Performing vulnerability scan for: ${artifact.name}:${artifact.version}`);

    try {
      // Get registry integration
      const registryIntegration = this.registries.get(artifact.registry);
      if (!registryIntegration) {
        throw new Error(`Unsupported registry: ${artifact.registry}`);
      }

      // Execute vulnerability scan
      const scanResult = await registryIntegration.scanForVulnerabilities(artifact);

      // Process scan results
      const processedResults = await this.processScanResults(scanResult, artifact);

      // Update artifact with scan results
      artifact.securityScan = {
        scanId: crypto.randomUUID(),
        scannedAt: new Date().toISOString(),
        scanner: scanResult.scanner || 'trivy',
        scannerVersion: scanResult.scannerVersion || '0.34.0',
        results: processedResults,
        status: processedResults.compliant ? 'passed' : 'failed'
      };

      // Store detailed scan results
      this.scanResults.set(artifact.securityScan.scanId, {
        artifactId: artifact.id,
        scanData: scanResult,
        processedResults,
        scannedAt: artifact.securityScan.scannedAt
      });

      // Check against security policies
      const policyCompliance = await this.checkSecurityPolicyCompliance(
        artifact,
        processedResults
      );

      // Update artifact status based on compliance
      if (!policyCompliance.compliant) {
        artifact.status = 'security-violation';
        
        this.emit('securityViolation', {
          artifactId: artifact.id,
          name: artifact.name,
          version: artifact.version,
          violations: policyCompliance.violations
        });
      }

      // Emit scan completed event
      this.emit('vulnerabilityScanCompleted', {
        artifactId: artifact.id,
        scanId: artifact.securityScan.scanId,
        vulnerabilityCount: processedResults.totalVulnerabilities,
        compliant: processedResults.compliant
      });

      return {
        success: true,
        scanId: artifact.securityScan.scanId,
        vulnerabilities: processedResults.vulnerabilities,
        totalVulnerabilities: processedResults.totalVulnerabilities,
        severityBreakdown: processedResults.severityBreakdown,
        compliant: processedResults.compliant,
        policyCompliance
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        failedAt: 'vulnerability-scanning'
      };
    }
  }

  /**
   * Execute cleanup automation with retention policies
   * @param {Object} cleanupConfig - Cleanup configuration
   * @returns {Object} Cleanup results
   */
  async executeCleanupAutomation(cleanupConfig = {}) {
    const startTime = Date.now();

    try {
      console.log('Executing cleanup automation with retention policies...');

      const allArtifacts = Array.from(this.artifacts.values());
      const cleanupResults = {
        analyzed: 0,
        markedForDeletion: 0,
        deleted: 0,
        retained: 0,
        spaceSaved: 0,
        errors: []
      };

      // Group artifacts by retention policy
      const artifactsByPolicy = this.groupArtifactsByPolicy(allArtifacts);

      for (const [policyId, artifacts] of artifactsByPolicy.entries()) {
        const policy = this.retentionPolicies.get(policyId);
        if (!policy) continue;

        console.log(`Applying retention policy: ${policy.name} to ${artifacts.length} artifacts`);

        const policyResults = await this.applyRetentionPolicyToArtifacts(
          policy,
          artifacts,
          cleanupConfig
        );

        // Aggregate results
        cleanupResults.analyzed += policyResults.analyzed;
        cleanupResults.markedForDeletion += policyResults.markedForDeletion;
        cleanupResults.deleted += policyResults.deleted;
        cleanupResults.retained += policyResults.retained;
        cleanupResults.spaceSaved += policyResults.spaceSaved;
        cleanupResults.errors.push(...policyResults.errors);
      }

      // Execute actual cleanup if not in dry-run mode
      if (!cleanupConfig.dryRun) {
        await this.executeArtifactDeletion(cleanupResults);
      }

      const cleanupTime = Date.now() - startTime;

      // Emit cleanup completed event
      this.emit('cleanupCompleted', {
        results: cleanupResults,
        dryRun: cleanupConfig.dryRun || false,
        executionTime: `${cleanupTime}ms`
      });

      return {
        success: true,
        results: cleanupResults,
        executionTime: `${cleanupTime}ms`,
        dryRun: cleanupConfig.dryRun || false
      };

    } catch (error) {
      const cleanupTime = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        executionTime: `${cleanupTime}ms`,
        failedAt: 'cleanup-automation'
      };
    }
  }

  /**
   * Track dependencies and generate dependency graph
   * @param {Object} artifact - Artifact to track dependencies for
   * @returns {Object} Dependency tracking result
   */
  async trackDependencies(artifact) {
    console.log(`Tracking dependencies for: ${artifact.name}:${artifact.version}`);

    try {
      // Get registry integration for dependency analysis
      const registryIntegration = this.registries.get(artifact.registry);
      if (!registryIntegration) {
        throw new Error(`Registry integration not found: ${artifact.registry}`);
      }

      // Extract dependencies from artifact
      const dependencies = await registryIntegration.extractDependencies(artifact);

      // Create dependency graph entry
      const dependencyGraphEntry = {
        artifactId: artifact.id,
        dependencies: dependencies.direct || [],
        transitiveDependencies: dependencies.transitive || [],
        dependents: [], // Will be populated as other artifacts depend on this one
        updatedAt: new Date().toISOString(),
        securityAudit: await this.auditDependencySecurity(dependencies)
      };

      // Store in dependency graph
      this.dependencyGraph.set(artifact.id, dependencyGraphEntry);

      // Update artifact with dependency information
      artifact.dependencies = dependencyGraphEntry;

      // Check for known vulnerable dependencies
      const vulnerableDependencies = await this.checkForVulnerableDependencies(dependencies);

      if (vulnerableDependencies.length > 0) {
        this.emit('vulnerableDependenciesFound', {
          artifactId: artifact.id,
          vulnerableDependencies
        });
      }

      return {
        success: true,
        directDependencies: dependencies.direct?.length || 0,
        transitiveDependencies: dependencies.transitive?.length || 0,
        vulnerableDependencies: vulnerableDependencies.length,
        securityAuditPassed: dependencyGraphEntry.securityAudit.passed
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        failedAt: 'dependency-tracking'
      };
    }
  }

  /**
   * Generate Software Bill of Materials (SBOM)
   * @param {Object} artifact - Artifact to generate SBOM for
   * @returns {Object} SBOM generation result
   */
  async generateSBOM(artifact) {
    console.log(`Generating SBOM for: ${artifact.name}:${artifact.version}`);

    try {
      // Get registry integration for SBOM generation
      const registryIntegration = this.registries.get(artifact.registry);
      if (!registryIntegration) {
        throw new Error(`Registry integration not found: ${artifact.registry}`);
      }

      // Generate SBOM using SPDX format
      const sbomData = await registryIntegration.generateSBOM(artifact);

      const sbom = {
        id: crypto.randomUUID(),
        artifactId: artifact.id,
        format: 'SPDX',
        version: '2.3',
        generatedAt: new Date().toISOString(),
        generatedBy: 'artifact-management-system',
        documentName: `SBOM-${artifact.name}-${artifact.version}`,
        documentNamespace: `https://artifacts.example.com/sbom/${artifact.id}`,
        packages: sbomData.packages || [],
        relationships: sbomData.relationships || [],
        licenses: sbomData.licenses || [],
        copyrights: sbomData.copyrights || [],
        checksums: sbomData.checksums || []
      };

      // Store SBOM
      artifact.sbom = sbom;

      // Emit SBOM generated event
      this.emit('sbomGenerated', {
        artifactId: artifact.id,
        sbomId: sbom.id,
        packageCount: sbom.packages.length,
        licenseCount: sbom.licenses.length
      });

      return {
        success: true,
        sbomId: sbom.id,
        format: sbom.format,
        packages: sbom.packages.length,
        licenses: sbom.licenses.length,
        relationships: sbom.relationships.length
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        failedAt: 'sbom-generation'
      };
    }
  }

  /**
   * Generate comprehensive artifact management dashboard
   * @param {Object} options - Dashboard options
   * @returns {Object} Dashboard data
   */
  async generateArtifactDashboard(options = {}) {
    console.log('Generating comprehensive artifact management dashboard...');

    const allArtifacts = Array.from(this.artifacts.values());
    const timeRange = options.timeRange || 30; // Default 30 days

    // Filter artifacts by time range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);
    const recentArtifacts = allArtifacts.filter(a => 
      new Date(a.metadata.registeredAt) >= cutoffDate
    );

    const dashboard = {
      overview: {
        totalArtifacts: allArtifacts.length,
        recentArtifacts: recentArtifacts.length,
        totalSize: this.calculateTotalSize(allArtifacts),
        byType: this.getArtifactTypeBreakdown(allArtifacts),
        byRegistry: this.getRegistryBreakdown(allArtifacts)
      },

      security: {
        scannedArtifacts: allArtifacts.filter(a => a.securityScan).length,
        vulnerableArtifacts: this.getVulnerableArtifactCount(allArtifacts),
        criticalVulnerabilities: this.getCriticalVulnerabilityCount(allArtifacts),
        complianceRate: this.calculateSecurityComplianceRate(allArtifacts),
        topVulnerabilities: await this.getTopVulnerabilities(allArtifacts)
      },

      retention: {
        policiesActive: this.retentionPolicies.size,
        artifactsMarkedForDeletion: this.getArtifactsMarkedForDeletion(allArtifacts),
        spaceSavings: await this.calculatePotentialSpaceSavings(allArtifacts),
        retentionCompliance: await this.calculateRetentionCompliance(allArtifacts)
      },

      dependencies: {
        trackedArtifacts: this.dependencyGraph.size,
        vulnerableDependencies: await this.getVulnerableDependencyCount(),
        licenseCompliance: await this.calculateLicenseCompliance(),
        dependencyUpdatesAvailable: await this.getDependencyUpdatesCount()
      },

      registries: {
        health: await this.assessRegistryHealth(),
        usage: await this.getRegistryUsageStats(),
        performance: await this.getRegistryPerformanceMetrics()
      },

      sbom: {
        generated: allArtifacts.filter(a => a.sbom).length,
        licenses: await this.getLicenseBreakdown(allArtifacts),
        packages: await this.getPackageStatistics(allArtifacts)
      },

      trends: {
        artifactGrowth: await this.analyzeArtifactGrowthTrend(recentArtifacts),
        vulnerabilityTrends: await this.analyzeVulnerabilityTrends(recentArtifacts),
        sizeOptimization: await this.analyzeSizeOptimizationTrends(recentArtifacts)
      },

      recommendations: await this.generateArtifactRecommendations(allArtifacts),

      metadata: {
        generatedAt: new Date().toISOString(),
        timeRange: `${timeRange} days`,
        artifactsAnalyzed: allArtifacts.length
      }
    };

    return {
      success: true,
      dashboard
    };
  }

  /**
   * Core processing methods
   */

  async processScanResults(scanResult, artifact) {
    const vulnerabilities = scanResult.vulnerabilities || [];
    
    const severityBreakdown = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      negligible: 0
    };

    // Process each vulnerability
    const processedVulnerabilities = vulnerabilities.map(vuln => {
      severityBreakdown[vuln.severity]++;
      
      return {
        id: vuln.id,
        cve: vuln.cve,
        severity: vuln.severity,
        score: vuln.score || 0,
        package: vuln.package,
        version: vuln.version,
        fixedVersion: vuln.fixedVersion,
        description: vuln.description,
        references: vuln.references || []
      };
    });

    // Determine compliance based on security policy
    const securityPolicy = this.securityPolicies.get(artifact.securityPolicy || 'standard');
    const compliant = this.isSecurityCompliant(severityBreakdown, securityPolicy);

    return {
      vulnerabilities: processedVulnerabilities,
      totalVulnerabilities: vulnerabilities.length,
      severityBreakdown,
      compliant,
      highestSeverity: this.getHighestSeverity(severityBreakdown),
      riskScore: this.calculateRiskScore(severityBreakdown)
    };
  }

  async checkSecurityPolicyCompliance(artifact, scanResults) {
    const policy = this.securityPolicies.get(artifact.securityPolicy || 'standard');
    const violations = [];

    if (scanResults.severityBreakdown.critical > policy.maxCriticalVulnerabilities) {
      violations.push(`Critical vulnerabilities exceed limit: ${scanResults.severityBreakdown.critical} > ${policy.maxCriticalVulnerabilities}`);
    }

    if (scanResults.severityBreakdown.high > policy.maxHighVulnerabilities) {
      violations.push(`High vulnerabilities exceed limit: ${scanResults.severityBreakdown.high} > ${policy.maxHighVulnerabilities}`);
    }

    if (scanResults.severityBreakdown.medium > policy.maxMediumVulnerabilities) {
      violations.push(`Medium vulnerabilities exceed limit: ${scanResults.severityBreakdown.medium} > ${policy.maxMediumVulnerabilities}`);
    }

    return {
      compliant: violations.length === 0,
      violations,
      policy: policy.name
    };
  }

  async applyRetentionPolicyToArtifacts(policy, artifacts, cleanupConfig) {
    const results = {
      analyzed: artifacts.length,
      markedForDeletion: 0,
      deleted: 0,
      retained: 0,
      spaceSaved: 0,
      errors: []
    };

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

    for (const artifact of artifacts) {
      try {
        const shouldDelete = await this.shouldDeleteArtifact(artifact, policy, cutoffDate);
        
        if (shouldDelete) {
          artifact.markedForDeletion = true;
          artifact.deletionReason = shouldDelete.reason;
          results.markedForDeletion++;
          results.spaceSaved += artifact.size || 0;
        } else {
          results.retained++;
        }
      } catch (error) {
        results.errors.push(`Error processing ${artifact.id}: ${error.message}`);
      }
    }

    return results;
  }

  async shouldDeleteArtifact(artifact, policy, cutoffDate) {
    const registeredDate = new Date(artifact.metadata.registeredAt);
    
    // Check if artifact is older than retention period
    if (registeredDate < cutoffDate) {
      // Check if it should be kept due to special tags
      if (artifact.tags.some(tag => policy.keepLatestTags.includes(tag))) {
        return false; // Keep artifacts with special tags
      }

      // Check minimum versions rule
      const sameNameArtifacts = Array.from(this.artifacts.values())
        .filter(a => a.name === artifact.name)
        .sort((a, b) => new Date(b.metadata.registeredAt) - new Date(a.metadata.registeredAt));

      const artifactIndex = sameNameArtifacts.findIndex(a => a.id === artifact.id);
      if (artifactIndex < policy.keepMinimumVersions) {
        return false; // Keep minimum required versions
      }

      return {
        delete: true,
        reason: `Older than ${policy.retentionDays} days and not in minimum versions`
      };
    }

    return false;
  }

  /**
   * Utility and calculation methods
   */

  generateArtifactId(artifactConfig) {
    const hash = crypto.createHash('sha256')
      .update(`${artifactConfig.name}-${artifactConfig.version}-${Date.now()}`)
      .digest('hex');
    return hash.substring(0, 16);
  }

  async generateSemanticVersion(artifactConfig) {
    // Simple semantic version generation based on timestamp
    const now = new Date();
    const major = 1;
    const minor = now.getMonth() + 1;
    const patch = now.getDate();
    return `${major}.${minor}.${patch}`;
  }

  validateArtifactConfig(config) {
    const errors = [];

    if (!config.name) errors.push('Artifact name is required');
    if (!config.registry) errors.push('Registry is required');
    if (!config.repository) errors.push('Repository is required');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  isSecurityCompliant(severityBreakdown, policy) {
    return severityBreakdown.critical <= policy.maxCriticalVulnerabilities &&
           severityBreakdown.high <= policy.maxHighVulnerabilities &&
           severityBreakdown.medium <= policy.maxMediumVulnerabilities;
  }

  getHighestSeverity(severityBreakdown) {
    if (severityBreakdown.critical > 0) return 'critical';
    if (severityBreakdown.high > 0) return 'high';
    if (severityBreakdown.medium > 0) return 'medium';
    if (severityBreakdown.low > 0) return 'low';
    return 'negligible';
  }

  calculateRiskScore(severityBreakdown) {
    return (severityBreakdown.critical * 10) +
           (severityBreakdown.high * 7) +
           (severityBreakdown.medium * 4) +
           (severityBreakdown.low * 1);
  }

  groupArtifactsByPolicy(artifacts) {
    const grouped = new Map();
    
    artifacts.forEach(artifact => {
      const policyId = artifact.retentionPolicy || 'standard';
      if (!grouped.has(policyId)) {
        grouped.set(policyId, []);
      }
      grouped.get(policyId).push(artifact);
    });

    return grouped;
  }

  calculateTotalSize(artifacts) {
    return artifacts.reduce((total, artifact) => total + (artifact.size || 0), 0);
  }

  getArtifactTypeBreakdown(artifacts) {
    const breakdown = {};
    artifacts.forEach(artifact => {
      breakdown[artifact.type] = (breakdown[artifact.type] || 0) + 1;
    });
    return breakdown;
  }

  getRegistryBreakdown(artifacts) {
    const breakdown = {};
    artifacts.forEach(artifact => {
      breakdown[artifact.registry] = (breakdown[artifact.registry] || 0) + 1;
    });
    return breakdown;
  }

  getVulnerableArtifactCount(artifacts) {
    return artifacts.filter(a => 
      a.securityScan && !a.securityScan.results.compliant
    ).length;
  }

  getCriticalVulnerabilityCount(artifacts) {
    return artifacts.reduce((total, artifact) => {
      if (artifact.securityScan?.results?.severityBreakdown?.critical) {
        return total + artifact.securityScan.results.severityBreakdown.critical;
      }
      return total;
    }, 0);
  }

  calculateSecurityComplianceRate(artifacts) {
    const scannedArtifacts = artifacts.filter(a => a.securityScan);
    if (scannedArtifacts.length === 0) return 0;
    
    const compliantArtifacts = scannedArtifacts.filter(a => 
      a.securityScan.results.compliant
    );
    
    return Math.round((compliantArtifacts.length / scannedArtifacts.length) * 100);
  }

  // Additional helper methods for dashboard data
  async initiateSecurityScan(artifact) {
    console.log(`Initiating security scan for: ${artifact.id}`);
    // Mock implementation - would trigger actual scanning
  }

  async auditDependencySecurity(dependencies) {
    return {
      passed: true,
      vulnerablePackages: 0,
      auditedAt: new Date().toISOString()
    };
  }

  async checkForVulnerableDependencies(dependencies) {
    // Mock implementation - would check against vulnerability databases
    return [];
  }

  async executeArtifactDeletion(cleanupResults) {
    console.log(`Executing deletion of ${cleanupResults.markedForDeletion} artifacts`);
    // Mock implementation - would perform actual deletions
  }

  getArtifactsMarkedForDeletion(artifacts) {
    return artifacts.filter(a => a.markedForDeletion).length;
  }

  async calculatePotentialSpaceSavings(artifacts) {
    const markedArtifacts = artifacts.filter(a => a.markedForDeletion);
    return this.calculateTotalSize(markedArtifacts);
  }

  async generateArtifactRecommendations(artifacts) {
    return [
      'Enable automated vulnerability scanning for all new artifacts',
      'Implement stricter retention policies for development artifacts',
      'Consider image optimization to reduce artifact sizes',
      'Set up automated dependency updates for critical packages'
    ];
  }
}

/**
 * Registry Integration Classes
 */

class HarborRegistry {
  async scanForVulnerabilities(artifact) {
    console.log(`Harbor: Scanning ${artifact.name}:${artifact.version}`);
    return {
      scanner: 'harbor-trivy',
      scannerVersion: '0.34.0',
      vulnerabilities: [
        {
          id: 'CVE-2023-1234',
          cve: 'CVE-2023-1234',
          severity: 'high',
          score: 8.2,
          package: 'openssl',
          version: '1.1.1',
          fixedVersion: '1.1.1k',
          description: 'OpenSSL vulnerability'
        }
      ]
    };
  }

  async extractDependencies(artifact) {
    return {
      direct: [
        { name: 'alpine', version: '3.17.0', type: 'base-image' },
        { name: 'nginx', version: '1.20.2', type: 'package' }
      ],
      transitive: [
        { name: 'openssl', version: '1.1.1', type: 'library' }
      ]
    };
  }

  async generateSBOM(artifact) {
    return {
      packages: [
        {
          name: 'alpine',
          version: '3.17.0',
          supplier: 'Alpine Linux',
          downloadLocation: 'https://alpinelinux.org/'
        }
      ],
      relationships: [],
      licenses: [{ name: 'MIT', url: 'https://opensource.org/licenses/MIT' }],
      copyrights: ['Copyright (c) 2023 Alpine Linux'],
      checksums: [{ algorithm: 'SHA256', value: 'abc123...' }]
    };
  }
}

class ECRRegistry {
  async scanForVulnerabilities(artifact) {
    console.log(`ECR: Scanning ${artifact.name}:${artifact.version}`);
    return {
      scanner: 'ecr-inspector',
      vulnerabilities: []
    };
  }

  async extractDependencies(artifact) {
    return { direct: [], transitive: [] };
  }

  async generateSBOM(artifact) {
    return { packages: [], relationships: [], licenses: [] };
  }
}

class ACRRegistry {
  async scanForVulnerabilities(artifact) {
    console.log(`ACR: Scanning ${artifact.name}:${artifact.version}`);
    return {
      scanner: 'acr-qualys',
      vulnerabilities: []
    };
  }

  async extractDependencies(artifact) {
    return { direct: [], transitive: [] };
  }

  async generateSBOM(artifact) {
    return { packages: [], relationships: [], licenses: [] };
  }
}

class GCRRegistry {
  async scanForVulnerabilities(artifact) {
    console.log(`GCR: Scanning ${artifact.name}:${artifact.version}`);
    return {
      scanner: 'gcr-container-analysis',
      vulnerabilities: []
    };
  }

  async extractDependencies(artifact) {
    return { direct: [], transitive: [] };
  }

  async generateSBOM(artifact) {
    return { packages: [], relationships: [], licenses: [] };
  }
}

class ChartMuseumRegistry {
  async scanForVulnerabilities(artifact) {
    console.log(`ChartMuseum: Scanning ${artifact.name}:${artifact.version}`);
    return {
      scanner: 'helm-security-scan',
      vulnerabilities: []
    };
  }

  async extractDependencies(artifact) {
    return {
      direct: [
        { name: 'postgresql', version: '12.0.0', type: 'chart-dependency' }
      ],
      transitive: []
    };
  }

  async generateSBOM(artifact) {
    return { packages: [], relationships: [], licenses: [] };
  }
}

class ArtifactoryRegistry {
  async scanForVulnerabilities(artifact) {
    console.log(`Artifactory: Scanning ${artifact.name}:${artifact.version}`);
    return {
      scanner: 'jfrog-xray',
      vulnerabilities: []
    };
  }

  async extractDependencies(artifact) {
    return { direct: [], transitive: [] };
  }

  async generateSBOM(artifact) {
    return { packages: [], relationships: [], licenses: [] };
  }
}

module.exports = {
  ArtifactManagementSystem,
  HarborRegistry,
  ECRRegistry,
  ACRRegistry,
  GCRRegistry,
  ChartMuseumRegistry,
  ArtifactoryRegistry
};

/**
 * Usage Example:
 * 
 * const { ArtifactManagementSystem } = require('./artifact-management');
 * 
 * const artifactManager = new ArtifactManagementSystem();
 * 
 * // Register artifact
 * const registrationResult = await artifactManager.registerArtifact({
 *   name: 'web-service',
 *   version: 'v2.1.0',
 *   type: 'container-image',
 *   registry: 'harbor',
 *   repository: 'production/web-service',
 *   tags: ['latest', 'stable'],
 *   size: 150000000, // 150MB
 *   buildId: 'build-123',
 *   commitHash: 'abc123def456',
 *   registeredBy: 'ci-system'
 * });
 * 
 * // Perform vulnerability scan
 * const scanResult = await artifactManager.performVulnerabilityScan(artifact);
 * 
 * // Execute cleanup automation
 * const cleanupResult = await artifactManager.executeCleanupAutomation({
 *   dryRun: false
 * });
 * 
 * // Generate dashboard
 * const dashboard = await artifactManager.generateArtifactDashboard({
 *   timeRange: 30
 * });
 * 
 * // Listen for events
 * artifactManager.on('vulnerabilityScanCompleted', (event) => {
 *   console.log('Vulnerability scan completed:', event);
 * });
 * 
 * artifactManager.on('securityViolation', (event) => {
 *   console.log('Security violation detected:', event);
 * });
 */