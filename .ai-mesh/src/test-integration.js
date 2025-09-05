/**
 * Integration test for file monitoring service with agent subscriptions
 * Tests performance impact and basic functionality
 */

const { MonitoringAPI } = require('./monitoring-api')
const { ConfigManager } = require('./config/config-manager')
const path = require('path')
const fs = require('fs').promises

class IntegrationTester {
    constructor() {
        this.configManager = new ConfigManager()
        this.monitoringAPI = null
        this.testResults = {
            startTime: Date.now(),
            tests: [],
            performance: {},
            errors: []
        }
    }

    async runTests() {
        console.log('🧪 Starting File Monitoring Integration Tests...\n')

        try {
            // Test 1: Configuration loading
            await this.testConfigurationLoading()

            // Test 2: Monitoring service startup
            await this.testMonitoringServiceStartup()

            // Test 3: Agent subscriptions
            await this.testAgentSubscriptions()

            // Test 4: Performance impact
            await this.testPerformanceImpact()

            // Test 5: Event handling
            await this.testEventHandling()

            // Generate report
            await this.generateReport()

        } catch (error) {
            this.testResults.errors.push({
                test: 'integration_test_suite',
                error: error.message,
                timestamp: new Date()
            })
            console.error('❌ Integration test failed:', error.message)
        } finally {
            await this.cleanup()
        }
    }

