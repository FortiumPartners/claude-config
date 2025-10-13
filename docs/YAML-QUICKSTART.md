# YAML Architecture - Quick Start Guide

**Get up and running in 5 minutes**

---

## Step 1: Install Dependencies (1 minute)

```bash
cd claude-config
npm install
```

**Installs:**
- `js-yaml` - YAML parsing
- `ajv` - JSON Schema validation  
- `ajv-formats` - Extended validation

---

## Step 2: Verify Installation (30 seconds)

```bash
# Quick test
node -e "console.log('Testing...'); require('./src/parsers/yaml-parser'); require('./src/transformers/claude-transformer'); console.log('✅ All modules loaded successfully');"
```

---

## Step 3: Validate Pilot Agent (30 seconds)

```bash
# Test the pilot YAML agent
node << 'EOF'
const { YamlParser } = require('./src/parsers/yaml-parser');
const { Logger } = require('./src/utils/logger');

const logger = new Logger({ level: 'info' });
const parser = new YamlParser(logger);

parser.parse('agents/yaml/code-reviewer.yaml')
  .then(data => console.log('✅ Valid:', data.metadata.name))
  .catch(err => console.error('❌ Error:', err.message));
EOF
```

---

## Step 4: Transform to Markdown (1 minute)

```bash
# Transform YAML → Claude Code markdown
node << 'EOF'
const { YamlParser } = require('./src/parsers/yaml-parser');
const { ClaudeTransformer } = require('./src/transformers/claude-transformer');
const { Logger } = require('./src/utils/logger');
const fs = require('fs').promises;

const logger = new Logger({ level: 'info' });
const parser = new YamlParser(logger);
const transformer = new ClaudeTransformer(logger);

(async () => {
  const data = await parser.parse('agents/yaml/code-reviewer.yaml');
  const markdown = await transformer.transformAgent(data);
  await fs.writeFile('/tmp/code-reviewer-generated.md', markdown);
  console.log('✅ Generated: /tmp/code-reviewer-generated.md');
})();
EOF

# View result
head -30 /tmp/code-reviewer-generated.md
```

---

## Step 5: Compare Output (1 minute)

```bash
# Compare with original markdown
echo "📊 Line counts:"
wc -l agents/code-reviewer.md /tmp/code-reviewer-generated.md

echo ""
echo "📝 First 20 lines of generated:"
head -20 /tmp/code-reviewer-generated.md
```

---

## What's Next?

### Option A: Convert More Agents

```bash
# Copy template
cp agents/yaml/code-reviewer.yaml agents/yaml/frontend-developer.yaml

# Edit with your favorite editor
code agents/yaml/frontend-developer.yaml  # VS Code
vim agents/yaml/frontend-developer.yaml   # Vim
nano agents/yaml/frontend-developer.yaml  # Nano

# Validate
node -e "new (require('./src/parsers/yaml-parser').YamlParser)(require('./src/utils/logger').Logger()).parse('agents/yaml/frontend-developer.yaml').then(() => console.log('✅ Valid')).catch(e => console.error('❌', e.message));"
```

### Option B: Test OpenCode Output

```bash
# Transform to plain text
node << 'EOF'
const { YamlParser } = require('./src/parsers/yaml-parser');
const { OpenCodeTransformer } = require('./src/transformers/opencode-transformer');
const { Logger } = require('./src/utils/logger');
const fs = require('fs').promises;

const logger = new Logger({ level: 'info' });
const parser = new YamlParser(logger);
const transformer = new OpenCodeTransformer(logger);

(async () => {
  const data = await parser.parse('agents/yaml/code-reviewer.yaml');
  const text = await transformer.transformAgent(data);
  await fs.writeFile('/tmp/code-reviewer-opencode.txt', text);
  console.log('✅ Generated: /tmp/code-reviewer-opencode.txt');
})();
EOF

# View OpenCode format
head -30 /tmp/code-reviewer-opencode.txt
```

### Option C: Update Installer (Advanced)

The agent/command installers need updating to use YAML. See:
- `src/installer/agent-installer.js` (needs YAML integration)
- `src/installer/command-installer.js` (needs YAML integration)

Reference the architecture in `docs/YAML-ARCHITECTURE-SUMMARY.md`

---

## Troubleshooting

### Error: Cannot find module

```bash
# Install dependencies
npm install

# Verify
npm list js-yaml ajv ajv-formats
```

### Error: YAML parsing failed

```bash
# Check YAML syntax
npx js-yaml agents/yaml/code-reviewer.yaml
```

### Error: Validation failed

```bash
# View detailed errors
node << 'EOF'
const { YamlParser } = require('./src/parsers/yaml-parser');
const { Logger } = require('./src/utils/logger');

const logger = new Logger({ level: 'debug' });  // Enable debug
const parser = new YamlParser(logger);

parser.parse('agents/yaml/code-reviewer.yaml')
  .catch(err => console.error('Full error:\n', err.message));
EOF
```

---

## Quick Reference

### YAML Agent Structure

```yaml
metadata:
  name: agent-name
  description: Short description
  version: 1.0.0
  category: specialist
  tools: [Read, Write, Edit]

mission:
  summary: |
    What this agent does

responsibilities:
  - priority: high
    title: Main responsibility
    description: Details

examples:
  - id: example-id
    title: Example Name
    antiPattern:
      language: javascript
      code: |
        // Bad code
      issues:
        - Problem 1
    bestPractice:
      language: javascript
      code: |
        // Good code
      benefits:
        - Benefit 1
```

### Validation Command

```bash
node -e "new (require('./src/parsers/yaml-parser').YamlParser)(new (require('./src/utils/logger').Logger)()).parse('PATH_TO_YAML').then(() => console.log('✅')).catch(e => console.error('❌', e.message));"
```

### Transform Command

```bash
node -e "const p=require('./src/parsers/yaml-parser').YamlParser,t=require('./src/transformers/claude-transformer').ClaudeTransformer,l=new (require('./src/utils/logger').Logger)();new p(l).parse('INPUT.yaml').then(d=>new t(l).transformAgent(d)).then(m=>require('fs').writeFileSync('OUTPUT.md',m)).then(()=>console.log('✅'));"
```

---

## Success Criteria

You've successfully set up the YAML architecture when:

- ✅ Dependencies installed without errors
- ✅ Pilot agent validates successfully
- ✅ Transformation generates valid markdown
- ✅ Output matches expected format
- ✅ OpenCode format works (optional)

---

## Need Help?

1. **Documentation**: `docs/YAML-MIGRATION-GUIDE.md`
2. **Examples**: `agents/yaml/code-reviewer.yaml`
3. **Schemas**: `schemas/agent-schema.json`
4. **Issues**: GitHub Issues
5. **Team**: Slack #claude-config

---

**Time to Complete**: 5 minutes  
**Difficulty**: Easy  
**Prerequisites**: Node.js 18+

---

**Last Updated**: October 13, 2025
