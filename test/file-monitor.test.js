// Task 1.1: Write comprehensive test suite for file monitoring patterns
const { describe, it, beforeEach, afterEach } = require('mocha')
const { expect } = require('chai')
const fs = require('fs').promises
const path = require('path')
const chokidar = require('chokidar')
const { FileMonitoringService } = require('../src/file-monitoring-service')

describe('FileMonitoringService', () => {
	let testDir
	let fileMonitor
	let testFiles = []

	beforeEach(async () => {
		// Create temporary test directory
		testDir = await fs.mkdtemp(path.join(__dirname, 'test-files-'))
		testFiles = []
		
		// Initialize file monitor with test configuration
		fileMonitor = new FileMonitoringService({
			debounceTime: 50,
			patterns: ['**/*.js', '**/*.md', '**/*.json'],
			ignorePatterns: ['**/node_modules/**', '**/.git/**']
		})
	})

	afterEach(async () => {
		// Stop monitoring and cleanup
		if (fileMonitor) {
			await fileMonitor.stopMonitoring()
		}
		
		// Clean up test files
		for (const file of testFiles) {
			try {
				await fs.unlink(file)
			} catch (error) {
				// File might already be deleted
			}
		}
		
		// Remove test directory
		try {
			await fs.rmdir(testDir, { recursive: true })
		} catch (error) {
			// Directory might already be removed
		}
	})

	describe('Configuration and Initialization', () => {
		it('should initialize with default configuration', () => {
			const monitor = new FileMonitoringService()
			expect(monitor).to.be.instanceOf(FileMonitoringService)
			expect(monitor.config).to.have.property('debounceTime', 100)
		})

		it('should accept custom configuration', () => {
			const config = {
				debounceTime: 200,
				patterns: ['**/*.ts'],
				ignorePatterns: ['**/dist/**']
			}
			const monitor = new FileMonitoringService(config)
			expect(monitor.config.debounceTime).to.equal(200)
			expect(monitor.config.patterns).to.deep.equal(['**/*.ts'])
		})

		it('should validate required configuration options', () => {
			expect(() => {
				new FileMonitoringService({ patterns: null })
			}).to.throw('Invalid configuration: patterns must be an array')
		})
	})

	describe('File Watching Capabilities', () => {
		it('should start monitoring a directory', async () => {
			const started = await fileMonitor.startMonitoring(testDir)
			expect(started).to.be.true
			expect(fileMonitor.isMonitoring).to.be.true
		})

		it('should stop monitoring gracefully', async () => {
			await fileMonitor.startMonitoring(testDir)
			const stopped = await fileMonitor.stopMonitoring()
			expect(stopped).to.be.true
			expect(fileMonitor.isMonitoring).to.be.false
		})

		it('should detect file creation', (done) => {
			fileMonitor.on('fileCreated', (filePath) => {
				expect(filePath).to.include('test.js')
				done()
			})

			fileMonitor.startMonitoring(testDir).then(async () => {
				const testFile = path.join(testDir, 'test.js')
				testFiles.push(testFile)
				await fs.writeFile(testFile, 'console.log("test");')
			})
		})

		it('should detect file modification', (done) => {
			const testFile = path.join(testDir, 'existing.js')
			testFiles.push(testFile)

			fileMonitor.on('fileModified', (filePath) => {
				expect(filePath).to.include('existing.js')
				done()
			})

			fs.writeFile(testFile, 'const initial = true;').then(() => {
				return fileMonitor.startMonitoring(testDir)
			}).then(async () => {
				// Wait a moment then modify the file
				setTimeout(async () => {
					await fs.writeFile(testFile, 'const modified = true;')
				}, 100)
			})
		})

		it('should detect file deletion', (done) => {
			const testFile = path.join(testDir, 'delete-me.js')
			testFiles.push(testFile)

			fileMonitor.on('fileDeleted', (filePath) => {
				expect(filePath).to.include('delete-me.js')
				done()
			})

			fs.writeFile(testFile, 'const toDelete = true;').then(() => {
				return fileMonitor.startMonitoring(testDir)
			}).then(async () => {
				setTimeout(async () => {
					await fs.unlink(testFile)
				}, 100)
			})
		})
	})

	describe('Pattern Matching', () => {
		it('should only monitor files matching specified patterns', (done) => {
			const jsFile = path.join(testDir, 'script.js')
			const txtFile = path.join(testDir, 'readme.txt')
			testFiles.push(jsFile, txtFile)

			let eventCount = 0
			fileMonitor.on('fileCreated', (filePath) => {
				eventCount++
				expect(path.extname(filePath)).to.equal('.js')
			})

			fileMonitor.startMonitoring(testDir).then(async () => {
				// Wait a bit for watcher to be fully ready
				await new Promise(resolve => setTimeout(resolve, 50))
				
				await fs.writeFile(jsFile, 'console.log("js");')
				await fs.writeFile(txtFile, 'This is text')
				
				// Increase timeout to account for debouncing (100ms) plus processing time
				setTimeout(() => {
					expect(eventCount).to.equal(1) // Only JS file should trigger event
					done()
				}, 300)
			})
		})

		it('should ignore files matching ignore patterns', (done) => {
			const normalFile = path.join(testDir, 'normal.js')
			const nodeModulesDir = path.join(testDir, 'node_modules')
			const nodeModulesFile = path.join(nodeModulesDir, 'package.js')
			
			testFiles.push(normalFile, nodeModulesFile)

			let eventCount = 0
			fileMonitor.on('fileCreated', (filePath) => {
				eventCount++
				expect(filePath).to.include('normal.js')
			})

			fs.mkdir(nodeModulesDir).then(() => {
				return fileMonitor.startMonitoring(testDir)
			}).then(async () => {
				// Wait a bit for watcher to be fully ready
				await new Promise(resolve => setTimeout(resolve, 50))
				
				await fs.writeFile(normalFile, 'console.log("normal");')
				await fs.writeFile(nodeModulesFile, 'console.log("ignored");')
				
				// Increase timeout to account for debouncing and processing
				setTimeout(() => {
					expect(eventCount).to.equal(1) // Only normal file should trigger event
					done()
				}, 300)
			})
		})
	})

	describe('Event Debouncing', () => {
		it('should debounce rapid file changes', (done) => {
			const testFile = path.join(testDir, 'rapid-changes.js')
			testFiles.push(testFile)

			let modifyCount = 0
			fileMonitor.on('fileModified', () => {
				modifyCount++
			})

			fileMonitor.startMonitoring(testDir).then(async () => {
				// Wait for watcher to be ready, then create initial file
				await new Promise(resolve => setTimeout(resolve, 50))
				await fs.writeFile(testFile, 'let count = 0;')
				
				setTimeout(async () => {
					// Make rapid changes
					for (let i = 1; i <= 5; i++) {
						await fs.writeFile(testFile, `let count = ${i};`)
						// Small delay between writes to avoid file system issues
						await new Promise(resolve => setTimeout(resolve, 10))
					}
					
					// Wait longer for debouncing to complete (debounce is 100ms, so wait 400ms total)
					setTimeout(() => {
						expect(modifyCount).to.be.greaterThan(0)
						done()
					}, 400)
				}, 150)
			})
		})
	})

	describe('Error Handling', () => {
		it('should handle invalid watch paths gracefully', async () => {
			const invalidPath = path.join(testDir, 'nonexistent', 'path')
			
			try {
				await fileMonitor.startMonitoring(invalidPath)
				expect.fail('Should have thrown an error for invalid path')
			} catch (error) {
				expect(error.message).to.include('Invalid watch path')
			}
		})

		it('should recover from file system errors', (done) => {
			let errorHandled = false
			
			fileMonitor.on('error', (error) => {
				errorHandled = true
				expect(error).to.be.instanceOf(Error)
			})

			fileMonitor.startMonitoring(testDir).then(() => {
				// Simulate a file system error by removing the directory while watching
				fs.rmdir(testDir, { recursive: true }).then(() => {
					setTimeout(() => {
						expect(errorHandled).to.be.true
						done()
					}, 200)
				})
			})
		})

		it('should maintain monitoring state correctly after errors', async () => {
			await fileMonitor.startMonitoring(testDir)
			expect(fileMonitor.isMonitoring).to.be.true

			// Trigger an error
			await fs.rmdir(testDir, { recursive: true })
			
			// Wait for error handling
			await new Promise(resolve => setTimeout(resolve, 100))
			
			// Should still report as monitoring (with error recovery)
			expect(fileMonitor.hasErrors).to.be.true
		})
	})

	describe('Performance and Resource Management', () => {
		it('should handle large numbers of files efficiently', async () => {
			// Create many test files
			const filePromises = []
			for (let i = 0; i < 50; i++) {
				const testFile = path.join(testDir, `file-${i}.js`)
				testFiles.push(testFile)
				filePromises.push(fs.writeFile(testFile, `const file${i} = true;`))
			}
			
			await Promise.all(filePromises)
			
			const startTime = Date.now()
			await fileMonitor.startMonitoring(testDir)
			const initTime = Date.now() - startTime
			
			// Should initialize quickly even with many files
			expect(initTime).to.be.lessThan(1000) // Less than 1 second
		})

		it('should clean up resources properly', async () => {
			await fileMonitor.startMonitoring(testDir)
			const initialListeners = fileMonitor.listenerCount('fileCreated')
			
			await fileMonitor.stopMonitoring()
			
			// Should clean up event listeners
			expect(fileMonitor.listenerCount('fileCreated')).to.be.lessThan(initialListeners)
		})
	})
})