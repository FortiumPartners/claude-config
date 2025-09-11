@backend-developer

Please implement the backend services for Task 7.5: Tenant Monitoring System.

**Context**: External Metrics Web Service - Sprint 7 implementation focusing on real-time tenant health monitoring and alerting system.

**Requirements**: 
Refer to `/Users/ldangelo/Development/fortium/claude-config/src/monitoring-web-service/task-7.5-implementation.md` for complete specifications.

**Key Focus Areas**:
1. Background health check service with scheduled monitoring
2. Real-time health status API endpoints
3. Alert generation system with configurable thresholds
4. Performance metrics collection per tenant
5. WebSocket integration for live health updates

**File Locations**:
- API routes: `src/routes/monitoring/`
- Services: `src/services/health-monitor.js`
- Background jobs: `src/jobs/health-check.js`
- Models: `src/models/tenant-health.js`
- WebSocket handlers: `src/websocket/health-updates.js`

**Implementation Requirements**:
- Scheduled health checks every 30 seconds per tenant
- Database connectivity validation per tenant schema
- API endpoint response time monitoring
- Resource utilization tracking and alerting
- Integration with existing WebSocket infrastructure

**Success Criteria**:
- Automated health checks running reliably for all tenants
- Real-time health status API responding in <100ms
- Alert generation working with proper severity levels
- WebSocket health updates broadcasting correctly
- Performance metrics accurately captured and stored

Please implement according to the existing codebase patterns and Node.js/TypeScript architecture.