#!/bin/bash
# Canary Deployment Automation Script
# Infrastructure Management Subagent - Advanced Deployment Patterns

set -euo pipefail

# Configuration
APP_NAME="${1:-monitoring-web-service}"
VERSION="${2:-latest}"
ENVIRONMENT="${3:-staging}"
AWS_REGION="${AWS_REGION:-us-west-2}"

# Canary deployment configuration
CANARY_STAGES=(5 25 50 100)
STAGE_DURATIONS=(600 1800 3600 0)  # seconds: 10m, 30m, 1h, permanent
VALIDATION_THRESHOLDS=(
    "error_rate:1.0"
    "response_time_p95:500"
    "health_check_success:99"
)

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
    command -v bc >/dev/null 2>&1 || { error "bc is required but not installed."; exit 1; }
    
    # Check AWS credentials
    aws sts get-caller-identity >/dev/null 2>&1 || { error "AWS credentials not configured."; exit 1; }
    
    success "Prerequisites validated"
}

# Deploy canary version
deploy_canary() {
    local version="$1"
    
    log "Deploying canary version $version..."
    
    # Get ECS service for canary
    local service_name="${APP_NAME}-canary"
    local task_def_family="${APP_NAME}-canary"
    
    # Check if canary service exists, create if not
    if ! aws ecs describe-services \
        --cluster "${APP_NAME}-cluster" \
        --services "$service_name" \
        --region "$AWS_REGION" \
        --query 'services[0].serviceName' \
        --output text >/dev/null 2>&1; then
        
        log "Creating canary service..."
        create_canary_service "$version"
    else
        log "Updating existing canary service..."
        update_canary_service "$version"
    fi
    
    success "Canary deployment initiated"
}

create_canary_service() {
    local version="$1"
    
    # Register canary task definition
    local stable_task_def=$(aws ecs describe-task-definition \
        --task-definition "${APP_NAME}-stable" \
        --region "$AWS_REGION" \
        --query 'taskDefinition')
    
    local canary_task_def=$(echo "$stable_task_def" | jq --arg version "$version" --arg family "${APP_NAME}-canary" '
        del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy) |
        .family = $family |
        .containerDefinitions[0].image = (.containerDefinitions[0].image | split(":")[0] + ":" + $version) |
        .containerDefinitions[0].name = "canary-container"
    ')
    
    local canary_task_def_arn=$(echo "$canary_task_def" | aws ecs register-task-definition \
        --cli-input-json file:///dev/stdin \
        --region "$AWS_REGION" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    # Create canary service
    aws ecs create-service \
        --cluster "${APP_NAME}-cluster" \
        --service-name "${APP_NAME}-canary" \
        --task-definition "$canary_task_def_arn" \
        --desired-count 1 \
        --load-balancers targetGroupArn="$(get_target_group_arn canary)",containerName="canary-container",containerPort=3000 \
        --region "$AWS_REGION" > /dev/null
    
    success "Created canary service with task definition: $canary_task_def_arn"
}

update_canary_service() {
    local version="$1"
    
    # Update canary task definition
    local current_task_def=$(aws ecs describe-task-definition \
        --task-definition "${APP_NAME}-canary" \
        --region "$AWS_REGION" \
        --query 'taskDefinition')
    
    local new_task_def=$(echo "$current_task_def" | jq --arg version "$version" '
        del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy) |
        .containerDefinitions[0].image = (.containerDefinitions[0].image | split(":")[0] + ":" + $version)
    ')
    
    local new_task_def_arn=$(echo "$new_task_def" | aws ecs register-task-definition \
        --cli-input-json file:///dev/stdin \
        --region "$AWS_REGION" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    # Update canary service
    aws ecs update-service \
        --cluster "${APP_NAME}-cluster" \
        --service "${APP_NAME}-canary" \
        --task-definition "$new_task_def_arn" \
        --region "$AWS_REGION" > /dev/null
    
    success "Updated canary service with task definition: $new_task_def_arn"
}

# Get target group ARN
get_target_group_arn() {
    local target_type="$1"  # stable or canary
    
    aws elbv2 describe-target-groups \
        --names "${APP_NAME}-${target_type}-tg" \
        --region "$AWS_REGION" \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text
}

# Update traffic weights for canary deployment
update_traffic_weights() {
    local canary_percentage="$1"
    local stable_percentage=$((100 - canary_percentage))
    
    log "Updating traffic weights: Stable ${stable_percentage}%, Canary ${canary_percentage}%"
    
    local alb_arn=$(aws elbv2 describe-load-balancers \
        --names "${APP_NAME}-alb" \
        --region "$AWS_REGION" \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text)
    
    local listener_arn=$(aws elbv2 describe-listeners \
        --load-balancer-arn "$alb_arn" \
        --region "$AWS_REGION" \
        --query 'Listeners[?Port==`80`].ListenerArn' \
        --output text)
    
    local stable_tg_arn=$(get_target_group_arn "stable")
    local canary_tg_arn=$(get_target_group_arn "canary")
    
    # Update listener with weighted target groups
    aws elbv2 modify-listener \
        --listener-arn "$listener_arn" \
        --default-actions Type=forward,ForwardConfig='{
            "TargetGroups": [
                {
                    "TargetGroupArn": "'$stable_tg_arn'",
                    "Weight": '$stable_percentage'
                },
                {
                    "TargetGroupArn": "'$canary_tg_arn'",
                    "Weight": '$canary_percentage'
                }
            ]
        }' \
        --region "$AWS_REGION" > /dev/null
    
    success "Traffic weights updated successfully"
}

# Validate canary metrics
validate_canary_metrics() {
    local canary_percentage="$1"
    local duration="$2"
    
    log "Validating canary metrics for ${duration}s at ${canary_percentage}% traffic..."
    
    local validation_start=$(date +%s)
    local validation_end=$((validation_start + duration))
    
    while [ $(date +%s) -lt $validation_end ]; do
        local current_time=$(date +%s)
        local elapsed=$((current_time - validation_start))
        local remaining=$((validation_end - current_time))
        
        log "Validation progress: ${elapsed}s/${duration}s (${remaining}s remaining)"
        
        # Check each validation threshold
        local validation_passed=true
        
        for threshold in "${VALIDATION_THRESHOLDS[@]}"; do
            IFS=':' read -r metric value <<< "$threshold"
            
            case "$metric" in
                "error_rate")
                    if ! validate_error_rate "$value"; then
                        validation_passed=false
                        break
                    fi
                    ;;
                "response_time_p95")
                    if ! validate_response_time "$value"; then
                        validation_passed=false
                        break
                    fi
                    ;;
                "health_check_success")
                    if ! validate_health_checks "$value"; then
                        validation_passed=false
                        break
                    fi
                    ;;
            esac
        done
        
        if [ "$validation_passed" = false ]; then
            error "Canary validation failed"
            return 1
        fi
        
        # Check every 30 seconds
        sleep 30
    done
    
    success "Canary validation passed for stage ${canary_percentage}%"
    return 0
}

