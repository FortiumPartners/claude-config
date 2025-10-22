# Agent Integration Module

This directory contains the agent delegation infrastructure for the Deep Debugger TDD workflow.

## AgentDelegator

The `AgentDelegator` class handles delegation to specialist agents using Claude Code's Task tool. It provides timeout handling, error classification, response parsing, and structured prompt generation for GREEN and REFACTOR phases.

---

## Usage in Claude Code Agents

### Quick Start

```javascript
// In a Claude Code agent context (where Task tool is available)
const { createAgentDelegatorWithTaskTool } = require('./integration/agent-delegator');

// Create delegator with Task tool binding
const delegator = createAgentDelegatorWithTaskTool(Task, {
  defaultTimeout: 1800000,  // 30 minutes (optional)
  logger: console.log        // Custom logger (optional)
});

// Delegate GREEN phase fix implementation
const greenResult = await delegator.delegateGreenPhase({
  fixTask: {
    agent: 'backend-developer',
    description: 'Fix authentication bug',
    failingTest: { path: 'test/auth.test.js' },
    rootCause: 'Missing token validation',
    strategy: 'Add JWT validation middleware',
    affectedFiles: ['src/auth.js', 'src/middleware.js']
  },
  tddState: { currentPhase: 'red' },
  sessionId: 'session-123'
});

// Delegate REFACTOR phase code quality improvements
const refactorResult = await delegator.delegateRefactorPhase({
  greenResult: {
    specialist: 'backend-developer',
    codeChanges: greenResult.codeChanges
  },
  tddState: { currentPhase: 'green' },
  sessionId: 'session-123',
  qualityTargets: {
    maxComplexity: 10,
    maxMethodLength: 50,
    codeSmells: ['long-method', 'duplication']
  }
});
```

### Manual Initialization

If you need more control over the Task tool binding:

```javascript
const AgentDelegator = require('./integration/agent-delegator');

const delegator = new AgentDelegator({
  taskTool: async (opts) => {
    // Custom Task tool wrapper
    console.log(`Delegating to ${opts.agent}...`);

    const result = await Task({
      subagent_type: opts.agent,
      description: opts.description,
      prompt: opts.prompt
    });

    console.log(`Delegation complete!`);
    return result;
  },
  defaultTimeout: 1800000,
  logger: customLogger
});
```

---

## API Reference

### `createAgentDelegatorWithTaskTool(TaskTool, options)`

Helper function to create AgentDelegator with Claude Code Task tool binding.

**Parameters**:
- `TaskTool` (Function): The Claude Code Task tool function
- `options` (Object): Optional configuration
  - `defaultTimeout` (number): Default timeout in ms (default: 1800000 / 30 minutes)
  - `logger` (Function): Logging function (default: console.log)

**Returns**: `AgentDelegator` instance

**Example**:
```javascript
const delegator = createAgentDelegatorWithTaskTool(Task, {
  defaultTimeout: 900000,  // 15 minutes
  logger: (msg) => console.log(`[DeepDebugger] ${msg}`)
});
```

---

### `AgentDelegator` Class

#### Constructor

```javascript
new AgentDelegator(options)
```

**Parameters**:
- `options.taskTool` (Function): Task tool function (required for production)
- `options.defaultTimeout` (number): Default timeout in ms
- `options.logger` (Function): Logging function

#### Methods

##### `delegateGreenPhase(context)`

Delegate GREEN phase fix implementation to specialist agent.

**Parameters**:
```javascript
{
  fixTask: {
    agent: string,              // Specialist agent name
    description: string,        // Bug description
    failingTest: Object,        // Failing test details
    rootCause: string,          // Root cause analysis
    strategy: string,           // Fix strategy
    affectedFiles: string[]     // Files to modify
  },
  tddState: {
    currentPhase: 'red'         // Must be 'red' for GREEN phase
  },
  sessionId: string,            // Session identifier
  retryContext: Object          // Optional retry information
}
```

**Returns**:
```javascript
{
  success: boolean,
  fixImplemented: boolean,
  codeChanges: Array,           // Code changes made
  testChanges: Array,           // Test changes made
  testsPass: boolean,           // Whether tests now pass
  fixValidation: Object,        // Test validation results
  implementationTime: number,   // Time taken in ms
  metadata: Object              // Additional metadata
}
```

**Example**:
```javascript
const result = await delegator.delegateGreenPhase({
  fixTask: {
    agent: 'nestjs-backend-expert',
    description: 'Fix null pointer in user service',
    failingTest: {
      path: 'src/users/__tests__/user.service.spec.ts',
      name: 'should handle missing user gracefully'
    },
    rootCause: 'Missing null check before accessing user.profile',
    strategy: 'Add guard clause and proper error handling',
    affectedFiles: ['src/users/user.service.ts']
  },
  tddState: { currentPhase: 'red' },
  sessionId: 'bug-fix-2024-001'
});

if (result.testsPass) {
  console.log('✅ Bug fixed! Tests passing.');
  console.log(`Changes: ${result.codeChanges.length} files modified`);
}
```

##### `delegateRefactorPhase(context)`

