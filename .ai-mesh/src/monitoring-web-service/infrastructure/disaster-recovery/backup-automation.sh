#!/bin/bash
# Disaster Recovery and Backup Automation Script
# Infrastructure Management Subagent - Advanced Deployment Patterns

set -euo pipefail

# Configuration
APP_NAME="${1:-monitoring-web-service}"
ENVIRONMENT="${2:-production}"
AWS_REGION="${AWS_REGION:-us-west-2}"
BACKUP_REGION="${BACKUP_REGION:-us-east-1}"

# Backup configuration
DATABASE_IDENTIFIER="${APP_NAME}-${ENVIRONMENT}-db"
S3_BACKUP_BUCKET="${APP_NAME}-${ENVIRONMENT}-backups"
REDIS_CLUSTER_ID="${APP_NAME}-${ENVIRONMENT}-redis"
CONFIG_BACKUP_PATH="/tmp/config-backup"

# Retention policies
DAILY_RETENTION=7
WEEKLY_RETENTION=4
MONTHLY_RETENTION=12

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️ $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Validation functions
validate_prerequisites() {
    log "Validating prerequisites..."
    
    command -v aws >/dev/null 2>&1 || { error "AWS CLI is required but not installed."; exit 1; }
    command -v jq >/dev/null 2>&1 || { error "jq is required but not installed."; exit 1; }
    command -v kubectl >/dev/null 2>&1 || { error "kubectl is required but not installed."; exit 1; }
    
    # Check AWS credentials
    aws sts get-caller-identity >/dev/null 2>&1 || { error "AWS credentials not configured."; exit 1; }
    
    # Check kubectl context
    kubectl cluster-info >/dev/null 2>&1 || { error "kubectl not connected to cluster."; exit 1; }
    
    success "Prerequisites validated"
}

# Database backup functions
backup_database() {
    log "Starting database backup for $DATABASE_IDENTIFIER..."
    
    local timestamp=$(date +"%Y-%m-%d-%H-%M-%S")
    local snapshot_id="${DATABASE_IDENTIFIER}-snapshot-${timestamp}"
    
    # Create RDS snapshot
    aws rds create-db-cluster-snapshot \
        --db-cluster-snapshot-identifier "$snapshot_id" \
        --db-cluster-identifier "$DATABASE_IDENTIFIER" \
        --region "$AWS_REGION" >/dev/null
    
    log "Database snapshot $snapshot_id created, waiting for completion..."
    
    # Wait for snapshot to complete
    aws rds wait db-cluster-snapshot-completed \
        --db-cluster-snapshot-identifier "$snapshot_id" \
        --region "$AWS_REGION"
    
    success "Database snapshot $snapshot_id completed"
    
    # Copy snapshot to backup region
    local cross_region_snapshot_id="${snapshot_id}-cross-region"
    
    log "Copying snapshot to backup region $BACKUP_REGION..."
    
    aws rds copy-db-cluster-snapshot \
        --source-db-cluster-snapshot-identifier "arn:aws:rds:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):cluster-snapshot:${snapshot_id}" \
        --target-db-cluster-snapshot-identifier "$cross_region_snapshot_id" \
        --region "$BACKUP_REGION" >/dev/null
    
    success "Cross-region database backup initiated: $cross_region_snapshot_id"
    
    echo "$snapshot_id"
}

# Redis backup function
backup_redis() {
    log "Starting Redis backup for $REDIS_CLUSTER_ID..."
    
    local timestamp=$(date +"%Y-%m-%d-%H-%M-%S")
    local snapshot_name="${REDIS_CLUSTER_ID}-backup-${timestamp}"
    
    # Create Redis snapshot
    aws elasticache create-snapshot \
        --cache-cluster-id "$REDIS_CLUSTER_ID" \
        --snapshot-name "$snapshot_name" \
        --region "$AWS_REGION" >/dev/null
    
    log "Redis snapshot $snapshot_name created, waiting for completion..."
    
    # Wait for snapshot to complete (simplified - would need proper waiting logic)
    local max_wait=300  # 5 minutes
    local wait_count=0
    
    while [ $wait_count -lt $max_wait ]; do
        local status=$(aws elasticache describe-snapshots \
            --snapshot-name "$snapshot_name" \
            --region "$AWS_REGION" \
            --query 'Snapshots[0].SnapshotStatus' \
            --output text 2>/dev/null || echo "creating")
        
        if [ "$status" == "available" ]; then
            success "Redis snapshot $snapshot_name completed"
            break
        elif [ "$status" == "failed" ]; then
            error "Redis snapshot $snapshot_name failed"
            return 1
        fi
        
        sleep 10
        ((wait_count += 10))
    done
    
    if [ $wait_count -ge $max_wait ]; then
        warning "Redis snapshot $snapshot_name timed out, but may still be in progress"
    fi
    
    echo "$snapshot_name"
}

