#!/bin/bash

# Docker Container Orchestration Script
# Phase 2: Infrastructure & Integration - Advanced Container Orchestration
# Manages multi-environment Docker deployments with comprehensive automation

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_ROOT}/docker-compose.yml"

# Environment configurations
ENVIRONMENTS=("development" "staging" "production")
DEFAULT_ENVIRONMENT="development"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
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

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

log_debug() {
    if [[ "${DEBUG:-}" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    if ! command_exists docker; then
        log_error "Docker not found. Please install Docker first."
        exit 1
    fi
    
    if command_exists docker-compose; then
        COMPOSE_CMD="docker-compose"
        COMPOSE_VERSION=$(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)
    elif command_exists docker && docker compose version >/dev/null 2>&1; then
        COMPOSE_CMD="docker compose"
        COMPOSE_VERSION=$(docker compose version --short)
    else
        log_error "Docker Compose not found. Please install Docker Compose."
        exit 1
    fi
    
    log_info "Docker Compose version: ${COMPOSE_VERSION}"
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to load environment configuration
load_environment_config() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    
    log_debug "Loading configuration for environment: ${env}"
    
    # Set environment-specific variables
    case "${env}" in
        "development")
            COMPOSE_FILES="-f ${COMPOSE_FILE} -f ${PROJECT_ROOT}/docker-compose.override.yml"
            PROJECT_NAME="metrics-dev"
            PROFILES="development"
            ;;
        "staging")
            COMPOSE_FILES="-f ${COMPOSE_FILE} -f ${PROJECT_ROOT}/docker-compose.staging.yml"
            PROJECT_NAME="metrics-staging"
            PROFILES="staging"
            ;;
        "production")
            COMPOSE_FILES="-f ${COMPOSE_FILE} -f ${PROJECT_ROOT}/docker-compose.prod.yml"
            PROJECT_NAME="metrics-prod"
            PROFILES="production"
            ;;
        *)
            log_error "Unknown environment: ${env}. Supported: ${ENVIRONMENTS[*]}"
            exit 1
            ;;
    esac
    
    # Load environment file if it exists
    ENV_FILE="${PROJECT_ROOT}/.env.${env}"
    if [[ -f "${ENV_FILE}" ]]; then
        log_info "Loading environment file: ${ENV_FILE}"
        set -a
        # shellcheck source=/dev/null
        source "${ENV_FILE}"
        set +a
    else
        log_info "No environment file found: ${ENV_FILE}"
    fi
    
    export COMPOSE_PROJECT_NAME="${PROJECT_NAME}"
    export COMPOSE_PROFILES="${PROFILES}"
    
    log_debug "Compose files: ${COMPOSE_FILES}"
    log_debug "Project name: ${PROJECT_NAME}"
    log_debug "Profiles: ${PROFILES}"
}

# Function to validate docker-compose configuration
validate_compose_config() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    
    log_step "Validating Docker Compose configuration for ${env}..."
    
    load_environment_config "${env}"
    
    # Check compose file syntax
    if ${COMPOSE_CMD} ${COMPOSE_FILES} config --quiet; then
        log_success "Docker Compose configuration is valid"
    else
        log_error "Docker Compose configuration validation failed"
        return 1
    fi
    
    # Check for required environment variables
    local required_vars=("DB_PASSWORD" "JWT_SECRET")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("${var}")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_warning "Missing environment variables: ${missing_vars[*]}"
        log_info "These variables will be auto-generated if not provided"
    fi
}

# Function to setup environment
setup_environment() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    
    log_step "Setting up environment: ${env}"
    
    load_environment_config "${env}"
    
    # Create necessary directories
    local dirs=("logs" "data/postgres" "data/redis" "backup/postgres" "backup/redis")
    for dir in "${dirs[@]}"; do
        mkdir -p "${PROJECT_ROOT}/${dir}"
        log_debug "Created directory: ${dir}"
    done
    
    # Set proper permissions
    chmod 700 "${PROJECT_ROOT}/data/postgres" 2>/dev/null || true
    chmod 700 "${PROJECT_ROOT}/data/redis" 2>/dev/null || true
    
    # Generate secrets if they don't exist
    generate_secrets "${env}"
    
    log_success "Environment ${env} setup completed"
}

