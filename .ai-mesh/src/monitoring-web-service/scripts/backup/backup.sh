#!/bin/bash

# Database Backup Script for PostgreSQL
# Automated backup solution for production deployments

set -euo pipefail

# Configuration from environment or secrets
PGUSER="${PGUSER:-$(cat /run/secrets/postgres_user 2>/dev/null || echo 'metrics_user')}"
PGPASSWORD="${PGPASSWORD:-$(cat /run/secrets/postgres_password 2>/dev/null || echo '')}"
PGDATABASE="${PGDATABASE:-$(cat /run/secrets/postgres_database 2>/dev/null || echo 'metrics_production')}"
PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"

# Backup configuration
BACKUP_DIR="/backup"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
COMPRESSION="${COMPRESSION:-gzip}"
BACKUP_FORMAT="${BACKUP_FORMAT:-custom}"

# Logging
log_info() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >&2
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1"
}

# Wait for PostgreSQL to be ready
wait_for_postgres() {
    log_info "Waiting for PostgreSQL to be ready..."
    
    for i in {1..30}; do
        if pg_isready -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" >/dev/null 2>&1; then
            log_success "PostgreSQL is ready"
            return 0
        fi
        log_info "Waiting for PostgreSQL... (${i}/30)"
        sleep 5
    done
    
    log_error "PostgreSQL is not responding after 150 seconds"
    exit 1
}

# Create backup directory structure
setup_backup_dir() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_path="${BACKUP_DIR}/${timestamp}"
    
    mkdir -p "${backup_path}"
    echo "${backup_path}"
}

# Perform PostgreSQL backup
backup_postgres() {
    local backup_path="$1"
    local timestamp=$(basename "${backup_path}")
    
    log_info "Starting PostgreSQL backup..."
    
    # Full database backup
    local backup_file="${backup_path}/postgres_${timestamp}.backup"
    
    if [[ "${BACKUP_FORMAT}" == "custom" ]]; then
        pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" \
            -Fc -Z 9 --verbose --no-password > "${backup_file}"
    elif [[ "${BACKUP_FORMAT}" == "sql" ]]; then
        backup_file="${backup_path}/postgres_${timestamp}.sql"
        pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" \
            --verbose --no-password > "${backup_file}"
        
        if [[ "${COMPRESSION}" == "gzip" ]]; then
            gzip "${backup_file}"
            backup_file="${backup_file}.gz"
        fi
    fi
    
    # Check backup file size
    local backup_size=$(stat -f%z "${backup_file}" 2>/dev/null || stat -c%s "${backup_file}" 2>/dev/null || echo "0")
    
    if [[ "${backup_size}" -gt 1024 ]]; then
        log_success "PostgreSQL backup completed: ${backup_file} ($(numfmt --to=iec "${backup_size}"))"
    else
        log_error "Backup file seems too small: ${backup_size} bytes"
        exit 1
    fi
    
    # Create backup metadata
    cat > "${backup_path}/metadata.json" << EOF
{
    "timestamp": "${timestamp}",
    "database": "${PGDATABASE}",
    "user": "${PGUSER}",
    "host": "${PGHOST}",
    "port": "${PGPORT}",
    "format": "${BACKUP_FORMAT}",
    "compression": "${COMPRESSION}",
    "file_size": ${backup_size},
    "backup_type": "full",
    "created_at": "$(date -Iseconds)"
}
EOF
    
    return 0
}

# Perform TimescaleDB specific backup (hypertables)
backup_timescaledb() {
    local backup_path="$1"
    local timestamp=$(basename "${backup_path}")
    
    log_info "Creating TimescaleDB hypertable backup..."
    
    # Get list of hypertables
    local hypertables_file="${backup_path}/hypertables_${timestamp}.sql"
    
    psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -t -c "
        SELECT format('SELECT pg_dump_hypertable(%L, %L);', 
                     schema_name||'.'||table_name, 
                     '${backup_path}/'||schema_name||'_'||table_name||'_${timestamp}.sql')
        FROM timescaledb_information.hypertables;
    " > "${hypertables_file}" 2>/dev/null || {
        log_info "No TimescaleDB hypertables found or TimescaleDB not installed"
        return 0
    }
    
    # Execute hypertable backups
    while IFS= read -r line; do
        if [[ -n "${line}" && "${line}" != *"(0 rows)"* ]]; then
            psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -c "${line}" >/dev/null 2>&1 || {
                log_error "Failed to backup hypertable: ${line}"
            }
        fi
    done < "${hypertables_file}"
    
    log_success "TimescaleDB backup completed"
}