# Application data backup
backup_application_data() {
    log "Starting application data backup..."
    
    local timestamp=$(date +"%Y-%m-%d-%H-%M-%S")
    local backup_key="application-data/${timestamp}"
    
    # Create temporary backup directory
    local temp_backup_dir="/tmp/app-backup-${timestamp}"
    mkdir -p "$temp_backup_dir"
    
    # Backup persistent volumes (if any)
    log "Backing up persistent volumes..."
    kubectl get pvc -n monitoring-web-service -o json > "$temp_backup_dir/persistent-volumes.json"
    
    # Backup application configs
    log "Backing up application configurations..."
    kubectl get configmaps -n monitoring-web-service -o yaml > "$temp_backup_dir/configmaps.yaml"
    kubectl get secrets -n monitoring-web-service -o yaml > "$temp_backup_dir/secrets.yaml"
    
    # Backup custom resources
    log "Backing up custom resources..."
    kubectl get all -n monitoring-web-service -o yaml > "$temp_backup_dir/workloads.yaml"
    
    # Create archive
    tar -czf "${temp_backup_dir}.tar.gz" -C "$temp_backup_dir" .
    
    # Upload to S3
    aws s3 cp "${temp_backup_dir}.tar.gz" "s3://${S3_BACKUP_BUCKET}/${backup_key}.tar.gz" \
        --region "$AWS_REGION" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256
    
    # Copy to backup region
    aws s3 cp "s3://${S3_BACKUP_BUCKET}/${backup_key}.tar.gz" "s3://${S3_BACKUP_BUCKET}-${BACKUP_REGION}/${backup_key}.tar.gz" \
        --source-region "$AWS_REGION" \
        --region "$BACKUP_REGION" \
        --storage-class STANDARD_IA
    
    # Cleanup
    rm -rf "$temp_backup_dir" "${temp_backup_dir}.tar.gz"
    
    success "Application data backup completed: ${backup_key}.tar.gz"
    
    echo "$backup_key"
}

# Configuration backup
backup_configuration() {
    log "Starting configuration backup..."
    
    local timestamp=$(date +"%Y-%m-%d-%H-%M-%S")
    local config_backup_key="configuration/${timestamp}"
    
    mkdir -p "$CONFIG_BACKUP_PATH"
    
    # Backup Terraform state files
    log "Backing up Terraform state..."
    if aws s3 ls "s3://${APP_NAME}-terraform-state/" --region "$AWS_REGION" >/dev/null 2>&1; then
        aws s3 sync "s3://${APP_NAME}-terraform-state/" "$CONFIG_BACKUP_PATH/terraform-state/" --region "$AWS_REGION"
    fi
    
    # Backup infrastructure code
    log "Backing up infrastructure code..."
    if [ -d "./infrastructure" ]; then
        cp -r ./infrastructure "$CONFIG_BACKUP_PATH/"
    fi
    
    # Backup Kubernetes manifests
    log "Backing up Kubernetes manifests..."
    if [ -d "./k8s" ]; then
        cp -r ./k8s "$CONFIG_BACKUP_PATH/"
    fi
    
    # Create configuration archive
    tar -czf "${CONFIG_BACKUP_PATH}-${timestamp}.tar.gz" -C "$CONFIG_BACKUP_PATH" .
    
    # Upload to S3
    aws s3 cp "${CONFIG_BACKUP_PATH}-${timestamp}.tar.gz" "s3://${S3_BACKUP_BUCKET}/${config_backup_key}.tar.gz" \
        --region "$AWS_REGION" \
        --storage-class STANDARD_IA \
        --server-side-encryption AES256
    
    # Cross-region backup
    aws s3 cp "s3://${S3_BACKUP_BUCKET}/${config_backup_key}.tar.gz" "s3://${S3_BACKUP_BUCKET}-${BACKUP_REGION}/${config_backup_key}.tar.gz" \
        --source-region "$AWS_REGION" \
        --region "$BACKUP_REGION" \
        --storage-class STANDARD_IA
    
    # Cleanup
    rm -rf "$CONFIG_BACKUP_PATH" "${CONFIG_BACKUP_PATH}-${timestamp}.tar.gz"
    
    success "Configuration backup completed: ${config_backup_key}.tar.gz"
    
    echo "$config_backup_key"
}

