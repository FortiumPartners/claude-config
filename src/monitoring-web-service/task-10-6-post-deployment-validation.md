# Sprint 10 - Task 10.6: Post-Deployment Validation

**Agent**: general-purpose (Validation specialist)  
**Duration**: 1 hour  
**Status**: Pending (Dependent on Task 10.5 completion)

## Task Requirements

Validate the successful deployment of the External Metrics Web Service and confirm all success metrics and system health indicators:

### 10.6.1 Success Metrics Validation
**Technical Performance KPIs**:
- API response time validation (<500ms 95th percentile)
- System uptime confirmation (>99.9% target)
- WebSocket latency verification (<100ms)
- Database query performance (<100ms average)
- Memory and CPU utilization within targets

**Business Success Metrics**:
- User migration completion rate
- Dashboard functionality validation
- Real-time features operational status
- Export and reporting capabilities
- Mobile access functionality

### 10.6.2 System Health Checks
**Infrastructure Health**:
- EKS cluster node status and resource utilization
- RDS database performance and connection pooling
- ElastiCache Redis cluster health and hit rates
- Load balancer health and traffic distribution
- SSL certificate status and security headers

**Application Health**:
- All microservices responding correctly
- WebSocket connections stable and scalable
- Authentication and authorization working
- Multi-tenant data isolation verified
- Background job processing operational

### 10.6.3 Monitoring Setup Verification
**Alerting System**:
- Critical alerts configured and tested
- Warning alerts functional with appropriate thresholds
- Escalation procedures validated
- On-call integration working
- Status page updates automated

**Observability**:
- Logs aggregation working in CloudWatch
- Metrics collection active in Prometheus
- Dashboards displaying real-time data
- Distributed tracing operational
- Performance profiling enabled

## Implementation Specifications

### Automated Validation Script

