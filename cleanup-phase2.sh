#!/bin/bash
# Phase 2 Cleanup: Backend Development Artifacts and Legacy Python Systems
# Repository: claude-config
# Date: 2025-10-03

set -e  # Exit on error

echo "========================================="
echo "Phase 2 Cleanup - Backend Artifacts"
echo "========================================="
echo ""

# Save current file count
INITIAL_FILES=$(git ls-files | wc -l)
echo "Initial tracked files: $INITIAL_FILES"
echo ""

# Create archive directory for historical docs
echo "Creating archive directory..."
mkdir -p docs/archive/development-history
git add docs/archive/development-history

# Step 1: Remove Docker Infrastructure
echo "Step 1: Removing Docker infrastructure..."
git rm -r docker/
git rm docker-compose.yml
echo "  ✓ Docker infrastructure removed"
echo ""

# Step 2: Remove Infrastructure Directories
echo "Step 2: Removing infrastructure templates..."
git rm -r infrastructure/
git rm -r infrastructure-templates/
echo "  ✓ Infrastructure templates removed"
echo ""

# Step 3: Remove Python Analytics System
echo "Step 3: Removing Python analytics system..."
git rm -r src/analytics/
git rm -r src/dashboard/
git rm -r src/enforcement/
git rm -r src/state/
git rm -r src/tracing/
git rm -r src/common/
git rm -r src/config/
git rm src/config-manager.js
echo "  ✓ Python analytics system removed"
echo ""

# Step 4: Remove Python Dependencies
echo "Step 4: Removing Python dependencies..."
git rm main.py
git rm pyproject.toml
git rm uv.lock
git rm test_analytics_manual.py
echo "  ✓ Python dependencies removed"
echo ""

# Step 5: Remove Test Directories
echo "Step 5: Removing test directories..."
git rm -r test/
git rm -r tests/
echo "  ✓ Test directories removed"
echo ""

# Step 6: Remove Temporary/Debug Files
echo "Step 6: Removing temporary/debug files..."
git rm orcastrator.md
git rm dashboard.txt
git rm sprint
git rm test-main-session.txt
git rm test-hook-trigger.txt
git rm install-debug.sh
git rm claude_install.sh
git rm signoz-validation-report.json
git rm generate-jwt-token.js
git rm clear_storage.js
echo "  ✓ Temporary files removed"
echo ""

# Step 7: Archive Historical Documentation
echo "Step 7: Archiving historical documentation..."
git mv CONVERSION-COMPLETE.md docs/archive/development-history/
git mv FORTIUM-PRODUCTIVITY-DASHBOARD.md docs/archive/development-history/
git mv TASK_DELEGATION.md docs/archive/development-history/
git mv TEAM-PRODUCTIVITY-DASHBOARD-SEPT-2025.md docs/archive/development-history/
echo "  ✓ Historical docs archived"
echo ""

# Step 8: Remove remaining monitoring-web-service remnants
echo "Step 8: Removing monitoring-web-service remnants..."
if [ -d "src/monitoring-web-service" ]; then
  git rm -r src/monitoring-web-service/
  echo "  ✓ Monitoring web service remnants removed"
else
  echo "  ℹ Already removed in Phase 1"
fi
echo ""

# Calculate reduction
FINAL_FILES=$(git ls-files | wc -l)
REMOVED=$((INITIAL_FILES - FINAL_FILES))

echo "========================================="
echo "Cleanup Summary"
echo "========================================="
echo "Initial files: $INITIAL_FILES"
echo "Final files: $FINAL_FILES"
echo "Files removed: $REMOVED"
echo ""
echo "Phase 2 cleanup complete!"
echo "Ready for commit."
echo ""
