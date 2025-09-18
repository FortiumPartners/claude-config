@backend-developer

Please implement the backend APIs for Task 7.1: Super Admin Panel for Tenant Management.

**Context**: External Metrics Web Service - Sprint 7 implementation focusing on multi-tenant admin interface with complete CRUD operations.

**Requirements**: 
Refer to `/Users/ldangelo/Development/fortium/claude-config/src/monitoring-web-service/task-7.1-implementation.md` for complete specifications.

**Key Focus Areas**:
1. Admin tenant management APIs with proper authorization
2. Multi-tenant user management endpoints  
3. System health monitoring APIs
4. Audit logging for all admin operations
5. Tenant suspension/activation functionality

**File Locations**:
- API routes: `src/routes/admin/`
- Controllers: `src/controllers/admin/`
- Middleware: `src/middleware/admin-auth.js`
- Models: Update existing tenant/user models

**Success Criteria**:
- All admin API endpoints working with proper authorization
- Tenant CRUD operations with schema management
- User management across tenants
- System health metrics API
- Comprehensive audit logging

Please implement according to the existing codebase patterns and Node.js/TypeScript architecture.