```bash
#!/bin/bash
# post-deployment-validation.sh - Comprehensive system validation

set -euo pipefail

readonly PRODUCTION_URL="https://metrics.fortium.com"
readonly API_URL="https://api.metrics.fortium.com/v1"
readonly ADMIN_TOKEN="${ADMIN_TOKEN}"
readonly VALIDATION_RESULTS_FILE="validation-results-$(date +%Y%m%d-%H%M%S).json"

# Initialize results structure
cat > "$VALIDATION_RESULTS_FILE" <<EOF
{
  "validation_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployment_version": "${DEPLOYMENT_VERSION:-unknown}",
  "validation_results": {},
  "success_metrics": {},
  "health_checks": {},
  "alerts": [],
  "overall_status": "pending"
}
EOF

# Logging functions
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >&2
}

update_result() {
    local category="$1"
    local test_name="$2"
    local status="$3"
    local details="$4"
    local duration="${5:-0}"
    
    jq --arg cat "$category" \
       --arg name "$test_name" \
       --arg stat "$status" \
       --arg det "$details" \
       --arg dur "$duration" \
       '.validation_results[$cat][$name] = {
         "status": $stat,
         "details": $det,
         "duration_ms": ($dur | tonumber),
         "timestamp": (now | strftime("%Y-%m-%dT%H:%M:%SZ"))
       }' "$VALIDATION_RESULTS_FILE" > temp.json && mv temp.json "$VALIDATION_RESULTS_FILE"
}

# API Health Validation
validate_api_health() {
    log "Validating API health and performance..."
    
    local start_time=$(date +%s%3N)
    
    # Basic health check
    if curl -s -f "${API_URL}/health" > /dev/null; then
        local end_time=$(date +%s%3N)
        local duration=$((end_time - start_time))
        update_result "api_health" "basic_health_check" "PASS" "API responding correctly" "$duration"
        
        # Detailed health check
        local health_response
        health_response=$(curl -s "${API_URL}/health/detailed")
        
        # Parse health response
        local db_status
        local redis_status
        local websocket_status
        
        db_status=$(echo "$health_response" | jq -r '.database.status')
        redis_status=$(echo "$health_response" | jq -r '.redis.status')
        websocket_status=$(echo "$health_response" | jq -r '.websocket.status')
        
        # Database health
        if [[ "$db_status" == "healthy" ]]; then
            local db_response_time
            db_response_time=$(echo "$health_response" | jq -r '.database.response_time_ms')
            update_result "api_health" "database_health" "PASS" "Database healthy, ${db_response_time}ms response time" "0"
        else
            update_result "api_health" "database_health" "FAIL" "Database not healthy: $db_status" "0"
        fi
        
        # Redis health
        if [[ "$redis_status" == "healthy" ]]; then
            update_result "api_health" "redis_health" "PASS" "Redis cluster healthy" "0"
        else
            update_result "api_health" "redis_health" "FAIL" "Redis not healthy: $redis_status" "0"
        fi
        
        # WebSocket health
        if [[ "$websocket_status" == "healthy" ]]; then
            update_result "api_health" "websocket_health" "PASS" "WebSocket server healthy" "0"
        else
            update_result "api_health" "websocket_health" "FAIL" "WebSocket not healthy: $websocket_status" "0"
        fi
    else
        update_result "api_health" "basic_health_check" "FAIL" "API health check failed" "0"
    fi
}

# Performance Metrics Validation
validate_performance_metrics() {
    log "Validating performance metrics..."
    
    # API response time test
    local total_time=0
    local request_count=10
    local slow_requests=0
    
    for i in $(seq 1 $request_count); do
        local start_time=$(date +%s%3N)
        
        if curl -s -f "${API_URL}/dashboard/summary" \
           -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null; then
            local end_time=$(date +%s%3N)
            local duration=$((end_time - start_time))
            total_time=$((total_time + duration))
            
            if [[ $duration -gt 500 ]]; then
                slow_requests=$((slow_requests + 1))
            fi
        fi
        
        sleep 0.5
    done
    
    local avg_response_time=$((total_time / request_count))
    local slow_request_percentage=$((slow_requests * 100 / request_count))
    
    if [[ $avg_response_time -lt 500 ]] && [[ $slow_request_percentage -lt 5 ]]; then
        update_result "performance" "api_response_time" "PASS" \
            "Average response time: ${avg_response_time}ms, ${slow_request_percentage}% slow requests" \
            "$avg_response_time"
    else
        update_result "performance" "api_response_time" "FAIL" \
            "Performance targets not met: ${avg_response_time}ms avg, ${slow_request_percentage}% slow" \
            "$avg_response_time"
    fi
    
    # WebSocket latency test
    local ws_latency
    ws_latency=$(node -e "
        const WebSocket = require('ws');
        const start = Date.now();
        const ws = new WebSocket('wss://api.metrics.fortium.com/ws?token=${ADMIN_TOKEN}');
        ws.on('open', () => {
            const latency = Date.now() - start;
            console.log(latency);
            ws.close();
        });
        setTimeout(() => process.exit(1), 5000);
    " 2>/dev/null || echo "error")
    
    if [[ "$ws_latency" != "error" ]] && [[ $ws_latency -lt 100 ]]; then
        update_result "performance" "websocket_latency" "PASS" \
            "WebSocket connection latency: ${ws_latency}ms" "$ws_latency"
    else
        update_result "performance" "websocket_latency" "FAIL" \
            "WebSocket latency test failed or too slow: ${ws_latency}ms" "0"
    fi
}

# Business Functionality Validation
validate_business_functionality() {
    log "Validating business functionality..."
    
    # Authentication test
    local auth_response
    auth_response=$(curl -s -X POST "${API_URL}/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@fortium.com","password":"testpassword"}' \
        -w "%{http_code}")
    
    local auth_status="${auth_response: -3}"
    if [[ "$auth_status" == "200" ]]; then
        update_result "business" "authentication" "PASS" "User authentication working" "0"
    else
        update_result "business" "authentication" "FAIL" "Authentication failed: HTTP $auth_status" "0"
    fi
    
    # Dashboard data retrieval
    local dashboard_response
    dashboard_response=$(curl -s "${API_URL}/dashboard/summary" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -w "%{http_code}")
    
    local dashboard_status="${dashboard_response: -3}"
    if [[ "$dashboard_status" == "200" ]]; then
        local user_count
        user_count=$(echo "${dashboard_response%???}" | jq -r '.data.total_users // 0')
        update_result "business" "dashboard_data" "PASS" \
            "Dashboard data available, $user_count total users" "0"
    else
        update_result "business" "dashboard_data" "FAIL" \
            "Dashboard data retrieval failed: HTTP $dashboard_status" "0"
    fi
    
    # Real-time features test
    local realtime_test_result
    realtime_test_result=$(timeout 10 node -e "
        const WebSocket = require('ws');
        const ws = new WebSocket('wss://api.metrics.fortium.com/ws?token=${ADMIN_TOKEN}');
        let messageReceived = false;
        
        ws.on('open', () => {
            ws.send(JSON.stringify({type: 'subscribe', channel: 'dashboard_updates'}));
        });
        
        ws.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'dashboard_update' || message.type === 'subscription_confirmed') {
                messageReceived = true;
                console.log('success');
                ws.close();
                process.exit(0);
            }
        });
        
        setTimeout(() => {
            if (!messageReceived) {
                console.log('timeout');
                process.exit(1);
            }
        }, 8000);
    " 2>/dev/null || echo "error")
    
    if [[ "$realtime_test_result" == "success" ]]; then
        update_result "business" "realtime_features" "PASS" \
            "Real-time WebSocket messaging working" "0"
    else
        update_result "business" "realtime_features" "FAIL" \
            "Real-time features test failed: $realtime_test_result" "0"
    fi
}

# Infrastructure Health Validation
validate_infrastructure() {
    log "Validating infrastructure health..."
    
    # EKS cluster health
    local node_status
    node_status=$(kubectl get nodes --no-headers | awk '{print $2}' | grep -v "Ready" | wc -l)
    
    if [[ $node_status -eq 0 ]]; then
        local node_count
        node_count=$(kubectl get nodes --no-headers | wc -l)
        update_result "infrastructure" "eks_cluster" "PASS" \
            "All $node_count EKS nodes in Ready state" "0"
    else
        update_result "infrastructure" "eks_cluster" "FAIL" \
            "$node_status nodes not in Ready state" "0"
    fi
    
    # Pod health
    local unhealthy_pods
    unhealthy_pods=$(kubectl get pods -n metrics-production --no-headers | \
        grep -v "Running\|Completed" | wc -l)
    
    if [[ $unhealthy_pods -eq 0 ]]; then
        local pod_count
        pod_count=$(kubectl get pods -n metrics-production --no-headers | wc -l)
        update_result "infrastructure" "pod_health" "PASS" \
            "All $pod_count pods healthy in production namespace" "0"
    else
        update_result "infrastructure" "pod_health" "FAIL" \
            "$unhealthy_pods pods not healthy" "0"
    fi
    
    # SSL certificate validation
    local ssl_expiry
    ssl_expiry=$(echo | openssl s_client -connect metrics.fortium.com:443 2>/dev/null | \
        openssl x509 -noout -dates | grep "notAfter" | cut -d= -f2)
    
    local ssl_expiry_timestamp
    ssl_expiry_timestamp=$(date -d "$ssl_expiry" +%s)
    local current_timestamp
    current_timestamp=$(date +%s)
    local days_until_expiry=$(( (ssl_expiry_timestamp - current_timestamp) / 86400 ))
    
    if [[ $days_until_expiry -gt 30 ]]; then
        update_result "infrastructure" "ssl_certificate" "PASS" \
            "SSL certificate valid, expires in $days_until_expiry days" "0"
    else
        update_result "infrastructure" "ssl_certificate" "WARN" \
            "SSL certificate expires soon: $days_until_expiry days" "0"
    fi
}

# Monitoring System Validation
validate_monitoring() {
    log "Validating monitoring systems..."
    
    # Prometheus health
    if curl -s -f "http://prometheus.monitoring.svc.cluster.local:9090/-/healthy" > /dev/null; then
        # Check if metrics are being collected
        local metrics_count
        metrics_count=$(curl -s "http://prometheus.monitoring.svc.cluster.local:9090/api/v1/query?query=up" | \
            jq '.data.result | length')
        
        if [[ $metrics_count -gt 0 ]]; then
            update_result "monitoring" "prometheus" "PASS" \
                "Prometheus healthy, collecting $metrics_count metric series" "0"
        else
            update_result "monitoring" "prometheus" "FAIL" \
                "Prometheus healthy but no metrics collected" "0"
        fi
    else
        update_result "monitoring" "prometheus" "FAIL" \
            "Prometheus health check failed" "0"
    fi
    
    # Grafana health
    if curl -s -f "http://grafana.monitoring.svc.cluster.local:3000/api/health" > /dev/null; then
        update_result "monitoring" "grafana" "PASS" \
            "Grafana dashboard accessible" "0"
    else
        update_result "monitoring" "grafana" "FAIL" \
            "Grafana health check failed" "0"
    fi
    
    # Alert manager
    local alert_count
    alert_count=$(curl -s "http://alertmanager.monitoring.svc.cluster.local:9093/api/v1/alerts" | \
        jq '.data | length')
    
    update_result "monitoring" "alertmanager" "PASS" \
        "AlertManager operational, $alert_count active alerts" "0"
}

# Success Metrics Calculation
calculate_success_metrics() {
    log "Calculating overall success metrics..."
    
    # Count pass/fail/warn results
    local pass_count
    local fail_count
    local warn_count
    
    pass_count=$(jq '[.validation_results[][] | select(.status == "PASS")] | length' "$VALIDATION_RESULTS_FILE")
    fail_count=$(jq '[.validation_results[][] | select(.status == "FAIL")] | length' "$VALIDATION_RESULTS_FILE")
    warn_count=$(jq '[.validation_results[][] | select(.status == "WARN")] | length' "$VALIDATION_RESULTS_FILE")
    
    local total_tests=$((pass_count + fail_count + warn_count))
    local success_rate=$((pass_count * 100 / total_tests))
    
    # Update success metrics
    jq --arg pass "$pass_count" \
       --arg fail "$fail_count" \
       --arg warn "$warn_count" \
       --arg total "$total_tests" \
       --arg rate "$success_rate" \
       '.success_metrics = {
         "total_tests": ($total | tonumber),
         "passed_tests": ($pass | tonumber),
         "failed_tests": ($fail | tonumber),
         "warning_tests": ($warn | tonumber),
         "success_rate_percentage": ($rate | tonumber)
       }' "$VALIDATION_RESULTS_FILE" > temp.json && mv temp.json "$VALIDATION_RESULTS_FILE"
    
    # Determine overall status
    local overall_status
    if [[ $fail_count -eq 0 ]] && [[ $success_rate -ge 90 ]]; then
        overall_status="SUCCESS"
    elif [[ $fail_count -le 2 ]] && [[ $success_rate -ge 80 ]]; then
        overall_status="SUCCESS_WITH_WARNINGS"
    else
        overall_status="FAILURE"
    fi
    
    jq --arg status "$overall_status" \
       '.overall_status = $status' "$VALIDATION_RESULTS_FILE" > temp.json && mv temp.json "$VALIDATION_RESULTS_FILE"
    
    log "Validation completed: $overall_status ($success_rate% success rate)"
}

# Generate validation report
generate_report() {
    log "Generating validation report..."
    
    # Create human-readable summary
    local summary_file="validation-summary-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$summary_file" <<EOF
# External Metrics Service - Post-Deployment Validation Report

**Deployment Date**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
**Deployment Version**: ${DEPLOYMENT_VERSION:-unknown}
**Validation Duration**: $(($(date +%s) - validation_start_time)) seconds

## Overall Status
$(jq -r '.overall_status' "$VALIDATION_RESULTS_FILE")

## Success Metrics
- **Total Tests**: $(jq -r '.success_metrics.total_tests' "$VALIDATION_RESULTS_FILE")
- **Passed**: $(jq -r '.success_metrics.passed_tests' "$VALIDATION_RESULTS_FILE")
- **Failed**: $(jq -r '.success_metrics.failed_tests' "$VALIDATION_RESULTS_FILE")
- **Warnings**: $(jq -r '.success_metrics.warning_tests' "$VALIDATION_RESULTS_FILE")
- **Success Rate**: $(jq -r '.success_metrics.success_rate_percentage' "$VALIDATION_RESULTS_FILE")%

## Detailed Results

### API Health
$(jq -r '.validation_results.api_health | to_entries[] | "- **\(.key)**: \(.value.status) - \(.value.details)"' "$VALIDATION_RESULTS_FILE")

### Performance Metrics
$(jq -r '.validation_results.performance | to_entries[] | "- **\(.key)**: \(.value.status) - \(.value.details)"' "$VALIDATION_RESULTS_FILE")

### Business Functionality  
$(jq -r '.validation_results.business | to_entries[] | "- **\(.key)**: \(.value.status) - \(.value.details)"' "$VALIDATION_RESULTS_FILE")

### Infrastructure Health
$(jq -r '.validation_results.infrastructure | to_entries[] | "- **\(.key)**: \(.value.status) - \(.value.details)"' "$VALIDATION_RESULTS_FILE")

### Monitoring Systems
$(jq -r '.validation_results.monitoring | to_entries[] | "- **\(.key)**: \(.value.status) - \(.value.details)"' "$VALIDATION_RESULTS_FILE")

## Recommendations

$(if [[ $(jq -r '.success_metrics.failed_tests' "$VALIDATION_RESULTS_FILE") -gt 0 ]]; then
    echo "### Critical Issues to Address"
    jq -r '.validation_results[][] | select(.status == "FAIL") | "- \(.details)"' "$VALIDATION_RESULTS_FILE"
fi)

$(if [[ $(jq -r '.success_metrics.warning_tests' "$VALIDATION_RESULTS_FILE") -gt 0 ]]; then
    echo "### Warnings to Monitor"
    jq -r '.validation_results[][] | select(.status == "WARN") | "- \(.details)"' "$VALIDATION_RESULTS_FILE"
fi)

## Next Steps

1. **Monitor System Performance**: Continue monitoring for the first 24 hours
2. **User Feedback Collection**: Gather feedback from early users
3. **Performance Optimization**: Address any performance bottlenecks identified
4. **Documentation Updates**: Update any procedures based on deployment learnings

---
*Generated automatically by post-deployment validation script*
EOF
    
    log "Validation report generated: $summary_file"
    echo "$summary_file"
}

# Main validation execution
main() {
    local validation_start_time
    validation_start_time=$(date +%s)
    
    log "Starting post-deployment validation for External Metrics Service"
    
    # Initialize results file structure
    jq '.validation_results = {
        "api_health": {},
        "performance": {},
        "business": {},
        "infrastructure": {},
        "monitoring": {}
    }' "$VALIDATION_RESULTS_FILE" > temp.json && mv temp.json "$VALIDATION_RESULTS_FILE"
    
    # Execute validation tests
    validate_api_health
    validate_performance_metrics  
    validate_business_functionality
    validate_infrastructure
    validate_monitoring
    
    # Calculate results and generate report
    calculate_success_metrics
    local report_file
    report_file=$(generate_report)
    
    # Send notification
    local overall_status
    overall_status=$(jq -r '.overall_status' "$VALIDATION_RESULTS_FILE")
    
    local notification_color
    case $overall_status in
        "SUCCESS") notification_color="good" ;;
        "SUCCESS_WITH_WARNINGS") notification_color="warning" ;;
        *) notification_color="danger" ;;
    esac
    
    curl -X POST "${SLACK_WEBHOOK_URL}" \
        -H 'Content-type: application/json' \
        --data "{
            \"attachments\": [{
                \"color\": \"$notification_color\",
                \"title\": \"External Metrics Service - Post-Deployment Validation\",
                \"text\": \"Status: $overall_status\\nSuccess Rate: $(jq -r '.success_metrics.success_rate_percentage' "$VALIDATION_RESULTS_FILE")%\\nReport: $report_file\"
            }]
        }"
    
    log "Post-deployment validation completed: $overall_status"
    
    # Exit with appropriate code
    if [[ "$overall_status" == "FAILURE" ]]; then
        exit 1
    else
        exit 0
    fi
}

# Execute validation
main "$@"
```

