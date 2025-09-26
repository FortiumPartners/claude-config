# Fortium AI-Augmented Development - Monitoring Web Service
# Makefile for managing backend, websocket, and frontend services

.PHONY: help install dev start stop backend frontend websocket test clean logs status health signoz-start signoz-stop signoz-logs signoz-clean signoz-validate otel-test

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

# Default target
help:
	@echo "$(BLUE)╔════════════════════════════════════════════════════════════════╗$(NC)"
	@echo "$(BLUE)║$(NC)  $(GREEN)Fortium Monitoring Web Service - Development Commands$(NC)       $(BLUE)║$(NC)"
	@echo "$(BLUE)╠════════════════════════════════════════════════════════════════╣$(NC)"
	@echo "$(BLUE)║$(NC) $(YELLOW)Development:$(NC)                                                   $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make install    - Install all dependencies                   $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make dev        - Start all services in development mode     $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make start      - Start all services (alias for dev)         $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make stop       - Stop all running services                  $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)                                                                 $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC) $(YELLOW)Individual Services:$(NC)                                           $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make backend    - Start backend/websocket server only        $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make frontend   - Start frontend dev server only             $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)                                                                 $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC) $(YELLOW)Testing & Monitoring:$(NC)                                          $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make test       - Run all tests                              $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make logs       - Show logs from all services                $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make status     - Check service status                       $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make health     - Check backend health endpoint              $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)                                                                 $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC) $(YELLOW)SignOz Observability:$(NC)                                          $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make signoz-start   - Start SignOz observability stack       $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make signoz-stop    - Stop SignOz services                   $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make signoz-logs    - View SignOz logs                       $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make signoz-clean   - Clean SignOz data (caution!)           $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make signoz-validate - Validate SignOz integration           $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make otel-test      - Test OpenTelemetry integration         $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)                                                                 $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC) $(YELLOW)Maintenance:$(NC)                                                   $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make clean      - Clean build artifacts and logs             $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make restart    - Restart all services                       $(BLUE)║$(NC)"
	@echo "$(BLUE)║$(NC)   make db-reset   - Reset database (caution!)                  $(BLUE)║$(NC)"
	@echo "$(BLUE)╚════════════════════════════════════════════════════════════════╝$(NC)"

# Install all dependencies
install:
	@echo "$(YELLOW)📦 Installing backend dependencies...$(NC)"
	@npm install
	@echo "$(YELLOW)📦 Installing frontend dependencies...$(NC)"
	@cd frontend && npm install
	@echo "$(GREEN)✅ All dependencies installed successfully!$(NC)"

# Start all services in development mode with hot reload
dev:
	@echo "$(BLUE)🚀 Starting all services in development mode with hot reload...$(NC)"
	@make -j 2 backend-watch-bg frontend-bg
	@echo "$(GREEN)✅ All services started with hot reload!$(NC)"
	@echo ""
	@echo "$(BLUE)📊 Service URLs:$(NC)"
	@echo "  Backend API:  $(GREEN)http://localhost:3001$(NC)"
	@echo "  Frontend:     $(GREEN)http://localhost:3000$(NC)"
	@echo "  Health Check: $(GREEN)http://localhost:3001/health$(NC)"
	@echo "  WebSocket:    $(GREEN)ws://localhost:3001$(NC)"
	@echo ""
	@echo "$(YELLOW)🔥 Hot reload enabled - changes will auto-restart services$(NC)"
	@echo "$(YELLOW)Press Ctrl+C to stop all services$(NC)"
	@tail -f /dev/null

# Alias for dev
start: dev

# Start backend/websocket server in background
backend-bg:
	@echo "$(YELLOW)🔧 Starting backend/websocket server...$(NC)"
	@PORT=3001 npx tsx src/app.ts 2>&1 | sed 's/^/[BACKEND] /' &

# Start backend/websocket server with hot reload in background
backend-watch-bg:
	@echo "$(YELLOW)🔧 Starting backend/websocket server with hot reload...$(NC)"
	@PORT=3001 npx tsx watch src/app.ts 2>&1 | sed 's/^/[BACKEND] /' &

