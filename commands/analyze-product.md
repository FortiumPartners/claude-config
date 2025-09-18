---
name: analyze-product
description: Existing project analysis with improvement roadmap and technical assessment
usage: /analyze-product [project path or description]
agent: tech-lead-orchestrator
allowed-tools: Read, Edit, Grep, Glob]
---

# Product Analysis & Improvement Roadmap

## Mission

Route existing project analysis requests to the tech-lead-orchestrator agent for comprehensive codebase assessment and improvement roadmap creation. This command evaluates current project state and provides actionable recommendations for enhancement.

## What This Command Does

- **Codebase Analysis**: Deep analysis of existing code structure, patterns, and quality
- **Technical Assessment**: Evaluation of architecture, dependencies, and technical debt
- **Roadmap Creation**: Strategic improvement roadmap with prioritized recommendations
- **Gap Analysis**: Identify missing components, features, or best practices
- **Productivity Analysis**: Assessment of development workflow and efficiency opportunities
- **Quality Metrics**: Code quality, test coverage, and maintainability scoring

## Usage Patterns

### Full Project Analysis

```
/analyze-product
```

### Specific Module Analysis

```
/analyze-product "frontend components and state management"
```

### Architecture Assessment

```
/analyze-product "database schema and API design patterns"
```

### Performance Analysis

```
/analyze-product "performance bottlenecks and optimization opportunities"
```

## Analysis Dimensions

### Technical Architecture

- Code organization and structure
- Design patterns and architectural principles
- Dependency management and security
- Performance and scalability considerations

### Development Workflow

- Testing strategy and coverage
- CI/CD pipeline effectiveness
- Documentation quality and completeness
- Code review and quality gates

### Product Alignment

- Feature completeness and user experience
- Business logic implementation
- Integration capabilities
- Scalability and maintenance requirements

## Output Structure

The tech-lead-orchestrator will generate:

1. **Current State Assessment**: Overview of project strengths and challenges
2. **Technical Analysis**: Architecture, code quality, and technical debt evaluation
3. **Improvement Roadmap**: Prioritized recommendations with effort estimates
4. **Implementation Strategy**: Phased approach to addressing identified issues
5. **Risk Assessment**: Potential risks and mitigation strategies
6. **Success Metrics**: Measurable outcomes and validation criteria

## Integration Points

- **Codebase Scanning**: Uses Read, Grep, and Glob tools for comprehensive analysis
- **AgentOS Standards**: Applies TRD and quality gate frameworks
- **Context Integration**: Leverages existing project context and documentation
- **Roadmap Planning**: Creates actionable technical specifications

## Handoff Protocol

After analysis completion, the tech-lead-orchestrator can:

- Create technical specifications for improvement tasks
- Generate tickets for specific improvement work
- Route implementation tasks to /execute-tasks
- Update project documentation and standards
- Coordinate with specialized agents for detailed planning

## Best Practices

- Run analysis from project root directory
- Ensure access to full codebase and documentation
- Specify focus areas if analysis should be targeted
- Include business context and constraints when available
- Provide timeline or resource constraints for recommendations

## Analysis Scope

### Code Quality Assessment

- Code complexity and maintainability
- Adherence to style guides and conventions
- Test coverage and quality
- Security vulnerabilities and best practices

### Architecture Review

- System design and component relationships
- Data flow and integration patterns
- Performance characteristics and bottlenecks
- Scalability and extensibility considerations

### Development Process

- Build and deployment processes
- Development workflow efficiency
- Documentation and knowledge sharing
- Team collaboration and code review practices

---

_This command implements comprehensive project analysis following Leo's AI-Augmented Development Process for existing codebase improvement and optimization._
