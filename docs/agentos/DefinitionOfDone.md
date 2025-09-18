# Definition of Done (DoD)

An item is **Done** only when ALL of the following are true:

## Scope & Requirements
- [ ] **TRD Updated**: Technical requirements document reflects all changes
- [ ] **Acceptance Criteria Satisfied**: All PRD acceptance criteria met
- [ ] **Requirements Validated**: Product owner/stakeholder sign-off obtained

## Code Quality
- [ ] **Code Review Completed**: Reviewed by code-reviewer agent and human reviewer
- [ ] **No High-Severity Findings**: All critical and high-severity issues resolved
- [ ] **Coding Standards Met**: Follows project conventions and style guides
- [ ] **Technical Debt Addressed**: No new technical debt introduced without justification

## Testing Requirements
- [ ] **Unit Tests**: ≥80% coverage for new code
- [ ] **Integration Tests**: ≥70% coverage for integration points
- [ ] **E2E Tests**: Critical user journeys covered
- [ ] **All Tests Passing**: Unit, integration, and E2E tests green
- [ ] **Performance Tests**: Meets performance budgets (p95 < 200ms for APIs)

## Security Requirements
- [ ] **Input Validation**: All inputs properly validated and sanitized
- [ ] **Authentication/Authorization**: Proper AuthZ/AuthN rules implemented
- [ ] **Secrets Management**: No hardcoded secrets, proper secret handling
- [ ] **Security Scan**: Automated security scanning completed without high-risk findings
- [ ] **OWASP Compliance**: Common vulnerabilities addressed

## Performance Requirements
- [ ] **Performance Budget Met**: Meets or exceeds defined performance targets
- [ ] **Resource Usage Optimized**: CPU/memory usage within acceptable limits
- [ ] **Core Web Vitals**: Frontend changes meet Core Web Vitals targets
- [ ] **Database Performance**: Query performance analyzed and optimized

## Documentation Requirements
- [ ] **PR Description Clear**: What changed, why, and testing approach documented
- [ ] **CHANGELOG Updated**: User-facing changes documented
- [ ] **Migration Notes**: Database or breaking changes documented
- [ ] **Runbook Updates**: Operational procedures updated if needed
- [ ] **API Documentation**: API changes reflected in documentation

## Deployment Requirements
- [ ] **Deployment Plan**: Clear deployment strategy with rollback plan
- [ ] **Configuration Updates**: Environment configurations updated
- [ ] **Feature Flags**: Appropriate feature flagging for risk mitigation
- [ ] **Monitoring**: Appropriate monitoring and alerting configured

## Process Requirements  
- [ ] **Ticket Updated**: Status updated via MCP with links to PR, TRD, artifacts
- [ ] **Stakeholder Communication**: Relevant stakeholders informed of completion
- [ ] **Knowledge Transfer**: Documentation enables team members to maintain the feature

## Quality Gates Validation
- [ ] **Automated Checks**: All CI/CD pipeline checks passing
- [ ] **Manual Testing**: Exploratory testing completed for edge cases
- [ ] **Accessibility**: WCAG 2.1 AA compliance verified (for UI changes)
- [ ] **Browser Compatibility**: Tested across supported browsers (for UI changes)

## Final Validation
- [ ] **Production Readiness**: Feature ready for production deployment
- [ ] **Rollback Tested**: Rollback procedure validated
- [ ] **Success Metrics**: Success criteria and measurement plan defined

---

**Note**: This DoD should be enforced by the code-reviewer agent before any PR is approved. Items may be marked as "Not Applicable" with justification, but cannot be skipped without explicit approval.