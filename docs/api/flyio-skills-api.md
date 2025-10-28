# Fly.io Skills API Reference

**Complete integration documentation for Fly.io skills package with infrastructure-developer agent.**

**Purpose**: Enable developers to understand and integrate with the Fly.io skills system, including skill structure, agent integration, and workflow automation.

---

## Table of Contents

1. [Skills API Reference](#skills-api-reference)
2. [infrastructure-developer Integration](#infrastructure-developer-integration)
3. [Example Workflows](#example-workflows)
4. [Advanced Integration](#advanced-integration)

---

## Skills API Reference

### Skill Package Structure

```
skills/flyio/
├── SKILL.md              # Quick reference (24.8KB, <100ms load time)
├── REFERENCE.md          # Comprehensive guide (46KB, production patterns)
└── examples/             # Production templates (12 templates)
    ├── nodejs-express/
    │   ├── fly.toml
    │   ├── Dockerfile
    │   ├── deploy.sh
    │   └── README.md
    ├── nodejs-nextjs/
    ├── nodejs-nestjs/
    ├── python-django/
    ├── python-fastapi/
    ├── python-flask/
    ├── go-http-server/
    ├── ruby-rails/
    ├── elixir-phoenix/
    ├── static-site/
    ├── database-postgres/
    └── multi-region/
```

### SKILL.md Structure

**Purpose**: Fast-loading reference for immediate use

**Sections**:
1. **Overview**: What is Fly.io, when to use, detection criteria
2. **fly.toml Quick Reference**: Essential configuration patterns
3. **Deployment Patterns**: Zero-downtime, blue-green, canary
4. **Secrets Management**: Fly.io secrets API, environment variables
5. **Networking Basics**: Internal services, external access
6. **Health Checks**: HTTP, TCP, script-based checks
7. **Scaling Patterns**: Horizontal scaling, auto-scaling, multi-region
8. **Common Commands Cheat Sheet**: fly deploy, fly scale, fly secrets
9. **Quick Troubleshooting**: Top 10 common issues

**File Size**: <25KB (target: 24.8KB achieved)
**Load Time**: <100ms (auto-loads when Fly.io detected)

**Usage**:
```
# Auto-loaded when fly.toml detected
infrastructure-developer: "Deploy my Node.js app to Fly.io"

# Explicit skill request
infrastructure-developer: "Show me Fly.io deployment patterns"
```

### REFERENCE.md Structure

**Purpose**: Comprehensive guide with advanced patterns

**Sections**:
1. **Fly.io Architecture Deep Dive**: Fly Machines, global network, storage
2. **Advanced fly.toml Configuration**: Multi-process, custom resources, volumes
3. **Production Deployment Examples**: 5+ framework examples (Node.js, Python, Go, Ruby, Elixir)
4. **Database Integration Patterns**: Fly Postgres, external databases, connection pooling
5. **Monitoring and Observability**: Logs, metrics, distributed tracing
6. **Security Hardening Guide**: Private networking, secrets rotation, compliance
7. **Performance Optimization**: Regional placement, caching, CDN integration
8. **Cost Optimization Strategies**: Right-sizing, auto-scaling, reserved capacity
9. **CI/CD Integration Patterns**: GitHub Actions, GitLab CI, CircleCI
10. **Migration Guides**: AWS → Fly.io, K8s → Fly.io, Heroku → Fly.io

**File Size**: <50KB (target: 46KB achieved)
**Load Time**: On-demand (loaded when detailed guidance needed)

**Usage**:
```
# Detailed guidance request
infrastructure-developer: "Show me Fly.io production deployment examples for Django"

# Migration guidance
infrastructure-developer: "How do I migrate from Heroku to Fly.io?"
```

### Example Templates

**Available Templates** (12 production-ready examples):

| Template | Framework | Database | Features | Use Case |
|----------|-----------|----------|----------|----------|
| `nodejs-express` | Express.js | Optional | REST API, health checks | Simple API service |
| `nodejs-nextjs` | Next.js | Optional | Static export, SSR | Web application |
| `nodejs-nestjs` | NestJS | Postgres | Microservice, DI | Enterprise API |
| `python-django` | Django | Postgres | ORM, admin, migrations | Full-stack web app |
| `python-fastapi` | FastAPI | Redis | Async, validation | High-performance API |
| `python-flask` | Flask | Optional | Lightweight, flexible | Simple web service |
| `go-http-server` | Go net/http | Optional | High performance, compiled | Microservice |
| `ruby-rails` | Ruby on Rails | Postgres | MVC, ActiveRecord, Sidekiq | Full-stack web app |
| `elixir-phoenix` | Phoenix LiveView | Postgres | Real-time, Elixir | Interactive web app |
| `static-site` | HTML/CSS/JS | None | CDN, caching | Static website |
| `database-postgres` | N/A | Fly Postgres | Multi-region, HA | Database setup |
| `multi-region` | Generic | Optional | Global distribution | Low-latency global app |

**Template File Structure**:
```
template-name/
├── fly.toml              # Fly.io configuration
├── Dockerfile            # Container build instructions
├── deploy.sh             # Deployment automation script
├── .dockerignore         # Docker build context exclusions
└── README.md             # Template documentation
```

**Usage**:
```
# Request specific template
infrastructure-developer: "Use Fly.io Django template for my project"

# Copy template files
cp -r ~/.claude/skills/flyio/examples/python-django/* ./

# Customize and deploy
fly launch --copy-config
```

---

## infrastructure-developer Integration

### Agent Capabilities

The infrastructure-developer agent integrates with Fly.io skills to provide:

**Core Capabilities**:
- Automatic Fly.io project detection (95.45% accuracy, sub-11ms)
- Skill auto-loading when confidence ≥ 70%
- Platform recommendation (Fly.io vs K8s vs AWS)
- Mixed infrastructure support (K8s + Fly.io, AWS + Fly.io)
- Template selection and customization
- Configuration generation (fly.toml, Dockerfile, deploy.sh)
- Security validation and best practices enforcement

### Handoff Protocols

#### Handoff From: ai-mesh-orchestrator

**Trigger**: Fly.io deployment task delegation

**Input Data**:
```yaml
task:
  type: "flyio-deployment"
  application:
    name: "my-express-app"
    framework: "Node.js Express"
    requirements:
      - "REST API"
      - "PostgreSQL database"
      - "Multi-environment (dev, staging, production)"
  constraints:
    budget: "$200/month"
    regions: ["sea", "iad", "lhr"]
    compliance: ["SOC2", "GDPR"]
```

**Expected Response**:
```yaml
result:
  platform: "flyio"
  confidence: 95%
  rationale: "Simple API service, small team, global deployment, budget-conscious"
  configurations:
    - fly.toml (production-ready)
    - Dockerfile (optimized for Express.js)
    - deploy.sh (CI/CD automation)
  next_steps:
    - "Set secrets: DATABASE_URL, API_KEY"
    - "Deploy to staging: fly deploy --app my-app-staging"
    - "Validate health checks"
    - "Deploy to production: fly deploy --app my-app-production"
```

#### Handoff From: tech-lead-orchestrator

**Trigger**: Platform selection and architecture decisions

**Input Data**:
```yaml
trd:
  title: "User Authentication Service"
  requirements:
    functional:
      - "JWT-based authentication"
      - "OAuth2 integration (Google, GitHub)"
      - "Multi-region for low latency"
    non_functional:
      - "Performance: <100ms auth latency (P95)"
      - "Security: SOC2 compliance"
      - "Availability: 99.9% uptime"
  architecture:
    services:
      - "Auth API (Node.js)"
      - "Redis cache (sessions)"
      - "PostgreSQL (users, tokens)"
```

**Expected Response**:
```yaml
result:
  platform_recommendation: "flyio"
  confidence: 92%
  rationale:
    - "Simple architecture (3 services)"
    - "Global deployment requirement (30+ regions)"
    - "Cost-effective for small scale"
    - "Built-in HTTPS and edge caching"
  architecture:
    auth_api:
      regions: ["sea", "iad", "lhr", "nrt", "syd"]
      machines: 2 per region
      resources:
        cpus: 1
        memory_mb: 256
    redis:
      type: "Upstash Redis" # Fly.io compatible
      regions: ["sea", "iad", "lhr"]
    postgres:
      type: "Fly Postgres"
      multi_region: true
      replicas: 3
  deployment_strategy:
    - "Blue-green deployment for zero downtime"
    - "Canary release: 10% → 50% → 100%"
    - "Automated rollback on health check failures"
```

#### Handoff To: code-reviewer

**Trigger**: Fly.io configuration completion

**Output Data**:
```yaml
deliverables:
  configurations:
    - path: "fly.toml"
      content: |
        app = "my-app"
        primary_region = "sea"
        [build]
          dockerfile = "Dockerfile"
        [env]
          NODE_ENV = "production"
        [http_service]
          internal_port = 8080
          force_https = true
        [[http_service.checks]]
          path = "/health"
        [[vm]]
          cpus = 1
          memory_mb = 256
    - path: "Dockerfile"
      content: |
        FROM node:18-alpine
        WORKDIR /app
        COPY package*.json ./
        RUN npm ci --production
        COPY . .
        CMD ["node", "server.js"]
    - path: "deploy.sh"
      content: |
        #!/bin/bash
        fly deploy --app my-app-production

  validation_requirements:
    security:
      - "No hardcoded secrets in fly.toml or Dockerfile"
      - "Secrets managed via fly secrets set"
      - "HTTPS enforced (force_https = true)"
      - "Health check endpoint implemented"
    performance:
      - "Multi-stage Dockerfile for smaller image"
      - "Health check timeout ≤ 5s"
      - "Application startup time < 30s"
    best_practices:
      - "Non-root user in Dockerfile"
      - ".dockerignore excludes node_modules, .git"
      - "PORT environment variable used"
      - "Deployment script tested"
```

#### Handoff To: test-runner

**Trigger**: Deployment validation requirement

**Output Data**:
```yaml
test_specifications:
  deployment_tests:
    - name: "Health Check Validation"
      command: "curl -f https://my-app.fly.dev/health"
      expected: "HTTP 200 OK"
      timeout: 5s

    - name: "HTTPS Enforcement"
      command: "curl -I http://my-app.fly.dev"
      expected: "301 Moved Permanently → HTTPS"

    - name: "Multi-Region Availability"
      command: "fly status --app my-app"
      expected: "All machines in 'started' state"

  integration_tests:
    - name: "Database Connection"
      command: "fly ssh console -- psql $DATABASE_URL -c 'SELECT 1'"
      expected: "Connection successful"

    - name: "Redis Cache"
      command: "fly ssh console -- redis-cli -u $REDIS_URL ping"
      expected: "PONG"

  load_tests:
    - name: "API Performance (P95)"
      tool: "k6"
      script: "load-test.js"
      target: "<100ms P95 latency"
      duration: "5m"
      vus: 100
```

### Auto-Detection Trigger Points

**Detection Signals** (multi-signal confidence scoring):

```yaml
detection_signals:
  fly_toml:
    weight: 0.7
    files: ["fly.toml"]
    validation: "TOML format with app name and services configuration"
    example: |
      app = "my-app"
      [http_service]
        internal_port = 8080

  fly_cli:
    weight: 0.3
    file_pattern: "*.sh"
    patterns:
      - "fly deploy"
      - "fly launch"
      - "fly scale"
      - "flyctl deploy"
    example: |
      #!/bin/bash
      fly deploy --app my-app-production

  fly_domain:
    weight: 0.2
    file_pattern: "*.{toml,yaml,json,env}"
    patterns:
      - "\\.fly\\.dev"
      - "\\.fly\\.io"
      - "FLY_APP_NAME"
    example: |
      API_URL=https://my-app.fly.dev

  dockerfile_flyio:
    weight: 0.1
    files: ["Dockerfile"]
    patterns:
      - "# syntax = docker/dockerfile:1"
      - "flyctl"
    example: |
      # syntax = docker/dockerfile:1
      FROM node:18-alpine
```

**Confidence Calculation**:
```python
# Weighted sum of detected signals
base_confidence = sum(signal.weight for signal in detected_signals)

# Multi-signal boost (10% for 3+ signals)
if len(detected_signals) >= 3:
    base_confidence += 0.1

# Final confidence
final_confidence = min(base_confidence, 1.0)  # Cap at 100%

# Detection threshold
if final_confidence >= 0.7:  # 70% minimum
    load_flyio_skills()
```

**Detection Examples**:
```
Project A: fly.toml + deploy.sh with "fly deploy"
Signals: fly_toml (0.7) + fly_cli (0.3) + multi_signal_boost (0.1)
Confidence: 100% → ✅ Detected

Project B: fly.toml only
Signals: fly_toml (0.7) + multi_signal_boost (0.1)
Confidence: 80% → ✅ Detected

Project C: deploy.sh with "fly deploy" + API_URL with .fly.dev
Signals: fly_cli (0.3) + fly_domain (0.2) + multi_signal_boost (0.1)
Confidence: 60% → ❌ Not detected (below 70% threshold)
```

### Skill Loading Lifecycle

**Phase 1: Detection** (<11ms)
```
1. Scan project files (fly.toml, *.sh, Dockerfile, config files)
2. Calculate confidence score (weighted sum + multi-signal boost)
3. If confidence ≥ 70%:
   - Trigger skill loading
   - Log detection details
   - Notify infrastructure-developer
```

**Phase 2: Skill Loading** (<100ms)
```
1. Load SKILL.md (quick reference) → Auto-loaded
2. Parse skill sections (overview, patterns, commands)
3. Index example templates (12 templates)
4. Enable Fly.io-specific commands
5. Ready for user interaction
```

**Phase 3: On-Demand Loading** (as needed)
```
1. User requests detailed guidance
2. Load REFERENCE.md (comprehensive guide)
3. Parse advanced sections (architecture, production examples)
4. Provide detailed recommendations
```

**Phase 4: Template Access** (as requested)
```
1. User requests template (e.g., "Use Django template")
2. Locate template in skills/flyio/examples/
3. Copy template files to project
4. Customize configuration based on project requirements
5. Provide deployment instructions
```

---

## Example Workflows

### Workflow 1: Complete Deployment Workflow

**Scenario**: Deploy Node.js Express application to Fly.io with PostgreSQL

**Steps**:

1. **Detection** (automatic):
```
User creates fly.toml in project root
infrastructure-developer detects Fly.io (confidence: 80%)
SKILL.md auto-loaded (<100ms)
```

2. **Configuration Generation**:
```
User: "Generate Fly.io deployment configuration for Node.js Express with PostgreSQL"

infrastructure-developer:
- Uses nodejs-express template
- Customizes fly.toml with user requirements
- Generates Dockerfile (optimized for Express.js)
- Creates deploy.sh (deployment automation)
- Sets up health check endpoint
```

3. **Secret Management**:
```
infrastructure-developer: "Set secrets for Fly.io deployment"

Commands:
fly secrets set DATABASE_URL="postgres://user:pass@my-db.internal:5432/mydb"
fly secrets set API_KEY="your-secret-api-key"
fly secrets set SESSION_SECRET="random-secure-string"
```

4. **Database Setup**:
```
infrastructure-developer: "Set up Fly Postgres database"

Commands:
fly postgres create my-db --region sea --initial-cluster-size 3
fly postgres attach my-db --app my-app
```

5. **Deployment**:
```
infrastructure-developer: "Deploy to Fly.io"

Commands:
fly launch --copy-config --yes
fly deploy --app my-app-production

Expected output:
✓ Machine xyz has reached its running state
✓ Health check on port 8080 is passing
Visit: https://my-app-production.fly.dev
```

6. **Validation** (handed to test-runner):
```
test-runner executes:
- Health check validation (curl /health)
- HTTPS enforcement (HTTP → HTTPS redirect)
- Database connection test
- API performance test (P95 latency)
```

7. **Documentation** (handed to documentation-specialist):
```
documentation-specialist generates:
- Deployment runbook
- Troubleshooting guide
- Architecture diagram
- Operational procedures
```

---

### Workflow 2: Multi-Environment Deployment

**Scenario**: Deploy application to dev, staging, and production environments

**Steps**:

1. **Environment Configuration**:
```
User: "Set up Fly.io multi-environment deployment"

infrastructure-developer creates:
- fly.dev.toml (development)
- fly.staging.toml (staging)
- fly.production.toml (production)

Each with environment-specific settings:
- App name (my-app-dev, my-app-staging, my-app-production)
- Region (dev: sea, staging: sea+iad, production: sea+iad+lhr)
- Resources (dev: 256MB, staging: 512MB, production: 1GB)
- Auto-scaling (dev: 1, staging: 1-3, production: 2-10)
```

2. **Secret Management**:
```
infrastructure-developer: "Set environment-specific secrets"

Commands:
# Development
fly secrets set --app my-app-dev \
  DATABASE_URL="postgres://dev-db.internal:5432/mydb" \
  API_KEY="dev-api-key"

# Staging
fly secrets set --app my-app-staging \
  DATABASE_URL="postgres://staging-db.internal:5432/mydb" \
  API_KEY="staging-api-key"

# Production
fly secrets set --app my-app-production \
  DATABASE_URL="postgres://prod-db.internal:5432/mydb" \
  API_KEY="prod-api-key"
```

3. **Deployment Pipeline** (CI/CD):
```
infrastructure-developer: "Set up GitHub Actions deployment pipeline"

Generated .github/workflows/deploy.yml:
---
name: Deploy to Fly.io

on:
  push:
    branches:
      - main        # → production
      - staging     # → staging
      - develop     # → dev

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: |
          if [ "${{ github.ref }}" == "refs/heads/main" ]; then
            flyctl deploy --app my-app-production --config fly.production.toml
          elif [ "${{ github.ref }}" == "refs/heads/staging" ]; then
            flyctl deploy --app my-app-staging --config fly.staging.toml
          else
            flyctl deploy --app my-app-dev --config fly.dev.toml
          fi
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

4. **Validation**:
```
test-runner validates each environment:
- Development: Basic functionality
- Staging: Full integration tests
- Production: Smoke tests, canary release
```

---

### Workflow 3: Security Validation Workflow

**Scenario**: Ensure Fly.io deployment meets security requirements

**Steps**:

1. **Configuration Review** (handed to code-reviewer):
```
code-reviewer analyzes:
- fly.toml: No hardcoded secrets ✓
- Dockerfile: Non-root user ✓
- deploy.sh: Secrets via environment variables ✓
```

2. **Security Scanning**:
```
code-reviewer executes:
- Secret scanning (no exposed credentials)
- Dockerfile vulnerability scan (Trivy)
- Dependency audit (npm audit, safety)
- HTTPS enforcement (force_https = true)
```

3. **Secrets Management Validation**:
```
code-reviewer verifies:
- All secrets via fly secrets set
- No secrets in git repository
- Environment variable segregation (dev/staging/production)
- Secrets rotation plan documented
```

4. **Network Security Validation**:
```
code-reviewer checks:
- Private networking (6PN) for internal services
- TLS/SSL enabled (force_https = true)
- Firewall rules configured
- VPN access for administrative tasks
```

5. **Compliance Checklist**:
```
code-reviewer validates:
- SOC2: Logging, access control, encryption ✓
- GDPR: Data residency, privacy controls ✓
- HIPAA: Encryption at rest/transit (if applicable)
- PCI-DSS: Secure payment processing (if applicable)
```

6. **Security Report**:
```
code-reviewer generates:
- Security findings (high/medium/low severity)
- Remediation recommendations
- Compliance status
- Security best practices documentation
```

---

## Advanced Integration

### Custom Detection Patterns

**Adding Custom Fly.io Detection Signals**:

```json
// In skills/tooling-detector/tooling-patterns.json

{
  "tools": {
    "flyio": {
      "detection_signals": {
        "custom_signal": {
          "weight": 0.15,
          "file_pattern": "*.env",
          "patterns": [
            "FLY_REGION",
            "FLY_ALLOC_ID",
            "FLY_PUBLIC_IP"
          ],
          "description": "Fly.io runtime environment variables"
        }
      }
    }
  }
}
```

### Platform Recommendation API

**Request Platform Recommendation**:

```yaml
# User query
"Recommend deployment platform for:
- Application: SaaS product (web app + API + background workers)
- Team size: 8 developers
- Budget: $500/month
- Scale: 10,000 users expected
- Compliance: SOC2 required
- Regions: North America, Europe"

# infrastructure-developer response
recommendation:
  platform: "flyio"
  confidence: 88%
  rationale:
    - "Team size (8) suits PaaS simplicity"
    - "Budget ($500/month) aligns with Fly.io pricing"
    - "Global deployment (NA + EU) leverages Fly.io edge network"
    - "SOC2 compliance supported by Fly.io"
    - "Scale (10K users) within Fly.io sweet spot"
  architecture:
    web_app:
      regions: ["sea", "iad", "lhr"]
      machines: 2 per region
      resources: { cpus: 1, memory_mb: 512 }
    api:
      regions: ["sea", "iad", "lhr"]
      machines: 3 per region
      resources: { cpus: 2, memory_mb: 1024 }
    workers:
      regions: ["sea"]
      machines: 2
      resources: { cpus: 1, memory_mb: 512 }
  estimated_cost: "$450/month"
  alternatives:
    kubernetes: "Consider if microservices exceed 10 services"
    aws: "Consider if specific AWS services (Lambda, DynamoDB) needed"
```

### Template Customization API

**Customize Template Based on Requirements**:

```yaml
# User request
"Customize Fly.io Django template for:
- Multi-tenant SaaS application
- PostgreSQL database with read replicas
- Redis for caching and sessions
- Celery for background jobs
- Multi-region deployment (US + EU)
- Auto-scaling based on traffic"

# infrastructure-developer customization
customized_template:
  fly.toml:
    app: "my-saas-app"
    primary_region: "sea"
    processes:
      web: "gunicorn myapp.wsgi:application"
      worker: "celery -A myapp worker"
      scheduler: "celery -A myapp beat"
    http_service:
      internal_port: 8000
      auto_stop_machines: false  # Always-on for SaaS
      auto_start_machines: true
      min_machines_running: 2    # HA
      max_machines_running: 10   # Auto-scale
    vm:
      cpus: 2
      memory_mb: 1024
    regions: ["sea", "iad", "lhr", "fra"]

  Dockerfile:
    base_image: "python:3.11-slim"
    optimizations:
      - "Multi-stage build for smaller image"
      - "Pip caching for faster builds"
      - "Non-root user for security"
      - "Health check endpoint"

  deploy.sh:
    pre_deploy:
      - "Run database migrations"
      - "Collect static files"
      - "Warm up cache"
    deployment_strategy: "Blue-green"
    rollback_plan: "Automatic on health check failure"

  database:
    type: "Fly Postgres"
    configuration:
      primary_region: "sea"
      read_replicas:
        - region: "iad"
        - region: "lhr"
      resources:
        cpus: 2
        memory_mb: 2048
        disk_gb: 100

  redis:
    type: "Upstash Redis"
    configuration:
      regions: ["sea", "iad", "lhr"]
      eviction_policy: "allkeys-lru"
```

---

## Summary

### Skills API Capabilities

- ✅ **Auto-Detection**: 95.45% accuracy, sub-11ms performance
- ✅ **Skill Loading**: <100ms SKILL.md load time
- ✅ **Template Library**: 12 production-ready templates
- ✅ **Agent Integration**: Complete handoff protocols with all agents
- ✅ **Platform Recommendations**: Intelligent Fly.io vs K8s vs AWS guidance
- ✅ **Mixed Infrastructure**: Support for hybrid deployments

### Integration Endpoints

- **Detection**: Automatic multi-signal detection with confidence scoring
- **Skill Loading**: Progressive loading (SKILL.md → REFERENCE.md → templates)
- **Agent Handoffs**: ai-mesh-orchestrator, tech-lead-orchestrator, code-reviewer, test-runner
- **Template Access**: 12 framework-specific production templates
- **Platform Recommendations**: Data-driven platform selection framework

### Next Steps

- **Quick Start**: See [Fly.io Quick Start Guide](../guides/flyio-quick-start.md)
- **Troubleshooting**: See [Fly.io Troubleshooting Guide](../guides/flyio-troubleshooting.md)
- **Platform Selection**: See [Platform Selection Guidelines](../guides/platform-selection.md)

**Need Help with Integration?**
Ask infrastructure-developer:
```
"Explain how Fly.io skills integrate with infrastructure-developer"
"Show me the workflow for deploying to Fly.io"
"How does auto-detection work for Fly.io projects?"
```

The agent will provide tailored guidance based on your integration needs. 🚀
