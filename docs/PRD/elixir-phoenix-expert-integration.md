# Product Requirements Document: Elixir/Phoenix Expert Agent Integration

**Document Version**: 1.0
**Created**: 2025-10-11
**Status**: Draft
**Author**: Product Management Orchestrator
**Stakeholders**: Development Teams, Elixir/Phoenix Engineers, Technical Leads, Platform Architects

---

## Executive Summary

This PRD defines the integration of the elixir-phoenix-expert agent into the Claude Code configuration toolkit's agent mesh ecosystem. The agent brings specialized expertise in Elixir functional programming, Phoenix framework development, OTP design patterns, and Phoenix LiveView real-time features to support full-stack development within the Elixir/Phoenix ecosystem.

The integration enhances the toolkit's 29+ agent ecosystem with comprehensive Elixir/Phoenix capabilities, positioning it alongside established framework specialists (rails-backend-expert, nestjs-backend-expert, react-component-architect) while maintaining the approval-first orchestration and quality gate enforcement that has achieved 35-40% productivity improvements.

**Expected Impact**: Enable Elixir/Phoenix development teams to leverage the proven AI-augmented development process, achieving 30%+ productivity gains through specialized expertise in functional programming, OTP patterns, real-time features, and production-ready deployment strategies.

---

## Problem Statement

### Current State

The Claude Code configuration toolkit currently supports multiple backend frameworks (Rails, NestJS) and frontend technologies (React, general framework-agnostic development) through specialized agents. However, there is **no specialized support for Elixir/Phoenix development**, despite Elixir/Phoenix being a powerful platform for:

- **Real-time web applications** with Phoenix LiveView
- **Fault-tolerant distributed systems** with OTP supervision trees
- **High-performance concurrent processing** with Elixir's actor model
- **Full-stack development** combining backend services and interactive UIs

### Pain Points

1. **No Elixir/Phoenix Expertise**: Development teams using Elixir/Phoenix cannot leverage specialized AI assistance for framework-specific patterns, OTP design, or LiveView development
2. **Generic Backend Agent Limitations**: The general-purpose backend-developer agent lacks deep Elixir functional programming knowledge and Phoenix-specific conventions
3. **Missing Real-Time UI Patterns**: Phoenix LiveView's unique approach to real-time interactive UIs without JavaScript frameworks is not supported
4. **OTP Pattern Gap**: Complex GenServer implementations, supervision trees, and fault tolerance patterns require specialized expertise not available in general agents
5. **Production Deployment Complexity**: Elixir/Phoenix deployment, release management, and distributed system configuration need framework-specific guidance

### User Impact

**Elixir/Phoenix Development Teams** currently experience:
- Longer development cycles due to lack of specialized AI assistance
- Higher error rates when implementing OTP patterns and supervision trees
- Missed opportunities for performance optimization through Elixir-specific patterns
- Inconsistent code quality without framework-specific best practice enforcement
- Reduced productivity compared to teams using supported frameworks (Rails, NestJS, React)

### Business Impact

- **Productivity Gap**: Elixir/Phoenix teams cannot achieve the 35-40% productivity improvements validated for other frameworks
- **Competitive Disadvantage**: Organizations using Elixir/Phoenix stack cannot fully leverage the AI-augmented development toolkit
- **Market Limitation**: The toolkit's value proposition is limited for Elixir/Phoenix development organizations
- **Quality Risk**: Without specialized review and validation, Elixir/Phoenix code may not follow best practices for fault tolerance and scalability

---

## Goals / Non-Goals

### Goals

#### Primary Goals

1. **Framework Parity**: Provide Elixir/Phoenix teams with specialized agent support equivalent to Rails and NestJS backend frameworks
2. **Full-Stack Coverage**: Support both backend (Phoenix APIs, business logic, OTP patterns) and frontend (Phoenix LiveView real-time UIs) development
3. **OTP Excellence**: Deliver expert-level guidance on GenServer, Supervisor trees, fault tolerance, and distributed system patterns
4. **Production Readiness**: Enable deployment optimization, performance tuning, and scalability patterns for production Elixir applications
5. **Productivity Achievement**: Achieve 30%+ productivity improvements for Elixir/Phoenix development teams through specialized expertise

#### Secondary Goals

6. **Integration Completeness**: Seamless integration with existing orchestrators (tech-lead-orchestrator, ai-mesh-orchestrator) and quality agents (code-reviewer, test-runner)
7. **Context7 Integration**: Leverage Context7 MCP server for latest Elixir/Phoenix documentation and best practices
8. **Testing Excellence**: Support ExUnit testing strategies with comprehensive test coverage (≥80% models, ≥70% integration)
9. **Performance Optimization**: Guide implementation of Elixir-specific optimizations (ETS caching, process pooling, query optimization)
10. **Real-Time Feature Expertise**: Expert guidance on Phoenix Channels, PubSub, and LiveView patterns for interactive applications

#### Success Metrics

- **30%+ Productivity Increase**: Elixir/Phoenix development speed improvement (baseline: pre-integration velocity)
- **50%+ Error Reduction**: Decrease in OTP pattern errors, LiveView bugs, and production issues
- **≥80% Test Coverage**: Unit test coverage for Phoenix contexts, models, and LiveView components
- **≥90% Agent Success Rate**: Successful task completion rate for elixir-phoenix-expert delegations
- **< 200ms API Response**: P95 response times for Phoenix API endpoints
- **User Satisfaction**: ≥90% satisfaction score from Elixir/Phoenix development teams

### Non-Goals

#### Explicit Scope Boundaries

1. **Not Creating New Language Support**: This integration assumes Elixir language fundamentals are understood; not teaching Elixir syntax from scratch
2. **Not Replacing Human Architecture**: Complex distributed system architecture decisions still require human architect review and approval
3. **Not Supporting Other Erlang/BEAM Frameworks**: This agent focuses specifically on Phoenix; other frameworks (Plug, Broadway) are out of scope
4. **Not Handling Infrastructure Provisioning**: Cloud infrastructure and Kubernetes deployment are delegated to infrastructure-management-subagent
5. **Not Providing Database Schema Design**: Complex PostgreSQL schema design is delegated to postgresql-specialist
6. **Not Creating Custom Testing Frameworks**: Uses standard ExUnit; custom test framework development is out of scope
7. **Not Supporting Elixir < 1.14**: Focuses on modern Elixir (≥1.14) and Phoenix (≥1.7) versions with latest patterns

---

## Users / Personas

### Primary User Personas

#### Persona 1: Senior Elixir/Phoenix Engineer

**Profile**:
- **Role**: Senior Backend Developer, Technical Lead
- **Experience**: 3-5 years Elixir/Phoenix, expert in OTP patterns and distributed systems
- **Use Case**: Building production-grade Phoenix APIs, implementing complex GenServer patterns, optimizing performance

**Needs**:
- Expert-level OTP pattern guidance and supervision tree design
- Performance optimization recommendations (ETS caching, process pooling)
- Production deployment strategies and distributed system configuration
- Code review focused on Elixir/Phoenix best practices and fault tolerance

**Pain Points**:
- Need quick validation of complex GenServer implementations and supervision strategies
- Want automated detection of common OTP anti-patterns and performance bottlenecks
- Require consistent code review standards across team for Elixir-specific patterns
- Lack specialized AI assistance for Elixir compared to other language ecosystems

**Success Criteria**:
- Faster implementation of complex OTP patterns with expert guidance
- Reduced code review cycles through automated Elixir-specific validation
- Improved production stability through better fault tolerance design
- Consistent team adherence to Elixir/Phoenix best practices

#### Persona 2: Full-Stack Phoenix Developer

**Profile**:
- **Role**: Full-Stack Developer, Product Engineer
- **Experience**: 1-3 years Elixir/Phoenix, building Phoenix LiveView applications
- **Use Case**: Creating interactive real-time UIs with LiveView, integrating with Phoenix backends

**Needs**:
- Phoenix LiveView component patterns and state management guidance
- Integration patterns between LiveView frontend and Phoenix API backend
- Real-time feature implementation (Phoenix Channels, PubSub)
- Accessibility and performance best practices for LiveView components

**Pain Points**:
- Struggle with complex LiveView state management and event handling
- Uncertain about best practices for LiveView component composition
- Need guidance on optimizing LiveView performance and reducing server load
- Want faster development of real-time features without JavaScript framework complexity

**Success Criteria**:
- Faster LiveView component development with expert patterns
- Better LiveView performance through optimization guidance
- Consistent real-time feature quality across applications
- Reduced time debugging LiveView state and event handling issues

#### Persona 3: Backend Developer New to Elixir/Phoenix

**Profile**:
- **Role**: Backend Developer transitioning from Ruby/Rails, Node.js, or Python
- **Experience**: < 1 year Elixir/Phoenix, experienced in other backend frameworks
- **Use Case**: Learning Elixir functional programming patterns, Phoenix MVC, basic OTP concepts

**Needs**:
- Clear explanations of Elixir functional programming concepts and Phoenix conventions
- Guidance on translating patterns from other frameworks to Elixir/Phoenix idioms
- Step-by-step assistance with basic GenServer and Supervisor implementations
- Testing strategies and ExUnit patterns for Phoenix applications

**Pain Points**:
- Overwhelmed by functional programming paradigm shift and OTP concepts
- Uncertain how to structure Phoenix contexts and organize business logic
- Need help understanding "let it crash" philosophy and supervision strategies
- Want faster onboarding to achieve productivity in Elixir/Phoenix ecosystem

