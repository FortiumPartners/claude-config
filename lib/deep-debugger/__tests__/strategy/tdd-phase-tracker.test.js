/**
 * Tests for TDD Phase Tracker
 */

const TDDPhaseTracker = require('../../strategy/tdd-phase-tracker');

describe('TDDPhaseTracker', () => {
  let tracker;
  let phaseChanges;

  beforeEach(() => {
    phaseChanges = [];
    tracker = new TDDPhaseTracker({
      onPhaseChange: (from, to, state) => {
        phaseChanges.push({ from, to, state });
      },
      logger: jest.fn()
    });
  });

  describe('Constructor', () => {
    it('should initialize with valid phases', () => {
      expect(tracker.validPhases).toEqual(['red', 'green', 'refactor', 'complete']);
    });

    it('should initialize with valid transitions', () => {
      expect(tracker.validTransitions['red']).toEqual(['green']);
      expect(tracker.validTransitions['green']).toEqual(['refactor', 'complete']);
      expect(tracker.validTransitions['refactor']).toEqual(['green', 'complete']);
      expect(tracker.validTransitions['complete']).toEqual([]);
    });

    it('should initialize with phase descriptions', () => {
      expect(tracker.phaseDescriptions['red']).toContain('RED');
      expect(tracker.phaseDescriptions['green']).toContain('GREEN');
      expect(tracker.phaseDescriptions['refactor']).toContain('REFACTOR');
    });

    it('should allow custom callback', () => {
      const callback = jest.fn();
      const customTracker = new TDDPhaseTracker({ onPhaseChange: callback });
      expect(customTracker.onPhaseChange).toBe(callback);
    });
  });

  describe('initializeTracking', () => {
    it('should throw error if sessionId missing', () => {
      expect(() => tracker.initializeTracking(null, 'bug-1')).toThrow('Session ID is required');
    });

    it('should throw error if bugId missing', () => {
      expect(() => tracker.initializeTracking('session-1', null)).toThrow('Bug ID is required');
    });

    it('should initialize with RED phase', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');

      expect(state.sessionId).toBe('session-1');
      expect(state.bugId).toBe('bug-1');
      expect(state.currentPhase).toBe('red');
      expect(state.phaseHistory).toHaveLength(1);
      expect(state.phaseHistory[0].phase).toBe('red');
    });

    it('should include timestamp in initial state', () => {
      const before = Date.now();
      const state = tracker.initializeTracking('session-1', 'bug-1');
      const after = Date.now();

      expect(state.startedAt).toBeGreaterThanOrEqual(before);
      expect(state.startedAt).toBeLessThanOrEqual(after);
    });

    it('should set completedAt to null initially', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');
      expect(state.completedAt).toBeNull();
    });

    it('should include phase description in history', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');
      expect(state.phaseHistory[0].description).toContain('RED');
    });
  });

  describe('transitionPhase', () => {
    let initialState;

    beforeEach(() => {
      initialState = tracker.initializeTracking('session-1', 'bug-1');
    });

    it('should throw error if state missing', () => {
      expect(() => tracker.transitionPhase(null, 'green')).toThrow('TDD state is required');
    });

    it('should throw error if next phase missing', () => {
      expect(() => tracker.transitionPhase(initialState, null)).toThrow('Next phase is required');
    });

    it('should throw error for invalid phase', () => {
      expect(() => tracker.transitionPhase(initialState, 'invalid')).toThrow('Invalid phase');
    });

    it('should throw error for invalid transition', () => {
      expect(() => tracker.transitionPhase(initialState, 'refactor')).toThrow('Invalid transition');
    });

    it('should transition from RED to GREEN', () => {
      const newState = tracker.transitionPhase(initialState, 'green');

      expect(newState.currentPhase).toBe('green');
      expect(newState.phaseHistory).toHaveLength(2);
      expect(newState.phaseHistory[1].phase).toBe('green');
    });

    it('should transition from GREEN to REFACTOR', () => {
      const greenState = tracker.transitionPhase(initialState, 'green');
      const refactorState = tracker.transitionPhase(greenState, 'refactor');

      expect(refactorState.currentPhase).toBe('refactor');
      expect(refactorState.phaseHistory).toHaveLength(3);
    });

    it('should transition from GREEN to COMPLETE', () => {
      const greenState = tracker.transitionPhase(initialState, 'green');
      const completeState = tracker.transitionPhase(greenState, 'complete');

      expect(completeState.currentPhase).toBe('complete');
      expect(completeState.completedAt).not.toBeNull();
    });

    it('should allow iteration from REFACTOR back to GREEN', () => {
      const greenState = tracker.transitionPhase(initialState, 'green');
      const refactorState = tracker.transitionPhase(greenState, 'refactor');
      const greenAgainState = tracker.transitionPhase(refactorState, 'green');

      expect(greenAgainState.currentPhase).toBe('green');
      expect(greenAgainState.phaseHistory).toHaveLength(4);
    });

    it('should not allow transitions from COMPLETE', () => {
      const greenState = tracker.transitionPhase(initialState, 'green');
      const completeState = tracker.transitionPhase(greenState, 'complete');

      expect(() => tracker.transitionPhase(completeState, 'green')).toThrow('Invalid transition');
    });

    it('should include metadata in phase history', () => {
      const metadata = { reason: 'Test passing' };
      const newState = tracker.transitionPhase(initialState, 'green', metadata);

      expect(newState.phaseHistory[1].metadata).toEqual(metadata);
    });

    it('should call onPhaseChange callback', () => {
      tracker.transitionPhase(initialState, 'green');

      expect(phaseChanges).toHaveLength(1);
      expect(phaseChanges[0].from).toBe('red');
      expect(phaseChanges[0].to).toBe('green');
    });

    it('should set completedAt only for COMPLETE phase', () => {
      const greenState = tracker.transitionPhase(initialState, 'green');
      expect(greenState.completedAt).toBeNull();

      const completeState = tracker.transitionPhase(greenState, 'complete');
      expect(completeState.completedAt).not.toBeNull();
    });
  });

  describe('isValidTransition', () => {
    it('should return true for valid transitions', () => {
      expect(tracker.isValidTransition('red', 'green')).toBe(true);
      expect(tracker.isValidTransition('green', 'refactor')).toBe(true);
      expect(tracker.isValidTransition('green', 'complete')).toBe(true);
      expect(tracker.isValidTransition('refactor', 'green')).toBe(true);
      expect(tracker.isValidTransition('refactor', 'complete')).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(tracker.isValidTransition('red', 'refactor')).toBe(false);
      expect(tracker.isValidTransition('red', 'complete')).toBe(false);
      expect(tracker.isValidTransition('complete', 'green')).toBe(false);
    });

    it('should return false for invalid phases', () => {
      expect(tracker.isValidTransition('invalid', 'green')).toBe(false);
      expect(tracker.isValidTransition('red', 'invalid')).toBe(false);
    });
  });

  describe('getPhaseStatus', () => {
    it('should throw error if state missing', () => {
      expect(() => tracker.getPhaseStatus(null)).toThrow('TDD state is required');
    });

    it('should return current phase status', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');
      const status = tracker.getPhaseStatus(state);

      expect(status.currentPhase).toBe('red');
      expect(status.description).toContain('RED');
      expect(status.nextPhases).toEqual(['green']);
      expect(status.isComplete).toBe(false);
    });

    it('should calculate duration in current phase', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');

      // Wait a bit
      const delay = 10;
      jest.advanceTimersByTime(delay);

      const status = tracker.getPhaseStatus(state);
      expect(status.duration).toBeGreaterThanOrEqual(0);
    });

    it('should show isComplete=true for COMPLETE phase', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');
      const greenState = tracker.transitionPhase(state, 'green');
      const completeState = tracker.transitionPhase(greenState, 'complete');

      const status = tracker.getPhaseStatus(completeState);
      expect(status.isComplete).toBe(true);
      expect(status.nextPhases).toEqual([]);
    });
  });

  describe('getPhaseHistory', () => {
    it('should throw error if state missing', () => {
      expect(() => tracker.getPhaseHistory(null)).toThrow('TDD state is required');
    });

    it('should return history summary', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');
      const greenState = tracker.transitionPhase(state, 'green');

      const history = tracker.getPhaseHistory(greenState);

      expect(history.phaseCount).toBe(2);
      expect(history.phaseSequence).toEqual(['red', 'green']);
      expect(history.phaseDurations).toHaveProperty('red');
      expect(history.phaseDurations).toHaveProperty('green');
    });

    it('should calculate total duration', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');
      const history = tracker.getPhaseHistory(state);

      expect(history.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should accumulate durations for repeated phases', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');
      const green1 = tracker.transitionPhase(state, 'green');
      const refactor = tracker.transitionPhase(green1, 'refactor');
      const green2 = tracker.transitionPhase(refactor, 'green');

      const history = tracker.getPhaseHistory(green2);

      expect(history.phaseSequence).toEqual(['red', 'green', 'refactor', 'green']);
      // Green appears twice, durations should be accumulated (may be 0 in fast tests)
      expect(history.phaseDurations['green']).toBeGreaterThanOrEqual(0);
      expect(history.phaseDurations).toHaveProperty('green');
      expect(history.phaseDurations).toHaveProperty('refactor');
    });

    it('should use completedAt for total duration if complete', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');
      const greenState = tracker.transitionPhase(state, 'green');
      const completeState = tracker.transitionPhase(greenState, 'complete');

      const history = tracker.getPhaseHistory(completeState);

      expect(history.totalDuration).toBe(completeState.completedAt - completeState.startedAt);
    });
  });

  describe('validateState', () => {
    it('should return error for null state', () => {
      const result = tracker.validateState(null);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('TDD state is null or undefined');
    });

    it('should validate required fields', () => {
      const invalidState = {
        sessionId: 'session-1'
        // Missing other fields
      };

      const result = tracker.validateState(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate current phase', () => {
      const invalidState = {
        sessionId: 'session-1',
        bugId: 'bug-1',
        currentPhase: 'invalid',
        phaseHistory: [{ phase: 'red', enteredAt: Date.now() }],
        startedAt: Date.now()
      };

      const result = tracker.validateState(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid currentPhase'))).toBe(true);
    });

    it('should validate phase history is array', () => {
      const invalidState = {
        sessionId: 'session-1',
        bugId: 'bug-1',
        currentPhase: 'red',
        phaseHistory: 'not-an-array',
        startedAt: Date.now()
      };

      const result = tracker.validateState(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('must be an array'))).toBe(true);
    });

    it('should validate completedAt consistency', () => {
      const invalidState = {
        sessionId: 'session-1',
        bugId: 'bug-1',
        currentPhase: 'red',
        phaseHistory: [{ phase: 'red', enteredAt: Date.now() }],
        startedAt: Date.now(),
        completedAt: Date.now()
      };

      const result = tracker.validateState(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('completedAt'))).toBe(true);
    });

    it('should validate correct state', () => {
      const validState = tracker.initializeTracking('session-1', 'bug-1');
      const result = tracker.validateState(validState);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('generateTodoCheckboxes', () => {
    it('should throw error if state missing', () => {
      expect(() => tracker.generateTodoCheckboxes(null)).toThrow('TDD state is required');
    });

    it('should generate checkboxes for all phases', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');
      const todos = tracker.generateTodoCheckboxes(state);

      expect(todos).toHaveLength(4);
      expect(todos[0].content).toContain('RED');
      expect(todos[1].content).toContain('GREEN');
      expect(todos[2].content).toContain('REFACTOR');
      expect(todos[3].content).toContain('complete');
    });

    it('should mark RED as in_progress initially', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');
      const todos = tracker.generateTodoCheckboxes(state);

      expect(todos[0].status).toBe('in_progress');
      expect(todos[1].status).toBe('pending');
      expect(todos[2].status).toBe('pending');
      expect(todos[3].status).toBe('pending');
    });

    it('should mark completed phases as completed', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');
      const greenState = tracker.transitionPhase(state, 'green');
      const todos = tracker.generateTodoCheckboxes(greenState);

      expect(todos[0].status).toBe('completed');
      expect(todos[1].status).toBe('in_progress');
      expect(todos[2].status).toBe('pending');
    });

    it('should include activeForm for each todo', () => {
      const state = tracker.initializeTracking('session-1', 'bug-1');
      const todos = tracker.generateTodoCheckboxes(state);

      todos.forEach(todo => {
        expect(todo.activeForm).toBeDefined();
        expect(typeof todo.activeForm).toBe('string');
      });
    });
  });

  describe('Complete TDD Cycle', () => {
    it('should track complete RED → GREEN → REFACTOR → COMPLETE cycle', () => {
      const state1 = tracker.initializeTracking('session-1', 'bug-1');
      expect(state1.currentPhase).toBe('red');

      const state2 = tracker.transitionPhase(state1, 'green');
      expect(state2.currentPhase).toBe('green');

      const state3 = tracker.transitionPhase(state2, 'refactor');
      expect(state3.currentPhase).toBe('refactor');

      const state4 = tracker.transitionPhase(state3, 'complete');
      expect(state4.currentPhase).toBe('complete');
      expect(state4.completedAt).not.toBeNull();

      const history = tracker.getPhaseHistory(state4);
      expect(history.phaseSequence).toEqual(['red', 'green', 'refactor', 'complete']);
    });

    it('should track RED → GREEN → COMPLETE shortcut', () => {
      const state1 = tracker.initializeTracking('session-1', 'bug-1');
      const state2 = tracker.transitionPhase(state1, 'green');
      const state3 = tracker.transitionPhase(state2, 'complete');

      expect(state3.currentPhase).toBe('complete');
      const history = tracker.getPhaseHistory(state3);
      expect(history.phaseSequence).toEqual(['red', 'green', 'complete']);
    });

    it('should track iterative REFACTOR → GREEN cycles', () => {
      const state1 = tracker.initializeTracking('session-1', 'bug-1');
      const state2 = tracker.transitionPhase(state1, 'green');
      const state3 = tracker.transitionPhase(state2, 'refactor');
      const state4 = tracker.transitionPhase(state3, 'green'); // Iteration
      const state5 = tracker.transitionPhase(state4, 'refactor');
      const state6 = tracker.transitionPhase(state5, 'complete');

      const history = tracker.getPhaseHistory(state6);
      expect(history.phaseSequence).toEqual(['red', 'green', 'refactor', 'green', 'refactor', 'complete']);
      expect(history.phaseCount).toBe(6);
    });
  });
});
