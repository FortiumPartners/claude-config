#!/bin/bash

# Kubernetes Infrastructure Setup Script
# Phase 2: Infrastructure & Integration - RBAC and Networking Setup
# Sets up comprehensive Kubernetes infrastructure with security best practices

set -euo pipefail

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
K8S_DIR="${PROJECT_ROOT}/k8s"
NAMESPACE="monitoring-web-service"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    if ! command_exists kubectl; then
        log_error "kubectl not found. Please install kubectl first."
        exit 1
    fi
    
    if ! command_exists helm; then
        log_warning "helm not found. Some features may not be available."
    fi
    
    # Check kubectl connectivity
    if ! kubectl version --short >/dev/null 2>&1; then
        log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to check cluster capabilities
check_cluster_capabilities() {
    log_step "Checking cluster capabilities..."
    
    # Check if cluster supports NetworkPolicies
    if kubectl get networkpolicy >/dev/null 2>&1; then
        log_info "✓ NetworkPolicy support detected"
        SUPPORTS_NETWORK_POLICY=true
    else
        log_warning "✗ NetworkPolicy not supported in this cluster"
        SUPPORTS_NETWORK_POLICY=false
    fi
    
    # Check if cluster supports PodSecurityPolicies
    if kubectl get psp >/dev/null 2>&1; then
        log_info "✓ PodSecurityPolicy support detected"
        SUPPORTS_PSP=true
    else
        log_warning "✗ PodSecurityPolicy not supported (may be using Pod Security Standards)"
        SUPPORTS_PSP=false
    fi
    
    # Check if Prometheus Operator is installed
    if kubectl get crd servicemonitors.monitoring.coreos.com >/dev/null 2>&1; then
        log_info "✓ Prometheus Operator detected"
        HAS_PROMETHEUS_OPERATOR=true
    else
        log_info "✗ Prometheus Operator not detected"
        HAS_PROMETHEUS_OPERATOR=false
    fi
    
    # Check if Istio is installed
    if kubectl get namespace istio-system >/dev/null 2>&1; then
        log_info "✓ Istio service mesh detected"
        HAS_ISTIO=true
    else
        log_info "✗ Istio service mesh not detected"
        HAS_ISTIO=false
    fi
    
    # Check Kubernetes version
    K8S_VERSION=$(kubectl version --short --client -o json | jq -r .clientVersion.gitVersion)
    log_info "Kubernetes client version: ${K8S_VERSION}"
}

# Function to create namespace
setup_namespace() {
    log_step "Setting up namespace..."
    
    if kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
        log_info "Namespace ${NAMESPACE} already exists"
    else
        log_info "Creating namespace ${NAMESPACE}..."
        kubectl apply -f - <<EOF
apiVersion: v1
kind: Namespace
metadata:
  name: ${NAMESPACE}
  labels:
    name: ${NAMESPACE}
    app: monitoring-web-service
    managed-by: infrastructure-setup-script
    security.policy: strict
    network.policy: enabled
  annotations:
    description: "External Metrics Web Service - Production monitoring platform"
EOF
        log_success "Namespace ${NAMESPACE} created"
    fi
}

# Function to apply infrastructure configurations
apply_infrastructure() {
    log_step "Applying Kubernetes infrastructure configurations..."
    
    # Apply main infrastructure configuration
    if [[ -f "${K8S_DIR}/infrastructure.yaml" ]]; then
        log_info "Applying infrastructure.yaml..."
        kubectl apply -f "${K8S_DIR}/infrastructure.yaml"
        log_success "Infrastructure configuration applied"
    else
        log_error "Infrastructure configuration file not found: ${K8S_DIR}/infrastructure.yaml"
        return 1
    fi
    
    # Wait for resources to be created
    log_info "Waiting for resources to be created..."
    sleep 5
    
    # Verify ServiceAccounts
    if kubectl get serviceaccount monitoring-web-service -n "${NAMESPACE}" >/dev/null 2>&1; then
        log_success "✓ ServiceAccount 'monitoring-web-service' created"
    else
        log_error "✗ ServiceAccount 'monitoring-web-service' not found"
    fi
    
    if kubectl get serviceaccount postgres-exporter -n "${NAMESPACE}" >/dev/null 2>&1; then
        log_success "✓ ServiceAccount 'postgres-exporter' created"
    else
        log_error "✗ ServiceAccount 'postgres-exporter' not found"
    fi
}