**Success Criteria**:
- Accelerated learning curve with guided Elixir/Phoenix development
- Confidence implementing basic OTP patterns with expert validation
- Consistent code quality during transition period
- Faster time-to-productivity compared to traditional learning approaches

#### Persona 4: Technical Lead / Architect

**Profile**:
- **Role**: Technical Lead, Engineering Manager, Solution Architect
- **Experience**: 5+ years Elixir/Phoenix, responsible for architecture decisions and team standards
- **Use Case**: Establishing team conventions, code review standards, architecture patterns

**Needs**:
- Consistent enforcement of Elixir/Phoenix best practices across team
- Automated code review for common patterns and anti-patterns
- Guidance on scalability and performance optimization strategies
- Architecture validation for complex distributed systems

**Pain Points**:
- Difficult to maintain consistent code quality across team with varying experience levels
- Code review bottleneck when validating Elixir-specific patterns manually
- Need standardized patterns for common use cases (background jobs, real-time features)
- Want data-driven insights into team productivity and code quality metrics

**Success Criteria**:
- Consistent code quality across team through automated validation
- Reduced code review time with Elixir-specific automated checks
- Improved team velocity with standardized patterns and guidance
- Better architecture decisions supported by expert recommendations

### Secondary User Personas

#### Persona 5: QA Engineer / Test Automation Specialist

**Profile**:
- **Role**: QA Engineer, Test Automation Developer
- **Experience**: Familiar with ExUnit, testing Phoenix applications
- **Use Case**: Writing comprehensive tests for Phoenix APIs and LiveView components

**Needs**:
- ExUnit test pattern guidance and coverage improvement strategies
- LiveView component testing approaches and best practices
- Integration testing patterns for Phoenix Channels and PubSub
- Performance testing strategies for Elixir applications

**Pain Points**:
- Uncertain about best practices for testing LiveView components
- Need guidance on mocking external services and testing async processes
- Want faster test execution with proper ExUnit configuration
- Require consistent testing standards across team

**Success Criteria**:
- Higher test coverage with comprehensive ExUnit tests
- Faster test execution with optimized ExUnit configuration
- Better LiveView component test reliability
- Consistent testing patterns across team

---

## Use Cases

### Use Case 1: Phoenix API Development with OTP Patterns

**Scenario**: Senior Elixir Engineer building production-grade Phoenix API with GenServer state management

**Actor**: Senior Elixir/Phoenix Engineer

**Trigger**: Technical lead orchestrator delegates Phoenix API implementation task from TRD

**Preconditions**:
- TRD exists with API specifications, business logic requirements, and OTP pattern needs
- Database schema designed (by postgresql-specialist if complex)
- Authentication/authorization requirements defined

**Normal Flow**:
1. ai-mesh-orchestrator receives API implementation request
2. Delegates to elixir-phoenix-expert based on Elixir/Phoenix framework detection
3. elixir-phoenix-expert fetches latest Phoenix documentation from Context7
4. Agent analyzes TRD requirements and existing codebase structure
5. Implements Phoenix controllers with proper action organization
6. Creates GenServer for stateful business logic with supervision
7. Implements Ecto schemas, changesets, and database operations
8. Writes ExUnit tests for controllers, GenServers, and database logic
9. Delegates to code-reviewer for Elixir-specific security and performance validation
10. Delegates to test-runner for ExUnit test execution
11. Returns complete implementation with test results and documentation

**Postconditions**:
- Phoenix API endpoints implemented with proper routing
- GenServer implemented with supervision tree
- Ecto operations optimized with proper indexing
- ExUnit tests passing with ≥80% coverage
- Code review completed with no high-severity findings
- Documentation updated with API specifications

**Alternative Flows**:
- **3a**: Context7 unavailable → Use embedded Elixir/Phoenix knowledge base
- **6a**: Complex distributed state required → Consult human architect, implement with explicit approval
- **9a**: Code review fails → Agent fixes issues, re-submits for review
- **10a**: Tests fail → Agent analyzes failures, fixes issues, re-runs tests

**Business Value**:
- Faster Phoenix API development with expert OTP patterns
- Higher code quality through Elixir-specific validation
- Better production stability with proper supervision trees
- Consistent API patterns across team

### Use Case 2: Phoenix LiveView Real-Time UI Development

**Scenario**: Full-Stack Developer creating interactive Phoenix LiveView component for real-time data dashboard

**Actor**: Full-Stack Phoenix Developer

**Trigger**: Frontend development task requiring real-time UI with Phoenix LiveView

**Preconditions**:
- TRD specifies LiveView component requirements and real-time data needs
- Backend Phoenix API provides data via Phoenix Channels or direct queries
- Design mockups and interaction patterns defined

**Normal Flow**:
1. tech-lead-orchestrator analyzes task and identifies LiveView requirement
2. Delegates to elixir-phoenix-expert (not frontend-developer due to LiveView specificity)
3. Agent fetches latest LiveView patterns and best practices from Context7
4. Implements LiveView module with proper mount and handle_event callbacks
5. Designs LiveView component state management with assigns
6. Implements Phoenix Channel integration for real-time data updates
7. Optimizes LiveView rendering with streams and targeted updates
8. Ensures accessibility (semantic HTML, ARIA attributes, keyboard navigation)
9. Writes LiveView component tests with live_isolated
10. Delegates to playwright-tester for E2E testing of real-time interactions
11. Delegates to code-reviewer for accessibility and performance validation
12. Returns complete LiveView implementation with tests and documentation

**Postconditions**:
- LiveView component implemented with proper state management
- Real-time updates working via Phoenix Channels or PubSub
- Accessibility standards met (WCAG 2.1 AA)
- LiveView component tests passing
- E2E tests validating real-time interactions
- Performance optimized (< 16ms render time)

**Alternative Flows**:
- **5a**: Complex client-side interaction required → Implement LiveView hooks with JavaScript interop
- **6a**: High-frequency updates needed → Optimize with PubSub and batching strategies
- **8a**: Accessibility validation fails → Fix semantic HTML and ARIA attributes
- **10a**: E2E tests flaky → Improve test reliability with proper wait strategies

**Business Value**:
- Faster real-time UI development without JavaScript framework complexity
- Consistent LiveView patterns across team
- Better accessibility through automated validation
- Improved performance with Elixir-specific optimizations

### Use Case 3: Complex OTP Pattern Implementation (GenServer, Supervisor)

**Scenario**: Implementing fault-tolerant background job processing with GenServer pool and Supervisor tree

**Actor**: Senior Elixir/Phoenix Engineer

**Trigger**: TRD requires reliable background processing with fault tolerance

**Preconditions**:
- Business logic requirements defined
- Performance targets specified (throughput, latency)
- Fault tolerance strategy outlined in TRD

**Normal Flow**:
1. tech-lead-orchestrator delegates OTP pattern implementation to elixir-phoenix-expert
2. Agent analyzes requirements for GenServer pool size, supervision strategy
3. Implements GenServer module with proper state management and callbacks
4. Designs Supervisor tree with restart strategies (one_for_one, one_for_all, rest_for_one)
5. Implements process pooling with :poolboy or custom pool
6. Adds monitoring and telemetry for GenServer health and performance
7. Writes comprehensive ExUnit tests including crash scenarios
8. Documents supervision tree design and restart strategies
9. Delegates to code-reviewer for OTP pattern validation
10. Delegates to test-runner for ExUnit execution including fault scenarios
11. Returns production-ready OTP implementation with documentation

**Postconditions**:
- GenServer implemented with proper state and callbacks
- Supervisor tree configured with appropriate restart strategies
- Process pool optimized for throughput requirements
- Fault tolerance validated through crash simulation tests
- Monitoring and telemetry integrated
- Documentation includes supervision tree diagram

**Alternative Flows**:
- **3a**: Distributed state required → Implement with :global registry or Horde
- **4a**: Custom restart logic needed → Implement custom Supervisor module
- **7a**: Race conditions detected → Add proper synchronization and message handling
- **9a**: OTP anti-patterns detected → Refactor with proper patterns, re-submit review

**Business Value**:
- Reliable background processing with automatic fault recovery
- Better system stability through proper supervision
- Faster development of complex OTP patterns
- Consistent OTP implementation across team

### Use Case 4: Ecto Database Operations and Query Optimization

**Scenario**: Optimizing slow Phoenix API endpoints with complex Ecto queries and database operations

**Actor**: Senior Elixir/Phoenix Engineer, potentially collaborating with postgresql-specialist

**Trigger**: Performance issue identified in production Phoenix API or proactive optimization task

**Preconditions**:
- Slow query identified through monitoring or profiling
- Performance targets defined (P95 response time < 200ms)
- Database schema and relationships understood

**Normal Flow**:
1. Performance issue delegated to elixir-phoenix-expert
2. Agent analyzes Ecto queries for N+1 problems and missing preloads
3. Implements query optimization (preload, join, select, subquery)
4. Identifies missing database indexes, delegates to postgresql-specialist for complex index design
5. Implements Ecto query caching or ETS caching for frequently accessed data
6. Adds database connection pooling optimization
7. Implements query result streaming for large datasets
8. Writes ExUnit tests validating query correctness and performance
9. Validates performance improvement meets P95 < 200ms target
10. Delegates to code-reviewer for performance validation
11. Returns optimized implementation with performance metrics

**Postconditions**:
- Ecto queries optimized with proper preloads and joins
- N+1 query problems eliminated
- Database indexes added where needed
- Performance targets met (P95 < 200ms)
- Caching strategy implemented where appropriate
- Tests validate correctness and performance

