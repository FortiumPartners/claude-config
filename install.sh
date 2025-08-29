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

# Check if we're in a git repository and if updates are available
if [ -d "$SCRIPT_DIR/.git" ]; then
    log_info "Checking for updates from remote repository..."
    
    # Fetch the latest changes from remote without merging
    git -C "$SCRIPT_DIR" fetch origin >/dev/null 2>&1
    
    # Get the current branch name
    CURRENT_BRANCH=$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)
    
    # Check if local branch is behind remote
    LOCAL=$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null)
    REMOTE=$(git -C "$SCRIPT_DIR" rev-parse origin/$CURRENT_BRANCH 2>/dev/null)
    BASE=$(git -C "$SCRIPT_DIR" merge-base HEAD origin/$CURRENT_BRANCH 2>/dev/null)
    
    if [ "$LOCAL" != "$REMOTE" ] && [ "$LOCAL" = "$BASE" ]; then
        # Local is behind remote
        COMMITS_BEHIND=$(git -C "$SCRIPT_DIR" rev-list --count HEAD..origin/$CURRENT_BRANCH)
        log_warning "Your local repository is $COMMITS_BEHIND commit(s) behind origin/$CURRENT_BRANCH"
        
        echo ""
        log_info "Recent updates available:"
        git -C "$SCRIPT_DIR" log --oneline HEAD..origin/$CURRENT_BRANCH --max-count=5
        echo ""
        
        while true; do
            read -p "$(echo -e "${BLUE}[CHOICE]${NC} Would you like to pull the latest updates before installing? (y/n): ")" yn
            case $yn in
                [Yy]* )
                    log_info "Pulling latest updates from origin/$CURRENT_BRANCH..."
                    if git -C "$SCRIPT_DIR" pull origin $CURRENT_BRANCH; then
                        log_success "Successfully pulled latest updates"
                        echo ""
                        log_info "Continuing with installation using updated files..."
                    else
                        log_error "Failed to pull updates. Please resolve any conflicts and try again."
                        exit 1
                    fi
                    break
                    ;;
                [Nn]* )
                    log_warning "Proceeding with installation using current local files (without updates)"
                    echo ""
                    break
                    ;;
                * )
                    log_error "Please answer yes (y) or no (n)."
                    ;;
            esac
        done
    elif [ "$LOCAL" != "$REMOTE" ] && [ "$REMOTE" = "$BASE" ]; then
        # Local is ahead of remote
        COMMITS_AHEAD=$(git -C "$SCRIPT_DIR" rev-list --count origin/$CURRENT_BRANCH..HEAD)
        log_info "Your local repository is $COMMITS_AHEAD commit(s) ahead of origin/$CURRENT_BRANCH"
        log_info "Proceeding with installation using local files..."
        echo ""
    elif [ "$LOCAL" != "$REMOTE" ]; then
        # Branches have diverged
        log_warning "Your local branch has diverged from origin/$CURRENT_BRANCH"
        log_warning "You may want to resolve this before installation"
        echo ""
        
        while true; do
            read -p "$(echo -e "${BLUE}[CHOICE]${NC} Continue with installation anyway? (y/n): ")" yn
            case $yn in
                [Yy]* )
                    log_info "Proceeding with installation using current local files..."
                    echo ""
                    break
                    ;;
                [Nn]* )
                    log_info "Installation cancelled. Please resolve git status and try again."
                    exit 0
                    ;;
                * )
                    log_error "Please answer yes (y) or no (n)."
                    ;;
            esac
        done
    else
        # Local and remote are in sync
        log_success "Your local repository is up to date with origin/$CURRENT_BRANCH"
        echo ""
    fi
else
    log_info "Not a git repository. Proceeding with installation..."
    echo ""
fi

# Install agentos
log_info "Installing Agent-OS framework..."
# Check if AgentOS is already installed
if [ -d "$HOME/.agent-os" ] && [ -f "$HOME/.agent-os/VERSION" ]; then
    AGENTOS_VERSION=$(cat "$HOME/.agent-os/VERSION" 2>/dev/null || echo "unknown")
    log_info "Agent-OS already installed (version: $AGENTOS_VERSION). Skipping installation."