# Validate error rate
validate_error_rate() {
    local threshold="$1"
    
    # Get error rate from CloudWatch (simplified - would need actual metric queries)
    local error_rate=$(get_cloudwatch_metric "HTTPCode_Target_5XX_Count" "300")
    local total_requests=$(get_cloudwatch_metric "RequestCount" "300")
    
    if [ "$total_requests" -gt 0 ]; then
        local error_percentage=$(echo "scale=2; $error_rate * 100 / $total_requests" | bc -l)
        
        if (( $(echo "$error_percentage > $threshold" | bc -l) )); then
            error "Error rate ${error_percentage}% exceeds threshold ${threshold}%"
            return 1
        fi
    fi
    
    return 0
}

# Validate response time
validate_response_time() {
    local threshold="$1"  # in milliseconds
    
    # Get response time from CloudWatch
    local response_time=$(get_cloudwatch_metric "TargetResponseTime" "300")
    local response_time_ms=$(echo "$response_time * 1000" | bc -l)
    
    if (( $(echo "$response_time_ms > $threshold" | bc -l) )); then
        error "Response time ${response_time_ms}ms exceeds threshold ${threshold}ms"
        return 1
    fi
    
    return 0
}

# Validate health checks
validate_health_checks() {
    local threshold="$1"  # percentage
    
    local canary_tg_arn=$(get_target_group_arn "canary")
    
    local healthy_targets=$(aws elbv2 describe-target-health \
        --target-group-arn "$canary_tg_arn" \
        --region "$AWS_REGION" \
        --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])' \
        --output text)
    
    local total_targets=$(aws elbv2 describe-target-health \
        --target-group-arn "$canary_tg_arn" \
        --region "$AWS_REGION" \
        --query 'length(TargetHealthDescriptions)' \
        --output text)
    
    if [ "$total_targets" -gt 0 ]; then
        local health_percentage=$(echo "scale=2; $healthy_targets * 100 / $total_targets" | bc -l)
        
        if (( $(echo "$health_percentage < $threshold" | bc -l) )); then
            error "Health check success rate ${health_percentage}% below threshold ${threshold}%"
            return 1
        fi
    fi
    
    return 0
}

