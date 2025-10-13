# YAML Migration Guide
## Converting Agents and Commands from Markdown to YAML

**Version**: 3.0.0  
**Date**: October 2025  
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Why YAML?](#why-yaml)
3. [Architecture](#architecture)
4. [Installation](#installation)
5. [YAML Schema Reference](#yaml-schema-reference)
6. [Migration Steps](#migration-steps)
7. [Testing & Validation](#testing--validation)
8. [Tool-Specific Output](#tool-specific-output)
9. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers the migration from Markdown-based agents/commands to YAML-based source files with tool-specific transformation. The new architecture provides:

- ✅ **Single Source of Truth**: One YAML file generates multiple tool formats
- ✅ **Schema Validation**: JSON Schema ensures structural correctness
- ✅ **Multi-Tool Support**: Claude Code, OpenCode, and easily extensible
- ✅ **Better Maintainability**: Structured data vs. freeform markdown
- ✅ **Backward Compatibility**: Markdown files remain supported

---

## Why YAML?

### Comparison with Alternatives

| Feature | YAML | XML | JSON | Markdown |
|---------|------|-----|------|----------|
| **Human Readable** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Code Examples** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Validation** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **Tooling** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Migration Effort** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Winner: YAML** - Best balance of readability, structure, and validation.

---

## Architecture

### Directory Structure

```
claude-config/
├── schemas/                    # JSON Schemas for validation
│   ├── agent-schema.json
│   └── command-schema.json
├── src/
│   ├── parsers/               # YAML parsing and validation
│   │   └── yaml-parser.js
│   ├── transformers/          # Tool-specific transformers
│   │   ├── base-transformer.js
│   │   ├── claude-transformer.js
│   │   ├── opencode-transformer.js
│   │   └── transformer-factory.js
│   └── installer/
│       ├── tool-detector.js   # Auto-detect Claude/OpenCode
│       ├── agent-installer.js # Updated for YAML
│       └── command-installer.js
├── agents/
│   ├── yaml/                  # NEW: YAML source files
│   │   ├── code-reviewer.yaml
│   │   ├── frontend-developer.yaml
│   │   └── ...
│   └── *.md                   # Legacy markdown (kept for compatibility)
└── commands/
    ├── yaml/
    │   ├── create-trd.yaml
    │   └── ...
    └── *.md
```

### Data Flow

```
┌─────────────────┐
│  YAML Source    │  agents/yaml/code-reviewer.yaml
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  YAML Parser    │  src/parsers/yaml-parser.js
│  + Validation   │  (validates against JSON Schema)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Tool Detection  │  Auto-detect Claude Code / OpenCode
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Transformer    │  claude-transformer.js / opencode-transformer.js
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Output Format   │  ~/.claude/agents/code-reviewer.md (Claude)
│                 │  ~/.opencode/agents/code-reviewer.txt (OpenCode)
└─────────────────┘
```

---

## Installation

### 1. Install Dependencies

```bash
cd claude-config
npm install
```

**New Dependencies:**
- `js-yaml`: ^4.1.0 - YAML parsing
- `ajv`: ^8.12.0 - JSON Schema validation
- `ajv-formats`: ^2.1.1 - Additional schema formats

### 2. Verify Installation

```bash
# Test YAML parser
node -e "const {YamlParser} = require('./src/parsers/yaml-parser'); console.log('✅ Parser loaded');"

# Test transformers
node -e "const {ClaudeTransformer} = require('./src/transformers/claude-transformer'); console.log('✅ Transformers loaded');"
```

---

## YAML Schema Reference

### Agent Schema

```yaml
# Minimal agent structure
metadata:
  name: agent-name               # kebab-case identifier
  description: One-line description (20-200 chars)
  version: 1.0.0                 # Semantic versioning
  category: specialist           # orchestrator|specialist|framework-specialist|quality|workflow
  tools:                         # List of allowed tools
    - Read
    - Write
    - Edit
  languages:                     # Optional: primary languages
    - javascript
    - typescript
  frameworks:                    # Optional: primary frameworks
    - react
    - vue

mission:
  summary: |
    Comprehensive mission statement (minimum 50 characters)
    Can span multiple lines using YAML literal block
  
  boundaries:                    # Optional but recommended
    handles: What this agent does
    doesNotHandle: What to delegate
    collaboratesOn: Shared responsibilities
  
  expertise:                     # Optional
    - name: Expertise Area
      description: Detailed description

responsibilities:                # At least 1 required
  - priority: high               # high|medium|low
    title: Responsibility Title
    description: What this responsibility entails

examples:                        # Optional but recommended
  - id: example-id               # kebab-case
    category: security           # accessibility|performance|security|testing|architecture|patterns
    title: Human-readable title
    
    antiPattern:
      language: typescript
      code: |
        // Bad code example here
        function badExample() {}
      issues:
        - Issue 1
        - Issue 2
    
    bestPractice:
      language: typescript
      code: |
        // Good code example here
        function goodExample() {}
      benefits:
        - Benefit 1
        - Benefit 2

qualityStandards:                # Optional
  codeQuality:
    - name: Standard Name
      description: What it requires
      enforcement: required      # required|recommended|optional
  
  testing:
    unit:
      minimum: 80                # Percentage
      description: Coverage description
    integration:
      minimum: 70
  
  performance:
    - name: Metric Name
      target: "200ms"
      unit: milliseconds
      description: What this measures

integrationProtocols:            # Optional
  handoffFrom:
    - agent: source-agent-name
      context: What you receive
      acceptanceCriteria:
        - Criterion 1
        - Criterion 2
  
  handoffTo:
    - agent: destination-agent-name
      deliverables: What you provide
      qualityGates:
        - Gate 1
        - Gate 2

delegationCriteria:              # Optional but recommended
  whenToUse:
    - Scenario 1
    - Scenario 2
  
  whenToDelegate:
    - agent: other-agent-name
      triggers:
        - Trigger 1
        - Trigger 2
```

### Command Schema

```yaml
metadata:
  name: command-name
  description: One-line description
  version: 1.0.0
  category: planning             # planning|implementation|testing|documentation|deployment|analysis

mission:
  summary: |
    What this command does (minimum 50 characters)

workflow:
  phases:
    - name: Phase Name
      order: 1                   # Execution order
      steps:
        - order: 1
          title: Step Title
          description: What this step does
          actions:               # Optional
            - Action 1
            - Action 2
          delegation:            # Optional
            agent: agent-name
            context: Context info

expectedInput:                   # Optional
  format: Document format name
  sections:
    - name: Section Name
      required: true             # true|false
      description: What it contains

expectedOutput:                  # Optional
  format: Document format name
  structure:
    - name: Section Name
      description: What it contains
```

---

## Migration Steps

### Step 1: Convert One Pilot Agent

Let's convert `code-reviewer.md` to YAML:

**1. Create YAML file:**

```bash
touch agents/yaml/code-reviewer.yaml
```

**2. Extract frontmatter → metadata:**

```yaml
# From Markdown frontmatter:
---
name: code-reviewer
description: Security-enhanced code review
tools: Read, Write, Edit
version: 2.1.0
category: quality
---

# To YAML metadata:
metadata:
  name: code-reviewer
  description: Security-enhanced code review with comprehensive DoD enforcement
  version: 2.1.0
  category: quality
  tools:
    - Read
    - Write
    - Edit
```

**3. Convert Mission section:**

```yaml
mission:
  summary: |
    You are a specialized code review agent focused on enforcing Definition of Done...
  
  boundaries:
    handles: |
      Code review, security scanning, DoD enforcement, test coverage validation
    
    doesNotHandle: |
      Initial code implementation (delegate to frontend-developer)
```

**4. Convert Responsibilities:**

```yaml
responsibilities:
  - priority: high
    title: Security Vulnerability Detection
    description: Scan for SQL injection, XSS, CSRF, and other security issues
  
  - priority: high
    title: Definition of Done Enforcement
    description: Validate all 8 DoD categories before approving any PR
```

**5. Convert Code Examples:**

```yaml
examples:
  - id: sql-injection-detection
    category: security
    title: SQL Injection Vulnerability Detection
    
    antiPattern:
      language: javascript
      code: |
        // ❌ CRITICAL: SQL Injection vulnerability
        function getUserById(userId) {
          const query = `SELECT * FROM users WHERE id = ${userId}`;
          return db.query(query);
        }
      issues:
        - Direct string interpolation in SQL query
        - No input validation
    
    bestPractice:
      language: javascript
      code: |
        // ✅ SECURE: Parameterized query
        function getUserById(userId) {
          const query = 'SELECT * FROM users WHERE id = ?';
          return db.query(query, [userId]);
        }
      benefits:
        - Parameterized queries prevent SQL injection
        - Input validation catches malformed requests
```

**6. Convert remaining sections** (qualityStandards, integrationProtocols, delegationCriteria)

See `agents/yaml/code-reviewer.yaml` for complete example.

### Step 2: Validate YAML

```bash
# Create validation script
cat > validate-agent.js << 'EOF'
const { YamlParser } = require('./src/parsers/yaml-parser');
const { Logger } = require('./src/utils/logger');

const logger = new Logger({ level: 'debug' });
const parser = new YamlParser(logger);

async function validate(filePath) {
  try {
    const data = await parser.parse(filePath);
    console.log('✅ Valid YAML:', filePath);
    console.log('Agent:', data.metadata.name);
    console.log('Version:', data.metadata.version);
    console.log('Examples:', data.examples?.length || 0);
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    process.exit(1);
  }
}

validate(process.argv[2]);