else
    log_info "Installing Agent-OS..."
    # Use timeout and error handling for AgentOS installation
    if timeout 60s bash -c 'curl -sSL https://raw.githubusercontent.com/carmandale/agent-os/main/setup.sh | bash -s -- --non-interactive' >/dev/null 2>&1; then
        log_success "Agent-OS installation completed"
    else
        log_warning "Agent-OS installation encountered issues or timed out. Continuing with Fortium configuration..."
    fi
fi

# Prompt user for installation scope
echo ""
log_info "Choose installation scope for Claude configuration:"
echo "  1) Global installation (installed in your home directory: ~/.claude/)"
echo "     - Available to Claude Code across all projects"
echo "     - Agents and commands work from any directory"
echo ""
echo "  2) Local installation (installed in current project: .claude/)"
echo "     - Available only when working in this specific project"
echo "     - Project-specific configuration and customizations"
echo ""

while true; do
    read -p "$(echo -e "${BLUE}[CHOICE]${NC} Enter your choice (1 for global, 2 for local): ")" choice
    case $choice in
        1)
            INSTALL_TYPE="global"
            CLAUDE_DIR="$HOME/.claude"
            log_info "Selected: Global installation to ~/.claude/"
            break
            ;;
        2)
            INSTALL_TYPE="local"
            CLAUDE_DIR="$SCRIPT_DIR/.claude"
            log_info "Selected: Local installation to $SCRIPT_DIR/.claude/"
            break
            ;;
        *)
            log_error "Invalid choice. Please enter 1 or 2."
            ;;
    esac
done

# Move existing Claude folder to backup if it exists
if [ -d "$CLAUDE_DIR" ]; then
    if [ "$INSTALL_TYPE" = "global" ]; then
        BACKUP_DIR="$HOME/.claude_backup_$(date +%Y%m%d_%H%M%S)"
    else
        BACKUP_DIR="$SCRIPT_DIR/.claude_backup_$(date +%Y%m%d_%H%M%S)"
    fi
    log_warning "Existing Claude configuration found at $CLAUDE_DIR. Moving to backup at $BACKUP_DIR"
    mv "$CLAUDE_DIR" "$BACKUP_DIR"
    log_success "Backup created by moving existing configuration"
fi

# Create directories if they don't exist
log_info "Creating Claude directory structure at $CLAUDE_DIR..."
mkdir -p "$CLAUDE_DIR/commands"
mkdir -p "$CLAUDE_DIR/agents"
mkdir -p "$CLAUDE_DIR/hooks"

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
                cp "$agent_file" "$CLAUDE_DIR/agents/"
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
            cp "$command_file" "$CLAUDE_DIR/commands/"
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
            cp "$hook_file" "$CLAUDE_DIR/hooks/"
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
if [ ! -d "$CLAUDE_DIR/agents" ] || [ ! -d "$CLAUDE_DIR/commands" ]; then
    log_error "Claude directories not found after installation at $CLAUDE_DIR"
    exit 1
fi

# Count installed files
INSTALLED_AGENTS=$(find "$CLAUDE_DIR/agents" -name "*.md" ! -name "README.md" ! -name "*-tests.md" | wc -l | tr -d ' ')
INSTALLED_COMMANDS=$(find "$CLAUDE_DIR/commands" -name "*.md" | wc -l | tr -d ' ')
INSTALLED_HOOKS=$(find "$CLAUDE_DIR/hooks" -type f 2>/dev/null | wc -l | tr -d ' ')

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
    if [ -f "$CLAUDE_DIR/agents/$agent" ]; then
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
    if [ -f "$CLAUDE_DIR/commands/$command" ]; then
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
    if [ "$INSTALL_TYPE" = "global" ]; then
        echo -e "${GREEN}║ Installation Type: Global (available across all projects)   ║${NC}"
        echo -e "${GREEN}║ Installation Path: ~/.claude/                               ║${NC}"
    else
        echo -e "${GREEN}║ Installation Type: Local (project-specific configuration)   ║${NC}"
        echo -e "${GREEN}║ Installation Path: .claude/ (in current project)            ║${NC}"
    fi
    echo -e "${GREEN}║                                                              ║${NC}"
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
