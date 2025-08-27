#!/bin/bash

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log_info "Starting Fortium Claude Configuration installation..."
log_info "Script directory: $SCRIPT_DIR"

# Install agentos
log_info "Installing Agent-OS framework..."
curl -sSL https://raw.githubusercontent.com/carmandale/agent-os/main/setup.sh | bash

# Move existing ~/.claude folder to backup if it exists
if [ -d ~/.claude ]; then
    BACKUP_DIR=~/.claude_backup_$(date +%Y%m%d_%H%M%S)
    log_warning "Existing ~/.claude folder found. Moving to backup at $BACKUP_DIR"
    mv ~/.claude "$BACKUP_DIR"
    log_success "Backup created by moving existing configuration"
fi

# Create directories if they don't exist
log_info "Creating Claude directory structure..."
mkdir -p ~/.claude/commands
mkdir -p ~/.claude/agents
mkdir -p ~/.claude/hooks

# Copy agent files
log_info "Installing sub-agent mesh..."
if [ -d "$SCRIPT_DIR/agents" ]; then
    # Count total agent files (excluding README.md and test files)
    AGENT_COUNT=$(find "$SCRIPT_DIR/agents" -name "*.md" ! -name "README.md" ! -name "*-tests.md" | wc -l | tr -d ' ')
    log_info "Found $AGENT_COUNT agent files to install"
    
    for agent_file in "$SCRIPT_DIR/agents"/*.md; do
        if [[ -f "$agent_file" ]]; then
            filename=$(basename "$agent_file")
            # Skip README.md and test files
            if [[ "$filename" != "README.md" && "$filename" != *"-tests.md" ]]; then
                cp "$agent_file" ~/.claude/agents/
                log_info "  ✓ Installed agent: $filename"
            fi
        fi
    done
    log_success "Sub-agent mesh installation completed"
else
    log_error "Agents directory not found at $SCRIPT_DIR/agents"
    exit 1
fi

# Copy command files
log_info "Installing SuperClaude commands..."
if [ -d "$SCRIPT_DIR/commands" ]; then
    COMMAND_COUNT=$(find "$SCRIPT_DIR/commands" -name "*.md" | wc -l | tr -d ' ')
    log_info "Found $COMMAND_COUNT command files to install"
    
    for command_file in "$SCRIPT_DIR/commands"/*.md; do
        if [[ -f "$command_file" ]]; then
            filename=$(basename "$command_file")
            cp "$command_file" ~/.claude/commands/
            log_info "  ✓ Installed command: $filename"
        fi
    done
    log_success "SuperClaude commands installation completed"
else
    log_error "Commands directory not found at $SCRIPT_DIR/commands"
    exit 1
fi

# Copy hook files if they exist
if [ -d "$SCRIPT_DIR/hooks" ] && [ "$(ls -A "$SCRIPT_DIR/hooks")" ]; then
    log_info "Installing development hooks..."
    for hook_file in "$SCRIPT_DIR/hooks"/*; do
        if [[ -f "$hook_file" ]]; then
            filename=$(basename "$hook_file")
            cp "$hook_file" ~/.claude/hooks/
            log_info "  ✓ Installed hook: $filename"
        fi
    done
    log_success "Development hooks installation completed"
else
    log_info "No hooks found to install"
fi

# Validation section
log_info "Validating installation..."

# Check if Claude directories exist and have content
if [ ! -d ~/.claude/agents ] || [ ! -d ~/.claude/commands ]; then
    log_error "Claude directories not found after installation"
    exit 1
fi

# Count installed files
INSTALLED_AGENTS=$(find ~/.claude/agents -name "*.md" ! -name "README.md" ! -name "*-tests.md" | wc -l | tr -d ' ')
INSTALLED_COMMANDS=$(find ~/.claude/commands -name "*.md" | wc -l | tr -d ' ')
INSTALLED_HOOKS=$(find ~/.claude/hooks -type f 2>/dev/null | wc -l | tr -d ' ')

log_info "Installation validation:"
log_info "  ✓ Agents installed: $INSTALLED_AGENTS"
log_info "  ✓ Commands installed: $INSTALLED_COMMANDS"
log_info "  ✓ Hooks installed: $INSTALLED_HOOKS"

# Test Claude can see the agents by checking if agent files are accessible
log_info "Testing Claude agent accessibility..."

# List key agents that should be installed
KEY_AGENTS=("meta-agent.md" "frontend-developer.md" "backend-developer.md" "code-reviewer.md" "test-runner.md")
MISSING_AGENTS=()

for agent in "${KEY_AGENTS[@]}"; do
    if [ -f ~/.claude/agents/"$agent" ]; then
        log_info "  ✓ Key agent found: $agent"
    else
        log_warning "  ⚠ Key agent missing: $agent"
        MISSING_AGENTS+=("$agent")
    fi
done

# List key commands that should be installed
KEY_COMMANDS=("fold-prompt.md" "playwright-test.md")
MISSING_COMMANDS=()

log_info "Testing Claude command accessibility..."
for command in "${KEY_COMMANDS[@]}"; do
    if [ -f ~/.claude/commands/"$command" ]; then
        log_info "  ✓ Key command found: $command"
    else
        log_warning "  ⚠ Key command missing: $command"
        MISSING_COMMANDS+=("$command")
    fi
done

# Final validation report
if [ ${#MISSING_AGENTS[@]} -eq 0 ] && [ ${#MISSING_COMMANDS[@]} -eq 0 ]; then
    log_success "Installation validation completed successfully!"
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                    Installation Complete!                    ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║ • Sub-agent mesh: $INSTALLED_AGENTS agents installed${NC}"
    echo -e "${GREEN}║ • SuperClaude commands: $INSTALLED_COMMANDS commands installed${NC}"
    echo -e "${GREEN}║ • Development hooks: $INSTALLED_HOOKS hooks installed${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║ Next steps:                                                  ║${NC}"
    echo -e "${GREEN}║ 1. Restart Claude Code to load the new configuration        ║${NC}"
    echo -e "${GREEN}║ 2. Test agents with: /agents command in Claude Code         ║${NC}"
    echo -e "${GREEN}║ 3. Verify commands are available in Claude Code             ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    log_error "Installation validation failed!"
    if [ ${#MISSING_AGENTS[@]} -gt 0 ]; then
        log_error "Missing agents: ${MISSING_AGENTS[*]}"
    fi
    if [ ${#MISSING_COMMANDS[@]} -gt 0 ]; then
        log_error "Missing commands: ${MISSING_COMMANDS[*]}"
    fi
    exit 1
fi