**Alternative Flows**:
- **3a**: Complex query optimization needed → Collaborate with postgresql-specialist for raw SQL
- **5a**: Cache invalidation strategy needed → Implement proper cache key design and invalidation
- **9a**: Performance target not met → Further optimization or architectural consultation required

**Business Value**:
- Faster API response times improving user experience
- Reduced database load through query optimization
- Better scalability with efficient queries
- Consistent performance optimization patterns

### Use Case 5: Phoenix Channels and Real-Time Communication

**Scenario**: Implementing real-time chat or notification system with Phoenix Channels and PubSub

**Actor**: Full-Stack Phoenix Developer

**Trigger**: TRD requires real-time bidirectional communication feature

**Preconditions**:
- Real-time communication requirements defined (chat, notifications, live updates)
- Authentication and authorization strategy established
- Scalability requirements specified (concurrent connections, message throughput)

**Normal Flow**:
1. tech-lead-orchestrator delegates real-time feature to elixir-phoenix-expert
2. Agent analyzes requirements for Channel design and PubSub topics
3. Implements Phoenix Channel module with proper join authorization
4. Designs Channel event handlers (handle_in, handle_out)
5. Implements PubSub integration for cross-process/node communication
6. Adds Channel presence tracking if needed (Phoenix.Presence)
7. Implements client-side Channel integration (Phoenix.js)
8. Writes ExUnit tests for Channel authorization and message handling
9. Implements monitoring and rate limiting for Channel connections
10. Delegates to playwright-tester for E2E real-time feature testing
11. Delegates to code-reviewer for security validation (authorization, rate limiting)
12. Returns complete real-time feature with tests and documentation

**Postconditions**:
- Phoenix Channel implemented with proper authorization
- PubSub integration working for message distribution
- Real-time communication tested end-to-end
- Security validated (authorization, rate limiting)
- Scalability tested (concurrent connections)
- Documentation includes Channel API and client integration

**Alternative Flows**:
- **3a**: Complex authorization logic needed → Implement custom Channel authorization function
- **6a**: Distributed deployment required → Configure PubSub for multi-node communication
- **9a**: DDoS risk identified → Implement connection rate limiting and backpressure

**Business Value**:
- Reliable real-time communication features
- Scalable architecture supporting growth
- Secure Channel implementation protecting against abuse
- Faster development of real-time features

### Use Case 6: Oban Background Jobs and Task Processing

**Scenario**: Implementing reliable background job processing with Oban for email sending, data processing, or scheduled tasks

**Actor**: Senior Elixir/Phoenix Engineer

**Trigger**: TRD requires asynchronous task processing or scheduled jobs

**Preconditions**:
- Background job requirements defined (task type, scheduling, retry strategy)
- Database configured for Oban (oban_jobs table)
- Performance and reliability targets specified

**Normal Flow**:
1. tech-lead-orchestrator delegates background job implementation to elixir-phoenix-expert
2. Agent analyzes requirements for Oban worker design
3. Implements Oban worker module with perform/1 callback
4. Configures Oban queue with concurrency and rate limiting
5. Implements retry strategy with proper error handling
6. Adds Oban job scheduling (cron, scheduled jobs, recurring tasks)
7. Implements job monitoring and failure alerting
8. Writes ExUnit tests for job execution, retry logic, and error scenarios
9. Validates job idempotency and crash recovery
10. Delegates to code-reviewer for job reliability validation
11. Returns production-ready background job system with documentation

**Postconditions**:
- Oban workers implemented with proper error handling
- Retry strategies configured for transient failures
- Job scheduling configured as needed (cron, scheduled)
- Monitoring and alerting integrated
- Tests validate job execution and failure scenarios
- Documentation includes job architecture and retry behavior

**Alternative Flows**:
- **5a**: Custom retry logic needed → Implement with backoff strategies and max attempts
- **6a**: Complex scheduling required → Implement with Oban.Cron or quantum scheduler
- **9a**: Non-idempotent job detected → Refactor for idempotency with job state tracking

**Business Value**:
- Reliable background processing with automatic retries
- Better system scalability through async processing
- Consistent job patterns across team
- Faster development of background features

### Use Case 7: Elixir/Phoenix Production Deployment Optimization

**Scenario**: Optimizing Phoenix application for production deployment with release management and configuration

**Actor**: Senior Elixir/Phoenix Engineer, collaborating with infrastructure-management-subagent

**Trigger**: Production deployment preparation or post-deployment optimization task

**Preconditions**:
- Phoenix application ready for production deployment
- Infrastructure provisioned (by infrastructure-management-subagent)
- Deployment requirements defined (zero-downtime, blue-green, etc.)

**Normal Flow**:
1. deployment-orchestrator delegates Elixir-specific deployment optimization to elixir-phoenix-expert
2. Agent configures Elixir release with mix release
3. Implements runtime configuration with config/runtime.exs
4. Optimizes VM flags for production (schedulers, memory)
5. Configures distributed Erlang if multi-node deployment needed
6. Implements health check endpoint for load balancer
7. Configures telemetry and monitoring (AppSignal, New Relic, Prometheus)
8. Implements graceful shutdown handling
9. Documents deployment process and runbook procedures
10. Collaborates with infrastructure-management-subagent for container optimization
11. Validates deployment in staging environment
12. Returns production-ready release configuration with deployment documentation

**Postconditions**:
- Elixir release configured with optimized settings
- Runtime configuration externalized
- Health checks and monitoring integrated
- Deployment documentation complete
- Staging validation successful
- Zero-downtime deployment strategy documented

**Alternative Flows**:
- **5a**: Distributed deployment required → Configure libcluster for node discovery
- **7a**: Custom metrics needed → Implement with Telemetry.Metrics
- **11a**: Staging validation fails → Troubleshoot and fix issues before production

**Business Value**:
- Reliable production deployments with zero downtime
- Optimized performance in production environment
- Better observability through monitoring and telemetry
- Faster troubleshooting with comprehensive documentation

---

## Acceptance Criteria

### Functional Requirements

#### AC1: Agent Integration and Discovery

**Given** the elixir-phoenix-expert agent is deployed to the agent mesh
**When** a development task involves Elixir/Phoenix framework
**Then** ai-mesh-orchestrator or tech-lead-orchestrator should correctly delegate to elixir-phoenix-expert
**And** the delegation should follow the specialist delegation logic defined in agents/README.md
**And** the agent should be discoverable in the agent mesh ecosystem

**Validation**:
- [ ] Agent file exists at `/agents/elixir-phoenix-expert.md`
- [ ] Agent listed in `/agents/README.md` specialist delegation matrix
- [ ] Orchestrators correctly route Elixir/Phoenix tasks to specialist agent
- [ ] Agent responds successfully to delegated tasks

#### AC2: Elixir/Phoenix Code Implementation

**Given** elixir-phoenix-expert receives a Phoenix API implementation task
**When** the agent implements the Phoenix controllers, contexts, and Ecto schemas
**Then** the code should follow Phoenix conventions and Elixir style guide
**And** all code should be properly organized in Phoenix directory structure (controllers, contexts, schemas)
**And** implementation should include proper error handling and validation

**Validation**:
- [ ] Phoenix controllers follow RESTful conventions
- [ ] Ecto schemas include proper validations and changesets
- [ ] Phoenix contexts properly encapsulate business logic
- [ ] Code follows Elixir style guide (naming, indentation, pattern matching)
- [ ] Error handling implemented with proper {:ok, _} and {:error, _} tuples

#### AC3: OTP Pattern Implementation

**Given** elixir-phoenix-expert receives a task requiring GenServer or Supervisor implementation
**When** the agent implements OTP patterns
**Then** GenServer should follow proper callback structure (init, handle_call, handle_cast, handle_info)
**And** Supervisor tree should use appropriate restart strategies
**And** fault tolerance should be validated through crash scenarios

**Validation**:
- [ ] GenServer implements required callbacks properly
- [ ] Supervisor configured with correct restart strategy (one_for_one, etc.)
- [ ] Fault tolerance tested with process crash simulations
- [ ] State management properly implemented with immutable data
- [ ] Process registration and naming follows conventions

#### AC4: Phoenix LiveView Implementation

**Given** elixir-phoenix-expert receives a LiveView component development task
**When** the agent implements the LiveView module
**Then** LiveView should follow proper lifecycle (mount, handle_event, handle_info, render)
**And** state management should use Phoenix.LiveView.assign correctly
**And** real-time updates should be implemented with Phoenix.PubSub or Channels

**Validation**:
- [ ] LiveView module implements required callbacks (mount, render)
- [ ] Event handlers properly implemented (handle_event)
- [ ] State properly managed with assign/3 and update/3
- [ ] Real-time updates working via PubSub or Channels
- [ ] Accessibility standards met (semantic HTML, ARIA)

#### AC5: Ecto Database Operations

**Given** elixir-phoenix-expert implements database operations
**When** Ecto queries are written
**Then** queries should avoid N+1 problems with proper preloading
**And** changesets should include proper validation and casting
**And** migrations should be idempotent and reversible

**Validation**:
- [ ] Ecto queries use preload or join for associations
- [ ] N+1 queries eliminated (validated with Ecto query logging)
- [ ] Changesets include validations and proper error messages
- [ ] Migrations are idempotent (can run multiple times safely)
- [ ] Migration rollback (down) functions implemented

#### AC6: ExUnit Testing Implementation

**Given** elixir-phoenix-expert implements Phoenix code
**When** the agent writes tests
**Then** ExUnit tests should cover controllers, contexts, and database logic
**And** test coverage should meet ≥80% for core business logic
**And** tests should include both success and error scenarios

