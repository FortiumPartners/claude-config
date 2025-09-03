/**
 * Persistent state management for file monitoring service
 * Handles state persistence, recovery, and cleanup operations
 */

const fs = require('fs').promises
const path = require('path')

class StateManager {
    constructor(config = {}) {
        // Ensure we have a valid state directory
        const defaultStateDir = path.join(process.cwd(), '.ai-mesh', 'state')
        
        this.config = {
            stateDir: config.stateDir || defaultStateDir,
            backupRetention: config.backupRetention || 7, // days
            saveInterval: config.saveInterval || 60000, // 1 minute
            enableAutoSave: config.enableAutoSave !== false,
            ...config
        }
        
        // Validate state directory is a string
        if (typeof this.config.stateDir !== 'string') {
            this.config.stateDir = defaultStateDir
        }
        
        this.state = {
            subscriptions: new Map(),
            circuitBreakers: new Map(),
            stats: {},
            lastSaved: null
        }
        
        this.autoSaveTimer = null
        this.isDirty = false
        
        // Ensure state directory exists
        this._ensureStateDirectory()
    }

    /**
     * Initialize state manager and load persisted state
     * @returns {Promise<boolean>} - Success status
     */
    async initialize() {
        try {
            await this._ensureStateDirectory()
            await this.loadState()
            
            if (this.config.enableAutoSave) {
                this._startAutoSave()
            }
            
            return true
        } catch (error) {
            console.error('Failed to initialize state manager:', error)
            return false
        }
    }

