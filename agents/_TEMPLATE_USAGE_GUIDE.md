# Agent Template Usage Guide

This guide explains how to use `_TEMPLATE.md` to create or update agents in the Fortium Claude Code configuration system.

## Quick Start

1. **Copy the template**:
   ```bash
   cp agents/_TEMPLATE.md agents/your-new-agent.md
   ```

2. **Update YAML frontmatter** with agent-specific information

3. **Fill in all sections** following the guidance below

4. **Remove inapplicable sections** (mark with `[N/A for this agent]` if you want to preserve structure)

5. **Add 5-10 concrete examples** in the "Common Scenarios" section

6. **Validate completeness** using the checklist at the bottom of this guide

---

## Section-by-Section Guidance

### YAML Frontmatter

```yaml
---
name: agent-name                  # kebab-case, matches filename
description: One-line mission     # 50-80 chars, clear and specific
tools: Read, Write, Edit, Bash    # Only tools this agent needs
version: 1.0.0                    # Semantic versioning
last_updated: 2025-10-12          # Today's date
changelog: |                      # Version history
  v1.0.0 (2025-10-12): Initial creation
category: specialist              # orchestrator|specialist|framework-specialist|quality|workflow
primary_languages: [typescript]   # Languages this agent works with
primary_frameworks: [react]       # Frameworks this agent specializes in
---
```

**Categories**:
- **orchestrator**: Manages other agents (ai-mesh-orchestrator, tech-lead-orchestrator)
- **specialist**: Domain expert (backend-developer, frontend-developer)
- **framework-specialist**: Framework-specific expert (react-component-architect, rails-backend-expert)
- **quality**: QA/testing focus (code-reviewer, test-runner)
- **workflow**: Process management (git-workflow, deployment-orchestrator)

---

### Mission Section (150-300 words)

**What to include**:
- Primary responsibility in 1-2 sentences
- Specific expertise areas (3-5 items)
- Clear boundaries (what this agent does NOT do)
- Collaboration patterns with other agents

**Example**:
```markdown
## Mission

This agent is responsible for implementing server-side application logic across multiple programming languages and frameworks with a focus on clean architecture, security, and performance.

**Key Boundaries**:
- ✅ **Handles**: API development, database integration, business logic, authentication/authorization
- ❌ **Does Not Handle**: Frontend UI implementation (delegate to frontend-developer), DevOps infrastructure (delegate to infrastructure-management-subagent)
- 🤝 **Collaborates On**: API contract design with frontend-developer, database schema design with tech-lead-orchestrator

**Core Expertise**:
- RESTful API Design: OpenAPI specs, versioning strategies, pagination patterns
- Database Architecture: Schema design, query optimization, migration management
- Authentication: JWT, OAuth2, session management, RBAC implementation
```

---

### Core Responsibilities (5-8 items)

**Format**: Numbered list with specific deliverables

**Good examples**:
- ✅ "**API Development**: Design and implement RESTful APIs with OpenAPI documentation, versioning, and rate limiting"
- ✅ "**Database Integration**: Create optimized schemas, write performant queries with proper indexing, manage migrations"

**Bad examples**:
- ❌ "Handle backend stuff" (too vague)
- ❌ "Write code" (not specific enough)

---

### Technical Capabilities

**Include**:
1. **Multi-Language/Framework Support**: What technologies this agent works with
2. **Architecture Patterns**: What patterns this agent uses (with when/why/trade-offs)
3. **Code Examples**: Minimum 5 examples showing:
   - Common tasks
   - Anti-patterns vs. best practices
   - Performance optimizations
   - Security patterns
   - Framework-specific guidance

**Example Structure**:
```markdown
### Code Examples and Best Practices

#### Example 1: Input Validation

```typescript
// ❌ ANTI-PATTERN: No validation
app.post('/users', (req, res) => {
  const user = new User(req.body);  // Dangerous!
  await user.save();
});

// ✅ BEST PRACTICE: Validate all inputs
app.post('/users', async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().min(18).max(120)
  });
  
  const validated = schema.parse(req.body);
  const user = new User(validated);
  await user.save();
});
```

**Key Takeaways**:
- Always validate user input at API boundaries
- Use schema validation libraries (Zod, Joi, class-validator)
- Return clear validation errors to clients
```

---