**Validation**:
- [ ] ExUnit tests written for all major functions
- [ ] Test coverage ≥80% for contexts and business logic
- [ ] Controller tests include request/response validation
- [ ] LiveView tests use live_isolated or render_component
- [ ] Tests include error cases and edge conditions

#### AC7: Context7 Integration for Documentation

**Given** elixir-phoenix-expert needs latest Elixir/Phoenix documentation
**When** the agent begins implementation
**Then** Context7 should be invoked to fetch current Elixir/Phoenix docs
**And** implementation should follow latest framework best practices
**And** agent should use current syntax and deprecation-free code

**Validation**:
- [ ] Context7 invoked at start of implementation tasks
- [ ] Code follows current Elixir/Phoenix version patterns (≥1.14, ≥1.7)
- [ ] Deprecated functions not used
- [ ] Documentation links reference current versions

#### AC8: Code Review Integration

**Given** elixir-phoenix-expert completes implementation
**When** the agent delegates to code-reviewer
**Then** code-reviewer should validate Elixir-specific patterns
**And** security checks should include input validation and Ecto SQL injection prevention
**And** performance validation should check for N+1 queries and inefficient patterns

**Validation**:
- [ ] code-reviewer successfully validates Elixir/Phoenix code
- [ ] Security checks include Ecto parameterization and input validation
- [ ] Performance checks detect N+1 queries
- [ ] OTP patterns validated for correctness
- [ ] Elixir style guide violations detected

#### AC9: Test Execution Integration

**Given** elixir-phoenix-expert writes ExUnit tests
**When** tests are delegated to test-runner
**Then** test-runner should execute ExUnit test suite
**And** test failures should be reported with clear error messages
**And** agent should fix failing tests and re-run until passing

**Validation**:
- [ ] test-runner successfully executes ExUnit tests
- [ ] Test failures reported with file/line numbers
- [ ] Agent fixes test failures and re-submits
- [ ] All tests passing before completion
- [ ] Test coverage metrics reported

### Performance Requirements

#### AC10: Implementation Speed

**Given** elixir-phoenix-expert receives implementation tasks
**When** the agent completes tasks
**Then** implementation speed should meet defined SLAs:
- Simple Phoenix controller: ≤ 5 minutes
- Complex GenServer implementation: ≤ 15 minutes
- Phoenix LiveView component: ≤ 12 minutes
- Ecto schema with validations: ≤ 8 minutes
- Background job (Oban worker): ≤ 10 minutes

**Validation**:
- [ ] Task completion times tracked and logged
- [ ] 90% of tasks completed within SLA timeframes
- [ ] SLA breaches documented with reasons
- [ ] Average task completion time reported

#### AC11: Code Performance Standards

**Given** elixir-phoenix-expert implements Phoenix APIs
**When** the code is deployed
**Then** API response times should meet P95 < 200ms target
**And** Ecto queries should be optimized (N+1 eliminated, proper indexes)
**And** LiveView components should render in < 16ms (60 FPS)

**Validation**:
- [ ] Phoenix API endpoints respond in < 200ms (P95)
- [ ] Ecto queries optimized with preload/join
- [ ] Database indexes recommended where needed
- [ ] LiveView render time < 16ms measured
- [ ] Performance profiling completed for critical paths

### Security Requirements

#### AC12: Input Validation and Sanitization

**Given** elixir-phoenix-expert implements Phoenix controllers or LiveView
**When** user input is processed
**Then** all inputs should be validated with Ecto changesets
**And** SQL injection should be prevented through Ecto parameterization
**And** XSS should be prevented through Phoenix HTML escaping

**Validation**:
- [ ] Ecto changesets validate all user inputs
- [ ] Raw SQL queries use parameterization (?, $1, etc.)
- [ ] Phoenix templates use <%= %> (auto-escaped) not <%== %>
- [ ] User input sanitized before database operations
- [ ] Security scan passes without SQL injection or XSS vulnerabilities

#### AC13: Authentication and Authorization

**Given** elixir-phoenix-expert implements protected endpoints or LiveView components
**When** authorization is required
**Then** proper authentication should be enforced (Phoenix.Token, Guardian, etc.)
**And** authorization rules should be implemented (Plug authorization, policy modules)
**And** sensitive operations should require explicit authorization checks

**Validation**:
- [ ] Authentication implemented on protected routes (plugs)
- [ ] Authorization checks implemented for sensitive actions
- [ ] LiveView requires authentication where appropriate
- [ ] Token validation implemented correctly
- [ ] Security review approves authorization implementation

#### AC14: Secrets Management

**Given** elixir-phoenix-expert configures Phoenix application
**When** secrets or API keys are needed
**Then** secrets should be loaded from environment variables or runtime.exs
**And** no secrets should be hardcoded in source files
**And** configuration should support multiple environments (dev, test, prod)

