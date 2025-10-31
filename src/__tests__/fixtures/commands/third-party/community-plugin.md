# @ai-mesh-command
# Command: community-plugin
# Version: 2.0.0
# Category: utilities
# Source: community
# Maintainer: Community Developer (community@example.com)
# Last Updated: 2025-08-20

---
name: community-plugin
description: Community-developed plugin for specialized workflows
---

## Mission

This is a community-contributed command that should NOT be migrated to ai-mesh/ subdirectory.
It represents third-party extensions that users may have added to their installation.

## Key Points

- **Source**: Community (not fortium)
- **Location**: Should remain in root commands directory
- **Reason**: Third-party commands maintain their original location
- **Detection**: Migration system uses Source field to identify third-party commands

## Workflow

### Phase 1: Custom Processing

1. **Input Validation**: Validate community-specific parameters
2. **Processing**: Execute community plugin logic
3. **Output**: Generate community-specific results

## Expected Output

**Format**: Community plugin results

**Structure**:
- **Status**: Success or failure
- **Results**: Custom output from community plugin
