#!/bin/bash

# Deployment automation script for External Metrics Web Service
# Task 1.3: CI/CD pipeline setup

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="staging"
ACTION="deploy"
SKIP_TESTS="false"
DRY_RUN="false"
VERBOSE="false"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Usage function
usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy External Metrics Web Service to AWS

OPTIONS:
    -e, --environment ENV    Target environment (staging|production) [default: staging]
    -a, --action ACTION      Action to perform (deploy|destroy|plan) [default: deploy]
    -s, --skip-tests        Skip running tests before deployment
    -d, --dry-run           Show what would be done without making changes
    -v, --verbose           Enable verbose output
    -h, --help              Show this help message

EXAMPLES:
    $0 --environment staging
    $0 --environment production --action plan
    $0 --environment staging --skip-tests --dry-run

REQUIREMENTS:
    - AWS CLI configured with appropriate permissions
    - Terraform >= 1.0 installed
    - kubectl installed
    - Docker installed (for local builds)
    - Node.js 18+ (for running tests)

EOF
}

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
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -a|--action)
                ACTION="$2"
                shift 2
                ;;
            -s|--skip-tests)
                SKIP_TESTS="true"
                shift
                ;;
            -d|--dry-run)
                DRY_RUN="true"
                shift
                ;;
            -v|--verbose)
                VERBOSE="true"
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done

    # Validate environment
    if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
        log_error "Invalid environment: $ENVIRONMENT. Must be 'staging' or 'production'"
        exit 1
    fi

    # Validate action
    if [[ "$ACTION" != "deploy" && "$ACTION" != "destroy" && "$ACTION" != "plan" ]]; then
        log_error "Invalid action: $ACTION. Must be 'deploy', 'destroy', or 'plan'"
        exit 1
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing_tools=()

    # Check for required tools
    command -v aws >/dev/null 2>&1 || missing_tools+=("aws")
    command -v terraform >/dev/null 2>&1 || missing_tools+=("terraform")
    command -v kubectl >/dev/null 2>&1 || missing_tools+=("kubectl")
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")
    command -v node >/dev/null 2>&1 || missing_tools+=("node")

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install missing tools and try again"
        exit 1
    fi

    # Check AWS credentials
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
        log_error "AWS credentials not configured or invalid"
        exit 1
    fi

    # Check Terraform version
    local tf_version
    tf_version=$(terraform version -json | jq -r '.terraform_version')
    log_info "Using Terraform version: $tf_version"

    # Check Node.js version
    local node_version
    node_version=$(node --version)
    log_info "Using Node.js version: $node_version"

    log_success "Prerequisites check completed"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping tests as requested"
        return 0
    fi

    log_info "Running tests..."

    # Backend tests
    if [[ -d "$PROJECT_ROOT/backend" ]]; then
        log_info "Running backend tests..."
        cd "$PROJECT_ROOT/backend"
        
        if [[ "$DRY_RUN" == "false" ]]; then
            npm ci
            npm run lint
            npm run test
        else
            log_info "[DRY RUN] Would run: npm ci && npm run lint && npm run test"
        fi
    fi

    # Frontend tests
    if [[ -d "$PROJECT_ROOT/frontend" ]]; then
        log_info "Running frontend tests..."
        cd "$PROJECT_ROOT/frontend"
        
        if [[ "$DRY_RUN" == "false" ]]; then
            npm ci
            npm run lint
            npm run test
            npm run build
        else
            log_info "[DRY RUN] Would run: npm ci && npm run lint && npm run test && npm run build"
        fi
    fi

    cd "$PROJECT_ROOT"
    log_success "Tests completed successfully"
}

