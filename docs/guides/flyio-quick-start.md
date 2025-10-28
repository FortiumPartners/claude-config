# Fly.io Quick Start Guide

**Goal**: Deploy your first application to Fly.io in 15 minutes with infrastructure-developer agent assistance.

**Prerequisites**:
- Claude Code with v3.4.0+ (Fly.io skills package)
- Fly.io account ([sign up free](https://fly.io/app/sign-up))
- `flyctl` CLI installed ([installation guide](https://fly.io/docs/hands-on/install-flyctl/))
- Docker installed (for local testing)

---

## Table of Contents

1. [Prerequisites Setup (5 minutes)](#prerequisites-setup)
2. [First Deployment (10 minutes)](#first-deployment)
3. [Common Deployment Patterns](#common-deployment-patterns)
4. [Auto-Detection Workflow](#auto-detection-workflow)
5. [Troubleshooting](#troubleshooting)

---

## Prerequisites Setup

### 1. Install Fly.io CLI

**macOS (Homebrew)**:
```bash
brew install flyctl
```

**Linux**:
```bash
curl -L https://fly.io/install.sh | sh
```

**Windows (PowerShell)**:
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

**Verify Installation**:
```bash
flyctl version
# Expected: flyctl v0.x.x ...
```

### 2. Authenticate with Fly.io

```bash
flyctl auth login
```

This will open your browser to complete authentication.

**Verify Authentication**:
```bash
flyctl auth whoami
# Expected: Email: your@email.com
```

### 3. Verify Claude Code Installation

```bash
# Check for Fly.io skills
ls ~/.claude/skills/flyio/

# Expected output:
# SKILL.md       REFERENCE.md   examples/
```

If skills are missing, run:
```bash
npx @fortium/ai-mesh install --global
```

---

## First Deployment

### Step 1: Choose a Template (2 minutes)

The infrastructure-developer agent provides 12 production-ready templates:

**Available Templates**:
```
skills/flyio/examples/
├── nodejs-express/          # Express.js REST API
├── nodejs-nextjs/           # Next.js web application
├── nodejs-nestjs/           # NestJS microservice
├── python-django/           # Django web application
├── python-fastapi/          # FastAPI microservice
├── python-flask/            # Flask application
├── go-http-server/          # Go HTTP server
├── ruby-rails/              # Ruby on Rails application
├── elixir-phoenix/          # Phoenix LiveView application
├── static-site/             # Static HTML/CSS/JS
├── database-postgres/       # Fly Postgres setup
└── multi-region/            # Multi-region deployment
```

**For this guide, we'll use Node.js Express** (simplest example).

### Step 2: Get Template Files (1 minute)

**Using infrastructure-developer**:
```
Ask infrastructure-developer:
"Generate a Fly.io deployment configuration for a Node.js Express application with health checks"
```

**Or copy from skills/flyio/examples/nodejs-express/**:
```bash
# Copy template files
cp ~/.claude/skills/flyio/examples/nodejs-express/fly.toml ./
cp ~/.claude/skills/flyio/examples/nodejs-express/Dockerfile ./
cp ~/.claude/skills/flyio/examples/nodejs-express/deploy.sh ./
```

### Step 3: Configure Application (2 minutes)

**Edit fly.toml** (update app name to something unique):

```toml
# fly.toml - Node.js Express Application

app = "my-express-app-12345"  # ← Change this to a unique name
primary_region = "sea"          # ← Change to your nearest region

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1

  [[http_service.checks]]
    grace_period = "10s"
    interval = "30s"
    method = "GET"
    timeout = "5s"
    path = "/health"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256
```

**Key Configuration Options**:
- `app`: Globally unique name (DNS-safe: lowercase, numbers, hyphens)
- `primary_region`: Your nearest region ([regions list](https://fly.io/docs/reference/regions/))
- `internal_port`: Port your app listens on (8080 for Express)
- `min_machines_running`: Set to 0 for scale-to-zero, 1+ for always-on

**Available Regions** (common choices):
- `sea` - Seattle, USA (West Coast)
- `iad` - Ashburn, USA (East Coast)
- `lhr` - London, UK
- `nrt` - Tokyo, Japan
- `syd` - Sydney, Australia

### Step 4: Add Health Check Endpoint (1 minute)

Your Express application needs a `/health` endpoint:

```javascript
// server.js or app.js

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});
```

### Step 5: Set Secrets (if needed) (1 minute)

**For environment variables with sensitive data**:

```bash
# Set secrets (not committed to git)
fly secrets set DATABASE_URL="postgres://..."
fly secrets set API_KEY="your-secret-key"
fly secrets set SESSION_SECRET="random-secure-string"

# List secrets (values hidden)
fly secrets list
```

**Non-sensitive config** goes in `fly.toml` under `[env]`.

### Step 6: Deploy to Fly.io (3 minutes)

**First Deployment**:
```bash
# Launch application (creates app and deploys)
fly launch --copy-config --yes

# Or use the deploy script
chmod +x deploy.sh
./deploy.sh
```

**What happens during deployment**:
1. ✅ Dockerfile is built into a container image
2. ✅ Image is pushed to Fly.io registry
3. ✅ Machines are created in specified regions
4. ✅ Health checks validate deployment
5. ✅ HTTPS certificates are provisioned automatically
6. ✅ Application is live at `https://your-app.fly.dev`

**Expected Output**:
```
==> Building image
...
==> Pushing image to registry
...
==> Creating release
...
==> Monitoring deployment
...
 ✓ Machine xyz has reached its running state
 ✓ Health check on port 8080 is passing

Visit your newly deployed app at https://my-express-app-12345.fly.dev
```

### Step 7: Verify Deployment (2 minutes)

**Check Application Status**:
```bash
# View application status
fly status

# Expected:
# Machines
# ID       STATE   REGION  IMAGE                         CREATED
# xyz123   started sea     my-app:deployment-01          2m ago
```

**Check Logs**:
```bash
# Live logs
fly logs

# Expected:
# [info] Server listening on port 8080
# [info] GET /health 200 - 2ms
```

**Test Application**:
```bash
# Test your deployment
curl https://my-express-app-12345.fly.dev/health

# Expected:
# {"status":"healthy","timestamp":"2025-10-27T..."}
```

**Open in Browser**:
```bash
fly open
# Opens https://your-app.fly.dev in browser
```

---

## Common Deployment Patterns

### Web Application (Next.js, Django, Rails)

**Characteristics**:
- Public HTTPS access required
- Database connection (Fly Postgres or external)
- File uploads to object storage (Tigris)
- Multi-region for low latency

**Template**:
```bash
# Choose appropriate template
infrastructure-developer: "Deploy Next.js application to Fly.io with Postgres database"
```

**Key Configurations**:
- `force_https = true` - HTTPS only
- `min_machines_running = 2` - High availability
- Add Fly Postgres database
- Configure CDN for static assets

### API Service (Express, FastAPI, NestJS)

**Characteristics**:
- RESTful API endpoints
- Database connections
- Background job processing
- Horizontal scaling

**Template**:
```bash
infrastructure-developer: "Deploy FastAPI microservice to Fly.io with Redis cache"
```

**Key Configurations**:
- `auto_stop_machines = true` - Cost optimization
- `max_machines_running = 10` - Scale limit
- Add Redis for caching
- Configure rate limiting

### Background Worker (Celery, Sidekiq)

**Characteristics**:
- No public HTTP access
- Queue processing (Redis, RabbitMQ)
- Scheduled tasks
- Auto-scaling based on queue depth

**Template**:
```bash
infrastructure-developer: "Deploy Celery worker to Fly.io with Redis queue"
```

**Key Configurations**:
- Remove `[http_service]` (no HTTP)
- Use `[processes]` for multiple worker types
- Add health check for worker liveness
- Configure auto-scaling

### Multi-Region Deployment

**Characteristics**:
- Global traffic distribution
- Regional data compliance (GDPR)
- Failover and high availability
- Low-latency access worldwide

**Template**:
```bash
infrastructure-developer: "Deploy application to Fly.io across 3 regions with failover"
```

**Key Configurations**:
```toml
primary_region = "sea"  # West Coast USA

# Deploy to multiple regions
fly scale count 2 --region sea  # Seattle
fly scale count 2 --region iad  # Virginia
fly scale count 2 --region lhr  # London
```

---

## Auto-Detection Workflow

The infrastructure-developer agent **automatically detects Fly.io projects** and loads appropriate skills.

### How Auto-Detection Works

**Detection Signals** (confidence scoring):
1. **fly.toml file** (weight: 0.7) - Primary signal
2. **Fly.io CLI commands** in scripts (weight: 0.3) - Secondary signal
3. **Fly.io domains** in config files (weight: 0.2) - Tertiary signal
4. **Fly.io Dockerfile patterns** (weight: 0.1) - Quaternary signal

**Confidence Calculation**:
- Detection triggers when confidence ≥ 70%
- Multi-signal boost: +10% for 3+ signals
- **Example**: `fly.toml` (70%) + CLI commands (30%) = 100% + 10% boost

### Detection Examples

**Scenario 1: New Fly.io Project**
```
Project has: fly.toml
Confidence: 80% (70% + 10% boost for file)
Result: ✅ Fly.io skills auto-loaded
```

**Scenario 2: Deployment Scripts Only**
```
Project has: deploy.sh with "fly deploy" commands
Confidence: 60% (30% + 20% + 10% boost)
Result: ❌ Below 70% threshold, skills not loaded
```

**Scenario 3: Complete Fly.io Project**
```
Project has: fly.toml + deploy.sh + Dockerfile with flyctl
Confidence: 100% (70% + 30% + 10% + 10% boost)
Result: ✅ Fly.io skills auto-loaded with high confidence
```

### Skill Loading Behavior

**When Fly.io is detected (confidence ≥ 70%)**:
1. **SKILL.md auto-loads** (<100ms) - Quick reference available immediately
2. **REFERENCE.md loads on-demand** - Full guide when needed
3. **Example templates accessible** - 12 production templates available
4. **Platform recommendations enabled** - Decision support for Fly.io vs K8s vs AWS

**Accessing Skills**:
```
# Auto-detected (no action needed)
infrastructure-developer: "Deploy my application to Fly.io"

# Explicit skill request
infrastructure-developer: "Show me Fly.io deployment options"

# Template access
infrastructure-developer: "Use Fly.io Django template"
```

---

## Troubleshooting

### Deployment Errors

#### Error: "App name already taken"
```
Error: "my-app" is already taken
```

**Solution**:
```bash
# Choose a unique app name in fly.toml
app = "my-app-xyz-12345"  # Add random suffix

# Check availability
fly apps list | grep my-app
```

#### Error: "Health check failing"
```
Error: Health check on port 8080 failed
```

**Diagnosis**:
```bash
# Check logs for errors
fly logs

# Common causes:
# 1. Application not listening on PORT environment variable
# 2. Health check endpoint missing or returning error
# 3. Internal port mismatch with application port
```

**Solution**:
```javascript
// Ensure app listens on correct port
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});

// Ensure health check endpoint exists
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});
```

#### Error: "Build failed"
```
Error: Build failed at step X
```

**Diagnosis**:
```bash
# Check Dockerfile syntax
docker build -t test .

# Verify dependencies
docker run -it test /bin/sh
```

**Solution**:
- Fix Dockerfile syntax errors
- Ensure all dependencies are installed
- Use appropriate base image
- Check build context (`.dockerignore`)

### Networking Issues

#### Error: "Cannot connect to database"
```
Error: ECONNREFUSED postgres://...
```

**Solution**:
```bash
# For Fly Postgres
fly postgres attach <database-name>

# For external database
fly secrets set DATABASE_URL="postgres://external-db..."

# Verify connection from machine
fly ssh console
> curl postgres://...
```

#### Error: "DNS resolution failed"
```
Error: Cannot resolve hostname
```

**Solution**:
```bash
# Check Fly.io DNS
dig my-app.fly.dev

# Verify certificate
curl -v https://my-app.fly.dev

# Force HTTPS
# In fly.toml:
force_https = true
```

### Secret Errors

#### Error: "Environment variable not set"
```
Error: DATABASE_URL is not defined
```

**Solution**:
```bash
# Set secret
fly secrets set DATABASE_URL="postgres://..."

# Verify (value hidden)
fly secrets list

# For deployment, secrets auto-inject
# No need to modify fly.toml
```

#### Error: "Secret not updating"
```
Secret set but application still uses old value
```

**Solution**:
```bash
# Restart machines to pick up new secrets
fly scale count 0  # Stop all
fly scale count 1  # Start with new secrets

# Or deploy new release
fly deploy --no-cache
```

### Performance Issues

#### Issue: "Slow response times"
```
Application responds slowly (>500ms)
```

**Diagnosis**:
```bash
# Check machine resources
fly status

# View metrics
fly dashboard

# Check logs for slow queries
fly logs | grep "slow"
```

**Solution**:
```toml
# Scale up machine resources
[[vm]]
  cpu_kind = "shared"
  cpus = 2        # Increase CPUs
  memory_mb = 512 # Increase memory
```

```bash
# Add more machines for horizontal scaling
fly scale count 3

# Deploy to multiple regions
fly regions add lhr iad nrt
```

---

## Next Steps

### Learn More

- **Platform Selection**: See [Platform Selection Guidelines](./platform-selection.md) for Fly.io vs K8s vs AWS decision framework
- **Advanced Patterns**: Check `skills/flyio/REFERENCE.md` for production deployment strategies
- **API Documentation**: See [Fly.io Skills API](../api/flyio-skills-api.md) for integration details
- **Troubleshooting**: See [Fly.io Troubleshooting Guide](./flyio-troubleshooting.md) for comprehensive issue resolution

### Example Projects

**Explore production templates**:
```bash
# List all templates
ls ~/.claude/skills/flyio/examples/

# View template details
cat ~/.claude/skills/flyio/examples/nodejs-express/README.md
```

**Try different frameworks**:
- Python Django with Postgres: `python-django/`
- Go microservice: `go-http-server/`
- Ruby on Rails: `ruby-rails/`
- Phoenix LiveView: `elixir-phoenix/`

### Get Help

- **infrastructure-developer agent**: Ask for Fly.io deployment assistance
- **Fly.io Documentation**: [https://fly.io/docs](https://fly.io/docs)
- **Fly.io Community**: [https://community.fly.io](https://community.fly.io)
- **Support Channels**: Check `docs/guides/platform-selection.md` for decision support

---

**Congratulations!** You've successfully deployed your first application to Fly.io in 15 minutes. 🎉

The infrastructure-developer agent is now ready to assist with:
- Multi-environment deployments (dev, staging, production)
- Database integration (Fly Postgres, external databases)
- Scaling strategies (horizontal, vertical, multi-region)
- Security hardening (secrets, networking, compliance)
- Cost optimization (auto-stop, right-sizing, reserved capacity)
