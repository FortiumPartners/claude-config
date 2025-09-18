#!/bin/sh

# Health check script for React frontend
# Used by Docker HEALTHCHECK instruction

# Check if Nginx is responding
if wget --no-verbose --tries=1 --spider http://localhost:8080/health; then
    echo "Health check passed"
    exit 0
else
    echo "Health check failed"
    exit 1
fi