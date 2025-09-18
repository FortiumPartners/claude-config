#!/bin/bash

# PostgreSQL Monitoring Setup Script
# Implements Phase 2: Infrastructure & Integration - PostgreSQL monitoring infrastructure
# Sets up comprehensive PostgreSQL/TimescaleDB monitoring with Prometheus and Grafana

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MONITORING_DIR="${PROJECT_ROOT}/infrastructure/monitoring"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if docker-compose is running
check_docker_compose() {
    if ! command_exists docker-compose && ! command_exists docker; then
        log_error "Docker or docker-compose not found. Please install Docker first."
        exit 1
    fi
    
    if command_exists docker-compose; then
        COMPOSE_CMD="docker-compose"
    else
        COMPOSE_CMD="docker compose"
    fi
}

# Function to check if kubectl is available (for Kubernetes deployment)
check_kubectl() {
    if command_exists kubectl; then
        log_info "kubectl found. Kubernetes deployment available."
        return 0
    else
        log_info "kubectl not found. Only Docker Compose deployment available."
        return 1
    fi
}

# Function to setup PostgreSQL monitoring in Docker Compose
setup_docker_monitoring() {
    log_info "Setting up PostgreSQL monitoring with Docker Compose..."
    
    cd "${PROJECT_ROOT}"
    
    # Check if PostgreSQL is already running
    if ${COMPOSE_CMD} ps postgres | grep -q "Up"; then
        log_info "PostgreSQL container is running. Adding monitoring..."
    else
        log_info "Starting PostgreSQL container first..."
        ${COMPOSE_CMD} up -d postgres
        sleep 10
    fi
    
    # Start PostgreSQL exporter
    log_info "Starting PostgreSQL exporter..."
    ${COMPOSE_CMD} up -d postgres-exporter
    
    # Wait for exporter to be ready
    log_info "Waiting for PostgreSQL exporter to be ready..."
    sleep 15
    
    # Check if exporter is working
    if curl -s http://localhost:9187/metrics > /dev/null; then
        log_success "PostgreSQL exporter is running and accessible at http://localhost:9187/metrics"
    else
        log_error "PostgreSQL exporter failed to start properly"
        return 1
    fi
    
    # Start monitoring stack if requested
    if [[ "${1:-}" == "--with-monitoring" ]]; then
        log_info "Starting Prometheus and Grafana..."
        ${COMPOSE_CMD} --profile monitoring up -d prometheus grafana
        
        sleep 20
        
        log_success "Monitoring stack started:"
        log_info "- Prometheus: http://localhost:9090"
        log_info "- Grafana: http://localhost:3001 (admin/admin)"
        log_info "- PostgreSQL metrics: http://localhost:9187/metrics"
        
        # Test Grafana connectivity
        if curl -s http://localhost:3001 > /dev/null; then
            log_success "Grafana is accessible with PostgreSQL dashboard pre-configured"
        else
            log_warning "Grafana may still be starting up. Please wait a few more seconds."
        fi
    else
        log_success "PostgreSQL exporter started. Use --with-monitoring to start full stack."
        log_info "PostgreSQL metrics available at: http://localhost:9187/metrics"
    fi
}