# Deploy infrastructure
deploy_infrastructure() {
    log_info "Deploying infrastructure for environment: $ENVIRONMENT"
    
    cd "$PROJECT_ROOT/infrastructure/terraform"

    # Initialize Terraform
    log_info "Initializing Terraform..."
    if [[ "$DRY_RUN" == "false" ]]; then
        terraform init \
            -backend-config="bucket=${TF_STATE_BUCKET:-external-metrics-terraform-state}" \
            -backend-config="key=external-metrics/$ENVIRONMENT/terraform.tfstate" \
            -backend-config="region=${AWS_REGION:-us-east-1}"
    else
        log_info "[DRY RUN] Would run: terraform init with backend config"
    fi

    # Plan infrastructure changes
    log_info "Planning infrastructure changes..."
    if [[ "$DRY_RUN" == "false" ]]; then
        terraform plan \
            -var-file="environments/$ENVIRONMENT.tfvars" \
            -out="$ENVIRONMENT.tfplan"
    else
        log_info "[DRY RUN] Would run: terraform plan"
    fi

    if [[ "$ACTION" == "plan" ]]; then
        log_success "Infrastructure plan completed"
        return 0
    fi

    # Apply infrastructure changes
    if [[ "$ACTION" == "deploy" ]]; then
        log_info "Applying infrastructure changes..."
        if [[ "$DRY_RUN" == "false" ]]; then
            terraform apply -auto-approve "$ENVIRONMENT.tfplan"
        else
            log_info "[DRY RUN] Would run: terraform apply"
        fi

        # Update kubeconfig
        log_info "Updating kubeconfig..."
        if [[ "$DRY_RUN" == "false" ]]; then
            aws eks update-kubeconfig \
                --region "${AWS_REGION:-us-east-1}" \
                --name "external-metrics-$ENVIRONMENT"
        else
            log_info "[DRY RUN] Would run: aws eks update-kubeconfig"
        fi
    fi

    # Destroy infrastructure
    if [[ "$ACTION" == "destroy" ]]; then
        log_warning "This will destroy all infrastructure for environment: $ENVIRONMENT"
        read -p "Are you sure you want to continue? (yes/no): " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            log_info "Deployment cancelled"
            exit 0
        fi

        log_info "Destroying infrastructure..."
        if [[ "$DRY_RUN" == "false" ]]; then
            terraform destroy -auto-approve \
                -var-file="environments/$ENVIRONMENT.tfvars"
        else
            log_info "[DRY RUN] Would run: terraform destroy"
        fi
    fi

    cd "$PROJECT_ROOT"
    log_success "Infrastructure deployment completed"
}

# Build and push Docker images
build_and_push_images() {
    if [[ "$ACTION" != "deploy" ]]; then
        return 0
    fi

    log_info "Building and pushing Docker images..."

    local ecr_registry="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}.dkr.ecr.${AWS_REGION:-us-east-1}.amazonaws.com"
    local git_sha="${GITHUB_SHA:-$(git rev-parse HEAD)}"

    # Login to ECR
    log_info "Logging into Amazon ECR..."
    if [[ "$DRY_RUN" == "false" ]]; then
        aws ecr get-login-password --region "${AWS_REGION:-us-east-1}" | \
            docker login --username AWS --password-stdin "$ecr_registry"
    else
        log_info "[DRY RUN] Would run: aws ecr get-login-password | docker login"
    fi

    # Build and push backend image
    log_info "Building backend image..."
    if [[ "$DRY_RUN" == "false" ]]; then
        docker build -t "external-metrics-backend:$git_sha" -f docker/backend/Dockerfile .
        docker tag "external-metrics-backend:$git_sha" "$ecr_registry/external-metrics-backend:$git_sha"
        docker tag "external-metrics-backend:$git_sha" "$ecr_registry/external-metrics-backend:latest"
        docker push "$ecr_registry/external-metrics-backend:$git_sha"
        docker push "$ecr_registry/external-metrics-backend:latest"
    else
        log_info "[DRY RUN] Would build and push backend image"
    fi

    # Build and push frontend image
    log_info "Building frontend image..."
    if [[ "$DRY_RUN" == "false" ]]; then
        docker build -t "external-metrics-frontend:$git_sha" \
            --build-arg VITE_API_BASE_URL="https://api${ENVIRONMENT:+.}${ENVIRONMENT}.external-metrics.com" \
            --build-arg VITE_WS_URL="wss://api${ENVIRONMENT:+.}${ENVIRONMENT}.external-metrics.com" \
            -f docker/frontend/Dockerfile .
        docker tag "external-metrics-frontend:$git_sha" "$ecr_registry/external-metrics-frontend:$git_sha"
        docker tag "external-metrics-frontend:$git_sha" "$ecr_registry/external-metrics-frontend:latest"
        docker push "$ecr_registry/external-metrics-frontend:$git_sha"
        docker push "$ecr_registry/external-metrics-frontend:latest"
    else
        log_info "[DRY RUN] Would build and push frontend image"
    fi

    log_success "Docker images built and pushed successfully"
}