Delegate REFACTOR phase code quality improvements.

**Parameters**:
```javascript
{
  greenResult: {
    specialist: string,         // Same specialist from GREEN phase
    codeChanges: Array          // Changes from GREEN phase
  },
  tddState: {
    currentPhase: 'green'       // Must be 'green' for REFACTOR
  },
  sessionId: string,
  qualityTargets: {
    maxComplexity: number,      // Max cyclomatic complexity
    maxMethodLength: number,    // Max method length in lines
    codeSmells: string[]        // Code smells to address
  }
}
```

**Returns**:
```javascript
{
  success: boolean,
  refactored: boolean,
  codeChanges: Array,
  qualityMetrics: {
    cyclomaticComplexity: number,
    maxMethodLength: number,
    codeSmells: string[]
  },
  testsStillPass: boolean,      // CRITICAL: Must be true
  testResults: Object,
  metadata: Object
}
```

**Example**:
```javascript
const refactorResult = await delegator.delegateRefactorPhase({
  greenResult: {
    specialist: 'nestjs-backend-expert',
    codeChanges: greenPhaseResult.codeChanges
  },
  tddState: { currentPhase: 'green' },
  sessionId: 'bug-fix-2024-001',
  qualityTargets: {
    maxComplexity: 8,
    maxMethodLength: 40,
    codeSmells: ['long-method', 'duplication', 'magic-numbers']
  }
});

if (!refactorResult.testsStillPass) {
  console.error('❌ Refactoring broke tests! Reverting...');
  // Revert to GREEN phase implementation
} else {
  console.log('✅ Refactoring complete, tests still passing');
  console.log(`Complexity: ${refactorResult.qualityMetrics.cyclomaticComplexity}`);
}
```

##### `delegate(options)`

Low-level delegation method for custom scenarios.

**Parameters**:
```javascript
{
  agent: string,              // Agent name
  description: string,        // Task description (3-5 words)
  prompt: string,             // Detailed task prompt
  timeout: number             // Timeout in ms (optional)
}
```

**Returns**: Agent response (format depends on agent)

**Example**:
```javascript
const result = await delegator.delegate({
  agent: 'code-reviewer',
  description: 'Review security vulnerabilities',
  prompt: `
# Security Review

Please review the following code changes for security vulnerabilities:
${codeChanges}

Focus on:
- SQL injection risks
- XSS vulnerabilities
- Authentication bypasses
`,
  timeout: 600000  // 10 minutes
});
```

---

## Specialist Agents

Available specialist agents for delegation:

### Backend Specialists
- `backend-developer` - Framework-agnostic backend development
- `nestjs-backend-expert` - NestJS/TypeScript specialist
- `rails-backend-expert` - Ruby on Rails specialist
- `dotnet-backend-expert` - .NET Core/ASP.NET specialist
- `elixir-phoenix-expert` - Elixir/Phoenix specialist

### Frontend Specialists
- `frontend-developer` - Framework-agnostic frontend development
- `react-component-architect` - React specialist
- `dotnet-blazor-expert` - Blazor specialist

### Quality & Review
- `code-reviewer` - Security and quality review
- `test-runner` - Test execution and validation
- `playwright-tester` - E2E testing with Playwright

### Architecture & Planning
- `tech-lead-orchestrator` - Architecture analysis and strategy

---

## Error Handling

The AgentDelegator classifies errors into three types:

1. **Timeout Errors** (`type: 'timeout'`)
   - Delegation exceeded timeout limit
   - Not automatically retryable (requires intervention)

2. **Retryable Errors** (`type: 'retryable'`)
   - Network issues
   - Rate limiting
   - Temporary service unavailability
   - Safe to retry automatically

3. **Non-Retryable Errors** (`type: 'non-retryable'`)
   - Invalid requests
   - Authentication failures
   - Resource not found
   - Should not retry

**Example Error Handling**:
```javascript
try {
  const result = await delegator.delegateGreenPhase(context);
} catch (error) {
  if (error.type === 'timeout') {
    console.error(`Delegation timed out after ${error.duration}ms`);
    // Escalate or increase timeout
  } else if (error.type === 'retryable' && error.retryable) {
    console.log('Retrying delegation...');
    // Retry logic
  } else {
    console.error(`Non-retryable error: ${error.message}`);
    // Handle failure
  }
}
```

---

## Testing

For unit testing, inject a mock taskTool:

```javascript
const AgentDelegator = require('./integration/agent-delegator');

describe('My Agent', () => {
  let delegator;
  let mockTaskTool;

  beforeEach(() => {
    mockTaskTool = jest.fn();
    delegator = new AgentDelegator({
      taskTool: mockTaskTool,
      logger: jest.fn()
    });
  });

  it('should delegate GREEN phase', async () => {
    // Mock response in AgentDelegator format
    mockTaskTool.mockResolvedValue({
      success: true,
      fixImplemented: true,
      codeChanges: [{ filePath: 'src/test.js', changeType: 'modified' }],
      testChanges: [],
      testsPass: true,
      fixValidation: { testsPass: true },
      implementationTime: 5000
    });

    const result = await delegator.delegateGreenPhase({
      fixTask: { agent: 'backend-developer', /* ... */ },
      tddState: { currentPhase: 'red' },
      sessionId: 'test-123'
    });

    expect(result.success).toBe(true);
    expect(mockTaskTool).toHaveBeenCalledTimes(1);
  });
});
```