    /**
     * Load state from disk
     * @returns {Promise<object>} - Loaded state
     */
    async loadState() {
        const stateFile = path.join(this.config.stateDir, 'monitoring-state.json')
        
        try {
            const stateData = await fs.readFile(stateFile, 'utf8')
            const persistedState = JSON.parse(stateData)
            
            // Restore Maps from JSON
            if (persistedState.subscriptions) {
                this.state.subscriptions = new Map(Object.entries(persistedState.subscriptions))
            }
            
            if (persistedState.circuitBreakers) {
                this.state.circuitBreakers = new Map(Object.entries(persistedState.circuitBreakers))
            }
            
            this.state.stats = persistedState.stats || {}
            this.state.lastSaved = new Date(persistedState.lastSaved)
            
            console.log('State loaded successfully from', stateFile)
            return this.state
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('No previous state found, starting fresh')
            } else {
                console.warn('Failed to load state:', error.message)
            }
            return this.state
        }
    }

    /**
     * Save current state to disk
     * @param {object} stateUpdate - State updates to apply before saving
     * @returns {Promise<boolean>} - Success status
     */
    async saveState(stateUpdate = {}) {
        try {
            // Apply updates
            Object.assign(this.state, stateUpdate)
            
            // Prepare serializable state
            const serializableState = {
                subscriptions: Object.fromEntries(this.state.subscriptions),
                circuitBreakers: Object.fromEntries(this.state.circuitBreakers),
                stats: this.state.stats,
                lastSaved: new Date().toISOString(),
                version: '1.0.0'
            }
            
            const stateFile = path.join(this.config.stateDir, 'monitoring-state.json')
            const backupFile = path.join(this.config.stateDir, `monitoring-state.backup.${Date.now()}.json`)
            
            // Create backup of existing state
            try {
                await fs.access(stateFile)
                await fs.copyFile(stateFile, backupFile)
            } catch (error) {
                // No existing state file, skip backup
            }
            
            // Write new state
            await fs.writeFile(stateFile, JSON.stringify(serializableState, null, 2))
            
            this.state.lastSaved = new Date()
            this.isDirty = false
            
            // Clean up old backups
            await this._cleanupBackups()
            
            return true
        } catch (error) {
            console.error('Failed to save state:', error)
            return false
        }
    }

    /**
     * Update subscription state
     * @param {string} agentId - Agent identifier
     * @param {object} subscriptionData - Subscription configuration
     */
    updateSubscription(agentId, subscriptionData) {
        this.state.subscriptions.set(agentId, {
            ...subscriptionData,
            lastUpdated: new Date().toISOString()
        })
        this.isDirty = true
    }

    /**
     * Remove subscription from state
     * @param {string} agentId - Agent identifier
     */
    removeSubscription(agentId) {
        this.state.subscriptions.delete(agentId)
        this.isDirty = true
    }

    /**
     * Update circuit breaker state
     * @param {string} agentId - Agent identifier
     * @param {object} circuitData - Circuit breaker state
     */
    updateCircuitBreaker(agentId, circuitData) {
        this.state.circuitBreakers.set(agentId, {
            ...circuitData,
            lastUpdated: new Date().toISOString()
        })
        this.isDirty = true
    }

    /**
     * Update statistics
     * @param {object} stats - Statistics data
     */
    updateStats(stats) {
        this.state.stats = {
            ...this.state.stats,
            ...stats,
            lastUpdated: new Date().toISOString()
        }
        this.isDirty = true
    }

    /**
     * Get persisted subscriptions for recovery
     * @returns {Map} - Subscription configurations
     */
    getPersistedSubscriptions() {
        return this.state.subscriptions
    }

    /**
     * Get persisted circuit breaker states
     * @returns {Map} - Circuit breaker states
     */
    getPersistedCircuitBreakers() {
        return this.state.circuitBreakers
    }

    /**
     * Clean up and shutdown state manager
     * @returns {Promise<boolean>} - Success status
     */
    async shutdown() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer)
            this.autoSaveTimer = null
        }
        
        // Save final state if dirty
        if (this.isDirty) {
            return await this.saveState()
        }
        
        return true
    }

    /**
     * Get state summary for monitoring
     * @returns {object} - State summary
     */
    getSummary() {
        return {
            subscriptionCount: this.state.subscriptions.size,
            circuitBreakerCount: this.state.circuitBreakers.size,
            lastSaved: this.state.lastSaved,
            isDirty: this.isDirty,
            autoSaveEnabled: this.config.enableAutoSave,
            stateDirectory: this.config.stateDir
        }
    }

    // Private methods

    /**
     * Ensure state directory exists
     * @private
     */
    async _ensureStateDirectory() {
        try {
            await fs.mkdir(this.config.stateDir, { recursive: true })
        } catch (error) {
            throw new Error(`Failed to create state directory: ${error.message}`)
        }
    }

    /**
     * Start automatic state saving
     * @private
     */
    _startAutoSave() {
        this.autoSaveTimer = setInterval(async () => {
            if (this.isDirty) {
                await this.saveState()
            }
        }, this.config.saveInterval)
    }

    /**
     * Clean up old backup files
     * @private
     */
    async _cleanupBackups() {
        try {
            const files = await fs.readdir(this.config.stateDir)
            const backupFiles = files
                .filter(file => file.startsWith('monitoring-state.backup.'))
                .map(file => ({
                    name: file,
                    path: path.join(this.config.stateDir, file),
                    timestamp: parseInt(file.split('.').slice(-2, -1)[0])
                }))
                .sort((a, b) => b.timestamp - a.timestamp)

            // Keep only recent backups
            const cutoffTime = Date.now() - (this.config.backupRetention * 24 * 60 * 60 * 1000)
            const filesToDelete = backupFiles.filter(file => file.timestamp < cutoffTime)

            for (const file of filesToDelete) {
                await fs.unlink(file.path)
            }

            if (filesToDelete.length > 0) {
                console.log(`Cleaned up ${filesToDelete.length} old backup files`)
            }
        } catch (error) {
            console.warn('Failed to cleanup backup files:', error.message)
        }
    }

    /**
     * Restore from backup
     * @param {string} backupFileName - Backup file name
     * @returns {Promise<boolean>} - Success status
     */
    async restoreFromBackup(backupFileName) {
        try {
            const backupPath = path.join(this.config.stateDir, backupFileName)
            const backupData = await fs.readFile(backupPath, 'utf8')
            const backupState = JSON.parse(backupData)
            
            // Validate backup structure
            if (!backupState.version) {
                throw new Error('Invalid backup file format')
            }
            
            // Apply backup state
            if (backupState.subscriptions) {
                this.state.subscriptions = new Map(Object.entries(backupState.subscriptions))
            }
            
            if (backupState.circuitBreakers) {
                this.state.circuitBreakers = new Map(Object.entries(backupState.circuitBreakers))
            }
            
            this.state.stats = backupState.stats || {}
            this.isDirty = true
            
            console.log('State restored from backup:', backupFileName)
            return true
        } catch (error) {
            console.error('Failed to restore from backup:', error)
            return false
        }
    }

    /**
     * List available backups
     * @returns {Promise<object[]>} - Available backup files
     */
    async listBackups() {
        try {
            const files = await fs.readdir(this.config.stateDir)
            return files
                .filter(file => file.startsWith('monitoring-state.backup.'))
                .map(file => ({
                    name: file,
                    timestamp: parseInt(file.split('.').slice(-2, -1)[0]),
                    date: new Date(parseInt(file.split('.').slice(-2, -1)[0]))
                }))
                .sort((a, b) => b.timestamp - a.timestamp)
        } catch (error) {
            console.error('Failed to list backups:', error)
            return []
        }
    }
}

module.exports = { StateManager }