# Function to generate secrets
generate_secrets() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    local env_file="${PROJECT_ROOT}/.env.${env}"
    
    log_step "Generating secrets for ${env}..."
    
    # Function to generate a random password
    generate_password() {
        openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
    }
    
    # Create or update environment file with secrets
    if [[ ! -f "${env_file}" ]]; then
        cat > "${env_file}" << EOF
# Environment configuration for ${env}
# Generated on $(date)

# Database configuration
DB_PASSWORD=$(generate_password)
DB_NAME=metrics_${env}
DB_USER=metrics_user

# Redis configuration
REDIS_PASSWORD=$(generate_password)

# JWT secrets
JWT_SECRET=$(generate_password)
JWT_REFRESH_SECRET=$(generate_password)

# Application configuration
NODE_ENV=${env}
LOG_LEVEL=${env == "production" && echo "info" || echo "debug"}

# Monitoring configuration
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true
EOF
        log_success "Generated environment file: ${env_file}"
    else
        log_info "Environment file already exists: ${env_file}"
    fi
    
    # Set proper permissions on environment file
    chmod 600 "${env_file}"
}

# Function to build images
build_images() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    local no_cache="${2:-false}"
    
    log_step "Building images for ${env}..."
    
    load_environment_config "${env}"
    
    local build_args=""
    if [[ "${no_cache}" == "true" ]]; then
        build_args="--no-cache"
    fi
    
    # Build the main application image
    ${COMPOSE_CMD} ${COMPOSE_FILES} build ${build_args} metrics-api
    
    log_success "Images built successfully"
}

# Function to start services
start_services() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    local services="${2:-}"
    local detached="${3:-true}"
    
    log_step "Starting services for ${env}..."
    
    load_environment_config "${env}"
    
    local compose_args=""
    if [[ "${detached}" == "true" ]]; then
        compose_args="-d"
    fi
    
    # Start core services first
    log_info "Starting core services (postgres, redis)..."
    ${COMPOSE_CMD} ${COMPOSE_FILES} up ${compose_args} postgres redis
    
    # Wait for databases to be ready
    log_info "Waiting for databases to be ready..."
    sleep 15
    
    # Check database connectivity
    check_database_connectivity "${env}"
    
    # Start application services
    if [[ -z "${services}" ]]; then
        log_info "Starting all application services..."
        ${COMPOSE_CMD} ${COMPOSE_FILES} up ${compose_args}
    else
        log_info "Starting specific services: ${services}"
        ${COMPOSE_CMD} ${COMPOSE_FILES} up ${compose_args} ${services}
    fi
    
    # Wait for services to be ready
    sleep 10
    
    # Verify services are healthy
    check_service_health "${env}"
    
    log_success "Services started successfully"
}

# Function to stop services
stop_services() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    local remove_volumes="${2:-false}"
    
    log_step "Stopping services for ${env}..."
    
    load_environment_config "${env}"
    
    ${COMPOSE_CMD} ${COMPOSE_FILES} down
    
    if [[ "${remove_volumes}" == "true" ]]; then
        log_warning "Removing volumes (this will delete all data)..."
        ${COMPOSE_CMD} ${COMPOSE_FILES} down -v
    fi
    
    log_success "Services stopped successfully"
}

