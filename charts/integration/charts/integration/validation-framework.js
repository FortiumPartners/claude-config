#!/usr/bin/env node

/**
 * Validation Framework for Helm Chart Specialist
 * 
 * This module implements comprehensive validation including:
 * - Helm lint integration for chart validation
 * - YAML syntax validation for all chart files
 * - Template rendering tests with different value combinations
 * - Comprehensive error handling with actionable feedback
 * - Validation reporting with detailed results
 * 
 * @version 1.0.0
 * @author Helm Chart Specialist Agent
 * @delegates test-runner for template testing and validation
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

class ValidationFramework {
    constructor() {
        this.validationRules = {
            chart: {
                required_files: ['Chart.yaml', 'values.yaml'],
                optional_files: ['README.md', 'NOTES.txt'],
                template_dirs: ['templates'],
                required_templates: ['deployment.yaml', 'service.yaml']
            },
            security: {
                required_contexts: ['securityContext', 'podSecurityContext'],
                forbidden_capabilities: ['SYS_ADMIN', 'NET_ADMIN', 'SYS_TIME'],
                required_drops: ['ALL'],
                max_privileged_containers: 0
            },
            resources: {
                required_limits: ['cpu', 'memory'],
                required_requests: ['cpu', 'memory'],
                max_cpu_limit: '4000m',
                max_memory_limit: '8Gi'
            },
            networking: {
                allowed_service_types: ['ClusterIP', 'NodePort', 'LoadBalancer'],
                required_ingress_annotations: [],
                forbidden_host_networking: true
            }
        };
        
        this.validationLevels = {
            ERROR: 'error',
            WARNING: 'warning',
            INFO: 'info'
        };
        
        this.testScenarios = [
            {
                name: 'minimal-values',
                description: 'Test with minimal required values',
                values: {}
            },
            {
                name: 'development',
                description: 'Development environment configuration',
                values: {
                    global: { environment: 'development' },
                    replicaCount: 1,
                    resources: {
                        limits: { cpu: '500m', memory: '512Mi' },
                        requests: { cpu: '100m', memory: '128Mi' }
                    }
                }
            },
            {
                name: 'production',
                description: 'Production environment configuration',
                values: {
                    global: { environment: 'production' },
                    replicaCount: 3,
                    autoscaling: { enabled: true, minReplicas: 3, maxReplicas: 10 },
                    resources: {
                        limits: { cpu: '2000m', memory: '2Gi' },
                        requests: { cpu: '500m', memory: '512Mi' }
                    }
                }
            },
            {
                name: 'security-hardened',
                description: 'Maximum security configuration',
                values: {
                    securityContext: {
                        runAsNonRoot: true,
                        runAsUser: 65534,
                        readOnlyRootFilesystem: true,
                        allowPrivilegeEscalation: false,
                        capabilities: { drop: ['ALL'] }
                    },
                    networkPolicy: { enabled: true },
                    podSecurityContext: {
                        runAsNonRoot: true,
                        runAsUser: 65534,
                        fsGroup: 65534
                    }
                }
            }
        ];
    }

    /**
     * Perform comprehensive validation of Helm chart
     * @param {string} chartPath - Path to Helm chart directory
     * @param {Object} options - Validation options
     * @returns {Object} Comprehensive validation results
     */
    async validateChart(chartPath, options = {}) {
        const results = {
            chartPath,
            timestamp: new Date().toISOString(),
            overall: { valid: true, score: 100 },
            validations: {
                structure: await this.validateChartStructure(chartPath),
                yaml: await this.validateYAMLSyntax(chartPath),
                helm: await this.validateWithHelm(chartPath),
                security: await this.validateSecurity(chartPath),
                templates: await this.validateTemplates(chartPath),
                values: await this.validateValues(chartPath),
                rendering: await this.validateRendering(chartPath)
            },
            recommendations: [],
            summary: {
                errors: 0,
                warnings: 0,
                info: 0
            }
        };
        
        // Calculate overall validation status
        this.calculateOverallStatus(results);
        
        // Generate recommendations
        results.recommendations = this.generateRecommendations(results);
        
        return results;
    }

    /**
     * Validate chart structure and required files
     * @param {string} chartPath - Path to Helm chart directory
     * @returns {Object} Structure validation results
     */
    async validateChartStructure(chartPath) {
        const validation = {
            name: 'Chart Structure',
            valid: true,
            issues: [],
            warnings: [],
            info: []
        };
        
        try {
            // Check if chart directory exists
            if (!fs.existsSync(chartPath)) {
                validation.valid = false;
                validation.issues.push(`Chart directory does not exist: ${chartPath}`);
                return validation;
            }
            
            // Validate required files
            for (const file of this.validationRules.chart.required_files) {
                const filePath = path.join(chartPath, file);
                if (!fs.existsSync(filePath)) {
                    validation.valid = false;
                    validation.issues.push(`Required file missing: ${file}`);
                } else {
                    validation.info.push(`Required file found: ${file}`);
                }
            }
            
            // Check optional files
            for (const file of this.validationRules.chart.optional_files) {
                const filePath = path.join(chartPath, file);
                if (!fs.existsSync(filePath)) {
                    validation.warnings.push(`Optional file missing: ${file} (recommended)`);
                } else {
                    validation.info.push(`Optional file found: ${file}`);
                }
            }
            
            // Validate template directory
            const templatesPath = path.join(chartPath, 'templates');
            if (!fs.existsSync(templatesPath)) {
                validation.valid = false;
                validation.issues.push('Templates directory missing');
            } else {
                // Check for required templates
                for (const template of this.validationRules.chart.required_templates) {
                    const templatePath = path.join(templatesPath, template);
                    if (!fs.existsSync(templatePath)) {
                        validation.warnings.push(`Recommended template missing: ${template}`);
                    } else {
                        validation.info.push(`Template found: ${template}`);
                    }
                }
            }
            
            // Validate Chart.yaml content
            const chartYamlPath = path.join(chartPath, 'Chart.yaml');
            if (fs.existsSync(chartYamlPath)) {
                const chartContent = fs.readFileSync(chartYamlPath, 'utf8');
                try {
                    const chart = require('yaml').parse(chartContent);
                    
                    if (!chart.name) {
                        validation.issues.push('Chart.yaml missing required field: name');
                        validation.valid = false;
                    }
                    
                    if (!chart.version) {
                        validation.issues.push('Chart.yaml missing required field: version');
                        validation.valid = false;
                    }
                    
                    if (!chart.description) {
                        validation.warnings.push('Chart.yaml missing recommended field: description');
                    }
                    
                    if (chart.apiVersion !== 'v2') {
                        validation.warnings.push('Chart.yaml should use apiVersion: v2 for modern Helm charts');
                    }
                    
                } catch (error) {
                    validation.issues.push(`Chart.yaml syntax error: ${error.message}`);
                    validation.valid = false;
                }
            }
            
        } catch (error) {
            validation.valid = false;
            validation.issues.push(`Structure validation error: ${error.message}`);
        }
        
        return validation;
    }

    /**
     * Validate YAML syntax in all chart files
     * @param {string} chartPath - Path to Helm chart directory
     * @returns {Object} YAML validation results
     */
    async validateYAMLSyntax(chartPath) {
        const validation = {
            name: 'YAML Syntax',
            valid: true,
            issues: [],
            warnings: [],
            info: []
        };
        
        try {
            const yamlFiles = this.findYamlFiles(chartPath);
            
            for (const file of yamlFiles) {
                try {
                    const content = fs.readFileSync(file, 'utf8');
                    
                    // Skip template files with Helm syntax for now
                    if (!file.includes('/templates/')) {
                        require('yaml').parseAllDocuments(content);
                        validation.info.push(`Valid YAML syntax: ${path.relative(chartPath, file)}`);
                    }
                } catch (error) {
                    validation.valid = false;
                    validation.issues.push(`YAML syntax error in ${path.relative(chartPath, file)}: ${error.message}`);
                }
            }
            
        } catch (error) {
            validation.valid = false;
            validation.issues.push(`YAML validation error: ${error.message}`);
        }
        
        return validation;
    }

    /**
     * Validate chart using helm lint
     * @param {string} chartPath - Path to Helm chart directory
     * @returns {Object} Helm lint validation results
     */
    async validateWithHelm(chartPath) {
        const validation = {
            name: 'Helm Lint',
            valid: true,
            issues: [],
            warnings: [],
            info: []
        };
        
        try {
            // Check if helm is available
            try {
                execSync('helm version --client', { stdio: 'ignore' });
            } catch (error) {
                validation.warnings.push('Helm CLI not available, skipping helm lint validation');
                return validation;
            }
            
            // Run helm lint
            try {
                const output = execSync(`helm lint "${chartPath}"`, { 
                    encoding: 'utf8',
                    timeout: 30000 
                });
                
                validation.info.push('Helm lint passed successfully');
                
                // Parse helm lint output for any warnings
                const lines = output.split('\n');
                for (const line of lines) {
                    if (line.includes('[WARNING]')) {
                        validation.warnings.push(line.replace('[WARNING]', '').trim());
                    } else if (line.includes('[INFO]')) {
                        validation.info.push(line.replace('[INFO]', '').trim());
                    }
                }
                
            } catch (error) {
                validation.valid = false;
                
                // Parse error output
                const errorOutput = error.stdout || error.message;
                const lines = errorOutput.split('\n');
                
                for (const line of lines) {
                    if (line.includes('[ERROR]')) {
                        validation.issues.push(line.replace('[ERROR]', '').trim());
                    } else if (line.includes('[WARNING]')) {
                        validation.warnings.push(line.replace('[WARNING]', '').trim());
                    }
                }
                
                if (validation.issues.length === 0) {
                    validation.issues.push(`Helm lint failed: ${error.message}`);
                }
            }
            
        } catch (error) {
            validation.valid = false;
            validation.issues.push(`Helm validation error: ${error.message}`);
        }
        
        return validation;
    }

    /**
     * Validate security configuration
     * @param {string} chartPath - Path to Helm chart directory
     * @returns {Object} Security validation results
     */
    async validateSecurity(chartPath) {
        const validation = {
            name: 'Security Configuration',
            valid: true,
            issues: [],
            warnings: [],
            info: []
        };
        
        try {
            const templatesPath = path.join(chartPath, 'templates');
            if (!fs.existsSync(templatesPath)) {
                validation.warnings.push('Templates directory not found, skipping security validation');
                return validation;
            }
            
            const templateFiles = fs.readdirSync(templatesPath)
                .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
            
            for (const file of templateFiles) {
                const filePath = path.join(templatesPath, file);
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Check for security contexts
                if (file.includes('deployment')) {
                    if (!content.includes('securityContext')) {
                        validation.warnings.push(`${file}: Missing securityContext configuration`);
                    }
                    
                    if (!content.includes('podSecurityContext')) {
                        validation.warnings.push(`${file}: Missing podSecurityContext configuration`);
                    }
                    
                    // Check for privileged containers
                    if (content.includes('privileged: true')) {
                        validation.issues.push(`${file}: Privileged containers are not allowed`);
                        validation.valid = false;
                    }
                    
                    // Check for host networking
                    if (content.includes('hostNetwork: true')) {
                        validation.issues.push(`${file}: Host networking is not allowed`);
                        validation.valid = false;
                    }
                    
                    // Check for resource limits
                    if (!content.includes('resources:')) {
                        validation.warnings.push(`${file}: Missing resource limits (recommended)`);
                    }
                    
                    validation.info.push(`${file}: Security checks completed`);
                }
            }
            
        } catch (error) {
            validation.valid = false;
            validation.issues.push(`Security validation error: ${error.message}`);
        }
        
        return validation;
    }

    /**
     * Validate template files
     * @param {string} chartPath - Path to Helm chart directory
     * @returns {Object} Template validation results
     */
    async validateTemplates(chartPath) {
        const validation = {
            name: 'Template Validation',
            valid: true,
            issues: [],
            warnings: [],
            info: []
        };
        
        try {
            const templatesPath = path.join(chartPath, 'templates');
            if (!fs.existsSync(templatesPath)) {
                validation.issues.push('Templates directory not found');
                validation.valid = false;
                return validation;
            }
            
            const templateFiles = fs.readdirSync(templatesPath)
                .filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
            
            if (templateFiles.length === 0) {
                validation.warnings.push('No template files found');
            }
            
            for (const file of templateFiles) {
                const filePath = path.join(templatesPath, file);
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Check for basic Kubernetes resource structure
                if (!content.includes('apiVersion:')) {
                    validation.warnings.push(`${file}: Missing apiVersion field`);
                }
                
                if (!content.includes('kind:')) {
                    validation.warnings.push(`${file}: Missing kind field`);
                }
                
                if (!content.includes('metadata:')) {
                    validation.warnings.push(`${file}: Missing metadata field`);
                }
                
                // Check for Helm template functions
                if (content.includes('{{ include')) {
                    validation.info.push(`${file}: Uses Helm template functions (good practice)`);
                }
                
                // Check for hardcoded values
                const hardcodedPatterns = [
                    /image:\s*[^{].*[^}]/,
                    /namespace:\s*[^{].*[^}]/,
                    /replicas:\s*\d+(?!\s*[{}])/
                ];
                
                for (const pattern of hardcodedPatterns) {
                    if (pattern.test(content)) {
                        validation.warnings.push(`${file}: Possible hardcoded values detected`);
                    }
                }
                
                validation.info.push(`${file}: Template validation completed`);
            }
            
        } catch (error) {
            validation.valid = false;
            validation.issues.push(`Template validation error: ${error.message}`);
        }
        
        return validation;
    }

    /**
     * Validate values.yaml file
     * @param {string} chartPath - Path to Helm chart directory
     * @returns {Object} Values validation results
     */
    async validateValues(chartPath) {
        const validation = {
            name: 'Values Validation',
            valid: true,
            issues: [],
            warnings: [],
            info: []
        };
        
        try {
            const valuesPath = path.join(chartPath, 'values.yaml');
            if (!fs.existsSync(valuesPath)) {
                validation.issues.push('values.yaml file not found');
                validation.valid = false;
                return validation;
            }
            
            const valuesContent = fs.readFileSync(valuesPath, 'utf8');
            
            try {
                const values = require('yaml').parse(valuesContent);
                
                // Validate common required sections
                const recommendedSections = [
                    'image', 'service', 'resources', 'nodeSelector', 
                    'tolerations', 'affinity', 'serviceAccount'
                ];
                
                for (const section of recommendedSections) {
                    if (!values[section]) {
                        validation.warnings.push(`values.yaml: Missing recommended section '${section}'`);
                    } else {
                        validation.info.push(`values.yaml: Section '${section}' found`);
                    }
                }
                
                // Validate resource specifications
                if (values.resources) {
                    if (!values.resources.limits) {
                        validation.warnings.push('values.yaml: Missing resource limits');
                    }
                    
                    if (!values.resources.requests) {
                        validation.warnings.push('values.yaml: Missing resource requests');
                    }
                }
                
                // Validate image configuration
                if (values.image) {
                    if (!values.image.repository) {
                        validation.issues.push('values.yaml: image.repository is required');
                        validation.valid = false;
                    }
                    
                    if (!values.image.tag && !values.image.digest) {
                        validation.warnings.push('values.yaml: image.tag or image.digest should be specified');
                    }
                }
                
                validation.info.push('values.yaml: Valid YAML structure');
                
            } catch (error) {
                validation.valid = false;
                validation.issues.push(`values.yaml syntax error: ${error.message}`);
            }
            
        } catch (error) {
            validation.valid = false;
            validation.issues.push(`Values validation error: ${error.message}`);
        }
        
        return validation;
    }

    /**
     * Validate template rendering with different scenarios
     * @param {string} chartPath - Path to Helm chart directory
     * @returns {Object} Rendering validation results
     */
    async validateRendering(chartPath) {
        const validation = {
            name: 'Template Rendering',
            valid: true,
            issues: [],
            warnings: [],
            info: [],
            scenarios: []
        };
        
        try {
            // Check if helm is available
            try {
                execSync('helm version --client', { stdio: 'ignore' });
            } catch (error) {
                validation.warnings.push('Helm CLI not available, skipping rendering validation');
                return validation;
            }
            
            // Test each scenario
            for (const scenario of this.testScenarios) {
                const scenarioResult = await this.testRenderingScenario(chartPath, scenario);
                validation.scenarios.push(scenarioResult);
                
                if (!scenarioResult.valid) {
                    validation.valid = false;
                    validation.issues.push(`Scenario '${scenario.name}' failed: ${scenarioResult.error}`);
                } else {
                    validation.info.push(`Scenario '${scenario.name}' rendered successfully`);
                }
            }
            
        } catch (error) {
            validation.valid = false;
            validation.issues.push(`Rendering validation error: ${error.message}`);
        }
        
        return validation;
    }

    /**
     * Test template rendering with a specific scenario
     * @param {string} chartPath - Path to Helm chart directory
     * @param {Object} scenario - Test scenario configuration
     * @returns {Object} Scenario test results
     */
    async testRenderingScenario(chartPath, scenario) {
        const result = {
            name: scenario.name,
            description: scenario.description,
            valid: true,
            error: null,
            output: null
        };
        
        try {
            // Create temporary values file
            const tempValuesPath = path.join('/tmp', `values-${scenario.name}-${Date.now()}.yaml`);
            const valuesContent = require('yaml').stringify(scenario.values);
            fs.writeFileSync(tempValuesPath, valuesContent);
            
            try {
                // Run helm template with dry-run
                const output = execSync(
                    `helm template test-release "${chartPath}" --values "${tempValuesPath}" --dry-run`, 
                    { 
                        encoding: 'utf8',
                        timeout: 30000
                    }
                );
                
                result.output = output;
                
                // Validate rendered output contains valid Kubernetes resources
                if (!output.includes('apiVersion:')) {
                    result.valid = false;
                    result.error = 'Rendered output does not contain valid Kubernetes resources';
                }
                
            } finally {
                // Clean up temporary file
                if (fs.existsSync(tempValuesPath)) {
                    fs.unlinkSync(tempValuesPath);
                }
            }
            
        } catch (error) {
            result.valid = false;
            result.error = error.message;
        }
        
        return result;
    }

    /**
     * Find all YAML files in chart directory
     * @param {string} chartPath - Path to Helm chart directory
     * @returns {Array} List of YAML file paths
     */
    findYamlFiles(chartPath) {
        const yamlFiles = [];
        
        function scanDirectory(dir) {
            const items = fs.readdirSync(dir);
            
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stat = fs.statSync(itemPath);
                
                if (stat.isDirectory()) {
                    scanDirectory(itemPath);
                } else if (item.endsWith('.yaml') || item.endsWith('.yml')) {
                    yamlFiles.push(itemPath);
                }
            }
        }
        
        scanDirectory(chartPath);
        return yamlFiles;
    }

    /**
     * Calculate overall validation status and score
     * @param {Object} results - Validation results object
     */
    calculateOverallStatus(results) {
        let totalErrors = 0;
        let totalWarnings = 0;
        let totalInfo = 0;
        
        for (const [category, validation] of Object.entries(results.validations)) {
            totalErrors += validation.issues?.length || 0;
            totalWarnings += validation.warnings?.length || 0;
            totalInfo += validation.info?.length || 0;
            
            // Check if category failed
            if (validation.valid === false) {
                results.overall.valid = false;
            }
        }
        
        results.summary.errors = totalErrors;
        results.summary.warnings = totalWarnings;
        results.summary.info = totalInfo;
        
        // Calculate score (100 = perfect, 0 = failed)
        if (totalErrors > 0) {
            results.overall.score = Math.max(0, 100 - (totalErrors * 20) - (totalWarnings * 5));
        } else {
            results.overall.score = Math.max(70, 100 - (totalWarnings * 5));
        }
        
        // Set validation status
        results.overall.valid = totalErrors === 0;
    }

    /**
     * Generate actionable recommendations based on validation results
     * @param {Object} results - Validation results object
     * @returns {Array} List of recommendations
     */
    generateRecommendations(results) {
        const recommendations = [];
        
        // Security recommendations
        if (results.validations.security?.warnings?.length > 0) {
            recommendations.push({
                category: 'Security',
                priority: 'HIGH',
                title: 'Improve Security Configuration',
                description: 'Add security contexts and resource limits to enhance pod security',
                actions: [
                    'Add podSecurityContext to deployment template',
                    'Configure container securityContext with non-root user',
                    'Set resource limits and requests',
                    'Enable read-only root filesystem'
                ]
            });
        }
        
        // Template recommendations
        if (results.validations.templates?.warnings?.some(w => w.includes('hardcoded'))) {
            recommendations.push({
                category: 'Templates',
                priority: 'MEDIUM',
                title: 'Remove Hardcoded Values',
                description: 'Replace hardcoded values with template variables for better flexibility',
                actions: [
                    'Move hardcoded values to values.yaml',
                    'Use Helm template functions for dynamic values',
                    'Add environment-specific value overrides'
                ]
            });
        }
        
        // Documentation recommendations
        if (results.validations.structure?.warnings?.some(w => w.includes('README'))) {
            recommendations.push({
                category: 'Documentation',
                priority: 'LOW',
                title: 'Add Documentation',
                description: 'Improve chart documentation for better usability',
                actions: [
                    'Add README.md with usage instructions',
                    'Create NOTES.txt for post-installation guidance',
                    'Document all values.yaml configurations'
                ]
            });
        }
        
        // Performance recommendations
        if (results.validations.values?.warnings?.some(w => w.includes('resource'))) {
            recommendations.push({
                category: 'Performance',
                priority: 'MEDIUM',
                title: 'Configure Resource Management',
                description: 'Set appropriate resource limits and requests for optimal performance',
                actions: [
                    'Define CPU and memory limits',
                    'Set resource requests for scheduling',
                    'Configure autoscaling if needed'
                ]
            });
        }
        
        return recommendations;
    }

    /**
     * Generate validation report in different formats
     * @param {Object} results - Validation results object
     * @param {string} format - Report format ('json', 'yaml', 'markdown')
     * @returns {string} Formatted validation report
     */
    generateReport(results, format = 'json') {
        switch (format.toLowerCase()) {
            case 'yaml':
                return require('yaml').stringify(results);
            
            case 'markdown':
                return this.generateMarkdownReport(results);
            
            case 'json':
            default:
                return JSON.stringify(results, null, 2);
        }
    }

    /**
     * Generate validation report in Markdown format
     * @param {Object} results - Validation results object
     * @returns {string} Markdown formatted report
     */
    generateMarkdownReport(results) {
        let report = `# Helm Chart Validation Report\n\n`;
        report += `**Chart**: ${results.chartPath}\n`;
        report += `**Generated**: ${results.timestamp}\n`;
        report += `**Status**: ${results.overall.valid ? '✅ PASSED' : '❌ FAILED'}\n`;
        report += `**Score**: ${results.overall.score}/100\n\n`;
        
        report += `## Summary\n\n`;
        report += `- **Errors**: ${results.summary.errors}\n`;
        report += `- **Warnings**: ${results.summary.warnings}\n`;
        report += `- **Info**: ${results.summary.info}\n\n`;
        
        report += `## Validation Results\n\n`;
        
        for (const [category, validation] of Object.entries(results.validations)) {
            const status = validation.valid ? '✅' : '❌';
            report += `### ${status} ${validation.name}\n\n`;
            
            if (validation.issues?.length > 0) {
                report += `**Errors:**\n`;
                for (const issue of validation.issues) {
                    report += `- ❌ ${issue}\n`;
                }
                report += `\n`;
            }
            
            if (validation.warnings?.length > 0) {
                report += `**Warnings:**\n`;
                for (const warning of validation.warnings) {
                    report += `- ⚠️ ${warning}\n`;
                }
                report += `\n`;
            }
            
            if (validation.info?.length > 0 && validation.info.length <= 5) {
                report += `**Info:**\n`;
                for (const info of validation.info.slice(0, 5)) {
                    report += `- ℹ️ ${info}\n`;
                }
                report += `\n`;
            }
        }
        
        if (results.recommendations?.length > 0) {
            report += `## Recommendations\n\n`;
            
            for (const rec of results.recommendations) {
                const priority = rec.priority === 'HIGH' ? '🔴' : 
                               rec.priority === 'MEDIUM' ? '🟡' : '🟢';
                
                report += `### ${priority} ${rec.title}\n\n`;
                report += `**Category**: ${rec.category}\n`;
                report += `**Priority**: ${rec.priority}\n\n`;
                report += `${rec.description}\n\n`;
                
                report += `**Actions:**\n`;
                for (const action of rec.actions) {
                    report += `- [ ] ${action}\n`;
                }
                report += `\n`;
            }
        }
        
        return report;
    }
}

module.exports = ValidationFramework;

// CLI usage for validation
if (require.main === module) {
    const chartPath = process.argv[2];
    const format = process.argv[3] || 'json';
    
    if (!chartPath) {
        console.error('Usage: node validation-framework.js <chart-path> [format]');
        console.error('Formats: json, yaml, markdown');
        process.exit(1);
    }
    
    async function main() {
        try {
            const validator = new ValidationFramework();
            const results = await validator.validateChart(chartPath);
            const report = validator.generateReport(results, format);
            
            console.log(report);
            
            // Exit with appropriate code
            process.exit(results.overall.valid ? 0 : 1);
            
        } catch (error) {
            console.error('Validation error:', error.message);
            process.exit(1);
        }
    }
    
    main();
}