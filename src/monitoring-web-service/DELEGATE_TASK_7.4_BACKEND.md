@backend-developer

Please implement the backend APIs for Task 7.4: Admin Reporting Dashboard.

**Context**: External Metrics Web Service - Sprint 7 implementation focusing on comprehensive admin analytics and reporting capabilities.

**Requirements**: 
Refer to `/Users/ldangelo/Development/fortium/claude-config/src/monitoring-web-service/task-7.4-implementation.md` for complete specifications.

**Key Focus Areas**:
1. Analytics aggregation queries across all tenants
2. Revenue and billing analytics calculations
3. System health metrics collection
4. Report export functionality (PDF/CSV)
5. Real-time metrics API for dashboard updates

**File Locations**:
- API routes: `src/routes/admin/reports/`
- Controllers: `src/controllers/admin/reports/`
- Services: `src/services/analytics-service.js`
- Utils: `src/utils/report-generator.js`
- Queries: `src/queries/admin-analytics.js`

**Analytics Requirements**:
- Cross-tenant metrics aggregation with proper performance optimization
- Revenue calculations from subscription and usage data
- System performance metrics from monitoring data
- Growth metrics and trend calculations
- Export generation with PDF/CSV formatting

**Performance Considerations**:
- Database query optimization for large datasets
- Caching of frequently requested analytics
- Background processing for complex report generation
- Efficient data aggregation strategies

**Success Criteria**:
- All admin reporting endpoints operational with <2s response times
- Revenue calculations accurate and consistent with billing data
- System health metrics reflecting real infrastructure status
- Export functionality generating properly formatted reports
- Analytics queries optimized for performance at scale

Please implement according to the existing codebase patterns and Node.js/TypeScript architecture.