# Function to check database connectivity
check_database_connectivity() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    
    log_debug "Checking database connectivity..."
    
    load_environment_config "${env}"
    
    # Check PostgreSQL
    local postgres_ready=false
    for i in {1..30}; do
        if ${COMPOSE_CMD} ${COMPOSE_FILES} exec -T postgres pg_isready -U "${DB_USER:-metrics_user}" >/dev/null 2>&1; then
            postgres_ready=true
            break
        fi
        log_debug "Waiting for PostgreSQL... (${i}/30)"
        sleep 2
    done
    
    if [[ "${postgres_ready}" == "true" ]]; then
        log_success "✓ PostgreSQL is ready"
    else
        log_error "✗ PostgreSQL is not ready"
        return 1
    fi
    
    # Check Redis
    local redis_ready=false
    for i in {1..30}; do
        if ${COMPOSE_CMD} ${COMPOSE_FILES} exec -T redis redis-cli ping >/dev/null 2>&1; then
            redis_ready=true
            break
        fi
        log_debug "Waiting for Redis... (${i}/30)"
        sleep 2
    done
    
    if [[ "${redis_ready}" == "true" ]]; then
        log_success "✓ Redis is ready"
    else
        log_error "✗ Redis is not ready"
        return 1
    fi
}

# Function to check service health
check_service_health() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    
    log_debug "Checking service health..."
    
    load_environment_config "${env}"
    
    # Get application port
    local app_port
    app_port=$(${COMPOSE_CMD} ${COMPOSE_FILES} port metrics-api 3000 2>/dev/null | cut -d':' -f2 || echo "3000")
    
    # Check application health
    local app_healthy=false
    for i in {1..30}; do
        if curl -s "http://localhost:${app_port}/api/health" >/dev/null 2>&1; then
            app_healthy=true
            break
        fi
        log_debug "Waiting for application health check... (${i}/30)"
        sleep 2
    done
    
    if [[ "${app_healthy}" == "true" ]]; then
        log_success "✓ Application is healthy"
    else
        log_warning "✗ Application health check failed"
    fi
    
    # Check PostgreSQL exporter if enabled
    local exporter_port
    exporter_port=$(${COMPOSE_CMD} ${COMPOSE_FILES} port postgres-exporter 9187 2>/dev/null | cut -d':' -f2 || echo "")
    
    if [[ -n "${exporter_port}" ]]; then
        if curl -s "http://localhost:${exporter_port}/metrics" >/dev/null 2>&1; then
            log_success "✓ PostgreSQL exporter is healthy"
        else
            log_warning "✗ PostgreSQL exporter health check failed"
        fi
    fi
}

# Function to show service status
show_status() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    
    log_step "Service status for ${env}:"
    
    load_environment_config "${env}"
    
    # Show running containers
    echo
    log_info "Running containers:"
    ${COMPOSE_CMD} ${COMPOSE_FILES} ps
    
    # Show service endpoints
    echo
    log_info "Service endpoints:"
    
    local app_port
    app_port=$(${COMPOSE_CMD} ${COMPOSE_FILES} port metrics-api 3000 2>/dev/null | cut -d':' -f2 || echo "not running")
    echo "  Application: http://localhost:${app_port}"
    
    local exporter_port
    exporter_port=$(${COMPOSE_CMD} ${COMPOSE_FILES} port postgres-exporter 9187 2>/dev/null | cut -d':' -f2 || echo "not running")
    echo "  PostgreSQL Exporter: http://localhost:${exporter_port}/metrics"
    
    local prometheus_port
    prometheus_port=$(${COMPOSE_CMD} ${COMPOSE_FILES} port prometheus 9090 2>/dev/null | cut -d':' -f2 || echo "not running")
    if [[ "${prometheus_port}" != "not running" ]]; then
        echo "  Prometheus: http://localhost:${prometheus_port}"
    fi
    
    local grafana_port
    grafana_port=$(${COMPOSE_CMD} ${COMPOSE_FILES} port grafana 3000 2>/dev/null | cut -d':' -f2 || echo "not running")
    if [[ "${grafana_port}" != "not running" ]]; then
        echo "  Grafana: http://localhost:${grafana_port}"
    fi
    
    # Show resource usage
    echo
    log_info "Resource usage:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" $(${COMPOSE_CMD} ${COMPOSE_FILES} ps -q) 2>/dev/null || log_info "No running containers"
}

