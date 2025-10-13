---
name: agent-name
description: Clear one-line mission statement describing the agent's primary purpose (50-80 characters)
tools: Read, Write, Edit, Bash, Grep, Glob
version: 1.0.0
last_updated: 2025-10-12
changelog: |
  v1.0.0 (2025-10-12): Initial agent creation
category: [orchestrator|specialist|framework-specialist|quality|workflow]
primary_languages: [javascript, typescript, python, ruby, elixir, java, go]
primary_frameworks: [react, vue, angular, rails, phoenix, nestjs, express]
---

## Mission

[150-300 words: Provide a clear, comprehensive description of this agent's purpose, boundaries, and expertise]

This agent is responsible for [primary responsibility]. The agent specializes in [specific expertise area] with deep knowledge of [technologies/patterns]. 

**Key Boundaries**:
- ✅ **Handles**: [Specific tasks this agent owns]
- ❌ **Does Not Handle**: [Tasks that should be delegated to other agents]
- 🤝 **Collaborates On**: [Shared responsibilities requiring coordination]

**Core Expertise**:
- [Expertise area 1]: [Brief description]
- [Expertise area 2]: [Brief description]
- [Expertise area 3]: [Brief description]

## Core Responsibilities

[5-8 bullet points with specific, measurable deliverables]

1. **[Responsibility 1]**: [Detailed description with expected outcomes]
2. **[Responsibility 2]**: [Detailed description with expected outcomes]
3. **[Responsibility 3]**: [Detailed description with expected outcomes]
4. **[Responsibility 4]**: [Detailed description with expected outcomes]
5. **[Responsibility 5]**: [Detailed description with expected outcomes]

## Technical Capabilities

### Multi-Language/Framework Support

[If applicable, list supported languages and frameworks with specific features]

- **[Language/Framework 1]**: [Key features, patterns, libraries]
- **[Language/Framework 2]**: [Key features, patterns, libraries]
- **[Language/Framework 3]**: [Key features, patterns, libraries]

### Architecture Patterns

[List relevant architectural patterns with brief explanations]

- **[Pattern 1]**: [When to use, benefits, trade-offs]
- **[Pattern 2]**: [When to use, benefits, trade-offs]
- **[Pattern 3]**: [When to use, benefits, trade-offs]

### Code Examples and Best Practices

#### Example 1: [Common Task Name]

```[language]
// ❌ ANTI-PATTERN: [What's wrong with this approach]
function badExample() {
  // Problematic code here
  // Explain why this is problematic
}

// ✅ CORRECT: [Why this approach is better]
function goodExample() {
  // Correct implementation
  // Explain the benefits
}
```

**Key Takeaways**:
- [Important point 1]
- [Important point 2]
- [Important point 3]

#### Example 2: [Performance Pattern]

```[language]
// ❌ WARNING: [Performance issue]
function inefficient() {
  // Inefficient code
}

// ✅ OPTIMIZED: [How this improves performance]
function efficient() {
  // Optimized implementation
}
```

**Performance Impact**: [Quantify improvement - e.g., "50% faster", "reduces memory by 70%"]

#### Example 3: [Security Pattern]

```[language]
// ❌ CRITICAL: [Security vulnerability]
function insecure() {
  // Vulnerable code
}

// ✅ SECURE: [How this prevents the vulnerability]
function secure() {
  // Secure implementation
}
```

**Security Considerations**:
- [Vulnerability type and risk]
- [Mitigation strategy]
- [Related security patterns]

[Add 2-7 more examples covering common scenarios, edge cases, and framework-specific patterns]

## Test-Driven Development (TDD) Protocol

[Include this section for all development-focused agents]

### Red-Green-Refactor Cycle

#### 1. RED Phase: Write Failing Tests First
- [ ] Write tests based on acceptance criteria before implementation
- [ ] Cover expected behavior, edge cases, and error conditions
- [ ] Use descriptive test names that document intent
- [ ] Ensure tests fail for the right reason

**Example Test Pattern**:
```[language]
// RED: Write failing test first
describe('[Feature Name]', () => {
  it('should [expected behavior]', () => {
    // Arrange: Set up test data
    const input = setupTestData();
    
    // Act: Call the function (doesn't exist yet)
    const result = functionUnderTest(input);
    
    // Assert: Verify expected outcome
    expect(result).toEqual(expectedOutput);
  });
});
```

#### 2. GREEN Phase: Implement Minimal Code
- [ ] Write simplest code that makes tests pass
- [ ] No premature optimization
- [ ] Focus on correctness first
- [ ] Verify all tests pass

**Implementation Pattern**:
```[language]
// GREEN: Minimal implementation to pass tests
function functionUnderTest(input) {
  // Simple, straightforward implementation
  // Optimization comes in refactor phase
  return processInput(input);
}
```

#### 3. REFACTOR Phase: Improve Code Quality
- [ ] Apply SOLID principles
- [ ] Eliminate code smells
- [ ] Improve naming and structure
- [ ] Ensure all tests still pass

**Refactoring Checklist**:
- [ ] Extract methods for single responsibility
- [ ] Remove duplication (DRY principle)
- [ ] Improve variable/function naming
- [ ] Add inline documentation where needed
- [ ] Verify tests still pass

### TDD Quality Gates

- [ ] **Test Coverage**: ≥80% for unit tests, ≥70% for integration tests
- [ ] **Test Performance**: Unit tests run in <5 seconds
- [ ] **Test Independence**: Tests can run in any order
- [ ] **Test Clarity**: Test names document expected behavior
- [ ] **Test Maintainability**: Tests are easy to understand and modify

### When TDD is Required

- ✅ **Always Required**:
  - All new feature development
  - Bug fixes (write test reproducing bug first)
  - Refactoring (tests document expected behavior)
  - API endpoint development
  - Data transformation logic

- ⚠️ **Flexible Approach**:
  - Exploratory prototyping (but add tests before merging)
  - UI/UX experimentation (but add visual regression tests)
  - Performance optimization (but add performance benchmarks)

## Tool Permissions

[Detailed explanation of each tool and when/how to use it]

### Read
**Purpose**: [When to use this tool]
**Permissions**: [What files/directories can be read]
**Best Practices**:
- [Tip 1]
- [Tip 2]
- [Tip 3]

**Example Usage**:
```
Read file_path=/path/to/file.ext to analyze [specific aspect]
```

### Write
**Purpose**: [When to use this tool]
**Permissions**: [What files can be created]
**Best Practices**:
- [Tip 1]
- [Tip 2]
- [Tip 3]

**Example Usage**:
```
Write file_path=/path/to/new-file.ext with [content description]
```

### Edit
**Purpose**: [When to use this tool]
**Permissions**: [What files can be modified]
**Best Practices**:
- [Tip 1]
- [Tip 2]
- [Tip 3]

**Example Usage**:
```
Edit file_path=/path/to/existing-file.ext to change [specific section]
```

### Bash
**Purpose**: [When to use this tool]
**Permissions**: [What commands are allowed]
**Best Practices**:
- [Tip 1]
- [Tip 2]
- [Tip 3]

**Example Usage**:
```bash
# Run tests
npm test

# Build project
npm run build
```

### Grep
**Purpose**: [When to use this tool]
**Best Practices**:
- [Tip 1]
- [Tip 2]

### Glob
**Purpose**: [When to use this tool]
**Best Practices**:
- [Tip 1]
- [Tip 2]

## Integration Protocols

### Handoff From

**[Source Agent 1]**: [Triggering condition]
- **Context Required**: [Specific information needed from source agent]
- **Acceptance Criteria**: [What validates handoff readiness]
- **Deliverables Format**: [Expected structure of handoff package]
- **Example Trigger**: "[Concrete example of when this handoff occurs]"

**[Source Agent 2]**: [Triggering condition]
- **Context Required**: [Specific information needed]
- **Acceptance Criteria**: [Validation criteria]
- **Deliverables Format**: [Expected structure]
- **Example Trigger**: "[Concrete example]"

### Handoff To

**[Destination Agent 1]**: [Completion condition]
- **Deliverables**: [Specific artifacts to provide]
- **Quality Gates**: [What must be true before handoff]
- **Documentation Requirements**: [What to document]
- **Example Handoff**: "[Concrete example of successful handoff]"
- **Validation Checklist**:
  - [ ] [Criterion 1]
  - [ ] [Criterion 2]
  - [ ] [Criterion 3]

**[Destination Agent 2]**: [Completion condition]
- **Deliverables**: [Specific artifacts]
- **Quality Gates**: [Prerequisites]
- **Documentation Requirements**: [Required docs]
- **Example Handoff**: "[Concrete example]"

### Collaboration With

**[Peer Agent 1]**: [Coordination scenario]
- **Shared Responsibilities**: [What both agents handle]
- **Communication Protocol**: [How agents coordinate]
- **Conflict Resolution**: [Who has final authority on what]
- **Example Collaboration**: "[Concrete scenario of successful collaboration]"

**[Peer Agent 2]**: [Coordination scenario]
- **Shared Responsibilities**: [Overlapping concerns]
- **Communication Protocol**: [Coordination method]
- **Conflict Resolution**: [Authority boundaries]
- **Example Collaboration**: "[Concrete scenario]"

### Integration Testing

- [ ] Validate handoff format matches downstream expectations
- [ ] Test edge cases (partial context, missing data, invalid inputs)
- [ ] Verify error handling for failed handoffs
- [ ] Confirm quality gates are enforceable
- [ ] Test rollback procedures for failed integrations

## Quality Standards

### Code Quality

- [ ] **SOLID Principles**: Single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion
- [ ] **Clean Code**: Clear naming, small functions, minimal nesting, DRY principle
- [ ] **Code Documentation**: JSDoc/docstrings for public APIs, inline comments for complex logic
- [ ] **Static Analysis**: Passes linter with zero errors, zero high-severity warnings
- [ ] **Type Safety**: Full TypeScript strict mode (or equivalent), no `any` types without justification

### Testing Standards

- [ ] **Unit Test Coverage**: ≥80% coverage for business logic
- [ ] **Integration Test Coverage**: ≥70% coverage for API endpoints and service interactions
- [ ] **E2E Test Coverage**: Critical user journeys covered with Playwright/similar
- [ ] **Test Quality**: Tests follow AAA pattern (Arrange-Act-Assert), clear test names, independent tests
- [ ] **Test Performance**: Unit tests run in <5 seconds, integration tests in <30 seconds

### Performance Benchmarks

- [ ] **Response Time**: [Specify thresholds - e.g., "API responses <200ms for simple operations, <1s for complex"]
- [ ] **Memory Usage**: [Specify limits - e.g., "Heap usage <512MB for typical operations"]
- [ ] **Database Performance**: [Specify expectations - e.g., "Queries optimized with proper indexing, N+1 queries eliminated"]
- [ ] **Scalability**: [Specify requirements - e.g., "Stateless design supporting horizontal scaling"]

### Security Requirements

- [ ] **Input Validation**: All user inputs validated and sanitized at boundaries
- [ ] **Authentication**: Secure authentication mechanisms (JWT, OAuth, session management)
- [ ] **Authorization**: Proper access control for all endpoints (RBAC/ABAC)
- [ ] **Data Protection**: Sensitive data encrypted at rest and in transit
- [ ] **Vulnerability Assessment**: Zero critical or high-severity security vulnerabilities
- [ ] **Security Headers**: Appropriate headers configured (CSP, HSTS, X-Frame-Options)

### Accessibility Standards

[Include for UI/UX-focused agents]

- [ ] **WCAG 2.1 AA Compliance**: Full compliance with automated and manual testing
- [ ] **Keyboard Navigation**: Complete keyboard accessibility, logical tab order
- [ ] **Screen Readers**: VoiceOver, NVDA, JAWS compatibility verified
- [ ] **Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text
- [ ] **Semantic HTML**: Proper heading structure, landmark roles, ARIA labels

## Delegation Criteria

### When to Use This Agent

Use this agent when:
- [Specific scenario 1 with clear indicators]
- [Specific scenario 2 with decision criteria]
- [Specific scenario 3 with examples]
- [Specific scenario 4 with boundaries]

**Decision Matrix**:
| Scenario | Use This Agent | Delegate To | Reason |
|----------|----------------|-------------|--------|
| [Scenario A] | ✅ | - | [Explanation] |
| [Scenario B] | ❌ | [Other Agent] | [Explanation] |
| [Scenario C] | 🤝 | [Other Agent] | [Collaboration needed] |

### When to Delegate to Specialized Agents

**Delegate to [Specialized Agent 1] when**:
- [Specific trigger 1]
- [Specific trigger 2]
- [Specific trigger 3]
- **Handoff Package**: [What to provide]
- **Expected Timeline**: [How long specialized agent needs]

**Delegate to [Specialized Agent 2] when**:
- [Specific trigger 1]
- [Specific trigger 2]
- **Handoff Package**: [What to provide]
- **Expected Timeline**: [Duration]

**Delegate to [Specialized Agent 3] when**:
- [Specific trigger 1]
- [Specific trigger 2]
- **Handoff Package**: [What to provide]
- **Expected Timeline**: [Duration]

### Retain Ownership When

Keep tasks within this agent when:
- [Scenario where delegation overhead exceeds value]
- [Scenario where this agent has sufficient expertise]
- [Scenario where handoff would fragment context]
- [Scenario where task is core to agent's mission]

## Success Criteria

### Functional Requirements

- [ ] **Deliverable 1**: [Specific, measurable outcome with verification method]
- [ ] **Deliverable 2**: [Specific, measurable outcome with verification method]
- [ ] **Deliverable 3**: [Specific, measurable outcome with verification method]
- [ ] **Deliverable 4**: [Specific, measurable outcome with verification method]
- [ ] **Deliverable 5**: [Specific, measurable outcome with verification method]

### Quality Metrics

- [ ] **Code Quality**: Passes all static analysis with 0 high-severity issues
- [ ] **Test Coverage**: ≥80% unit tests, ≥70% integration tests, critical paths covered by E2E
- [ ] **Performance**: Meets response time benchmarks (specify thresholds)
- [ ] **Security**: No critical or high-severity vulnerabilities detected
- [ ] **Documentation**: All public APIs documented, README updated, deployment guide complete

### Integration Success

- [ ] **Handoff Validation**: Downstream agents can consume outputs without clarification
- [ ] **API Contracts**: All interfaces documented and tested with examples
- [ ] **Error Handling**: Graceful failure with clear error messages and recovery paths
- [ ] **Backward Compatibility**: Changes don't break existing integrations (or deprecated properly)
- [ ] **Performance Impact**: No degradation in system performance metrics

### User/Stakeholder Validation

- [ ] **Acceptance Criteria Met**: All user-defined acceptance criteria satisfied
- [ ] **Usability Validated**: [Method - e.g., "User testing with 5+ participants"]
- [ ] **Documentation Complete**: User guides, API docs, troubleshooting guides available
- [ ] **Deployment Ready**: Production deployment checklist completed
- [ ] **Monitoring Enabled**: Logging, metrics, alerting configured

## Performance Benchmarks

### Response Time Expectations

- **Simple Tasks** (CRUD operations, basic validation): <30 seconds
- **Medium Tasks** (API design, component creation, data transformations): 1-3 minutes
- **Complex Tasks** (Architecture design, system integration, performance optimization): 5-15 minutes
- **Research Tasks** (Technology evaluation, pattern research): 10-30 minutes

### Quality Metrics

- **First-Pass Success Rate**: ≥85% (tasks completed without rework)
- **Handoff Accuracy**: ≥95% (downstream agents can proceed without clarification)
- **Code Review Pass Rate**: ≥90% (submissions pass quality gates on first review)
- **Test Coverage Achievement**: ≥95% (meets or exceeds coverage targets)

### Productivity Targets

- **Task Completion**: Within TRD estimated time ±20%
- **Test Coverage**: Meets project standards without prompting
- **Documentation**: Generated automatically as part of deliverable
- **Collaboration Efficiency**: <2 iterations to align with peer agents

## Common Scenarios and Examples

### Scenario 1: [Most Common Task]

**Context**: [When this scenario typically occurs]

**Input Requirements**:
```[language]
// Expected input format
interface InputFormat {
  // Define expected structure
}
```

**Processing Steps**:
1. [Step 1 description]
2. [Step 2 description]
3. [Step 3 description]

**Expected Output**:
```[language]
// Expected output format
interface OutputFormat {
  // Define output structure
}
```

**Validation Criteria**:
- [ ] [Output criterion 1]
- [ ] [Output criterion 2]
- [ ] [Output criterion 3]

**Common Pitfalls**:
- ⚠️ [Pitfall 1 and how to avoid it]
- ⚠️ [Pitfall 2 and how to avoid it]

---

### Scenario 2: [Complex Integration Pattern]

**Context**: [When this scenario occurs]

**Prerequisites**:
- [Prerequisite 1]
- [Prerequisite 2]

**Implementation Pattern**:
```[language]
// Step-by-step code example
// Include comments explaining each step

// Step 1: Setup
function setup() {
  // Implementation
}

// Step 2: Processing
function process() {
  // Implementation
}

// Step 3: Validation
function validate() {
  // Implementation
}
```

**Testing Strategy**:
```[language]
// Corresponding test cases
describe('Scenario 2 Implementation', () => {
  it('should handle [specific case]', () => {
    // Test implementation
  });
  
  it('should handle [edge case]', () => {
    // Test implementation
  });
});
```

---

### Scenario 3: [Error Handling Pattern]

**Context**: [When errors occur]

**Error Detection**:
```[language]
// How to detect the error
function detectError(input) {
  if (/* error condition */) {
    throw new SpecificError('Clear error message');
  }
}
```

**Error Recovery**:
```[language]
// How to recover from the error
function handleError(error) {
  if (error instanceof SpecificError) {
    // Recovery strategy
  }
}
```

**Logging and Monitoring**:
- Log level: [ERROR|WARN|INFO]
- Metrics to track: [List metrics]
- Alerting threshold: [When to alert]

---

### Scenario 4: [Performance Optimization]

**Problem**: [Describe performance issue]

**Before Optimization**:
```[language]
// Inefficient code
function slow() {
  // Show the bottleneck
}
```

**Performance Metrics (Before)**:
- Execution time: [measurement]
- Memory usage: [measurement]
- Database queries: [count]

**After Optimization**:
```[language]
// Optimized code
function fast() {
  // Show the improvement
}
```

**Performance Metrics (After)**:
- Execution time: [measurement] (improvement: X%)
- Memory usage: [measurement] (improvement: X%)
- Database queries: [count] (improvement: X%)

**Key Optimization Techniques**:
1. [Technique 1]: [Description]
2. [Technique 2]: [Description]
3. [Technique 3]: [Description]

---

### Scenario 5: [Security Pattern]

**Vulnerability**: [Describe the security risk]

**Attack Vector**:
```[language]
// Example of how the vulnerability can be exploited
const maliciousInput = "'; DROP TABLE users; --";
```

**Vulnerable Code**:
```[language]
// ❌ CRITICAL: Insecure implementation
function insecure(userInput) {
  // Show vulnerability
}
```

**Secure Implementation**:
```[language]
// ✅ SECURE: Proper mitigation
function secure(userInput) {
  // Show secure approach
}
```

**Security Testing**:
```[language]
// How to test for this vulnerability
describe('Security Tests', () => {
  it('should prevent [attack type]', () => {
    // Test implementation
  });
});
```

[Add 3-5 more scenarios covering common use cases, edge cases, and framework-specific patterns]

## Framework-Specific Guidance

[Include this section if agent supports multiple frameworks]

### [Framework 1] Best Practices

#### Common Anti-Patterns
```[language]
// ❌ ANTI-PATTERN: [What's wrong]
// Bad example code

// ✅ BEST PRACTICE: [Why this is better]
// Good example code
```

#### Performance Optimization
- [Optimization technique 1 with code example]
- [Optimization technique 2 with code example]
- [Optimization technique 3 with code example]

#### Security Considerations
- [Security concern 1 and mitigation]
- [Security concern 2 and mitigation]
- [Security concern 3 and mitigation]

#### Testing Strategies
- [Framework-specific test pattern 1]
- [Framework-specific test pattern 2]
- [Framework-specific test pattern 3]

---

### [Framework 2] Best Practices

#### Common Anti-Patterns
```[language]
// Framework 2 specific patterns
```

#### Performance Optimization
- [Framework 2 optimizations]

#### Security Considerations
- [Framework 2 security]

#### Testing Strategies
- [Framework 2 testing]

---

### [Framework 3] Best Practices

[Similar structure for additional frameworks]

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: [Problem Description]

**Symptoms**:
- [Symptom 1]
- [Symptom 2]
- [Symptom 3]

**Diagnosis**:
```bash
# Commands to diagnose the issue
command-to-check-1
command-to-check-2
```

**Solution**:
```[language]
// Code fix or configuration change
```

**Prevention**:
- [How to avoid this issue in the future]

---

#### Issue 2: [Problem Description]

**Symptoms**: [List symptoms]

**Root Cause**: [Explain the underlying cause]

**Solution**: [Step-by-step fix]

**Prevention**: [Best practices to avoid]

---

#### Issue 3: [Problem Description]

[Similar structure for additional issues]

### Debugging Strategies

1. **[Strategy 1]**: [When to use, how to implement]
2. **[Strategy 2]**: [When to use, how to implement]
3. **[Strategy 3]**: [When to use, how to implement]

### Escalation Path

When issues exceed this agent's capabilities:
1. [First escalation step - which agent or resource]
2. [Second escalation step - when to involve]
3. [Final escalation - critical issues requiring human intervention]

## Notes

### Best Practices

- [Best practice 1 with rationale]
- [Best practice 2 with rationale]
- [Best practice 3 with rationale]
- [Best practice 4 with rationale]
- [Best practice 5 with rationale]

### Important Warnings

- ⚠️ **[Warning 1]**: [What to avoid and why]
- ⚠️ **[Warning 2]**: [What to avoid and why]
- ⚠️ **[Warning 3]**: [What to avoid and why]

### Integration Considerations

- [Consideration 1 about working with other agents]
- [Consideration 2 about system dependencies]
- [Consideration 3 about external services]

### Future Enhancements

[Planned improvements or known limitations]

- [ ] [Enhancement 1]: [Description and rationale]
- [ ] [Enhancement 2]: [Description and rationale]
- [ ] [Enhancement 3]: [Description and rationale]

### References

- [Reference 1]: [Link or citation]
- [Reference 2]: [Link or citation]
- [Reference 3]: [Link or citation]

---

**Agent Version**: 1.0.0  
**Template Version**: 1.0.0  
**Last Updated**: 2025-10-12  
**Maintainer**: [Agent Owner/Team]  
**Review Cycle**: [How often this agent should be reviewed - e.g., quarterly]  

---

_This agent follows Fortium's AI-Augmented Development Process and adheres to AgentOS standards for agent design, integration, and quality assurance._
