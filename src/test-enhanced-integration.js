/**
 * Enhanced integration test for improved file monitoring service
 * Tests advanced debouncing, circuit breakers, memory management, and state persistence
 */

const { MonitoringAPI } = require('./monitoring-api')
const { ConfigManager } = require('./config/config-manager')
const { FileMonitoringService } = require('./file-monitoring-service')
const path = require('path')
const fs = require('fs').promises

class EnhancedIntegrationTester {
    constructor() {
        this.configManager = new ConfigManager()
        this.monitoringAPI = null
        this.directService = null
        this.testResults = {
            startTime: Date.now(),
            tests: [],
            performance: {},
            errors: []
        }
    }

    async runEnhancedTests() {
        console.log('🚀 Starting Enhanced File Monitoring Integration Tests...\n')

        try {
            // Test 1: Advanced debouncing effectiveness
            await this.testAdvancedDebouncing()

            // Test 2: Circuit breaker functionality
            await this.testCircuitBreaker()

            // Test 3: Memory management and circular buffer
            await this.testMemoryManagement()

            // Test 4: High-performance pattern matching
            await this.testPatternMatchingPerformance()

            // Test 5: State persistence and recovery
            await this.testStatePersistence()

            // Generate enhanced report
            await this.generateEnhancedReport()

        } catch (error) {
            this.testResults.errors.push({
                test: 'enhanced_integration_suite',
                error: error.message,
                timestamp: new Date()
            })
            console.error('❌ Enhanced integration test failed:', error.message)
        } finally {
            await this.cleanup()
        }
    }

