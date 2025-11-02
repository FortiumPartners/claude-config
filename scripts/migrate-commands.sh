#!/bin/bash

# Command Migration Script for Bash Installer
# Migrates AI Mesh commands to ai-mesh/ subdirectory
# Part of Command Directory Reorganization (TRD Sprint 2 Group 4)

set -euo pipefail

# Colors for output (if not already defined)
RED=${RED:-'\033[0;31m'}
GREEN=${GREEN:-'\033[0;32m'}
YELLOW=${YELLOW:-'\033[1;33m'}
BLUE=${BLUE:-'\033[0;34m'}
NC=${NC:-'\033[0m'}

# Log functions (if not already defined)
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1" >&2
}

##
# Detect if file contains @ai-mesh-command metadata header
# Returns 0 if AI Mesh command, 1 if third-party
# TRD-033: Implement metadata detection in bash
##
detect_ai_mesh_command() {
  local file_path="$1"

  # Check if file exists
  if [ ! -f "$file_path" ]; then
    return 1  # Not found = not AI Mesh command
  fi

  # Read first 10 lines and check for @ai-mesh-command marker
  # Performance: <10ms per file by reading only first 10 lines
  if head -n 10 "$file_path" 2>/dev/null | grep -q "@ai-mesh-command"; then
    return 0  # AI Mesh command detected
  else
    return 1  # Third-party command or no metadata
  fi
}

##
# Migrate a single command file to ai-mesh/ subdirectory
# Returns 0 on success, 1 on failure
# TRD-034: Add error handling to bash migration
##
migrate_single_file() {
  local source_file="$1"
  local target_dir="$2"
  local filename
  filename=$(basename "$source_file")
  local target_file="$target_dir/$filename"

  # Skip if file doesn't exist
  if [ ! -f "$source_file" ]; then
    log_warning "Source file not found: $source_file"
    return 1
  fi

  # Skip if already in target directory (idempotent)
  if [ -f "$target_file" ]; then
    # File already migrated, skip silently
    return 0
  fi

  # Move file to target directory
  if mv "$source_file" "$target_file" 2>/dev/null; then
    # Set correct permissions (644 for files)
    chmod 644 "$target_file" 2>/dev/null || true
    return 0
  else
    log_warning "Failed to migrate: $filename"
    return 1
  fi
}

##
# Main migration function
# Migrates all AI Mesh commands to ai-mesh/ subdirectory
# TRD-032: Create migrate_commands() bash function
##
migrate_commands() {
  local install_path="$1"
  local commands_dir="$install_path/commands"
  local aimesh_dir="$commands_dir/ai-mesh"

  # Validate install path exists
  if [ ! -d "$install_path" ]; then
    log_error "Install path does not exist: $install_path"
    return 1
  fi

  # Check if commands directory exists
  if [ ! -d "$commands_dir" ]; then
    log_warning "Commands directory not found: $commands_dir"
    log_info "Skipping migration (no commands to migrate)"
    return 0  # Not a failure, just nothing to do
  fi

  # Create ai-mesh subdirectory if it doesn't exist
  if [ ! -d "$aimesh_dir" ]; then
    log_info "Creating ai-mesh subdirectory..."
    if ! mkdir -p "$aimesh_dir"; then
      log_error "Failed to create ai-mesh directory: $aimesh_dir"
      return 1
    fi
    chmod 755 "$aimesh_dir" 2>/dev/null || true
  fi

  # Scan for command files
  local ai_mesh_files=()
  local third_party_files=()
  local total_files=0

  log_info "Scanning command files..."

  # Find all .md and .txt files in commands directory (not recursive)
  while IFS= read -r -d '' file; do
    ((total_files++))

    # Skip files already in subdirectories
    if [[ "$file" == *"/"*"/"* ]]; then
      continue
    fi

    # Detect AI Mesh commands
    if detect_ai_mesh_command "$file"; then
      ai_mesh_files+=("$file")
    else
      third_party_files+=("$file")
    fi
  done < <(find "$commands_dir" -maxdepth 1 -type f \( -name "*.md" -o -name "*.txt" \) -print0 2>/dev/null)

  local ai_mesh_count=${#ai_mesh_files[@]}
  local third_party_count=${#third_party_files[@]}

  # Report scan results
  if [ $ai_mesh_count -eq 0 ] && [ $third_party_count -eq 0 ]; then
    log_info "No command files found to migrate"
    return 0
  fi

  log_info "Found $ai_mesh_count AI Mesh commands and $third_party_count third-party commands"

  # Migrate AI Mesh commands
  if [ $ai_mesh_count -gt 0 ]; then
    log_info "Migrating $ai_mesh_count AI Mesh command files..."

    local success_count=0
    local error_count=0
    local errors=()

    for file in "${ai_mesh_files[@]}"; do
      if migrate_single_file "$file" "$aimesh_dir"; then
        ((success_count++))
      else
        ((error_count++))
        errors+=("$(basename "$file")")
      fi
    done

    # Report migration results
    if [ $error_count -eq 0 ]; then
      log_success "Successfully migrated all $success_count AI Mesh command files"
    else
      log_warning "Migration completed with errors: $success_count/$ai_mesh_count files migrated"

      # Log individual errors
      for error_file in "${errors[@]}"; do
        log_warning "  - Failed to migrate: $error_file"
      done

      # Return success if >50% succeeded (partial migration support)
      if [ $success_count -ge $error_count ]; then
        return 0
      else
        return 1
      fi
    fi
  fi

  # Keep third-party commands in root (log informational message)
  if [ $third_party_count -gt 0 ]; then
    log_info "Keeping $third_party_count third-party commands in root directory"
  fi

  return 0
}

# If script is executed directly (not sourced), run migration
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  if [ $# -ne 1 ]; then
    echo "Usage: $0 <install_path>"
    echo "Example: $0 ~/.claude"
    exit 1
  fi

  migrate_commands "$1"
  exit $?
fi
