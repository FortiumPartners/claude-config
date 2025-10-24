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

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║          Fortium Claude Configuration Installer             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

log_info "Legacy bash installer - delegating to Node.js installer..."
echo ""

# Check for Node.js
if ! command -v node >/dev/null 2>&1; then
  log_error "Node.js not found!"
  echo ""
  log_info "The installer requires Node.js 18+ to run."
  log_info "Please install Node.js from one of these sources:"
  echo ""
  echo "  📦 Official Website:"
  echo "     https://nodejs.org/"
  echo ""
  echo "  🍺 macOS (Homebrew):"
  echo "     brew install node"
  echo ""
  echo "  📦 Ubuntu/Debian:"
  echo "     curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
  echo "     sudo apt-get install -y nodejs"
  echo ""
  echo "  📦 Red Hat/CentOS:"
  echo "     curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -"
  echo "     sudo yum install -y nodejs"
  echo ""
  exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
log_success "Node.js $(node --version) detected"

if [ "$NODE_VERSION" -lt 18 ]; then
  log_warning "Node.js version $NODE_VERSION found, but version 18+ is required."
  log_error "Please upgrade Node.js to version 18 or higher."
  exit 1
fi

# Check if we're in a git repository and if updates are available
if [ -d "$SCRIPT_DIR/.git" ]; then
  log_info "Checking for updates from remote repository..."

  # Fetch the latest changes from remote without merging
  git -C "$SCRIPT_DIR" fetch origin >/dev/null 2>&1 || true

  # Get the current branch name
  CURRENT_BRANCH=$(git -C "$SCRIPT_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)

  # Check if local branch is behind remote
  LOCAL=$(git -C "$SCRIPT_DIR" rev-parse HEAD 2>/dev/null)
  REMOTE=$(git -C "$SCRIPT_DIR" rev-parse origin/$CURRENT_BRANCH 2>/dev/null || echo "$LOCAL")

  # Only check for updates if remote branch exists
  if [ "$LOCAL" != "$REMOTE" ]; then
    BASE=$(git -C "$SCRIPT_DIR" merge-base HEAD origin/$CURRENT_BRANCH 2>/dev/null || echo "$LOCAL")

    if [ "$LOCAL" != "$REMOTE" ] && [ "$LOCAL" = "$BASE" ]; then
      # Local is behind remote
      COMMITS_BEHIND=$(git -C "$SCRIPT_DIR" rev-list --count HEAD..origin/$CURRENT_BRANCH 2>/dev/null || echo "0")

      if [ "$COMMITS_BEHIND" != "0" ]; then
        log_warning "Your local repository is $COMMITS_BEHIND commit(s) behind origin/$CURRENT_BRANCH"

        echo ""
        log_info "Recent updates available:"
        git -C "$SCRIPT_DIR" log --oneline HEAD..origin/$CURRENT_BRANCH --max-count=5 2>/dev/null
        echo ""

        while true; do
          read -p "$(echo -e "${BLUE}[CHOICE]${NC} Pull latest updates before installing? (y/n): ")" yn
          case $yn in
          [Yy]*)
            log_info "Pulling latest updates from origin/$CURRENT_BRANCH..."
            if git -C "$SCRIPT_DIR" pull origin $CURRENT_BRANCH; then
              log_success "Successfully pulled latest updates"
              echo ""
            else
              log_error "Failed to pull updates. Please resolve any conflicts and try again."
              exit 1
            fi
            break
            ;;
          [Nn]*)
            log_warning "Proceeding with current local files (without updates)"
            echo ""
            break
            ;;
          *)
            log_error "Please answer yes (y) or no (n)."
            ;;
          esac
        done
      fi
    fi
  else
    log_success "Your local repository is up to date with origin/$CURRENT_BRANCH"
    echo ""
  fi
fi

