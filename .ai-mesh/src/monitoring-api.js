/**
 * API layer for agent integration with file monitoring service
 * Provides simple interfaces for agents to subscribe to file changes
 */

const { FileMonitoringService } = require('./file-monitoring-service')

class MonitoringAPI {
    constructor(config = {}) {
        this.service = new FileMonitoringService(config)
        this.isStarted = false
    }

    /**
     * Start monitoring service for a directory
     * @param {string} watchPath - Directory to monitor
     * @returns {Promise<boolean>} - Success status
     */
    async start(watchPath = process.cwd()) {
        if (this.isStarted) {
            return true
        }

        try {
            await this.service.startMonitoring(watchPath)
            this.isStarted = true
            return true
        } catch (error) {
            throw new Error(`Failed to start monitoring API: ${error.message}`)
        }
    }

    /**
     * Stop monitoring service
     * @returns {Promise<boolean>} - Success status
     */
    async stop() {
        if (!this.isStarted) {
            return true
        }

        try {
            await this.service.stopMonitoring()
            this.isStarted = false
            return true
        } catch (error) {
            throw new Error(`Failed to stop monitoring API: ${error.message}`)
        }
    }

    /**
     * Subscribe an agent to directory monitor events (directory-monitor agent pattern)
     * @param {string} agentId - Agent identifier  
     * @param {object} options - Subscription options
     * @param {number} options.changeThreshold - Percentage change threshold (default: 10)
     * @param {number} options.cooldownMinutes - Minutes between triggers (default: 5)
     * @param {string[]} options.priorityPatterns - High priority file patterns
     * @param {function} options.onTrigger - Callback when threshold exceeded
     * @returns {string} - Subscription ID
     */
    subscribeDirectoryMonitor(agentId, options = {}) {
        const {
            changeThreshold = 10,
            cooldownMinutes = 5,
            priorityPatterns = ['**/*.md', '**/*.yaml', '**/*.json', '**/*.txt'],
            onTrigger
        } = options

        if (!onTrigger || typeof onTrigger !== 'function') {
            throw new Error('onTrigger callback is required')
        }

        // Track changes for threshold calculation
        let baselineStats = null
        let changeBuffer = []
        let lastTrigger = null

        const callback = (event) => {
            try {
                // Initialize baseline on first event
                if (!baselineStats) {
                    baselineStats = this._calculateDirectoryStats()
                    return
                }

                // Add to change buffer
                changeBuffer.push({
                    event,
                    timestamp: new Date(),
                    isPriority: priorityPatterns.some(pattern => 
                        this._matchesPattern(event.filePath, pattern)
                    )
                })

                // Clean old changes (older than cooldown period)
                const cooldownMs = cooldownMinutes * 60 * 1000
                const cutoffTime = new Date(Date.now() - cooldownMs)
                changeBuffer = changeBuffer.filter(change => change.timestamp > cutoffTime)

                // Check if we should trigger
                if (this._shouldTriggerDirectoryMonitor(
                    baselineStats, 
                    changeBuffer, 
                    changeThreshold,
                    lastTrigger,
                    cooldownMs
                )) {
                    const currentStats = this._calculateDirectoryStats()
                    const changePercentage = this._calculateChangePercentage(baselineStats, currentStats, changeBuffer)
                    
                    onTrigger({
                        agentId,
                        changePercentage,
                        changedFiles: changeBuffer.map(c => c.event.filePath),
                        priorityChanges: changeBuffer.filter(c => c.isPriority).length,
                        baseline: baselineStats,
                        current: currentStats
                    })

                    // Update tracking
                    baselineStats = currentStats
                    changeBuffer = []
                    lastTrigger = new Date()
                }
            } catch (error) {
                console.error(`Directory monitor callback error for ${agentId}:`, error)
            }
        }

        return this.service.subscribeAgent(agentId, {
            eventTypes: ['fileCreated', 'fileModified', 'fileDeleted'],
            patterns: ['**/*'],
            callback,
            options: {
                debounceTime: 1000, // 1 second debounce
                bufferEvents: true
            }
        })
    }

