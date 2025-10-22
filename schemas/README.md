# Claude Code Schemas

This directory contains JSON Schema definitions for validating YAML files used in the claude-config project.

## Available Schemas

### agent-schema.json

**Purpose**: Validates Claude agent YAML files in `agents/yaml/`

**Key Features**:
- Enforces required metadata (name, version, description, category, tools)
- Validates mission statements and responsibility definitions
- Ensures proper tool allocation and permission management
- Supports quality standards and integration protocols

**Usage**:
```yaml
# agents/yaml/example-agent.yaml
metadata:
  name: example-agent
  description: "Example agent for demonstration purposes"
  version: 1.0.0
  category: specialist
  tools: [Read, Write, Edit]
```

**Validation**: Automatically enforced during agent deployment via `src/installer/agent-installer.js`

---

### skill-schema.json

**Purpose**: Validates framework skill YAML frontmatter in `skills/*/SKILL.md` files

**Key Features**:
- Enforces semantic versioning for skills and framework compatibility
- Validates agent version requirements
- Ensures proper framework and language classification
- Supports optional metadata (maintainer, breaking changes, migration notes)

**Required Fields**:
- `name`: Human-readable framework name
- `version`: Skill version (semver: `1.2.0`)
- `framework_versions`: Min/max/recommended framework versions
- `compatible_agents`: Agent version requirements (e.g., `>=3.0.0`)
- `description`: One-line framework description (20-200 chars)
- `frameworks`: Framework identifiers (kebab-case array)
- `languages`: Programming languages (enum-validated)

**Optional Fields**:
- `updated`: Last update date (ISO 8601)
- `maintainer`: Primary maintainer email
- `breaking_changes`: Array of breaking changes
- `migration_notes`: Upgrade guidance
- `category`: Skill category (backend/frontend/fullstack/etc.)
- `tags`: Additional searchability tags

**Usage Example**:
```yaml
---
name: NestJS Framework
version: 1.0.0
framework_versions:
  min: 10.0.0
  max: 11.x
  recommended: 11.4.0
compatible_agents:
  backend-developer: ">=3.0.0"
  tech-lead-orchestrator: ">=2.5.0"
description: Node.js/TypeScript backend framework with dependency injection, decorators, and modular architecture
frameworks:
  - nestjs
languages:
  - typescript
  - javascript
updated: 2025-10-21
maintainer: team@fortium.dev
category: backend
tags:
  - nodejs
  - rest-api
  - microservices
  - dependency-injection
---

# NestJS Framework Skill

[Skill content follows...]
```

**Validation**: Enforced during skill loading via `lib/skill-loader.js` (TRD-003)

---

## Validation Process

### Agent Validation

1. **Pre-deployment**: Schema validation runs before agent installation
2. **Error Reporting**: Clear error messages with field-level validation failures
3. **Auto-correction**: Some fields (e.g., kebab-case names) can be auto-corrected
4. **Failure Handling**: Invalid agents are rejected with detailed error logs

### Skill Validation

1. **Lazy Loading**: Validation occurs when skill is first loaded by an agent
2. **Caching**: Valid skills are cached; invalid skills trigger error prompts
3. **User Feedback**: Missing/invalid fields prompt user with correction options
4. **Graceful Degradation**: Agents can continue with generic patterns if skill invalid

## Schema Development

### Adding New Fields

1. Update appropriate schema JSON file
2. Add field to examples section
3. Update validation logic in installer/loader
4. Document in this README
5. Add tests for new field validation

### Version Management

Schemas follow semantic versioning:
- **Major**: Breaking changes to required fields
- **Minor**: New optional fields or expanded enums
- **Patch**: Bug fixes to validation patterns

Current versions:
- `agent-schema.json`: v1.0.0
- `skill-schema.json`: v1.0.0

## References

- [JSON Schema Documentation](https://json-schema.org/understanding-json-schema/)
- [JSON Schema Draft 07](http://json-schema.org/draft-07/schema)
- [Agent Architecture](../agents/README.md)
- [Skills Architecture](../skills/README.md)
- [Skills-Based Framework TRD](../docs/TRD/skills-based-framework-agents-trd.md)
