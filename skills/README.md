# Claude Code Skills

This directory contains reusable Claude Code Skills for the deep-debugger agent and other agents in the AI-Mesh ecosystem.

## What are Skills?

Skills are modular, directory-based capabilities that Claude can invoke during task execution. Unlike agents (which orchestrate complex workflows), skills provide focused, tactical functionality that can be reused across multiple agents.

## Skills Architecture

Each skill is a directory containing:

```
skill-name/
├── SKILL.md           # Main skill definition with YAML frontmatter (required)
├── REFERENCE.md       # Optional detailed reference (progressive disclosure)
├── scripts/           # Executable scripts for the skill
│   ├── run-*.{js,py,rb,cs}
│   └── generate-*.{js,py,rb,cs}
└── templates/         # Reusable templates
    └── *.template.*
```

### SKILL.md Format

Every skill must have a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: Skill Name
description: Brief description of what this skill does
version: 1.0.0
---

# Skill Name

## Purpose
[Description of skill purpose]

## Usage
[How to invoke the skill]

## Examples
[Usage examples]
```

## Progressive Disclosure

Skills use progressive disclosure:
1. **SKILL.md** is loaded first (lightweight overview)
2. **REFERENCE.md** is loaded only when Claude needs detailed API docs
3. **Scripts and templates** are invoked as needed

This keeps context usage efficient while providing comprehensive capabilities.

## Installation

Skills are installed via the ai-mesh installer:

```bash
# Global installation
npx @fortium/ai-mesh install --global

# Local project installation
npx @fortium/ai-mesh install --local
```

The installer copies skills from `skills/` to `.claude/skills/` (local) or `~/.claude/skills/` (global).

## Available Skills

### Test Framework Skills

#### test-detector
**Purpose**: Automatically detect test frameworks (Jest, pytest, RSpec, xUnit) in projects

**Invocation**:
```bash
node .claude/skills/test-detector/detect-framework.js /path/to/project
```

**Output**: JSON with detected frameworks and confidence scores

#### jest-test
**Purpose**: Execute and generate Jest tests for JavaScript/TypeScript projects

**Status**: Pending implementation

#### pytest-test
**Purpose**: Execute and generate pytest tests for Python projects

**Status**: Pending implementation

#### rspec-test
**Purpose**: Execute and generate RSpec tests for Ruby projects

**Status**: Pending implementation

#### xunit-test
**Purpose**: Execute and generate xUnit tests for C#/.NET projects

**Status**: Pending implementation

## Skill Development Guidelines

### Creating a New Skill

1. Create skill directory: `mkdir skills/your-skill-name/`
2. Create `SKILL.md` with YAML frontmatter
3. Add executable scripts (ensure `chmod +x`)
4. Add templates if needed
5. Add optional `REFERENCE.md` for detailed docs
6. Test skill invocation independently

### Skill Naming Conventions

- Use lowercase with hyphens: `test-detector`, `jest-test`
- Be specific and descriptive: `framework-detector` → `test-detector`
- Avoid generic names: `helper` → `test-helper`

### Script Guidelines

- **Entry point**: Main script should be runnable via `node script.js` or appropriate interpreter
- **CLI interface**: Accept arguments via `process.argv` or equivalent
- **Output format**: Use JSON for structured output to stdout
- **Error handling**: Output errors to stderr, exit with non-zero code
- **Documentation**: Include usage comments at top of script

### Testing Skills

Test skills independently before integration:

```bash
# Run skill directly
node skills/test-detector/detect-framework.js .

# With debug output
DEBUG=true node skills/test-detector/detect-framework.js /path/to/project
```

## Integration with Agents

Agents invoke skills using Claude's Skill tool:

1. **Agent identifies need**: "I need to detect the test framework"
2. **Invoke skill**: Use Skill tool with skill name
3. **Parse output**: Process JSON or text output from skill
4. **Continue workflow**: Use skill results for next step

Example from deep-debugger agent:

```markdown
1. Invoke test-detector skill with project path
2. Parse JSON to get primary framework
3. Invoke appropriate test skill (jest-test, pytest-test, etc.)
4. Generate tests using framework-specific patterns
```

## Benefits of Skills vs. Built-in Logic

✅ **Reusability**: Multiple agents can use the same skill
✅ **Maintainability**: Update skill logic in one place
✅ **Progressive Disclosure**: Load details only when needed
✅ **Separation of Concerns**: Agents orchestrate, skills execute
✅ **Team Collaboration**: Skills are git-committed and shared
✅ **Testing**: Skills can be tested independently

## Troubleshooting

### Skill Not Found

**Problem**: Agent can't find skill
**Solution**: Ensure skill is installed to `.claude/skills/` or `~/.claude/skills/`

```bash
ls ~/.claude/skills/     # Check global skills
ls .claude/skills/       # Check local skills
```

### Skill Validation Errors

**Problem**: Skill missing required SKILL.md or metadata
**Solution**: Verify SKILL.md has YAML frontmatter with `name` and `description`

```bash
head -10 skills/your-skill/SKILL.md
```

### Permission Errors

**Problem**: Script not executable
**Solution**: Set executable permissions

```bash
chmod +x skills/your-skill/your-script.js
```

## Contributing

When adding new skills:

1. Follow the directory structure above
2. Include comprehensive SKILL.md documentation
3. Test skill independently before committing
4. Update this README with skill description
5. Add skill to TRD task list if part of a sprint

## References

- [Claude Code Skills Documentation](https://docs.claude.com/en/docs/claude-code/skills)
- [Progressive Disclosure Pattern](https://docs.claude.com/en/docs/claude-code/skills#progressive-disclosure)
- [Agent Skills Engineering](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
