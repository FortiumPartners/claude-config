/**
 * TDD Phase Tracker
 *
 * Tracks Test-Driven Development phase progression through RED → GREEN → REFACTOR.
 * Validates phase transitions and updates session state.
 *
 * @module lib/deep-debugger/strategy/tdd-phase-tracker
 */

class TDDPhaseTracker {
  /**
   * Create a TDD phase tracker
   *
   * @param {Object} [options] - Configuration options
   * @param {Function} [options.onPhaseChange] - Callback for phase changes
   * @param {Function} [options.logger] - Logger function
   */
  constructor(options = {}) {
    this.onPhaseChange = options.onPhaseChange || null;
    this.logger = options.logger || console.log;

    // Valid TDD phases
    this.validPhases = ['red', 'green', 'refactor', 'complete'];

    // Valid phase transitions
    this.validTransitions = {
      'red': ['green'],                    // Can only go to GREEN after RED
      'green': ['refactor', 'complete'],   // Can refactor or complete after GREEN
      'refactor': ['green', 'complete'],   // Can iterate or complete after REFACTOR
      'complete': []                       // Terminal state
    };

    // Phase descriptions
    this.phaseDescriptions = {
      'red': 'Bug recreation test failing (RED phase)',
      'green': 'Implementing minimal fix to pass test (GREEN phase)',
      'refactor': 'Improving code quality while maintaining tests (REFACTOR phase)',
      'complete': 'TDD cycle complete, all tests passing'
    };
  }

  /**
   * Initialize TDD tracking for fix implementation
   *
   * @param {string} sessionId - Debugging session ID
   * @param {string} bugId - Bug identifier
   * @returns {Object} Initial TDD state
   * @returns {string} return.sessionId - Session ID
   * @returns {string} return.bugId - Bug ID
   * @returns {string} return.currentPhase - Current phase (always 'red')
   * @returns {Object[]} return.phaseHistory - Phase transition history
   * @returns {number} return.startedAt - Timestamp when tracking started
   */
  initializeTracking(sessionId, bugId) {
    if (!sessionId) {
      throw new Error('Session ID is required');
    }
    if (!bugId) {
      throw new Error('Bug ID is required');
    }

    const now = Date.now();

    return {
      sessionId,
      bugId,
      currentPhase: 'red',  // Always start at RED (test failing)
      phaseHistory: [
        {
          phase: 'red',
          enteredAt: now,
          description: this.phaseDescriptions['red']
        }
      ],
      startedAt: now,
      completedAt: null
    };
  }

  /**
   * Transition to next TDD phase
   *
   * @param {Object} tddState - Current TDD state
   * @param {string} nextPhase - Phase to transition to
   * @param {Object} [metadata] - Optional metadata about transition
   * @returns {Object} Updated TDD state
   * @throws {Error} If transition is invalid
   */
  transitionPhase(tddState, nextPhase, metadata = {}) {
    if (!tddState) {
      throw new Error('TDD state is required');
    }
    if (!nextPhase) {
      throw new Error('Next phase is required');
    }

    const currentPhase = tddState.currentPhase;

    // Validate phase
    if (!this.validPhases.includes(nextPhase)) {
      throw new Error(`Invalid phase: ${nextPhase}. Valid phases: ${this.validPhases.join(', ')}`);
    }

    // Validate transition
    if (!this.isValidTransition(currentPhase, nextPhase)) {
      throw new Error(
        `Invalid transition from ${currentPhase} to ${nextPhase}. ` +
        `Valid transitions: ${this.validTransitions[currentPhase].join(', ')}`
      );
    }

    const now = Date.now();

    // Create new phase history entry
    const phaseEntry = {
      phase: nextPhase,
      enteredAt: now,
      description: this.phaseDescriptions[nextPhase],
      metadata
    };

    // Update state
    const updatedState = {
      ...tddState,
      currentPhase: nextPhase,
      phaseHistory: [...tddState.phaseHistory, phaseEntry],
      completedAt: nextPhase === 'complete' ? now : null
    };

    // Log transition
    this.logPhaseTransition(currentPhase, nextPhase, metadata);

    // Call phase change callback if provided
    if (this.onPhaseChange) {
      this.onPhaseChange(currentPhase, nextPhase, updatedState);
    }

    return updatedState;
  }

  /**
   * Check if phase transition is valid
   *
   * @param {string} currentPhase - Current phase
   * @param {string} nextPhase - Proposed next phase
   * @returns {boolean} True if transition is valid
   */
  isValidTransition(currentPhase, nextPhase) {
    if (!this.validPhases.includes(currentPhase)) {
      return false;
    }
    if (!this.validPhases.includes(nextPhase)) {
      return false;
    }

    const allowedTransitions = this.validTransitions[currentPhase];
    return allowedTransitions.includes(nextPhase);
  }

  /**
   * Get current phase status
   *
   * @param {Object} tddState - TDD state
   * @returns {Object} Phase status
   * @returns {string} return.currentPhase - Current phase
   * @returns {string} return.description - Phase description
   * @returns {number} return.duration - Time in current phase (ms)
   * @returns {string[]} return.nextPhases - Allowed next phases
   * @returns {boolean} return.isComplete - Whether TDD cycle is complete
   */
  getPhaseStatus(tddState) {
    if (!tddState) {
      throw new Error('TDD state is required');
    }

    const currentPhase = tddState.currentPhase;
    const currentEntry = tddState.phaseHistory[tddState.phaseHistory.length - 1];
    const duration = Date.now() - currentEntry.enteredAt;

    return {
      currentPhase,
      description: this.phaseDescriptions[currentPhase],
      duration,
      nextPhases: this.validTransitions[currentPhase],
      isComplete: currentPhase === 'complete'
    };
  }

