# Multi-stage Dockerfile for React Frontend
# Task 1.2: Docker containerization

# Stage 1: Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --silent

# Copy source code
COPY public/ ./public/
COPY src/ ./src/
COPY tsconfig.json ./
COPY tailwind.config.js ./
COPY vite.config.ts ./
COPY index.html ./

# Build the application
ARG VITE_API_BASE_URL=http://localhost:3001
ARG VITE_WS_URL=ws://localhost:3001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

# Stage 2: Production stage with Nginx
FROM nginx:alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001 -G nginx

# Copy built application from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY docker/frontend/nginx.conf /etc/nginx/nginx.conf
COPY docker/frontend/default.conf /etc/nginx/conf.d/default.conf

# Copy health check script
COPY docker/frontend/healthcheck.sh /healthcheck.sh
RUN chmod +x /healthcheck.sh

# Set ownership
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d
RUN touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 8080

# Add health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD /healthcheck.sh

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]