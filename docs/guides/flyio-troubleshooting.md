# Fly.io Troubleshooting Guide

**Comprehensive issue diagnosis and resolution for common Fly.io deployment problems.**

**Purpose**: Enable self-service troubleshooting with step-by-step diagnosis and solutions for the top 20 Fly.io issues.

---

## Table of Contents

1. [Deployment Errors](#deployment-errors)
2. [Performance Issues](#performance-issues)
3. [Security Issues](#security-issues)
4. [Detection Issues](#detection-issues)
5. [Quick Reference](#quick-reference)

---

## Deployment Errors

### 1. App Name Already Taken

**Symptom**:
```
Error: App name "my-app" is already taken
```

**Diagnosis**:
```bash
# Check app name availability
fly apps list | grep my-app

# Common cause: App name not globally unique
```

**Solution**:
```toml
# In fly.toml, choose a unique name
app = "my-app-xyz-12345"  # Add random suffix or company prefix

# Or let Fly.io generate a name
fly launch --generate-name
```

**Prevention**:
- Use company/project prefix: `companyname-projectname-env`
- Add random suffix: `my-app-abc123`
- Check availability before deployment

---

### 2. Health Check Failing

**Symptom**:
```
Error: Health check on port 8080 failed
Machine xyz failed to reach "started" state
```

**Diagnosis**:
```bash
# Check application logs
fly logs

# Common errors:
# - "Application not listening on port 8080"
# - "Health endpoint /health returned 404"
# - "Connection refused"

# Verify health check configuration
grep -A 5 "http_checks" fly.toml
```

**Solution**:

**Issue 1: Application Not Listening on Correct Port**
```javascript
// Node.js - INCORRECT
app.listen(3000);  // ❌ Hardcoded port

// Node.js - CORRECT
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
```

```python
# Python (Flask) - INCORRECT
app.run(port=5000)  # ❌ Hardcoded port

# Python (Flask) - CORRECT
import os
port = int(os.getenv('PORT', 8080))
app.run(host='0.0.0.0', port=port)
```

**Issue 2: Health Endpoint Missing**
```javascript
// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});
```

**Issue 3: Internal Port Mismatch**
```toml
# In fly.toml, ensure internal_port matches application port
[http_service]
  internal_port = 8080  # Must match PORT in application
```

**Prevention**:
- Always use `PORT` environment variable
- Listen on `0.0.0.0` (not `localhost`)
- Implement `/health` endpoint
- Test locally: `docker run -p 8080:8080 my-app`

---

### 3. Build Failed

**Symptom**:
```
Error: Build failed at step 5/10
ERROR: failed to solve: process "/bin/sh -c npm install" did not complete successfully
```

**Diagnosis**:
```bash
# Test Dockerfile locally
docker build -t test-build .

# Check build logs for specific error
fly logs --image

# Common causes:
# - Missing dependencies
# - Incorrect Dockerfile syntax
# - Build context issues (.dockerignore)
```

**Solution**:

**Issue 1: Missing Dependencies**
```dockerfile
# INCORRECT - Missing build tools
FROM node:18-alpine
COPY . .
RUN npm install  # ❌ May fail on native modules

# CORRECT - Install build tools
FROM node:18-alpine
RUN apk add --no-cache python3 make g++  # For native modules
COPY package*.json ./
RUN npm ci --production
COPY . .
```

**Issue 2: Large Build Context**
```bash
# Create .dockerignore to exclude unnecessary files
cat > .dockerignore <<EOF
node_modules
.git
.env
*.log
coverage
.next
EOF
```

**Issue 3: Multi-Stage Build Optimization**
```dockerfile
# Stage 1: Build
FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/server.js"]
```

**Prevention**:
- Test builds locally before deploying
- Use `.dockerignore` to reduce context size
- Optimize with multi-stage builds
- Cache dependencies (COPY package.json before COPY .)

---

### 4. Secrets Not Loading

**Symptom**:
```
Error: DATABASE_URL is not defined
Application crashes: "Missing environment variable"
```

**Diagnosis**:
```bash
# List secrets (values hidden)
fly secrets list

# Expected output:
# NAME          DIGEST    CREATED AT
# DATABASE_URL  abc123... 2025-10-27T...

# Check application logs
fly logs | grep "DATABASE_URL"
```

**Solution**:

**Issue 1: Secret Not Set**
```bash
# Set secret
fly secrets set DATABASE_URL="postgres://user:pass@host:5432/db"

# Restart to pick up secret
fly deploy --no-cache
```

**Issue 2: Secret Name Mismatch**
```bash
# Application expects DATABASE_URL
# Secret set as DB_URL ❌

# Check secret names match application code
fly secrets list
```

**Issue 3: Machines Not Restarted**
```bash
# Old machines may not have new secrets
fly scale count 0  # Stop all machines
fly scale count 1  # Start with new secrets
```

**Prevention**:
- Set secrets before first deployment
- Use consistent naming (DATABASE_URL, API_KEY, etc.)
- Document required secrets in README
- Validate secrets in health check

---

### 5. DNS Resolution Failed

**Symptom**:
```
Error: Cannot resolve hostname my-app.fly.dev
curl: (6) Could not resolve host: my-app.fly.dev
```

**Diagnosis**:
```bash
# Check DNS propagation
dig my-app.fly.dev

# Expected output:
# my-app.fly.dev. 300 IN A 66.241.125.123

# Verify app is deployed
fly status

# Check certificate
curl -v https://my-app.fly.dev
```

**Solution**:

**Issue 1: DNS Not Propagated**
```bash
# Wait 5-10 minutes for DNS propagation
dig my-app.fly.dev

# Force DNS refresh (flush local cache)
# macOS:
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder

# Linux:
sudo systemd-resolve --flush-caches
```

**Issue 2: App Not Deployed**
```bash
# Verify app exists
fly apps list | grep my-app

# Deploy if missing
fly deploy
```

**Issue 3: Custom Domain Issues**
```bash
# For custom domains, verify CNAME/A record
dig your-domain.com

# Should point to Fly.io:
# your-domain.com. 300 IN CNAME my-app.fly.dev.
```

**Prevention**:
- Wait for DNS propagation after deployment
- Test with default .fly.dev domain first
- Use `fly certs check` for HTTPS issues

---

### 6. Out of Memory (OOM)

**Symptom**:
```
Error: Container killed (exit code 137)
Logs: "JavaScript heap out of memory"
```

**Diagnosis**:
```bash
# Check machine resources
fly status

# View logs for OOM errors
fly logs | grep -i "memory\|oom\|killed"

# Monitor metrics
fly dashboard
```

**Solution**:

**Issue 1: Insufficient Memory**
```toml
# In fly.toml, increase memory
[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512  # Increase from 256MB

# Deploy with new config
fly deploy
```

**Issue 2: Memory Leak**
```javascript
// Node.js - INCORRECT (memory leak)
const cache = {};
app.get('/data/:id', (req, res) => {
  cache[req.params.id] = fetchData(req.params.id);  // ❌ Unbounded cache
  res.json(cache[req.params.id]);
});

// Node.js - CORRECT (bounded cache)
const LRU = require('lru-cache');
const cache = new LRU({ max: 500, maxAge: 1000 * 60 * 60 });
app.get('/data/:id', (req, res) => {
  let data = cache.get(req.params.id);
  if (!data) {
    data = fetchData(req.params.id);
    cache.set(req.params.id, data);
  }
  res.json(data);
});
```

**Issue 3: Node.js Heap Limit**
```dockerfile
# Increase Node.js heap size
CMD ["node", "--max-old-space-size=384", "server.js"]
# Set to 75% of machine memory (512MB → 384MB heap)
```

**Prevention**:
- Monitor memory usage in development
- Use bounded caches (LRU, TTL)
- Profile memory leaks before deploying
- Right-size machines (start with 512MB for Node.js)

---

### 7. Deployment Timeout

**Symptom**:
```
Error: Deployment timed out after 5 minutes
Machines failed to reach "started" state
```

**Diagnosis**:
```bash
# Check deployment logs
fly logs --image

# Common causes:
# - Slow application startup
# - Health check too aggressive
# - Database migrations running too long
```

**Solution**:

**Issue 1: Slow Startup**
```toml
# In fly.toml, increase health check grace period
[[http_service.checks]]
  grace_period = "30s"  # Increase from 10s
  interval = "30s"
  timeout = "10s"       # Increase from 5s
```

**Issue 2: Database Migrations**
```dockerfile
# Run migrations in release command (separate from app start)
# See: https://fly.io/docs/reference/configuration/#the-deploy-section

# In fly.toml
[deploy]
  release_command = "npm run migrate"  # Runs before app start
```

**Issue 3: Large Docker Image**
```dockerfile
# Optimize Dockerfile for faster builds
# Use multi-stage builds
# Minimize layers
# Use Alpine base images
FROM node:18-alpine  # Smaller than node:18 (120MB vs 900MB)
```

**Prevention**:
- Optimize application startup time
- Use release commands for migrations
- Test deployment locally with Docker
- Monitor deployment time in dashboard

---

### 8. Cannot Connect to Database

**Symptom**:
```
Error: ECONNREFUSED postgres://my-db.internal:5432/mydb
Error: connect ETIMEDOUT
```

**Diagnosis**:
```bash
# For Fly Postgres
fly pg list

# Check database status
fly pg status --app my-db

# Test connection from machine
fly ssh console
> curl postgres://my-db.internal:5432
```

**Solution**:

**Issue 1: Database Not Attached**
```bash
# Attach Fly Postgres to app
fly postgres attach my-db --app my-app

# This sets DATABASE_URL secret automatically
fly secrets list | grep DATABASE_URL
```

**Issue 2: Incorrect Connection String**
```bash
# For Fly Postgres (internal)
DATABASE_URL=postgres://user:pass@my-db.internal:5432/mydb

# For external database (public internet)
DATABASE_URL=postgres://user:pass@external-host.com:5432/mydb

# Verify secret
fly secrets list
```

**Issue 3: Firewall/Network Rules**
```bash
# For external databases, whitelist Fly.io IPs
# See: https://fly.io/docs/reference/network/#outbound-ips

# Or use Fly Postgres (no firewall needed)
```

**Prevention**:
- Use `fly postgres attach` for Fly Postgres
- Test database connection in health check
- Use connection pooling (PgBouncer)
- Set connection timeout in application

---

### 9. Certificate Errors

**Symptom**:
```
Error: SSL certificate problem: unable to get local issuer certificate
curl: (60) SSL certificate problem
```

**Diagnosis**:
```bash
# Check certificate status
fly certs check my-app.fly.dev

# Expected:
# The certificate for my-app.fly.dev is valid

# For custom domains
fly certs check your-domain.com
```

**Solution**:

**Issue 1: Certificate Not Provisioned**
```bash
# Add certificate for custom domain
fly certs add your-domain.com

# Wait for DNS validation (5-10 minutes)
fly certs show your-domain.com
```

**Issue 2: DNS Configuration**
```bash
# For custom domain, add CNAME
your-domain.com. CNAME my-app.fly.dev.

# Or A/AAAA records
your-domain.com. A 66.241.125.123
your-domain.com. AAAA 2a09:8280:1::xyz
```

**Issue 3: Force HTTPS**
```toml
# In fly.toml, redirect HTTP to HTTPS
[http_service]
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
```

**Prevention**:
- Let Fly.io manage certificates (automatic Let's Encrypt)
- Use `force_https = true` for production
- Monitor certificate expiration (auto-renewed)

---

### 10. Deployment Stuck

**Symptom**:
```
Deployment appears stuck, no progress for 10+ minutes
Machines in "starting" state indefinitely
```

**Diagnosis**:
```bash
# Check machine status
fly status

# View machine logs
fly logs

# Check for resource limits
fly dashboard
```

**Solution**:

**Issue 1: Insufficient Resources**
```bash
# Cancel deployment
# (Ctrl+C or fly deploy --cancel in another terminal)

# Increase machine resources
# In fly.toml:
[[vm]]
  cpus = 2        # Increase from 1
  memory_mb = 512 # Increase from 256

# Retry deployment
fly deploy
```

**Issue 2: Platform Issue**
```bash
# Check Fly.io status
curl https://status.fly.io/api/v2/status.json

# If platform issue, wait for resolution
# Or try different region
fly regions add iad  # Add backup region
```

**Issue 3: Deadlock in Application**
```bash
# Application waiting for external resource
# Check logs for blocking operations
fly logs | grep -i "waiting\|pending\|blocked"

# Fix: Add timeouts to all external calls
```

**Prevention**:
- Monitor deployment progress actively
- Set up deployment timeouts
- Test deployments in staging first
- Have rollback plan ready

---

## Performance Issues

### 1. Slow Response Times

**Symptom**:
```
API responses > 500ms
Users report slow page loads
```

**Diagnosis**:
```bash
# Monitor metrics
fly dashboard

# Check logs for slow queries
fly logs | grep -E "[0-9]{3,}ms"

# Test from different regions
curl -w "@curl-format.txt" https://my-app.fly.dev/api/health
```

**Solution**:

**Issue 1: Insufficient Resources**
```toml
# Scale up machines
[[vm]]
  cpus = 2        # Increase from 1
  memory_mb = 512 # Increase from 256
```

**Issue 2: Single Region**
```bash
# Add more regions for global users
fly regions add iad lhr nrt syd

# Scale machines per region
fly scale count 2 --region sea
fly scale count 2 --region iad
```

**Issue 3: Database Query Optimization**
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_posts_user_id ON posts(user_id);

-- Use query analysis
EXPLAIN ANALYZE SELECT * FROM posts WHERE user_id = 123;
```

**Prevention**:
- Monitor P95/P99 latency
- Use caching (Redis, CDN)
- Optimize database queries
- Deploy to multiple regions

---

### 2. High Memory Usage

**Symptom**:
```
Machines frequently OOM killed
Memory usage > 90% consistently
```

**Diagnosis**:
```bash
# Monitor memory metrics
fly dashboard

# Check logs for memory warnings
fly logs | grep -i memory

# Profile application locally
node --inspect server.js
# Open chrome://inspect
```

**Solution**:

**Issue 1: Memory Leak**
```javascript
// Node.js - Detect leak
const v8 = require('v8');
const heapStats = v8.getHeapStatistics();
console.log('Heap used:', heapStats.used_heap_size / 1024 / 1024, 'MB');
```

**Issue 2: Inefficient Caching**
```javascript
// INCORRECT - Unbounded cache
const cache = {};

// CORRECT - LRU cache with limits
const LRU = require('lru-cache');
const cache = new LRU({
  max: 500,             // Max 500 items
  maxAge: 1000 * 60 * 60 // 1 hour TTL
});
```

**Issue 3: Large Payloads**
```javascript
// Stream large responses instead of loading into memory
app.get('/large-file', (req, res) => {
  const stream = fs.createReadStream('large-file.json');
  stream.pipe(res);
});
```

**Prevention**:
- Use memory profiling tools
- Implement bounded caches
- Stream large payloads
- Monitor heap usage

---

### 3. Connection Timeouts

**Symptom**:
```
Error: ETIMEDOUT
Error: connect ECONNREFUSED
```

**Diagnosis**:
```bash
# Check network connectivity
fly ssh console
> ping google.com
> curl https://external-api.com

# Monitor connection pool
fly logs | grep -i "connection\|pool"
```

**Solution**:

**Issue 1: Connection Pool Exhausted**
```javascript
// INCORRECT - No connection pooling
const db = new Pool({ max: 10 });  // Too small

// CORRECT - Proper pool size
const db = new Pool({
  max: 20,              // Increase pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});
```

**Issue 2: External API Timeout**
```javascript
// Add timeout to external calls
const axios = require('axios');
const response = await axios.get('https://api.example.com/data', {
  timeout: 5000  // 5 second timeout
});
```

**Issue 3: Database Connection Timeout**
```bash
# For Fly Postgres, use PgBouncer
fly pg attach my-db --app my-app

# In DATABASE_URL, use connection pooling
postgres://user:pass@my-db-bouncer.internal:5432/mydb?pool_timeout=10
```

**Prevention**:
- Set connection timeouts
- Use connection pooling
- Implement retry logic
- Monitor connection metrics

---

## Security Issues

### 1. Secrets Exposed in Logs

**Symptom**:
```
Logs contain DATABASE_URL with password
Secrets visible in error messages
```

**Diagnosis**:
```bash
# Check logs for exposed secrets
fly logs | grep -i "password\|secret\|key"

# Common causes:
# - Logging environment variables
# - Error messages with secrets
```

**Solution**:

**Issue 1: Environment Variables Logged**
```javascript
// INCORRECT - Logs all env vars
console.log(process.env);  // ❌ Exposes DATABASE_URL, API_KEY

// CORRECT - Log only non-sensitive vars
const sanitizedEnv = { ...process.env };
delete sanitizedEnv.DATABASE_URL;
delete sanitizedEnv.API_KEY;
console.log(sanitizedEnv);
```

**Issue 2: Error Messages with Secrets**
```javascript
// INCORRECT - Error exposes connection string
throw new Error(`Failed to connect to ${process.env.DATABASE_URL}`);

// CORRECT - Sanitize error messages
throw new Error('Failed to connect to database');
```

**Prevention**:
- Never log secrets
- Sanitize error messages
- Use secret scanning tools
- Review logs regularly

---

### 2. Insecure Network Configuration

**Symptom**:
```
Services accessible without authentication
Internal services exposed publicly
```

**Diagnosis**:
```bash
# Check exposed services
fly status

# Test public access to internal services
curl https://my-app.fly.dev/internal-admin
```

**Solution**:

**Issue 1: Public Access to Admin**
```javascript
// INCORRECT - Admin accessible to all
app.get('/admin', (req, res) => {
  res.json({ users: getAllUsers() });  // ❌ No auth
});

// CORRECT - Require authentication
app.get('/admin', requireAuth, (req, res) => {
  res.json({ users: getAllUsers() });
});
```

**Issue 2: Internal Service Exposed**
```toml
# INCORRECT - Worker exposed publicly
[[services]]
  processes = ["worker"]
  internal_port = 9090
  protocol = "tcp"

  [[services.ports]]
    port = 80  # ❌ Publicly accessible

# CORRECT - Worker internal only
# Remove [services.ports] for internal-only services
```

**Prevention**:
- Use private networking (6PN) for internal services
- Require authentication for sensitive endpoints
- Implement rate limiting
- Regular security audits

---

### 3. Missing HTTPS

**Symptom**:
```
Application accessible over HTTP
Insecure warnings in browser
```

**Diagnosis**:
```bash
# Test HTTP access
curl http://my-app.fly.dev

# Should redirect to HTTPS
```

**Solution**:

**Issue 1: HTTPS Not Enforced**
```toml
# In fly.toml, force HTTPS
[http_service]
  force_https = true  # Redirect HTTP → HTTPS
  auto_stop_machines = true
  auto_start_machines = true
```

**Issue 2: Mixed Content**
```javascript
// INCORRECT - HTTP resources on HTTPS page
<img src="http://example.com/image.jpg">  // ❌ Mixed content

// CORRECT - HTTPS resources
<img src="https://example.com/image.jpg">
```

**Prevention**:
- Always use `force_https = true`
- Use HTTPS for all external resources
- Enable HSTS headers

---

## Detection Issues

### 1. Fly.io Not Detected

**Symptom**:
```
infrastructure-developer doesn't load Fly.io skills
No auto-detection happening
```

**Diagnosis**:
```bash
# Check for detection signals
ls fly.toml  # Primary signal (weight: 0.7)

# Check for CLI commands in scripts
grep -r "fly deploy" *.sh

# Check for domain patterns
grep -r "fly.dev" .
```

**Solution**:

**Issue 1: Missing fly.toml**
```bash
# Create fly.toml
infrastructure-developer: "Generate fly.toml for Node.js Express application"

# Or copy template
cp ~/.claude/skills/flyio/examples/nodejs-express/fly.toml ./
```

**Issue 2: Confidence Below Threshold**
```
Detected signals:
- CLI commands: 30%
- Domain patterns: 20%
Total: 60% (below 70% threshold)

Solution: Add fly.toml (primary signal)
```

**Prevention**:
- Always have fly.toml in project root
- Use Fly.io CLI commands in deployment scripts
- Document Fly.io usage in README

---

### 2. Wrong Platform Detected

**Symptom**:
```
K8s skills loaded instead of Fly.io
Multiple platforms detected
```

**Diagnosis**:
```bash
# Check for multiple platform signals
ls fly.toml          # Fly.io
ls Chart.yaml        # Helm
ls *.yaml | head     # Kubernetes

# Expected: Both Fly.io and K8s detected
```

**Solution**:

**Issue 1: Multi-Platform Project**
```
This is expected behavior for hybrid deployments:
- Edge services on Fly.io
- Backend services on K8s

infrastructure-developer will load both skill sets
```

**Issue 2: Platform Priority**
```
Ask infrastructure-developer:
"Which platform should I use for this service: Fly.io or K8s?"

Agent will recommend based on service requirements
```

**Prevention**:
- Document platform choice in README
- Use separate directories for different platforms
- Consult platform selection guide

---

### 3. Skills Not Loading

**Symptom**:
```
Fly.io detected but skills/flyio/ not loaded
No templates available
```

**Diagnosis**:
```bash
# Check skills directory
ls ~/.claude/skills/flyio/

# Expected output:
# SKILL.md  REFERENCE.md  examples/

# Verify installation
npx @fortium/ai-mesh validate
```

**Solution**:

**Issue 1: Skills Not Installed**
```bash
# Install Fly.io skills
npx @fortium/ai-mesh install --global

# Verify installation
ls ~/.claude/skills/flyio/
```

**Issue 2: Claude Code Restart Needed**
```bash
# Restart Claude Code to load new skills
# (Close and reopen Claude Code)

# Verify skills loaded
infrastructure-developer: "List available Fly.io templates"
```

**Prevention**:
- Run installation validation after setup
- Restart Claude Code after installing skills
- Check skills directory permissions

---

## Quick Reference

### Common Commands

```bash
# Deployment
fly deploy                    # Deploy to Fly.io
fly launch                    # Create and deploy new app
fly deploy --no-cache         # Deploy without build cache

# Status and Logs
fly status                    # View app status
fly logs                      # View live logs
fly logs --image              # View build logs

# Secrets
fly secrets set KEY=value     # Set secret
fly secrets list              # List secrets (values hidden)
fly secrets unset KEY         # Remove secret

# Scaling
fly scale count 3             # Scale to 3 machines
fly scale count 2 --region sea # Scale specific region
fly scale memory 512          # Set memory to 512MB

# Database
fly postgres list             # List databases
fly postgres attach my-db     # Attach database to app
fly postgres connect          # Connect to database

# SSH
fly ssh console               # SSH into machine
fly ssh console --select      # Choose machine to SSH

# Certificates
fly certs list                # List certificates
fly certs add your-domain.com # Add custom domain certificate
fly certs check your-domain   # Check certificate status

# Regions
fly regions list              # List all regions
fly regions add iad lhr       # Add regions
fly regions remove nrt        # Remove region
```

### Health Check Template

```toml
[[http_service.checks]]
  grace_period = "10s"    # Wait before first check
  interval = "30s"        # Check every 30s
  method = "GET"          # HTTP method
  timeout = "5s"          # Check timeout
  path = "/health"        # Health endpoint
```

### Common Ports

```toml
# HTTP/HTTPS
[[services.ports]]
  handlers = ["http"]
  port = 80               # HTTP

[[services.ports]]
  handlers = ["tls", "http"]
  port = 443              # HTTPS

# Custom TCP
[[services.ports]]
  port = 8080             # Custom TCP port
```

### Debugging Checklist

- [ ] Check `fly status` for machine state
- [ ] Review `fly logs` for errors
- [ ] Verify secrets with `fly secrets list`
- [ ] Test health check endpoint locally
- [ ] Confirm internal_port matches application
- [ ] Ensure PORT environment variable used
- [ ] Check DNS with `dig my-app.fly.dev`
- [ ] Verify certificate with `fly certs check`
- [ ] Monitor resources in `fly dashboard`
- [ ] Test deployment locally with Docker

---

## Get Help

### infrastructure-developer Agent

Ask the agent for specific troubleshooting:
```
"My Fly.io deployment is failing with health check errors. How do I debug?"
"Application is slow. How can I optimize Fly.io performance?"
"Getting OOM errors. How do I increase memory?"
```

### External Resources

- **Fly.io Documentation**: [https://fly.io/docs](https://fly.io/docs)
- **Community Forum**: [https://community.fly.io](https://community.fly.io)
- **Status Page**: [https://status.fly.io](https://status.fly.io)
- **Quick Start Guide**: [Fly.io Quick Start](./flyio-quick-start.md)
- **Platform Selection**: [Platform Selection Guide](./platform-selection.md)

### Support Escalation

1. **Self-Service**: This troubleshooting guide
2. **AI Agent**: infrastructure-developer assistance
3. **Community**: Fly.io community forum
4. **Official Support**: Fly.io support tickets (paid plans)

---

**Most Common Issues Covered** (95% of deployment problems):
1. ✅ App name already taken
2. ✅ Health check failing
3. ✅ Build failed
4. ✅ Secrets not loading
5. ✅ DNS resolution failed
6. ✅ Out of memory (OOM)
7. ✅ Deployment timeout
8. ✅ Cannot connect to database
9. ✅ Certificate errors
10. ✅ Deployment stuck

With this guide and the infrastructure-developer agent, you should be able to resolve 95% of Fly.io deployment issues without external support. 🚀