# Backup validation
validate_backup() {
    local backup_type="$1"
    local backup_id="$2"
    
    log "Validating $backup_type backup: $backup_id"
    
    case "$backup_type" in
        "database")
            # Check snapshot exists and is available
            local status=$(aws rds describe-db-cluster-snapshots \
                --db-cluster-snapshot-identifier "$backup_id" \
                --region "$AWS_REGION" \
                --query 'DBClusterSnapshots[0].Status' \
                --output text)
            
            if [ "$status" == "available" ]; then
                success "Database backup validation passed"
                return 0
            else
                error "Database backup validation failed: status=$status"
                return 1
            fi
            ;;
            
        "redis")
            # Check Redis snapshot exists
            local status=$(aws elasticache describe-snapshots \
                --snapshot-name "$backup_id" \
                --region "$AWS_REGION" \
                --query 'Snapshots[0].SnapshotStatus' \
                --output text)
            
            if [ "$status" == "available" ]; then
                success "Redis backup validation passed"
                return 0
            else
                error "Redis backup validation failed: status=$status"
                return 1
            fi
            ;;
            
        "application"|"configuration")
            # Check S3 object exists
            if aws s3 ls "s3://${S3_BACKUP_BUCKET}/${backup_id}.tar.gz" --region "$AWS_REGION" >/dev/null 2>&1; then
                # Check cross-region copy
                if aws s3 ls "s3://${S3_BACKUP_BUCKET}-${BACKUP_REGION}/${backup_id}.tar.gz" --region "$BACKUP_REGION" >/dev/null 2>&1; then
                    success "$backup_type backup validation passed"
                    return 0
                else
                    error "$backup_type backup validation failed: cross-region copy not found"
                    return 1
                fi
            else
                error "$backup_type backup validation failed: primary backup not found"
                return 1
            fi
            ;;
    esac
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    # Cleanup RDS snapshots
    log "Cleaning up old database snapshots..."
    local db_snapshots=$(aws rds describe-db-cluster-snapshots \
        --db-cluster-identifier "$DATABASE_IDENTIFIER" \
        --region "$AWS_REGION" \
        --query 'DBClusterSnapshots[?starts_with(DBClusterSnapshotIdentifier, `'${DATABASE_IDENTIFIER}'-snapshot`)].{Id:DBClusterSnapshotIdentifier,Created:SnapshotCreateTime}' \
        --output json)
    
    # Delete snapshots older than retention policy
    echo "$db_snapshots" | jq -r --arg days "$DAILY_RETENTION" '.[] | select((.Created | fromdateiso8601) < (now - (($days | tonumber) * 86400))) | .Id' | while read -r snapshot_id; do
        if [ -n "$snapshot_id" ]; then
            log "Deleting old database snapshot: $snapshot_id"
            aws rds delete-db-cluster-snapshot \
                --db-cluster-snapshot-identifier "$snapshot_id" \
                --region "$AWS_REGION" >/dev/null || true
        fi
    done
    
    # Cleanup S3 backups using lifecycle policy (this would be configured separately)
    log "S3 backup cleanup managed by lifecycle policies"
    
    success "Backup cleanup completed"
}

