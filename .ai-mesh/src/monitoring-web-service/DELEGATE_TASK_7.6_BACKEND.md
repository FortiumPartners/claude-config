@backend-developer

Please implement the backend services for Task 7.6: Support Tools Integration.

**Context**: External Metrics Web Service - Sprint 7 implementation focusing on customer support tools and workflows integration.

**Requirements**: 
Refer to `/Users/ldangelo/Development/fortium/claude-config/src/monitoring-web-service/task-7.6-implementation.md` for complete specifications.

**Key Focus Areas**:
1. External support system API integration (Zendesk/Freshdesk)
2. Secure tenant impersonation system with audit logging
3. Tenant context API for support agent information
4. Customer communication automation
5. Support ticket management workflow

**File Locations**:
- API routes: `src/routes/support/`
- Controllers: `src/controllers/support/`
- Services: `src/services/support-integration.js`
- Middleware: `src/middleware/impersonation.js`
- Models: `src/models/support-ticket.js`

**Implementation Requirements**:
- External ticket system webhook integration
- JWT-based impersonation tokens with time limits
- Comprehensive audit logging for all support actions
- Email template system for customer communications
- Secure log access with proper authorization

**Success Criteria**:
- External support system integration functional
- Tenant impersonation working with proper security controls
- Support context API providing relevant tenant information
- Communication automation working for common scenarios
- All support actions properly audited and logged

Please implement according to the existing codebase patterns and Node.js/TypeScript architecture.