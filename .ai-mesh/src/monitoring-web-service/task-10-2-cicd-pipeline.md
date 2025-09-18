# Sprint 10 - Task 10.2: CI/CD Pipeline Configuration

**Agent**: backend-developer (DevOps specialist)  
**Duration**: 10 hours  
**Status**: Pending (Dependent on Task 10.1 completion)

## Task Requirements

Implement complete CI/CD pipeline configuration for automated deployment of the External Metrics Web Service:

### 10.2.1 GitHub Actions Workflow Configuration
**Automated Testing Pipeline**:
- Unit test execution with Jest
- Integration test automation
- Security scanning with OWASP tools
- Code quality checks with SonarQube
- Docker image security scanning

**Multi-Environment Deployment**:
- Staging environment deployment
- Production deployment with approval gates
- Blue-green deployment strategy
- Rollback procedures and automation

### 10.2.2 Container Registry & Image Management
**Docker Image Pipeline**:
- Multi-stage Dockerfile optimization
- Image vulnerability scanning
- Container registry management (AWS ECR)
- Image tagging and versioning strategy
- Base image security updates

### 10.2.3 Kubernetes Deployment Automation
**Deployment Strategy**:
- Helm charts for application deployment
- Environment-specific configuration management
- Database migration automation
- Service mesh configuration (Istio)
- Health checks and readiness probes

## Implementation Specifications

### GitHub Actions Workflow

```yaml
name: External Metrics Service - CI/CD Pipeline

on:
  push:
    branches: [main, develop, external-metrics-service]
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: external-metrics
  EKS_CLUSTER_NAME: metrics-production

jobs:
  # Quality Gates - Testing and Security
  quality-gates:
    runs-on: ubuntu-latest
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
      image-digest: ${{ steps.build.outputs.digest }}
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js 18
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install Dependencies
        run: |
          npm ci
          cd frontend && npm ci

      - name: Run Unit Tests
        run: |
          npm run test:unit
          npm run test:coverage
        env:
          NODE_ENV: test

      - name: Run Integration Tests
        run: npm run test:integration
        env:
          NODE_ENV: test
          DATABASE_URL: postgresql://test:test@localhost:5432/test

      - name: Security Audit
        run: |
          npm audit --audit-level high
          npx retire --exitwith 1

      - name: OWASP ZAP Security Scan
        uses: zaproxy/action-baseline@v0.10.0
        with:
          target: 'http://localhost:3000'

      - name: SonarQube Code Quality
        uses: sonarqube-quality-gate-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

  # Build and Push Docker Images
  build-images:
    needs: quality-gates
    runs-on: ubuntu-latest
    strategy:
      matrix:
        component: [api, frontend, migration]
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Extract Metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}-${{ matrix.component }}
          tags: |
            type=ref,event=branch
            type=ref,event=pr
            type=sha,prefix={{branch}}-
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build and Push Docker Image
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          file: ./docker/${{ matrix.component }}/Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Container Security Scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}-${{ matrix.component }}:${{ github.sha }}
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Upload Trivy Results
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'trivy-results.sarif'

  # Deploy to Staging Environment
  deploy-staging:
    needs: [quality-gates, build-images]
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.24.0'

      - name: Configure kubectl for EKS
        run: |
          aws eks update-kubeconfig --region ${{ env.AWS_REGION }} --name ${{ env.EKS_CLUSTER_NAME }}

      - name: Setup Helm
        uses: azure/setup-helm@v3
        with:
          version: 'v3.12.0'

      - name: Deploy Database Migrations
        run: |
          helm upgrade --install metrics-migration ./helm/migration \
            --namespace metrics-staging \
            --create-namespace \
            --set image.tag=${{ github.sha }} \
            --set environment=staging \
            --wait --timeout=10m

      - name: Deploy Application to Staging
        run: |
          helm upgrade --install metrics-app ./helm/application \
            --namespace metrics-staging \
            --set image.tag=${{ github.sha }} \
            --set environment=staging \
            --set replicas=2 \
            --wait --timeout=15m

      - name: Run E2E Tests on Staging
        run: |
          npm run test:e2e:staging
        env:
          STAGING_URL: https://staging-metrics.fortium.com

  # Deploy to Production (Manual Approval Required)
  deploy-production:
    needs: [quality-gates, build-images, deploy-staging]
    runs-on: ubuntu-latest
    environment: production
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.24.0'

      - name: Configure kubectl for EKS
        run: |
          aws eks update-kubeconfig --region ${{ env.AWS_REGION }} --name ${{ env.EKS_CLUSTER_NAME }}

      - name: Setup Helm
        uses: azure/setup-helm@v3
        with:
          version: 'v3.12.0'

      - name: Blue-Green Deployment - Prepare Green Environment
        run: |
          # Create green deployment
          helm upgrade --install metrics-app-green ./helm/application \
            --namespace metrics-production \
            --set image.tag=${{ github.sha }} \
            --set environment=production \
            --set deployment.color=green \
            --set replicas=3 \
            --wait --timeout=15m

      - name: Health Check - Green Environment
        run: |
          # Wait for green deployment to be healthy
          kubectl wait --for=condition=ready pod -l app=metrics-api,color=green \
            --namespace metrics-production --timeout=300s

      - name: Switch Traffic to Green (Blue-Green Cutover)
        run: |
          # Update service selector to point to green deployment
          kubectl patch service metrics-api-service \
            --namespace metrics-production \
            --patch '{"spec":{"selector":{"color":"green"}}}'

      - name: Verify Production Deployment
        run: |
          # Health checks and smoke tests
          curl -f https://metrics.fortium.com/health
          npm run test:smoke:production

      - name: Cleanup Blue Environment
        run: |
          # Remove old blue deployment after successful cutover
          helm uninstall metrics-app-blue --namespace metrics-production || true

      - name: Notify Deployment Success
        uses: 8398a7/action-slack@v3
        with:
          status: success
          text: 'External Metrics Service successfully deployed to production! 🚀'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

  # Rollback Procedure (Manual Trigger)
  rollback-production:
    runs-on: ubuntu-latest
    environment: production
    if: github.event_name == 'workflow_dispatch'
    steps:
      - name: Rollback to Previous Version
        run: |
          helm rollback metrics-app --namespace metrics-production
          kubectl wait --for=condition=ready pod -l app=metrics-api \
            --namespace metrics-production --timeout=300s
```