---

## Performance Considerations

- **Default Timeout**: 30 minutes (1800000ms)
  - GREEN phase: Can take 10-20 minutes for complex fixes
  - REFACTOR phase: Usually faster (5-10 minutes)
  - Adjust based on fix complexity

- **Retry Strategy**: Built into workflow modules
  - GREEN phase: Up to 2 retries on validation failure
  - REFACTOR phase: No retries (revert to GREEN on failure)

- **Concurrent Delegations**: Not recommended
  - Delegations use significant resources
  - Run sequentially for best results

---

## Integration with TDD Workflow

Complete example of TDD workflow with agent delegation:

```javascript
const { createAgentDelegatorWithTaskTool } = require('./integration/agent-delegator');
const GreenPhaseDelegator = require('./workflow/green-phase-delegator');
const RefactorPhaseCoordinator = require('./workflow/refactor-phase-coordinator');

// Initialize delegator
const agentDelegator = createAgentDelegatorWithTaskTool(Task);

// Initialize workflow modules
const greenPhase = new GreenPhaseDelegator({ agentDelegator });
const refactorPhase = new RefactorPhaseCoordinator({ agentDelegator });

// Execute TDD workflow
async function fixBugWithTDD(bugReport) {
  const sessionId = `bug-${Date.now()}`;

  // 1. RED Phase: Bug recreation (done separately)
  const failingTest = await recreateBug(bugReport);

  // 2. GREEN Phase: Implement minimal fix
  const greenResult = await greenPhase.delegateGreenPhase({
    fixTask: {
      agent: selectSpecialist(bugReport),
      description: bugReport.title,
      failingTest,
      rootCause: bugReport.rootCause,
      strategy: bugReport.fixStrategy,
      affectedFiles: bugReport.affectedFiles
    },
    tddState: { currentPhase: 'red' },
    sessionId
  });

  if (greenResult.status !== 'success') {
    throw new Error(`GREEN phase failed: ${greenResult.error}`);
  }

  // 3. REFACTOR Phase: Improve code quality
  const refactorResult = await refactorPhase.coordinateRefactorPhase({
    greenPhaseResult: greenResult,
    tddState: { currentPhase: 'green' },
    specialist: greenResult.specialist,
    sessionId
  });

  return {
    fixed: true,
    codeChanges: refactorResult.codeChanges,
    testsPassing: refactorResult.validation.passed,
    qualityMetrics: refactorResult.complexityMetrics
  };
}
```

---

## Troubleshooting

### "AgentDelegator requires Task tool injection"

**Cause**: AgentDelegator was created without taskTool parameter.

**Solution**: Use `createAgentDelegatorWithTaskTool(Task)` in agent context, or inject mock for testing.

### Delegation Times Out

**Cause**: Task exceeds default 30-minute timeout.

**Solution**: Increase timeout:
```javascript
const delegator = createAgentDelegatorWithTaskTool(Task, {
  defaultTimeout: 3600000  // 60 minutes
});
```

### Tests Still Failing After GREEN Phase

**Cause**: Fix implementation incomplete or incorrect.

**Solution**: Check retry context and validation failures:
```javascript
if (greenResult.status === 'retry_exhausted') {
  console.error('Fix validation failed:', greenResult.validation.failureReason);
  // Review failureReason and adjust fix strategy
}
```

### Refactoring Broke Tests

**Cause**: Refactoring introduced regression.

**Solution**: Workflow automatically handles this - reverts to GREEN phase implementation.

---

## Advanced Usage

### Custom Quality Targets

```javascript
const refactorResult = await delegator.delegateRefactorPhase({
  greenResult,
  tddState: { currentPhase: 'green' },
  sessionId,
  qualityTargets: {
    maxComplexity: 5,           // Strict complexity limit
    maxMethodLength: 30,         // Shorter methods
    codeSmells: [
      'long-method',
      'complex-conditional',
      'duplicate-code',
      'magic-numbers',
      'long-parameter-list'
    ]
  }
});
```

### Retry Context

```javascript
const greenResult = await delegator.delegateGreenPhase({
  fixTask,
  tddState: { currentPhase: 'red' },
  sessionId,
  retryContext: {
    attemptNumber: 2,
    previousFailure: 'Tests failed due to missing edge case for null input'
  }
});
```

---

## See Also

- [GreenPhaseDelegator](../workflow/green-phase-delegator.js) - GREEN phase workflow
- [RefactorPhaseCoordinator](../workflow/refactor-phase-coordinator.js) - REFACTOR phase workflow
- [Agent Integration Phase 2 Complete](../../../docs/TRD/agent-integration-phase2-complete.md) - Implementation details
- [Sprint 5 Final Summary](../../../docs/TRD/sprint5-final-summary.md) - Complete TDD workflow
