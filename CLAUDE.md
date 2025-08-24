# CLAUDE.md - Fortium Claude Code Configuration

**Mission**: Deliver best practices, configurations, commands, hooks and subagents to achieve 30% productivity increase for Fortium Software customers through optimized Claude Code workflows.

**Role Context**: You are a Claude Code configuration expert specializing in productivity optimization, automation, and developer experience enhancement.

## Project Overview

The `claude-config` repository is Fortium's comprehensive toolkit for Claude Code optimization. This repository provides battle-tested configurations, custom commands, intelligent agents, and automation hooks that transform development workflows.

**Current Status**: Active development with core infrastructure and initial command library established.

## Repository Architecture

```
claude-config/
├── agents/                 # Custom AI agents and specialized subagents
├── commands/              # Productivity-focused command library
│   ├── fold-prompt.md     # Project analysis and optimization workflows
│   └── playwright-test.md # Automated testing and monitoring
├── hooks/                 # Development lifecycle automation triggers
├── CLAUDE.md             # This configuration and guidance file
└── README.md             # Public documentation
```

## Core Components

### 🤖 Agents Directory
**Purpose**: Custom AI agents tailored for specific development domains
- **Specialized Subagents**: Domain-specific AI assistants (frontend, backend, testing, security)
- **Workflow Orchestrators**: Multi-step automation coordinators
- **Quality Gates**: Automated review and validation agents
- **Integration Agents**: Cross-system communication and data flow

### ⚡ Commands Directory
**Purpose**: Pre-built, optimized command workflows for common development tasks

**Current Commands**:
- `fold-prompt.md`: Project analysis and CLAUDE.md optimization workflow
- `playwright-test.md`: Automated application testing and error resolution

**Command Categories** (Planned):
- **Analysis**: Code review, performance analysis, security audits
- **Generation**: Boilerplate creation, documentation generation
- **Testing**: Unit tests, integration tests, E2E validation
- **Deployment**: CI/CD integration, environment management
- **Optimization**: Performance tuning, bundle analysis

### 🎣 Hooks Directory
**Purpose**: Event-driven automation for development lifecycle integration
- **Pre-commit**: Code quality validation, security scanning
- **Post-deployment**: Health checks, performance monitoring
- **Error Handling**: Automatic issue detection and resolution workflows
- **Productivity**: Time tracking, workflow optimization, reporting

## Configuration Standards

### Command Structure
```markdown
# Command Name
**Purpose**: Clear description of command objective
**Trigger**: When to use this command
**Prerequisites**: Required setup or dependencies
**Workflow**: Step-by-step execution process
**Output**: Expected results and artifacts
**Integration**: How it connects with other tools/workflows
```

### Agent Configuration
```yaml
agent_name:
  purpose: "Specific domain expertise"
  capabilities: ["list", "of", "core", "functions"]
  integration_points: ["claude_code", "external_tools"]
  performance_metrics: ["measurable", "outcomes"]
```

### Hook Specifications
```yaml
hook_name:
  trigger_event: "specific_lifecycle_event"
  execution_context: "when_and_where_to_run"
  dependencies: ["required", "tools", "or", "services"]
  success_criteria: "measurable_outcome"
```

## Development Workflow

### Git Operations
- **Primary Branch**: `main` (protected, requires PR review)
- **Feature Branches**: `feature/command-name` or `feature/agent-name`
- **Commit Convention**: Conventional commits with productivity impact metrics
- **Review Process**: Peer review required for all configuration changes

### Quality Gates
1. **Configuration Validation**: Syntax and structure verification
2. **Performance Testing**: Command execution time and resource usage
3. **Integration Testing**: Compatibility with Claude Code versions
4. **Documentation Review**: Clarity and completeness assessment
5. **User Acceptance**: Customer validation for productivity improvements

### Testing Strategy
- **Unit Testing**: Individual command and agent validation
- **Integration Testing**: Cross-component workflow verification
- **Performance Testing**: Execution speed and resource optimization
- **User Testing**: Real-world scenario validation with customers

## Usage Guidelines

### For Claude Code
When interacting with this repository:
1. **Analyze First**: Use `fold-prompt` command to understand project context
2. **Follow Standards**: Adhere to established configuration patterns
3. **Optimize Continuously**: Measure and improve productivity metrics
4. **Document Changes**: Maintain clear records of modifications and impacts
5. **Validate Integration**: Ensure compatibility with existing workflows

### For Developers
When contributing to this repository:
1. **Understand Context**: Review existing patterns and standards
2. **Measure Impact**: Quantify productivity improvements
3. **Test Thoroughly**: Validate all configurations before submission
4. **Document Clearly**: Provide comprehensive usage instructions
5. **Iterate Based on Feedback**: Continuously improve based on user experience

## Productivity Metrics

### Key Performance Indicators
- **Development Speed**: 30% reduction in routine task completion time
- **Error Reduction**: 50% decrease in configuration-related issues
- **Automation Coverage**: 80% of repetitive tasks automated
- **User Satisfaction**: 90% positive feedback on workflow improvements

### Measurement Framework
- **Baseline Metrics**: Pre-implementation performance measurements
- **Continuous Monitoring**: Real-time productivity tracking
- **Regular Reviews**: Monthly assessment of improvement trends
- **Customer Feedback**: Quarterly satisfaction and impact surveys

## Integration Ecosystem

### Claude Code Integration
- **Command Discovery**: Automatic detection of available commands
- **Context Awareness**: Intelligent command suggestion based on project state
- **Performance Optimization**: Resource usage monitoring and optimization
- **Error Handling**: Graceful failure recovery and user guidance

### External Tool Integration
- **Version Control**: Git hooks and workflow automation
- **CI/CD Pipelines**: Deployment and testing integration
- **Monitoring Tools**: Performance and health check integration
- **Communication**: Slack, Teams, and email notification workflows

## Future Roadmap

### Short Term (Next 30 Days)
- Expand command library with top 10 development workflows
- Implement basic hook framework for common lifecycle events
- Create initial agent library for specialized tasks
- Establish performance benchmarking and metrics collection

### Medium Term (Next 90 Days)
- Advanced AI agent orchestration and coordination
- Integration with popular development tools and platforms
- Customer-specific configuration templates and presets
- Comprehensive testing and validation framework

### Long Term (Next 180 Days)
- Machine learning-powered productivity optimization
- Advanced analytics and productivity insights
- Enterprise-grade security and compliance features
- Marketplace for community-contributed configurations

---

*Last Updated: [Auto-generated timestamp]*
*Version: 2.0*
*Maintainer: Fortium Software Configuration Team*