---
name: create-prd
description: Comprehensive product analysis and PRD creation with user personas, goals, and acceptance criteria
usage: /create-prd [product description or requirements]
agent: tech-lead-orchestrator
---

# Product Planning & PRD Creation

## Mission

Route product planning requests to the product-management-orchestrator agent for comprehensive product analysis and PRD (Product Requirements Document) creation. This command transforms product ideas or requirements into structured documentation following AgentOS standards.

## What This Command Does

- **Product Analysis**: Deep analysis of product requirements, market context, and user needs
- **PRD Creation**: Complete Product Requirements Document with structured templates
- **User Research**: User personas, pain points, and journey mapping
- **Goal Definition**: Clear product goals, success metrics, and non-goals
- **Acceptance Criteria**: Functional, performance, security, and accessibility requirements
- **Context Integration**: Leverages Context7 MCP for vendor documentation and best practices
- **Alawys**: Write PRD files too @docs/PRD/

## Usage Patterns

### Basic Product Planning

```
/create-prd "Build a task management app for remote teams"
```

### Detailed Requirements Analysis

```
/create-prd "E-commerce platform with inventory management, payment processing, and multi-vendor support"
```

### Feature Planning

```
/create-prd "Add real-time collaboration features to existing document editor"
```

## Output Structure

The tech-lead-orchestrator will generate:

1. **Product Summary**: Clear problem statement and solution overview
2. **User Analysis**: Primary personas, pain points, and use cases
3. **Goals & Non-Goals**: What the product will and won't do
4. **Acceptance Criteria**: Comprehensive requirements across all dimensions
5. **Technical Considerations**: Architecture implications and constraints
6. **Success Metrics**: Measurable outcomes and KPIs

## Integration Points

- **AgentOS Standards**: Uses PRD.md template from docs/agentos/
- **Context7 MCP**: Pulls relevant vendor documentation and patterns
- **Product Context**: References .agent-os/product/ files for consistency
- **Quality Gates**: Ensures acceptance criteria meet DoD standards

## Handoff Protocol

After PRD creation, the tech-lead-orchestrator can:

- Route to specific development agents for technical planning
- Update project context in .agent-os/product/ files
- Create or update tickets via MCP integration
- Initiate development workflow with /execute-tasks

## Best Practices

- Provide clear product context and constraints
- Include target user information when available
- Specify technical preferences or limitations
- Reference existing documentation or systems
- Be specific about scope and timeline expectations

---

_This command implements Leo's AI-Augmented Development Process for structured product planning and requirements analysis._