# Function to apply network policies
apply_network_policies() {
    log_step "Configuring network policies..."
    
    if [[ "${SUPPORTS_NETWORK_POLICY}" == "true" ]]; then
        log_info "Applying network policies..."
        
        # Check if network policies were applied
        sleep 10
        NETWORK_POLICIES=$(kubectl get networkpolicy -n "${NAMESPACE}" --no-headers 2>/dev/null | wc -l)
        
        if [[ "${NETWORK_POLICIES}" -gt 0 ]]; then
            log_success "✓ ${NETWORK_POLICIES} network policies applied"
            kubectl get networkpolicy -n "${NAMESPACE}"
        else
            log_warning "✗ No network policies found"
        fi
    else
        log_warning "Skipping network policies (not supported by cluster)"
    fi
}

# Function to configure RBAC
configure_rbac() {
    log_step "Configuring RBAC..."
    
    # Check ClusterRole
    if kubectl get clusterrole monitoring-web-service >/dev/null 2>&1; then
        log_success "✓ ClusterRole 'monitoring-web-service' created"
    else
        log_error "✗ ClusterRole 'monitoring-web-service' not found"
    fi
    
    # Check ClusterRoleBinding
    if kubectl get clusterrolebinding monitoring-web-service >/dev/null 2>&1; then
        log_success "✓ ClusterRoleBinding 'monitoring-web-service' created"
    else
        log_error "✗ ClusterRoleBinding 'monitoring-web-service' not found"
    fi
    
    # Check namespace-scoped Role
    if kubectl get role database-admin -n "${NAMESPACE}" >/dev/null 2>&1; then
        log_success "✓ Role 'database-admin' created"
    else
        log_error "✗ Role 'database-admin' not found"
    fi
    
    # Check RoleBinding
    if kubectl get rolebinding database-admin -n "${NAMESPACE}" >/dev/null 2>&1; then
        log_success "✓ RoleBinding 'database-admin' created"
    else
        log_error "✗ RoleBinding 'database-admin' not found"
    fi
}

# Function to setup resource management
setup_resource_management() {
    log_step "Setting up resource management..."
    
    # Check ResourceQuota
    if kubectl get resourcequota monitoring-web-service-quota -n "${NAMESPACE}" >/dev/null 2>&1; then
        log_success "✓ ResourceQuota applied"
        kubectl describe resourcequota monitoring-web-service-quota -n "${NAMESPACE}"
    else
        log_warning "✗ ResourceQuota not found"
    fi
    
    # Check LimitRange
    if kubectl get limitrange monitoring-web-service-limits -n "${NAMESPACE}" >/dev/null 2>&1; then
        log_success "✓ LimitRange applied"
        kubectl describe limitrange monitoring-web-service-limits -n "${NAMESPACE}"
    else
        log_warning "✗ LimitRange not found"
    fi
}

# Function to validate infrastructure setup
validate_infrastructure() {
    log_step "Validating infrastructure setup..."
    
    local success=0
    local total=0
    
    # Test ServiceAccount token mounting
    total=$((total + 1))
    if kubectl auth can-i --list --as=system:serviceaccount:${NAMESPACE}:monitoring-web-service >/dev/null 2>&1; then
        log_success "✓ ServiceAccount permissions working"
        success=$((success + 1))
    else
        log_warning "✗ ServiceAccount permissions may have issues"
    fi
    
    # Test network connectivity (if NetworkPolicies are supported)
    if [[ "${SUPPORTS_NETWORK_POLICY}" == "true" ]]; then
        total=$((total + 1))
        if kubectl get networkpolicy -n "${NAMESPACE}" | grep -q "app-tier-policy"; then
            log_success "✓ Network policies are active"
            success=$((success + 1))
        else
            log_warning "✗ Network policies may not be working"
        fi
    fi
    
    # Test resource quotas
    total=$((total + 1))
    if kubectl describe resourcequota -n "${NAMESPACE}" 2>/dev/null | grep -q "Used:"; then
        log_success "✓ Resource quotas are active"
        success=$((success + 1))
    else
        log_warning "✗ Resource quotas may not be working"
    fi
    
    log_info "Infrastructure validation: ${success}/${total} checks passed"
    
    if [[ ${success} -eq ${total} ]]; then
        log_success "All infrastructure components validated successfully!"
        return 0
    else
        log_warning "Some infrastructure components need attention."
        return 1
    fi
}

