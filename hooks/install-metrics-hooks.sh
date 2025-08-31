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

# Install Python dependencies
log_info "Installing Python dependencies..."
if command -v pip3 >/dev/null 2>&1; then
    pip3 install -r "$SCRIPT_DIR/requirements.txt" --user --quiet
    log_success "Python dependencies installed"
elif command -v pip >/dev/null 2>&1; then
    pip install -r "$SCRIPT_DIR/requirements.txt" --user --quiet
    log_success "Python dependencies installed"
else
    log_warning "pip not found. Please install Python dependencies manually:"
    log_warning "pip install cchooks pandas numpy"
fi

# Create metrics storage directory
STORAGE_DIR="$HOME/.agent-os/metrics"
log_info "Creating metrics storage directory at $STORAGE_DIR..."
mkdir -p "$STORAGE_DIR"/{sessions,realtime,archives}
log_success "Metrics storage directory created"

# Make hook scripts executable
log_info "Setting execute permissions on hook scripts..."
chmod +x "$METRICS_DIR"/*.py
log_success "Hook scripts made executable"

# Validate hook scripts
log_info "Validating hook scripts..."
VALIDATION_FAILED=false

for hook_script in "$METRICS_DIR"/*.py; do
    if [[ -f "$hook_script" ]]; then
        filename=$(basename "$hook_script")
        
        # Check if script has proper shebang
        if ! head -1 "$hook_script" | grep -q "#!/usr/bin/env python3"; then
            log_warning "Missing or incorrect shebang in $filename"
        fi
        
        # Try to validate Python syntax
        if command -v python3 >/dev/null 2>&1; then
            if ! python3 -m py_compile "$hook_script" >/dev/null 2>&1; then
                log_error "Syntax error in $filename"
                VALIDATION_FAILED=true
            else
                log_info "  ✓ $filename validated"
            fi
        fi
    fi
done

if [ "$VALIDATION_FAILED" = true ]; then
    log_error "Hook validation failed. Please fix syntax errors before proceeding."
    exit 1
fi

# Test cchooks import
log_info "Testing cchooks framework..."
if python3 -c "import cchooks; print('cchooks version:', cchooks.__version__ if hasattr(cchooks, '__version__') else 'installed')" 2>/dev/null; then
    log_success "cchooks framework is working correctly"
else
    log_warning "cchooks import test failed. Hooks may not work properly."
    log_warning "Try installing with: pip3 install cchooks --user"
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
    cp "$METRICS_DIR"/*.py "$CLAUDE_HOOKS_DIR/"
    cp "$METRICS_DIR/config.json" "$CLAUDE_HOOKS_DIR/"
    
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
          "script": "session-start.py",
          "enabled": true
        },
        {
          "name": "session_end", 
          "type": "SessionEnd",
          "script": "session-end.py",
          "enabled": true
        },
        {
          "name": "tool_metrics",
          "type": "PostToolUse",
          "script": "tool-metrics.py", 
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
if python3 -c "
import sys
sys.path.insert(0, '$METRICS_DIR')
from analytics_engine import generate_dashboard_data
data = generate_dashboard_data()
print('✓ Analytics engine test passed')
" 2>/dev/null; then
    log_success "Hook integration test passed"
else
    log_warning "Hook integration test failed. Check dependencies and permissions."
fi

# Final installation report
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Manager Dashboard Metrics Hooks                 ║${NC}"
echo -e "${GREEN}║                    Installation Complete!                    ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║ Hook Scripts Installed:                                     ║${NC}"
echo -e "${GREEN}║ • session-start.py - Session initialization tracking       ║${NC}"
echo -e "${GREEN}║ • session-end.py - Session summary and analysis            ║${NC}"
echo -e "${GREEN}║ • tool-metrics.py - Real-time tool usage metrics           ║${NC}"
echo -e "${GREEN}║ • analytics-engine.py - Advanced productivity analytics    ║${NC}"
echo -e "${GREEN}║                                                              ║${NC}"
echo -e "${GREEN}║ Storage Directory: ~/.agent-os/metrics                     ║${NC}"
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