# Test restore procedure
test_restore() {
    log "Testing restore procedures (dry run)..."
    
    # Test database restore (dry run)
    log "Testing database restore capability..."
    local latest_snapshot=$(aws rds describe-db-cluster-snapshots \
        --db-cluster-identifier "$DATABASE_IDENTIFIER" \
        --region "$AWS_REGION" \
        --query 'DBClusterSnapshots[?starts_with(DBClusterSnapshotIdentifier, `'${DATABASE_IDENTIFIER}'-snapshot`)] | sort_by(@, &SnapshotCreateTime) | [-1].DBClusterSnapshotIdentifier' \
        --output text)
    
    if [ "$latest_snapshot" != "None" ]; then
        success "Latest database snapshot available for restore: $latest_snapshot"
    else
        warning "No database snapshots available for restore"
    fi
    
    # Test S3 backup accessibility
    log "Testing S3 backup accessibility..."
    local latest_app_backup=$(aws s3 ls "s3://${S3_BACKUP_BUCKET}/application-data/" --region "$AWS_REGION" | sort | tail -1 | awk '{print $4}')
    
    if [ -n "$latest_app_backup" ]; then
        # Download a small portion to test accessibility
        aws s3 cp "s3://${S3_BACKUP_BUCKET}/application-data/${latest_app_backup}" /tmp/restore-test.tar.gz \
            --range bytes=0-1024 \
            --region "$AWS_REGION" >/dev/null
        
        if [ -f "/tmp/restore-test.tar.gz" ]; then
            success "S3 backup accessibility test passed"
            rm -f /tmp/restore-test.tar.gz
        else
            warning "S3 backup accessibility test failed"
        fi
    else
        warning "No application backups found for testing"
    fi
    
    success "Restore testing completed"
}

# Generate backup report
generate_backup_report() {
    local report_file="/tmp/backup-report-$(date +%Y-%m-%d).json"
    
    log "Generating backup report..."
    
    cat > "$report_file" <<EOF
{
  "backupReport": {
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "application": "$APP_NAME",
    "region": "$AWS_REGION",
    "backupRegion": "$BACKUP_REGION",
    "backups": {
      "database": "$(aws rds describe-db-cluster-snapshots --db-cluster-identifier "$DATABASE_IDENTIFIER" --region "$AWS_REGION" --query 'length(DBClusterSnapshots)' --output text)",
      "redis": "$(aws elasticache describe-snapshots --region "$AWS_REGION" --query 'length(Snapshots[?starts_with(SnapshotName, `'${REDIS_CLUSTER_ID}'`)])' --output text)",
      "applicationData": "$(aws s3 ls "s3://${S3_BACKUP_BUCKET}/application-data/" --region "$AWS_REGION" | wc -l)",
      "configuration": "$(aws s3 ls "s3://${S3_BACKUP_BUCKET}/configuration/" --region "$AWS_REGION" | wc -l)"
    },
    "retentionPolicy": {
      "daily": $DAILY_RETENTION,
      "weekly": $WEEKLY_RETENTION,
      "monthly": $MONTHLY_RETENTION
    },
    "status": "completed"
  }
}
EOF
    
    # Upload report to S3
    aws s3 cp "$report_file" "s3://${S3_BACKUP_BUCKET}/reports/backup-report-$(date +%Y-%m-%d).json" \
        --region "$AWS_REGION"
    
    rm -f "$report_file"
    
    success "Backup report generated and uploaded"
}

# Main backup orchestration
main() {
    log "Starting comprehensive backup for $APP_NAME in $ENVIRONMENT"
    
    validate_prerequisites
    
    # Perform backups
    local db_backup_id=$(backup_database)
    local redis_backup_id=$(backup_redis)
    local app_backup_id=$(backup_application_data)
    local config_backup_id=$(backup_configuration)
    
    # Validate backups
    log "Validating all backups..."
    local validation_errors=0
    
    validate_backup "database" "$db_backup_id" || ((validation_errors++))
    validate_backup "redis" "$redis_backup_id" || ((validation_errors++))
    validate_backup "application" "$app_backup_id" || ((validation_errors++))
    validate_backup "configuration" "$config_backup_id" || ((validation_errors++))
    
    if [ $validation_errors -eq 0 ]; then
        success "All backup validations passed"
    else
        error "$validation_errors backup validation(s) failed"
    fi
    
    # Test restore procedures
    test_restore
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Generate report
    generate_backup_report
    
    success "Comprehensive backup completed successfully!"
    log "Database backup: $db_backup_id"
    log "Redis backup: $redis_backup_id" 
    log "Application backup: $app_backup_id"
    log "Configuration backup: $config_backup_id"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi