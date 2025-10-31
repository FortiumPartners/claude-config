# @ai-mesh-command
# Command: corrupted-yaml
# Version: 1.0.0
# Category: testing
# Source: fortium
# Maintainer: Test Team
# Last Updated: 2025-10-29

---
name: corrupted-yaml
description: Command with invalid YAML frontmatter
invalid_yaml_syntax: { unclosed bracket
  nested:
    - item1
    item2 without dash
---

## Mission

This command has valid metadata but corrupted YAML frontmatter.
The migration system should detect YAML parsing errors and handle gracefully.

## Expected Behavior

- **Detection**: YAML parser should fail on invalid syntax
- **Action**: Log error with file path and error details
- **Report**: Include in migration error summary
- **Partial Completion**: Continue with other files
