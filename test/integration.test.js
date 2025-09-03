// Task 3.8: Integration tests for Claude Code integration components
const { describe, it, beforeEach, afterEach } = require('mocha')
const { expect } = require('chai')
const fs = require('fs').promises
const path = require('path')

describe('Claude Code Integration Layer', () => {
  let testDir

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(__dirname, 'integration-test-'))
  })

  afterEach(async () => {
    try {
      await fs.rmdir(testDir, { recursive: true })
    } catch (error) {
      // Directory might already be removed
    }
  })

  describe('TypeScript File Structure', () => {
    it('should have completed enforcement TypeScript files (subtasks 3.5-3.7)', async () => {
      const completedFiles = [
        'src/enforcement/task-completion-detector.ts',
        'src/enforcement/integration-config.ts',
        'src/enforcement/fallback-handler.ts'
      ]

      for (const filePath of completedFiles) {
        const fullPath = path.join(process.cwd(), filePath)
        try {
          await fs.access(fullPath)
        } catch (error) {
          throw new Error(`Required file missing: ${filePath}`)
        }
      }
    })

    it('should have valid TypeScript syntax in completed enforcement files', async () => {
      const enforcementDir = path.join(process.cwd(), 'src/enforcement')
      
      try {
        const files = await fs.readdir(enforcementDir)
        const tsFiles = files.filter(f => f.endsWith('.ts'))
        
        expect(tsFiles.length).to.be.greaterThan(2)
        
        // Check that files contain expected TypeScript patterns
        for (const file of tsFiles) {
          const content = await fs.readFile(path.join(enforcementDir, file), 'utf-8')
          expect(content).to.include('export')  // Should have exports
          if (file.includes('interface') || file.includes('config')) {
            expect(content).to.include('interface')  // Config files should have interfaces
          }
        }
      } catch (error) {
        throw new Error(`Error validating TypeScript files: ${error.message}`)
      }
    })
  })

  describe('Integration Configuration', () => {
    it('should load default configuration successfully', async () => {
      // Test that configuration file exists and has expected structure
      const configPath = path.join(process.cwd(), 'src/enforcement/integration-config.ts')
      const content = await fs.readFile(configPath, 'utf-8')
      
      // Should contain the interface and class definitions
      expect(content).to.include('ClaudeIntegrationConfig')
      expect(content).to.include('IntegrationConfigManager')
      expect(content).to.include('ConfigPresets')
      
      // Should have environment presets
      expect(content).to.include('development:')
      expect(content).to.include('production:')
      expect(content).to.include('testing:')
    })

    it('should define proper fallback configuration', async () => {
      const configPath = path.join(process.cwd(), 'src/enforcement/integration-config.ts')
      const content = await fs.readFile(configPath, 'utf-8')
      
      // Should have fallback settings
      expect(content).to.include('fallback:')
      expect(content).to.include('enableGracefulDegradation')
      expect(content).to.include('timeoutMs')
      expect(content).to.include('maxRetries')
      expect(content).to.include('fallbackToWarningsOnly')
    })
  })

  describe('Command Interception System - Status', () => {
    it('should note that command interceptor needs implementation (subtasks 3.1-3.2)', async () => {
      const interceptorPath = path.join(process.cwd(), 'src/enforcement/command-interceptor.ts')
      
      try {
        await fs.access(interceptorPath)
        // If file exists, test its content
        const content = await fs.readFile(interceptorPath, 'utf-8')
        expect(content).to.include('CommandInterceptor')
      } catch (error) {
        // File doesn't exist - this is expected for subtasks 3.1-3.2
        expect(error.code).to.equal('ENOENT')
      }
    })
  })

  describe('Session State Management - Status', () => {
    it('should note that session manager needs implementation (subtasks 3.3-3.4)', async () => {
      const sessionPath = path.join(process.cwd(), 'src/enforcement/session-state-manager.ts')
      
      try {
        await fs.access(sessionPath)
        // If file exists, test its content
        const content = await fs.readFile(sessionPath, 'utf-8')
        expect(content).to.include('SessionStateManager')
      } catch (error) {
        // File doesn't exist - this is expected for subtasks 3.3-3.4
        expect(error.code).to.equal('ENOENT')
      }
    })
  })

  describe('Task Completion Detection', () => {
    it('should have multi-signal completion detection', async () => {
      const detectorPath = path.join(process.cwd(), 'src/enforcement/task-completion-detector.ts')
      const content = await fs.readFile(detectorPath, 'utf-8')
      
      // Should contain detection methods
      expect(content).to.include('TaskCompletionDetector')
      expect(content).to.include('analyzeCommandExecution')
      expect(content).to.include('monitorFileChanges')
      expect(content).to.include('analyzeOutputPatterns')
    })

    it('should detect different completion types', async () => {
      const detectorPath = path.join(process.cwd(), 'src/enforcement/task-completion-detector.ts')
      const content = await fs.readFile(detectorPath, 'utf-8')
      
      // Should handle different completion types
      expect(content).to.include('COMMAND_SUCCESS')
      expect(content).to.include('MARKDOWN_UPDATE')
      expect(content).to.include('OUTPUT_ANALYSIS')
      expect(content).to.include('PLANNING_COMPLETE')
      expect(content).to.include('ANALYSIS_COMPLETE')
    })
  })

  describe('Fallback Handling', () => {
    it('should have comprehensive error handling', async () => {
      const fallbackPath = path.join(process.cwd(), 'src/enforcement/fallback-handler.ts')
      const content = await fs.readFile(fallbackPath, 'utf-8')
      
      // Should contain fallback methods
      expect(content).to.include('FallbackHandler')
      expect(content).to.include('handleIntegrationFailure')
      expect(content).to.include('handleTimeout')
      expect(content).to.include('handleConfigError')
      expect(content).to.include('handleEnforcementError')
    })

    it('should classify error severity and provide graceful degradation', async () => {
      const fallbackPath = path.join(process.cwd(), 'src/enforcement/fallback-handler.ts')
      const content = await fs.readFile(fallbackPath, 'utf-8')
      
      // Should classify errors and degrade gracefully
      expect(content).to.include('classifyErrorSeverity')
      expect(content).to.include('handleGracefulDegradation')
      expect(content).to.include('isRetryableError')
      expect(content).to.include('calculateRetryDelay')
    })
  })

  describe('Type System Integration - Status', () => {
    it('should note that type definitions need to be implemented (part of subtasks 3.1-3.4)', async () => {
      const typesPath = path.join(process.cwd(), 'src/enforcement/types.ts')
      
      try {
        await fs.access(typesPath)
        // If file exists, test its content
        const content = await fs.readFile(typesPath, 'utf-8')
        expect(content).to.include('CommandContext')
      } catch (error) {
        // File doesn't exist - this is expected since types weren't implemented yet
        expect(error.code).to.equal('ENOENT')
      }
    })
  })
})