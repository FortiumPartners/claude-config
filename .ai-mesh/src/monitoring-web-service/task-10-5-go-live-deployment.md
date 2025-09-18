# Sprint 10 - Task 10.5: Go-Live Deployment

**Agent**: backend-developer (DevOps specialist)  
**Duration**: 2 hours  
**Status**: Pending (Dependent on Tasks 10.1-10.4)

## Task Requirements

Execute the go-live deployment of the External Metrics Web Service using blue-green deployment strategy for zero-downtime transition:

### 10.5.1 Blue-Green Deployment Strategy
**Pre-Deployment Validation**:
- Staging environment final validation
- Production infrastructure health checks
- Database migration dry-run execution
- SSL certificate and domain validation
- Load balancer configuration verification

**Green Environment Deployment**:
- Deploy new version to green environment
- Comprehensive health checks and smoke tests
- Performance validation under synthetic load
- Security scan of production deployment
- Rollback plan preparation and validation

### 10.5.2 Zero-Downtime Deployment Execution
**Traffic Cutover Process**:
- Gradual traffic migration (10% → 50% → 100%)
- Real-time monitoring during cutover
- Automated rollback triggers if issues detected
- User session preservation during transition
- WebSocket connection migration handling

**Production Validation**:
- End-to-end functionality testing
- Real user monitoring activation
- Performance baseline establishment
- Security monitoring activation
- Business metric collection verification

## Implementation Specifications

### Blue-Green Deployment Script