    /**
     * Subscribe an agent to file metrics for dashboard analytics
     * @param {string} agentId - Agent identifier
     * @param {object} options - Subscription options  
     * @param {string[]} options.patterns - File patterns to track
     * @param {function} options.onMetrics - Callback with file metrics
     * @returns {string} - Subscription ID
     */
    subscribeFileMetrics(agentId, options = {}) {
        const {
            patterns = ['**/*.js', '**/*.ts', '**/*.py', '**/*.md'],
            onMetrics
        } = options

        if (!onMetrics || typeof onMetrics !== 'function') {
            throw new Error('onMetrics callback is required')
        }

        // Track metrics over time
        let metricsBuffer = []
        const maxMetrics = 1000

        const callback = (event) => {
            try {
                const metrics = {
                    eventType: event.eventType,
                    filePath: event.filePath,
                    fileName: event.fileName,
                    fileExtension: event.fileExtension,
                    timestamp: event.timestamp,
                    fileSize: event.stats?.size || 0
                }

                metricsBuffer.push(metrics)
                if (metricsBuffer.length > maxMetrics) {
                    metricsBuffer.shift()
                }

                // Calculate aggregated metrics
                const aggregated = this._calculateFileMetrics(metricsBuffer)
                
                onMetrics({
                    agentId,
                    latestEvent: metrics,
                    aggregatedMetrics: aggregated,
                    totalEvents: metricsBuffer.length
                })
            } catch (error) {
                console.error(`File metrics callback error for ${agentId}:`, error)
            }
        }

        return this.service.subscribeAgent(agentId, {
            eventTypes: ['fileCreated', 'fileModified', 'fileDeleted'],
            patterns,
            callback,
            options: {
                debounceTime: 500,
                bufferEvents: false
            }
        })
    }

    /**
     * Unsubscribe an agent from monitoring events
     * @param {string} agentId - Agent identifier
     * @returns {boolean} - Success status
     */
    unsubscribe(agentId) {
        return this.service.unsubscribeAgent(agentId)
    }

    /**
     * Get monitoring service statistics
     * @returns {object} - Service stats including subscriptions
     */
    getStats() {
        const serviceStats = this.service.getStats()
        const subscriptions = this.service.getActiveSubscriptions()

        return {
            ...serviceStats,
            isStarted: this.isStarted,
            activeSubscriptions: subscriptions.length,
            subscriptions
        }
    }

    // Private helper methods

    _calculateDirectoryStats() {
        // Simplified directory stats - in real implementation would scan filesystem
        return {
            fileCount: 0,
            totalSize: 0,
            lastScanned: new Date()
        }
    }

    _shouldTriggerDirectoryMonitor(baseline, changes, threshold, lastTrigger, cooldownMs) {
        if (!baseline || changes.length === 0) return false
        
        if (lastTrigger && (Date.now() - lastTrigger.getTime()) < cooldownMs) {
            return false
        }

        // Count weighted changes (priority files count more)
        const weightedChanges = changes.reduce((sum, change) => {
            return sum + (change.isPriority ? 2 : 1)
        }, 0)

        // Simple threshold check - could be more sophisticated
        return weightedChanges >= Math.max(1, Math.ceil(baseline.fileCount * threshold / 100))
    }

    _calculateChangePercentage(baseline, current, changes) {
        if (!baseline.fileCount) return 0
        
        // Weight priority files more heavily
        const weightedChanges = changes.reduce((sum, change) => {
            return sum + (change.isPriority ? 2 : 1)
        }, 0)

        return (weightedChanges / baseline.fileCount) * 100
    }

    _calculateFileMetrics(metricsBuffer) {
        if (metricsBuffer.length === 0) return {}

        const now = Date.now()
        const oneHour = 60 * 60 * 1000
        const recentEvents = metricsBuffer.filter(m => (now - m.timestamp.getTime()) < oneHour)

        const byExtension = {}
        const byEventType = {}

        recentEvents.forEach(metric => {
            // By file extension
            const ext = metric.fileExtension || 'no-extension'
            byExtension[ext] = (byExtension[ext] || 0) + 1

            // By event type  
            byEventType[metric.eventType] = (byEventType[metric.eventType] || 0) + 1
        })

        return {
            totalEventsLastHour: recentEvents.length,
            eventsPerMinute: recentEvents.length / 60,
            byExtension,
            byEventType,
            averageFileSize: recentEvents.reduce((sum, m) => sum + m.fileSize, 0) / recentEvents.length || 0
        }
    }

    _matchesPattern(filePath, pattern) {
        // Use the same pattern matching as the service
        return this.service._matchesPattern(filePath, pattern)
    }
}

module.exports = { MonitoringAPI }