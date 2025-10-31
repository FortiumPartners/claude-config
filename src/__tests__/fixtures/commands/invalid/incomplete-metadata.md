# @ai-mesh-command
# Command: incomplete-command
# Version: 1.0.0
# Missing required fields: Category, Source, Maintainer, Last Updated

---
name: incomplete-command
description: Command with incomplete metadata header
---

## Mission

This command has the @ai-mesh-command header but is missing required metadata fields.
It should be detected and logged as an error during migration.

## Expected Behavior

- **Detection**: Migration system should identify missing required fields
- **Action**: Log error and skip this file
- **Report**: Include in migration error summary