```bash
#!/bin/bash
# go-live-deployment.sh - Zero-downtime deployment script

set -euo pipefail

# Configuration
readonly NAMESPACE="metrics-production"
readonly APP_NAME="external-metrics"
readonly NEW_VERSION="${1:-$(git rev-parse --short HEAD)}"
readonly TIMEOUT="300s"

# Logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >&2
}

# Pre-deployment validation
validate_environment() {
    log "Starting pre-deployment validation..."
    
    # Check cluster connectivity
    kubectl cluster-info >/dev/null || {
        log "ERROR: Cannot connect to Kubernetes cluster"
        exit 1
    }
    
    # Validate namespace exists
    kubectl get namespace "$NAMESPACE" >/dev/null || {
        log "ERROR: Namespace $NAMESPACE does not exist"
        exit 1
    }
    
    # Check database connectivity
    kubectl run db-test --rm -i --restart=Never --image=postgres:14 \
        --env="PGPASSWORD=${DB_PASSWORD}" \
        -- psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" >/dev/null || {
        log "ERROR: Database connectivity check failed"
        exit 1
    }
    
    # Validate SSL certificate
    curl -s -o /dev/null -w "%{http_code}" "https://metrics.fortium.com/health" | grep -q "200" || {
        log "ERROR: SSL certificate or domain validation failed"
        exit 1
    }
    
    log "Pre-deployment validation completed successfully"
}

# Deploy to green environment
deploy_green() {
    log "Deploying version $NEW_VERSION to green environment..."
    
    # Database migration (if needed)
    if [[ -n "${RUN_MIGRATIONS:-}" ]]; then
        log "Running database migrations..."
        helm upgrade --install "${APP_NAME}-migration" ./helm/migration \
            --namespace "$NAMESPACE" \
            --set image.tag="$NEW_VERSION" \
            --set environment=production \
            --wait --timeout="$TIMEOUT"
    fi
    
    # Deploy green application
    helm upgrade --install "${APP_NAME}-green" ./helm/application \
        --namespace "$NAMESPACE" \
        --set image.tag="$NEW_VERSION" \
        --set environment=production \
        --set deployment.color=green \
        --set service.name="${APP_NAME}-green" \
        --set replicas=3 \
        --wait --timeout="$TIMEOUT"
    
    log "Green deployment completed successfully"
}

# Health check green environment
health_check_green() {
    log "Performing health checks on green environment..."
    
    # Wait for pods to be ready
    kubectl wait --for=condition=ready pod \
        -l "app=${APP_NAME},color=green" \
        --namespace "$NAMESPACE" \
        --timeout="$TIMEOUT"
    
    # Get green service endpoint
    local green_endpoint
    green_endpoint=$(kubectl get service "${APP_NAME}-green" \
        --namespace "$NAMESPACE" \
        -o jsonpath='{.spec.clusterIP}')
    
    # Health check API
    kubectl run health-check --rm -i --restart=Never --image=curlimages/curl:7.85.0 \
        -- curl -f "http://${green_endpoint}:3000/health" || {
        log "ERROR: Health check failed for green environment"
        exit 1
    }
    
    # Database connectivity check
    kubectl run db-check --rm -i --restart=Never --image=curlimages/curl:7.85.0 \
        -- curl -f "http://${green_endpoint}:3000/health/database" || {
        log "ERROR: Database connectivity check failed for green environment"
        exit 1
    }
    
    # WebSocket connectivity check
    kubectl run ws-check --rm -i --restart=Never --image=curlimages/curl:7.85.0 \
        -- curl -f "http://${green_endpoint}:3000/health/websocket" || {
        log "ERROR: WebSocket connectivity check failed for green environment"
        exit 1
    }
    
    log "Green environment health checks passed"
}

# Performance validation
performance_validation() {
    log "Running performance validation on green environment..."
    
    # Synthetic load test
    kubectl run load-test --rm -i --restart=Never \
        --image=loadimpact/k6:latest \
        --command -- k6 run - <<EOF
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '1m', target: 20 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  let response = http.get('http://${green_endpoint}:3000/api/v1/dashboard/summary', {
    headers: { 'Authorization': 'Bearer ${TEST_TOKEN}' },
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
EOF
    
    log "Performance validation completed successfully"
}

# Gradual traffic cutover
traffic_cutover() {
    log "Starting gradual traffic cutover..."
    
    # Phase 1: 10% traffic to green
    log "Phase 1: Routing 10% traffic to green environment"
    kubectl patch service "${APP_NAME}-service" \
        --namespace "$NAMESPACE" \
        --patch '{"spec":{"selector":{"app":"'${APP_NAME}'","color":"green"}}}' \
        --type merge
    
    # Create weighted routing (using Istio VirtualService)
    kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ${APP_NAME}-traffic-split
  namespace: ${NAMESPACE}
spec:
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: ${APP_NAME}-green
      weight: 100
  - route:
    - destination:
        host: ${APP_NAME}-blue
      weight: 90
    - destination:
        host: ${APP_NAME}-green
      weight: 10
EOF
    
    sleep 60  # Monitor for 1 minute
    
    # Check error rates
    local error_rate
    error_rate=$(curl -s "http://prometheus.monitoring.svc.cluster.local:9090/api/v1/query?query=rate(http_requests_total{status=~\"5..\"}[5m])" | \
        jq -r '.data.result[0].value[1] // "0"')
    
    if (( $(echo "$error_rate > 0.01" | bc -l) )); then
        log "ERROR: High error rate detected ($error_rate), rolling back"
        rollback_deployment
        exit 1
    fi
    
    # Phase 2: 50% traffic to green
    log "Phase 2: Routing 50% traffic to green environment"
    kubectl patch virtualservice "${APP_NAME}-traffic-split" \
        --namespace "$NAMESPACE" \
        --patch '{"spec":{"http":[{"route":[{"destination":{"host":"'${APP_NAME}'-blue"},"weight":50},{"destination":{"host":"'${APP_NAME}'-green"},"weight":50}]}]}}'
    
    sleep 120  # Monitor for 2 minutes
    
    # Final validation before full cutover
    health_check_green
    
    # Phase 3: 100% traffic to green
    log "Phase 3: Routing 100% traffic to green environment"
    kubectl patch service "${APP_NAME}-service" \
        --namespace "$NAMESPACE" \
        --patch '{"spec":{"selector":{"color":"green"}}}' \
        --type merge
    
    # Remove traffic splitting
    kubectl delete virtualservice "${APP_NAME}-traffic-split" \
        --namespace "$NAMESPACE" || true
    
    log "Traffic cutover completed successfully"
}

# Post-deployment validation
post_deployment_validation() {
    log "Running post-deployment validation..."
    
    # End-to-end functionality tests
    npm run test:e2e:production
    
    # Real user monitoring check
    curl -f "https://metrics.fortium.com/api/v1/health/monitoring"
    
    # Business metrics validation
    local active_users
    active_users=$(curl -s "https://api.metrics.fortium.com/v1/admin/stats" \
        -H "Authorization: Bearer ${ADMIN_TOKEN}" | \
        jq -r '.data.active_users')
    
    if [[ "$active_users" -lt 1 ]]; then
        log "WARNING: No active users detected, this may be expected for new deployment"
    fi
    
    log "Post-deployment validation completed"
}

# Cleanup old blue environment
cleanup_blue() {
    log "Cleaning up old blue environment..."
    
    # Wait before cleanup to ensure stability
    sleep 300  # 5 minutes
    
    # Remove blue deployment
    helm uninstall "${APP_NAME}-blue" --namespace "$NAMESPACE" || {
        log "WARNING: Blue deployment cleanup failed, manual cleanup may be required"
    }
    
    log "Blue environment cleanup completed"
}

# Rollback procedure
rollback_deployment() {
    log "ROLLBACK: Reverting to blue environment due to deployment failure"
    
    # Switch traffic back to blue
    kubectl patch service "${APP_NAME}-service" \
        --namespace "$NAMESPACE" \
        --patch '{"spec":{"selector":{"color":"blue"}}}' \
        --type merge
    
    # Remove green deployment
    helm uninstall "${APP_NAME}-green" --namespace "$NAMESPACE" || true
    
    # Send alert
    curl -X POST "${SLACK_WEBHOOK_URL}" \
        -H 'Content-type: application/json' \
        --data '{"text":"🚨 ROLLBACK: External Metrics Service deployment rolled back due to errors"}'
    
    log "Rollback completed"
}

# Main deployment process
main() {
    log "Starting External Metrics Service go-live deployment"
    log "Deploying version: $NEW_VERSION"
    
    # Set up error handling
    trap rollback_deployment ERR
    
    # Execute deployment phases
    validate_environment
    deploy_green
    health_check_green
    performance_validation
    traffic_cutover
    post_deployment_validation
    cleanup_blue
    
    # Success notification
    curl -X POST "${SLACK_WEBHOOK_URL}" \
        -H 'Content-type: application/json' \
        --data '{"text":"🚀 SUCCESS: External Metrics Service v'$NEW_VERSION' deployed to production!"}'
    
    log "Go-live deployment completed successfully!"
}

# Execute main function
main "$@"
```

