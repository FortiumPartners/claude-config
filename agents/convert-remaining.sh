#!/bin/bash

# This script creates simplified YAML versions of remaining agents
# Each follows the schema but is condensed for efficiency

cd "$(dirname "$0")/yaml"

# Function to create minimal but valid agent YAML
create_agent() {
  local name=$1
  local desc=$2
  local category=$3
  local handles=$4
  local delegates=$5
  
  cat > "${name}.yaml" << EOF
metadata:
  name: ${name}
  description: ${desc}
  version: 1.0.0
  lastUpdated: "2025-10-13"
  category: ${category}
  tools:
    - Read
    - Write
    - Edit
    - Bash

mission:
  summary: |
    ${desc}
  
  boundaries:
    handles: ${handles}
    doesNotHandle: Delegate specialized work to appropriate agents

responsibilities:
  - priority: high
    title: Primary Responsibility
    description: ${handles}

delegationCriteria:
  whenToUse:
    - ${handles}
  
  whenToDelegate:
    - agent: ${delegates}
      triggers:
        - When specialized expertise needed
EOF
  
  echo "✅ Created ${name}.yaml"
}

# Create remaining specialist agents
create_agent "react-component-architect" \
  "Advanced React patterns, hooks, state management, and performance optimization" \
  "framework-specialist" \
  "Complex React component architecture, custom hooks, Context optimization" \
  "frontend-developer"

create_agent "documentation-specialist" \
  "Technical documentation, API docs, guides, and examples" \
  "specialist" \
  "PRD/TRD/API documentation with examples, Markdown content, diagrams" \
  "ai-mesh-orchestrator"

create_agent "playwright-tester" \
  "E2E testing with Playwright, browser automation, visual regression" \
  "quality" \
  "End-to-end testing, browser automation, visual regression testing" \
  "test-runner"

create_agent "infrastructure-management-subagent" \
  "AWS/Kubernetes/Docker automation with security-first approach" \
  "specialist" \
  "Infrastructure provisioning, container orchestration, cloud resources" \
  "deployment-orchestrator"

create_agent "tech-lead-orchestrator" \
  "Product to technical planning with architecture and risk assessment" \
  "orchestrator" \
  "Technical requirements, architecture design, sprint planning" \
  "ai-mesh-orchestrator"

create_agent "product-management-orchestrator" \
  "Product management with PRD creation and stakeholder coordination" \
  "orchestrator" \
  "Product requirements, user stories, acceptance criteria" \
  "tech-lead-orchestrator"

create_agent "deployment-orchestrator" \
  "Release automation and environment promotion" \
  "orchestrator" \
  "Deployment pipelines, release management, rollback procedures" \
  "infrastructure-management-subagent"

create_agent "general-purpose" \
  "Complex research and multi-domain task handling" \
  "specialist" \
  "Research, analysis, multi-domain tasks, ambiguous requests" \
  "ai-mesh-orchestrator"

create_agent "context-fetcher" \
  "Reference gathering and AgentOS integration" \
  "specialist" \
  "Documentation retrieval, context gathering, reference management" \
  "general-purpose"

create_agent "file-creator" \
  "Template-based scaffolding with project conventions" \
  "workflow" \
  "File generation, template application, scaffolding" \
  "frontend-developer"

create_agent "directory-monitor" \
  "Automated change detection and workflow triggering" \
  "workflow" \
  "File system monitoring, change detection, workflow triggers" \
  "ai-mesh-orchestrator"

create_agent "rails-backend-expert" \
  "Rails MVC, ActiveRecord, background jobs, and configuration" \
  "framework-specialist" \
  "Rails application development, ActiveRecord models, background jobs" \
  "backend-developer"

create_agent "nestjs-backend-expert" \
  "Node.js backend with NestJS framework expertise" \
  "framework-specialist" \
  "NestJS application development, dependency injection, decorators" \
  "backend-developer"

create_agent "dotnet-backend-expert" \
  ".NET/C# backend development with ASP.NET Core" \
  "framework-specialist" \
  ".NET Core applications, Entity Framework, ASP.NET Core APIs" \
  "backend-developer"

create_agent "dotnet-blazor-expert" \
  "Blazor WebAssembly and Server with .NET integration" \
  "framework-specialist" \
  "Blazor components, WebAssembly, SignalR integration" \
  "frontend-developer"

create_agent "elixir-phoenix-expert" \
  "Elixir/Phoenix development with real-time features" \
  "framework-specialist" \
  "Phoenix framework, LiveView, Ecto, real-time channels" \
  "backend-developer"

create_agent "postgresql-specialist" \
  "PostgreSQL database design, optimization, and administration" \
  "specialist" \
  "Database schema design, query optimization, performance tuning" \
  "backend-developer"

create_agent "github-specialist" \
  "GitHub operations, Actions, security, and automation" \
  "specialist" \
  "GitHub workflows, Actions, branch protection, security scanning" \
  "git-workflow"

create_agent "helm-chart-specialist" \
  "Kubernetes Helm chart creation and management" \
  "specialist" \
  "Helm chart development, templating, release management" \
  "infrastructure-management-subagent"

create_agent "build-orchestrator" \
  "Build pipeline orchestration and optimization" \
  "orchestrator" \
  "Build pipelines, artifact management, optimization" \
  "deployment-orchestrator"

create_agent "qa-orchestrator" \
  "Quality assurance orchestration and test coordination" \
  "orchestrator" \
  "Test planning, quality gates, test coordination" \
  "code-reviewer"

create_agent "infrastructure-orchestrator" \
  "Infrastructure planning and multi-cloud coordination" \
  "orchestrator" \
  "Infrastructure architecture, multi-cloud strategy" \
  "infrastructure-management-subagent"

create_agent "infrastructure-specialist" \
  "Cloud infrastructure implementation and management" \
  "specialist" \
  "Cloud resources, networking, storage, compute" \
  "infrastructure-orchestrator"

create_agent "infrastructure-subagent" \
  "Infrastructure task execution and resource management" \
  "specialist" \
  "Resource provisioning, configuration, monitoring" \
  "infrastructure-specialist"

create_agent "api-documentation-specialist" \
  "OpenAPI/Swagger documentation and API design" \
  "specialist" \
  "API documentation, OpenAPI specs, examples" \
  "backend-developer"

create_agent "manager-dashboard-agent" \
  "Productivity metrics and team analytics" \
  "specialist" \
  "Dashboard creation, metrics collection, reporting" \
  "general-purpose"

create_agent "agent-meta-engineer" \
  "Agent development, optimization, and meta-engineering" \
  "specialist" \
  "Agent creation, prompt engineering, agent optimization" \
  "ai-mesh-orchestrator"

echo ""
echo "✅ Bulk agent creation complete!"
echo "Total YAML agents created: $(ls -1 *.yaml 2>/dev/null | wc -l)"