# Verify backup integrity
verify_backup() {
    local backup_path="$1"
    local timestamp=$(basename "${backup_path}")
    
    log_info "Verifying backup integrity..."
    
    # Find the main backup file
    local backup_file
    backup_file=$(find "${backup_path}" -name "postgres_${timestamp}.*" -type f | head -1)
    
    if [[ -z "${backup_file}" ]]; then
        log_error "Backup file not found in ${backup_path}"
        return 1
    fi
    
    # Verify based on format
    if [[ "${backup_file}" == *.backup ]]; then
        # Custom format verification
        pg_restore --list "${backup_file}" >/dev/null 2>&1 || {
            log_error "Backup verification failed: invalid custom format"
            return 1
        }
    elif [[ "${backup_file}" == *.sql* ]]; then
        # SQL format verification
        if [[ "${backup_file}" == *.gz ]]; then
            gzip -t "${backup_file}" || {
                log_error "Backup verification failed: corrupted gzip file"
                return 1
            }
        fi
        
        # Check for SQL structure
        local check_cmd="head -20"
        if [[ "${backup_file}" == *.gz ]]; then
            check_cmd="zcat | head -20"
        else
            check_cmd="head -20"
        fi
        
        if ! eval "${check_cmd} '${backup_file}'" | grep -q "PostgreSQL database dump" 2>/dev/null; then
            log_error "Backup verification failed: not a valid PostgreSQL dump"
            return 1
        fi
    fi
    
    log_success "Backup verification completed successfully"
    return 0
}

# Clean up old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."
    
    find "${BACKUP_DIR}" -type d -name "????????_??????" -mtime +${RETENTION_DAYS} -exec rm -rf {} \; 2>/dev/null || true
    
    log_success "Old backup cleanup completed"
}

# Upload backup to S3 (if configured)
upload_to_s3() {
    local backup_path="$1"
    
    if [[ -z "${AWS_S3_BUCKET:-}" ]]; then
        log_info "S3 upload not configured (AWS_S3_BUCKET not set)"
        return 0
    fi
    
    if ! command -v aws >/dev/null 2>&1; then
        log_info "AWS CLI not found, skipping S3 upload"
        return 0
    fi
    
    log_info "Uploading backup to S3..."
    
    local timestamp=$(basename "${backup_path}")
    local s3_prefix="${AWS_S3_PREFIX:-backups/postgres}"
    
    aws s3 sync "${backup_path}" "s3://${AWS_S3_BUCKET}/${s3_prefix}/${timestamp}/" \
        --storage-class "${AWS_S3_STORAGE_CLASS:-STANDARD_IA}" \
        --exclude "*.tmp" || {
        log_error "S3 upload failed"
        return 1
    }
    
    log_success "Backup uploaded to S3: s3://${AWS_S3_BUCKET}/${s3_prefix}/${timestamp}/"
}

# Send notification (if configured)
send_notification() {
    local status="$1"
    local message="$2"
    
    if [[ -n "${WEBHOOK_URL:-}" ]]; then
        local payload="{\"text\":\"Backup ${status}: ${message}\"}"
        curl -X POST -H 'Content-type: application/json' --data "${payload}" "${WEBHOOK_URL}" >/dev/null 2>&1 || {
            log_info "Webhook notification failed"
        }
    fi
    
    if [[ -n "${SMTP_HOST:-}" ]]; then
        local subject="Database Backup ${status}"
        local body="${message}\n\nTimestamp: $(date)\nDatabase: ${PGDATABASE}\nHost: ${PGHOST}"
        
        echo -e "Subject: ${subject}\n\n${body}" | \
        sendmail -S "${SMTP_HOST}:${SMTP_PORT:-587}" \
                 -au"${SMTP_USER:-}" -ap"${SMTP_PASSWORD:-}" \
                 "${EMAIL_TO:-}" 2>/dev/null || {
            log_info "Email notification failed"
        }
    fi
}

# Main backup function
main() {
    log_info "Starting database backup process..."
    
    # Export PostgreSQL password
    export PGPASSWORD
    
    # Wait for database
    wait_for_postgres
    
    # Setup backup directory
    local backup_path
    backup_path=$(setup_backup_dir)
    
    # Perform backup
    if backup_postgres "${backup_path}"; then
        # TimescaleDB specific backup
        backup_timescaledb "${backup_path}"
        
        # Verify backup
        if verify_backup "${backup_path}"; then
            # Upload to S3 if configured
            upload_to_s3 "${backup_path}"
            
            # Cleanup old backups
            cleanup_old_backups
            
            local message="Database backup completed successfully at ${backup_path}"
            log_success "${message}"
            send_notification "SUCCESS" "${message}"
            
            exit 0
        else
            local message="Backup verification failed"
            log_error "${message}"
            send_notification "FAILED" "${message}"
            exit 1
        fi
    else
        local message="Database backup failed"
        log_error "${message}"
        send_notification "FAILED" "${message}"
        exit 1
    fi
}

# Handle signals
trap 'log_error "Backup interrupted"; exit 1' INT TERM

# Run main function
main "$@"