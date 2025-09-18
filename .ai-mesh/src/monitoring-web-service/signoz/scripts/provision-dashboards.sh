#!/bin/bash

# SignOz Dashboard Provisioning Script
# Task 5.1: SignOz Dashboard Configuration - Automation Scripts
# Comprehensive dashboard deployment and management for production-ready monitoring

set -euo pipefail

# Configuration
SIGNOZ_URL="${SIGNOZ_URL:-http://localhost:3301}"
SIGNOZ_API_KEY="${SIGNOZ_API_KEY:-}"
DASHBOARD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../dashboards" && pwd)"
LOG_FILE="/tmp/signoz-dashboard-provision.log"

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
            echo "[ERROR] ${timestamp}: $message" >> "$LOG_FILE"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN] ${timestamp}: $message${NC}"
            echo "[WARN] ${timestamp}: $message" >> "$LOG_FILE"
            ;;
        INFO)
            echo -e "${GREEN}[INFO] ${timestamp}: $message${NC}"
            echo "[INFO] ${timestamp}: $message" >> "$LOG_FILE"
            ;;
        DEBUG)
            echo -e "${BLUE}[DEBUG] ${timestamp}: $message${NC}"
            echo "[DEBUG] ${timestamp}: $message" >> "$LOG_FILE"
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    log INFO "Checking prerequisites..."
    
    # Check if jq is installed
    if ! command -v jq &> /dev/null; then
        log ERROR "jq is required but not installed. Please install jq."
        exit 1
    fi
    
    # Check if curl is installed
    if ! command -v curl &> /dev/null; then
        log ERROR "curl is required but not installed. Please install curl."
        exit 1
    fi
    
    # Check if dashboard directory exists
    if [ ! -d "$DASHBOARD_DIR" ]; then
        log ERROR "Dashboard directory not found: $DASHBOARD_DIR"
        exit 1
    fi
    
    # Check SignOz connectivity
    if ! curl -s "$SIGNOZ_URL/api/v1/version" > /dev/null; then
        log ERROR "Cannot connect to SignOz at $SIGNOZ_URL"
        log ERROR "Please ensure SignOz is running and accessible"
        exit 1
    fi
    
    log INFO "Prerequisites check completed successfully"
}

# Validate dashboard JSON
validate_dashboard() {
    local dashboard_file="$1"
    
    log DEBUG "Validating dashboard: $dashboard_file"
    
    if ! jq empty "$dashboard_file" 2>/dev/null; then
        log ERROR "Invalid JSON in dashboard file: $dashboard_file"
        return 1
    fi
    
    # Check for required fields
    local required_fields=("dashboard.id" "dashboard.title" "dashboard.panels")
    for field in "${required_fields[@]}"; do
        if ! jq -e ".$field" "$dashboard_file" > /dev/null 2>&1; then
            log ERROR "Missing required field '$field' in dashboard: $dashboard_file"
            return 1
        fi
    done
    
    log DEBUG "Dashboard validation successful: $dashboard_file"
    return 0
}

# Create or update dashboard
provision_dashboard() {
    local dashboard_file="$1"
    local dashboard_name=$(basename "$dashboard_file" .json)
    
    log INFO "Provisioning dashboard: $dashboard_name"
    
    # Validate dashboard first
    if ! validate_dashboard "$dashboard_file"; then
        log ERROR "Dashboard validation failed: $dashboard_name"
        return 1
    fi
    
    # Extract dashboard content
    local dashboard_content=$(cat "$dashboard_file")
    local dashboard_id=$(echo "$dashboard_content" | jq -r '.dashboard.id')
    local dashboard_title=$(echo "$dashboard_content" | jq -r '.dashboard.title')
    
    log DEBUG "Dashboard ID: $dashboard_id"
    log DEBUG "Dashboard Title: $dashboard_title"
    
    # Check if dashboard already exists
    local existing_dashboard_response
    if existing_dashboard_response=$(curl -s -X GET \
        -H "Content-Type: application/json" \
        ${SIGNOZ_API_KEY:+-H "Authorization: Bearer $SIGNOZ_API_KEY"} \
        "$SIGNOZ_URL/api/v1/dashboards/$dashboard_id" 2>/dev/null); then
        
        if echo "$existing_dashboard_response" | jq -e '.dashboard' > /dev/null 2>&1; then
            log INFO "Dashboard exists, updating: $dashboard_title"
            
            # Update existing dashboard
            local update_response
            if update_response=$(curl -s -X PUT \
                -H "Content-Type: application/json" \
                ${SIGNOZ_API_KEY:+-H "Authorization: Bearer $SIGNOZ_API_KEY"} \
                -d "$dashboard_content" \
                "$SIGNOZ_URL/api/v1/dashboards/$dashboard_id"); then
                
                if echo "$update_response" | jq -e '.success' > /dev/null 2>&1; then
                    log INFO "Successfully updated dashboard: $dashboard_title"
                else
                    local error_msg=$(echo "$update_response" | jq -r '.error // "Unknown error"')
                    log ERROR "Failed to update dashboard: $dashboard_title - $error_msg"
                    return 1
                fi
            else
                log ERROR "Failed to update dashboard: $dashboard_title - HTTP request failed"
                return 1
            fi
        else
            log INFO "Dashboard doesn't exist, creating: $dashboard_title"
            
            # Create new dashboard
            local create_response
            if create_response=$(curl -s -X POST \
                -H "Content-Type: application/json" \
                ${SIGNOZ_API_KEY:+-H "Authorization: Bearer $SIGNOZ_API_KEY"} \
                -d "$dashboard_content" \
                "$SIGNOZ_URL/api/v1/dashboards"); then
                
                if echo "$create_response" | jq -e '.dashboard' > /dev/null 2>&1; then
                    log INFO "Successfully created dashboard: $dashboard_title"
                else
                    local error_msg=$(echo "$create_response" | jq -r '.error // "Unknown error"')
                    log ERROR "Failed to create dashboard: $dashboard_title - $error_msg"
                    return 1
                fi
            else
                log ERROR "Failed to create dashboard: $dashboard_title - HTTP request failed"
                return 1
            fi
        fi
    else
        log ERROR "Failed to check dashboard existence: $dashboard_title"
        return 1
    fi
    
    return 0
}

# Set up dashboard access controls
setup_dashboard_access() {
    local dashboard_id="$1"
    local access_level="${2:-viewer}"
    
    log INFO "Setting up access controls for dashboard: $dashboard_id"
    
    # Default access control configuration
    local access_config=$(cat << EOF
{
    "dashboard_id": "$dashboard_id",
    "permissions": {
        "admin": ["create", "read", "update", "delete"],
        "editor": ["read", "update"],
        "viewer": ["read"]
    },
    "default_role": "$access_level",
    "public_access": false
}
EOF
    )
    
    # Apply access controls if API supports it
    if curl -s -X POST \
        -H "Content-Type: application/json" \
        ${SIGNOZ_API_KEY:+-H "Authorization: Bearer $SIGNOZ_API_KEY"} \
        -d "$access_config" \
        "$SIGNOZ_URL/api/v1/dashboards/$dashboard_id/permissions" > /dev/null 2>&1; then
        log INFO "Access controls configured for dashboard: $dashboard_id"
    else
        log WARN "Access control API not available or failed for dashboard: $dashboard_id"
    fi
}

# Create dashboard folders/organization
organize_dashboards() {
    log INFO "Organizing dashboards into folders..."
    
    # Create folders for different dashboard categories
    local folders=(
        "application:Application Monitoring"
        "infrastructure:Infrastructure Monitoring"
        "database:Database Performance"
        "tenant:Tenant Management"
    )
    
    for folder_config in "${folders[@]}"; do
        local folder_id="${folder_config%:*}"
        local folder_title="${folder_config#*:}"
        
        local folder_data=$(cat << EOF
{
    "folder": {
        "id": "$folder_id",
        "title": "$folder_title",
        "description": "Automated folder for $folder_title dashboards"
    }
}
EOF
        )
        
        if curl -s -X POST \
            -H "Content-Type: application/json" \
            ${SIGNOZ_API_KEY:+-H "Authorization: Bearer $SIGNOZ_API_KEY"} \
            -d "$folder_data" \
            "$SIGNOZ_URL/api/v1/folders" > /dev/null 2>&1; then
            log INFO "Created folder: $folder_title"
        else
            log DEBUG "Folder creation failed or already exists: $folder_title"
        fi
    done
}

# Export dashboard configurations for backup
export_dashboards() {
    local export_dir="${1:-/tmp/signoz-dashboard-backup-$(date +%Y%m%d-%H%M%S)}"
    
    log INFO "Exporting dashboards to: $export_dir"
    mkdir -p "$export_dir"
    
    # Get list of all dashboards
    local dashboards_response
    if dashboards_response=$(curl -s -X GET \
        -H "Content-Type: application/json" \
        ${SIGNOZ_API_KEY:+-H "Authorization: Bearer $SIGNOZ_API_KEY"} \
        "$SIGNOZ_URL/api/v1/dashboards"); then
        
        # Extract dashboard IDs and export each one
        echo "$dashboards_response" | jq -r '.dashboards[].id' | while read -r dashboard_id; do
            if [ -n "$dashboard_id" ] && [ "$dashboard_id" != "null" ]; then
                log DEBUG "Exporting dashboard: $dashboard_id"
                
                local dashboard_export
                if dashboard_export=$(curl -s -X GET \
                    -H "Content-Type: application/json" \
                    ${SIGNOZ_API_KEY:+-H "Authorization: Bearer $SIGNOZ_API_KEY"} \
                    "$SIGNOZ_URL/api/v1/dashboards/$dashboard_id"); then
                    
                    echo "$dashboard_export" | jq '.' > "$export_dir/${dashboard_id}.json"
                    log DEBUG "Exported dashboard: $dashboard_id"
                fi
            fi
        done
        
        log INFO "Dashboard export completed: $export_dir"
    else
        log ERROR "Failed to retrieve dashboard list for export"
        return 1
    fi
}

# Health check for provisioned dashboards
health_check() {
    log INFO "Performing health check on provisioned dashboards..."
    
    local failed_dashboards=()
    
    # Check each dashboard file
    for dashboard_file in "$DASHBOARD_DIR"/*.json; do
        if [ -f "$dashboard_file" ]; then
            local dashboard_id=$(jq -r '.dashboard.id' "$dashboard_file")
            local dashboard_title=$(jq -r '.dashboard.title' "$dashboard_file")
            
            log DEBUG "Checking dashboard: $dashboard_title ($dashboard_id)"
            
            # Try to fetch dashboard
            if curl -s -X GET \
                -H "Content-Type: application/json" \
                ${SIGNOZ_API_KEY:+-H "Authorization: Bearer $SIGNOZ_API_KEY"} \
                "$SIGNOZ_URL/api/v1/dashboards/$dashboard_id" | jq -e '.dashboard' > /dev/null 2>&1; then
                log DEBUG "Dashboard healthy: $dashboard_title"
            else
                log ERROR "Dashboard unhealthy: $dashboard_title"
                failed_dashboards+=("$dashboard_title")
            fi
        fi
    done
    
    if [ ${#failed_dashboards[@]} -eq 0 ]; then
        log INFO "All dashboards are healthy"
        return 0
    else
        log ERROR "Failed health check for ${#failed_dashboards[@]} dashboards: ${failed_dashboards[*]}"
        return 1
    fi
}

# Main provisioning workflow
main() {
    log INFO "Starting SignOz Dashboard Provisioning"
    log INFO "Dashboard directory: $DASHBOARD_DIR"
    log INFO "SignOz URL: $SIGNOZ_URL"
    log INFO "Log file: $LOG_FILE"
    
    # Initialize log file
    echo "SignOz Dashboard Provisioning Log - $(date)" > "$LOG_FILE"
    
    # Check prerequisites
    check_prerequisites
    
    # Organize dashboards (create folders)
    organize_dashboards
    
    # Track provisioning results
    local success_count=0
    local failure_count=0
    local failed_dashboards=()
    
    # Process each dashboard file
    log INFO "Processing dashboard files..."
    for dashboard_file in "$DASHBOARD_DIR"/*.json; do
        if [ -f "$dashboard_file" ]; then
            local dashboard_name=$(basename "$dashboard_file" .json)
            
            if provision_dashboard "$dashboard_file"; then
                ((success_count++))
                
                # Set up access controls
                local dashboard_id=$(jq -r '.dashboard.id' "$dashboard_file")
                setup_dashboard_access "$dashboard_id" "viewer"
            else
                ((failure_count++))
                failed_dashboards+=("$dashboard_name")
            fi
        fi
    done
    
    # Report results
    log INFO "Dashboard provisioning completed"
    log INFO "Successfully provisioned: $success_count dashboards"
    
    if [ $failure_count -gt 0 ]; then
        log ERROR "Failed to provision: $failure_count dashboards"
        log ERROR "Failed dashboards: ${failed_dashboards[*]}"
    fi
    
    # Perform health check
    if health_check; then
        log INFO "Health check passed"
    else
        log WARN "Health check identified issues"
    fi
    
    # Export dashboards for backup
    export_dashboards
    
    log INFO "SignOz Dashboard Provisioning completed successfully"
    
    if [ $failure_count -gt 0 ]; then
        exit 1
    fi
}

# Script usage information
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --url URL          SignOz URL (default: http://localhost:3301)"
    echo "  -k, --api-key KEY      SignOz API key for authentication"
    echo "  -d, --dashboard-dir DIR Dashboard directory (default: ../dashboards)"
    echo "  -e, --export-only      Only export existing dashboards"
    echo "  -h, --health-check     Only perform health check"
    echo "  --help                 Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  SIGNOZ_URL            SignOz URL"
    echo "  SIGNOZ_API_KEY        SignOz API key"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Use default settings"
    echo "  $0 -u http://signoz:3301             # Custom SignOz URL"
    echo "  $0 -k your-api-key                   # With API key"
    echo "  $0 --export-only                     # Export dashboards only"
    echo "  $0 --health-check                    # Health check only"
}

# Parse command line arguments
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
        -d|--dashboard-dir)
            DASHBOARD_DIR="$2"
            shift 2
            ;;
        -e|--export-only)
            export_dashboards
            exit 0
            ;;
        -h|--health-check)
            check_prerequisites
            health_check
            exit $?
            ;;
        --help)
            usage
            exit 0
            ;;
        *)
            log ERROR "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Run main function
main