### Test-Driven Development (TDD) Protocol

**When to include**: All development-focused agents (backend, frontend, component specialists)

**When to skip**: Orchestrators, workflow agents, documentation agents

**Customization tips**:
- Adjust test coverage thresholds based on agent focus
- Add framework-specific test examples
- Include testing tools relevant to the agent's domain

---

### Tool Permissions

**Required**: Explain EACH tool the agent has access to

**Format**:
```markdown
### Read
**Purpose**: Analyze existing codebase, configuration files, and documentation
**Permissions**: Can read all project files except secrets
**Best Practices**:
- Read files before editing to understand context
- Use Read to validate assumptions before implementation
- Combine with Grep for targeted file searches

**Example Usage**:
- Read existing API implementations before adding new endpoints
- Review test files to understand testing patterns
- Analyze configuration files for environment setup
```

---

### Integration Protocols

**Critical section** - defines how this agent works with others

**Handoff From**: Who sends work TO this agent
**Handoff To**: Who this agent sends work TO  
**Collaboration With**: Who this agent works WITH simultaneously

**For each relationship, specify**:
- **Context Required**: What information the agent needs
- **Acceptance Criteria**: What validates the handoff
- **Deliverables Format**: How outputs should be structured
- **Example Trigger**: Concrete scenario

**Example**:
```markdown
### Handoff From

**tech-lead-orchestrator**: After TRD creation and task breakdown
- **Context Required**: TRD document, acceptance criteria, technical constraints, assigned task IDs
- **Acceptance Criteria**: 
  - [ ] TRD contains detailed technical specifications
  - [ ] Tasks have clear acceptance criteria
  - [ ] Dependencies are documented
  - [ ] Technology stack is decided
- **Deliverables Format**: TRD markdown file with task IDs (TRD-XXX format)
- **Example Trigger**: "Implement TRD-015: JWT token management service (3h) - Priority: High - Depends: TRD-005"
```

---

### Quality Standards

**Use checklist format** for all measurable criteria

**Include sections for**:
- Code Quality (SOLID, clean code, documentation)
- Testing Standards (coverage, test types, test quality)
- Performance Benchmarks (response times, memory, scalability)
- Security Requirements (validation, auth, encryption)
- Accessibility Standards (if UI-focused agent)

**Be specific with numbers**:
- ✅ "≥80% unit test coverage"
- ✅ "API responses <200ms for simple operations"
- ❌ "Good test coverage"
- ❌ "Fast response times"

---

### Delegation Criteria

**Critical for orchestrators and complex specialists**

**Include**:
1. **When to Use This Agent**: Clear scenarios with decision criteria
2. **Decision Matrix**: Table format showing when to use vs. delegate
3. **When to Delegate**: Specific triggers for each specialized agent
4. **Retain Ownership When**: Scenarios where agent keeps the task

**Example Decision Matrix**:
```markdown
| Scenario | Use This Agent | Delegate To | Reason |
|----------|----------------|-------------|--------|
| Simple CRUD API | ✅ | - | Core competency |
| Rails-specific ActiveRecord | ❌ | rails-backend-expert | Framework specialist |
| Microservices architecture | 🤝 | tech-lead-orchestrator | Collaborative design |
```

---

### Success Criteria

**Must be measurable and checkable**

**Format**: Checklist with specific outcomes

**Categories**:
1. Functional Requirements (what was delivered)
2. Quality Metrics (how well it was delivered)
3. Integration Success (how well it works with other components)
4. User/Stakeholder Validation (does it meet needs)

**Example**:
```markdown
### Functional Requirements

- [ ] **Authentication API**: JWT-based auth endpoints (login, logout, refresh) implemented and tested
- [ ] **User Management**: CRUD operations for user profiles with role-based access control
- [ ] **API Documentation**: OpenAPI 3.0 spec generated with examples for all endpoints
```

---

### Performance Benchmarks

**New section** - adds measurable performance expectations

**Include**:
- Response time expectations by task complexity
- Quality metrics (success rates, accuracy)
- Productivity targets (completion time, efficiency)

