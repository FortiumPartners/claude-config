#!/bin/bash
# Blue-Green Deployment Automation Script
# Infrastructure Management Subagent - Advanced Deployment Patterns

set -euo pipefail

# Configuration
APP_NAME="${1:-monitoring-web-service}"
VERSION="${2:-latest}"
ENVIRONMENT="${3:-staging}"
AWS_REGION="${AWS_REGION:-us-west-2}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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
    
    # Check AWS credentials
    aws sts get-caller-identity >/dev/null 2>&1 || { error "AWS credentials not configured."; exit 1; }
    
    success "Prerequisites validated"
}

# Get current active target group
get_active_target_group() {
    local alb_arn=$(aws elbv2 describe-load-balancers \
        --names "${APP_NAME}-alb" \
        --region "$AWS_REGION" \
        --query 'LoadBalancers[0].LoadBalancerArn' \
        --output text)
    
    if [ "$alb_arn" == "None" ]; then
        error "Load balancer ${APP_NAME}-alb not found"
        exit 1
    fi
    
    local listener_arn=$(aws elbv2 describe-listeners \
        --load-balancer-arn "$alb_arn" \
        --region "$AWS_REGION" \
        --query 'Listeners[?Port==`80`].ListenerArn' \
        --output text)
    
    local active_tg=$(aws elbv2 describe-listeners \
        --listener-arns "$listener_arn" \
        --region "$AWS_REGION" \
        --query 'Listeners[0].DefaultActions[0].TargetGroupArn' \
        --output text)
    
    if [[ "$active_tg" == *"blue"* ]]; then
        echo "blue"
    elif [[ "$active_tg" == *"green"* ]]; then
        echo "green"
    else
        error "Unable to determine active target group"
        exit 1
    fi
}