# Function to view logs
view_logs() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    local service="${2:-}"
    local follow="${3:-false}"
    
    log_step "Viewing logs for ${env}..."
    
    load_environment_config "${env}"
    
    local log_args=""
    if [[ "${follow}" == "true" ]]; then
        log_args="-f"
    fi
    
    if [[ -z "${service}" ]]; then
        ${COMPOSE_CMD} ${COMPOSE_FILES} logs ${log_args}
    else
        ${COMPOSE_CMD} ${COMPOSE_FILES} logs ${log_args} "${service}"
    fi
}

# Function to execute commands in containers
execute_command() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    local service="${2}"
    shift 2
    local cmd=("$@")
    
    load_environment_config "${env}"
    
    log_info "Executing command in ${service}: ${cmd[*]}"
    ${COMPOSE_CMD} ${COMPOSE_FILES} exec "${service}" "${cmd[@]}"
}

# Function to backup data
backup_data() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    local backup_type="${2:-full}"
    
    log_step "Creating ${backup_type} backup for ${env}..."
    
    load_environment_config "${env}"
    
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="${PROJECT_ROOT}/backup/${env}/${timestamp}"
    
    mkdir -p "${backup_dir}"
    
    # Backup PostgreSQL
    log_info "Backing up PostgreSQL..."
    ${COMPOSE_CMD} ${COMPOSE_FILES} exec -T postgres pg_dump -U "${DB_USER:-metrics_user}" "${DB_NAME:-metrics_development}" > "${backup_dir}/postgres.sql"
    
    # Backup Redis (if needed)
    if [[ "${backup_type}" == "full" ]]; then
        log_info "Backing up Redis..."
        ${COMPOSE_CMD} ${COMPOSE_FILES} exec redis redis-cli --rdb - > "${backup_dir}/redis.rdb" 2>/dev/null || log_warning "Redis backup failed (may be empty)"
    fi
    
    # Create backup manifest
    cat > "${backup_dir}/manifest.txt" << EOF
Backup created: $(date)
Environment: ${env}
Backup type: ${backup_type}
PostgreSQL: postgres.sql
Redis: redis.rdb (if full backup)
EOF
    
    log_success "Backup completed: ${backup_dir}"
}

# Function to restore data
restore_data() {
    local env="${1:-${DEFAULT_ENVIRONMENT}}"
    local backup_path="${2}"
    
    if [[ -z "${backup_path}" ]]; then
        log_error "Backup path is required"
        exit 1
    fi
    
    if [[ ! -d "${backup_path}" ]]; then
        log_error "Backup directory not found: ${backup_path}"
        exit 1
    fi
    
    log_step "Restoring data for ${env} from ${backup_path}..."
    log_warning "This will overwrite existing data!"
    
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [[ "${confirm}" != "yes" ]]; then
        log_info "Restore cancelled"
        return 0
    fi
    
    load_environment_config "${env}"
    
    # Restore PostgreSQL
    if [[ -f "${backup_path}/postgres.sql" ]]; then
        log_info "Restoring PostgreSQL..."
        ${COMPOSE_CMD} ${COMPOSE_FILES} exec -T postgres psql -U "${DB_USER:-metrics_user}" "${DB_NAME:-metrics_development}" < "${backup_path}/postgres.sql"
    fi
    
    # Restore Redis
    if [[ -f "${backup_path}/redis.rdb" ]]; then
        log_info "Restoring Redis..."
        ${COMPOSE_CMD} ${COMPOSE_FILES} stop redis
        cp "${backup_path}/redis.rdb" "${PROJECT_ROOT}/data/redis/dump.rdb"
        ${COMPOSE_CMD} ${COMPOSE_FILES} start redis
    fi
    
    log_success "Data restored successfully"
}

