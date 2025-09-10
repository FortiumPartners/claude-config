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
			[Yy]*)
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
			[Nn]*)
				log_warning "Proceeding with installation using current local files (without updates)"
				echo ""
				break
				;;
			*)
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
			[Yy]*)
				log_info "Proceeding with installation using current local files..."
				echo ""
				break
				;;
			[Nn]*)
				log_info "Installation cancelled. Please resolve git status and try again."
				exit 0
				;;
			*)
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

	# Create or update Claude settings.json for hooks integration
	log_info "Configuring Claude settings for hooks integration..."
	SETTINGS_FILE="$CLAUDE_DIR/settings.json"

	if [ ! -f "$SETTINGS_FILE" ]; then
		log_info "Creating minimal settings.json configuration..."
		cat >"$SETTINGS_FILE" <<'EOF'
{
  "model": "claude-3-5-sonnet-20241022"
}
EOF
		log_info "  ✓ Created settings.json"
	else
		log_info "  ✓ settings.json already exists"
	fi

	# Add hooks configuration to settings.json if hooks were installed
	if [ -d "$CLAUDE_DIR/hooks" ] && [ "$(ls -A "$CLAUDE_DIR/hooks")" ]; then
		log_info "Configuring hooks in settings.json..."

		# Check if jq is available for JSON manipulation
		if ! command -v jq >/dev/null 2>&1; then
			log_warning "jq is not installed. Installing jq for JSON manipulation..."
			
			# Try to install jq based on the OS
			if [[ "$OSTYPE" == "darwin"* ]] && command -v brew >/dev/null 2>&1; then
				brew install jq >/dev/null 2>&1 && log_success "jq installed via Homebrew"
			elif command -v apt-get >/dev/null 2>&1; then
				sudo apt-get update && sudo apt-get install -y jq >/dev/null 2>&1 && log_success "jq installed via apt"
			elif command -v yum >/dev/null 2>&1; then
				sudo yum install -y jq >/dev/null 2>&1 && log_success "jq installed via yum"
			else
				log_warning "Could not install jq automatically. Please install jq manually."
			fi
		fi

		# Use jq if available, otherwise provide manual instructions
		if command -v jq >/dev/null 2>&1; then
			# Create temporary file for the updated settings
			TEMP_SETTINGS=$(mktemp)
			
			# Check if hooks section already exists
			HOOKS_EXISTS=$(jq 'has("hooks")' "$SETTINGS_FILE" 2>/dev/null || echo "false")
			
			if [ "$HOOKS_EXISTS" = "true" ]; then
				log_info "Updating existing hooks configuration..."
			else
				log_info "Adding new hooks configuration..."
			fi
			
			# Define the hooks configuration as a JSON string
			HOOKS_CONFIG='{
				"PreToolUse": [
					{
						"hooks": [
							{
								"type": "command",
								"command": "node .claude/hooks/tool-metrics.js pre",
								"timeout": 5
							}
						]
					}
				],
				"PostToolUse": [
					{
						"hooks": [
							{
								"type": "command",
								"command": "node .claude/hooks/tool-metrics.js post",
								"timeout": 5
							}
						]
					}
				],
				"UserPromptSubmit": [
					{
						"hooks": [
							{
								"type": "command",
								"command": "node .claude/hooks/session-start.js",
								"timeout": 5
							}
						]
					}
				]
			}'
			
			# Update the settings file: preserve all existing settings and update/add hooks section
			jq --argjson hooks "$HOOKS_CONFIG" '. + {hooks: $hooks}' "$SETTINGS_FILE" >"$TEMP_SETTINGS" 2>/dev/null
			
			if [ $? -eq 0 ] && [ -s "$TEMP_SETTINGS" ]; then
				# Validate the JSON before replacing the original file
				if jq empty "$TEMP_SETTINGS" 2>/dev/null; then
					cp "$TEMP_SETTINGS" "$SETTINGS_FILE"
					rm -f "$TEMP_SETTINGS"
					log_success "Hooks configuration updated in settings.json"
					
					# Save a reference copy of just the hooks configuration
					HOOKS_REFERENCE="$CLAUDE_DIR/hooks/hooks-config-reference.json"
					echo "$HOOKS_CONFIG" | jq '.' >"$HOOKS_REFERENCE" 2>/dev/null
					log_info "  ✓ Hooks configuration reference saved to hooks directory"
					
					# Install Node.js dependencies for hooks if package.json exists
					if [ -f "$CLAUDE_DIR/hooks/package.json" ]; then
						log_info "Installing Node.js dependencies for hooks..."
						(cd "$CLAUDE_DIR/hooks" && npm install --production --silent) >/dev/null 2>&1
						if [ $? -eq 0 ]; then
							log_success "Hook dependencies installed successfully"
						else
							log_warning "Failed to install some hook dependencies - hooks may not work properly"
							log_info "  Try running: cd $CLAUDE_DIR/hooks && npm install"
						fi
					fi
				else
					rm -f "$TEMP_SETTINGS"
					log_error "Failed to create valid JSON configuration"
				fi
			else
				rm -f "$TEMP_SETTINGS"
				log_error "Failed to update settings.json with hooks configuration"
			fi
		else
			log_warning "jq not found - cannot automatically update hooks configuration"
			log_info "Please install jq (brew install jq) and run this script again, or"
			log_info "manually add the hooks configuration to $SETTINGS_FILE"
			log_info ""
			log_info "The hooks section should be added to your settings.json file."
			log_info "See $CLAUDE_DIR/hooks/hooks-config-reference.json for the required format."
		fi
	fi
