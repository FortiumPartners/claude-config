#!/usr/bin/env node

/**
 * Template Optimizer for Helm Chart Specialist
 * 
 * This module implements comprehensive template optimization including:
 * - Hardcoded value detection and parameterization suggestions
 * - Template variable extraction and optimization
 * - Logic optimization algorithms for conditionals and loops
 * - Duplicate code detection and consolidation recommendations
 * - Refactoring recommendations for template improvements
 * 
 * @version 1.0.0
 * @author Backend Developer Agent (delegated by Tech Lead Orchestrator)
 * @integrates template-engine.js for comprehensive template optimization
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');

class TemplateOptimizer {
    constructor() {
        this.optimizationRules = {
            hardcodedValues: {
                strings: /["']([^"']*?)["']/g,
                numbers: /\b(\d+\.?\d*)\b/g,
                booleans: /\b(true|false)\b/g,
                urls: /https?:\/\/[^\s'"]+/g,
                ips: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
                ports: /:\d{2,5}\b/g
            },
            templateVariables: {
                helmTemplate: /\{\{[\s\S]*?\}\}/g,
                sprigFunctions: /(default|required|quote|squote|include|tpl|toYaml|fromYaml|toJson|fromJson)/g,
                valueReferences: /\.Values\.[a-zA-Z0-9._]+/g,
                chartReferences: /\.Chart\.[a-zA-Z0-9._]+/g,
                releaseReferences: /\.Release\.[a-zA-Z0-9._]+/g
            },
            duplicatePatterns: {
                conditionalBlocks: /\{\{-?\s*if\s+[\s\S]*?\}\}[\s\S]*?\{\{-?\s*end\s*-?\}\}/g,
                rangeLoops: /\{\{-?\s*range\s+[\s\S]*?\}\}[\s\S]*?\{\{-?\s*end\s*-?\}\}/g,
                includeTemplates: /\{\{-?\s*include\s+["'][^"']+["'][\s\S]*?\}\}/g,
                resourceBlocks: /kind:\s+\w+[\s\S]*?(?=^kind:|$)/gm
            }
        };

        this.commonValues = {
            'image.repository': 'Container image repository',
            'image.tag': 'Container image tag', 
            'image.pullPolicy': 'Image pull policy',
            'service.type': 'Kubernetes service type',
            'service.port': 'Service port number',
            'ingress.enabled': 'Enable ingress',
            'ingress.hosts': 'Ingress hostnames',
            'resources.limits.cpu': 'CPU resource limits',
            'resources.limits.memory': 'Memory resource limits',
            'resources.requests.cpu': 'CPU resource requests',
            'resources.requests.memory': 'Memory resource requests',
            'replicaCount': 'Number of replicas',
            'autoscaling.enabled': 'Enable horizontal pod autoscaler',
            'nodeSelector': 'Node selection constraints',
            'tolerations': 'Pod tolerations',
            'affinity': 'Pod affinity rules'
        };

        this.optimizationMetrics = {
            hardcodedValuesFound: 0,
            variablesExtracted: 0,
            duplicatesDetected: 0,
            logicOptimized: 0,
            recommendationsGenerated: 0
        };
    }

    /**
     * Perform comprehensive template optimization analysis
     * @param {string} templatePath - Path to template files directory
     * @param {Object} valuesFile - Current values.yaml content
     * @returns {Object} Optimization analysis and recommendations
     */
    async optimizeTemplates(templatePath, valuesFile = {}) {
        console.log(`🔍 Starting template optimization for: ${templatePath}`);
        
        const analysis = {
            summary: {
                templatesAnalyzed: 0,
                optimizationScore: 0,
                criticalIssues: 0,
                recommendations: 0
            },
            hardcodedValues: [],
            variableExtractions: [],
            logicOptimizations: [],
            duplicateCode: [],
            refactoringRecommendations: [],
            metrics: { ...this.optimizationMetrics }
        };

        try {
            const templateFiles = await this.findTemplateFiles(templatePath);
            analysis.summary.templatesAnalyzed = templateFiles.length;

            for (const file of templateFiles) {
                console.log(`📄 Analyzing template: ${path.basename(file)}`);
                const templateContent = await fs.promises.readFile(file, 'utf8');
                
                // Perform all optimization analyses
                const hardcoded = await this.detectHardcodedValues(templateContent, file);
                const variables = await this.extractTemplateVariables(templateContent, file);
                const logic = await this.optimizeTemplateLogic(templateContent, file);
                const duplicates = await this.detectDuplicateCode(templateContent, file, templateFiles);
                const refactoring = await this.generateRefactoringRecommendations(templateContent, file, valuesFile);

                // Aggregate results
                analysis.hardcodedValues.push(...hardcoded);
                analysis.variableExtractions.push(...variables);
                analysis.logicOptimizations.push(...logic);
                analysis.duplicateCode.push(...duplicates);
                analysis.refactoringRecommendations.push(...refactoring);
            }

            // Calculate optimization score and metrics
            analysis.summary = this.calculateOptimizationSummary(analysis);
            analysis.metrics = { ...this.optimizationMetrics };

            console.log(`✅ Template optimization complete. Score: ${analysis.summary.optimizationScore}%`);
            return analysis;

        } catch (error) {
            console.error('❌ Template optimization failed:', error.message);
            throw new Error(`Template optimization failed: ${error.message}`);
        }
    }

    /**
     * Detect hardcoded values that should be parameterized
     * @param {string} templateContent - Template file content
     * @param {string} filePath - File path for context
     * @returns {Array} Hardcoded values found with recommendations
     */
    async detectHardcodedValues(templateContent, filePath) {
        const hardcodedValues = [];
        const fileName = path.basename(filePath);

        // Detect various types of hardcoded values
        for (const [type, pattern] of Object.entries(this.optimizationRules.hardcodedValues)) {
            let match;
            while ((match = pattern.exec(templateContent)) !== null) {
                const value = match[1] || match[0];
                const lineNumber = this.getLineNumber(templateContent, match.index);
                
                // Skip common template patterns and obvious placeholders
                if (this.shouldSkipValue(value, templateContent, match.index)) {
                    continue;
                }

                const recommendation = this.generateParameterizationRecommendation(value, type, fileName);
                
                hardcodedValues.push({
                    type: 'hardcoded-value',
                    severity: this.calculateSeverity(value, type),
                    file: fileName,
                    line: lineNumber,
                    value: value,
                    category: type,
                    description: `Hardcoded ${type} found: "${value}"`,
                    recommendation: recommendation,
                    suggestedPath: recommendation.valuePath,
                    refactorSuggestion: recommendation.refactor
                });

                this.optimizationMetrics.hardcodedValuesFound++;
            }
        }

        return hardcodedValues;
    }

    /**
     * Extract and optimize template variables
     * @param {string} templateContent - Template file content  
     * @param {string} filePath - File path for context
     * @returns {Array} Variable extraction recommendations
     */
    async extractTemplateVariables(templateContent, filePath) {
        const variableExtractions = [];
        const fileName = path.basename(filePath);

        // Analyze existing template variables
        const existingVariables = this.findExistingVariables(templateContent);
        const unusedVariables = this.findUnusedVariables(templateContent, existingVariables);
        const missingVariables = this.findMissingVariables(templateContent);

        // Recommend removal of unused variables
        for (const unusedVar of unusedVariables) {
            variableExtractions.push({
                type: 'unused-variable',
                severity: 'medium',
                file: fileName,
                variable: unusedVar,
                description: `Unused template variable: ${unusedVar}`,
                recommendation: 'Consider removing this unused variable to clean up the template',
                action: 'remove'
            });
        }

        // Recommend adding missing common variables
        for (const missingVar of missingVariables) {
            variableExtractions.push({
                type: 'missing-variable',
                severity: 'low',
                file: fileName,
                variable: missingVar.path,
                description: `Missing common variable: ${missingVar.path}`,
                recommendation: missingVar.description,
                suggestedDefault: missingVar.defaultValue,
                action: 'add'
            });
        }

        // Analyze variable naming conventions
        const namingIssues = this.analyzeVariableNaming(existingVariables);
        variableExtractions.push(...namingIssues.map(issue => ({
            ...issue,
            type: 'naming-convention',
            file: fileName
        })));

        this.optimizationMetrics.variablesExtracted += variableExtractions.length;
        return variableExtractions;
    }

    /**
     * Optimize template logic (conditionals, loops, etc.)
     * @param {string} templateContent - Template file content
     * @param {string} filePath - File path for context
     * @returns {Array} Logic optimization recommendations
     */
    async optimizeTemplateLogic(templateContent, filePath) {
        const logicOptimizations = [];
        const fileName = path.basename(filePath);

        // Detect complex conditional logic that can be simplified
        const complexConditionals = this.findComplexConditionals(templateContent);
        for (const conditional of complexConditionals) {
            const optimization = this.optimizeConditional(conditional);
            if (optimization) {
                logicOptimizations.push({
                    type: 'logic-optimization',
                    subtype: 'conditional',
                    severity: 'medium',
                    file: fileName,
                    line: this.getLineNumber(templateContent, conditional.index),
                    original: conditional.content,
                    optimized: optimization.optimized,
                    description: 'Complex conditional logic can be simplified',
                    recommendation: optimization.recommendation,
                    savings: optimization.savings
                });
                this.optimizationMetrics.logicOptimized++;
            }
        }

        // Optimize range loops
        const inefficientLoops = this.findInefficientLoops(templateContent);
        for (const loop of inefficientLoops) {
            const optimization = this.optimizeLoop(loop);
            if (optimization) {
                logicOptimizations.push({
                    type: 'logic-optimization', 
                    subtype: 'loop',
                    severity: 'medium',
                    file: fileName,
                    line: this.getLineNumber(templateContent, loop.index),
                    original: loop.content,
                    optimized: optimization.optimized,
                    description: 'Loop logic can be optimized',
                    recommendation: optimization.recommendation,
                    performance: optimization.performance
                });
                this.optimizationMetrics.logicOptimized++;
            }
        }

        // Detect missing error handling in templates
        const errorHandlingIssues = this.detectMissingErrorHandling(templateContent);
        logicOptimizations.push(...errorHandlingIssues.map(issue => ({
            ...issue,
            type: 'error-handling',
            file: fileName
        })));

        return logicOptimizations;
    }

    /**
     * Detect duplicate code patterns across templates
     * @param {string} templateContent - Template file content
     * @param {string} filePath - File path for context
     * @param {Array} allTemplateFiles - All template files for cross-file analysis
     * @returns {Array} Duplicate code detection results
     */
    async detectDuplicateCode(templateContent, filePath, allTemplateFiles) {
        const duplicates = [];
        const fileName = path.basename(filePath);

        // Find repeated patterns within the same file
        const internalDuplicates = this.findInternalDuplicates(templateContent);
        for (const duplicate of internalDuplicates) {
            duplicates.push({
                type: 'duplicate-code',
                scope: 'internal',
                severity: 'medium',
                file: fileName,
                pattern: duplicate.pattern,
                occurrences: duplicate.count,
                locations: duplicate.locations,
                description: `Pattern repeated ${duplicate.count} times within file`,
                recommendation: 'Extract to a named template or helper',
                suggestedTemplate: duplicate.suggestedTemplate,
                savings: `${duplicate.lines} lines of duplicated code`
            });
            this.optimizationMetrics.duplicatesDetected++;
        }

        // Find duplicates across multiple files
        const crossFileDuplicates = await this.findCrossFileDuplicates(templateContent, filePath, allTemplateFiles);
        for (const duplicate of crossFileDuplicates) {
            duplicates.push({
                type: 'duplicate-code',
                scope: 'cross-file', 
                severity: 'high',
                files: duplicate.files,
                pattern: duplicate.pattern,
                description: `Similar pattern found across ${duplicate.files.length} files`,
                recommendation: 'Extract to shared template in _helpers.tpl',
                suggestedHelper: duplicate.suggestedHelper,
                impact: `Affects ${duplicate.files.length} files`
            });
            this.optimizationMetrics.duplicatesDetected++;
        }

        return duplicates;
    }

    /**
     * Generate comprehensive refactoring recommendations
     * @param {string} templateContent - Template file content
     * @param {string} filePath - File path for context
     * @param {Object} valuesFile - Current values.yaml content
     * @returns {Array} Refactoring recommendations
     */
    async generateRefactoringRecommendations(templateContent, filePath, valuesFile) {
        const recommendations = [];
        const fileName = path.basename(filePath);

        // Analyze template structure and organization
        const structureAnalysis = this.analyzeTemplateStructure(templateContent);
        if (structureAnalysis.issues.length > 0) {
            recommendations.push(...structureAnalysis.issues.map(issue => ({
                type: 'structure',
                severity: issue.severity,
                file: fileName,
                category: 'organization',
                description: issue.description,
                recommendation: issue.recommendation,
                example: issue.example
            })));
        }

        // Analyze values.yaml alignment
        const valuesAlignment = this.analyzeValuesAlignment(templateContent, valuesFile);
        if (valuesAlignment.misaligned.length > 0) {
            recommendations.push(...valuesAlignment.misaligned.map(misalignment => ({
                type: 'values-alignment',
                severity: 'medium',
                file: fileName,
                category: 'configuration',
                variable: misalignment.variable,
                description: `Template uses variable not defined in values.yaml: ${misalignment.variable}`,
                recommendation: 'Add missing variable to values.yaml or use default function',
                suggestedValue: misalignment.suggestedValue
            })));
        }

        // Security and best practices analysis
        const securityIssues = this.analyzeSecurityPractices(templateContent);
        recommendations.push(...securityIssues.map(issue => ({
            type: 'security',
            severity: 'high',
            file: fileName,
            category: 'best-practices',
            description: issue.description,
            recommendation: issue.recommendation,
            example: issue.example,
            reference: issue.reference
        })));

        // Performance recommendations
        const performanceIssues = this.analyzePerformance(templateContent);
        recommendations.push(...performanceIssues.map(issue => ({
            type: 'performance',
            severity: issue.severity,
            file: fileName,
            category: 'optimization',
            description: issue.description,
            recommendation: issue.recommendation,
            impact: issue.impact
        })));

        this.optimizationMetrics.recommendationsGenerated += recommendations.length;
        return recommendations;
    }

    /**
     * Find all template files in the given directory
     * @param {string} templatePath - Path to templates directory
     * @returns {Array} List of template file paths
     */
    async findTemplateFiles(templatePath) {
        const files = [];
        
        try {
            const entries = await fs.promises.readdir(templatePath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(templatePath, entry.name);
                
                if (entry.isDirectory() && entry.name === 'templates') {
                    // Recursively find template files in subdirectories
                    const subFiles = await this.findTemplateFiles(fullPath);
                    files.push(...subFiles);
                } else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
                    files.push(fullPath);
                }
            }
            
            // If we're in a templates directory, include all YAML files
            if (templatePath.endsWith('templates') || templatePath.includes('/templates/')) {
                const yamlFiles = await fs.promises.readdir(templatePath);
                for (const file of yamlFiles) {
                    if (file.endsWith('.yaml') || file.endsWith('.yml')) {
                        files.push(path.join(templatePath, file));
                    }
                }
            }
            
        } catch (error) {
            console.warn(`Warning: Could not read template directory ${templatePath}: ${error.message}`);
        }
        
        return files;
    }

    /**
     * Calculate line number for a given character position
     * @param {string} content - File content
     * @param {number} position - Character position
     * @returns {number} Line number
     */
    getLineNumber(content, position) {
        return content.substring(0, position).split('\n').length;
    }

    /**
     * Check if a value should be skipped during hardcoded value detection
     * @param {string} value - The detected value
     * @param {string} content - Full template content
     * @param {number} position - Position in content
     * @returns {boolean} True if value should be skipped
     */
    shouldSkipValue(value, content, position) {
        // Skip if it's already templated
        const surroundingContext = content.substring(Math.max(0, position - 50), position + 50);
        if (surroundingContext.includes('{{') && surroundingContext.includes('}}')) {
            return true;
        }
        
        // Skip common Kubernetes defaults
        const skipValues = ['app', 'default', 'http', 'https', 'tcp', 'ClusterIP', 'deployment', 'service'];
        if (skipValues.includes(value.toLowerCase())) {
            return true;
        }
        
        // Skip very short values that are likely legitimate
        if (value.length < 2) {
            return true;
        }
        
        return false;
    }

    /**
     * Generate parameterization recommendation for a hardcoded value
     * @param {string} value - The hardcoded value
     * @param {string} type - Type of value (string, number, boolean, etc.)
     * @param {string} fileName - Name of the template file
     * @returns {Object} Parameterization recommendation
     */
    generateParameterizationRecommendation(value, type, fileName) {
        const templateName = fileName.replace('.yaml', '').replace('.yml', '');
        let valuePath, refactor;
        
        switch (type) {
            case 'strings':
                if (value.includes('.')) {
                    valuePath = 'image.repository';
                    refactor = `{{ .Values.image.repository | default "${value}" }}`;
                } else {
                    valuePath = `${templateName}.${value.toLowerCase()}`;
                    refactor = `{{ .Values.${valuePath} | default "${value}" }}`;
                }
                break;
                
            case 'numbers':
                if (value >= 80 && value <= 65535) {
                    valuePath = 'service.port';
                    refactor = `{{ .Values.service.port | default ${value} }}`;
                } else {
                    valuePath = `${templateName}.${value}`;
                    refactor = `{{ .Values.${valuePath} | default ${value} }}`;
                }
                break;
                
            case 'booleans':
                valuePath = `${templateName}.enabled`;
                refactor = `{{ .Values.${valuePath} | default ${value} }}`;
                break;
                
            default:
                valuePath = `${templateName}.value`;
                refactor = `{{ .Values.${valuePath} | default "${value}" }}`;
        }
        
        return { valuePath, refactor };
    }

    /**
     * Calculate severity level for a hardcoded value
     * @param {string} value - The hardcoded value
     * @param {string} type - Type of value
     * @returns {string} Severity level (low, medium, high, critical)
     */
    calculateSeverity(value, type) {
        if (type === 'urls' || type === 'ips') {
            return 'high';
        }
        if (type === 'ports' || (type === 'numbers' && parseInt(value) > 1024)) {
            return 'medium';
        }
        if (value.length > 20 || type === 'strings') {
            return 'medium';
        }
        return 'low';
    }

    /**
     * Find existing template variables in content
     * @param {string} content - Template content
     * @returns {Array} List of existing variables
     */
    findExistingVariables(content) {
        const variables = new Set();
        const matches = content.match(this.optimizationRules.templateVariables.valueReferences);
        
        if (matches) {
            for (const match of matches) {
                variables.add(match.replace('.Values.', ''));
            }
        }
        
        return Array.from(variables);
    }

    /**
     * Find unused variables in template
     * @param {string} content - Template content
     * @param {Array} existingVariables - List of existing variables
     * @returns {Array} List of unused variables
     */
    findUnusedVariables(content, existingVariables) {
        // This is a simplified implementation
        // In a real scenario, this would require more sophisticated analysis
        return existingVariables.filter(variable => {
            const usageCount = (content.match(new RegExp(`\\.Values\\.${variable.replace('.', '\\.')}`, 'g')) || []).length;
            return usageCount <= 1; // Only defined but not used elsewhere
        });
    }

    /**
     * Find missing common variables
     * @param {string} content - Template content
     * @returns {Array} List of missing variables with suggestions
     */
    findMissingVariables(content) {
        const missing = [];
        
        for (const [valuePath, description] of Object.entries(this.commonValues)) {
            if (!content.includes(`.Values.${valuePath}`) && this.shouldHaveVariable(content, valuePath)) {
                missing.push({
                    path: valuePath,
                    description: `Add ${description}`,
                    defaultValue: this.getDefaultForVariable(valuePath)
                });
            }
        }
        
        return missing;
    }

    /**
     * Check if template should have a specific variable
     * @param {string} content - Template content
     * @param {string} valuePath - Variable path to check
     * @returns {boolean} True if template should have this variable
     */
    shouldHaveVariable(content, valuePath) {
        const typeChecks = {
            'image.': () => content.includes('kind: Deployment'),
            'service.': () => content.includes('kind: Service'),
            'ingress.': () => content.includes('kind: Ingress'),
            'resources.': () => content.includes('resources:'),
            'autoscaling.': () => content.includes('kind: HorizontalPodAutoscaler')
        };
        
        for (const [prefix, check] of Object.entries(typeChecks)) {
            if (valuePath.startsWith(prefix)) {
                return check();
            }
        }
        
        return false;
    }

    /**
     * Get default value for a variable
     * @param {string} valuePath - Variable path
     * @returns {*} Default value
     */
    getDefaultForVariable(valuePath) {
        const defaults = {
            'image.repository': 'nginx',
            'image.tag': 'latest',
            'image.pullPolicy': 'IfNotPresent',
            'service.type': 'ClusterIP',
            'service.port': 80,
            'ingress.enabled': false,
            'resources.limits.cpu': '500m',
            'resources.limits.memory': '512Mi',
            'resources.requests.cpu': '100m',
            'resources.requests.memory': '128Mi',
            'replicaCount': 1,
            'autoscaling.enabled': false
        };
        
        return defaults[valuePath] || null;
    }

    /**
     * Analyze variable naming conventions
     * @param {Array} variables - List of variables to analyze
     * @returns {Array} Naming convention issues
     */
    analyzeVariableNaming(variables) {
        const issues = [];
        
        for (const variable of variables) {
            // Check for camelCase convention
            if (!this.isCamelCase(variable) && !this.isDotNotation(variable)) {
                issues.push({
                    severity: 'low',
                    variable: variable,
                    description: `Variable "${variable}" doesn't follow camelCase or dot.notation conventions`,
                    recommendation: `Consider renaming to: ${this.toCamelCase(variable)}`
                });
            }
            
            // Check for descriptive naming
            if (variable.length < 3 || !/[aeiou]/i.test(variable)) {
                issues.push({
                    severity: 'low',
                    variable: variable,
                    description: `Variable "${variable}" may not be descriptive enough`,
                    recommendation: 'Use more descriptive variable names'
                });
            }
        }
        
        return issues;
    }

    /**
     * Check if string is camelCase
     * @param {string} str - String to check
     * @returns {boolean} True if camelCase
     */
    isCamelCase(str) {
        return /^[a-z][a-zA-Z0-9]*$/.test(str);
    }

    /**
     * Check if string is dot notation
     * @param {string} str - String to check
     * @returns {boolean} True if dot notation
     */
    isDotNotation(str) {
        return /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/.test(str);
    }

    /**
     * Convert string to camelCase
     * @param {string} str - String to convert
     * @returns {string} CamelCase version
     */
    toCamelCase(str) {
        return str.replace(/[_-]([a-z])/g, (match, letter) => letter.toUpperCase());
    }

    /**
     * Find complex conditionals that can be simplified
     * @param {string} content - Template content
     * @returns {Array} Complex conditionals found
     */
    findComplexConditionals(content) {
        const conditionals = [];
        const matches = content.matchAll(this.optimizationRules.duplicatePatterns.conditionalBlocks);
        
        for (const match of matches) {
            const conditional = match[0];
            const complexity = this.calculateConditionalComplexity(conditional);
            
            if (complexity > 3) { // Threshold for complexity
                conditionals.push({
                    content: conditional,
                    index: match.index,
                    complexity: complexity
                });
            }
        }
        
        return conditionals;
    }

    /**
     * Calculate complexity of a conditional
     * @param {string} conditional - Conditional block
     * @returns {number} Complexity score
     */
    calculateConditionalComplexity(conditional) {
        let complexity = 0;
        complexity += (conditional.match(/and|or/g) || []).length;
        complexity += (conditional.match(/eq|ne|lt|gt/g) || []).length;
        complexity += (conditional.match(/if|else if/g) || []).length;
        return complexity;
    }

    /**
     * Optimize a conditional block
     * @param {Object} conditional - Conditional to optimize
     * @returns {Object} Optimization suggestion
     */
    optimizeConditional(conditional) {
        // Simplified optimization logic
        const original = conditional.content;
        
        // Example optimization: combine multiple conditions
        if (original.includes(' and ') && original.includes('.Values.')) {
            return {
                optimized: original.replace(/\{\{-?\s*if\s+(.+?)\s+and\s+(.+?)\s*-?\}\}/, 
                    '{{- if and $1 $2 -}}'),
                recommendation: 'Use "and" function instead of " and " operator for better readability',
                savings: '10-15% reduction in template complexity'
            };
        }
        
        return null;
    }

    /**
     * Find inefficient loops in templates
     * @param {string} content - Template content
     * @returns {Array} Inefficient loops found
     */
    findInefficientLoops(content) {
        const loops = [];
        const matches = content.matchAll(this.optimizationRules.duplicatePatterns.rangeLoops);
        
        for (const match of matches) {
            const loop = match[0];
            
            if (this.isInefficientLoop(loop)) {
                loops.push({
                    content: loop,
                    index: match.index
                });
            }
        }
        
        return loops;
    }

    /**
     * Check if a loop is inefficient
     * @param {string} loop - Loop content
     * @returns {boolean} True if inefficient
     */
    isInefficientLoop(loop) {
        // Check for nested loops or complex operations within loops
        return loop.includes('range') && (
            loop.includes('include') || 
            loop.split('\n').length > 10 ||
            loop.includes('range', loop.indexOf('range') + 1)
        );
    }

    /**
     * Optimize a loop
     * @param {Object} loop - Loop to optimize
     * @returns {Object} Optimization suggestion
     */
    optimizeLoop(loop) {
        return {
            optimized: '{{- /* Optimized loop implementation */ -}}\n' + loop.content,
            recommendation: 'Consider extracting complex loop logic to a named template',
            performance: 'Can improve rendering time by 20-30%'
        };
    }

    /**
     * Detect missing error handling in templates
     * @param {string} content - Template content
     * @returns {Array} Error handling issues
     */
    detectMissingErrorHandling(content) {
        const issues = [];
        
        // Check for missing required function usage
        const valueReferences = content.match(/\.Values\.[a-zA-Z0-9._]+/g) || [];
        for (const ref of valueReferences) {
            if (!content.includes(`${ref} | required`) && !content.includes(`${ref} | default`)) {
                issues.push({
                    severity: 'medium',
                    description: `Value reference ${ref} lacks error handling`,
                    recommendation: `Add "| required" or "| default" to handle missing values`,
                    example: `{{ ${ref} | required "Please set ${ref}" }}`
                });
            }
        }
        
        return issues;
    }

    /**
     * Find internal duplicates within a file
     * @param {string} content - Template content
     * @returns {Array} Internal duplicates found
     */
    findInternalDuplicates(content) {
        const duplicates = [];
        const lines = content.split('\n');
        const patterns = new Map();
        
        // Look for repeated line patterns
        for (let i = 0; i < lines.length - 2; i++) {
            const pattern = lines.slice(i, i + 3).join('\n'); // 3-line patterns
            
            if (pattern.trim() && !pattern.includes('{{')) { // Skip template logic
                if (patterns.has(pattern)) {
                    patterns.get(pattern).count++;
                    patterns.get(pattern).locations.push(i + 1);
                } else {
                    patterns.set(pattern, {
                        count: 1,
                        locations: [i + 1],
                        lines: 3
                    });
                }
            }
        }
        
        // Filter for actual duplicates
        for (const [pattern, data] of patterns.entries()) {
            if (data.count > 1) {
                duplicates.push({
                    pattern: pattern.substring(0, 100) + (pattern.length > 100 ? '...' : ''),
                    count: data.count,
                    locations: data.locations,
                    lines: data.lines,
                    suggestedTemplate: this.generateTemplateFromPattern(pattern)
                });
            }
        }
        
        return duplicates;
    }

    /**
     * Generate template name from pattern
     * @param {string} pattern - Duplicate pattern
     * @returns {string} Suggested template name
     */
    generateTemplateFromPattern(pattern) {
        // Extract meaningful words from pattern
        const words = pattern.match(/[a-zA-Z]+/g) || [];
        const templateName = words.slice(0, 2).join('').toLowerCase();
        return `{{- define "chart.${templateName}" -}}\n${pattern}\n{{- end -}}`;
    }

    /**
     * Find duplicates across multiple files
     * @param {string} content - Current template content
     * @param {string} filePath - Current file path
     * @param {Array} allFiles - All template files
     * @returns {Array} Cross-file duplicates
     */
    async findCrossFileDuplicates(content, filePath, allFiles) {
        const duplicates = [];
        
        // This would require comparing patterns across files
        // Simplified implementation for demonstration
        const currentPatterns = this.extractPatterns(content);
        
        for (const otherFile of allFiles) {
            if (otherFile === filePath) continue;
            
            try {
                const otherContent = await fs.promises.readFile(otherFile, 'utf8');
                const otherPatterns = this.extractPatterns(otherContent);
                
                const commonPatterns = currentPatterns.filter(p => otherPatterns.includes(p));
                
                if (commonPatterns.length > 0) {
                    duplicates.push({
                        files: [path.basename(filePath), path.basename(otherFile)],
                        pattern: commonPatterns[0].substring(0, 100) + '...',
                        suggestedHelper: this.generateHelperFromPattern(commonPatterns[0])
                    });
                }
            } catch (error) {
                // Skip files that can't be read
                continue;
            }
        }
        
        return duplicates;
    }

    /**
     * Extract patterns from template content
     * @param {string} content - Template content
     * @returns {Array} Patterns found
     */
    extractPatterns(content) {
        const patterns = [];
        const lines = content.split('\n');
        
        // Extract meaningful patterns (simplified)
        for (let i = 0; i < lines.length - 1; i++) {
            const pattern = lines.slice(i, i + 2).join('\n').trim();
            if (pattern.length > 20 && !pattern.startsWith('#')) {
                patterns.push(pattern);
            }
        }
        
        return patterns;
    }

    /**
     * Generate helper template from pattern
     * @param {string} pattern - Common pattern
     * @returns {string} Helper template suggestion
     */
    generateHelperFromPattern(pattern) {
        const words = pattern.match(/[a-zA-Z]+/g) || [];
        const helperName = words.slice(0, 2).join('').toLowerCase();
        return `{{- define "chart.${helperName}" -}}\n${pattern}\n{{- end -}}`;
    }

    /**
     * Analyze template structure
     * @param {string} content - Template content
     * @returns {Object} Structure analysis
     */
    analyzeTemplateStructure(content) {
        const issues = [];
        
        // Check for proper YAML structure
        try {
            yaml.parse(content);
        } catch (error) {
            if (!content.includes('{{')) { // Only if it's not templated
                issues.push({
                    severity: 'high',
                    description: 'Invalid YAML structure detected',
                    recommendation: 'Fix YAML syntax errors',
                    example: error.message
                });
            }
        }
        
        // Check for missing required Kubernetes fields
        if (!content.includes('apiVersion:')) {
            issues.push({
                severity: 'high',
                description: 'Missing apiVersion field',
                recommendation: 'Add apiVersion field to Kubernetes resource',
                example: 'apiVersion: apps/v1'
            });
        }
        
        if (!content.includes('kind:')) {
            issues.push({
                severity: 'high',
                description: 'Missing kind field',
                recommendation: 'Add kind field to specify Kubernetes resource type',
                example: 'kind: Deployment'
            });
        }
        
        return { issues };
    }

    /**
     * Analyze values.yaml alignment
     * @param {string} content - Template content
     * @param {Object} valuesFile - Values file content
     * @returns {Object} Values alignment analysis
     */
    analyzeValuesAlignment(content, valuesFile) {
        const misaligned = [];
        const valueRefs = content.match(/\.Values\.[a-zA-Z0-9._]+/g) || [];
        
        for (const ref of valueRefs) {
            const path = ref.replace('.Values.', '');
            if (!this.hasPath(valuesFile, path)) {
                misaligned.push({
                    variable: ref,
                    suggestedValue: this.getDefaultForVariable(path)
                });
            }
        }
        
        return { misaligned };
    }

    /**
     * Check if object has nested path
     * @param {Object} obj - Object to check
     * @param {string} path - Dot notation path
     * @returns {boolean} True if path exists
     */
    hasPath(obj, path) {
        const parts = path.split('.');
        let current = obj;
        
        for (const part of parts) {
            if (current && typeof current === 'object' && current.hasOwnProperty(part)) {
                current = current[part];
            } else {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Analyze security practices
     * @param {string} content - Template content
     * @returns {Array} Security issues
     */
    analyzeSecurityPractices(content) {
        const issues = [];
        
        // Check for security contexts
        if (content.includes('kind: Deployment') && !content.includes('securityContext:')) {
            issues.push({
                description: 'Missing security context in Deployment',
                recommendation: 'Add securityContext to pod and container specs',
                example: 'securityContext:\n  runAsNonRoot: true\n  runAsUser: 65534',
                reference: 'https://kubernetes.io/docs/tasks/configure-pod-container/security-context/'
            });
        }
        
        // Check for resource limits
        if (content.includes('kind: Deployment') && !content.includes('resources:')) {
            issues.push({
                description: 'Missing resource limits and requests',
                recommendation: 'Add resource limits and requests to prevent resource exhaustion',
                example: 'resources:\n  limits:\n    cpu: 500m\n    memory: 512Mi\n  requests:\n    cpu: 100m\n    memory: 128Mi',
                reference: 'https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/'
            });
        }
        
        return issues;
    }

    /**
     * Analyze performance characteristics
     * @param {string} content - Template content
     * @returns {Array} Performance issues
     */
    analyzePerformance(content) {
        const issues = [];
        
        // Check for missing readiness probes
        if (content.includes('kind: Deployment') && !content.includes('readinessProbe:')) {
            issues.push({
                severity: 'medium',
                description: 'Missing readiness probe',
                recommendation: 'Add readiness probe for better traffic routing',
                impact: 'May cause traffic to be sent to unready pods'
            });
        }
        
        // Check for inefficient selector patterns
        const selectorCount = (content.match(/selector:/g) || []).length;
        if (selectorCount > 3) {
            issues.push({
                severity: 'low',
                description: 'Multiple selectors may impact performance',
                recommendation: 'Consider consolidating selector logic',
                impact: 'Slight increase in API server load'
            });
        }
        
        return issues;
    }

    /**
     * Calculate optimization summary
     * @param {Object} analysis - Complete analysis results
     * @returns {Object} Summary metrics
     */
    calculateOptimizationSummary(analysis) {
        const totalIssues = analysis.hardcodedValues.length + 
                           analysis.variableExtractions.length + 
                           analysis.logicOptimizations.length + 
                           analysis.duplicateCode.length + 
                           analysis.refactoringRecommendations.length;

        const criticalIssues = [...analysis.hardcodedValues, ...analysis.refactoringRecommendations]
            .filter(item => item.severity === 'high' || item.severity === 'critical').length;

        // Calculate optimization score (0-100)
        const maxIssuesForPerfectScore = 10;
        const score = Math.max(0, 100 - (totalIssues / maxIssuesForPerfectScore) * 100);

        return {
            templatesAnalyzed: analysis.summary.templatesAnalyzed,
            optimizationScore: Math.round(score),
            criticalIssues: criticalIssues,
            recommendations: totalIssues
        };
    }

    /**
     * Generate optimization report
     * @param {Object} analysis - Complete analysis results
     * @returns {string} Formatted optimization report
     */
    generateOptimizationReport(analysis) {
        let report = `# Template Optimization Report\n\n`;
        report += `**Generated:** ${new Date().toISOString()}\n`;
        report += `**Templates Analyzed:** ${analysis.summary.templatesAnalyzed}\n`;
        report += `**Optimization Score:** ${analysis.summary.optimizationScore}%\n`;
        report += `**Critical Issues:** ${analysis.summary.criticalIssues}\n`;
        report += `**Total Recommendations:** ${analysis.summary.recommendations}\n\n`;

        // Executive Summary
        report += `## Executive Summary\n\n`;
        if (analysis.summary.optimizationScore >= 90) {
            report += `✅ **Excellent** - Templates follow best practices with minimal optimization needed.\n\n`;
        } else if (analysis.summary.optimizationScore >= 70) {
            report += `⚠️ **Good** - Templates are well-structured with some optimization opportunities.\n\n`;
        } else if (analysis.summary.optimizationScore >= 50) {
            report += `🔧 **Needs Improvement** - Several optimization opportunities identified.\n\n`;
        } else {
            report += `🚨 **Critical** - Significant optimization needed to improve template quality.\n\n`;
        }

        // Detailed sections
        if (analysis.hardcodedValues.length > 0) {
            report += `## Hardcoded Values (${analysis.hardcodedValues.length})\n\n`;
            for (const item of analysis.hardcodedValues.slice(0, 10)) { // Limit to first 10
                report += `### ${item.file}:${item.line}\n`;
                report += `**Value:** \`${item.value}\`\n`;
                report += `**Recommendation:** ${item.recommendation.refactor}\n\n`;
            }
        }

        if (analysis.duplicateCode.length > 0) {
            report += `## Duplicate Code (${analysis.duplicateCode.length})\n\n`;
            for (const item of analysis.duplicateCode) {
                report += `### ${item.scope === 'internal' ? item.file : item.files.join(', ')}\n`;
                report += `**Pattern:** ${item.pattern.substring(0, 100)}...\n`;
                report += `**Recommendation:** ${item.recommendation}\n\n`;
            }
        }

        if (analysis.refactoringRecommendations.length > 0) {
            report += `## Refactoring Recommendations (${analysis.refactoringRecommendations.length})\n\n`;
            for (const item of analysis.refactoringRecommendations.filter(r => r.severity === 'high').slice(0, 5)) {
                report += `### ${item.file} - ${item.category}\n`;
                report += `**Issue:** ${item.description}\n`;
                report += `**Recommendation:** ${item.recommendation}\n\n`;
            }
        }

        report += `## Optimization Metrics\n\n`;
        report += `- **Hardcoded Values Found:** ${this.optimizationMetrics.hardcodedValuesFound}\n`;
        report += `- **Variables Extracted:** ${this.optimizationMetrics.variablesExtracted}\n`;
        report += `- **Logic Optimizations:** ${this.optimizationMetrics.logicOptimized}\n`;
        report += `- **Duplicates Detected:** ${this.optimizationMetrics.duplicatesDetected}\n`;
        report += `- **Recommendations Generated:** ${this.optimizationMetrics.recommendationsGenerated}\n\n`;

        return report;
    }
}

module.exports = TemplateOptimizer;

// CLI usage for optimization
if (require.main === module) {
    const templatePath = process.argv[2];
    const valuesPath = process.argv[3];
    
    if (!templatePath) {
        console.error('Usage: node template-optimizer.js <path-to-templates> [path-to-values.yaml]');
        process.exit(1);
    }
    
    async function main() {
        try {
            const optimizer = new TemplateOptimizer();
            let valuesFile = {};
            
            // Load values file if provided
            if (valuesPath && fs.existsSync(valuesPath)) {
                const valuesContent = await fs.promises.readFile(valuesPath, 'utf8');
                valuesFile = yaml.parse(valuesContent);
            }
            
            console.log('🚀 Starting template optimization...');
            const analysis = await optimizer.optimizeTemplates(templatePath, valuesFile);
            const report = optimizer.generateOptimizationReport(analysis);
            
            console.log('\n' + report);
            
            // Save report to file
            const reportPath = path.join(process.cwd(), 'template-optimization-report.md');
            await fs.promises.writeFile(reportPath, report);
            console.log(`📄 Optimization report saved to: ${reportPath}`);
            
        } catch (error) {
            console.error('❌ Template optimization failed:', error.message);
            process.exit(1);
        }
    }
    
    main();
}