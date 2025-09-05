#!/bin/bash

set -e # Exit on any error

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

log_info "Starting Fortium Claude Configuration installation (Debug Version)..."
log_info "Script directory: $SCRIPT_DIR"

# Skip git update check for debugging
log_info "Skipping git update check for debugging..."
echo ""

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

# Final success message
log_success "Installation completed successfully!"
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