### Pre-Deployment Checklist

```yaml
# pre-deployment-checklist.yaml
deployment_checklist:
  infrastructure:
    - name: "EKS Cluster Health"
      command: "kubectl get nodes"
      expected: "All nodes Ready"
      status: pending
      
    - name: "Database Connectivity" 
      command: "pg_isready -h $DB_HOST"
      expected: "accepting connections"
      status: pending
      
    - name: "Redis Cluster Health"
      command: "redis-cli -h $REDIS_HOST ping"
      expected: "PONG"
      status: pending
      
    - name: "SSL Certificate Validity"
      command: "openssl s_client -connect metrics.fortium.com:443"
      expected: "Verify return code: 0"
      status: pending

  application:
    - name: "Docker Images Available"
      command: "docker pull $ECR_REPO/external-metrics-api:$VERSION"
      expected: "Pull complete"
      status: pending
      
    - name: "Database Migration Dry Run"
      command: "npm run migrate:dry-run"
      expected: "Migration plan valid"
      status: pending
      
    - name: "Configuration Validation"
      command: "npm run config:validate"
      expected: "All configuration valid"
      status: pending

  monitoring:
    - name: "Prometheus Targets"
      command: "curl prometheus:9090/api/v1/targets"
      expected: "All targets up"
      status: pending
      
    - name: "Grafana Dashboards"
      command: "curl grafana:3000/api/health"
      expected: "OK"
      status: pending
      
    - name: "Alert Rules"
      command: "curl prometheus:9090/api/v1/rules"
      expected: "Rules loaded"
      status: pending

  security:
    - name: "Secrets Available"
      command: "kubectl get secrets -n metrics-production"
      expected: "All secrets present"
      status: pending
      
    - name: "RBAC Permissions"
      command: "kubectl auth can-i get pods --as=system:serviceaccount:metrics-production:default"
      expected: "yes"
      status: pending
      
    - name: "Network Policies"
      command: "kubectl get networkpolicies -n metrics-production"
      expected: "Policies active"
      status: pending
```

### Deployment Monitoring Dashboard

