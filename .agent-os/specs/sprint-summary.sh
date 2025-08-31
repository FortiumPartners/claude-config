#!/bin/bash
# Simplified Sprint Status Dashboard
# Created: 2025-08-30

echo "📊 SPRINT STATUS - Manager Dashboard Metrics"
echo "============================================"
echo "Sprint Duration: Aug 30 - Sep 27 (4 weeks)"
echo ""

# Current week calculation (simplified)
echo "📅 Current: Week 1 - Core Infrastructure"
echo "Progress: 0/13 points (0%)"
echo "Due: September 6, 2025"
echo ""

echo "🎯 This Week's Tasks:"
echo "  ⏳ #4 - Metrics Collection Framework"
echo "  ⏳ #5 - Agent Activity Tracking"
echo "  ⏳ #6 - Command Usage Analytics"
echo ""

echo "📈 Sprint Metrics:"
echo "  • Total Points: 54"
echo "  • Completed: 0 (0%)"
echo "  • Velocity: 0 points/week"
echo "  • Status: ⚠️ Not Started"
echo ""

echo "🚀 Next Actions:"
echo "  1. Start Issue #4: /execute-tasks 'implement metrics collection service'"
echo "  2. Update board: ./sprint update 4 start"
echo "  3. Track progress: /sprint-status"
echo ""

echo "🔗 Quick Links:"
echo "  • Epic: https://github.com/FortiumPartners/claude-config/issues/3"
echo "  • Board: .agent-os/specs/sprint-board.md"
echo "  • Metrics: ~/.agent-os/metrics/test-dashboard.sh"

# Show metrics if available
if [[ -f "$HOME/.agent-os/metrics/agent-metrics.jsonl" ]]; then
    echo ""
    echo "📊 Metrics Collection Status: ✅ Active"
    AGENT_COUNT=$(wc -l < "$HOME/.agent-os/metrics/agent-metrics.jsonl" 2>/dev/null || echo 0)
    echo "  • Agent calls tracked: $AGENT_COUNT"
fi