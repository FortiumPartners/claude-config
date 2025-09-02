---
name: sprint-status
description: Display current sprint progress, active tasks, and team metrics for project management
usage: /sprint-status [detailed|week|update] [options]
agent: manager-dashboard-agent
tools: ["Read", "Edit", "Bash"]
---

# Sprint Status Command

**Purpose**: Display current sprint progress, active tasks, and team metrics for the Manager Dashboard implementation

**Trigger**: 
- `/sprint-status` - Show current sprint overview
- `/sprint-status detailed` - Show detailed task breakdown
- `/sprint-status week [1-4]` - Show specific week's tasks
- `/sprint-status update [issue] [status]` - Update task status

**Command Flow**:
1. Read sprint board data from `.agent-os/specs/sprint-board.md`
2. Calculate current progress and velocity
3. Identify blocked items and risks
4. Display formatted sprint dashboard
5. Provide actionable next steps

## Command Implementation

When the user types `/sprint-status`, execute the following:

### Basic Sprint Overview
```bash
# Display sprint board with color-coded progress
$HOME/Development/fortium/claude-config/.agent-os/specs/sprint-board.sh show

# Show current metrics if available
if [[ -f "$HOME/.agent-os/metrics/test-dashboard.sh" ]]; then
    echo ""
    echo "📊 Current Metrics Collection Status:"
    $HOME/.agent-os/metrics/test-dashboard.sh | tail -5
fi
```

### Detailed Task View
When called with `detailed` argument:
```bash
# Show all tasks with completion status
echo "📋 DETAILED SPRINT BACKLOG"
echo "=========================="

# Parse sprint board for task details
grep -E "^\[#[0-9]+" $HOME/Development/fortium/claude-config/.agent-os/specs/sprint-board.md | while read -r line; do
    if [[ $line == *"Done"* ]]; then
        echo "✅ $line"
    elif [[ $line == *"In Progress"* ]]; then
        echo "🔄 $line"
    else
        echo "⏳ $line"
    fi
done

# Show task breakdown
echo ""
echo "📊 Task Summary:"
grep -E "^- \[ \]|^- \[x\]" $HOME/Development/fortium/claude-config/.agent-os/specs/sprint-board.md | head -20
```

### Week-Specific View
When called with `week [number]` argument:
```bash
WEEK_NUM=${2:-1}
echo "📅 Week $WEEK_NUM Sprint Details"
echo "================================"

# Extract specific week's content
sed -n "/## Week $WEEK_NUM:/,/## Week $((WEEK_NUM+1)):/p" $HOME/Development/fortium/claude-config/.agent-os/specs/sprint-board.md | head -30
```

### Update Task Status
When called with `update [issue] [status]` arguments:
```bash
ISSUE_NUM=$2
STATUS=$3

# Update the sprint board
$HOME/Development/fortium/claude-config/.agent-os/specs/sprint-board.sh update $ISSUE_NUM $STATUS

# Show confirmation
echo "✅ Issue #$ISSUE_NUM updated to $STATUS"
echo ""
echo "Current Sprint Status:"
$HOME/Development/fortium/claude-config/.agent-os/specs/sprint-board.sh show
```

## Interactive Dashboard Display

The command should display:

```
📊 SPRINT STATUS - Manager Dashboard Metrics
============================================
Sprint: Week 1 of 4 (Aug 30 - Sep 27)
Overall Progress: 0/54 points (0%)

📅 Current Week: Core Infrastructure
Progress: 0/13 points (0%)
Due: September 6, 2025

🎯 Active Tasks:
  ⏳ #4 - Metrics Collection Framework (Not Started)
  ⏳ #5 - Agent Activity Tracking (Not Started)
  ⏳ #6 - Command Usage Analytics (Not Started)

🚀 Next Actions:
  1. Start Issue #4: Metrics Collection Framework
  2. Implement Task 1.1.1: Create metrics collection service
  3. Design metrics data models

🚧 Blockers: None

📈 Velocity Metrics:
  - Planned: 13 points/week
  - Actual: 0 points/week
  - On Track: ⚠️  Behind Schedule

🔗 Quick Links:
  • Epic: https://github.com/FortiumPartners/claude-config/issues/3
  • Current Issue: https://github.com/FortiumPartners/claude-config/issues/4
  • Sprint Board: .agent-os/specs/sprint-board.md
```

## Usage Examples

### Check Overall Sprint Status
```
/sprint-status
```

### View Detailed Task Breakdown
```
/sprint-status detailed
```

### Check Week 2 Planning
```
/sprint-status week 2
```

### Mark Task as Started
```
/sprint-status update 4 start
```

### Mark Task as Complete
```
/sprint-status update 4 complete
```

## Integration Points

### GitHub Issues
- Links directly to issue tracker
- Updates can trigger git commits
- Milestones tracked automatically

### Metrics Collection
- Shows real-time metrics if hooks are active
- Displays productivity scores
- Tracks velocity trends

### Team Collaboration
- Shareable sprint status
- Clear next actions
- Blocker visibility

## Success Indicators
- Daily sprint status checks
- Tasks moving through pipeline
- Velocity tracking accuracy
- No blockers lasting >1 day

---

*Sprint Status Command: Real-time visibility into sprint progress and team velocity*
*Version: 1.0.0 | Manager Dashboard Enhancement*