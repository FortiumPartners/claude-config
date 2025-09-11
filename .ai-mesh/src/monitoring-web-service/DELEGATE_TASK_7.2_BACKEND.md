@backend-developer

Please implement the backend APIs for Task 7.2: Tenant Onboarding Wizard.

**Context**: External Metrics Web Service - Sprint 7 implementation focusing on automated tenant onboarding with guided setup process.

**Requirements**: 
Refer to `/Users/ldangelo/Development/fortium/claude-config/src/monitoring-web-service/task-7.2-implementation.md` for complete specifications.

**Key Focus Areas**:
1. Onboarding session management with step tracking
2. Automated tenant provisioning with schema creation
3. SSO configuration validation and testing
4. User invitation and welcome email workflow
5. Configuration templates for different tenant types

**File Locations**:
- API routes: `src/routes/onboarding/`
- Controllers: `src/controllers/onboarding/`
- Services: `src/services/tenant-provisioning.js`
- Email templates: `src/templates/onboarding/`

**Success Criteria**:
- Complete onboarding API workflow operational
- Automated tenant schema creation working
- SSO configuration validation with live testing
- Email notifications sent at appropriate steps
- Rollback capabilities for failed onboarding attempts

Please implement according to the existing codebase patterns and Node.js/TypeScript architecture.