#!/bin/bash
# Sprint Status Dashboard
# Created: 2025-08-30 for Manager Dashboard Metrics

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

BOARD_FILE="$HOME/Development/fortium/claude-config/.agent-os/specs/sprint-board.md"
METRICS_DIR="$HOME/.agent-os/metrics"

# Calculate dates
SPRINT_START="2025-08-30"
SPRINT_END="2025-09-27"
TODAY=$(date +%Y-%m-%d)
CURRENT_WEEK=$(( ($(date -j -f "%Y-%m-%d" "$TODAY" +%s) - $(date -j -f "%Y-%m-%d" "$SPRINT_START" +%s)) / 604800 + 1 ))
[[ $CURRENT_WEEK -gt 4 ]] && CURRENT_WEEK=4
[[ $CURRENT_WEEK -lt 1 ]] && CURRENT_WEEK=1

show_sprint_status() {
    clear
    echo -e "${BOLD}${BLUE}📊 SPRINT STATUS - Manager Dashboard Metrics${NC}"
    echo "============================================"
    echo -e "Sprint: ${YELLOW}Week $CURRENT_WEEK of 4${NC} (Aug 30 - Sep 27)"
    
    # Extract progress from board
    TOTAL_POINTS=54
    COMPLETED_COUNT=$(grep -c "Status]: Done" "$BOARD_FILE" 2>/dev/null || echo "0")
    COMPLETED_POINTS=$((COMPLETED_COUNT * 4)) # Rough estimate
    if [[ $TOTAL_POINTS -gt 0 ]]; then
        PROGRESS_PCT=$((COMPLETED_POINTS * 100 / TOTAL_POINTS))
    else
        PROGRESS_PCT=0
    fi
    
    echo -e "Overall Progress: ${CYAN}$COMPLETED_POINTS/$TOTAL_POINTS points ($PROGRESS_PCT%)${NC}"
    
    # Progress bar
    echo -n "["
    FILLED=$((PROGRESS_PCT / 5))
    for ((i=0; i<20; i++)); do
        if [[ $i -lt $FILLED ]]; then
            echo -n "█"
        else
            echo -n "░"
        fi
    done
    echo "]"
    echo ""
    
    # Current week details
    case $CURRENT_WEEK in
        1)
            WEEK_NAME="Core Infrastructure"
            WEEK_POINTS=13
            WEEK_DUE="September 6"
            ;;
        2)
            WEEK_NAME="Real-Time Dashboard"
            WEEK_POINTS=15
            WEEK_DUE="September 13"
            ;;
        3)
            WEEK_NAME="Advanced Analytics"
            WEEK_POINTS=14
            WEEK_DUE="September 20"
            ;;
        4)
            WEEK_NAME="Production Ready"
            WEEK_POINTS=12
            WEEK_DUE="September 27"
            ;;
    esac
    
    echo -e "${BOLD}📅 Current Week: $WEEK_NAME${NC}"
    echo -e "Progress: ${CYAN}0/$WEEK_POINTS points (0%)${NC}"
    echo -e "Due: ${YELLOW}$WEEK_DUE, 2025${NC}"
    echo ""
    
    # Active tasks for current week
    echo -e "${BOLD}🎯 Active Tasks:${NC}"
    case $CURRENT_WEEK in
        1)
            echo -e "  ${YELLOW}⏳${NC} #4 - Metrics Collection Framework (Not Started)"
            echo -e "  ${YELLOW}⏳${NC} #5 - Agent Activity Tracking (Not Started)"
            echo -e "  ${YELLOW}⏳${NC} #6 - Command Usage Analytics (Not Started)"
            ;;
        2)
            echo -e "  ${YELLOW}⏳${NC} #7 - Real-Time Metrics Updates"
            echo -e "  ${YELLOW}⏳${NC} #8 - User Interaction Tracking"
            echo -e "  ${YELLOW}⏳${NC} #9 - Performance Baseline Dashboard"
            ;;
        3)
            echo -e "  ${YELLOW}⏳${NC} #10 - Code Quality Metrics"
            echo -e "  ${YELLOW}⏳${NC} #11 - Predictive Analytics"
            echo -e "  ${YELLOW}⏳${NC} #12 - Team Performance Analytics"
            ;;
        4)
            echo -e "  ${YELLOW}⏳${NC} #13 - Dashboard Command Enhancement"
            echo -e "  ${YELLOW}⏳${NC} #14 - Performance Optimization"
            echo -e "  ${YELLOW}⏳${NC} #15 - Comprehensive Documentation"
            ;;
    esac
    echo ""
    
    # Next actions
    echo -e "${BOLD}🚀 Next Actions:${NC}"
    echo "  1. Start Issue #4: Metrics Collection Framework"
    echo "  2. Implement Task 1.1.1: Create metrics collection service"
    echo "  3. Design metrics data models"
    echo ""
    
    # Blockers
    echo -e "${BOLD}🚧 Blockers:${NC} ${GREEN}None${NC}"
    echo ""
    
    # Velocity metrics
    echo -e "${BOLD}📈 Velocity Metrics:${NC}"
    echo -e "  • Planned: ${CYAN}13.5 points/week${NC}"
    echo -e "  • Actual: ${YELLOW}0 points/week${NC}"
    if [[ $PROGRESS_PCT -lt 20 ]]; then
        echo -e "  • On Track: ${RED}⚠️  Behind Schedule${NC}"
    else
        echo -e "  • On Track: ${GREEN}✅ On Schedule${NC}"
    fi
    echo ""
    
    # Metrics collection status
    if [[ -f "$METRICS_DIR/test-dashboard.sh" ]]; then
        echo -e "${BOLD}📊 Metrics Collection:${NC}"
        SESSION_COUNT=$(ls "$METRICS_DIR/sessions"/*.jsonl 2>/dev/null | wc -l | tr -d ' ')
        AGENT_COUNT=$(wc -l < "$METRICS_DIR/agent-metrics.jsonl" 2>/dev/null || echo 0)
        echo -e "  • Sessions Tracked: ${CYAN}$SESSION_COUNT${NC}"
        echo -e "  • Agent Invocations: ${CYAN}$AGENT_COUNT${NC}"
        echo -e "  • Status: ${GREEN}✅ Hooks Active${NC}"
    else
        echo -e "${BOLD}📊 Metrics Collection:${NC} ${YELLOW}⚠️  Not Configured${NC}"
    fi
    echo ""
    
    # Quick links
    echo -e "${BOLD}🔗 Quick Links:${NC}"
    echo "  • Epic: https://github.com/FortiumPartners/claude-config/issues/3"
    echo "  • Current: https://github.com/FortiumPartners/claude-config/issues/4"
    echo "  • Board: .agent-os/specs/sprint-board.md"
    echo ""
}

show_detailed() {
    echo -e "${BOLD}${BLUE}📋 DETAILED SPRINT BACKLOG${NC}"
    echo "=========================="
    echo ""
    
    for week in 1 2 3 4; do
        case $week in
            1) echo -e "${BOLD}Week 1: Core Infrastructure${NC}" ;;
            2) echo -e "${BOLD}Week 2: Real-Time Dashboard${NC}" ;;
            3) echo -e "${BOLD}Week 3: Advanced Analytics${NC}" ;;
            4) echo -e "${BOLD}Week 4: Production Ready${NC}" ;;
        esac
        
        # Show issues for this week
        start_issue=$((week * 3 + 1))
        end_issue=$((start_issue + 2))
        
        for issue in $(seq $start_issue $end_issue); do
            if grep -q "\[#$issue.*Done\]" "$BOARD_FILE" 2>/dev/null; then
                echo -e "  ${GREEN}✅${NC} Issue #$issue - Completed"
            elif grep -q "\[#$issue.*In Progress\]" "$BOARD_FILE" 2>/dev/null; then
                echo -e "  ${YELLOW}🔄${NC} Issue #$issue - In Progress"
            else
                echo -e "  ${RED}⏳${NC} Issue #$issue - Not Started"
            fi
        done
        echo ""
    done
}

show_week() {
    local week_num=${1:-$CURRENT_WEEK}
    
    echo -e "${BOLD}${BLUE}📅 Week $week_num Sprint Details${NC}"
    echo "================================"
    echo ""
    
    sed -n "/## Week $week_num:/,/^## Week $((week_num+1)):/p" "$BOARD_FILE" | head -40
}

update_task() {
    local issue=$1
    local status=$2
    
    "$HOME/Development/fortium/claude-config/.agent-os/specs/sprint-board.sh" update "$issue" "$status"
    echo ""
    echo -e "${GREEN}✅ Issue #$issue updated to $status${NC}"
}

# Main command handler
case "${1:-status}" in
    "status"|"")
        show_sprint_status
        ;;
    "detailed")
        show_detailed
        ;;
    "week")
        show_week "${2:-$CURRENT_WEEK}"
        ;;
    "update")
        if [[ -z "$2" ]] || [[ -z "$3" ]]; then
            echo "Usage: $0 update <issue_number> <start|complete>"
            exit 1
        fi
        update_task "$2" "$3"
        echo ""
        show_sprint_status
        ;;
    "help")
        echo -e "${BOLD}Sprint Status Dashboard${NC}"
        echo "======================"
        echo "Commands:"
        echo "  $0 [status]          - Show sprint overview (default)"
        echo "  $0 detailed          - Show all tasks with status"
        echo "  $0 week [1-4]        - Show specific week details"
        echo "  $0 update <#> <status> - Update task status"
        echo "  $0 help              - Show this help"
        ;;
    *)
        echo "Unknown command. Use '$0 help' for usage."
        exit 1
        ;;
esac