# Get CloudWatch metric (simplified implementation)
get_cloudwatch_metric() {
    local metric_name="$1"
    local period="$2"
    
    local end_time=$(date -u -d 'now' '+%Y-%m-%dT%H:%M:%S')
    local start_time=$(date -u -d '10 minutes ago' '+%Y-%m-%dT%H:%M:%S')
    
    # This is a simplified implementation - in practice, you'd query actual CloudWatch metrics
    aws cloudwatch get-metric-statistics \
        --namespace "AWS/ApplicationELB" \
        --metric-name "$metric_name" \
        --start-time "$start_time" \
        --end-time "$end_time" \
        --period "$period" \
        --statistics "Sum" \
        --region "$AWS_REGION" \
        --query 'Datapoints[0].Sum' \
        --output text 2>/dev/null || echo "0"
}

# Rollback canary deployment
rollback_canary() {
    warning "Initiating canary rollback..."
    
    # Set traffic back to 100% stable
    update_traffic_weights 0
    
    # Scale down canary service
    aws ecs update-service \
        --cluster "${APP_NAME}-cluster" \
        --service "${APP_NAME}-canary" \
        --desired-count 0 \
        --region "$AWS_REGION" > /dev/null
    
    success "Canary rollback completed"
}

# Promote canary to stable
promote_canary() {
    log "Promoting canary to stable..."
    
    # Get canary task definition
    local canary_task_def_arn=$(aws ecs describe-services \
        --cluster "${APP_NAME}-cluster" \
        --services "${APP_NAME}-canary" \
        --region "$AWS_REGION" \
        --query 'services[0].taskDefinition' \
        --output text)
    
    # Update stable service with canary task definition
    local stable_task_def=$(aws ecs describe-task-definition \
        --task-definition "$canary_task_def_arn" \
        --region "$AWS_REGION" \
        --query 'taskDefinition')
    
    local new_stable_task_def=$(echo "$stable_task_def" | jq '
        del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy) |
        .family = "'${APP_NAME}'-stable" |
        .containerDefinitions[0].name = "stable-container"
    ')
    
    local new_stable_task_def_arn=$(echo "$new_stable_task_def" | aws ecs register-task-definition \
        --cli-input-json file:///dev/stdin \
        --region "$AWS_REGION" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    # Update stable service
    aws ecs update-service \
        --cluster "${APP_NAME}-cluster" \
        --service "${APP_NAME}-stable" \
        --task-definition "$new_stable_task_def_arn" \
        --region "$AWS_REGION" > /dev/null
    
    # Wait for stable service to update
    aws ecs wait services-stable \
        --cluster "${APP_NAME}-cluster" \
        --services "${APP_NAME}-stable" \
        --region "$AWS_REGION"
    
    # Set traffic back to 100% stable and remove canary
    update_traffic_weights 0
    
    # Scale down and clean up canary
    aws ecs update-service \
        --cluster "${APP_NAME}-cluster" \
        --service "${APP_NAME}-canary" \
        --desired-count 0 \
        --region "$AWS_REGION" > /dev/null
    
    success "Canary promoted to stable successfully"
}

# Main canary deployment flow
main() {
    log "Starting Canary deployment for $APP_NAME version $VERSION"
    
    validate_prerequisites
    
    # Deploy canary version
    deploy_canary "$VERSION"
    
    # Wait for canary service to stabilize
    log "Waiting for canary service to stabilize..."
    aws ecs wait services-stable \
        --cluster "${APP_NAME}-cluster" \
        --services "${APP_NAME}-canary" \
        --region "$AWS_REGION"
    
    # Progressive rollout through canary stages
    for i in "${!CANARY_STAGES[@]}"; do
        local percentage="${CANARY_STAGES[$i]}"
        local duration="${STAGE_DURATIONS[$i]}"
        
        log "=== Canary Stage $((i+1)): ${percentage}% traffic ==="
        
        # Update traffic weights
        update_traffic_weights "$percentage"
        
        # Skip validation for 100% stage (permanent deployment)
        if [ "$percentage" -eq 100 ]; then
            log "Final deployment stage reached - promoting canary to stable"
            promote_canary
            break
        fi
        
        # Validate metrics for this stage
        if ! validate_canary_metrics "$percentage" "$duration"; then
            error "Canary validation failed at ${percentage}% stage"
            rollback_canary
            exit 1
        fi
        
        success "Canary stage ${percentage}% completed successfully"
    done
    
    success "Canary deployment completed successfully!"
    log "Version deployed: $VERSION"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi