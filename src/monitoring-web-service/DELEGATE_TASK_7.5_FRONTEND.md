@frontend-developer

Please implement the frontend components for Task 7.5: Tenant Monitoring System.

**Context**: External Metrics Web Service - Sprint 7 implementation focusing on real-time tenant health monitoring interface.

**Requirements**: 
Refer to `/Users/ldangelo/Development/fortium/claude-config/src/monitoring-web-service/task-7.5-implementation.md` for complete specifications.

**Key Components to Implement**:
1. **TenantHealthOverview**: Grid layout showing all tenant health statuses
2. **TenantStatusCard**: Individual tenant health card with key metrics
3. **HealthMetricsChart**: Simple real-time performance visualization
4. **AlertsPanel**: Active alerts list with severity indicators
5. **SystemStatusIndicator**: Global health indicator for header/navigation

**File Locations**:
- Components: `src/components/monitoring/`
- Hooks: `src/hooks/useHealthMonitoring.ts`
- Types: `src/types/monitoring.ts`

**Design Requirements**:
- Clean, minimal interface focusing on status clarity
- Color-coded health indicators (green/yellow/red)
- Real-time updates via WebSocket integration
- Responsive grid layout for different screen sizes
- Simple charts for performance trends

**Key Features**:
- Live health status updates without page refresh
- Alert acknowledgment functionality
- Health history trending with simple charts
- Filter and search capabilities for large tenant counts

**Success Criteria**:
- Real-time health monitoring interface operational
- Clear visual indicators for health status
- WebSocket updates working smoothly
- Alert management functionality working
- Performance optimized for monitoring many tenants

Please implement using React 18+ with TypeScript, Tailwind CSS for styling, and integration with existing WebSocket infrastructure.