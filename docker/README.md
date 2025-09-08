# Docker Configuration for External Metrics Web Service

This directory contains Docker configurations for containerizing the External Metrics Web Service application.

## Architecture

- **Backend**: Node.js API server with TypeScript
- **Frontend**: React application served by Nginx
- **Database**: PostgreSQL 14 with development schema
- **Cache**: Redis 7 with authentication
- **Development Tools**: Adminer (DB) and Redis Commander

## Quick Start

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ available RAM
- 10GB+ available disk space

### Development Environment

```bash
# Start all services
docker-compose up -d

# Start with development tools
docker-compose --profile development up -d

# View logs
docker-compose logs -f backend frontend

# Stop all services
docker-compose down

# Clean up volumes (⚠️ This will delete all data)
docker-compose down -v
```

### Production-like Environment

```bash
# Start with Nginx reverse proxy
docker-compose --profile production up -d

# Access via http://localhost (port 80)
```

## Service Endpoints

### Development Mode

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **Database**: postgresql://metrics_dev:dev_password_2024@localhost:5432/external_metrics_dev
- **Redis**: redis://:dev_redis_2024@localhost:6379
- **Adminer (DB Admin)**: http://localhost:8080
- **Redis Commander**: http://localhost:8081

### Production Mode

- **Application**: http://localhost (Nginx proxy)
- **API**: http://localhost/api (proxied to backend)
- **WebSocket**: ws://localhost/ws (proxied to backend)

## Environment Variables

### Backend Configuration

```bash
# Database
DATABASE_URL=postgresql://metrics_dev:dev_password_2024@postgres:5432/external_metrics_dev

# Redis
REDIS_URL=redis://:dev_redis_2024@redis:6379

# Security
JWT_SECRET=dev_jwt_secret_key_2024_very_long_string
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=http://localhost:3001

# Logging
LOG_LEVEL=debug
```

### Frontend Configuration

```bash
# API endpoints
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

## Health Checks

All services include health check endpoints:

```bash
# Check backend health
curl http://localhost:3000/health

# Check frontend health  
curl http://localhost:3001/health

# Check database connection
docker-compose exec postgres pg_isready -U metrics_dev -d external_metrics_dev

# Check Redis connection
docker-compose exec redis redis-cli ping
```

## Data Persistence

Data is persisted in named volumes:

- **postgres_data**: Database files in `./docker/data/postgres`
- **redis_data**: Cache files in `./docker/data/redis`

### Backup and Restore

```bash
# Backup database
docker-compose exec postgres pg_dump -U metrics_dev external_metrics_dev > backup.sql

# Restore database
docker-compose exec -T postgres psql -U metrics_dev external_metrics_dev < backup.sql

# Backup Redis
docker-compose exec redis redis-cli SAVE
docker-compose cp redis:/data/dump.rdb ./redis-backup.rdb
```

## Development Workflow

### Building Images

```bash
# Build all images
docker-compose build

# Build specific service
docker-compose build backend

# Build without cache
docker-compose build --no-cache
```

### Debugging

```bash
# Execute shell in running container
docker-compose exec backend sh
docker-compose exec frontend sh

# View container logs
docker-compose logs backend
docker-compose logs -f --tail=100 frontend

# Monitor resource usage
docker stats
```

### Database Management

```bash
# Access PostgreSQL shell
docker-compose exec postgres psql -U metrics_dev -d external_metrics_dev

# Run database migrations (when Prisma is set up)
docker-compose exec backend npx prisma migrate dev

# Generate Prisma client
docker-compose exec backend npx prisma generate

# Open Adminer in browser
open http://localhost:8080
```

### Cache Management

```bash
# Access Redis CLI
docker-compose exec redis redis-cli

# Clear all cache
docker-compose exec redis redis-cli FLUSHALL

# Monitor Redis activity
docker-compose exec redis redis-cli MONITOR

# Open Redis Commander in browser
open http://localhost:8081
```

## Performance Optimization

### Resource Limits

Production deployments should include resource limits:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

### Multi-stage Builds

Both backend and frontend use multi-stage builds:

- **Build stage**: Compiles TypeScript/React with development dependencies
- **Production stage**: Minimal runtime with only production dependencies

### Security Hardening

- Non-root user in all containers
- Minimal base images (Alpine Linux)
- Security headers in Nginx configuration
- Secrets management via environment variables

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Check what's using the port
lsof -i :3000
# Kill the process or change ports in docker-compose.yml
```

**Database Connection Issues**
```bash
# Check if PostgreSQL is running
docker-compose ps postgres
# Check logs for connection errors
docker-compose logs postgres
```

**Out of Disk Space**
```bash
# Clean up unused containers and images
docker system prune -a
# Clean up volumes (⚠️ This will delete data)
docker volume prune
```

**Permission Issues**
```bash
# Fix ownership of data directories
sudo chown -R $USER:$USER ./docker/data/
```

### Health Check Failures

```bash
# Check service health
docker-compose ps

# Inspect health check configuration
docker inspect external-metrics-backend | jq '.[].Config.Healthcheck'

# Test health check manually
docker-compose exec backend node healthcheck.js
```

## Production Deployment

For production deployment, consider:

1. **Environment Variables**: Use secure secrets management
2. **Resource Limits**: Set appropriate CPU/memory limits
3. **Networking**: Use custom networks with restricted access
4. **Monitoring**: Add logging and monitoring solutions
5. **Backup**: Implement automated backup strategies
6. **Security**: Regular security updates and vulnerability scanning

## Integration with Kubernetes

These Docker images can be deployed to Kubernetes using the Terraform infrastructure:

```bash
# Build and push images to ECR
docker build -t external-metrics-backend -f docker/backend/Dockerfile .
docker build -t external-metrics-frontend -f docker/frontend/Dockerfile .

# Tag and push to ECR (requires AWS CLI configuration)
docker tag external-metrics-backend:latest <account>.dkr.ecr.<region>.amazonaws.com/external-metrics-backend:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/external-metrics-backend:latest
```