**Example**:
```markdown
### Response Time Expectations

- **Simple Tasks** (CRUD operations): <30 seconds
- **Medium Tasks** (API design, schema creation): 1-3 minutes
- **Complex Tasks** (Architecture design, optimization): 5-15 minutes

### Quality Metrics

- **First-Pass Success Rate**: ≥85% (no rework needed)
- **Handoff Accuracy**: ≥95% (downstream agents don't need clarification)
- **Code Review Pass Rate**: ≥90% (passes quality gates first time)
```

---

### Common Scenarios and Examples

**Most important section for agent effectiveness**

**Required**: Minimum 5 scenarios, ideally 8-10

**Each scenario should include**:
1. Context (when this occurs)
2. Input requirements
3. Processing steps
4. Expected output
5. Validation criteria
6. Common pitfalls

**Types of scenarios to cover**:
- Most common task (scenario 1)
- Complex integration pattern (scenario 2)
- Error handling (scenario 3)
- Performance optimization (scenario 4)
- Security pattern (scenario 5)
- Edge cases (scenarios 6-10)

---

### Framework-Specific Guidance

**When to include**: Agents that work with multiple frameworks

**Structure**: One subsection per framework with:
- Common anti-patterns
- Performance optimization
- Security considerations
- Testing strategies

**Example**:
```markdown
### React Best Practices

#### Common Anti-Patterns
```typescript
// ❌ ANTI-PATTERN: Unnecessary re-renders
function Component() {
  const data = expensiveComputation();  // Runs every render!
  return <div>{data}</div>;
}

// ✅ BEST PRACTICE: Memoize expensive computations
function Component() {
  const data = useMemo(() => expensiveComputation(), []);
  return <div>{data}</div>;
}
```

#### Performance Optimization
- Use React.memo() for expensive components
- Implement useCallback for event handlers passed to children
- Use useMemo for expensive calculations
```

---

### Troubleshooting Guide

**Include common issues specific to this agent**

**Format** for each issue:
- Symptoms (how to recognize)
- Diagnosis (how to confirm)
- Solution (how to fix)
- Prevention (how to avoid)

**Example**:
```markdown
#### Issue: N+1 Query Problem

**Symptoms**:
- Slow API response times
- Multiple similar database queries in logs
- Performance degrades with data size

**Diagnosis**:
```bash
# Enable query logging
DATABASE_LOG_LEVEL=debug npm start
# Look for repeated queries with different IDs
```

**Solution**:
```typescript
// Add eager loading
const users = await User.findAll({
  include: [{ model: Post, include: [Comment] }]
});
```

**Prevention**:
- Always use eager loading for associations
- Monitor query count in development
- Add performance tests for API endpoints
```

---

## Validation Checklist

Use this checklist to ensure your agent is complete:

### Structure
- [ ] YAML frontmatter complete with all fields
- [ ] Mission section is 150-300 words
- [ ] Core Responsibilities has 5-8 specific items
- [ ] All tool permissions explained

### Content Depth
- [ ] Technical Capabilities includes 5+ code examples
- [ ] TDD Protocol included (if development agent)
- [ ] Framework-Specific sections for all supported frameworks
- [ ] Common Scenarios has 5-10 concrete examples

### Integration
- [ ] Integration Protocols has Handoff From/To/Collaboration sections
- [ ] Each handoff specifies context, acceptance criteria, format
- [ ] Delegation Criteria includes decision matrix
- [ ] Clear boundaries with other agents

### Quality
- [ ] Quality Standards uses checklist format
- [ ] All metrics are specific and measurable
- [ ] Success Criteria are checkable
- [ ] Performance Benchmarks defined

### Completeness
- [ ] Troubleshooting Guide included
- [ ] Notes section with best practices and warnings
- [ ] References to related documentation
- [ ] Version metadata in frontmatter

---

## Common Template Customizations

### For Orchestrator Agents
- **Emphasize**: Integration protocols, delegation criteria, strategic decision-making
- **De-emphasize**: TDD protocol, framework-specific details
- **Add**: Decision trees, escalation paths, conflict resolution

### For Specialist Agents
- **Emphasize**: Technical capabilities, code examples, TDD protocol
- **De-emphasize**: Delegation criteria (focus on accepting work, not routing)
- **Add**: Deep technical examples, performance patterns, security checks

### For Framework-Specialist Agents
- **Emphasize**: Framework-specific guidance, deep code examples
- **De-emphasize**: Multi-framework support
- **Add**: Framework-specific tooling, ecosystem integration, migration patterns

