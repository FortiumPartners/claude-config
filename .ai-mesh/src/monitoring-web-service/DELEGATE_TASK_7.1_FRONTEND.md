@react-component-architect

Please implement the frontend components for Task 7.1: Super Admin Panel for Tenant Management.

**Context**: External Metrics Web Service - Sprint 7 implementation focusing on multi-tenant admin interface with comprehensive tenant management.

**Requirements**: 
Refer to `/Users/ldangelo/Development/fortium/claude-config/src/monitoring-web-service/task-7.1-implementation.md` for complete specifications.

**Key Components to Implement**:
1. **TenantListView**: Searchable, sortable table with bulk actions
2. **TenantDetailsModal**: Complete tenant configuration and metrics
3. **TenantCreateForm**: Multi-step wizard for tenant setup
4. **TenantEditForm**: Configuration updates with real-time validation
5. **UserManagementPanel**: Cross-tenant user administration
6. **SystemHealthDashboard**: Real-time system monitoring

**File Locations**:
- Components: `src/components/admin/`
- Pages: `src/pages/admin/`
- Hooks: `src/hooks/useAdminApi.ts`
- Types: `src/types/admin.ts`

**Design Requirements**:
- Consistent with existing dashboard design system
- Responsive design for desktop and tablet
- Role-based UI elements (super admin only features)
- Real-time updates via WebSocket integration
- Accessibility compliance (WCAG 2.1 AA)

**Success Criteria**:
- Complete admin workflow for tenant management
- Intuitive user experience for complex operations
- Proper error handling and validation feedback
- Real-time system health monitoring
- All components properly tested and documented

Please implement using React 18+ with TypeScript, Tailwind CSS for styling, and React Query for data management.