# Function to deploy sample workload for testing
deploy_test_workload() {
    log_step "Deploying test workload..."
    
    kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: infrastructure-test
  namespace: ${NAMESPACE}
  labels:
    app: infrastructure-test
    component: test
spec:
  replicas: 1
  selector:
    matchLabels:
      app: infrastructure-test
  template:
    metadata:
      labels:
        app: infrastructure-test
        component: test
    spec:
      serviceAccountName: monitoring-web-service
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: test-container
        image: nginx:alpine
        ports:
        - containerPort: 80
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          runAsNonRoot: true
          runAsUser: 1001
          capabilities:
            drop:
            - ALL
        resources:
          requests:
            memory: "64Mi"
            cpu: "50m"
          limits:
            memory: "128Mi"
            cpu: "100m"
        volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: cache
          mountPath: /var/cache/nginx
        - name: run
          mountPath: /var/run
      volumes:
      - name: tmp
        emptyDir: {}
      - name: cache
        emptyDir: {}
      - name: run
        emptyDir: {}
EOF
    
    # Wait for deployment to be ready
    log_info "Waiting for test deployment to be ready..."
    kubectl wait --for=condition=available --timeout=120s deployment/infrastructure-test -n "${NAMESPACE}"
    
    if kubectl get deployment infrastructure-test -n "${NAMESPACE}" >/dev/null 2>&1; then
        log_success "✓ Test workload deployed successfully"
        
        # Check if pod is running with correct security context
        POD_NAME=$(kubectl get pods -n "${NAMESPACE}" -l app=infrastructure-test -o jsonpath='{.items[0].metadata.name}')
        if [[ -n "${POD_NAME}" ]]; then
            log_info "Test pod: ${POD_NAME}"
            kubectl get pod "${POD_NAME}" -n "${NAMESPACE}" -o wide
            
            # Test security context
            if kubectl exec "${POD_NAME}" -n "${NAMESPACE}" -- id | grep -q "uid=1001"; then
                log_success "✓ Security context is working correctly"
            else
                log_warning "✗ Security context may not be applied correctly"
            fi
        fi
    else
        log_error "✗ Test workload deployment failed"
        return 1
    fi
}

# Function to cleanup test resources
cleanup_test() {
    log_step "Cleaning up test resources..."
    
    kubectl delete deployment infrastructure-test -n "${NAMESPACE}" --ignore-not-found=true
    log_success "Test resources cleaned up"
}

# Function to show infrastructure status
show_status() {
    log_step "Infrastructure Status Report"
    echo
    
    log_info "Namespace Resources:"
    kubectl get all -n "${NAMESPACE}" 2>/dev/null || log_info "No resources in namespace yet"
    echo
    
    log_info "RBAC Configuration:"
    echo "ClusterRoles:"
    kubectl get clusterrole | grep monitoring-web-service || log_info "No ClusterRoles found"
    echo "ClusterRoleBindings:"
    kubectl get clusterrolebinding | grep monitoring-web-service || log_info "No ClusterRoleBindings found"
    echo "ServiceAccounts:"
    kubectl get serviceaccount -n "${NAMESPACE}" || log_info "No ServiceAccounts found"
    echo
    
    if [[ "${SUPPORTS_NETWORK_POLICY}" == "true" ]]; then
        log_info "Network Policies:"
        kubectl get networkpolicy -n "${NAMESPACE}" || log_info "No NetworkPolicies found"
        echo
    fi
    
    log_info "Resource Management:"
    echo "ResourceQuota:"
    kubectl describe resourcequota -n "${NAMESPACE}" 2>/dev/null || log_info "No ResourceQuota found"
    echo "LimitRange:"
    kubectl describe limitrange -n "${NAMESPACE}" 2>/dev/null || log_info "No LimitRange found"
    echo
    
    log_info "Cluster Capabilities:"
    echo "- NetworkPolicy support: ${SUPPORTS_NETWORK_POLICY}"
    echo "- PodSecurityPolicy support: ${SUPPORTS_PSP}"
    echo "- Prometheus Operator: ${HAS_PROMETHEUS_OPERATOR}"
    echo "- Istio service mesh: ${HAS_ISTIO}"
    echo
}

