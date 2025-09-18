#!/bin/bash

# SignOz Dashboard Management Script
# Task 5.1: SignOz Dashboard Configuration - Management Utilities
# Comprehensive dashboard management, backup, restore, and maintenance

set -euo pipefail

# Configuration
SIGNOZ_URL="${SIGNOZ_URL:-http://localhost:3301}"
SIGNOZ_API_KEY="${SIGNOZ_API_KEY:-}"
DASHBOARD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../dashboards" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/tmp/signoz-backups}"
CONFIG_FILE="$(dirname "${BASH_SOURCE[0]}")/dashboard-config.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        ERROR)
            echo -e "${RED}[ERROR] ${timestamp}: $message${NC}" >&2
            ;;
        WARN)
            echo -e "${YELLOW}[WARN] ${timestamp}: $message${NC}"
            ;;
        INFO)
            echo -e "${GREEN}[INFO] ${timestamp}: $message${NC}"
            ;;
        DEBUG)
            echo -e "${BLUE}[DEBUG] ${timestamp}: $message${NC}"
            ;;
    esac
}

# Create default configuration
create_default_config() {
    cat > "$CONFIG_FILE" << EOF
{
  "dashboard_config": {
    "version": "1.0.0",
    "auto_backup": true,
    "backup_retention_days": 30,
    "default_refresh": "30s",
    "default_access_level": "viewer",
    "folders": {
      "application": "Application Monitoring",
      "infrastructure": "Infrastructure Monitoring", 
      "database": "Database Performance",
      "tenant": "Tenant Management"
    },
    "dashboards": {
      "01-application-overview": {
        "title": "Application Overview - Monitoring Web Service",
        "folder": "application",
        "priority": 1,
        "access_level": "viewer"
      },
      "02-database-performance": {
        "title": "Database Performance - PostgreSQL Monitoring",
        "folder": "database",
        "priority": 2,
        "access_level": "viewer"
      },
      "03-tenant-monitoring": {
        "title": "Tenant-Specific Monitoring - Multi-Tenant Observability",
        "folder": "tenant",
        "priority": 3,
        "access_level": "editor"
      },
      "04-infrastructure-monitoring": {
        "title": "Infrastructure Monitoring - System Resources & Container Health",
        "folder": "infrastructure",
        "priority": 4,
        "access_level": "viewer"
      }
    }
  }
}
EOF
    log INFO "Created default configuration: $CONFIG_FILE"
}

# List all dashboards
list_dashboards() {
    log INFO "Listing SignOz dashboards..."
    
    local dashboards_response
    if dashboards_response=$(curl -s -X GET \
        -H "Content-Type: application/json" \
        ${SIGNOZ_API_KEY:+-H "Authorization: Bearer $SIGNOZ_API_KEY"} \
        "$SIGNOZ_URL/api/v1/dashboards" 2>/dev/null); then
        
        if echo "$dashboards_response" | jq -e '.dashboards' > /dev/null 2>&1; then
            echo "$dashboards_response" | jq -r '.dashboards[] | "\(.id) | \(.title) | \(.folder // "No Folder")"' | \
                column -t -s '|' -N "ID,Title,Folder"
        else
            log ERROR "No dashboards found or invalid response"
            return 1
        fi
    else
        log ERROR "Failed to retrieve dashboards from SignOz"
        return 1
    fi
}

# Backup all dashboards
backup_dashboards() {
    local backup_timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_path="$BACKUP_DIR/signoz-dashboards-$backup_timestamp"
    
    log INFO "Creating dashboard backup: $backup_path"
    mkdir -p "$backup_path"
    
    # Create backup metadata
    cat > "$backup_path/backup-metadata.json" << EOF
{
  "backup_timestamp": "$backup_timestamp",
  "signoz_url": "$SIGNOZ_URL",
  "backup_type": "full",
  "created_by": "$(whoami)",
  "script_version": "1.0.0"
}
EOF
    
    # Get list of all dashboards and export each one
    local dashboards_response
    if dashboards_response=$(curl -s -X GET \
        -H "Content-Type: application/json" \
        ${SIGNOZ_API_KEY:+-H "Authorization: Bearer $SIGNOZ_API_KEY"} \
        "$SIGNOZ_URL/api/v1/dashboards"); then
        
        local dashboard_count=0
        echo "$dashboards_response" | jq -r '.dashboards[].id' | while read -r dashboard_id; do
            if [ -n "$dashboard_id" ] && [ "$dashboard_id" != "null" ]; then
                log DEBUG "Backing up dashboard: $dashboard_id"
                
                local dashboard_export
                if dashboard_export=$(curl -s -X GET \
                    -H "Content-Type: application/json" \
                    ${SIGNOZ_API_KEY:+-H "Authorization: Bearer $SIGNOZ_API_KEY"} \
                    "$SIGNOZ_URL/api/v1/dashboards/$dashboard_id"); then
                    
                    echo "$dashboard_export" | jq '.' > "$backup_path/${dashboard_id}.json"
                    ((dashboard_count++))
                fi
            fi
        done
        
        log INFO "Dashboard backup completed: $backup_path ($dashboard_count dashboards)"
        echo "$backup_path"
    else
        log ERROR "Failed to create dashboard backup"
        return 1
    fi
}

