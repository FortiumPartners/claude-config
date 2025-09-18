@backend-developer

Please implement the backend APIs for Task 7.3: Subscription & Billing Integration.

**Context**: External Metrics Web Service - Sprint 7 implementation focusing on subscription management with Stripe and enterprise billing integration.

**Requirements**: 
Refer to `/Users/ldangelo/Development/fortium/claude-config/src/monitoring-web-service/task-7.3-implementation.md` for complete specifications.

**Key Focus Areas**:
1. Stripe API integration for subscription management
2. Usage tracking middleware for all API endpoints
3. Webhook handling for billing events (payment success/failure)
4. Enterprise billing workflow with custom contracts
5. Usage-based pricing calculations and overage handling

**File Locations**:
- API routes: `src/routes/billing/`
- Controllers: `src/controllers/billing/`
- Services: `src/services/stripe-service.js`
- Middleware: `src/middleware/usage-tracking.js`
- Models: `src/models/subscription.js`, `src/models/usage.js`

**Integration Requirements**:
- Stripe SDK integration with webhook handling
- Usage metrics collection from existing metrics system
- Plan limits enforcement in API middleware
- Automated billing cycle processing
- Failed payment retry logic and notifications

**Success Criteria**:
- Stripe subscription lifecycle fully operational
- Usage tracking accurate across all API endpoints
- Webhook events processed reliably
- Plan limits enforced properly
- Enterprise billing workflow ready for custom contracts

Please implement according to the existing codebase patterns and Node.js/TypeScript architecture.