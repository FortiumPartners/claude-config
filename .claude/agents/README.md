# Sub-Agents Index - Leo's AI-Augmented Development Process

> These agents implement Leo's sub-agent mesh pattern for Claude Code + SuperClaude integration.

## Core Orchestration
- **meta-agent**: Chief orchestrator; spawns and improves specialists
- **general-purpose**: Handles ambiguous scope; routes to specialists  
- **context-fetcher**: Pulls authoritative references (AgentOS, Context7)

## Development Specialists
- **tech-lead-orchestrator**: Product → technical planning
- **frontend-developer**: Framework-agnostic UI with accessibility
- **backend-developer**: Server-side with clean architecture
- **code-reviewer**: Security/quality DoD enforcement
- **test-runner**: Unit/integration test execution and fixes
- **playwright-tester**: E2E testing with Playwright MCP

## Framework Specialists
- **react-component-architect**: React components with hooks
- **rails-backend-expert**: Rails controllers, services, jobs

## Utility Agents
- **documentation-specialist**: PRD/TRD/API docs/runbooks
- **git-workflow**: Safe git operations with conventional commits
- **file-creator**: File/directory creation with templates

## Command Integration
- `/plan` → meta-agent → tech-lead-orchestrator + context-fetcher
- `/build` → implement code; auto-invoke test-runner
- `/test e2e` → playwright-tester (Playwright MCP)
- `/review` → code-reviewer (DoD/security/performance)
- `/document` → documentation-specialist

## Tool Permissions Philosophy
Keep minimal by default. Expand only when needed. Prefer Read/Edit; add Bash for system operations. MCP tools explicitly granted.

## Continuous Improvement
Use meta-agent to refactor prompts and add specialists based on patterns.
