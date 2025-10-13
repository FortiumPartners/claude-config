COMMAND: /sprint-status
DESCRIPTION: Generate current sprint status report with task completion and blockers
VERSION: 1.0.0

PURPOSE:
Generate a comprehensive sprint status report including task completion percentages,
blockers, team velocity, and projected completion date based on current TRD progress.

WORKFLOW:

Phase 1: Data Collection
  1. TRD Analysis: Scan TRD files for task checkboxes
  2. Progress Calculation: Calculate completion percentages

Phase 2: Report Generation
  1. Status Report: Generate formatted status report

EXPECTED OUTPUT:
Format: Sprint Status Report
Structure:
- Completion Summary: Overall and per-category completion percentages
- Blockers: Identified blockers and dependencies
- Velocity: Team velocity and projected completion