**Validation**:
- [ ] Secrets loaded from ENV or runtime.exs
- [ ] No hardcoded secrets in code (validated with grep)
- [ ] Environment-specific configuration properly organized
- [ ] .gitignore includes secret files (config/*.secret.exs)
- [ ] Security scan detects no hardcoded credentials

### Accessibility Requirements (Phoenix LiveView)

#### AC15: WCAG 2.1 AA Compliance for LiveView Components

**Given** elixir-phoenix-expert implements Phoenix LiveView components
**When** interactive UI elements are created
**Then** semantic HTML should be used (button, nav, main, etc.)
**And** ARIA attributes should be added where needed
**And** keyboard navigation should be fully functional
**And** color contrast should meet WCAG 2.1 AA standards (4.5:1 for text)

**Validation**:
- [ ] LiveView templates use semantic HTML elements
- [ ] ARIA labels and roles added for screen readers
- [ ] Keyboard navigation tested and working
- [ ] Color contrast validated with accessibility tools
- [ ] Accessibility audit passes (axe-core or similar)

### Integration Requirements

#### AC16: Orchestrator Integration

**Given** ai-mesh-orchestrator or tech-lead-orchestrator receives Elixir/Phoenix task
**When** task delegation occurs
**Then** elixir-phoenix-expert should be selected based on framework detection
**And** handoff should include complete context (TRD, requirements, constraints)
**And** agent should acknowledge receipt and begin implementation

**Validation**:
- [ ] Orchestrators correctly detect Elixir/Phoenix framework
- [ ] Delegation logic follows specialist hierarchy in agents/README.md
- [ ] Complete context passed to elixir-phoenix-expert
- [ ] Agent successfully receives and processes delegated tasks
- [ ] Handoff protocols documented and followed

#### AC17: Quality Agent Collaboration

**Given** elixir-phoenix-expert completes implementation
**When** quality validation is needed
**Then** agent should delegate to code-reviewer for comprehensive review
**And** agent should delegate to test-runner for ExUnit execution
**And** agent should incorporate feedback and fix issues

**Validation**:
- [ ] code-reviewer delegation includes Elixir-specific validation requirements
- [ ] test-runner successfully executes ExUnit tests
- [ ] Agent fixes issues identified by code-reviewer
- [ ] Quality gates enforced before task completion
- [ ] Definition of Done checklist validated

#### AC18: Infrastructure Agent Collaboration

**Given** elixir-phoenix-expert needs infrastructure or deployment support
**When** infrastructure tasks arise
**Then** agent should delegate to infrastructure-management-subagent for AWS/Kubernetes
**And** agent should delegate to postgresql-specialist for complex database design
**And** clear handoff protocols should be followed

**Validation**:
- [ ] Infrastructure tasks delegated to infrastructure-management-subagent
- [ ] Complex database tasks delegated to postgresql-specialist
- [ ] Handoff includes complete context and requirements
- [ ] Collaboration produces integrated solution
- [ ] Responsibilities clearly defined and respected

### Documentation Requirements

#### AC19: Implementation Documentation

**Given** elixir-phoenix-expert completes implementation
**When** documentation is generated
**Then** code should include comprehensive function documentation (@doc, @moduledoc)
**And** complex OTP patterns should be documented with supervision tree diagrams
**And** API endpoints should be documented with request/response examples

**Validation**:
- [ ] @moduledoc present for all public modules
- [ ] @doc present for all public functions
- [ ] Complex patterns documented with explanations
- [ ] Supervision trees documented with ASCII diagrams
- [ ] API documentation includes request/response examples

#### AC20: Agent Behavior Documentation

**Given** the elixir-phoenix-expert agent is integrated
**When** developers need agent documentation
**Then** agent mission, responsibilities, and capabilities should be clearly documented
**And** delegation patterns should be documented in agents/README.md
**And** integration protocols should specify handoff contracts

**Validation**:
- [ ] Agent documentation complete in elixir-phoenix-expert.md
- [ ] Delegation logic documented in agents/README.md
- [ ] Handoff protocols clearly defined
- [ ] Tool permissions documented with justification
- [ ] Success criteria and SLAs specified

---

## Constraints / Risks

### Technical Constraints

#### Elixir/Phoenix Version Requirements

**Constraint**: Agent focuses on modern Elixir (≥1.14) and Phoenix (≥1.7) versions

**Rationale**: Latest versions include significant improvements (Elixir 1.14 dbg/2, Phoenix 1.7 verified routes, improved LiveView)

**Impact**: Older Elixir/Phoenix projects may need manual adaptation

**Mitigation**:
- Document minimum version requirements clearly
- Provide upgrade guidance for legacy projects
- Support previous LTS versions if significant user demand

#### OTP Complexity Threshold

**Constraint**: Highly complex distributed system architectures require human architect review

**Rationale**: Advanced distributed consensus, custom protocols, and complex fault tolerance strategies exceed agent autonomous decision-making scope

**Impact**: Some complex OTP patterns require human architectural guidance

**Mitigation**:
- Clearly define escalation criteria for complex patterns
- Provide consultation mode for architectural guidance
- Document patterns requiring human architect approval

#### Phoenix LiveView vs JavaScript Frameworks

**Constraint**: Agent specializes in Phoenix LiveView; JavaScript framework integration is secondary

**Rationale**: LiveView is Phoenix's primary real-time UI approach; JavaScript frameworks are outside core expertise

**Impact**: Complex JavaScript-heavy UIs may require frontend-developer collaboration

**Mitigation**:
- Clearly define LiveView vs JavaScript framework boundaries
- Provide LiveView hooks guidance for JavaScript interop
- Collaborate with frontend-developer for JavaScript-heavy features

#### Testing Framework Limitations

**Constraint**: Agent focuses on ExUnit; property-based testing (StreamData) is advanced use case

**Rationale**: ExUnit covers 95% of Phoenix testing needs; StreamData requires specialized expertise

**Impact**: Property-based testing patterns require manual implementation

**Mitigation**:
- Provide basic StreamData examples for interested users
- Document advanced testing techniques in agent knowledge base
- Consider future enhancement for property-based testing support

### Business Constraints

#### Development Timeline

**Constraint**: Integration completion target: 4-6 weeks from PRD approval to production deployment

**Phases**:
- Week 1-2: Agent definition refinement, delegation logic integration, Context7 configuration
- Week 3-4: Quality agent integration (code-reviewer, test-runner), testing framework validation
- Week 5: Production deployment, documentation completion, team training
- Week 6: Monitoring, feedback collection, iteration

**Impact**: Aggressive timeline requires focused effort and clear prioritization

**Mitigation**:
- Prioritize core capabilities (Phoenix API, basic OTP, LiveView)
- Defer advanced features to Phase 2 (distributed systems, advanced OTP)
- Ensure quality gates are not compromised for speed

#### Resource Availability

**Constraint**: Requires Elixir/Phoenix expert for validation and testing during integration

**Rationale**: Agent behavior must be validated by experienced Elixir engineers

**Impact**: Integration pace depends on expert availability for validation cycles

**Mitigation**:
- Secure dedicated Elixir expert time commitment (20-30% allocation)
- Front-load expert validation in early weeks
- Automate validation where possible (ExUnit tests, code review checks)

#### Context7 Dependency

**Constraint**: Optimal agent performance requires Context7 MCP server for latest Elixir/Phoenix documentation

**Rationale**: Elixir/Phoenix evolve rapidly; Context7 provides current documentation

**Impact**: Without Context7, agent relies on embedded knowledge (may be outdated)

**Mitigation**:
- Bundle recent Elixir/Phoenix documentation snapshot as fallback
- Document Context7 setup as recommended (not required)
- Provide upgrade path when Context7 available

#### Competitive Framework Support

**Constraint**: Elixir/Phoenix agent is third backend framework specialist (after Rails, NestJS)

**Rationale**: Resources allocated to third framework may impact support quality

**Impact**: Must ensure Elixir/Phoenix support quality matches Rails/NestJS

**Mitigation**:
- Leverage proven patterns from Rails/NestJS agent implementations
- Reuse code review and testing infrastructure
- Allocate sufficient resources to match quality standards

### Risk Assessment

#### High Risk: OTP Pattern Correctness

**Description**: Incorrect OTP patterns (GenServer, Supervisor) can lead to production crashes, memory leaks, or data corruption

**Likelihood**: Medium (OTP patterns are complex, easy to implement incorrectly)

**Impact**: High (production stability and data integrity at risk)

**Mitigation**:
- Comprehensive OTP pattern validation in code-reviewer
- Fault tolerance testing with crash simulation scenarios
- Expert validation of complex OTP implementations before production
- Documentation of common OTP anti-patterns to avoid
- Gradual rollout with staging environment validation

**Monitoring**:
- Track production crashes related to OTP patterns
- Monitor agent-generated OTP code for patterns associated with instability
- Collect feedback from Elixir engineers on OTP implementation quality

#### High Risk: LiveView Performance Issues

**Description**: Inefficient LiveView implementations can cause high server memory usage, slow rendering, or poor user experience

**Likelihood**: Medium (LiveView optimization requires specific techniques)

**Impact**: Medium-High (affects user experience and server costs)

**Mitigation**:
- Performance validation in code-reviewer (render time, memory usage)
- Best practices for LiveView optimization (streams, targeted updates, minimize assigns)
- Performance testing for LiveView components before deployment
- Documentation of common LiveView performance anti-patterns
- Monitoring of LiveView memory usage and render times

**Monitoring**:
- Track LiveView server memory usage trends
- Monitor LiveView component render times
- Collect user feedback on real-time feature performance

#### Medium Risk: Ecto Query Performance

**Description**: Unoptimized Ecto queries can cause slow API responses, database overload, and scalability issues

**Likelihood**: Medium (N+1 queries and missing indexes are common mistakes)

**Impact**: Medium (affects API performance and database costs)

**Mitigation**:
- Automated N+1 query detection in code-reviewer
- Database index recommendations based on query patterns
- Performance testing with realistic data volumes
- Collaboration with postgresql-specialist for complex queries
- Ecto query logging and analysis in development

**Monitoring**:
- Track API endpoint response times (P95, P99)
- Monitor database query performance metrics
- Alert on slow queries (> 100ms)
- Collect feedback on API performance from users

#### Medium Risk: Security Validation Gaps

**Description**: Elixir/Phoenix-specific security patterns may not be fully covered by general code-reviewer validation

**Likelihood**: Low-Medium (Phoenix has strong security defaults, but misconfigurations possible)

**Impact**: High (security vulnerabilities can lead to data breaches)

**Mitigation**:
- Enhance code-reviewer with Elixir/Phoenix-specific security checks
- Validate input sanitization, Ecto parameterization, Phoenix token usage
- Security scan with OWASP checks for Phoenix applications
- Document Phoenix security best practices (CSRF, SQL injection, XSS)
- Periodic security audit of agent-generated code

**Monitoring**:
- Track security scan results for agent-generated code
- Monitor production for security incidents related to Phoenix code
- Collect feedback from security team on Phoenix security patterns

#### Low Risk: Context7 Unavailability

**Description**: Context7 MCP server may be unavailable or not configured, limiting access to latest Elixir/Phoenix documentation

**Likelihood**: Low-Medium (depends on user Context7 setup)

**Impact**: Low (agent can fall back to embedded knowledge)

**Mitigation**:
- Bundle recent Elixir/Phoenix documentation snapshot as fallback
- Graceful degradation when Context7 unavailable
- Clear documentation of Context7 benefits and setup
- Periodic updates to embedded knowledge base

**Monitoring**:
- Track Context7 usage rate among users
- Monitor agent behavior with and without Context7
- Collect feedback on documentation quality

#### Low Risk: Integration Complexity with Existing Agents

**Description**: Elixir/Phoenix agent integration may introduce conflicts or overlap with existing agents (backend-developer, frontend-developer)

**Likelihood**: Low (delegation logic clearly defined in agents/README.md)

**Impact**: Low-Medium (may cause confusion or incorrect task routing)

**Mitigation**:
- Clear delegation logic in agents/README.md (framework detection)
- Test delegation scenarios with orchestrators
- Document handoff protocols and boundaries
- Monitor task routing correctness in production

**Monitoring**:
- Track task routing decisions by orchestrators
- Collect feedback on delegation accuracy
- Monitor agent overlap or conflict incidents

---

## References

### Elixir/Phoenix Documentation & Best Practices

#### Official Documentation (Context7 Integration)

- **Elixir Official Docs**: https://hexdocs.pm/elixir/ (latest stable version ≥1.14)
- **Phoenix Framework Docs**: https://hexdocs.pm/phoenix/ (latest stable version ≥1.7)
- **Phoenix LiveView Docs**: https://hexdocs.pm/phoenix_live_view/ (latest stable version)
- **Ecto Documentation**: https://hexdocs.pm/ecto/ (database wrapper and query DSL)
- **Oban Documentation**: https://hexdocs.pm/oban/ (background job processing)

**Context7 Usage**: Agent should invoke Context7 at start of implementation to fetch current documentation for Elixir, Phoenix, LiveView, and Ecto

#### Community Resources

- **Elixir Forum**: https://elixirforum.com/ (community best practices and patterns)
- **Elixir Radar**: https://elixir-radar.com/ (weekly newsletter with latest patterns)
- **Phoenix LiveView Tips**: https://fly.io/phoenix-files/ (production patterns and optimization)
- **Dashbit Blog**: https://dashbit.co/blog (José Valim and team insights on Elixir/Phoenix)

#### Books & Guides

- **Programming Phoenix**: Pragmatic Programmers (foundation and best practices)
- **Phoenix LiveView**: Pragmatic Programmers (comprehensive LiveView patterns)
- **Designing Elixir Systems with OTP**: Pragmatic Programmers (OTP pattern deep dive)
- **Elixir in Action**: Manning (comprehensive Elixir and OTP coverage)

### AgentOS Standards & Related Documentation

#### Internal AgentOS Documentation

- **PRD Template**: `/docs/agentos/PRD.md` - Product requirements structure and guidelines
- **TRD Template**: `/docs/agentos/TRD.md` - Technical requirements structure and guidelines
- **Definition of Done**: `/docs/agentos/DefinitionOfDone.md` - Quality gate checklist
- **Acceptance Criteria**: `/docs/agentos/AcceptanceCriteria.md` - AC format and guidelines

#### Agent Ecosystem Documentation

- **Agent Mesh Index**: `/agents/README.md` - Complete agent architecture and delegation patterns
- **Specialist Agent Examples**:
  - `/agents/rails-backend-expert.md` - Rails framework specialist (reference implementation)
  - `/agents/nestjs-backend-expert.md` - NestJS framework specialist (reference implementation)
  - `/agents/react-component-architect.md` - React specialist (reference implementation)
- **Orchestrator Documentation**:
  - `/agents/ai-mesh-orchestrator.md` - Strategic delegation and task routing
  - `/agents/tech-lead-orchestrator.md` - Development methodology orchestration
- **Quality Agent Documentation**:
  - `/agents/code-reviewer.md` - Security and quality validation (needs Elixir/Phoenix enhancement)
  - `/agents/test-runner.md` - Test execution automation (ExUnit support needed)

### Related PRDs & Technical Specifications

#### Infrastructure Management

- **Infrastructure Management Subagent PRD**: `/docs/PRD/infrastructure-management-subagent.md` - AWS/Kubernetes/Docker automation patterns
- **PostgreSQL Specialist**: Reference for database optimization collaboration

#### Testing & Quality Assurance

- **Playwright Testing Integration**: E2E testing patterns for LiveView components
- **Code Review Standards**: Security scanning and quality validation requirements

### Competitive Analysis

#### Alternative Elixir/Phoenix Development Tools

- **ElixirLS**: Language server providing IDE support (autocomplete, go-to-definition)
  - **Comparison**: ElixirLS provides IDE features; elixir-phoenix-expert provides AI-powered implementation and architecture guidance
  - **Complementary**: Can work together (ElixirLS for IDE, agent for development acceleration)

- **Credo**: Static code analysis for Elixir
  - **Comparison**: Credo focuses on code style and consistency; agent provides broader implementation assistance
  - **Integration**: Agent can leverage Credo checks as part of quality validation

- **Dialyzer**: Static type analysis for Erlang/Elixir
  - **Comparison**: Dialyzer detects type errors; agent provides proactive implementation guidance
  - **Integration**: Agent should ensure code passes Dialyzer checks

#### AI-Powered Development Tools

- **GitHub Copilot**: General-purpose code completion
  - **Comparison**: Copilot provides line-level suggestions; agent provides architectural guidance and complete feature implementation
  - **Advantage**: Agent has Elixir/Phoenix-specific expertise and OTP pattern knowledge

- **Cursor AI / Windsurf**: AI-powered code editors
  - **Comparison**: Editor-focused AI assistance; agent provides comprehensive workflow integration (planning, implementation, testing, review)
  - **Advantage**: Agent integrates with complete development methodology (PRD → TRD → Implementation → Quality Gates)

### Related Tickets & Stakeholder Feedback

#### Stakeholder Requests

- **Fortium Engineering Team**: Requested Elixir/Phoenix support to match Rails and NestJS capabilities (Q4 2024)
- **Product Management**: Identified Elixir/Phoenix as strategic growth area for toolkit adoption (Q1 2025)
- **Customer Feedback**: 3 enterprise customers requested Elixir/Phoenix specialist agent (Q4 2024 - Q1 2025)

#### User Research Findings

- **Elixir Developer Survey (Internal)**: 78% of surveyed Elixir developers want AI assistance for OTP patterns and LiveView development
- **Pain Point Analysis**: Top needs: OTP pattern validation (65%), LiveView optimization (58%), Ecto query optimization (52%)
- **Feature Prioritization**: Phoenix API development (Priority 1), LiveView components (Priority 2), OTP patterns (Priority 3)

### Performance Benchmarks & Success Metrics

#### Target Performance Metrics (Based on Rails/NestJS Agent Baselines)

- **Productivity Improvement**: 30-40% faster development (baseline: manual development without agent)
- **Error Reduction**: 50-65% fewer bugs in production (baseline: pre-agent error rates)
- **Test Coverage**: ≥80% for business logic (baseline: 60-70% manual coverage)
- **API Performance**: P95 < 200ms response time (industry standard for web APIs)
- **Agent Success Rate**: ≥90% successful task completion (baseline: other specialist agents)

#### Infrastructure Performance Baselines

- **Hook Performance**: 87-99% faster execution (0.32-23.84ms, baseline: ≤50ms target) - validated with Node.js hooks migration
- **Memory Optimization**: 67-74% better than target (8.6-10.3MB usage, target: ≤32MB) - validated with Node.js hooks migration
- **Installation Success**: ≥98% successful installations (baseline: current installer success rate)

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Objective**: Establish core agent capabilities and integration framework

#### Week 1: Agent Definition & Delegation Integration

**Tasks**:
1. Refine elixir-phoenix-expert.md agent definition with complete mission, responsibilities, and capabilities
2. Integrate delegation logic into agents/README.md with Elixir/Phoenix framework detection rules
3. Configure Context7 integration for Elixir, Phoenix, LiveView, and Ecto documentation
4. Document tool permissions and security principles for agent
5. Define handoff protocols with orchestrators (ai-mesh-orchestrator, tech-lead-orchestrator)

**Deliverables**:
- elixir-phoenix-expert.md agent definition complete and reviewed
- agents/README.md updated with Elixir/Phoenix delegation patterns
- Context7 configuration documented and tested
- Tool permission matrix documented
- Handoff protocol specifications complete

**Success Criteria**:
- Agent discoverable in mesh ecosystem
- Orchestrators correctly delegate Elixir/Phoenix tasks
- Context7 successfully fetches Elixir/Phoenix documentation
- Tool permissions approved by security review

#### Week 2: Core Capabilities Implementation

**Tasks**:
1. Implement Phoenix API development patterns (controllers, contexts, Ecto schemas)
2. Implement basic OTP patterns (GenServer, basic Supervisor)
3. Implement Phoenix LiveView component development patterns
4. Implement Ecto query optimization and N+1 detection
5. Create agent knowledge base with Elixir/Phoenix best practices

**Deliverables**:
- Phoenix API implementation capabilities validated
- GenServer and Supervisor implementation patterns complete
- Phoenix LiveView component patterns implemented
- Ecto query optimization logic implemented
- Knowledge base with common patterns and anti-patterns

**Success Criteria**:
- Agent successfully implements Phoenix controllers and contexts
- GenServer implementations follow OTP best practices
- LiveView components properly structured with mount/render/event handling
- N+1 queries detected and corrected automatically
- Knowledge base reviewed and approved by Elixir expert

### Phase 2: Quality Integration (Weeks 3-4)

**Objective**: Integrate with quality agents and establish testing framework

#### Week 3: Code Review & Security Integration

**Tasks**:
1. Enhance code-reviewer agent with Elixir/Phoenix-specific validation rules
2. Implement security checks (Ecto parameterization, input validation, Phoenix token usage)
3. Implement performance checks (N+1 detection, query optimization, LiveView optimization)
4. Implement OTP pattern validation (GenServer correctness, Supervisor strategy validation)
5. Test code-reviewer integration with elixir-phoenix-expert handoff

**Deliverables**:
- code-reviewer enhanced with Elixir/Phoenix checks
- Security validation rules for Phoenix applications
- Performance validation rules (N+1, query optimization)
- OTP pattern correctness validation
- Integration tests for code-reviewer handoff

**Success Criteria**:
- code-reviewer successfully validates Elixir/Phoenix code
- Security vulnerabilities detected (SQL injection, XSS, insecure tokens)
- Performance issues detected (N+1 queries, inefficient patterns)
- OTP anti-patterns detected and reported
- Handoff protocol working smoothly

#### Week 4: Test Execution & Validation

**Tasks**:
1. Integrate test-runner with ExUnit test execution
2. Implement test coverage tracking and reporting
3. Implement test failure analysis and fix proposals
4. Integrate playwright-tester for LiveView E2E testing
5. Validate complete quality gate workflow (implementation → review → testing)

**Deliverables**:
- test-runner executing ExUnit tests successfully
- Test coverage reporting integrated
- Test failure analysis and fix automation
- playwright-tester integration for LiveView E2E tests
- End-to-end quality gate validation

**Success Criteria**:
- test-runner successfully runs ExUnit test suites
- Test coverage meets ≥80% target for business logic
- Test failures automatically analyzed and fixed
- LiveView E2E tests working via playwright-tester
- Complete workflow (implement → review → test) validated

### Phase 3: Production Deployment (Week 5)

**Objective**: Deploy to production, complete documentation, and train teams

#### Week 5: Deployment & Documentation

**Tasks**:
1. Deploy elixir-phoenix-expert to production agent mesh
2. Complete comprehensive agent documentation (mission, capabilities, integration)
3. Create user guides for Elixir/Phoenix development with agent
4. Integrate monitoring and telemetry for agent performance tracking
5. Conduct team training sessions for Elixir/Phoenix developers

**Deliverables**:
- elixir-phoenix-expert deployed to production
- Complete agent documentation (elixir-phoenix-expert.md, agents/README.md)
- User guides for common Elixir/Phoenix development scenarios
- Monitoring dashboards for agent usage and performance
- Training materials and recorded sessions

**Success Criteria**:
- Agent successfully deployed and accessible in production
- Documentation complete and reviewed
- User guides cover 80% of common use cases
- Monitoring capturing agent performance metrics
- Training sessions completed with positive feedback

### Phase 4: Monitoring & Iteration (Week 6+)

**Objective**: Monitor adoption, collect feedback, and iterate on capabilities

#### Week 6: Monitoring & Feedback

**Tasks**:
1. Monitor agent usage patterns and task success rates
2. Collect user feedback from Elixir/Phoenix development teams
3. Track productivity metrics (development speed, error rates, test coverage)
4. Identify gaps or issues in agent capabilities
5. Plan Phase 2 enhancements (distributed systems, advanced OTP, property-based testing)

**Deliverables**:
- Agent usage analytics and performance reports
- User feedback summary with prioritized improvement areas
- Productivity metrics baseline and trends
- Issue log with root cause analysis
- Phase 2 enhancement roadmap

**Success Criteria**:
- Agent usage meets adoption targets (≥70% of Elixir/Phoenix tasks)
- Task success rate ≥90%
- Productivity improvements trending toward 30%+ target
- User satisfaction ≥85%
- Phase 2 roadmap defined with stakeholder approval

#### Ongoing: Continuous Improvement

**Tasks**:
1. Regularly update agent knowledge base with latest Elixir/Phoenix patterns
2. Enhance agent capabilities based on user feedback and usage patterns
3. Maintain Context7 integration with latest documentation versions
4. Optimize agent performance (task completion speed, quality metrics)
5. Expand capabilities to cover advanced use cases (distributed systems, custom protocols)

**Success Criteria**:
- Knowledge base updated quarterly with latest patterns
- Agent capabilities expanded based on prioritized user requests
- Context7 documentation current (< 1 month lag from releases)
- Agent performance continuously improving
- User satisfaction maintained or improved

---

## Success Metrics & KPIs

### Primary Success Metrics

#### 1. Productivity Improvement

**Metric**: Development speed increase for Elixir/Phoenix tasks
**Target**: ≥30% faster development (baseline: pre-agent manual development)
**Measurement**:
- Task completion time comparison (agent-assisted vs manual)
- Feature delivery velocity (features per sprint with vs without agent)
- Time-to-production for Phoenix features (planning → deployment)

**Data Collection**:
- TodoWrite task tracking with timestamps
- Git commit analysis (feature branch creation to merge)
- Developer self-reported productivity metrics

**Reporting**: Monthly productivity report with trend analysis

#### 2. Error Reduction

**Metric**: Decrease in production bugs and issues for Elixir/Phoenix code
**Target**: ≥50% reduction in errors (baseline: pre-agent error rates)
**Measurement**:
- Production error rates (bugs per 1000 lines of code)
- Code review issue density (issues per PR)
- Post-deployment hotfix frequency

**Data Collection**:
- Production error monitoring (Sentry, AppSignal, etc.)
- Code review metrics from code-reviewer agent
- Deployment rollback frequency

**Reporting**: Monthly quality report with issue categorization

#### 3. Test Coverage

**Metric**: Automated test coverage for Elixir/Phoenix code
**Target**: ≥80% coverage for business logic, ≥70% overall
**Measurement**:
- ExUnit code coverage percentage (mix test --cover)
- Coverage trends over time (improving or declining)
- Test coverage by module type (contexts, controllers, LiveView)

**Data Collection**:
- ExUnit coverage reports from test-runner
- Automated coverage tracking in CI/CD pipeline
- Coverage trends dashboard

**Reporting**: Weekly test coverage report with low-coverage alerts

#### 4. Agent Success Rate

**Metric**: Successful task completion rate for elixir-phoenix-expert
**Target**: ≥90% successful completion (baseline: other specialist agents at 92-95%)
**Measurement**:
- Tasks completed successfully on first attempt
- Tasks requiring rework or human intervention
- Tasks escalated to human experts

**Data Collection**:
- TodoWrite task status tracking
- Agent delegation logs from orchestrators
- Human intervention tracking

**Reporting**: Weekly agent performance report with failure analysis

#### 5. API Performance

**Metric**: Response time performance for Phoenix API endpoints
**Target**: P95 < 200ms, P99 < 500ms
**Measurement**:
- API endpoint response times (P50, P95, P99)
- Database query performance
- LiveView render times

**Data Collection**:
- Phoenix Telemetry metrics
- Production APM tools (AppSignal, New Relic)
- Database query logging and analysis

**Reporting**: Daily performance dashboard with alert thresholds

### Secondary Success Metrics

#### 6. User Satisfaction

**Metric**: Developer satisfaction with elixir-phoenix-expert agent
**Target**: ≥90% satisfaction score
**Measurement**:
- Post-task satisfaction surveys (1-5 scale)
- Net Promoter Score (NPS) for agent
- Qualitative feedback and feature requests

**Data Collection**:
- Periodic user surveys (weekly or bi-weekly)
- Feedback collection in agent interactions
- User interviews and focus groups

**Reporting**: Monthly satisfaction report with feedback themes

#### 7. Adoption Rate

**Metric**: Percentage of Elixir/Phoenix tasks using agent vs manual development
**Target**: ≥70% adoption within 3 months
**Measurement**:
- Elixir/Phoenix tasks delegated to agent vs manual
- Developer usage frequency
- Team-level adoption rates

**Data Collection**:
- Agent delegation logs from orchestrators
- Developer usage tracking
- Team adoption surveys

**Reporting**: Weekly adoption dashboard with team breakdowns

#### 8. Code Quality Metrics

**Metric**: Code quality improvements in agent-generated vs manual code
**Target**: ≥20% improvement in code quality metrics
**Measurement**:
- Code review approval time (fewer iterations needed)
- Code complexity metrics (cyclomatic complexity, function length)
- Code maintainability index

**Data Collection**:
- code-reviewer metrics (issues per PR, review cycles)
- Static analysis tools (Credo, Dialyzer)
- Code quality trends over time

**Reporting**: Monthly code quality report with comparison to baseline

#### 9. Security Validation

**Metric**: Security issue detection and prevention in Phoenix code
**Target**: Zero high-severity security issues in production
**Measurement**:
- Security scan findings (SQL injection, XSS, auth issues)
- Production security incidents
- Security patch frequency

**Data Collection**:
- code-reviewer security scan results
- Production security monitoring
- Security incident reports

**Reporting**: Monthly security report with vulnerability trends

#### 10. Documentation Completeness

**Metric**: Completeness and quality of agent-generated documentation
**Target**: ≥95% of functions and modules documented
**Measurement**:
- @moduledoc and @doc coverage percentage
- Documentation quality score (clarity, examples, accuracy)
- API documentation completeness

**Data Collection**:
- Automated documentation coverage analysis
- Documentation quality reviews
- User feedback on documentation usefulness

**Reporting**: Monthly documentation quality report

---

## Appendices

### Appendix A: Technical Architecture Diagram

```
Elixir/Phoenix Agent Integration Architecture
==============================================

┌─────────────────────────────────────────────────────────────────┐
│                     User Request (Elixir/Phoenix Task)          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ai-mesh-orchestrator                         │
│   (Strategic Request Analysis & Task Delegation)                │
│   - Detects Elixir/Phoenix framework from TRD/context           │
│   - Routes to elixir-phoenix-expert based on delegation logic   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  elixir-phoenix-expert                          │
│   Mission: Elixir/Phoenix Full-Stack Development                │
│   Tools: Read, Write, Edit, Bash, Grep, Glob                    │
│                                                                  │
│   Core Capabilities:                                             │
│   ├─ Phoenix API Development (Controllers, Contexts, Ecto)      │
│   ├─ OTP Patterns (GenServer, Supervisor, Fault Tolerance)      │
│   ├─ Phoenix LiveView (Real-Time UIs, State Management)         │
│   ├─ Ecto Operations (Queries, Changesets, Migrations)          │
│   ├─ Phoenix Channels (Real-Time Communication, PubSub)         │
│   ├─ Oban Background Jobs (Async Processing, Scheduling)        │
│   └─ Production Optimization (Release, Config, Deployment)      │
└────────────┬──────────────┬──────────────┬─────────────────────┘
             │              │              │
             ▼              ▼              ▼
    ┌────────────┐  ┌────────────┐  ┌────────────────────┐
    │  Context7  │  │code-reviewer│  │   test-runner       │
    │   MCP      │  │  (Elixir    │  │   (ExUnit)          │
    │  (Docs)    │  │ Validation) │  │                     │
    └────────────┘  └────────────┘  └────────────────────┘
         │                │                    │
         │                ▼                    ▼
         │        Security & Performance   Test Execution
         │        - Ecto SQL injection     - ExUnit tests
         │        - Input validation       - Coverage ≥80%
         │        - N+1 queries            - Failure analysis
         │        - OTP patterns
         │                │                    │
         ▼                ▼                    ▼
    Latest Elixir/   Quality Gates      Test Results
    Phoenix Docs     Enforcement        & Fixes
         │                │                    │
         └────────────────┴────────────────────┘
                          │
                          ▼
              ┌───────────────────────────┐
              │  Implementation Complete  │
              │  - Code Reviewed           │
              │  - Tests Passing           │
              │  - Documentation Updated   │
              └───────────────────────────┘

Integration Points:
- infrastructure-management-subagent (AWS/Kubernetes deployment)
- postgresql-specialist (Complex database design)
- playwright-tester (LiveView E2E testing)
- documentation-specialist (User guides, runbooks)
- git-workflow (Conventional commits, PR creation)
```

### Appendix B: Delegation Decision Tree

```
Elixir/Phoenix Task Delegation Decision Tree
============================================

Start: Task requires Elixir/Phoenix development
│
├─ Is task complex architectural design?
│  ├─ YES → Escalate to human architect
│  └─ NO → Continue
│
├─ Does task involve Elixir/Phoenix code?
│  ├─ NO → Route to appropriate specialist (not elixir-phoenix-expert)
│  └─ YES → Continue
│
├─ Task Category:
│  │
│  ├─ Phoenix API Development
│  │  └─ Delegate to elixir-phoenix-expert
│  │     → Implement controllers, contexts, Ecto schemas
│  │     → Write ExUnit tests
│  │     → Delegate to code-reviewer for validation
│  │
│  ├─ Phoenix LiveView Development
│  │  └─ Delegate to elixir-phoenix-expert
│  │     → Implement LiveView module (mount, render, events)
│  │     → Implement real-time updates (PubSub/Channels)
│  │     → Validate accessibility (WCAG 2.1 AA)
│  │     → Delegate to playwright-tester for E2E tests
│  │
│  ├─ OTP Patterns (GenServer, Supervisor)
│  │  └─ Delegate to elixir-phoenix-expert
│  │     → Implement GenServer/Supervisor
│  │     → Design supervision tree
│  │     → Write fault tolerance tests
│  │     → Delegate to code-reviewer for OTP validation
│  │
│  ├─ Ecto Database Operations
│  │  ├─ Simple queries/changesets
│  │  │  └─ Delegate to elixir-phoenix-expert
│  │  └─ Complex schema design
│  │     └─ Collaborate: elixir-phoenix-expert + postgresql-specialist
│  │
│  ├─ Phoenix Channels / Real-Time Communication
│  │  └─ Delegate to elixir-phoenix-expert
│  │     → Implement Channel module
│  │     → Implement PubSub integration
│  │     → Validate security (authorization, rate limiting)
│  │
│  ├─ Oban Background Jobs
│  │  └─ Delegate to elixir-phoenix-expert
│  │     → Implement Oban worker
│  │     → Configure retry strategies
│  │     → Write job tests (success, failure, retry)
│  │
│  ├─ Production Deployment
│  │  └─ Collaborate:
│  │     - elixir-phoenix-expert (release config, runtime.exs)
│  │     - infrastructure-management-subagent (AWS/Kubernetes)
│  │     - deployment-orchestrator (deployment automation)
│  │
│  └─ Testing & Quality Assurance
│     └─ Collaborate:
│        - elixir-phoenix-expert (write ExUnit tests)
│        - test-runner (execute tests, analyze failures)
│        - code-reviewer (validate quality, security, performance)
│
└─ Quality Gates:
   ├─ Code Review (code-reviewer)
   │  - Elixir/Phoenix patterns validated
   │  - Security checks passed
   │  - Performance checks passed
   │  - OTP patterns validated
   │
   ├─ Test Execution (test-runner)
   │  - ExUnit tests passing
   │  - Coverage ≥80% for business logic
   │  - Failure analysis and fixes applied
   │
   └─ E2E Testing (playwright-tester, if LiveView)
      - Real-time interactions validated
      - User flows tested
      - Accessibility validated

End: Implementation Complete, Quality Gates Passed
```

### Appendix C: Example Use Case Walkthrough

**Use Case**: Implementing a Phoenix LiveView real-time dashboard with Ecto queries and Phoenix Channels

**Step-by-Step Flow**:

1. **User Request**: "Implement a real-time analytics dashboard showing user activity with Phoenix LiveView"

2. **ai-mesh-orchestrator Analysis**:
   - Detects Elixir/Phoenix framework from project context
   - Identifies Phoenix LiveView requirement
   - Routes to elixir-phoenix-expert (not frontend-developer)

3. **elixir-phoenix-expert Initial Analysis**:
   - Fetches latest Phoenix LiveView documentation from Context7
   - Analyzes TRD for requirements:
     - Real-time data updates
     - Interactive filtering
     - User activity metrics from database
   - Plans implementation approach

4. **Implementation - Phase 1: Data Layer**:
   - Implements Ecto schema for user activity tracking
   - Creates database queries with proper preloading (no N+1)
   - Implements Phoenix context with business logic
   - Writes ExUnit tests for context and queries

5. **Implementation - Phase 2: LiveView Component**:
   - Creates LiveView module with mount/3 callback
   - Implements initial state with user activity data
   - Implements render/1 with semantic HTML and ARIA attributes
   - Adds real-time updates via Phoenix PubSub subscription
   - Implements handle_info/2 for real-time data updates

6. **Implementation - Phase 3: Interactivity**:
   - Implements handle_event/3 for filtering and sorting
   - Optimizes LiveView rendering with streams for large datasets
   - Implements targeted updates to minimize re-renders
   - Ensures keyboard navigation and accessibility

7. **Quality Gate - Code Review**:
   - Delegates to code-reviewer agent
   - code-reviewer validates:
     - Ecto queries optimized (no N+1, proper preloads)
     - LiveView state management correct
     - Accessibility standards met (WCAG 2.1 AA)
     - Performance optimized (< 16ms render time)
   - Issues found: Missing ARIA live region for updates
   - elixir-phoenix-expert fixes issue, re-submits

8. **Quality Gate - Testing**:
   - Delegates to test-runner for ExUnit execution
   - Tests validate:
     - LiveView mount and initial render
     - Event handlers (filtering, sorting)
     - Real-time updates via PubSub
     - Accessibility (semantic HTML, keyboard nav)
   - All tests passing, coverage ≥80%

9. **Quality Gate - E2E Testing**:
   - Delegates to playwright-tester for E2E validation
   - E2E tests validate:
     - Dashboard loads and displays data
     - Filtering and sorting work interactively
     - Real-time updates appear without page refresh
     - Keyboard navigation functional
   - E2E tests passing

10. **Documentation**:
    - elixir-phoenix-expert generates:
      - LiveView module documentation (@moduledoc, @doc)
      - Real-time update architecture notes
      - Component usage examples
      - Performance optimization notes
    - Delegates to documentation-specialist for user guide

11. **Completion**:
    - Returns to ai-mesh-orchestrator with:
      - Complete LiveView implementation
      - All tests passing (unit, integration, E2E)
      - Code review approved
      - Documentation complete
    - User receives real-time analytics dashboard, ready for deployment

**Outcome**:
- Real-time Phoenix LiveView dashboard implemented in ~2 hours (vs ~6 hours manual)
- Quality gates enforced (security, performance, accessibility)
- Comprehensive testing coverage (≥80%)
- Production-ready code with documentation

### Appendix D: Glossary

**Acceptance Criteria (AC)**: Specific, testable conditions that must be met for a feature to be considered complete. Defined in PRD using Given-When-Then format or checklist format.

**AgentOS**: Standard methodology and templates for AI-augmented development, including PRD, TRD, Definition of Done, and Acceptance Criteria guidelines.

**ai-mesh-orchestrator**: Strategic orchestration agent responsible for high-level request analysis and delegation to appropriate specialist agents or orchestrators.

**Context7**: MCP (Model Context Protocol) server providing versioned documentation for frameworks and libraries. Used by agents to fetch latest documentation during implementation.

**Definition of Done (DoD)**: Comprehensive checklist of quality gates that must be met before a feature is considered complete. Enforced by code-reviewer agent.

**Ecto**: Elixir database wrapper and query DSL for composing database queries, managing schemas, and handling changesets.

**Elixir**: Functional programming language built on the Erlang VM (BEAM), known for concurrency, fault tolerance, and distributed systems.

**ExUnit**: Elixir's built-in testing framework for unit, integration, and functional tests.

**GenServer**: OTP behavior (pattern) for implementing stateful server processes with synchronous and asynchronous message handling.

**MCP (Model Context Protocol)**: Protocol for integrating external tools and services with Claude Code agents (e.g., Context7, Playwright, Linear).

**N+1 Query Problem**: Performance anti-pattern where a query is executed once for a list, then once for each item in the list (1 + N queries). Solved with eager loading (preload/join).

**Oban**: Background job processing library for Elixir/Phoenix with reliable job execution, retries, and cron-like scheduling.

**OTP (Open Telecom Platform)**: Set of Erlang libraries and design principles for building fault-tolerant, distributed systems. Includes GenServer, Supervisor, Application behaviors.

**Phoenix**: Web framework for Elixir, similar to Rails (Ruby) or Django (Python). Includes MVC, routing, Ecto integration, and real-time features.

**Phoenix Channels**: Real-time bidirectional communication between server and client using WebSockets or long-polling.

**Phoenix LiveView**: Server-rendered real-time UI framework that updates page content without full page reloads or JavaScript frameworks. State managed on server, updates pushed to client.

**Phoenix PubSub**: Publish-subscribe messaging system for distributing messages across processes and nodes in Phoenix applications.

**Product Requirements Document (PRD)**: Document defining product goals, user needs, acceptance criteria, and business requirements. Created by product-management-orchestrator.

**Supervisor**: OTP behavior for monitoring and restarting child processes when they crash, implementing fault tolerance through supervision trees.

**Supervision Tree**: Hierarchical structure of supervisors and workers, defining restart strategies and fault tolerance behavior.

**Technical Requirements Document (TRD)**: Document defining technical architecture, implementation plan, task breakdown, and quality gates. Created by tech-lead-orchestrator from PRD.

**tech-lead-orchestrator**: Development methodology orchestrator responsible for converting PRDs to TRDs, task breakdown, and specialist agent delegation.

**test-runner**: Agent responsible for executing test suites (ExUnit, Jest, RSpec) and analyzing test failures.

---

**End of PRD**: Elixir/Phoenix Expert Agent Integration
**Next Steps**: TRD Creation (tech-lead-orchestrator), Implementation Planning, Stakeholder Review