  /**
   * Get phase history summary
   *
   * @param {Object} tddState - TDD state
   * @returns {Object} History summary
   * @returns {number} return.totalDuration - Total time across all phases (ms)
   * @returns {Object} return.phaseDurations - Time spent in each phase
   * @returns {number} return.phaseCount - Number of phase transitions
   * @returns {string[]} return.phaseSequence - Sequence of phases
   */
  getPhaseHistory(tddState) {
    if (!tddState) {
      throw new Error('TDD state is required');
    }

    const history = tddState.phaseHistory;
    const phaseDurations = {};
    const phaseSequence = [];

    for (let i = 0; i < history.length; i++) {
      const entry = history[i];
      const nextEntry = history[i + 1];

      // Calculate duration in this phase
      const duration = nextEntry
        ? nextEntry.enteredAt - entry.enteredAt
        : Date.now() - entry.enteredAt;

      // Accumulate duration for this phase
      if (!phaseDurations[entry.phase]) {
        phaseDurations[entry.phase] = 0;
      }
      phaseDurations[entry.phase] += duration;

      phaseSequence.push(entry.phase);
    }

    const totalDuration = tddState.completedAt
      ? tddState.completedAt - tddState.startedAt
      : Date.now() - tddState.startedAt;

    return {
      totalDuration,
      phaseDurations,
      phaseCount: history.length,
      phaseSequence
    };
  }

  /**
   * Validate TDD state structure
   *
   * @param {Object} tddState - TDD state to validate
   * @returns {Object} Validation result
   * @returns {boolean} return.valid - Whether state is valid
   * @returns {string[]} return.errors - Validation errors if any
   */
  validateState(tddState) {
    const errors = [];

    if (!tddState) {
      return { valid: false, errors: ['TDD state is null or undefined'] };
    }

    // Check required fields
    if (!tddState.sessionId) errors.push('Missing sessionId');
    if (!tddState.bugId) errors.push('Missing bugId');
    if (!tddState.currentPhase) errors.push('Missing currentPhase');
    if (!tddState.phaseHistory) errors.push('Missing phaseHistory');
    if (!tddState.startedAt) errors.push('Missing startedAt');

    // Validate current phase
    if (tddState.currentPhase && !this.validPhases.includes(tddState.currentPhase)) {
      errors.push(`Invalid currentPhase: ${tddState.currentPhase}`);
    }

    // Validate phase history
    if (tddState.phaseHistory && !Array.isArray(tddState.phaseHistory)) {
      errors.push('phaseHistory must be an array');
    } else if (tddState.phaseHistory && tddState.phaseHistory.length === 0) {
      errors.push('phaseHistory must not be empty');
    }

    // Validate completedAt (should only be set if phase is complete)
    if (tddState.completedAt && tddState.currentPhase !== 'complete') {
      errors.push('completedAt should only be set when phase is complete');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Log phase transition
   *
   * @param {string} fromPhase - Previous phase
   * @param {string} toPhase - New phase
   * @param {Object} metadata - Transition metadata
   * @private
   */
  logPhaseTransition(fromPhase, toPhase, metadata) {
    const message = `TDD Phase Transition: ${fromPhase.toUpperCase()} → ${toPhase.toUpperCase()}`;

    if (this.logger) {
      this.logger(message, metadata);
    }
  }

  /**
   * Generate TodoWrite checkboxes for TDD phases
   *
   * @param {Object} tddState - TDD state
   * @returns {Object[]} TodoWrite todo items
   */
  generateTodoCheckboxes(tddState) {
    if (!tddState) {
      throw new Error('TDD state is required');
    }

    const currentPhase = tddState.currentPhase;
    const todos = [];

    // RED phase
    todos.push({
      content: 'Bug recreation test failing (RED phase)',
      status: this.getCheckboxStatus('red', currentPhase),
      activeForm: 'Verifying test failure'
    });

    // GREEN phase
    todos.push({
      content: 'Implement minimal fix to pass test (GREEN phase)',
      status: this.getCheckboxStatus('green', currentPhase),
      activeForm: 'Implementing fix'
    });

    // REFACTOR phase
    todos.push({
      content: 'Improve code quality while maintaining tests (REFACTOR phase)',
      status: this.getCheckboxStatus('refactor', currentPhase),
      activeForm: 'Refactoring code'
    });

    // COMPLETE
    todos.push({
      content: 'TDD cycle complete, all tests passing',
      status: this.getCheckboxStatus('complete', currentPhase),
      activeForm: 'Completing TDD cycle'
    });

    return todos;
  }

  /**
   * Determine checkbox status for phase
   *
   * @param {string} phase - Phase to check
   * @param {string} currentPhase - Current phase
   * @returns {string} Status (completed, in_progress, pending)
   * @private
   */
  getCheckboxStatus(phase, currentPhase) {
    const phaseOrder = ['red', 'green', 'refactor', 'complete'];
    const phaseIndex = phaseOrder.indexOf(phase);
    const currentIndex = phaseOrder.indexOf(currentPhase);

    if (phaseIndex < currentIndex) {
      return 'completed';
    } else if (phaseIndex === currentIndex) {
      return 'in_progress';
    } else {
      return 'pending';
    }
  }
}

module.exports = TDDPhaseTracker;