# Start frontend in background
frontend-bg:
	@echo "$(YELLOW)🎨 Starting frontend dev server...$(NC)"
	@cd frontend && npm run dev 2>&1 | sed 's/^/[FRONTEND] /' &

# Start backend/websocket server only
backend:
	@echo "$(YELLOW)🔧 Starting backend/websocket server...$(NC)"
	PORT=3001 npx tsx src/app.ts

# Start frontend only
frontend:
	@echo "$(YELLOW)🎨 Starting frontend dev server...$(NC)"
	cd frontend && npm run dev

# Start websocket server (alias for backend)
websocket: backend

# Stop all services
stop:
	@echo "$(RED)🛑 Stopping all services...$(NC)"
	@pkill -f "tsx src/app.ts" || true
	@pkill -f "vite" || true
	@lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@echo "$(GREEN)✅ All services stopped$(NC)"

# Restart all services
restart:
	@make stop
	@sleep 2
	@make dev

# Run tests
test:
	@echo "$(YELLOW)🧪 Running backend tests...$(NC)"
	@npm test
	@echo "$(YELLOW)🧪 Running frontend tests...$(NC)"
	@cd frontend && npm test

# Show logs from all services
logs:
	@echo "$(BLUE)📋 Showing recent logs...$(NC)"
	@tail -f *.log 2>/dev/null || echo "$(YELLOW)No log files found. Services may be using console output.$(NC)"

# Check service status
status:
	@echo "$(BLUE)📊 Service Status:$(NC)"
	@echo -n "Backend (port 3001): "
	@if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then \
		echo "$(GREEN)✅ Running$(NC)"; \
	else \
		echo "$(RED)❌ Stopped$(NC)"; \
	fi
	@echo -n "Frontend (port 3000): "
	@if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then \
		echo "$(GREEN)✅ Running$(NC)"; \
	else \
		echo "$(RED)❌ Stopped$(NC)"; \
	fi

# Check backend health
health:
	@echo "$(BLUE)🏥 Checking backend health...$(NC)"
	@curl -s http://localhost:3001/health | jq '.' || echo "$(RED)❌ Backend is not responding$(NC)"

# Clean build artifacts and logs
clean:
	@echo "$(YELLOW)🧹 Cleaning build artifacts...$(NC)"
	@rm -rf dist/
	@rm -rf frontend/dist/
	@rm -rf node_modules/.cache/
	@rm -rf frontend/node_modules/.cache/
	@rm -f *.log
	@echo "$(GREEN)✅ Clean complete$(NC)"

# Database reset (caution!)
db-reset:
	@echo "$(RED)⚠️  WARNING: This will reset the database!$(NC)"
	@echo "Press Ctrl+C to cancel, or wait 5 seconds to continue..."
	@sleep 5
	@echo "$(YELLOW)🗄️  Resetting database...$(NC)"
	@npx prisma migrate reset --force
	@echo "$(GREEN)✅ Database reset complete$(NC)"

# Build for production
build:
	@echo "$(YELLOW)🏗️  Building backend...$(NC)"
	@npm run build
	@echo "$(YELLOW)🏗️  Building frontend...$(NC)"
	@cd frontend && npm run build
	@echo "$(GREEN)✅ Build complete$(NC)"

# Run in production mode
prod:
	@echo "$(BLUE)🚀 Starting in production mode...$(NC)"
	@NODE_ENV=production node dist/server-websocket.js &
	@cd frontend && npm run preview &
	@echo "$(GREEN)✅ Production servers started$(NC)"

# Docker commands
docker-up:
	@echo "$(BLUE)🐳 Starting services with Docker Compose...$(NC)"
	@docker-compose up -d
	@echo "$(GREEN)✅ Docker services started$(NC)"

docker-down:
	@echo "$(RED)🐳 Stopping Docker services...$(NC)"
	@docker-compose down
	@echo "$(GREEN)✅ Docker services stopped$(NC)"

docker-logs:
	@docker-compose logs -f

# Development with auto-reload
watch:
	@echo "$(BLUE)👁️  Starting services with auto-reload...$(NC)"
	@make -j 2 backend-watch frontend-bg

backend-watch:
	@echo "$(YELLOW)🔧 Starting backend with auto-reload...$(NC)"
	@PORT=3001 npx tsx watch src/app.ts

# Seed test data
seed:
	@echo "$(YELLOW)🌱 Seeding test data...$(NC)"
	@npx tsx scripts/seed-test-data.ts
	@echo "$(GREEN)✅ Test data seeded$(NC)"

# Open dashboard in browser
open:
	@echo "$(BLUE)🌐 Opening dashboard in browser...$(NC)"
	@open http://localhost:5173 || xdg-open http://localhost:5173 || echo "Please open http://localhost:5173 in your browser"

# Quick start (install, then dev)
quickstart: install dev open

# Check if all prerequisites are installed
check-deps:
	@echo "$(BLUE)🔍 Checking dependencies...$(NC)"
	@command -v node >/dev/null 2>&1 || { echo "$(RED)❌ Node.js is not installed$(NC)"; exit 1; }
	@command -v npm >/dev/null 2>&1 || { echo "$(RED)❌ npm is not installed$(NC)"; exit 1; }
	@echo "$(GREEN)✅ All dependencies found$(NC)"
	@echo "  Node version: $$(node --version)"
	@echo "  npm version: $$(npm --version)"

# SignOz Observability Platform Commands
signoz-start:
	@echo "$(BLUE)🔍 Starting SignOz observability stack...$(NC)"
	@docker-compose -f docker-compose.signoz.yml up -d
	@echo "$(GREEN)✅ SignOz services starting...$(NC)"
	@echo "$(YELLOW)📊 SignOz UI will be available at: http://localhost:3301$(NC)"
	@echo "$(YELLOW)🔗 OTLP Endpoint: http://localhost:4318$(NC)"
	@echo "$(YELLOW)⏳ Please wait 60-90 seconds for all services to be ready$(NC)"

signoz-stop:
	@echo "$(BLUE)🛑 Stopping SignOz observability stack...$(NC)"
	@docker-compose -f docker-compose.signoz.yml down
	@echo "$(GREEN)✅ SignOz services stopped$(NC)"

signoz-logs:
	@echo "$(BLUE)📋 Showing SignOz service logs...$(NC)"
	@docker-compose -f docker-compose.signoz.yml logs -f

signoz-clean:
	@echo "$(RED)⚠️  WARNING: This will delete all SignOz data including traces and metrics!$(NC)"
	@read -p "Are you sure? Type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ] || exit 1
	@echo "$(BLUE)🧹 Cleaning SignOz data and containers...$(NC)"
	@docker-compose -f docker-compose.signoz.yml down -v
	@docker system prune -f
	@echo "$(GREEN)✅ SignOz data cleaned$(NC)"

signoz-validate:
	@echo "$(BLUE)🔍 Validating SignOz integration...$(NC)"
	@npx tsx scripts/validate-signoz-integration.ts

otel-test:
	@echo "$(BLUE)🧪 Testing OpenTelemetry integration...$(NC)"
	@npx tsx scripts/test-otel-integration.ts

# Combined observability setup
observability-setup: signoz-start
	@echo "$(YELLOW)⏳ Waiting for SignOz to initialize...$(NC)"
	@sleep 60
	@make signoz-validate
	@echo "$(GREEN)🎉 SignOz observability platform is ready!$(NC)"
	@echo "$(CYAN)📊 Access SignOz UI: http://localhost:3301$(NC)"
	@echo "$(CYAN)🔍 Generate test data: make otel-test$(NC)"

# Start application with observability
dev-otel: signoz-start
	@echo "$(YELLOW)⏳ Waiting for SignOz services...$(NC)"
	@sleep 30
	@echo "$(BLUE)🚀 Starting application with OpenTelemetry...$(NC)"
	@npm run dev:otel