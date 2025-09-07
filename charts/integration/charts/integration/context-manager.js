#!/usr/bin/env node

/**
 * Shared Context Manager for Helm Chart Specialist
 * 
 * Manages shared context between tech-lead-orchestrator and helm-chart-specialist
 * for seamless handoff and state management.
 * 
 * @version 1.0.0
 * @author Helm Chart Specialist Agent
 */

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class ContextManager extends EventEmitter {
    constructor(contextPath = './shared-context.json') {
        super();
        this.contextPath = contextPath;
        this.context = this.loadContext();
        this.subscribers = new Map();
        
        // Initialize default context structure
        this.initializeContext();
    }

    /**
     * Initialize default context structure
     */
    initializeContext() {
        const defaultContext = {
            project: {
                id: null,
                name: '',
                version: '0.1.0',
                status: 'initialized',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            },
            
            trd: {
                path: '',
                last_updated: null,
                parsed: false,
                valid: false,
                specifications: null,
                parse_errors: [],
                parse_warnings: []
            },
            
            chart: {
                generated: false,
                path: '',
                validated: false,
                deployed: false,
                errors: [],
                warnings: [],
                generation_time: null,
                validation_time: null
            },
            
            handoff: {
                initiated_at: null,
                completed_at: null,
                status: 'pending',
                phase: 'initialization',
                progress: 0,
                current_task: '',
                agent_stack: []
            },
            
            integration: {
                tech_lead_orchestrator: {
                    active: false,
                    last_contact: null,
                    tasks_delegated: []
                },
                helm_chart_specialist: {
                    active: false,
                    last_contact: null,
                    tasks_completed: []
                }
            },
            
            metrics: {
                handoff_count: 0,
                success_count: 0,
                failure_count: 0,
                avg_handoff_duration: 0,
                last_performance: null
            }
        };
        
        // Merge with existing context, preserving user data
        this.context = { ...defaultContext, ...this.context };
        this.saveContext();
    }

    /**
     * Load context from file
     * @returns {Object} Context object
     */
    loadContext() {
        try {
            if (fs.existsSync(this.contextPath)) {
                const data = fs.readFileSync(this.contextPath, 'utf8');
                return JSON.parse(data);
            }
        } catch (error) {
            console.warn(`Failed to load context: ${error.message}`);
        }
        return {};
    }

    /**
     * Save context to file
     */
    saveContext() {
        try {
            const dir = path.dirname(this.contextPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            fs.writeFileSync(this.contextPath, JSON.stringify(this.context, null, 2));
            this.emit('context:saved', this.context);
        } catch (error) {
            console.error(`Failed to save context: ${error.message}`);
            this.emit('context:save_error', error);
        }
    }

    /**
     * Update context value at specified path
     * @param {string} keyPath - Dot notation path (e.g., 'trd.parsed')
     * @param {*} value - Value to set
     * @param {Object} options - Update options
     */
    updateContext(keyPath, value, options = {}) {
        const { silent = false, timestamp = true } = options;
        
        try {
            const keys = keyPath.split('.');
            let current = this.context;
            
            // Navigate to parent object
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (!(key in current)) {
                    current[key] = {};
                }
                current = current[key];
            }
            
            // Set the final value
            const finalKey = keys[keys.length - 1];
            const oldValue = current[finalKey];
            current[finalKey] = value;
            
            // Update timestamp
            if (timestamp) {
                this.context.project.updated_at = new Date().toISOString();
            }
            
            // Save context
            this.saveContext();
            
            // Emit change event
            if (!silent) {
                this.emit('context:changed', {
                    path: keyPath,
                    oldValue,
                    newValue: value,
                    timestamp: new Date().toISOString()
                });
                
                this.emit(`context:changed:${keyPath}`, value, oldValue);
            }
            
            // Notify subscribers
            this.notifySubscribers(keyPath, value, oldValue);
            
        } catch (error) {
            console.error(`Failed to update context at ${keyPath}: ${error.message}`);
            this.emit('context:update_error', { keyPath, value, error });
        }
    }

    /**
     * Get context value at specified path
     * @param {string} keyPath - Dot notation path (e.g., 'trd.parsed')
     * @returns {*} Value at specified path
     */
    getContext(keyPath) {
        try {
            const keys = keyPath.split('.');
            let current = this.context;
            
            for (const key of keys) {
                if (current === null || current === undefined) {
                    return undefined;
                }
                current = current[key];
            }
            
            return current;
        } catch (error) {
            console.error(`Failed to get context at ${keyPath}: ${error.message}`);
            return undefined;
        }
    }

    /**
     * Subscribe to context changes at specified path
     * @param {string} keyPath - Dot notation path to watch
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribeToContext(keyPath, callback) {
        if (!this.subscribers.has(keyPath)) {
            this.subscribers.set(keyPath, new Set());
        }
        
        this.subscribers.get(keyPath).add(callback);
        
        // Return unsubscribe function
        return () => {
            const pathSubscribers = this.subscribers.get(keyPath);
            if (pathSubscribers) {
                pathSubscribers.delete(callback);
                if (pathSubscribers.size === 0) {
                    this.subscribers.delete(keyPath);
                }
            }
        };
    }

    /**
     * Notify subscribers of context changes
     * @param {string} keyPath - Path that changed
     * @param {*} newValue - New value
     * @param {*} oldValue - Old value
     */
    notifySubscribers(keyPath, newValue, oldValue) {
        // Notify exact path subscribers
        const exactSubscribers = this.subscribers.get(keyPath);
        if (exactSubscribers) {
            exactSubscribers.forEach(callback => {
                try {
                    callback(newValue, oldValue, keyPath);
                } catch (error) {
                    console.error(`Subscriber callback error for ${keyPath}: ${error.message}`);
                }
            });
        }
        
        // Notify parent path subscribers
        const pathParts = keyPath.split('.');
        for (let i = 1; i <= pathParts.length; i++) {
            const parentPath = pathParts.slice(0, i).join('.');
            const parentSubscribers = this.subscribers.get(parentPath + '.*');
            if (parentSubscribers) {
                parentSubscribers.forEach(callback => {
                    try {
                        callback(newValue, oldValue, keyPath);
                    } catch (error) {
                        console.error(`Parent subscriber callback error for ${parentPath}.*: ${error.message}`);
                    }
                });
            }
        }
    }

    /**
     * Start handoff process
     * @param {Object} handoffData - Initial handoff data
     */
    startHandoff(handoffData = {}) {
        const handoffId = this.generateHandoffId();
        const startTime = new Date().toISOString();
        
        this.updateContext('handoff', {
            id: handoffId,
            initiated_at: startTime,
            completed_at: null,
            status: 'in-progress',
            phase: 'initialization',
            progress: 0,
            current_task: 'Starting handoff process',
            agent_stack: ['tech-lead-orchestrator'],
            ...handoffData
        });
        
        this.updateContext('metrics.handoff_count', this.getContext('metrics.handoff_count') + 1);
        
        this.emit('handoff:started', {
            id: handoffId,
            timestamp: startTime,
            data: handoffData
        });
        
        return handoffId;
    }

    /**
     * Update handoff progress
     * @param {string} phase - Current phase
     * @param {number} progress - Progress percentage (0-100)
     * @param {string} task - Current task description
     */
    updateHandoffProgress(phase, progress, task = '') {
        this.updateContext('handoff.phase', phase);
        this.updateContext('handoff.progress', Math.min(100, Math.max(0, progress)));
        this.updateContext('handoff.current_task', task);
        
        this.emit('handoff:progress', {
            phase,
            progress,
            task,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Complete handoff process
     * @param {boolean} success - Whether handoff was successful
     * @param {Object} result - Handoff result data
     */
    completeHandoff(success = true, result = {}) {
        const completedAt = new Date().toISOString();
        const startedAt = this.getContext('handoff.initiated_at');
        const duration = startedAt ? Date.parse(completedAt) - Date.parse(startedAt) : 0;
        
        this.updateContext('handoff.completed_at', completedAt);
        this.updateContext('handoff.status', success ? 'completed' : 'failed');
        this.updateContext('handoff.progress', 100);
        this.updateContext('handoff.current_task', success ? 'Handoff completed successfully' : 'Handoff failed');
        
        // Update metrics
        if (success) {
            this.updateContext('metrics.success_count', this.getContext('metrics.success_count') + 1);
        } else {
            this.updateContext('metrics.failure_count', this.getContext('metrics.failure_count') + 1);
        }
        
        // Update average duration
        const handoffCount = this.getContext('metrics.handoff_count');
        const currentAvg = this.getContext('metrics.avg_handoff_duration') || 0;
        const newAvg = ((currentAvg * (handoffCount - 1)) + duration) / handoffCount;
        this.updateContext('metrics.avg_handoff_duration', Math.round(newAvg));
        
        this.emit('handoff:completed', {
            success,
            duration,
            result,
            timestamp: completedAt
        });
    }

    /**
     * Add error to context
     * @param {string} category - Error category (trd, chart, handoff, etc.)
     * @param {Object} error - Error object
     */
    addError(category, error) {
        const errorEntry = {
            message: error.message || 'Unknown error',
            code: error.code || 'UNKNOWN_ERROR',
            timestamp: new Date().toISOString(),
            stack: error.stack,
            recoverable: error.recoverable || false,
            suggestions: error.suggestions || []
        };
        
        const currentErrors = this.getContext(`${category}.errors`) || [];
        currentErrors.push(errorEntry);
        
        this.updateContext(`${category}.errors`, currentErrors);
        
        this.emit('error:added', {
            category,
            error: errorEntry
        });
    }

    /**
     * Add warning to context
     * @param {string} category - Warning category
     * @param {Object} warning - Warning object
     */
    addWarning(category, warning) {
        const warningEntry = {
            message: warning.message || 'Unknown warning',
            code: warning.code || 'UNKNOWN_WARNING',
            timestamp: new Date().toISOString(),
            suggestions: warning.suggestions || []
        };
        
        const currentWarnings = this.getContext(`${category}.warnings`) || [];
        currentWarnings.push(warningEntry);
        
        this.updateContext(`${category}.warnings`, currentWarnings);
        
        this.emit('warning:added', {
            category,
            warning: warningEntry
        });
    }

    /**
     * Clear errors and warnings for category
     * @param {string} category - Category to clear
     */
    clearIssues(category) {
        this.updateContext(`${category}.errors`, []);
        this.updateContext(`${category}.warnings`, []);
        
        this.emit('issues:cleared', { category });
    }

    /**
     * Register agent activity
     * @param {string} agentName - Name of the agent
     * @param {string} activity - Activity description
     */
    registerAgentActivity(agentName, activity) {
        const timestamp = new Date().toISOString();
        
        this.updateContext(`integration.${agentName.replace('-', '_')}.active`, true);
        this.updateContext(`integration.${agentName.replace('-', '_')}.last_contact`, timestamp);
        
        // Add to agent stack if not already present
        const agentStack = this.getContext('handoff.agent_stack') || [];
        if (!agentStack.includes(agentName)) {
            agentStack.push(agentName);
            this.updateContext('handoff.agent_stack', agentStack);
        }
        
        this.emit('agent:activity', {
            agent: agentName,
            activity,
            timestamp
        });
    }

    /**
     * Generate unique handoff ID
     * @returns {string} Unique handoff ID
     */
    generateHandoffId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        return `handoff-${timestamp}-${random}`;
    }

    /**
     * Get full context
     * @returns {Object} Complete context object
     */
    getFullContext() {
        return { ...this.context };
    }

    /**
     * Reset context to defaults
     */
    resetContext() {
        this.context = {};
        this.initializeContext();
        this.emit('context:reset');
    }

    /**
     * Export context for debugging
     * @returns {string} JSON string of context
     */
    exportContext() {
        return JSON.stringify(this.context, null, 2);
    }

    /**
     * Import context from JSON
     * @param {string} jsonData - JSON context data
     */
    importContext(jsonData) {
        try {
            const importedContext = JSON.parse(jsonData);
            this.context = importedContext;
            this.saveContext();
            this.emit('context:imported', importedContext);
        } catch (error) {
            console.error(`Failed to import context: ${error.message}`);
            this.emit('context:import_error', error);
        }
    }

    /**
     * Validate context integrity
     * @returns {Object} Validation result
     */
    validateContext() {
        const issues = [];
        
        // Check required fields
        const requiredFields = [
            'project.id',
            'project.name',
            'project.version',
            'project.status'
        ];
        
        for (const field of requiredFields) {
            const value = this.getContext(field);
            if (!value) {
                issues.push({
                    type: 'missing_field',
                    field,
                    message: `Required field '${field}' is missing or empty`
                });
            }
        }
        
        // Check data types
        const typeChecks = [
            { field: 'trd.parsed', type: 'boolean' },
            { field: 'chart.generated', type: 'boolean' },
            { field: 'handoff.progress', type: 'number' },
            { field: 'metrics.handoff_count', type: 'number' }
        ];
        
        for (const check of typeChecks) {
            const value = this.getContext(check.field);
            if (value !== undefined && typeof value !== check.type) {
                issues.push({
                    type: 'invalid_type',
                    field: check.field,
                    expected: check.type,
                    actual: typeof value,
                    message: `Field '${check.field}' should be ${check.type}, got ${typeof value}`
                });
            }
        }
        
        return {
            valid: issues.length === 0,
            issues,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = ContextManager;

// CLI usage
if (require.main === module) {
    const command = process.argv[2];
    const contextPath = process.argv[3] || './shared-context.json';
    
    const contextManager = new ContextManager(contextPath);
    
    switch (command) {
        case 'init':
            console.log('Context initialized successfully');
            console.log('Context path:', contextPath);
            break;
            
        case 'export':
            console.log(contextManager.exportContext());
            break;
            
        case 'validate':
            const validation = contextManager.validateContext();
            console.log('Validation result:', JSON.stringify(validation, null, 2));
            break;
            
        case 'reset':
            contextManager.resetContext();
            console.log('Context reset to defaults');
            break;
            
        case 'get':
            const keyPath = process.argv[4];
            if (!keyPath) {
                console.error('Usage: node context-manager.js get <context-path> <key-path>');
                process.exit(1);
            }
            const value = contextManager.getContext(keyPath);
            console.log(JSON.stringify(value, null, 2));
            break;
            
        case 'set':
            const setKeyPath = process.argv[4];
            const setValue = process.argv[5];
            if (!setKeyPath || !setValue) {
                console.error('Usage: node context-manager.js set <context-path> <key-path> <value>');
                process.exit(1);
            }
            try {
                const parsedValue = JSON.parse(setValue);
                contextManager.updateContext(setKeyPath, parsedValue);
                console.log(`Set ${setKeyPath} = ${setValue}`);
            } catch (error) {
                contextManager.updateContext(setKeyPath, setValue);
                console.log(`Set ${setKeyPath} = "${setValue}"`);
            }
            break;
            
        default:
            console.log('Usage: node context-manager.js <command> [args]');
            console.log('Commands:');
            console.log('  init [path]           - Initialize context');
            console.log('  export [path]         - Export context as JSON');
            console.log('  validate [path]       - Validate context integrity');
            console.log('  reset [path]          - Reset context to defaults');
            console.log('  get [path] <key>      - Get context value');
            console.log('  set [path] <key> <val> - Set context value');
            break;
    }
}