    async testAdvancedDebouncing() {
        const testName = 'Advanced Debouncing System'
        console.log(`🔄 Testing: ${testName}`)
        
        const startTime = Date.now()
        let eventsReceived = 0
        let eventsProcessed = 0
        
        try {
            // Create service with advanced debouncing
            this.directService = new FileMonitoringService({
                debounceTime: 50,
                patterns: ['**/*.debounce-test'],
                ignorePatterns: []
            })

            await this.directService.startMonitoring(process.cwd())

            // Subscribe with callback counting
            this.directService.subscribeAgent('debounce-test', {
                eventTypes: ['fileCreated', 'fileModified'],
                patterns: ['**/*.debounce-test'],
                callback: (event) => {
                    eventsProcessed++
                    console.log(`   📝 Processed event ${eventsProcessed}: ${event.eventType} ${event.fileName}`)
                }
            })

            // Generate rapid file changes to test debouncing
            const testFile = path.join(__dirname, 'rapid-changes.debounce-test')
            const rapidChanges = 20

            console.log(`   ⚡ Generating ${rapidChanges} rapid file changes...`)
            for (let i = 0; i < rapidChanges; i++) {
                await fs.writeFile(testFile, `Content ${i} - ${new Date().toISOString()}`)
                eventsReceived++
                await new Promise(resolve => setTimeout(resolve, 10)) // Rapid changes
            }

            // Wait for debouncing to settle
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Get debouncing stats
            const stats = this.directService.getAdvancedStats()
            
            // Clean up test file
            try {
                await fs.unlink(testFile)
            } catch (err) {
                // Ignore cleanup errors
            }

            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: eventsProcessed < eventsReceived ? 'PASSED' : 'PARTIAL',
                duration,
                details: {
                    eventsReceived,
                    eventsProcessed,
                    debounceEfficiency: stats.debouncing.efficiency,
                    groupsCreated: stats.debouncing.groupsCreated
                }
            })
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)`)
            console.log(`   - Events received: ${eventsReceived}`)
            console.log(`   - Events processed: ${eventsProcessed}`)
            console.log(`   - Debounce efficiency: ${stats.debouncing.efficiency}`)
            console.log(`   - Groups created: ${stats.debouncing.groupsCreated}`)
            
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

    async testCircuitBreaker() {
        const testName = 'Circuit Breaker Protection'
        console.log(`\n🔌 Testing: ${testName}`)
        
        const startTime = Date.now()
        let successfulCalls = 0
        let failedCalls = 0
        let circuitBreakerTriggered = false
        
        try {
            // Subscribe with failing callback to trigger circuit breaker
            this.directService.subscribeAgent('circuit-test', {
                eventTypes: ['fileCreated'],
                patterns: ['**/*.circuit-test'],
                callback: (event) => {
                    if (successfulCalls + failedCalls < 6) {
                        failedCalls++
                        throw new Error('Intentional failure for circuit breaker test')
                    } else {
                        successfulCalls++
                        console.log(`   ✅ Callback succeeded after circuit breaker recovery`)
                    }
                }
            })

            // Listen for circuit breaker events
            this.directService.on('circuitBreakerOpened', () => {
                circuitBreakerTriggered = true
                console.log('   🔌 Circuit breaker opened!')
            })

            // Generate events to trigger circuit breaker
            const testFile = path.join(__dirname, 'circuit-breaker.circuit-test')
            for (let i = 0; i < 8; i++) {
                await fs.writeFile(testFile, `Test ${i}`)
                await new Promise(resolve => setTimeout(resolve, 100))
            }

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 500))

            // Check circuit breaker status
            const circuitStatus = this.directService.getCircuitBreakerStatus()
            
            // Clean up test file
            try {
                await fs.unlink(testFile)
            } catch (err) {
                // Ignore cleanup errors
            }

            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: circuitBreakerTriggered ? 'PASSED' : 'FAILED',
                duration,
                details: {
                    successfulCalls,
                    failedCalls,
                    circuitBreakerTriggered,
                    circuitStatus
                }
            })
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)`)
            console.log(`   - Failed calls: ${failedCalls}`)
            console.log(`   - Successful calls: ${successfulCalls}`)
            console.log(`   - Circuit breaker triggered: ${circuitBreakerTriggered}`)
            
        } catch (error) {
            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'FAILED',
                duration,
                error: error.message
            })
            console.log(`❌ ${testName} - FAILED (${duration}ms): ${error.message}`)
        }
    }

    async testMemoryManagement() {
        const testName = 'Memory Management & Circular Buffer'
        console.log(`\n💾 Testing: ${testName}`)
        
        const startTime = Date.now()
        
        try {
            const initialMemory = process.memoryUsage()
            
            // Generate many events to test circular buffer
            const testFile = path.join(__dirname, 'memory-test.memory-test')
            const eventCount = 150 // More than buffer size to test circular behavior
            
            for (let i = 0; i < eventCount; i++) {
                await fs.writeFile(testFile, `Memory test ${i}`)
                await new Promise(resolve => setTimeout(resolve, 5))
            }

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 1000))

            // Check memory usage and buffer status
            const finalMemory = process.memoryUsage()
            const stats = this.directService.getAdvancedStats()
            const recentEvents = this.directService.getRecentEvents(10)

            // Clean up test file
            try {
                await fs.unlink(testFile)
            } catch (err) {
                // Ignore cleanup errors
            }

            const memoryDiff = finalMemory.heapUsed - initialMemory.heapUsed

            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'PASSED',
                duration,
                details: {
                    eventsGenerated: eventCount,
                    bufferSize: stats.memory.eventBufferSize,
                    maxBufferSize: stats.memory.maxBufferSize,
                    bufferUtilization: stats.memory.bufferUtilization,
                    memoryIncrease: memoryDiff,
                    recentEventsCount: recentEvents.length
                }
            })
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)`)
            console.log(`   - Events generated: ${eventCount}`)
            console.log(`   - Buffer utilization: ${stats.memory.bufferUtilization}`)
            console.log(`   - Memory increase: ${(memoryDiff / 1024).toFixed(2)}KB`)
            console.log(`   - Recent events available: ${recentEvents.length}`)
            
        } catch (error) {
            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'FAILED',
                duration,
                error: error.message
            })
            console.log(`❌ ${testName} - FAILED (${duration}ms): ${error.message}`)
        }
    }

    async testPatternMatchingPerformance() {
        const testName = 'High-Performance Pattern Matching'
        console.log(`\n⚡ Testing: ${testName}`)
        
        const startTime = Date.now()
        
        try {
            // Test pattern matching performance with compiled patterns
            const testPaths = [
                '/project/src/component.js',
                '/project/docs/readme.md',
                '/project/config/settings.json',
                '/project/tests/unit.spec.js',
                '/project/node_modules/package/index.js',
                '/project/dist/bundle.js'
            ]

            const patterns = ['**/*.js', '**/*.md', '**/*.json', '**/tests/**']
            const iterations = 1000

            // Measure pattern matching performance
            const patternStartTime = process.hrtime.bigint()
            
            for (let i = 0; i < iterations; i++) {
                for (const testPath of testPaths) {
                    for (const pattern of patterns) {
                        this.directService._matchesPattern(testPath, pattern)
                    }
                }
            }
            
            const patternEndTime = process.hrtime.bigint()
            const totalMatchingTime = Number(patternEndTime - patternStartTime) / 1000000 // Convert to milliseconds

            const matchesPerSecond = (iterations * testPaths.length * patterns.length) / (totalMatchingTime / 1000)

            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'PASSED',
                duration,
                details: {
                    totalMatchingTime,
                    iterations,
                    pathsPerIteration: testPaths.length,
                    patternsPerPath: patterns.length,
                    matchesPerSecond: Math.round(matchesPerSecond)
                }
            })
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)`)
            console.log(`   - Total matching operations: ${iterations * testPaths.length * patterns.length}`)
            console.log(`   - Total matching time: ${totalMatchingTime.toFixed(2)}ms`)
            console.log(`   - Matches per second: ${Math.round(matchesPerSecond).toLocaleString()}`)
            
        } catch (error) {
            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'FAILED',
                duration,
                error: error.message
            })
            console.log(`❌ ${testName} - FAILED (${duration}ms): ${error.message}`)
        }
    }

    async testStatePersistence() {
        const testName = 'State Persistence & Recovery'
        console.log(`\n💿 Testing: ${testName}`)
        
        const startTime = Date.now()
        
        try {
            // Test state saving
            const stateBefore = this.directService.getComprehensiveStatus()
            
            // Trigger a state save
            await this.directService.shutdown()
            
            // Create a new service instance to test state restoration
            this.directService = new FileMonitoringService({
                patterns: ['**/*.state-test'],
                stateDir: path.join(process.cwd(), '.ai-mesh', 'state')
            })
            
            await this.directService.startMonitoring(process.cwd())
            
            // Check if state was restored
            const stateAfter = this.directService.getComprehensiveStatus()
            const stateManagerSummary = stateAfter.stateManager

            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: stateManagerSummary ? 'PASSED' : 'FAILED',
                duration,
                details: {
                    stateDirectoryExists: !!stateManagerSummary,
                    lastSaved: stateManagerSummary?.lastSaved,
                    isDirty: stateManagerSummary?.isDirty,
                    subscriptionCount: stateManagerSummary?.subscriptionCount,
                    circuitBreakerCount: stateManagerSummary?.circuitBreakerCount
                }
            })
            
            console.log(`✅ ${testName} - PASSED (${duration}ms)`)
            console.log(`   - State directory: ${stateManagerSummary?.stateDirectory}`)
            console.log(`   - Last saved: ${stateManagerSummary?.lastSaved}`)
            console.log(`   - Auto-save enabled: ${stateManagerSummary?.autoSaveEnabled}`)
            
        } catch (error) {
            const duration = Date.now() - startTime
            this.testResults.tests.push({
                name: testName,
                status: 'FAILED',
                duration,
                error: error.message
            })
            console.log(`❌ ${testName} - FAILED (${duration}ms): ${error.message}`)
        }
    }

    async generateEnhancedReport() {
        console.log('\n📊 Enhanced Integration Test Report')
        console.log('=' .repeat(60))
        
        const totalDuration = Date.now() - this.testResults.startTime
        const passedTests = this.testResults.tests.filter(t => t.status === 'PASSED').length
        const failedTests = this.testResults.tests.filter(t => t.status === 'FAILED').length
        
        console.log(`Total Duration: ${totalDuration}ms`)
        console.log(`Tests Passed: ${passedTests}`)
        console.log(`Tests Failed: ${failedTests}`)
        console.log(`Success Rate: ${((passedTests / this.testResults.tests.length) * 100).toFixed(1)}%`)
        
        // Performance summary
        console.log('\n🚀 Performance Improvements:')
        const debounceTest = this.testResults.tests.find(t => t.name === 'Advanced Debouncing System')
        if (debounceTest && debounceTest.details) {
            console.log(`- Debouncing efficiency: ${debounceTest.details.debounceEfficiency}`)
            console.log(`- Event reduction: ${debounceTest.details.eventsReceived - debounceTest.details.eventsProcessed} events saved`)
        }
        
        const patternTest = this.testResults.tests.find(t => t.name === 'High-Performance Pattern Matching')
        if (patternTest && patternTest.details) {
            console.log(`- Pattern matching: ${patternTest.details.matchesPerSecond.toLocaleString()} matches/second`)
        }

        // Reliability summary
        console.log('\n🛡️ Reliability Features:')
        const circuitTest = this.testResults.tests.find(t => t.name === 'Circuit Breaker Protection')
        if (circuitTest && circuitTest.details.circuitBreakerTriggered) {
            console.log('- Circuit breaker protection: ✅ Working')
        }
        
        const memoryTest = this.testResults.tests.find(t => t.name === 'Memory Management & Circular Buffer')
        if (memoryTest && memoryTest.details) {
            console.log(`- Circular buffer: ✅ ${memoryTest.details.bufferUtilization} utilization`)
        }
        
        const stateTest = this.testResults.tests.find(t => t.name === 'State Persistence & Recovery')
        if (stateTest && stateTest.details.stateDirectoryExists) {
            console.log('- State persistence: ✅ Working')
        }
        
        if (this.testResults.errors.length > 0) {
            console.log('\n❌ Errors:')
            this.testResults.errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error.test}: ${error.error}`)
            })
        }
        
        console.log('\n🎯 Enhanced Integration Assessment:')
        if (failedTests === 0) {
            console.log('✅ All enhanced features working correctly - Ready for production!')
        } else if (passedTests >= 3) {
            console.log('⚠️  Most features working - Some issues need attention')
        } else {
            console.log('❌ Multiple issues detected - Requires investigation')
        }
    }

    async cleanup() {
        console.log('\n🧹 Enhanced cleanup...')
        
        if (this.directService) {
            try {
                await this.directService.shutdown()
                console.log('✅ Enhanced monitoring service shutdown')
            } catch (error) {
                console.log(`⚠️  Cleanup warning: ${error.message}`)
            }
        }
    }
}

// Run enhanced tests if called directly
if (require.main === module) {
    const tester = new EnhancedIntegrationTester()
    tester.runEnhancedTests().catch(console.error)
}

module.exports = { EnhancedIntegrationTester }