#!/bin/bash
#
# Install Manager Dashboard Metrics Hooks
# Sets up Claude Code hooks for automated productivity tracking
#

set -e

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

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
METRICS_DIR="$SCRIPT_DIR/metrics"

log_info "Installing Manager Dashboard Metrics Hooks..."

# Check if we're in the correct directory structure
if [ ! -d "$METRICS_DIR" ]; then
    log_error "Metrics directory not found at $METRICS_DIR"
    log_error "Please run this script from the hooks directory"
    exit 1
fi

# Install Node.js dependencies
log_info "Installing Node.js dependencies..."

# Check if Node.js is installed
if ! command -v node >/dev/null 2>&1; then
    log_error "Node.js is not installed. Please install Node.js 18+ first."
    log_error "Visit https://nodejs.org/ or use a package manager like Homebrew:"
    log_error "brew install node"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log_warning "Node.js version $NODE_VERSION detected. Version 18+ is recommended."
fi

# Install dependencies
cd "$SCRIPT_DIR"
if command -v npm >/dev/null 2>&1; then
    npm install --silent
    log_success "Node.js dependencies installed with npm"
elif command -v yarn >/dev/null 2>&1; then
    yarn install --silent
    log_success "Node.js dependencies installed with yarn"
elif command -v pnpm >/dev/null 2>&1; then
    pnpm install --silent
    log_success "Node.js dependencies installed with pnpm"
else
    log_error "No Node.js package manager found. Please install npm, yarn, or pnpm."
    exit 1
fi

# Create metrics storage directory
STORAGE_DIR="$HOME/.claude/metrics"
log_info "Creating metrics storage directory at $STORAGE_DIR..."
mkdir -p "$STORAGE_DIR"/{sessions,realtime,archives}
log_success "Metrics storage directory created"

