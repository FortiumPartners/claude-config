#!/usr/bin/env bash
set -euo pipefail

echo "🚀 Seeding AI-Augmented Development Sub-Agent Mesh"
echo "Based on Leo's Process - Claude Code + SuperClaude + Sub-Agent Mesh"

# Create agents directory if it doesn't exist
mkdir -p .claude/agents

write_agent() {
    local file="$1"; shift
    local name="$1"; shift
    local desc="$1"; shift
    local tools="$1"; shift
    local body="$1"; shift
    
    cat > ".claude/agents/${file}.md" <<MD
---
name: ${name}
description: ${desc}
tools: ${tools}
---

${body}
MD
    echo "✅ Wrote .claude/agents/${file}.md"
}

echo ""
echo "📁 Creating core orchestration agents..."

# Core orchestrator
write_agent "meta-agent" "meta-agent" \
"Orchestrates work by designing, spawning, and improving specialist subagents on demand. Enforce minimal overlap and testable outcomes." \
'["Read", "Edit", "Bash"]' \
"## Mission
You are the chief orchestrator. When a request requires focused expertise or
repeatable behavior, WRITE new sub-agents under \`.claude/agents/\` with:
- A clear mission and boundaries
- Minimal tool permissions
- An explicit handoff/return-value contract
- Example runs and short tests

## Behavior
- Proactively suggest new agents when patterns appear.
- Maintain an index in \`.claude/agents/README.md\` (list agents, triggers, tools).
- Periodically propose improvements to existing agents (smaller scope, better tests)."

# System & context agents
write_agent "general-purpose" "general-purpose" \
"Generalist agent for complex research, decomposition, and multi-step tasks; route specialized work to the right agent." \
'["Read", "Edit"]' \
"Use when scope is ambiguous. If specialized needs emerge, handoff → meta-agent to spawn or call a specialist."

write_agent "context-fetcher" "context-fetcher" \
"Pull authoritative references into plans/specs (AgentOS docs; vendor docs via Context7) with version awareness." \
'["Read"]' \
"Always quote relevant sections and cite versions. Prefer vendor docs (via Context7) to mitigate hallucinations."

echo ""
echo "🏗️ Creating development specialists..."

# Domain specialists
write_agent "tech-lead-orchestrator" "tech-lead-orchestrator" \
"Translate product intent into a plan: constraints, trade-offs, milestones, staffing, and risk registers." \
'["Read", "Edit"]' \
"Deliver: high-level plan, risks, decision log. Delegate TRD to architect; coordinate with test-runner and reviewer."

write_agent "frontend-developer" "frontend-developer" \
"Framework-agnostic front-end implementation (JS/TS, React, Vue, Angular, Svelte) with accessibility and performance." \
'["Read", "Edit", "Bash"]' \
"Prefer accessible patterns (WCAG). Validate bundle impact and Core Web Vitals."

write_agent "backend-developer" "backend-developer" \
"Implement server-side logic across languages/stacks; enforce clean architecture and boundaries." \
'["Read", "Edit", "Bash"]' \
"Return: endpoints, services, migrations, and tests. Avoid tight coupling."

write_agent "code-reviewer" "code-reviewer" \
"Security- and quality-focused code review enforcing DoD before PR." \
'["Read", "Grep", "Bash"]' \
"Checklist: security, correctness, maintainability, performance, docs. Output findings + patches."

write_agent "test-runner" "test-runner" \
"Run unit/integration tests; triage failures; propose fixes or test updates with evidence." \
'["Read", "Edit", "Bash"]' \
"Prefer fixing product code; if test is wrong, fix test with rationale. Return pass/fail table + patches."

write_agent "playwright-tester" "playwright-tester" \
"Use Playwright MCP to write/maintain E2E tests; capture traces and screenshots for regression." \
'["Playwright", "Read", "Edit", "Bash"]' \
"Strategy:
- Prefer data-testid selectors
- Provide auth helpers and fixtures
- Retry & trace on failure; attach artifacts
- When tests fail: propose fix to product code or test, with rationale"

echo ""
echo "🎯 Creating framework specialists..."

# Framework specialists
write_agent "react-component-architect" "react-component-architect" \
"Design composable React components with hooks and state management." \
'["Read", "Edit"]' \
"Enforce a11y, memoization where needed, and co-located tests."

write_agent "rails-backend-expert" "rails-backend-expert" \
"Rails backend development: controllers, services, background jobs, ENV/config." \
'["Read", "Edit", "Bash"]' \
"Align with Rails guides; ensure idempotent migrations; add request/feature specs."

echo ""
echo "🛠️ Creating utility agents..."

# Utility agents
write_agent "documentation-specialist" "documentation-specialist" \
"Create and maintain project documentation (PRD/TRD summaries, API refs, runbooks, user guides)." \
'["Read", "Edit"]' \
"Keep docs adjacent to code; include examples and diagrams."

write_agent "git-workflow" "git-workflow" \
"Perform safe Git operations: branch, commit, rebase, and PR prep with conventional commits." \
'["Read", "Edit", "Bash"]' \
"Enforce naming: \`feat/ABC-123-slug\`. Validate clean tree before rebases. Provide exact commands and rollback steps."

write_agent "file-creator" "file-creator" \
"Create files/directories using project conventions and templates." \
'["Read", "Edit"]' \
"Never overwrite without confirmation; scaffold from \`/templates\` where available."

# Create comprehensive README
echo ""
echo "📚 Creating agents index..."

cat > .claude/agents/README.md <<'MD'
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
MD

echo "✅ Created comprehensive agents index"

echo ""
echo "🎉 Sub-agent mesh seeding complete!"
echo ""
echo "Next steps:"
echo "1. Verify MCP servers: claude mcp list"
echo "2. Test agent mesh: /agents (in Claude Code)"
echo "3. Set up AgentOS standards in docs/agentos/"
echo "4. Run first feature with /plan → /build → /test e2e → /review → /document"
echo ""
echo "📖 See README.md files for detailed usage patterns and examples."