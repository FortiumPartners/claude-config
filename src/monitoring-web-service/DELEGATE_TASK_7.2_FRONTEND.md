@react-component-architect

Please implement the frontend components for Task 7.2: Tenant Onboarding Wizard.

**Context**: External Metrics Web Service - Sprint 7 implementation focusing on automated tenant onboarding with comprehensive guided setup.

**Requirements**: 
Refer to `/Users/ldangelo/Development/fortium/claude-config/src/monitoring-web-service/task-7.2-implementation.md` for complete specifications.

**Key Components to Implement**:
1. **OnboardingWizard**: Multi-step wizard with progress tracking
2. **TenantInfoStep**: Company/organization information collection
3. **SSOConfigurationStep**: SSO provider setup with validation
4. **UserInvitationStep**: Admin setup and team member invitations
5. **FeatureSelectionStep**: Feature enablement and configuration
6. **BillingSetupStep**: Subscription and billing information
7. **ReviewStep**: Configuration review and confirmation
8. **CompletionStep**: Success page with next steps

**File Locations**:
- Components: `src/components/onboarding/`
- Pages: `src/pages/onboarding/`
- Hooks: `src/hooks/useOnboarding.ts`
- Types: `src/types/onboarding.ts`

**Design Requirements**:
- Multi-step wizard with clear progress indicator
- Form validation with real-time feedback
- Auto-save functionality to prevent data loss
- Responsive design for desktop and tablet
- Accessibility compliance (WCAG 2.1 AA)
- Loading states and error handling

**Success Criteria**:
- Intuitive step-by-step onboarding experience
- Real-time validation and helpful error messages
- Smooth navigation between steps with data persistence
- Clear visual progress indication
- Comprehensive error handling with recovery options

Please implement using React 18+ with TypeScript, Tailwind CSS for styling, and React Hook Form for form management.