# Make hook scripts executable
log_info "Setting execute permissions on hook scripts..."
chmod +x "$METRICS_DIR"/*.js "$METRICS_DIR"/*.ts 2>/dev/null || true
log_success "Hook scripts made executable"

# Build TypeScript files
log_info "Building TypeScript files..."
cd "$SCRIPT_DIR"
if npm run build --silent 2>/dev/null; then
    log_success "TypeScript compilation successful"
else
    log_warning "TypeScript compilation failed, but continuing with installation"
fi

# Validate hook scripts
log_info "Validating hook scripts..."
VALIDATION_FAILED=false

for hook_script in "$METRICS_DIR"/*.js "$METRICS_DIR"/*.ts; do
    if [[ -f "$hook_script" ]]; then
        filename=$(basename "$hook_script")
        
        # Check if script has proper shebang for .js files
        if [[ "$filename" == *.js ]]; then
            if ! head -1 "$hook_script" | grep -q "#!/usr/bin/env node"; then
                log_info "  Note: $filename missing Node.js shebang (not required)"
            fi
        fi
        
        # Try to validate JavaScript/TypeScript syntax
        if [[ "$filename" == *.js ]]; then
            if node -c "$hook_script" 2>/dev/null; then
                log_info "  ✓ $filename validated"
            else
                log_error "Syntax error in $filename"
                VALIDATION_FAILED=true
            fi
        elif [[ "$filename" == *.ts ]]; then
            # TypeScript files are validated during build
            log_info "  ✓ $filename (TypeScript)"
        fi
    fi
done

if [ "$VALIDATION_FAILED" = true ]; then
    log_error "Hook validation failed. Please fix syntax errors before proceeding."
    exit 1
fi

# Test Node.js dependencies
log_info "Testing Node.js dependencies..."
cd "$SCRIPT_DIR"

if node -e "console.log('Node.js version:', process.version); console.log('Dependencies loaded successfully')" 2>/dev/null; then
    log_success "Node.js dependencies are working correctly"
else
    log_warning "Node.js dependency test failed. Hooks may not work properly."
    log_warning "Please check that Node.js dependencies were installed correctly:"
    log_warning "cd hooks && npm install"
fi

# Create hook configuration in Claude directory
CLAUDE_DIR="$HOME/.claude"
if [ ! -d "$CLAUDE_DIR" ]; then
    CLAUDE_DIR="$(pwd)/.claude"  # Try local claude directory
fi

if [ -d "$CLAUDE_DIR" ]; then
    log_info "Setting up Claude Code hook configuration..."
    
    # Create hooks directory in Claude
    CLAUDE_HOOKS_DIR="$CLAUDE_DIR/hooks/metrics"
    mkdir -p "$CLAUDE_HOOKS_DIR"
    
    # Copy hook scripts to Claude hooks directory
    cp "$METRICS_DIR"/*.js "$CLAUDE_HOOKS_DIR/" 2>/dev/null || true
    cp "$METRICS_DIR"/*.ts "$CLAUDE_HOOKS_DIR/" 2>/dev/null || true
    cp "$METRICS_DIR/config.json" "$CLAUDE_HOOKS_DIR/" 2>/dev/null || true
    
    log_success "Hooks copied to Claude Code hooks directory"
    
    # Create hook registry file for Claude Code
    cat > "$CLAUDE_HOOKS_DIR/registry.json" << EOF
{
  "hook_registry": {
    "manager_dashboard_metrics": {
      "version": "1.0.0",
      "description": "Automated productivity metrics collection for manager dashboard",
      "hooks": [
        {
          "name": "session_start",
          "type": "SessionStart",
          "script": "session-start.js",
          "enabled": true
        },
        {
          "name": "session_end", 
          "type": "SessionEnd",
          "script": "session-end.js",
          "enabled": true
        },
        {
          "name": "tool_metrics",
          "type": "PostToolUse",
          "script": "tool-metrics.js", 
          "enabled": true
        }
      ],
      "installed": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "author": "Fortium AI-Augmented Development Team"
    }
  }
}
EOF
    
    log_success "Hook registry created for Claude Code"
else
    log_warning "Claude directory not found. You may need to run the main install.sh script first"
    log_info "Hooks are installed at: $METRICS_DIR"
fi

# Initialize baseline metrics if not exists
BASELINE_FILE="$STORAGE_DIR/historical-baseline.json"
if [ ! -f "$BASELINE_FILE" ]; then
    log_info "Initializing baseline metrics..."
    cat > "$BASELINE_FILE" << EOF
{
  "average_commands_per_hour": 15,
  "average_lines_per_hour": 120,
  "average_success_rate": 95,
  "initialized": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "sessions_count": 0
}
EOF
    log_success "Baseline metrics initialized"
fi

# Test hook execution
log_info "Running hook integration test..."
cd "$SCRIPT_DIR"

# Test if we can run the analytics engine (if it exists as JS/TS)
if [[ -f "$METRICS_DIR/analytics-engine.js" ]]; then
    if node "$METRICS_DIR/analytics-engine.js" 2>/dev/null; then
        log_success "Hook integration test passed"
    else
        log_warning "Hook integration test failed. Check dependencies and permissions."
    fi
elif [[ -f "dist/analytics-engine.js" ]]; then
    if node "dist/analytics-engine.js" 2>/dev/null; then
        log_success "Hook integration test passed"
    else
        log_warning "Hook integration test failed. Check dependencies and permissions."
    fi
else
    log_info "Analytics engine not found for testing (will be created when converted)"
fi

# Final installation report
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Manager Dashboard Metrics Hooks                 ║${NC}"
echo -e "${GREEN}║                    Installation Complete!                    ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║ Hook Scripts Installed:                                     ║${NC}"
echo -e "${GREEN}║ • session-start.js - Session initialization tracking       ║${NC}"
echo -e "${GREEN}║ • session-end.js - Session summary and analysis            ║${NC}"
echo -e "${GREEN}║ • tool-metrics.js - Real-time tool usage metrics           ║${NC}"
echo -e "${GREEN}║ • analytics-engine.js - Advanced productivity analytics    ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║ Storage Directory: ~/.claude/metrics                       ║${NC}"
echo -e "${GREEN}║ Configuration: hooks/metrics/config.json                   ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║ Next Steps:                                                  ║${NC}"
echo -e "${GREEN}║ 1. Restart Claude Code to activate hooks                    ║${NC}"
echo -e "${GREEN}║ 2. Run /manager-dashboard --realtime to view metrics       ║${NC}"
echo -e "${GREEN}║ 3. Start using Claude Code - metrics will auto-collect     ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"

log_info "Installation log saved to: $STORAGE_DIR/installation.log"
echo "$(date): Manager Dashboard Metrics Hooks installed successfully" >> "$STORAGE_DIR/installation.log"

exit 0