# Function to show help
show_help() {
    echo "Docker Container Orchestration Script"
    echo
    echo "Usage: $0 [ENVIRONMENT] [COMMAND] [OPTIONS]"
    echo
    echo "Environments: ${ENVIRONMENTS[*]}"
    echo "Default environment: ${DEFAULT_ENVIRONMENT}"
    echo
    echo "Commands:"
    echo "  setup                 Setup environment and generate secrets"
    echo "  validate              Validate docker-compose configuration"
    echo "  build [--no-cache]    Build container images"
    echo "  start [services]      Start services"
    echo "  stop [--volumes]      Stop services"
    echo "  restart [services]    Restart services"
    echo "  status                Show service status"
    echo "  logs [service] [-f]   View service logs"
    echo "  exec <service> <cmd>  Execute command in container"
    echo "  backup [full|quick]   Backup data"
    echo "  restore <path>        Restore data from backup"
    echo "  clean [--all]         Clean up containers and images"
    echo "  help                  Show this help"
    echo
    echo "Examples:"
    echo "  $0 development setup                    # Setup development environment"
    echo "  $0 production start                     # Start production services"
    echo "  $0 staging logs metrics-api -f          # Follow application logs in staging"
    echo "  $0 development exec postgres psql       # Connect to PostgreSQL in development"
    echo "  $0 production backup full               # Create full backup of production"
    echo
}

# Main script logic
main() {
    # Parse arguments
    local environment="${DEFAULT_ENVIRONMENT}"
    local command=""
    local options=()
    
    # Check if first argument is an environment
    if [[ $# -gt 0 ]] && [[ " ${ENVIRONMENTS[*]} " == *" $1 "* ]]; then
        environment="$1"
        shift
    fi
    
    if [[ $# -gt 0 ]]; then
        command="$1"
        shift
        options=("$@")
    else
        command="help"
    fi
    
    # Execute command
    case "${command}" in
        "setup")
            check_prerequisites
            setup_environment "${environment}"
            ;;
        "validate")
            check_prerequisites
            validate_compose_config "${environment}"
            ;;
        "build")
            check_prerequisites
            local no_cache="false"
            if [[ "${options[0]:-}" == "--no-cache" ]]; then
                no_cache="true"
            fi
            build_images "${environment}" "${no_cache}"
            ;;
        "start")
            check_prerequisites
            setup_environment "${environment}"
            start_services "${environment}" "${options[0]:-}" "true"
            ;;
        "stop")
            check_prerequisites
            local remove_volumes="false"
            if [[ "${options[0]:-}" == "--volumes" ]]; then
                remove_volumes="true"
            fi
            stop_services "${environment}" "${remove_volumes}"
            ;;
        "restart")
            check_prerequisites
            stop_services "${environment}"
            start_services "${environment}" "${options[0]:-}" "true"
            ;;
        "status")
            check_prerequisites
            show_status "${environment}"
            ;;
        "logs")
            check_prerequisites
            local service="${options[0]:-}"
            local follow="false"
            if [[ "${options[1]:-}" == "-f" ]] || [[ "${options[0]:-}" == "-f" ]]; then
                follow="true"
                service="${options[1]:-}"
            fi
            view_logs "${environment}" "${service}" "${follow}"
            ;;
        "exec")
            check_prerequisites
            if [[ ${#options[@]} -lt 2 ]]; then
                log_error "Service and command are required for exec"
                exit 1
            fi
            execute_command "${environment}" "${options[@]}"
            ;;
        "backup")
            check_prerequisites
            backup_data "${environment}" "${options[0]:-full}"
            ;;
        "restore")
            check_prerequisites
            restore_data "${environment}" "${options[0]:-}"
            ;;
        "clean")
            check_prerequisites
            log_warning "Cleaning up Docker resources..."
            stop_services "${environment}" "true"
            if [[ "${options[0]:-}" == "--all" ]]; then
                docker system prune -a -f
            else
                docker system prune -f
            fi
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Execute main function
main "$@"