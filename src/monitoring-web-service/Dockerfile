# External Metrics Web Service - Multi-stage Docker Build
# Based on TRD Sprint 1 requirements for containerization

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install build dependencies
RUN npm ci --only=production --silent && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install security updates and dumb-init for proper signal handling
RUN apk --no-cache add dumb-init && \
    apk --no-cache upgrade

# Create app user for security
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

# Set working directory
WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production --silent && \
    npm cache clean --force && \
    rm -rf ~/.npm

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy database migrations and scripts
COPY src/migrations ./migrations
COPY src/scripts ./scripts

# Set proper ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port (from TRD specification)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/app.js"]

# Metadata labels
LABEL maintainer="Fortium Partners Engineering Team <engineering@fortium.dev>" \
      version="1.0.0" \
      description="External Metrics Web Service for Fortium AI-Augmented Development Analytics" \
      org.opencontainers.image.title="fortium-metrics-web-service" \
      org.opencontainers.image.description="Multi-tenant SaaS platform for Claude Code productivity analytics" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.vendor="Fortium Partners" \
      org.opencontainers.image.licenses="PROPRIETARY"