# Function to setup PostgreSQL monitoring in Kubernetes
setup_kubernetes_monitoring() {
    log_info "Setting up PostgreSQL monitoring in Kubernetes..."
    
    # Apply PostgreSQL monitoring configuration
    log_info "Applying PostgreSQL monitoring manifests..."
    kubectl apply -f "${MONITORING_DIR}/postgresql-monitoring.yaml"
    
    # Wait for deployment to be ready
    log_info "Waiting for PostgreSQL exporter deployment..."
    kubectl wait --for=condition=available --timeout=300s deployment/postgres-exporter -n postgresql-monitoring
    
    # Check if ServiceMonitor is created (if using Prometheus Operator)
    if kubectl get crd servicemonitors.monitoring.coreos.com >/dev/null 2>&1; then
        log_success "ServiceMonitor created for Prometheus Operator"
    else
        log_info "Prometheus Operator not detected. Manual Prometheus configuration required."
    fi
    
    # Show status
    kubectl get pods -n postgresql-monitoring
    
    log_success "PostgreSQL monitoring deployed to Kubernetes:"
    log_info "- Namespace: postgresql-monitoring"
    log_info "- Service: postgres-exporter"
    log_info "- Port: 9187"
    
    # Get service endpoint
    EXTERNAL_IP=$(kubectl get svc postgres-exporter -n postgresql-monitoring -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")
    if [[ -n "$EXTERNAL_IP" ]]; then
        log_info "- External access: http://${EXTERNAL_IP}:9187/metrics"
    else
        log_info "- Use port-forward for local access: kubectl port-forward -n postgresql-monitoring svc/postgres-exporter 9187:9187"
    fi
}

# Function to verify PostgreSQL monitoring setup
verify_monitoring() {
    log_info "Verifying PostgreSQL monitoring setup..."
    
    local success=0
    
    # Check if metrics endpoint is accessible
    if curl -s http://localhost:9187/metrics | grep -q "pg_up"; then
        log_success "✓ PostgreSQL exporter metrics endpoint is working"
        success=$((success + 1))
    else
        log_error "✗ PostgreSQL exporter metrics endpoint is not accessible"
    fi
    
    # Check for key PostgreSQL metrics
    local key_metrics=(
        "pg_up"
        "pg_stat_activity_count"
        "pg_database_size_bytes"
        "pg_stat_database_blks_hit"
        "pg_stat_database_blks_read"
    )
    
    for metric in "${key_metrics[@]}"; do
        if curl -s http://localhost:9187/metrics | grep -q "^${metric}"; then
            log_success "✓ Found metric: ${metric}"
            success=$((success + 1))
        else
            log_warning "✗ Missing metric: ${metric}"
        fi
    done
    
    # Check TimescaleDB metrics if available
    if curl -s http://localhost:9187/metrics | grep -q "timescaledb"; then
        log_success "✓ TimescaleDB metrics are available"
        success=$((success + 1))
    else
        log_info "ℹ TimescaleDB metrics not found (may not be configured)"
    fi
    
    log_info "Monitoring verification complete. ${success} checks passed."
    
    if [[ $success -ge 3 ]]; then
        log_success "PostgreSQL monitoring is working correctly!"
        return 0
    else
        log_error "PostgreSQL monitoring has issues. Please check the logs."
        return 1
    fi
}

# Function to show monitoring status
show_status() {
    log_info "PostgreSQL Monitoring Status:"
    echo
    
    # Docker Compose status
    if command_exists docker-compose || command_exists docker; then
        log_info "Docker Compose Services:"
        cd "${PROJECT_ROOT}"
        ${COMPOSE_CMD} ps postgres postgres-exporter prometheus grafana 2>/dev/null || log_info "No Docker services running"
        echo
    fi
    
    # Kubernetes status
    if command_exists kubectl; then
        log_info "Kubernetes Services:"
        kubectl get pods -n postgresql-monitoring 2>/dev/null || log_info "No Kubernetes services in postgresql-monitoring namespace"
        echo
    fi
    
    # Metrics endpoint status
    log_info "Metrics Endpoints:"
    if curl -s http://localhost:9187/metrics >/dev/null 2>&1; then
        log_success "PostgreSQL Exporter: http://localhost:9187/metrics ✓"
    else
        log_warning "PostgreSQL Exporter: http://localhost:9187/metrics ✗"
    fi
    
    if curl -s http://localhost:9090 >/dev/null 2>&1; then
        log_success "Prometheus: http://localhost:9090 ✓"
    else
        log_info "Prometheus: http://localhost:9090 (not running)"
    fi
    
    if curl -s http://localhost:3001 >/dev/null 2>&1; then
        log_success "Grafana: http://localhost:3001 ✓"
    else
        log_info "Grafana: http://localhost:3001 (not running)"
    fi
}

# Function to cleanup monitoring setup
cleanup_monitoring() {
    log_warning "Cleaning up PostgreSQL monitoring setup..."
    
    # Docker Compose cleanup
    if command_exists docker-compose || command_exists docker; then
        cd "${PROJECT_ROOT}"
        log_info "Stopping Docker containers..."
        ${COMPOSE_CMD} down postgres-exporter prometheus grafana 2>/dev/null || true
        
        # Remove volumes if requested
        if [[ "${1:-}" == "--volumes" ]]; then
            log_info "Removing volumes..."
            ${COMPOSE_CMD} down -v postgres-exporter prometheus grafana 2>/dev/null || true
        fi
    fi
    
    # Kubernetes cleanup
    if command_exists kubectl; then
        log_info "Removing Kubernetes resources..."
        kubectl delete -f "${MONITORING_DIR}/postgresql-monitoring.yaml" 2>/dev/null || true
    fi
    
    log_success "Cleanup completed"
}

# Function to show help
show_help() {
    echo "PostgreSQL Monitoring Setup Script"
    echo
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo
    echo "Commands:"
    echo "  setup-docker          Setup monitoring with Docker Compose"
    echo "  setup-docker --with-monitoring  Setup with Prometheus + Grafana"
    echo "  setup-kubernetes      Setup monitoring in Kubernetes"
    echo "  verify                Verify monitoring setup"
    echo "  status                Show monitoring status"
    echo "  cleanup [--volumes]   Cleanup monitoring setup"
    echo "  help                  Show this help message"
    echo
    echo "Examples:"
    echo "  $0 setup-docker                    # Setup PostgreSQL exporter only"
    echo "  $0 setup-docker --with-monitoring  # Setup full monitoring stack"
    echo "  $0 setup-kubernetes                # Deploy to Kubernetes"
    echo "  $0 verify                          # Verify setup"
    echo "  $0 status                          # Show status"
    echo "  $0 cleanup --volumes               # Full cleanup with volumes"
    echo
}

# Main script logic
main() {
    case "${1:-help}" in
        "setup-docker")
            check_docker_compose
            setup_docker_monitoring "${2:-}"
            ;;
        "setup-kubernetes")
            if ! check_kubectl; then
                log_error "kubectl is required for Kubernetes deployment"
                exit 1
            fi
            setup_kubernetes_monitoring
            ;;
        "verify")
            verify_monitoring
            ;;
        "status")
            show_status
            ;;
        "cleanup")
            cleanup_monitoring "${2:-}"
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Execute main function
main "$@"