else
	log_info "No hooks found to install"
fi

# Install Task Execution Enforcement Engine to AI Mesh directory
log_info "Installing Task Execution Enforcement Engine to AI Mesh..."

# Create AI Mesh directory structure
AI_MESH_DIR="$HOME/.ai-mesh"
if [ "$INSTALL_TYPE" = "local" ]; then
	AI_MESH_DIR="$SCRIPT_DIR/.ai-mesh"
fi

mkdir -p "$AI_MESH_DIR/src"
mkdir -p "$AI_MESH_DIR/logs"
mkdir -p "$AI_MESH_DIR/data"
mkdir -p "$AI_MESH_DIR/config"

# Check for Node.js
if ! command -v node >/dev/null 2>&1; then
	log_warning "Node.js not found. The file monitoring service requires Node.js 18+."
	log_info "Please install Node.js from https://nodejs.org/ or using your package manager:"
	log_info "  macOS: brew install node"
	log_info "  Ubuntu: sudo apt install nodejs npm"
	log_info "Skipping file monitoring service installation..."
else
	NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
	if [ "$NODE_VERSION" -lt 18 ]; then
		log_warning "Node.js version $NODE_VERSION found. Version 18+ required."
		log_info "Skipping file monitoring service installation..."
	else
		log_info "Node.js $(node --version) found. Installing dependencies..."

		# Copy source files if they exist
		if [ -d "$SCRIPT_DIR/src" ]; then
			log_info "Installing AI Mesh source files..."
			cp -r "$SCRIPT_DIR/src"/* "$AI_MESH_DIR/src/"

			# Remove Python cache files
			find "$AI_MESH_DIR/src" -name "*.pyc" -delete 2>/dev/null || true
			find "$AI_MESH_DIR/src" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true

			log_info "  ✓ Source files copied to $AI_MESH_DIR/src/"
		fi

		# Copy package.json if it exists
		if [ -f "$SCRIPT_DIR/package.json" ]; then
			cp "$SCRIPT_DIR/package.json" "$AI_MESH_DIR/"
			log_info "  ✓ Package configuration copied"
		fi

		# Install Node.js dependencies
		if [ -f "$AI_MESH_DIR/package.json" ]; then
			cd "$AI_MESH_DIR" && npm install --silent >/dev/null 2>&1
			if [ $? -eq 0 ]; then
				log_success "Node.js dependencies installed successfully"
			else
				log_warning "Failed to install Node.js dependencies"
			fi
		fi
	fi
fi

# Check for Python (for analytics system)
if ! command -v python3 >/dev/null 2>&1; then
	log_warning "Python 3 not found. Analytics features may not work."
	log_info "Please install Python 3.8+ for full functionality."
else
	PYTHON_VERSION=$(python3 --version 2>&1 | cut -d ' ' -f 2 | cut -d '.' -f 1,2)
	log_info "Python $PYTHON_VERSION found. Analytics system ready."

	# Initialize database if analytics files exist
	if [ -f "$AI_MESH_DIR/src/analytics/database.py" ]; then
		log_info "Initializing analytics database..."
		cd "$AI_MESH_DIR" && python3 -c "
import sys
sys.path.append('src')
try:
    from analytics.database import DatabaseManager
    db = DatabaseManager()
    db.initialize_database()
    print('Analytics database initialized successfully')
except Exception as e:
    print(f'Warning: Could not initialize database: {e}')
" 2>/dev/null && log_info "  ✓ Analytics database ready"
	fi
fi

# Copy test files for validation
if [ -d "$SCRIPT_DIR/tests" ]; then
	log_info "Installing test suite..."
	cp -r "$SCRIPT_DIR/tests" "$AI_MESH_DIR/"
	log_info "  ✓ Test files copied to $AI_MESH_DIR/tests/"
fi

log_success "AI Mesh Task Execution Enforcement Engine installation completed"
log_info "AI Mesh installed to: $AI_MESH_DIR"

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

# Validate settings.json
if [ -f "$CLAUDE_DIR/settings.json" ]; then
	log_info "  ✓ Claude settings.json: created"

	# Check if hooks configuration exists in settings.json (if hooks were installed)
	if [ $INSTALLED_HOOKS -gt 0 ]; then
		if command -v jq >/dev/null 2>&1; then
			HOOKS_ENABLED=$(jq -r '.hooks.enabled // false' "$CLAUDE_DIR/settings.json" 2>/dev/null)
			if [ "$HOOKS_ENABLED" = "true" ]; then
				log_info "  ✓ Hooks configuration: enabled in settings.json"
			else
				log_warning "  ⚠ Hooks configuration: not enabled in settings.json"
			fi
		else
			log_info "  ✓ Hooks configuration: manual verification needed (jq not available)"
		fi
	fi
else
	log_warning "  ⚠ Claude settings.json: missing"
fi

# Validate AI Mesh installation
if [ -d "$AI_MESH_DIR" ]; then
	log_info "AI Mesh validation:"
	INSTALLED_AI_MESH_SRC=$(find "$AI_MESH_DIR/src" -name "*.js" -o -name "*.py" -o -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')
	INSTALLED_AI_MESH_TESTS=$(find "$AI_MESH_DIR/tests" -name "*.js" -o -name "*.py" 2>/dev/null | wc -l | tr -d ' ')
	log_info "  ✓ AI Mesh source files: $INSTALLED_AI_MESH_SRC"
	log_info "  ✓ AI Mesh test files: $INSTALLED_AI_MESH_TESTS"

	# Check key AI Mesh components
	if [ -f "$AI_MESH_DIR/src/file-monitoring-service.js" ]; then
		log_info "  ✓ File monitoring service: installed"
	else
		log_warning "  ⚠ File monitoring service: missing"
	fi

	if [ -f "$AI_MESH_DIR/src/analytics/database.py" ]; then
		log_info "  ✓ Analytics system: installed"
	else
		log_warning "  ⚠ Analytics system: missing"
	fi

	if [ -f "$AI_MESH_DIR/src/dashboard/dashboard_service.py" ]; then
		log_info "  ✓ Dashboard service: installed"
	else
		log_warning "  ⚠ Dashboard service: missing"
	fi

	if [ -f "$AI_MESH_DIR/package.json" ]; then
		log_info "  ✓ Node.js configuration: installed"
	else
		log_warning "  ⚠ Node.js configuration: missing"
	fi
else
	log_warning "AI Mesh directory not found at $AI_MESH_DIR"
fi

# Test Claude can see the agents by checking if agent files are accessible
log_info "Testing Claude agent accessibility..."

# List key agents that should be installed
KEY_AGENTS=("ai-mesh-orchestrator.md" "tech-lead-orchestrator.md" "frontend-developer.md" "backend-developer.md" "code-reviewer.md" "test-runner.md")
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
	if [ -f "$CLAUDE_DIR/settings.json" ]; then
		echo -e "${GREEN}║ • Claude settings.json: configured${NC}"
	fi
	if [ -d "$AI_MESH_DIR" ]; then
		AI_MESH_STATUS="$INSTALLED_AI_MESH_SRC source files installed"
		echo -e "${GREEN}║ • AI Mesh system: $AI_MESH_STATUS${NC}"
		if [ "$INSTALL_TYPE" = "global" ]; then
			echo -e "${GREEN}║ • AI Mesh path: ~/.ai-mesh/                                 ║${NC}"
		else
			echo -e "${GREEN}║ • AI Mesh path: .ai-mesh/ (local)                           ║${NC}"
		fi
	fi
	echo -e "${GREEN}║                                                              ║${NC}"
	echo -e "${GREEN}║ Next steps:                                                  ║${NC}"
	echo -e "${GREEN}║ 1. Restart Claude Code to load the new configuration        ║${NC}"
	echo -e "${GREEN}║ 2. Test agents with: /agents command in Claude Code         ║${NC}"
	echo -e "${GREEN}║ 3. Verify commands are available in Claude Code             ║${NC}"
	if [ -d "$AI_MESH_DIR" ]; then
		echo -e "${GREEN}║ 4. Test AI Mesh: node ~/.ai-mesh/src/file-monitoring-service.js ║${NC}"
	fi
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