```javascript
// deployment-monitor.js - Real-time deployment monitoring
const express = require('express');
const WebSocket = require('ws');
const prometheus = require('prom-client');

class DeploymentMonitor {
    constructor() {
        this.app = express();
        this.wss = new WebSocket.Server({ port: 8080 });
        this.metrics = {
            deploymentPhase: new prometheus.Gauge({
                name: 'deployment_phase',
                help: 'Current deployment phase (0-5)',
                labelNames: ['deployment_id']
            }),
            errorRate: new prometheus.Gauge({
                name: 'deployment_error_rate',
                help: 'Error rate during deployment',
                labelNames: ['service', 'version']
            }),
            responseTime: new prometheus.Histogram({
                name: 'deployment_response_time',
                help: 'Response time during deployment',
                buckets: [0.1, 0.5, 1, 2, 5]
            })
        };
        this.deploymentStatus = {
            phase: 0,
            phaseNames: [
                'Pre-deployment validation',
                'Green environment deployment', 
                'Health checks',
                'Performance validation',
                'Traffic cutover',
                'Post-deployment validation',
                'Cleanup'
            ],
            startTime: Date.now(),
            errors: [],
            metrics: {}
        };
    }

    updatePhase(phase, details = {}) {
        this.deploymentStatus.phase = phase;
        this.deploymentStatus.lastUpdate = Date.now();
        this.deploymentStatus.currentPhase = this.deploymentStatus.phaseNames[phase];
        
        // Update Prometheus metrics
        this.metrics.deploymentPhase.set({ deployment_id: process.env.DEPLOYMENT_ID }, phase);
        
        // Broadcast to connected clients
        const message = {
            type: 'phase_update',
            phase: phase,
            phaseName: this.deploymentStatus.currentPhase,
            timestamp: new Date().toISOString(),
            details
        };
        
        this.broadcast(message);
        console.log(`[DEPLOYMENT] Phase ${phase}: ${this.deploymentStatus.currentPhase}`);
    }

    recordError(error, phase = null) {
        const errorRecord = {
            message: error.message,
            phase: phase || this.deploymentStatus.phase,
            timestamp: new Date().toISOString(),
            stack: error.stack
        };
        
        this.deploymentStatus.errors.push(errorRecord);
        
        const message = {
            type: 'error',
            error: errorRecord
        };
        
        this.broadcast(message);
        console.error(`[DEPLOYMENT ERROR] ${error.message}`);
    }

    recordMetric(name, value, labels = {}) {
        if (!this.deploymentStatus.metrics[name]) {
            this.deploymentStatus.metrics[name] = [];
        }
        
        this.deploymentStatus.metrics[name].push({
            value,
            labels,
            timestamp: Date.now()
        });
        
        // Update Prometheus metrics
        if (name === 'error_rate') {
            this.metrics.errorRate.set(labels, value);
        } else if (name === 'response_time') {
            this.metrics.responseTime.observe(value);
        }
    }

    broadcast(message) {
        this.wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }

    start() {
        // WebSocket connection handler
        this.wss.on('connection', (ws) => {
            console.log('Client connected to deployment monitor');
            
            // Send current status
            ws.send(JSON.stringify({
                type: 'status',
                status: this.deploymentStatus
            }));
            
            ws.on('close', () => {
                console.log('Client disconnected from deployment monitor');
            });
        });

        // HTTP endpoints for deployment script
        this.app.use(express.json());
        
        this.app.post('/deployment/phase', (req, res) => {
            const { phase, details } = req.body;
            this.updatePhase(phase, details);
            res.json({ success: true });
        });
        
        this.app.post('/deployment/error', (req, res) => {
            const { error, phase } = req.body;
            this.recordError(new Error(error), phase);
            res.json({ success: true });
        });
        
        this.app.post('/deployment/metric', (req, res) => {
            const { name, value, labels } = req.body;
            this.recordMetric(name, value, labels);
            res.json({ success: true });
        });
        
        this.app.get('/deployment/status', (req, res) => {
            res.json(this.deploymentStatus);
        });
        
        // Prometheus metrics endpoint
        this.app.get('/metrics', (req, res) => {
            res.set('Content-Type', prometheus.register.contentType);
            res.end(prometheus.register.metrics());
        });
        
        this.app.listen(3001, () => {
            console.log('Deployment monitor running on port 3001');
        });
    }
}

// Start deployment monitor
const monitor = new DeploymentMonitor();
monitor.start();

module.exports = DeploymentMonitor;
```

## Expected Deliverables

1. **Deployment Execution**:
   - ✅ Zero-downtime blue-green deployment completed
   - ✅ Gradual traffic cutover (10% → 50% → 100%)
   - ✅ Real-time monitoring during deployment
   - ✅ Automated rollback capability validated

2. **Production Validation**:
   - ✅ End-to-end functionality verified
   - ✅ Performance baselines established
   - ✅ Security monitoring activated
   - ✅ Business metrics collection operational

3. **Monitoring and Alerting**:
   - ✅ Real-time deployment monitoring dashboard
   - ✅ Automated error detection and alerting
   - ✅ Performance metrics collection active
   - ✅ Rollback triggers tested and functional

## Quality Gates

- [ ] Zero service interruption during deployment
- [ ] All health checks passing in production
- [ ] Response times <500ms (95th percentile)
- [ ] Error rate <0.1% in first hour post-deployment
- [ ] WebSocket connections stable and functional
- [ ] Real user monitoring active and collecting data

## Handoff Requirements

**From Previous Tasks**:
- Production infrastructure fully operational
- CI/CD pipeline tested and validated
- Monitoring and logging systems active
- Documentation and training materials ready

**To Task 10.6 (Post-Deployment Validation)**:
- Production deployment success confirmation
- Performance baseline measurements
- User access validation results
- System health status report

**Agent**: Please execute the go-live deployment with extreme care and attention to detail. Monitor all metrics closely during the deployment process. Be prepared to execute rollback procedures immediately if any issues are detected. Success criteria must be met before proceeding to cleanup phases.