# Restore dashboards from backup
restore_dashboards() {
    local backup_path="$1"
    
    if [ ! -d "$backup_path" ]; then
        log ERROR "Backup directory not found: $backup_path"
        return 1
    fi
    
    log INFO "Restoring dashboards from: $backup_path"
    
    local restored_count=0
    local failed_count=0
    
    for dashboard_file in "$backup_path"/*.json; do
        if [ -f "$dashboard_file" ] && [[ "$(basename "$dashboard_file")" != "backup-metadata.json" ]]; then
            local dashboard_id=$(basename "$dashboard_file" .json)
            local dashboard_content=$(cat "$dashboard_file")
            
            log DEBUG "Restoring dashboard: $dashboard_id"
            
            # Try to restore dashboard
            local restore_response
            if restore_response=$(curl -s -X POST \
                -H "Content-Type: application/json" \
                ${SIGNOZ_API_KEY:+-H "Authorization: Bearer $SIGNOZ_API_KEY"} \
                -d "$dashboard_content" \
                "$SIGNOZ_URL/api/v1/dashboards"); then
                
                if echo "$restore_response" | jq -e '.dashboard' > /dev/null 2>&1; then
                    log DEBUG "Successfully restored dashboard: $dashboard_id"
                    ((restored_count++))
                else
                    log ERROR "Failed to restore dashboard: $dashboard_id"
                    ((failed_count++))
                fi
            else
                log ERROR "HTTP request failed for dashboard: $dashboard_id"
                ((failed_count++))
            fi
        fi
    done
    
    log INFO "Dashboard restore completed: $restored_count restored, $failed_count failed"
    
    if [ $failed_count -gt 0 ]; then
        return 1
    fi
}

# Clean old backups
cleanup_backups() {
    local retention_days="${1:-30}"
    
    log INFO "Cleaning up backups older than $retention_days days..."
    
    if [ -d "$BACKUP_DIR" ]; then
        local deleted_count=0
        
        find "$BACKUP_DIR" -type d -name "signoz-dashboards-*" -mtime +$retention_days | while read -r old_backup; do
            log DEBUG "Deleting old backup: $old_backup"
            rm -rf "$old_backup"
            ((deleted_count++))
        done
        
        log INFO "Cleaned up $deleted_count old backups"
    else
        log INFO "Backup directory does not exist: $BACKUP_DIR"
    fi
}

# Validate dashboard configuration
validate_config() {
    local dashboard_file="$1"
    
    log INFO "Validating dashboard configuration: $dashboard_file"
    
    # Check JSON syntax
    if ! jq empty "$dashboard_file" 2>/dev/null; then
        log ERROR "Invalid JSON syntax in: $dashboard_file"
        return 1
    fi
    
    # Check required fields
    local required_fields=(
        ".dashboard.id"
        ".dashboard.title"
        ".dashboard.panels"
        ".dashboard.time"
        ".dashboard.refresh"
    )
    
    for field in "${required_fields[@]}"; do
        if ! jq -e "$field" "$dashboard_file" > /dev/null 2>&1; then
            log ERROR "Missing required field '$field' in: $dashboard_file"
            return 1
        fi
    done
    
    # Validate panels
    local panel_count=$(jq '.dashboard.panels | length' "$dashboard_file")
    if [ "$panel_count" -eq 0 ]; then
        log WARN "Dashboard has no panels: $dashboard_file"
    fi
    
    # Check for panel ID conflicts
    local unique_panel_ids=$(jq '.dashboard.panels[].id' "$dashboard_file" | sort | uniq | wc -l)
    local total_panel_ids=$(jq '.dashboard.panels[].id' "$dashboard_file" | wc -l)
    
    if [ "$unique_panel_ids" -ne "$total_panel_ids" ]; then
        log ERROR "Duplicate panel IDs found in: $dashboard_file"
        return 1
    fi
    
    log INFO "Dashboard validation successful: $dashboard_file"
    return 0
}

# Generate dashboard reports
generate_report() {
    local report_file="${1:-dashboard-report-$(date +%Y%m%d-%H%M%S).html}"
    
    log INFO "Generating dashboard report: $report_file"
    
    # Get dashboard list
    local dashboards_response
    if dashboards_response=$(curl -s -X GET \
        -H "Content-Type: application/json" \
        ${SIGNOZ_API_KEY:+-H "Authorization: Bearer $SIGNOZ_API_KEY"} \
        "$SIGNOZ_URL/api/v1/dashboards"); then
        
        # Generate HTML report
        cat > "$report_file" << EOF
<!DOCTYPE html>
<html>
<head>
    <title>SignOz Dashboard Report - $(date)</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .status-ok { color: green; }
        .status-error { color: red; }
        .status-warn { color: orange; }
    </style>
</head>
<body>
    <h1>SignOz Dashboard Report</h1>
    <p>Generated on: $(date)</p>
    <p>SignOz URL: $SIGNOZ_URL</p>
    
    <h2>Dashboard Summary</h2>
    <table>
        <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Folder</th>
            <th>Panels</th>
            <th>Status</th>
            <th>Last Modified</th>
        </tr>
EOF
        
        echo "$dashboards_response" | jq -r '.dashboards[] | @base64' | while read -r dashboard_data; do
            local dashboard=$(echo "$dashboard_data" | base64 -d)
            local id=$(echo "$dashboard" | jq -r '.id')
            local title=$(echo "$dashboard" | jq -r '.title')
            local folder=$(echo "$dashboard" | jq -r '.folder // "No Folder"')
            local panel_count=$(echo "$dashboard" | jq '.panels | length // 0')
            local status="<span class=\"status-ok\">OK</span>"
            local modified=$(echo "$dashboard" | jq -r '.updatedAt // "Unknown"')
            
            cat >> "$report_file" << EOF
        <tr>
            <td>$id</td>
            <td>$title</td>
            <td>$folder</td>
            <td>$panel_count</td>
            <td>$status</td>
            <td>$modified</td>
        </tr>
EOF
        done
        
        cat >> "$report_file" << EOF
    </table>
    
    <h2>Configuration Details</h2>
    <pre>$(cat "$CONFIG_FILE" 2>/dev/null || echo "No configuration file found")</pre>
    
    <h2>Recent Backups</h2>
    <ul>
EOF
        
        if [ -d "$BACKUP_DIR" ]; then
            find "$BACKUP_DIR" -type d -name "signoz-dashboards-*" | sort -r | head -10 | while read -r backup_path; do
                local backup_name=$(basename "$backup_path")
                cat >> "$report_file" << EOF
        <li>$backup_name</li>
EOF
            done
        else
            cat >> "$report_file" << EOF
        <li>No backups found</li>
EOF
        fi
        
        cat >> "$report_file" << EOF
    </ul>
</body>
</html>
EOF
        
        log INFO "Dashboard report generated: $report_file"
        echo "$report_file"
    else
        log ERROR "Failed to generate dashboard report"
        return 1
    fi
}

# Show help
show_help() {
    cat << EOF
SignOz Dashboard Management Script

Usage: $0 <command> [options]

Commands:
  list                    List all dashboards
  backup [dir]           Backup all dashboards (default: $BACKUP_DIR)
  restore <backup_dir>   Restore dashboards from backup
  validate <file>        Validate dashboard configuration file
  cleanup [days]         Clean up old backups (default: 30 days)
  report [file]          Generate HTML dashboard report
  config                 Create default configuration file

Options:
  -u, --url URL          SignOz URL (default: $SIGNOZ_URL)
  -k, --api-key KEY      SignOz API key
  -h, --help            Show this help message

Environment Variables:
  SIGNOZ_URL            SignOz URL
  SIGNOZ_API_KEY        SignOz API key
  BACKUP_DIR            Backup directory

Examples:
  $0 list                           # List all dashboards
  $0 backup                        # Create backup
  $0 restore /tmp/backup-path      # Restore from backup
  $0 validate dashboard.json       # Validate dashboard
  $0 cleanup 7                     # Clean backups older than 7 days
  $0 report dashboard-report.html  # Generate HTML report
EOF
}

# Main function
main() {
    # Parse global options
    while [[ $# -gt 0 ]]; do
        case $1 in
            -u|--url)
                SIGNOZ_URL="$2"
                shift 2
                ;;
            -k|--api-key)
                SIGNOZ_API_KEY="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                break
                ;;
        esac
    done
    
    # Require at least one command
    if [ $# -eq 0 ]; then
        log ERROR "No command specified"
        show_help
        exit 1
    fi
    
    local command="$1"
    shift
    
    case "$command" in
        list)
            list_dashboards
            ;;
        backup)
            backup_dashboards "$@"
            ;;
        restore)
            if [ $# -eq 0 ]; then
                log ERROR "Backup directory required for restore command"
                exit 1
            fi
            restore_dashboards "$1"
            ;;
        validate)
            if [ $# -eq 0 ]; then
                log ERROR "Dashboard file required for validate command"
                exit 1
            fi
            validate_config "$1"
            ;;
        cleanup)
            cleanup_backups "${1:-30}"
            ;;
        report)
            generate_report "$@"
            ;;
        config)
            create_default_config
            ;;
        *)
            log ERROR "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"