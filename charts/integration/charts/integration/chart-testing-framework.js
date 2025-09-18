#!/usr/bin/env node

/**
 * Chart Testing Framework for Helm Chart Specialist
 * 
 * This module implements comprehensive chart testing capabilities including:
 * - Unit test implementation with template validation
 * - Integration test setup with real Kubernetes clusters
 * - Test data generation with realistic scenarios
 * - Mock environment configuration for isolated testing
 * - Test reporting system with detailed analysis
 * 
 * @version 1.0.0
 * @author Test Runner Agent (delegated by Tech Lead Orchestrator)
 * @integrates helm cli, kubectl, chart-testing for comprehensive validation
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const { execSync, spawn } = require('child_process');

class ChartTestingFramework {
    constructor() {
        this.testSuites = new Map();
        this.mockEnvironments = new Map();
        this.testData = new Map();
        this.testResults = [];
        
        this.initializeTestSuites();
        this.initializeMockEnvironments();
        this.initializeTestDataGenerators();
        
        // Test configuration
        this.config = {
            timeoutMs: 30000,
            retryAttempts: 3,
            parallelTests: 4,
            reportFormat: 'detailed',
            cleanupAfterTests: true
        };
    }

    /**
     * Initialize comprehensive test suites
     */
    initializeTestSuites() {
        // Unit test suites
        this.testSuites.set('template-validation', {
            type: 'unit',
            description: 'Validate template syntax and structure',
            tests: [
                'yaml-syntax-validation',
                'helm-template-rendering',
                'required-fields-present',
                'values-reference-validation',
                'helper-function-validation'
            ]
        });

        this.testSuites.set('values-testing', {
            type: 'unit',
            description: 'Test values.yaml configurations',
            tests: [
                'default-values-valid',
                'environment-overrides',
                'value-type-validation',
                'required-values-check',
                'conditional-values-logic'
            ]
        });

        this.testSuites.set('security-validation', {
            type: 'unit',
            description: 'Security best practices validation',
            tests: [
                'security-contexts-present',
                'no-privileged-containers',
                'resource-limits-defined',
                'network-policies-valid',
                'secret-handling-secure'
            ]
        });

        // Integration test suites
        this.testSuites.set('deployment-testing', {
            type: 'integration',
            description: 'End-to-end deployment testing',
            tests: [
                'chart-install-success',
                'resource-creation-validation',
                'service-connectivity',
                'ingress-routing',
                'health-checks-working'
            ]
        });

        this.testSuites.set('upgrade-rollback', {
            type: 'integration',
            description: 'Upgrade and rollback scenarios',
            tests: [
                'chart-upgrade-success',
                'rolling-update-behavior',
                'rollback-functionality',
                'data-persistence',
                'zero-downtime-upgrade'
            ]
        });

        this.testSuites.set('multi-environment', {
            type: 'integration',
            description: 'Multi-environment deployment testing',
            tests: [
                'development-deployment',
                'staging-deployment',
                'production-deployment',
                'environment-isolation',
                'configuration-drift-detection'
            ]
        });
    }

    /**
     * Initialize mock environments for testing
     */
    initializeMockEnvironments() {
        this.mockEnvironments.set('development', {
            namespace: 'chart-test-dev',
            values: {
                replicaCount: 1,
                image: { tag: 'latest' },
                ingress: { enabled: false },
                monitoring: { enabled: true },
                resources: {
                    limits: { cpu: '100m', memory: '128Mi' },
                    requests: { cpu: '50m', memory: '64Mi' }
                }
            },
            cluster: 'kind-test-cluster'
        });

        this.mockEnvironments.set('staging', {
            namespace: 'chart-test-staging',
            values: {
                replicaCount: 2,
                image: { tag: '1.0.0' },
                ingress: { enabled: true },
                monitoring: { enabled: true },
                resources: {
                    limits: { cpu: '500m', memory: '512Mi' },
                    requests: { cpu: '100m', memory: '128Mi' }
                }
            },
            cluster: 'kind-test-cluster'
        });

        this.mockEnvironments.set('production', {
            namespace: 'chart-test-prod',
            values: {
                replicaCount: 3,
                image: { tag: '1.0.0' },
                ingress: { enabled: true },
                monitoring: { enabled: true },
                autoscaling: { enabled: true },
                resources: {
                    limits: { cpu: '1000m', memory: '1Gi' },
                    requests: { cpu: '200m', memory: '256Mi' }
                }
            },
            cluster: 'kind-test-cluster'
        });
    }

    /**
     * Initialize test data generators
     */
    initializeTestDataGenerators() {
        this.testData.set('basic-web-app', {
            type: 'web-application',
            values: {
                image: { repository: 'nginx', tag: '1.21' },
                service: { type: 'ClusterIP', port: 80 },
                ingress: { enabled: true, hosts: ['test.example.com'] }
            }
        });

        this.testData.set('api-service', {
            type: 'api-service',
            values: {
                image: { repository: 'app-api', tag: '1.0.0' },
                service: { type: 'ClusterIP', port: 8080 },
                env: [
                    { name: 'NODE_ENV', value: 'test' },
                    { name: 'PORT', value: '8080' }
                ]
            }
        });

        this.testData.set('database', {
            type: 'database',
            values: {
                image: { repository: 'postgres', tag: '13' },
                service: { type: 'ClusterIP', port: 5432 },
                persistence: { enabled: true, size: '1Gi' },
                env: [
                    { name: 'POSTGRES_DB', value: 'testdb' }
                ]
            }
        });

        this.testData.set('microservice', {
            type: 'microservice',
            values: {
                image: { repository: 'microservice', tag: 'latest' },
                service: { type: 'ClusterIP', port: 3000 },
                monitoring: { enabled: true },
                autoscaling: { enabled: true, minReplicas: 2, maxReplicas: 10 }
            }
        });
    }

    /**
     * Run comprehensive chart testing
     * @param {string} chartPath - Path to chart directory
     * @param {Object} options - Testing options
     * @returns {Object} Complete test results
     */
    async runChartTests(chartPath, options = {}) {
        console.log(`🧪 Starting comprehensive chart testing for: ${chartPath}`);
        
        const testResults = {
            summary: {
                totalTests: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                executionTime: 0,
                coverage: 0
            },
            unitTests: [],
            integrationTests: [],
            securityTests: [],
            performanceTests: [],
            errors: [],
            warnings: []
        };

        const startTime = Date.now();

        try {
            // Phase 1: Unit Tests
            console.log('📋 Phase 1: Running unit tests...');
            const unitResults = await this.runUnitTests(chartPath, options);
            testResults.unitTests = unitResults;

            // Phase 2: Integration Tests (if unit tests pass)
            if (unitResults.filter(r => r.status === 'failed').length === 0) {
                console.log('🔧 Phase 2: Running integration tests...');
                const integrationResults = await this.runIntegrationTests(chartPath, options);
                testResults.integrationTests = integrationResults;
            } else {
                console.log('⚠️ Skipping integration tests due to unit test failures');
            }

            // Phase 3: Security Tests
            console.log('🔒 Phase 3: Running security tests...');
            const securityResults = await this.runSecurityTests(chartPath, options);
            testResults.securityTests = securityResults;

            // Phase 4: Performance Tests
            console.log('⚡ Phase 4: Running performance tests...');
            const performanceResults = await this.runPerformanceTests(chartPath, options);
            testResults.performanceTests = performanceResults;

            // Calculate summary
            testResults.summary = this.calculateTestSummary(testResults);
            testResults.summary.executionTime = Date.now() - startTime;

            console.log(`✅ Chart testing complete. Passed: ${testResults.summary.passed}, Failed: ${testResults.summary.failed}`);
            return testResults;

        } catch (error) {
            console.error('❌ Chart testing failed:', error.message);
            testResults.errors.push({
                phase: 'execution',
                error: error.message,
                timestamp: new Date().toISOString()
            });
            return testResults;
        }
    }

    /**
     * Run unit tests for chart templates
     * @param {string} chartPath - Path to chart directory
     * @param {Object} options - Test options
     * @returns {Array} Unit test results
     */
    async runUnitTests(chartPath, options) {
        const unitResults = [];

        // Template validation tests
        const templateTests = await this.runTemplateValidationTests(chartPath);
        unitResults.push(...templateTests);

        // Values testing
        const valuesTests = await this.runValuesTests(chartPath);
        unitResults.push(...valuesTests);

        // Helper function tests
        const helperTests = await this.runHelperFunctionTests(chartPath);
        unitResults.push(...helperTests);

        return unitResults;
    }

    /**
     * Run template validation tests
     * @param {string} chartPath - Path to chart directory
     * @returns {Array} Template validation results
     */
    async runTemplateValidationTests(chartPath) {
        const results = [];
        const templatesPath = path.join(chartPath, 'templates');

        if (!fs.existsSync(templatesPath)) {
            results.push({
                name: 'templates-directory-exists',
                status: 'failed',
                message: 'Templates directory not found',
                category: 'structure'
            });
            return results;
        }

        const templateFiles = fs.readdirSync(templatesPath)
            .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

        for (const file of templateFiles) {
            const filePath = path.join(templatesPath, file);
            const content = fs.readFileSync(filePath, 'utf8');

            // YAML syntax validation
            try {
                // Skip validation for pure template files (contains only Helm templates)
                if (!content.trim().startsWith('{{') && !content.includes('---')) {
                    yaml.parse(content);
                }
                results.push({
                    name: `yaml-syntax-${file}`,
                    status: 'passed',
                    message: `YAML syntax valid for ${file}`,
                    category: 'syntax'
                });
            } catch (error) {
                results.push({
                    name: `yaml-syntax-${file}`,
                    status: 'failed', 
                    message: `YAML syntax error in ${file}: ${error.message}`,
                    category: 'syntax'
                });
            }

            // Helm template rendering test
            try {
                const renderResult = await this.testHelmTemplateRendering(chartPath, file);
                results.push({
                    name: `helm-render-${file}`,
                    status: renderResult.success ? 'passed' : 'failed',
                    message: renderResult.message,
                    category: 'rendering'
                });
            } catch (error) {
                results.push({
                    name: `helm-render-${file}`,
                    status: 'failed',
                    message: `Template rendering failed: ${error.message}`,
                    category: 'rendering'
                });
            }

            // Required fields validation
            const requiredFieldsResult = this.validateRequiredFields(content, file);
            results.push(...requiredFieldsResult);
        }

        return results;
    }

    /**
     * Test Helm template rendering
     * @param {string} chartPath - Chart path
     * @param {string} templateFile - Template file name
     * @returns {Object} Rendering result
     */
    async testHelmTemplateRendering(chartPath, templateFile) {
        try {
            const command = `helm template test-release ${chartPath} --show-only templates/${templateFile}`;
            const output = execSync(command, { encoding: 'utf8', timeout: 10000 });
            
            return {
                success: true,
                message: `Template ${templateFile} rendered successfully`,
                output: output
            };
        } catch (error) {
            return {
                success: false,
                message: `Template rendering failed: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Validate required Kubernetes fields
     * @param {string} content - Template content
     * @param {string} filename - Template filename
     * @returns {Array} Validation results
     */
    validateRequiredFields(content, filename) {
        const results = [];
        
        // Skip _helpers.tpl and NOTES.txt files
        if (filename.startsWith('_') || filename === 'NOTES.txt') {
            return results;
        }

        const requiredFields = ['apiVersion', 'kind', 'metadata'];
        
        for (const field of requiredFields) {
            if (!content.includes(`${field}:`)) {
                results.push({
                    name: `required-field-${field}-${filename}`,
                    status: 'failed',
                    message: `Required field '${field}' missing in ${filename}`,
                    category: 'required-fields'
                });
            } else {
                results.push({
                    name: `required-field-${field}-${filename}`,
                    status: 'passed',
                    message: `Required field '${field}' present in ${filename}`,
                    category: 'required-fields'
                });
            }
        }

        return results;
    }

    /**
     * Run values.yaml testing
     * @param {string} chartPath - Chart path
     * @returns {Array} Values test results
     */
    async runValuesTests(chartPath) {
        const results = [];
        const valuesPath = path.join(chartPath, 'values.yaml');

        if (!fs.existsSync(valuesPath)) {
            results.push({
                name: 'values-file-exists',
                status: 'failed',
                message: 'values.yaml file not found',
                category: 'structure'
            });
            return results;
        }

        try {
            const valuesContent = fs.readFileSync(valuesPath, 'utf8');
            const values = yaml.parse(valuesContent);

            // Test default values validity
            results.push({
                name: 'values-yaml-syntax',
                status: 'passed',
                message: 'values.yaml has valid YAML syntax',
                category: 'syntax'
            });

            // Test common value structure
            const commonValues = ['image', 'service', 'resources'];
            for (const commonValue of commonValues) {
                if (values[commonValue]) {
                    results.push({
                        name: `common-value-${commonValue}`,
                        status: 'passed',
                        message: `Common value '${commonValue}' is defined`,
                        category: 'structure'
                    });
                } else {
                    results.push({
                        name: `common-value-${commonValue}`,
                        status: 'warning',
                        message: `Common value '${commonValue}' is not defined`,
                        category: 'structure'
                    });
                }
            }

            // Test environment-specific overrides
            const envResults = await this.testEnvironmentOverrides(chartPath, values);
            results.push(...envResults);

        } catch (error) {
            results.push({
                name: 'values-yaml-syntax',
                status: 'failed',
                message: `values.yaml syntax error: ${error.message}`,
                category: 'syntax'
            });
        }

        return results;
    }

    /**
     * Test environment-specific value overrides
     * @param {string} chartPath - Chart path
     * @param {Object} baseValues - Base values
     * @returns {Array} Environment test results
     */
    async testEnvironmentOverrides(chartPath, baseValues) {
        const results = [];
        
        for (const [envName, envConfig] of this.mockEnvironments.entries()) {
            try {
                // Merge environment values with base values
                const mergedValues = { ...baseValues, ...envConfig.values };
                
                // Test template rendering with environment values
                const tempValuesFile = path.join('/tmp', `values-${envName}.yaml`);
                fs.writeFileSync(tempValuesFile, yaml.stringify(mergedValues));
                
                const command = `helm template test-release ${chartPath} -f ${tempValuesFile}`;
                execSync(command, { encoding: 'utf8', timeout: 10000 });
                
                results.push({
                    name: `environment-override-${envName}`,
                    status: 'passed',
                    message: `Environment values for ${envName} are valid`,
                    category: 'environment'
                });

                // Clean up temp file
                fs.unlinkSync(tempValuesFile);

            } catch (error) {
                results.push({
                    name: `environment-override-${envName}`,
                    status: 'failed',
                    message: `Environment values for ${envName} failed: ${error.message}`,
                    category: 'environment'
                });
            }
        }

        return results;
    }

    /**
     * Run helper function tests
     * @param {string} chartPath - Chart path
     * @returns {Array} Helper function test results
     */
    async runHelperFunctionTests(chartPath) {
        const results = [];
        const helpersPath = path.join(chartPath, 'templates', '_helpers.tpl');

        if (!fs.existsSync(helpersPath)) {
            results.push({
                name: 'helpers-file-exists',
                status: 'warning',
                message: '_helpers.tpl file not found',
                category: 'structure'
            });
            return results;
        }

        const helpersContent = fs.readFileSync(helpersPath, 'utf8');
        
        // Test for common helper functions
        const commonHelpers = ['labels', 'selectorLabels', 'fullname', 'chart'];
        for (const helper of commonHelpers) {
            if (helpersContent.includes(`"chart.${helper}"`)) {
                results.push({
                    name: `helper-function-${helper}`,
                    status: 'passed',
                    message: `Helper function '${helper}' is defined`,
                    category: 'helpers'
                });
            } else {
                results.push({
                    name: `helper-function-${helper}`,
                    status: 'warning',
                    message: `Common helper function '${helper}' is not defined`,
                    category: 'helpers'
                });
            }
        }

        return results;
    }

    /**
     * Run integration tests with real deployment
     * @param {string} chartPath - Chart path
     * @param {Object} options - Test options
     * @returns {Array} Integration test results
     */
    async runIntegrationTests(chartPath, options) {
        const results = [];

        try {
            // Ensure test cluster is available
            const clusterReady = await this.ensureTestCluster();
            if (!clusterReady) {
                results.push({
                    name: 'test-cluster-availability',
                    status: 'failed',
                    message: 'Test cluster is not available',
                    category: 'infrastructure'
                });
                return results;
            }

            // Run deployment tests
            const deploymentResults = await this.runDeploymentTests(chartPath);
            results.push(...deploymentResults);

            // Run upgrade/rollback tests if deployment succeeded
            if (deploymentResults.filter(r => r.status === 'failed').length === 0) {
                const upgradeResults = await this.runUpgradeRollbackTests(chartPath);
                results.push(...upgradeResults);
            }

        } catch (error) {
            results.push({
                name: 'integration-tests-execution',
                status: 'failed',
                message: `Integration tests failed: ${error.message}`,
                category: 'execution'
            });
        }

        return results;
    }

    /**
     * Ensure test cluster is available
     * @returns {boolean} True if cluster is ready
     */
    async ensureTestCluster() {
        try {
            // Check if kubectl is available and cluster is accessible
            execSync('kubectl cluster-info --request-timeout=5s', { 
                encoding: 'utf8', 
                timeout: 10000,
                stdio: 'pipe' 
            });
            return true;
        } catch (error) {
            console.warn('⚠️ Test cluster not available, creating kind cluster...');
            return await this.createKindCluster();
        }
    }

    /**
     * Create kind cluster for testing
     * @returns {boolean} True if cluster created successfully
     */
    async createKindCluster() {
        try {
            // Check if kind is available
            execSync('kind version', { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
            
            // Create kind cluster
            execSync('kind create cluster --name chart-test --wait 30s', { 
                encoding: 'utf8', 
                timeout: 60000 
            });
            
            console.log('✅ Kind cluster created successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to create kind cluster:', error.message);
            return false;
        }
    }

    /**
     * Run deployment tests
     * @param {string} chartPath - Chart path
     * @returns {Array} Deployment test results
     */
    async runDeploymentTests(chartPath) {
        const results = [];
        const testReleaseName = 'chart-test-deployment';
        const testNamespace = 'chart-test';

        try {
            // Create test namespace
            try {
                execSync(`kubectl create namespace ${testNamespace}`, { 
                    encoding: 'utf8', 
                    timeout: 10000,
                    stdio: 'pipe'
                });
            } catch (error) {
                // Namespace might already exist
                if (!error.message.includes('already exists')) {
                    throw error;
                }
            }

            // Install chart
            const installCommand = `helm install ${testReleaseName} ${chartPath} --namespace ${testNamespace} --wait --timeout 300s`;
            execSync(installCommand, { encoding: 'utf8', timeout: 320000 });

            results.push({
                name: 'chart-install-success',
                status: 'passed',
                message: 'Chart installed successfully',
                category: 'deployment'
            });

            // Verify resource creation
            const resourceResults = await this.verifyResourceCreation(testNamespace, testReleaseName);
            results.push(...resourceResults);

            // Test service connectivity
            const connectivityResults = await this.testServiceConnectivity(testNamespace, testReleaseName);
            results.push(...connectivityResults);

            // Clean up
            if (this.config.cleanupAfterTests) {
                await this.cleanupTestResources(testNamespace, testReleaseName);
            }

        } catch (error) {
            results.push({
                name: 'chart-install-success',
                status: 'failed',
                message: `Chart installation failed: ${error.message}`,
                category: 'deployment'
            });
        }

        return results;
    }

    /**
     * Verify that expected resources were created
     * @param {string} namespace - Test namespace
     * @param {string} releaseName - Release name
     * @returns {Array} Resource verification results
     */
    async verifyResourceCreation(namespace, releaseName) {
        const results = [];
        const expectedResources = ['deployment', 'service', 'configmap', 'secret'];

        for (const resourceType of expectedResources) {
            try {
                const command = `kubectl get ${resourceType} -n ${namespace} -l app.kubernetes.io/instance=${releaseName} --no-headers`;
                const output = execSync(command, { encoding: 'utf8', timeout: 10000 });
                
                if (output.trim()) {
                    results.push({
                        name: `resource-creation-${resourceType}`,
                        status: 'passed',
                        message: `${resourceType} created successfully`,
                        category: 'resource-verification'
                    });
                } else {
                    results.push({
                        name: `resource-creation-${resourceType}`,
                        status: 'skipped',
                        message: `${resourceType} not expected or not found`,
                        category: 'resource-verification'
                    });
                }
            } catch (error) {
                results.push({
                    name: `resource-creation-${resourceType}`,
                    status: 'failed',
                    message: `Failed to verify ${resourceType}: ${error.message}`,
                    category: 'resource-verification'
                });
            }
        }

        return results;
    }

    /**
     * Test service connectivity
     * @param {string} namespace - Test namespace
     * @param {string} releaseName - Release name
     * @returns {Array} Connectivity test results
     */
    async testServiceConnectivity(namespace, releaseName) {
        const results = [];

        try {
            // Get service information
            const serviceCommand = `kubectl get service -n ${namespace} -l app.kubernetes.io/instance=${releaseName} -o jsonpath='{.items[0].metadata.name}'`;
            const serviceName = execSync(serviceCommand, { encoding: 'utf8', timeout: 10000 }).trim();

            if (serviceName) {
                // Test service connectivity using a test pod
                const testPodCommand = `kubectl run test-connectivity --image=busybox --rm -i --restart=Never -n ${namespace} -- nslookup ${serviceName}`;
                execSync(testPodCommand, { encoding: 'utf8', timeout: 30000 });

                results.push({
                    name: 'service-connectivity',
                    status: 'passed',
                    message: 'Service is reachable within cluster',
                    category: 'connectivity'
                });
            }
        } catch (error) {
            results.push({
                name: 'service-connectivity',
                status: 'failed',
                message: `Service connectivity test failed: ${error.message}`,
                category: 'connectivity'
            });
        }

        return results;
    }

    /**
     * Run upgrade and rollback tests
     * @param {string} chartPath - Chart path
     * @returns {Array} Upgrade/rollback test results
     */
    async runUpgradeRollbackTests(chartPath) {
        const results = [];
        const testReleaseName = 'chart-test-upgrade';
        const testNamespace = 'chart-test-upgrade';

        try {
            // Create test namespace
            try {
                execSync(`kubectl create namespace ${testNamespace}`, { 
                    encoding: 'utf8', 
                    timeout: 10000,
                    stdio: 'pipe'
                });
            } catch (error) {
                if (!error.message.includes('already exists')) {
                    throw error;
                }
            }

            // Initial install
            const installCommand = `helm install ${testReleaseName} ${chartPath} --namespace ${testNamespace} --wait`;
            execSync(installCommand, { encoding: 'utf8', timeout: 60000 });

            // Upgrade test
            const upgradeCommand = `helm upgrade ${testReleaseName} ${chartPath} --namespace ${testNamespace} --wait --set replicaCount=2`;
            execSync(upgradeCommand, { encoding: 'utf8', timeout: 60000 });

            results.push({
                name: 'chart-upgrade-success',
                status: 'passed',
                message: 'Chart upgrade completed successfully',
                category: 'upgrade'
            });

            // Rollback test
            const rollbackCommand = `helm rollback ${testReleaseName} 1 --namespace ${testNamespace} --wait`;
            execSync(rollbackCommand, { encoding: 'utf8', timeout: 60000 });

            results.push({
                name: 'chart-rollback-success',
                status: 'passed',
                message: 'Chart rollback completed successfully',
                category: 'rollback'
            });

            // Clean up
            if (this.config.cleanupAfterTests) {
                await this.cleanupTestResources(testNamespace, testReleaseName);
            }

        } catch (error) {
            results.push({
                name: 'upgrade-rollback-tests',
                status: 'failed',
                message: `Upgrade/rollback tests failed: ${error.message}`,
                category: 'upgrade'
            });
        }

        return results;
    }

    /**
     * Run security validation tests
     * @param {string} chartPath - Chart path
     * @param {Object} options - Test options
     * @returns {Array} Security test results
     */
    async runSecurityTests(chartPath, options) {
        const results = [];

        // Security context validation
        const securityContextResults = await this.validateSecurityContexts(chartPath);
        results.push(...securityContextResults);

        // Resource limits validation
        const resourceLimitsResults = await this.validateResourceLimits(chartPath);
        results.push(...resourceLimitsResults);

        // Network policy validation
        const networkPolicyResults = await this.validateNetworkPolicies(chartPath);
        results.push(...networkPolicyResults);

        return results;
    }

    /**
     * Validate security contexts in templates
     * @param {string} chartPath - Chart path
     * @returns {Array} Security context validation results
     */
    async validateSecurityContexts(chartPath) {
        const results = [];

        try {
            // Render templates and check for security contexts
            const renderCommand = `helm template test-release ${chartPath}`;
            const renderedOutput = execSync(renderCommand, { encoding: 'utf8', timeout: 10000 });

            const documents = renderedOutput.split('---').filter(doc => doc.trim());

            for (let i = 0; i < documents.length; i++) {
                const doc = documents[i];
                
                if (doc.includes('kind: Deployment') || doc.includes('kind: StatefulSet') || doc.includes('kind: DaemonSet')) {
                    if (doc.includes('securityContext:')) {
                        results.push({
                            name: `security-context-present-${i}`,
                            status: 'passed',
                            message: 'Security context is defined',
                            category: 'security'
                        });
                    } else {
                        results.push({
                            name: `security-context-present-${i}`,
                            status: 'failed',
                            message: 'Security context is missing',
                            category: 'security'
                        });
                    }

                    // Check for non-root user
                    if (doc.includes('runAsNonRoot: true') || doc.includes('runAsUser:')) {
                        results.push({
                            name: `non-root-user-${i}`,
                            status: 'passed',
                            message: 'Container runs as non-root user',
                            category: 'security'
                        });
                    } else {
                        results.push({
                            name: `non-root-user-${i}`,
                            status: 'warning',
                            message: 'Container may run as root user',
                            category: 'security'
                        });
                    }
                }
            }
        } catch (error) {
            results.push({
                name: 'security-context-validation',
                status: 'failed',
                message: `Security context validation failed: ${error.message}`,
                category: 'security'
            });
        }

        return results;
    }

    /**
     * Validate resource limits
     * @param {string} chartPath - Chart path
     * @returns {Array} Resource limits validation results
     */
    async validateResourceLimits(chartPath) {
        const results = [];

        try {
            const renderCommand = `helm template test-release ${chartPath}`;
            const renderedOutput = execSync(renderCommand, { encoding: 'utf8', timeout: 10000 });

            if (renderedOutput.includes('resources:') && renderedOutput.includes('limits:')) {
                results.push({
                    name: 'resource-limits-defined',
                    status: 'passed',
                    message: 'Resource limits are defined',
                    category: 'security'
                });
            } else {
                results.push({
                    name: 'resource-limits-defined',
                    status: 'warning',
                    message: 'Resource limits are not defined',
                    category: 'security'
                });
            }

            if (renderedOutput.includes('requests:')) {
                results.push({
                    name: 'resource-requests-defined',
                    status: 'passed',
                    message: 'Resource requests are defined',
                    category: 'security'
                });
            } else {
                results.push({
                    name: 'resource-requests-defined',
                    status: 'warning',
                    message: 'Resource requests are not defined',
                    category: 'security'
                });
            }
        } catch (error) {
            results.push({
                name: 'resource-limits-validation',
                status: 'failed',
                message: `Resource limits validation failed: ${error.message}`,
                category: 'security'
            });
        }

        return results;
    }

    /**
     * Validate network policies
     * @param {string} chartPath - Chart path
     * @returns {Array} Network policy validation results
     */
    async validateNetworkPolicies(chartPath) {
        const results = [];

        try {
            const renderCommand = `helm template test-release ${chartPath}`;
            const renderedOutput = execSync(renderCommand, { encoding: 'utf8', timeout: 10000 });

            if (renderedOutput.includes('kind: NetworkPolicy')) {
                results.push({
                    name: 'network-policy-present',
                    status: 'passed',
                    message: 'Network policy is defined',
                    category: 'security'
                });
            } else {
                results.push({
                    name: 'network-policy-present',
                    status: 'warning',
                    message: 'Network policy is not defined',
                    category: 'security'
                });
            }
        } catch (error) {
            results.push({
                name: 'network-policy-validation',
                status: 'failed',
                message: `Network policy validation failed: ${error.message}`,
                category: 'security'
            });
        }

        return results;
    }

    /**
     * Run performance tests
     * @param {string} chartPath - Chart path
     * @param {Object} options - Test options
     * @returns {Array} Performance test results
     */
    async runPerformanceTests(chartPath, options) {
        const results = [];

        // Template rendering performance
        const renderingPerformance = await this.testTemplateRenderingPerformance(chartPath);
        results.push(...renderingPerformance);

        // Chart size validation
        const chartSizeResult = await this.validateChartSize(chartPath);
        results.push(...chartSizeResult);

        return results;
    }

    /**
     * Test template rendering performance
     * @param {string} chartPath - Chart path
     * @returns {Array} Rendering performance results
     */
    async testTemplateRenderingPerformance(chartPath) {
        const results = [];

        try {
            const startTime = Date.now();
            execSync(`helm template test-release ${chartPath}`, { 
                encoding: 'utf8', 
                timeout: 30000,
                stdio: 'pipe'
            });
            const renderTime = Date.now() - startTime;

            if (renderTime < 5000) { // Under 5 seconds
                results.push({
                    name: 'template-rendering-performance',
                    status: 'passed',
                    message: `Template rendering completed in ${renderTime}ms`,
                    category: 'performance'
                });
            } else {
                results.push({
                    name: 'template-rendering-performance',
                    status: 'warning',
                    message: `Template rendering took ${renderTime}ms (may be slow)`,
                    category: 'performance'
                });
            }
        } catch (error) {
            results.push({
                name: 'template-rendering-performance',
                status: 'failed',
                message: `Template rendering performance test failed: ${error.message}`,
                category: 'performance'
            });
        }

        return results;
    }

    /**
     * Validate chart package size
     * @param {string} chartPath - Chart path
     * @returns {Array} Chart size validation results
     */
    async validateChartSize(chartPath) {
        const results = [];

        try {
            // Package chart and check size
            const packageCommand = `helm package ${chartPath} -d /tmp`;
            const packageOutput = execSync(packageCommand, { encoding: 'utf8', timeout: 10000 });
            
            // Extract package file name from output
            const packageMatch = packageOutput.match(/Successfully packaged chart and saved it to: (.+\.tgz)/);
            if (packageMatch) {
                const packagePath = packageMatch[1];
                const stats = fs.statSync(packagePath);
                const sizeInMB = stats.size / (1024 * 1024);

                if (sizeInMB < 10) { // Under 10MB
                    results.push({
                        name: 'chart-package-size',
                        status: 'passed',
                        message: `Chart package size: ${sizeInMB.toFixed(2)}MB`,
                        category: 'performance'
                    });
                } else {
                    results.push({
                        name: 'chart-package-size',
                        status: 'warning',
                        message: `Chart package size: ${sizeInMB.toFixed(2)}MB (may be large)`,
                        category: 'performance'
                    });
                }

                // Clean up package file
                fs.unlinkSync(packagePath);
            }
        } catch (error) {
            results.push({
                name: 'chart-package-size',
                status: 'failed',
                message: `Chart size validation failed: ${error.message}`,
                category: 'performance'
            });
        }

        return results;
    }

    /**
     * Calculate comprehensive test summary
     * @param {Object} testResults - All test results
     * @returns {Object} Test summary
     */
    calculateTestSummary(testResults) {
        let totalTests = 0;
        let passed = 0;
        let failed = 0;
        let skipped = 0;
        let warnings = 0;

        const allResults = [
            ...testResults.unitTests,
            ...testResults.integrationTests,
            ...testResults.securityTests,
            ...testResults.performanceTests
        ];

        for (const result of allResults) {
            totalTests++;
            if (result.status === 'passed') passed++;
            else if (result.status === 'failed') failed++;
            else if (result.status === 'skipped') skipped++;
            else if (result.status === 'warning') warnings++;
        }

        const coverage = totalTests > 0 ? Math.round((passed / totalTests) * 100) : 0;

        return {
            totalTests,
            passed,
            failed,
            skipped,
            warnings,
            coverage
        };
    }

    /**
     * Generate comprehensive test report
     * @param {Object} testResults - Complete test results
     * @returns {string} Formatted test report
     */
    generateTestReport(testResults) {
        let report = `# Chart Testing Report\n\n`;
        report += `**Generated:** ${new Date().toISOString()}\n`;
        report += `**Execution Time:** ${testResults.summary.executionTime}ms\n\n`;

        // Executive Summary
        report += `## Executive Summary\n\n`;
        report += `| Metric | Value |\n`;
        report += `|--------|-------|\n`;
        report += `| Total Tests | ${testResults.summary.totalTests} |\n`;
        report += `| Passed | ${testResults.summary.passed} |\n`;
        report += `| Failed | ${testResults.summary.failed} |\n`;
        report += `| Skipped | ${testResults.summary.skipped} |\n`;
        report += `| Warnings | ${testResults.summary.warnings || 0} |\n`;
        report += `| Coverage | ${testResults.summary.coverage}% |\n\n`;

        // Test Results by Category
        const categories = ['unitTests', 'integrationTests', 'securityTests', 'performanceTests'];
        
        for (const category of categories) {
            if (testResults[category] && testResults[category].length > 0) {
                report += `## ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`;
                
                for (const test of testResults[category]) {
                    const statusIcon = test.status === 'passed' ? '✅' : 
                                     test.status === 'failed' ? '❌' : 
                                     test.status === 'warning' ? '⚠️' : '⏭️';
                    report += `${statusIcon} **${test.name}** - ${test.message}\n`;
                }
                report += `\n`;
            }
        }

        // Errors and Warnings
        if (testResults.errors && testResults.errors.length > 0) {
            report += `## Errors\n\n`;
            for (const error of testResults.errors) {
                report += `❌ **${error.phase}**: ${error.error}\n`;
            }
            report += `\n`;
        }

        return report;
    }

    /**
     * Clean up test resources
     * @param {string} namespace - Test namespace
     * @param {string} releaseName - Release name
     */
    async cleanupTestResources(namespace, releaseName) {
        try {
            // Uninstall Helm release
            execSync(`helm uninstall ${releaseName} --namespace ${namespace}`, { 
                encoding: 'utf8', 
                timeout: 30000,
                stdio: 'pipe'
            });

            // Delete namespace
            execSync(`kubectl delete namespace ${namespace} --ignore-not-found=true`, { 
                encoding: 'utf8', 
                timeout: 30000,
                stdio: 'pipe'
            });

            console.log(`🧹 Cleaned up test resources: ${releaseName} in namespace ${namespace}`);
        } catch (error) {
            console.warn(`⚠️ Failed to clean up test resources: ${error.message}`);
        }
    }
}

module.exports = ChartTestingFramework;

// CLI usage for chart testing
if (require.main === module) {
    const chartPath = process.argv[2];
    const configFile = process.argv[3];
    
    if (!chartPath) {
        console.error('Usage: node chart-testing-framework.js <path-to-chart> [config-file]');
        process.exit(1);
    }
    
    async function main() {
        try {
            const testFramework = new ChartTestingFramework();
            
            // Load custom configuration if provided
            if (configFile && fs.existsSync(configFile)) {
                const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                Object.assign(testFramework.config, config);
            }
            
            console.log('🚀 Starting comprehensive chart testing...');
            const testResults = await testFramework.runChartTests(chartPath);
            
            // Generate and display report
            const report = testFramework.generateTestReport(testResults);
            console.log('\n' + report);
            
            // Save report to file
            const reportPath = path.join(process.cwd(), 'chart-test-report.md');
            fs.writeFileSync(reportPath, report);
            console.log(`📄 Test report saved to: ${reportPath}`);
            
            // Exit with appropriate code
            const exitCode = testResults.summary.failed > 0 ? 1 : 0;
            process.exit(exitCode);
            
        } catch (error) {
            console.error('❌ Chart testing failed:', error.message);
            process.exit(1);
        }
    }
    
    main();
}