### Success Criteria Checklist

```yaml
# success-criteria-checklist.yaml
deployment_success_criteria:
  technical_performance:
    api_response_time:
      target: "<500ms (95th percentile)"
      measurement: "Load test with 100 concurrent users"
      status: pending
      
    system_uptime:
      target: ">99.9% availability"
      measurement: "24-hour monitoring window"
      status: pending
      
    websocket_latency:
      target: "<100ms connection latency"  
      measurement: "WebSocket connection test"
      status: pending
      
    database_performance:
      target: "<100ms average query time"
      measurement: "Database query profiling"
      status: pending

  business_functionality:
    user_authentication:
      target: "SSO and local auth working"
      measurement: "Login test with all providers"
      status: pending
      
    dashboard_functionality:
      target: "All widgets loading correctly"
      measurement: "Dashboard feature test"
      status: pending
      
    real_time_features:
      target: "WebSocket updates working"
      measurement: "Live update functionality test"
      status: pending
      
    data_migration:
      target: "Historical data accessible"
      measurement: "Data integrity verification"
      status: pending

  infrastructure_health:
    kubernetes_cluster:
      target: "All nodes healthy"
      measurement: "kubectl get nodes status"
      status: pending
      
    database_cluster:
      target: "Multi-AZ RDS operational"
      measurement: "Database connection and failover test"
      status: pending
      
    redis_cluster:
      target: "Cache hit rate >80%"
      measurement: "Redis cluster performance metrics"
      status: pending
      
    load_balancer:
      target: "Traffic distribution working"
      measurement: "Load balancer health checks"
      status: pending

  monitoring_alerting:
    prometheus_metrics:
      target: "All custom metrics collecting"
      measurement: "Metrics endpoint validation"
      status: pending
      
    grafana_dashboards:
      target: "Dashboards displaying data"
      measurement: "Dashboard load and data test"
      status: pending
      
    alert_rules:
      target: "Critical alerts configured"
      measurement: "Alert rule validation"
      status: pending
      
    log_aggregation:
      target: "Logs flowing to CloudWatch"
      measurement: "Log collection verification"
      status: pending

  security_compliance:
    ssl_certificate:
      target: "Valid SSL with A+ rating"
      measurement: "SSL Labs test"
      status: pending
      
    authentication_security:
      target: "JWT tokens secure"
      measurement: "Security audit scan"
      status: pending
      
    data_isolation:
      target: "Multi-tenant isolation verified"
      measurement: "Cross-tenant access test"
      status: pending
      
    network_security:
      target: "Security groups configured"
      measurement: "Network policy validation"
      status: pending
```

