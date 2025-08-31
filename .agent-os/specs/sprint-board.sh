#!/bin/bash
# Sprint Board Viewer and Updater
# Created: 2025-08-30

BOARD_FILE="$HOME/Development/fortium/claude-config/.agent-os/specs/sprint-board.md"

# Colors for better visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

show_board() {
    echo -e "${BLUE}📊 SPRINT BOARD - Manager Dashboard Metrics${NC}"
    echo "================================================"
    echo ""
    
    # Extract and show progress
    echo -e "${YELLOW}📈 Current Progress:${NC}"
    grep "Overall Progress" "$BOARD_FILE" | sed 's/- \*\*/  /'
    grep "Week 1 Progress" "$BOARD_FILE" | sed 's/- \*\*/  /'
    echo ""
    
    # Show current week's tasks
    echo -e "${GREEN}🎯 Week 1 Tasks (Current):${NC}"
    sed -n '/## Week 1:/,/## Week 2:/p' "$BOARD_FILE" | grep -E "^\[#[0-9]+" | while read -r line; do
        if [[ $line == *"Not Started"* ]]; then
            echo -e "  ${RED}○${NC} $line"
        elif [[ $line == *"In Progress"* ]]; then
            echo -e "  ${YELLOW}◐${NC} $line"
        else
            echo -e "  ${GREEN}●${NC} $line"
        fi
    done
    echo ""
    
    # Show blocked items
    echo -e "${RED}🚧 Blocked Items:${NC}"
    sed -n '/## 🚧 Blocked Items/,/---/p' "$BOARD_FILE" | grep -v "^#" | grep -v "^---" | grep -v "^\*(" || echo "  None"
    echo ""
    
    # Show GitHub links
    echo -e "${BLUE}🔗 Quick Links:${NC}"
    echo "  • View Epic: https://github.com/FortiumPartners/claude-config/issues/3"
    echo "  • View Board: $BOARD_FILE"
    echo "  • Run Tests: ~/.agent-os/metrics/test-dashboard.sh"
}

update_task() {
    local issue_number=$1
    local status=$2
    
    case $status in
        "start")
            echo "Starting work on Issue #$issue_number..."
            # Update the markdown file to move task to In Progress
            sed -i '' "s/\[#$issue_number.*Status\]: Not Started/[#$issue_number - Status]: In Progress/" "$BOARD_FILE"
            echo "✅ Issue #$issue_number moved to In Progress"
            ;;
        "complete")
            echo "Completing Issue #$issue_number..."
            # Update the markdown file to move task to Done
            sed -i '' "s/\[#$issue_number.*Status\]: In Progress/[#$issue_number - Status]: Done/" "$BOARD_FILE"
            echo "✅ Issue #$issue_number marked as Done"
            ;;
        *)
            echo "Invalid status. Use 'start' or 'complete'"
            ;;
    esac
}

case "${1:-show}" in
    "show"|"")
        show_board
        ;;
    "update")
        if [[ -z "$2" ]] || [[ -z "$3" ]]; then
            echo "Usage: $0 update <issue_number> <start|complete>"
            exit 1
        fi
        update_task "$2" "$3"
        ;;
    "edit")
        ${EDITOR:-vim} "$BOARD_FILE"
        ;;
    "help")
        echo "Sprint Board Manager"
        echo "==================="
        echo "Commands:"
        echo "  $0 show              - Display the sprint board"
        echo "  $0 update <#> start  - Move issue to In Progress"
        echo "  $0 update <#> complete - Move issue to Done"
        echo "  $0 edit              - Edit the board file"
        echo "  $0 help              - Show this help"
        ;;
    *)
        echo "Unknown command. Use '$0 help' for usage."
        exit 1
        ;;
esac