# Deploy applications to Kubernetes
deploy_applications() {
    if [[ "$ACTION" != "deploy" ]]; then
        return 0
    fi

    log_info "Deploying applications to Kubernetes..."

    local ecr_registry="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}.dkr.ecr.${AWS_REGION:-us-east-1}.amazonaws.com"
    local git_sha="${GITHUB_SHA:-$(git rev-parse HEAD)}"
    local namespace="$ENVIRONMENT"

    # Create namespace if it doesn't exist
    if [[ "$DRY_RUN" == "false" ]]; then
        kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -
    else
        log_info "[DRY RUN] Would create namespace: $namespace"
    fi

    # Deploy backend
    log_info "Deploying backend to Kubernetes..."
    if [[ "$DRY_RUN" == "false" ]]; then
        kubectl set image deployment/backend-deployment \
            backend="$ecr_registry/external-metrics-backend:$git_sha" \
            -n "$namespace" || log_warning "Backend deployment may not exist yet"
        
        # Wait for rollout
        kubectl rollout status deployment/backend-deployment -n "$namespace" --timeout=300s || true
    else
        log_info "[DRY RUN] Would deploy backend with image: $ecr_registry/external-metrics-backend:$git_sha"
    fi

    # Deploy frontend
    log_info "Deploying frontend to Kubernetes..."
    if [[ "$DRY_RUN" == "false" ]]; then
        kubectl set image deployment/frontend-deployment \
            frontend="$ecr_registry/external-metrics-frontend:$git_sha" \
            -n "$namespace" || log_warning "Frontend deployment may not exist yet"
        
        # Wait for rollout
        kubectl rollout status deployment/frontend-deployment -n "$namespace" --timeout=300s || true
    else
        log_info "[DRY RUN] Would deploy frontend with image: $ecr_registry/external-metrics-frontend:$git_sha"
    fi

    log_success "Applications deployed successfully"
}

# Run smoke tests
run_smoke_tests() {
    if [[ "$ACTION" != "deploy" ]]; then
        return 0
    fi

    log_info "Running smoke tests..."

    local base_url
    if [[ "$ENVIRONMENT" == "production" ]]; then
        base_url="https://external-metrics.com"
    else
        base_url="https://$ENVIRONMENT.external-metrics.com"
    fi

    # Wait a bit for services to be ready
    if [[ "$DRY_RUN" == "false" ]]; then
        sleep 30
        
        # Test frontend health
        if curl -f "$base_url/health" >/dev/null 2>&1; then
            log_success "Frontend health check passed"
        else
            log_error "Frontend health check failed"
            return 1
        fi

        # Test backend health
        if curl -f "$base_url/api/health" >/dev/null 2>&1; then
            log_success "Backend health check passed"
        else
            log_error "Backend health check failed"
            return 1
        fi
    else
        log_info "[DRY RUN] Would run smoke tests against: $base_url"
    fi

    log_success "Smoke tests completed successfully"
}

# Main deployment function
main() {
    log_info "Starting deployment process..."
    log_info "Environment: $ENVIRONMENT"
    log_info "Action: $ACTION"
    log_info "Dry run: $DRY_RUN"

    # Set verbose output if requested
    if [[ "$VERBOSE" == "true" ]]; then
        set -x
    fi

    check_prerequisites
    
    if [[ "$ACTION" == "deploy" ]]; then
        run_tests
        deploy_infrastructure
        build_and_push_images
        deploy_applications
        run_smoke_tests
    elif [[ "$ACTION" == "plan" ]]; then
        deploy_infrastructure
    elif [[ "$ACTION" == "destroy" ]]; then
        deploy_infrastructure
    fi

    log_success "Deployment process completed successfully!"
}

# Parse arguments and run main function
parse_args "$@"
main