# Function to cleanup all resources
cleanup_all() {
    log_warning "Cleaning up all infrastructure resources..."
    
    read -p "Are you sure you want to delete all infrastructure resources? (yes/no): " confirm
    if [[ "${confirm}" != "yes" ]]; then
        log_info "Cleanup cancelled"
        return 0
    fi
    
    # Delete namespace (this will delete all namespace-scoped resources)
    log_info "Deleting namespace ${NAMESPACE}..."
    kubectl delete namespace "${NAMESPACE}" --ignore-not-found=true
    
    # Delete cluster-scoped resources
    log_info "Deleting cluster-scoped resources..."
    kubectl delete clusterrole monitoring-web-service postgres-exporter monitoring-web-service-psp --ignore-not-found=true
    kubectl delete clusterrolebinding monitoring-web-service postgres-exporter --ignore-not-found=true
    
    if [[ "${SUPPORTS_PSP}" == "true" ]]; then
        kubectl delete psp monitoring-web-service-psp --ignore-not-found=true
    fi
    
    log_success "Cleanup completed"
}

# Function to show help
show_help() {
    echo "Kubernetes Infrastructure Setup Script"
    echo
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo
    echo "Commands:"
    echo "  setup                 Complete infrastructure setup"
    echo "  setup-basic           Basic setup without test workload"
    echo "  test                  Deploy and test infrastructure"
    echo "  validate              Validate existing infrastructure"
    echo "  status                Show infrastructure status"
    echo "  cleanup-test          Remove test workload"
    echo "  cleanup-all           Remove all infrastructure"
    echo "  help                  Show this help message"
    echo
    echo "Examples:"
    echo "  $0 setup              # Complete setup with validation"
    echo "  $0 test               # Test infrastructure with sample workload"
    echo "  $0 status             # Show current status"
    echo "  $0 cleanup-all        # Remove everything"
    echo
}

# Main script logic
main() {
    # Set default values for capability checks
    SUPPORTS_NETWORK_POLICY=false
    SUPPORTS_PSP=false
    HAS_PROMETHEUS_OPERATOR=false
    HAS_ISTIO=false
    
    case "${1:-setup}" in
        "setup")
            check_prerequisites
            check_cluster_capabilities
            setup_namespace
            apply_infrastructure
            apply_network_policies
            configure_rbac
            setup_resource_management
            validate_infrastructure
            deploy_test_workload
            show_status
            cleanup_test
            ;;
        "setup-basic")
            check_prerequisites
            check_cluster_capabilities
            setup_namespace
            apply_infrastructure
            apply_network_policies
            configure_rbac
            setup_resource_management
            validate_infrastructure
            ;;
        "test")
            check_prerequisites
            check_cluster_capabilities
            deploy_test_workload
            validate_infrastructure
            cleanup_test
            ;;
        "validate")
            check_prerequisites
            check_cluster_capabilities
            validate_infrastructure
            ;;
        "status")
            check_prerequisites
            check_cluster_capabilities
            show_status
            ;;
        "cleanup-test")
            check_prerequisites
            cleanup_test
            ;;
        "cleanup-all")
            check_prerequisites
            cleanup_all
            ;;
        "help"|*)
            show_help
            ;;
    esac
}

# Execute main function
main "$@"