## Expected Deliverables

1. **Success Metrics Validation**:
   - ✅ All technical KPIs meeting target thresholds
   - ✅ Business functionality fully operational
   - ✅ User migration and adoption metrics tracked
   - ✅ Performance baselines established

2. **System Health Confirmation**:
   - ✅ Infrastructure health validated
   - ✅ Application services fully operational
   - ✅ Monitoring and alerting systems active
   - ✅ Security controls verified

3. **Validation Report**:
   - ✅ Comprehensive validation results documented
   - ✅ Success metrics calculated and reported
   - ✅ Any issues or recommendations documented
   - ✅ Stakeholder notification completed

## Quality Gates

- [ ] >95% of validation tests passing
- [ ] All critical functionality working correctly
- [ ] Performance targets met in production environment
- [ ] No critical security issues identified
- [ ] Monitoring systems capturing all required metrics
- [ ] Zero critical alerts active after validation

## Final Handoff

**Project Completion**:
- Complete TRD implementation validated
- External Metrics Web Service fully operational
- All Sprint 10 tasks completed successfully
- Production system ready for full user adoption
- Success metrics confirming project objectives achieved

**Agent**: Please execute thorough post-deployment validation to confirm the successful completion of the External Metrics Web Service implementation. Validate all success criteria and provide comprehensive reporting. This is the final validation step before declaring the project complete.