# Deploy to inactive environment
deploy_to_inactive() {
    local active_color="$1"
    local inactive_color
    
    if [ "$active_color" == "blue" ]; then
        inactive_color="green"
    else
        inactive_color="blue"
    fi
    
    log "Deploying version $VERSION to $inactive_color environment..."
    
    # Get ECS service and task definition for inactive environment
    local service_name="${APP_NAME}-${inactive_color}"
    local task_def_family="${APP_NAME}-${inactive_color}"
    
    # Update task definition with new image
    local current_task_def=$(aws ecs describe-task-definition \
        --task-definition "$task_def_family" \
        --region "$AWS_REGION" \
        --query 'taskDefinition')
    
    # Extract current task definition and update image
    local new_task_def=$(echo "$current_task_def" | jq --arg version "$VERSION" '
        del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .placementConstraints, .compatibilities, .registeredAt, .registeredBy) |
        .containerDefinitions[0].image = (.containerDefinitions[0].image | split(":")[0] + ":" + $version)
    ')
    
    # Register new task definition
    local new_task_def_arn=$(echo "$new_task_def" | aws ecs register-task-definition \
        --cli-input-json file:///dev/stdin \
        --region "$AWS_REGION" \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    success "Registered new task definition: $new_task_def_arn"
    
    # Update ECS service with new task definition
    aws ecs update-service \
        --cluster "${APP_NAME}-cluster" \
        --service "$service_name" \
        --task-definition "$new_task_def_arn" \
        --region "$AWS_REGION" \
        --desired-count 2 > /dev/null
    
    success "Updated ECS service $service_name with new task definition"
    
    # Wait for deployment to stabilize
    log "Waiting for deployment to stabilize..."
    aws ecs wait services-stable \
        --cluster "${APP_NAME}-cluster" \
        --services "$service_name" \
        --region "$AWS_REGION"
    
    success "Deployment to $inactive_color environment completed"
    echo "$inactive_color"
}

# Health check function
perform_health_checks() {
    local target_group="$1"
    local target_group_arn=$(aws elbv2 describe-target-groups \
        --names "${APP_NAME}-${target_group}-tg" \
        --region "$AWS_REGION" \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)
    
    log "Performing health checks on $target_group environment..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        local healthy_targets=$(aws elbv2 describe-target-health \
            --target-group-arn "$target_group_arn" \
            --region "$AWS_REGION" \
            --query 'length(TargetHealthDescriptions[?TargetHealth.State==`healthy`])' \
            --output text)
        
        local total_targets=$(aws elbv2 describe-target-health \
            --target-group-arn "$target_group_arn" \
            --region "$AWS_REGION" \
            --query 'length(TargetHealthDescriptions)' \
            --output text)
        
        log "Health check attempt $attempt/$max_attempts: $healthy_targets/$total_targets targets healthy"
        
        if [ "$healthy_targets" -gt 0 ] && [ "$healthy_targets" -eq "$total_targets" ]; then
            success "All targets in $target_group environment are healthy"
            return 0
        fi
        
        sleep 10
        ((attempt++))
    done
    
    error "Health checks failed for $target_group environment"
    return 1
}

# Performance validation
validate_performance() {
    local target_group="$1"
    local alb_dns=$(aws elbv2 describe-load-balancers \
        --names "${APP_NAME}-alb" \
        --region "$AWS_REGION" \
        --query 'LoadBalancers[0].DNSName' \
        --output text)
    
    log "Performing performance validation on $target_group environment..."
    
    # Simulate traffic and measure response times
    local total_requests=50
    local success_count=0
    local total_response_time=0
    
    for i in $(seq 1 $total_requests); do
        local start_time=$(date +%s.%N)
        local response_code=$(curl -s -o /dev/null -w "%{http_code}" "http://$alb_dns/health" || echo "000")
        local end_time=$(date +%s.%N)
        local response_time=$(echo "$end_time - $start_time" | bc -l)
        
        if [ "$response_code" == "200" ]; then
            ((success_count++))
            total_response_time=$(echo "$total_response_time + $response_time" | bc -l)
        fi
        
        # Brief pause between requests
        sleep 0.1
    done
    
    local success_rate=$(echo "scale=2; $success_count * 100 / $total_requests" | bc -l)
    local avg_response_time=$(echo "scale=3; $total_response_time / $success_count" | bc -l)
    
    log "Performance metrics - Success rate: ${success_rate}%, Average response time: ${avg_response_time}s"
    
    # Validation thresholds
    local min_success_rate=95
    local max_response_time=2.0
    
    if (( $(echo "$success_rate >= $min_success_rate" | bc -l) )) && \
       (( $(echo "$avg_response_time <= $max_response_time" | bc -l) )); then
        success "Performance validation passed"
        return 0
    else
        error "Performance validation failed"
        return 1
    fi
}

# Switch traffic to new environment
switch_traffic() {
    local new_active="$1"
    local target_group_arn=$(aws elbv2 describe-target-groups \
        --names "${APP_NAME}-${new_active}-tg" \
        --region "$AWS_REGION" \
        --query 'TargetGroups[0].TargetGroupArn' \
        --output text)
    
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
    
    log "Switching traffic to $new_active environment..."
    
    aws elbv2 modify-listener \
        --listener-arn "$listener_arn" \
        --default-actions Type=forward,TargetGroupArn="$target_group_arn" \
        --region "$AWS_REGION" > /dev/null
    
    success "Traffic switched to $new_active environment"
    
    # Wait for traffic to stabilize
    sleep 30
    
    # Validate traffic is flowing correctly
    log "Validating traffic flow..."
    if validate_performance "$new_active"; then
        success "Traffic switch validation successful"
        return 0
    else
        error "Traffic switch validation failed"
        return 1
    fi
}

# Rollback function
rollback() {
    local rollback_target="$1"
    warning "Initiating rollback to $rollback_target environment..."
    
    if switch_traffic "$rollback_target"; then
        success "Rollback completed successfully"
    else
        error "Rollback failed - manual intervention required"
        exit 1
    fi
}

# Cleanup old environment
cleanup_old_environment() {
    local old_active="$1"
    local service_name="${APP_NAME}-${old_active}"
    
    log "Scaling down $old_active environment..."
    
    aws ecs update-service \
        --cluster "${APP_NAME}-cluster" \
        --service "$service_name" \
        --desired-count 0 \
        --region "$AWS_REGION" > /dev/null
    
    success "Scaled down $old_active environment"
}

# CloudWatch monitoring integration
setup_monitoring() {
    log "Setting up CloudWatch monitoring..."
    
    # Create custom metrics and alarms for deployment monitoring
    aws cloudwatch put-metric-alarm \
        --alarm-name "${APP_NAME}-deployment-error-rate" \
        --alarm-description "Monitor error rate during deployment" \
        --metric-name HTTPCode_Target_5XX_Count \
        --namespace AWS/ApplicationELB \
        --statistic Sum \
        --period 300 \
        --threshold 10 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 2 \
        --alarm-actions "arn:aws:sns:${AWS_REGION}:$(aws sts get-caller-identity --query Account --output text):deployment-alerts" \
        --region "$AWS_REGION" 2>/dev/null || true
    
    success "CloudWatch monitoring configured"
}

# Main deployment flow
main() {
    log "Starting Blue-Green deployment for $APP_NAME version $VERSION"
    
    validate_prerequisites
    setup_monitoring
    
    # Get current active environment
    local current_active=$(get_active_target_group)
    log "Current active environment: $current_active"
    
    # Deploy to inactive environment
    local new_active=$(deploy_to_inactive "$current_active")
    
    # Perform health checks
    if ! perform_health_checks "$new_active"; then
        error "Health checks failed - aborting deployment"
        exit 1
    fi
    
    # Validate performance
    if ! validate_performance "$new_active"; then
        error "Performance validation failed - aborting deployment"
        exit 1
    fi
    
    # Switch traffic
    if ! switch_traffic "$new_active"; then
        rollback "$current_active"
        exit 1
    fi
    
    # Final validation period
    log "Monitoring deployment for 5 minutes before cleanup..."
    sleep 300
    
    # Final performance check
    if ! validate_performance "$new_active"; then
        warning "Final performance check failed - initiating rollback"
        rollback "$current_active"
        exit 1
    fi
    
    # Cleanup old environment
    cleanup_old_environment "$current_active"
    
    success "Blue-Green deployment completed successfully!"
    log "New active environment: $new_active"
    log "Version deployed: $VERSION"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi