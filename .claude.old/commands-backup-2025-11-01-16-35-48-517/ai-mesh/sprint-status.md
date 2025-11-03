# @ai-mesh-command
# Command: sprint-status
# Version: 1.0.0
# Category: analysis
# Source: fortium
# Maintainer: Fortium Software Configuration Team
# Last Updated: 2025-10-13

---
name: sprint-status
description: Generate current sprint status report with task completion and blockers
version: 1.0.0
category: analysis
---

## Mission

Generate a comprehensive sprint status report including task completion percentages,
blockers, team velocity, and projected completion date based on current TRD progress.



## Workflow

### Phase 1: Data Collection

1. **TRD Analysis**: Scan TRD files for task checkboxes
2. **Progress Calculation**: Calculate completion percentages

### Phase 2: Report Generation

1. **Status Report**: Generate formatted status report


## Expected Output

**Format**: Sprint Status Report

**Structure**:
- **Completion Summary**: Overall and per-category completion percentages
- **Blockers**: Identified blockers and dependencies
- **Velocity**: Team velocity and projected completion