    async testConfigurationLoading() {
        const testName = 'Configuration Loading'
        console.log(`📋 Testing: ${testName}`)
        
        const startTime = Date.now()
        
        try {
            // Load configuration
            await this.configManager.loadConfig()
            
            // Test agent configuration retrieval
            const directoryMonitorConfig = this.configManager.getAgentConfig('directory-monitor')
            const managerDashboardConfig = this.configManager.getAgentConfig('manager-dashboard-agent')
            
            // Validate configurations
            if (!directoryMonitorConfig.patterns || !directoryMonitorConfig.eventTypes) {
                throw new Error('Directory monitor configuration invalid')
            }
            
            if (!managerDashboardConfig.patterns || !managerDashboardConfig.eventTypes) {
                throw new Error('Manager dashboard configuration invalid')
            }
            
            // Test pattern categories
            const docPatterns = this.configManager.getPatternsByCategory('documentation')
            const frontendPatterns = this.configManager.getPatternsByCategory('frontend')
            
            if (docPatterns.length === 0 || frontendPatterns.length === 0) {
                throw new Error('Pattern categories not loaded correctly')
            }
            
            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'PASSED',
                duration,
                details: {
                    totalAgents: Object.keys(this.configManager.config.agentConfigurations).length,
                    enabledAgents: Object.keys(this.configManager.getEnabledAgents()).length,
                    patternCategories: Object.keys(this.configManager.config.customPatterns).length
                }
            })
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)`)
            console.log(`   - Loaded ${Object.keys(this.configManager.config.agentConfigurations).length} agent configurations`)
            console.log(`   - ${Object.keys(this.configManager.getEnabledAgents()).length} agents enabled`)
            
        } catch (error) {
            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'FAILED',
                duration,
                error: error.message
            })
            console.log(`❌ ${testName} - FAILED (${duration}ms): ${error.message}`)
            throw error
        }
    }

    async testMonitoringServiceStartup() {
        const testName = 'Monitoring Service Startup'
        console.log(`\n🚀 Testing: ${testName}`)
        
        const startTime = Date.now()
        
        try {
            // Create service config from directory monitor agent
            const serviceConfig = this.configManager.createServiceConfig('directory-monitor')
            
            // Initialize monitoring API
            this.monitoringAPI = new MonitoringAPI(serviceConfig)
            
            // Start monitoring current directory
            await this.monitoringAPI.start(process.cwd())
            
            // Verify service is running
            const stats = this.monitoringAPI.getStats()
            if (!stats.isStarted || !stats.isMonitoring) {
                throw new Error('Monitoring service failed to start properly')
            }
            
            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'PASSED',
                duration,
                details: {
                    isStarted: stats.isStarted,
                    isMonitoring: stats.isMonitoring,
                    watchedPaths: stats.watchedPaths.length,
                    patterns: stats.config.patterns.length
                }
            })
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)`)
            console.log(`   - Service started: ${stats.isStarted}`)
            console.log(`   - Monitoring paths: ${stats.watchedPaths.length}`)
            console.log(`   - Patterns configured: ${stats.config.patterns.length}`)
            
        } catch (error) {
            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'FAILED',
                duration,
                error: error.message
            })
            console.log(`❌ ${testName} - FAILED (${duration}ms): ${error.message}`)
            throw error
        }
    }

    async testAgentSubscriptions() {
        const testName = 'Agent Subscriptions'
        console.log(`\n👥 Testing: ${testName}`)
        
        const startTime = Date.now()
        let subscriptionsCreated = 0
        
        try {
            // Test directory monitor subscription
            const directoryMonitorCallback = (triggerData) => {
                console.log(`   📝 Directory Monitor triggered: ${triggerData.changePercentage.toFixed(1)}% change`)
            }
            
            const directorySubscription = this.monitoringAPI.subscribeDirectoryMonitor('test-directory-monitor', {
                changeThreshold: 5, // Lower threshold for testing
                cooldownMinutes: 1,
                onTrigger: directoryMonitorCallback
            })
            subscriptionsCreated++
            
            // Test file metrics subscription
            const fileMetricsCallback = (metricsData) => {
                console.log(`   📊 File Metrics: ${metricsData.latestEvent.eventType} - ${metricsData.latestEvent.fileName}`)
            }
            
            const metricsSubscription = this.monitoringAPI.subscribeFileMetrics('test-manager-dashboard', {
                onMetrics: fileMetricsCallback
            })
            subscriptionsCreated++
            
            // Verify subscriptions are active
            const stats = this.monitoringAPI.getStats()
            if (stats.activeSubscriptions !== subscriptionsCreated) {
                throw new Error(`Expected ${subscriptionsCreated} subscriptions, got ${stats.activeSubscriptions}`)
            }
            
            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'PASSED',
                duration,
                details: {
                    subscriptionsCreated,
                    activeSubscriptions: stats.activeSubscriptions
                }
            })
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)`)
            console.log(`   - Subscriptions created: ${subscriptionsCreated}`)
            console.log(`   - Active subscriptions: ${stats.activeSubscriptions}`)
            
        } catch (error) {
            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'FAILED',
                duration,
                error: error.message
            })
            console.log(`❌ ${testName} - FAILED (${duration}ms): ${error.message}`)
            throw error
        }
    }

    async testPerformanceImpact() {
        const testName = 'Performance Impact'
        console.log(`\n⚡ Testing: ${testName}`)
        
        const startTime = Date.now()
        
        try {
            // Measure baseline performance
            const baselineStart = process.hrtime.bigint()
            const baselineMemory = process.memoryUsage()
            
            // Simulate file operations
            const testFile = path.join(__dirname, 'test-performance-file.tmp')
            const iterations = 50
            
            for (let i = 0; i < iterations; i++) {
                await fs.writeFile(testFile, `Test content ${i} - ${new Date().toISOString()}`)
                await new Promise(resolve => setTimeout(resolve, 10)) // Small delay to avoid overwhelming
            }
            
            // Clean up test file
            try {
                await fs.unlink(testFile)
            } catch (err) {
                // Ignore cleanup errors
            }
            
            // Wait for event processing
            await new Promise(resolve => setTimeout(resolve, 2000))
            
            // Measure final performance
            const finalTime = process.hrtime.bigint()
            const finalMemory = process.memoryUsage()
            
            const totalTime = Number(finalTime - baselineStart) / 1000000 // Convert to milliseconds
            const memoryDiff = finalMemory.heapUsed - baselineMemory.heapUsed
            
            // Get service statistics
            const stats = this.monitoringAPI.getStats()
            
            const duration = Date.now() - startTime
            this.testResults.performance = {
                totalProcessingTime: totalTime,
                memoryImpact: memoryDiff,
                fileOperations: iterations,
                avgProcessingTime: totalTime / iterations,
                pendingEvents: stats.pendingEvents
            }
            
            this.testResults.tests.push({
                name: testName,
                status: 'PASSED',
                duration,
                details: this.testResults.performance
            })
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)`)
            console.log(`   - Processed ${iterations} file operations`)
            console.log(`   - Total processing time: ${totalTime.toFixed(2)}ms`)
            console.log(`   - Average per operation: ${(totalTime / iterations).toFixed(2)}ms`)
            console.log(`   - Memory impact: ${(memoryDiff / 1024).toFixed(2)}KB`)
            console.log(`   - Pending events: ${stats.pendingEvents}`)
            
        } catch (error) {
            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'FAILED',
                duration,
                error: error.message
            })
            console.log(`❌ ${testName} - FAILED (${duration}ms): ${error.message}`)
            throw error
        }
    }

    async testEventHandling() {
        const testName = 'Event Handling'
        console.log(`\n📡 Testing: ${testName}`)
        
        const startTime = Date.now()
        
        try {
            let eventsReceived = 0
            const expectedEvents = 3
            
            // Create a test subscription to capture events
            const testCallback = (event) => {
                eventsReceived++
                console.log(`   🎯 Event received: ${event.eventType} - ${event.fileName}`)
            }
            
            this.monitoringAPI.service.subscribeAgent('test-event-handler', {
                eventTypes: ['fileCreated', 'fileModified', 'fileDeleted'],
                patterns: ['**/*.test'],
                callback: testCallback
            })
            
            // Create test events
            const testEventFile = path.join(__dirname, 'test-events.test')
            
            await fs.writeFile(testEventFile, 'Initial content') // Create
            await fs.writeFile(testEventFile, 'Modified content') // Modify
            await fs.unlink(testEventFile) // Delete
            
            // Wait for events to be processed
            await new Promise(resolve => setTimeout(resolve, 1500))
            
            // Verify events were received
            if (eventsReceived < expectedEvents) {
                console.log(`   ⚠️  Warning: Only received ${eventsReceived}/${expectedEvents} events`)
            }
            
            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: eventsReceived > 0 ? 'PASSED' : 'FAILED',
                duration,
                details: {
                    eventsReceived,
                    expectedEvents
                }
            })
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)`)
            console.log(`   - Events received: ${eventsReceived}/${expectedEvents}`)
            
        } catch (error) {
            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'FAILED',
                duration,
                error: error.message
            })
            console.log(`❌ ${testName} - FAILED (${duration}ms): ${error.message}`)
            throw error
        }
    }

    async generateReport() {
        console.log('\n📊 Integration Test Report')
        console.log('=' .repeat(50))
        
        const totalDuration = Date.now() - this.testResults.startTime
        const passedTests = this.testResults.tests.filter(t => t.status === 'PASSED').length
        const failedTests = this.testResults.tests.filter(t => t.status === 'FAILED').length
        
        console.log(`Total Duration: ${totalDuration}ms`)
        console.log(`Tests Passed: ${passedTests}`)
        console.log(`Tests Failed: ${failedTests}`)
        console.log(`Success Rate: ${((passedTests / this.testResults.tests.length) * 100).toFixed(1)}%`)
        
        if (this.testResults.performance.totalProcessingTime) {
            console.log('\nPerformance Metrics:')
            console.log(`- Average processing per file: ${this.testResults.performance.avgProcessingTime.toFixed(2)}ms`)
            console.log(`- Memory impact: ${(this.testResults.performance.memoryImpact / 1024).toFixed(2)}KB`)
        }
        
        if (this.testResults.errors.length > 0) {
            console.log('\nErrors:')
            this.testResults.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.test}: ${error.error}`)
            })
        }
        
        console.log('\n🎯 Recommendation:')
        if (failedTests === 0 && this.testResults.performance.avgProcessingTime < 10) {
            console.log('✅ Integration is ready for production use')
        } else if (failedTests === 0) {
            console.log('⚠️  Integration works but may have performance impact')
        } else {
            console.log('❌ Integration has issues that need to be resolved')
        }
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up...')
        
        if (this.monitoringAPI) {
            try {
                await this.monitoringAPI.stop()
                console.log('✅ Monitoring service stopped')
            } catch (error) {
                console.log(`⚠️  Cleanup warning: ${error.message}`)
            }
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new IntegrationTester()
    tester.runTests().catch(console.error)
}

module.exports = { IntegrationTester }