### For Quality/Testing Agents
- **Emphasize**: Quality standards, testing strategies, security scanning
- **De-emphasize**: TDD protocol (these agents validate tests, not write them)
- **Add**: DoD enforcement, automated checks, validation scripts

### For Workflow Agents
- **Emphasize**: Integration protocols, process automation, tooling
- **De-emphasize**: Code examples, TDD protocol
- **Add**: Git workflows, CI/CD integration, deployment procedures

---

## Migration Guide: Updating Existing Agents

### Step 1: Backup
```bash
cp agents/existing-agent.md agents/existing-agent.md.backup
```

### Step 2: Extract Content
Open existing agent and identify:
- What sections match the template
- What sections need expansion
- What sections need restructuring

### Step 3: Fill Template
1. Copy `_TEMPLATE.md` to new file
2. Migrate existing content section by section
3. Fill in missing sections
4. Expand thin sections to meet template standards

### Step 4: Enhance
- Add code examples (target: 10 total)
- Add framework-specific guidance
- Add TDD protocol (if applicable)
- Expand integration protocols

### Step 5: Validate
- Run through validation checklist
- Compare depth to code-reviewer.md
- Test agent effectiveness with sample prompts

### Step 6: Version
- Increment version number
- Update changelog
- Update last_updated date

---

## Examples of Well-Structured Agents

Use these as reference for quality and depth:

1. **code-reviewer.md**: Excellent example of comprehensive content (1000+ lines)
   - Extensive code examples
   - Framework-specific sections
   - Security patterns
   - Performance checks

2. **ai-mesh-orchestrator.md**: Good orchestrator structure
   - Clear delegation logic
   - Strategic decision-making
   - Integration protocols

3. **implement-trd.md**: Good command structure
   - Clear workflow
   - Quality gates
   - Delegation patterns

---

## Quick Reference: Section Requirements

| Section | Required | Min Length | Key Elements |
|---------|----------|-----------|--------------|
| Mission | ✅ | 150-300 words | Purpose, boundaries, expertise |
| Core Responsibilities | ✅ | 5-8 items | Specific deliverables |
| Technical Capabilities | ✅ | 5+ examples | Code patterns, anti-patterns |
| TDD Protocol | ⚠️ | Full section | If development agent |
| Tool Permissions | ✅ | All tools | Purpose, best practices |
| Integration Protocols | ✅ | 3+ relationships | Context, criteria, format |
| Quality Standards | ✅ | 4+ categories | Measurable checklist |
| Delegation Criteria | ✅ | Decision matrix | When to use vs. delegate |
| Success Criteria | ✅ | 10+ items | Measurable checkboxes |
| Performance Benchmarks | ✅ | 3 categories | Time, quality, productivity |
| Common Scenarios | ✅ | 5-10 scenarios | Complete examples |
| Framework-Specific | ⚠️ | 1+ frameworks | If multi-framework |
| Troubleshooting | ✅ | 3+ issues | Symptoms, solution, prevention |

**Legend**:
- ✅ Required for all agents
- ⚠️ Required conditionally
- ❌ Optional

---

## Tips for Writing Effective Agents

### 1. Be Specific
- ❌ "Handle errors gracefully"
- ✅ "Catch exceptions, log with context, return 4xx/5xx with clear error messages"

### 2. Use Examples
- Every abstract concept needs a concrete code example
- Show both wrong and right approaches
- Explain WHY the right approach is better

### 3. Make it Measurable
- Use numbers: "≥80% coverage", "<200ms response time"
- Use checklists for validation
- Define clear success criteria

### 4. Consider the User
- Write for someone unfamiliar with the agent
- Provide context and rationale
- Include troubleshooting for common issues

### 5. Keep it Maintainable
- Use version numbers and changelogs
- Reference related documentation
- Plan for future enhancements

---

## Getting Help

If you need help creating or updating an agent:

1. **Review**: Look at code-reviewer.md as the gold standard
2. **Validate**: Use the validation checklist
3. **Ask**: Consult with the agent-meta-engineer for guidance
4. **Iterate**: Start with minimum viable content, then expand

---

**Template Version**: 1.0.0  
**Guide Version**: 1.0.0  
**Last Updated**: 2025-10-12  
**Maintainer**: Fortium Configuration Team