# Prompt user for tool selection
echo ""
log_info "Choose AI tool:"
echo "  1) Claude (Anthropic Claude Code)"
echo "     - Best for Claude AI Assistant"
echo "     - Uses markdown format with full integration"
echo ""
echo "  2) OpenCode (OpenAI Assistant)"
echo "     - Best for OpenAI-based assistants"
echo "     - Uses simplified markdown format"
echo ""

INSTALL_TOOL=""
while true; do
  read -p "$(echo -e "${BLUE}[CHOICE]${NC} Enter your choice (1 for claude, 2 for opencode): ")" choice
  case $choice in
  1)
    INSTALL_TOOL="--tool claude"
    log_info "Selected: Claude"
    break
    ;;
  2)
    INSTALL_TOOL="--tool opencode"
    log_info "Selected: OpenCode"
    break
    ;;
  *)
    log_error "Invalid choice. Please enter 1 or 2."
    ;;
  esac
done

# Prompt user for installation scope
echo ""
log_info "Choose installation scope:"
echo "  1) Global installation (installed in your home directory)"
echo "     - Available across all projects"
echo "     - Agents and commands work from any directory"
echo ""
echo "  2) Local installation (installed in current project)"
echo "     - Available only when working in this specific project"
echo "     - Project-specific configuration and customizations"
echo ""

INSTALL_SCOPE=""
while true; do
  read -p "$(echo -e "${BLUE}[CHOICE]${NC} Enter your choice (1 for global, 2 for local): ")" choice
  case $choice in
  1)
    INSTALL_SCOPE="--global"
    log_info "Selected: Global installation"
    break
    ;;
  2)
    INSTALL_SCOPE="--local"
    log_info "Selected: Local installation to $SCRIPT_DIR"
    break
    ;;
  *)
    log_error "Invalid choice. Please enter 1 or 2."
    ;;
  esac
done

echo ""
log_info "Starting Node.js installer..."
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""

# Execute the local Node.js installer
NODE_INSTALLER="$SCRIPT_DIR/bin/ai-mesh"

if [ ! -f "$NODE_INSTALLER" ]; then
  log_error "Node.js installer not found at: $NODE_INSTALLER"
  log_info "This may be a corrupted installation. Please re-clone the repository."
  exit 1
fi

# Run the Node.js installer
node "$NODE_INSTALLER" install $INSTALL_TOOL $INSTALL_SCOPE

INSTALL_EXIT_CODE=$?

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $INSTALL_EXIT_CODE -eq 0 ]; then
  log_success "Installation completed successfully!"
  echo ""
  log_info "Next steps:"

  # Tool-specific instructions
  if [[ "$INSTALL_TOOL" == *"claude"* ]]; then
    echo "  1. Restart Claude Code to load the new configuration"
    echo "  2. Verify: node $NODE_INSTALLER validate"
    echo "  3. Test with /agents command in Claude Code"
  else
    echo "  1. Restart your AI assistant to load the new configuration"
    echo "  2. Verify: node $NODE_INSTALLER validate --tool opencode"
    echo "  3. Test with /agents command in your assistant"
  fi
  echo ""

  # Show installation paths
  if [ "$INSTALL_SCOPE" = "--global" ]; then
    if [[ "$INSTALL_TOOL" == *"claude"* ]]; then
      log_info "Configuration installed to: ~/.claude/"
      log_info "Runtime installed to: ~/.ai-mesh/"
    else
      log_info "Configuration installed to: ~/.opencode/"
      log_info "Runtime installed to: ~/.opencode-mesh/"
    fi
  else
    if [[ "$INSTALL_TOOL" == *"claude"* ]]; then
      log_info "Configuration installed to: $SCRIPT_DIR/.claude/"
      log_info "Runtime installed to: $SCRIPT_DIR/.ai-mesh/"
    else
      log_info "Configuration installed to: $SCRIPT_DIR/.opencode/"
      log_info "Runtime installed to: $SCRIPT_DIR/.opencode-mesh/"
    fi
  fi
  echo ""
else
  log_error "Installation failed with exit code $INSTALL_EXIT_CODE"
  log_info "Please check the error messages above and try again."
  exit $INSTALL_EXIT_CODE
fi