### Helm Chart Configuration

```yaml
# helm/application/Chart.yaml
apiVersion: v2
name: external-metrics-service
description: External Metrics Web Service Helm Chart
version: 1.0.0
appVersion: 1.0.0

---
# helm/application/values.yaml
# Default values for external-metrics-service
replicaCount: 3

image:
  repository: 123456789.dkr.ecr.us-east-1.amazonaws.com/external-metrics
  pullPolicy: IfNotPresent
  tag: latest

service:
  type: ClusterIP
  port: 3000
  targetPort: 3000

ingress:
  enabled: true
  className: alb
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/ssl-redirect: '443'
  hosts:
    - host: metrics.fortium.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: metrics-tls
      hosts:
        - metrics.fortium.com

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70
  targetMemoryUtilizationPercentage: 80

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

nodeSelector: {}
tolerations: []
affinity: {}

env:
  NODE_ENV: production
  PORT: 3000

secrets:
  database:
    url: ""
  redis:
    url: ""
  jwt:
    secret: ""
```

### Database Migration Pipeline

```yaml
# helm/migration/templates/job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "migration.fullname" . }}-{{ .Values.image.tag }}
  labels:
    {{- include "migration.labels" . | nindent 4 }}
spec:
  template:
    metadata:
      labels:
        {{- include "migration.selectorLabels" . | nindent 8 }}
    spec:
      restartPolicy: Never
      containers:
      - name: migration
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        command: ["npm", "run", "migrate"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-credentials
              key: url
        - name: NODE_ENV
          value: {{ .Values.environment }}
      backoffLimit: 3
      activeDeadlineSeconds: 600
```

## Expected Deliverables

1. **CI/CD Pipeline Operational**:
   - ✅ GitHub Actions workflow configured
   - ✅ Automated testing and security scanning
   - ✅ Multi-environment deployment automation
   - ✅ Blue-green deployment strategy implemented

2. **Container Management**:
   - ✅ Docker images built and pushed to ECR
   - ✅ Container vulnerability scanning
   - ✅ Image tagging and versioning strategy
   - ✅ Base image security updates automated

3. **Deployment Automation**:
   - ✅ Helm charts for Kubernetes deployment
   - ✅ Database migration automation
   - ✅ Environment-specific configuration
   - ✅ Health checks and monitoring integration

## Quality Gates

- [ ] All pipeline stages pass successfully
- [ ] Security scans show no critical vulnerabilities
- [ ] Automated tests achieve >90% pass rate
- [ ] Blue-green deployment tested and functional
- [ ] Rollback procedures verified
- [ ] Performance benchmarks met in staging

## Handoff Requirements

**From Task 10.1 (Production Setup)**:
- EKS cluster access credentials
- ECR repository URLs
- Database connection strings
- SSL certificates and domain configuration

**To Task 10.3 (Monitoring)**:
- Deployment pipeline success metrics
- Container health check endpoints
- Application performance baselines
- Error logging configuration

**Agent**: Please implement the complete CI/CD pipeline configuration. Focus on automation, security, and reliability. Ensure blue-green deployment strategy is properly tested before production use.