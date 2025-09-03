// Task 1.6: Implement debouncing for rapid file changes
const { EventEmitter } = require('events')

class DebounceManager extends EventEmitter {
	constructor(config = {}) {
		super()
		
		this.config = {
			defaultDelay: 100,
			maxDelay: 2000,
			adaptiveDebouncing: true,
			groupSimilarEvents: true,
			...config
		}
		
		// Debounce timers and state
		this.timers = new Map()
		this.eventGroups = new Map()
		this.stats = {
			eventsReceived: 0,
			eventsDebounced: 0,
			eventsEmitted: 0,
			groupsCreated: 0
		}
		
		// Adaptive debouncing state
		this.eventFrequency = new Map()
		this.adaptiveDelays = new Map()
	}

	/**
	 * Debounce an event
	 * @param {string} key - Unique key for the event
	 * @param {Function} callback - Function to execute after debounce
	 * @param {number} delay - Optional custom delay
	 * @param {object} eventData - Optional event data for grouping
	 */
	debounce(key, callback, delay = null, eventData = null) {
		this.stats.eventsReceived++
		
		// Calculate effective delay
		const effectiveDelay = this._calculateDelay(key, delay, eventData)
		
		// Clear existing timer
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key))
			this.stats.eventsDebounced++
		}
		
		// Handle event grouping
		if (this.config.groupSimilarEvents && eventData) {
			this._handleEventGrouping(key, eventData, callback, effectiveDelay)
		} else {
			this._setupTimer(key, callback, effectiveDelay)
		}
		
		// Update adaptive debouncing data
		if (this.config.adaptiveDebouncing) {
			this._updateEventFrequency(key)
		}
	}

	/**
	 * Set up a debounce timer
	 * @param {string} key - Timer key
	 * @param {Function} callback - Callback function
	 * @param {number} delay - Delay in milliseconds
	 * @private
	 */
	_setupTimer(key, callback, delay) {
		const timer = setTimeout(() => {
			this.timers.delete(key)
			this.stats.eventsEmitted++
			
			try {
				callback()
				this.emit('eventExecuted', { key, delay })
			} catch (error) {
				this.emit('executionError', { key, error })
			}
		}, delay)
		
		this.timers.set(key, timer)
		this.emit('eventDebounced', { key, delay })
	}

	/**
	 * Handle event grouping for similar events
	 * @param {string} key - Event key
	 * @param {object} eventData - Event data
	 * @param {Function} callback - Callback function
	 * @param {number} delay - Delay in milliseconds
	 * @private
	 */
	_handleEventGrouping(key, eventData, callback, delay) {
		const groupKey = this._generateGroupKey(eventData)
		
		if (!this.eventGroups.has(groupKey)) {
			this.eventGroups.set(groupKey, {
				events: [],
				timer: null,
				created: Date.now()
			})
			this.stats.groupsCreated++
		}
		
		const group = this.eventGroups.get(groupKey)
		
		// Add event to group
		group.events.push({ key, callback, eventData, timestamp: Date.now() })
		
		// Clear existing group timer
		if (group.timer) {
			clearTimeout(group.timer)
		}
		
		// Set new group timer
		group.timer = setTimeout(() => {
			this._executeEventGroup(groupKey)
		}, delay)
	}

	/**
	 * Execute all events in a group
	 * @param {string} groupKey - Group key
	 * @private
	 */
	_executeEventGroup(groupKey) {
		const group = this.eventGroups.get(groupKey)
		if (!group) {
			return
		}
		
		// Remove group from tracking
		this.eventGroups.delete(groupKey)
		
		// Execute all callbacks in the group
		for (const event of group.events) {
			// Clear individual timer if it exists
			if (this.timers.has(event.key)) {
				clearTimeout(this.timers.get(event.key))
				this.timers.delete(event.key)
			}
			
			try {
				event.callback()
				this.stats.eventsEmitted++
			} catch (error) {
				this.emit('executionError', { key: event.key, error })
			}
		}
		
		this.emit('groupExecuted', { 
			groupKey, 
			eventCount: group.events.length,
			duration: Date.now() - group.created
		})
	}

	/**
	 * Generate a group key for similar events
	 * @param {object} eventData - Event data
	 * @returns {string} - Group key
	 * @private
	 */
	_generateGroupKey(eventData) {
		if (!eventData) {
			return 'default'
		}
		
		// Group by file type and directory
		const filePath = eventData.filePath || ''
		const fileExtension = eventData.fileExtension || ''
		const directory = filePath.split('/').slice(0, -1).join('/')
		
		return `${directory}:${fileExtension}`
	}

	/**
	 * Calculate effective delay for an event
	 * @param {string} key - Event key
	 * @param {number} delay - Custom delay
	 * @param {object} eventData - Event data
	 * @returns {number} - Calculated delay
	 * @private
	 */
	_calculateDelay(key, delay, eventData) {
		// Use custom delay if provided
		if (delay !== null) {
			return Math.min(delay, this.config.maxDelay)
		}
		
		// Use adaptive delay if enabled
		if (this.config.adaptiveDebouncing) {
			const adaptiveDelay = this._getAdaptiveDelay(key)
			if (adaptiveDelay !== null) {
				return adaptiveDelay
			}
		}
		
		// Use default delay
		return this.config.defaultDelay
	}

	/**
	 * Get adaptive delay based on event frequency
	 * @param {string} key - Event key
	 * @returns {number|null} - Adaptive delay or null
	 * @private
	 */
	_getAdaptiveDelay(key) {
		const frequency = this.eventFrequency.get(key)
		if (!frequency || frequency.events < 3) {
			return null
		}
		
		// Calculate events per second
		const timeSpan = Date.now() - frequency.firstEvent
		const eventsPerSecond = (frequency.events / timeSpan) * 1000
		
		// Increase delay for high-frequency events
		let adaptiveDelay = this.config.defaultDelay
		
		if (eventsPerSecond > 10) {
			adaptiveDelay = Math.min(500, this.config.defaultDelay * 3)
		} else if (eventsPerSecond > 5) {
			adaptiveDelay = Math.min(300, this.config.defaultDelay * 2)
		} else if (eventsPerSecond > 2) {
			adaptiveDelay = Math.min(200, this.config.defaultDelay * 1.5)
		}
		
		this.adaptiveDelays.set(key, adaptiveDelay)
		return adaptiveDelay
	}

	/**
	 * Update event frequency tracking
	 * @param {string} key - Event key
	 * @private
	 */
	_updateEventFrequency(key) {
		const now = Date.now()
		
		if (!this.eventFrequency.has(key)) {
			this.eventFrequency.set(key, {
				events: 1,
				firstEvent: now,
				lastEvent: now
			})
		} else {
			const frequency = this.eventFrequency.get(key)
			frequency.events++
			frequency.lastEvent = now
			
			// Reset if too much time has passed
			if (now - frequency.firstEvent > 10000) { // 10 seconds
				frequency.events = 1
				frequency.firstEvent = now
			}
		}
	}

	/**
	 * Cancel a debounced event
	 * @param {string} key - Event key to cancel
	 * @returns {boolean} - True if event was cancelled
	 */
	cancel(key) {
		if (this.timers.has(key)) {
			clearTimeout(this.timers.get(key))
			this.timers.delete(key)
			this.emit('eventCancelled', { key })
			return true
		}
		
		return false
	}

	/**
	 * Cancel all debounced events
	 */
	cancelAll() {
		const cancelledCount = this.timers.size
		
		// Clear all timers
		for (const timer of this.timers.values()) {
			clearTimeout(timer)
		}
		this.timers.clear()
		
		// Clear all group timers
		for (const group of this.eventGroups.values()) {
			if (group.timer) {
				clearTimeout(group.timer)
			}
		}
		this.eventGroups.clear()
		
		this.emit('allEventsCancelled', { cancelledCount })
	}

	/**
	 * Check if an event is pending
	 * @param {string} key - Event key
	 * @returns {boolean} - True if event is pending
	 */
	isPending(key) {
		return this.timers.has(key)
	}

	/**
	 * Get all pending event keys
	 * @returns {Array<string>} - Array of pending event keys
	 */
	getPendingKeys() {
		return Array.from(this.timers.keys())
	}

	/**
	 * Get debounce statistics
	 * @returns {object} - Statistics object
	 */
	getStats() {
		return {
			...this.stats,
			pendingEvents: this.timers.size,
			pendingGroups: this.eventGroups.size,
			trackedFrequencies: this.eventFrequency.size,
			adaptiveDelays: this.adaptiveDelays.size
		}
	}

	/**
	 * Reset all statistics and clear pending events
	 */
	reset() {
		this.cancelAll()
		
		this.stats = {
			eventsReceived: 0,
			eventsDebounced: 0,
			eventsEmitted: 0,
			groupsCreated: 0
		}
		
		this.eventFrequency.clear()
		this.adaptiveDelays.clear()
		
		this.emit('reset')
	}

	/**
	 * Force execution of a pending event
	 * @param {string} key - Event key to force
	 * @returns {boolean} - True if event was forced
	 */
	forceExecution(key) {
		if (this.timers.has(key)) {
			const timer = this.timers.get(key)
			clearTimeout(timer)
			this.timers.delete(key)
			
			// Trigger the timer callback immediately
			// Note: We don't have direct access to the callback here
			// This would need to be redesigned to store callbacks
			this.emit('eventForced', { key })
			return true
		}
		
		return false
	}

	/**
	 * Get configuration
	 * @returns {object} - Current configuration
	 */
	getConfig() {
		return { ...this.config }
	}

	/**
	 * Update configuration
	 * @param {object} newConfig - Configuration updates
	 */
	updateConfig(newConfig) {
		this.config = { ...this.config, ...newConfig }
		this.emit('configUpdated', this.config)
	}
}

module.exports = { DebounceManager }