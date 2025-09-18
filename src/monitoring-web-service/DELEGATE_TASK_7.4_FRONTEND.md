@react-component-architect

Please implement the frontend components for Task 7.4: Admin Reporting Dashboard.

**Context**: External Metrics Web Service - Sprint 7 implementation focusing on comprehensive admin analytics and business intelligence interface.

**Requirements**: 
Refer to `/Users/ldangelo/Development/fortium/claude-config/src/monitoring-web-service/task-7.4-implementation.md` for complete specifications.

**Key Components to Implement**:
1. **AdminDashboardOverview**: Executive-level KPI summary with key metrics
2. **TenantAnalyticsGrid**: Comparison grid with sortable tenant metrics
3. **UsageMetricsChart**: Time-series charts for usage patterns
4. **RevenueReportCard**: Revenue analytics with growth indicators
5. **SystemHealthPanel**: Real-time infrastructure monitoring
6. **AlertsNotificationCenter**: Active alerts with severity levels
7. **ReportExportModal**: Export options with date range selection
8. **TenantPerformanceRanking**: Top performers and growth leaders

**File Locations**:
- Components: `src/components/admin/reports/`
- Pages: `src/pages/admin/reports/`
- Hooks: `src/hooks/useAdminReports.ts`
- Types: `src/types/admin-reports.ts`
- Charts: `src/components/charts/`

**Design Requirements**:
- Executive-level dashboard design suitable for C-suite presentations
- Data visualization with Chart.js or D3.js integration
- Real-time updates via WebSocket for live metrics
- Responsive design optimized for large screens and tablets
- Export functionality with loading states and progress indicators
- Color-coded health indicators and alert levels

**Key Features**:
- Interactive charts with drill-down capabilities
- Date range filtering for historical analysis
- Real-time system health monitoring
- Export to PDF/CSV with custom branding
- Alert management with acknowledgment and resolution tracking

**Success Criteria**:
- Comprehensive admin analytics interface operational
- Charts and visualizations rendering correctly with real data
- Export functionality generating professional reports
- Real-time updates working seamlessly
- Performance optimized for large datasets and multiple charts

Please implement using React 18+ with TypeScript, Tailwind CSS for styling, Chart.js for data visualization, and React Query for data management.