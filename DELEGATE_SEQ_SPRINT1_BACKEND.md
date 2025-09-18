@nestjs-backend-expert

# Seq Structured Logging Integration - Sprint 1: Backend Foundation

You are being delegated to implement **Sprint 1** of the Seq integration TRD with **4 critical backend foundation tasks**.

## Implementation Context

**TRD Location**: `docs/TRD/seq-integration-trd.md`
**Target Directory**: `src/monitoring-web-service/` 
**Existing Infrastructure**: Winston logging with structured helpers in `src/config/logger.ts`

## Sprint 1 Tasks (20 hours total)

### ✅ **Task 1.1: Install and Configure seq-logging Package (6 hours)**

**Requirements:**
- Install `seq-logging` npm package and TypeScript types
- Create SeqTransport class extending winston.Transport  
- Implement batch processing with configurable intervals
- Add circuit breaker pattern for reliability
- Configure environment-specific Seq server URLs
- Write unit tests for transport configuration
- Document configuration options and examples

**Performance Target**: <5ms per log entry overhead

### ✅ **Task 1.2: Winston Integration (4 hours)**

**Requirements:**
- Modify existing Winston logger configuration in `src/config/logger.ts`
- Add Seq transport to logger instances
- Implement structured logging helper functions
- Ensure backward compatibility with existing logs
- Add log level filtering based on environment  
- Test integration with existing codebase
- Update logging documentation

**Compatibility**: Must maintain existing `loggers` helper structure

### ✅ **Task 1.3: Correlation Middleware (6 hours)**

**Requirements:**
- Create correlation ID generation middleware
- Implement request/response correlation tracking
- Add correlation ID to all Winston log contexts
- Create typed interfaces for log context
- Handle correlation ID propagation from headers
- Write comprehensive middleware tests
- Add performance benchmarking

**Integration**: Must work with existing multi-tenant auth middleware

### ✅ **Task 1.4: Development Seq Server Setup (4 hours)**

**Requirements:**
- Create Docker Compose configuration for Seq
- Configure development environment variables
- Set up basic Seq dashboard and queries
- Create health check integration
- Test log ingestion and search functionality  
- Document local development setup
- Create troubleshooting guide

**Infrastructure**: Must integrate with existing Docker setup

## Quality Gates

- [ ] **Performance**: <5ms per log entry overhead (P95)
- [ ] **Testing**: Unit tests with ≥80% coverage
- [ ] **Integration**: Seq connectivity validation  
- [ ] **Compatibility**: No breaking changes to existing logging
- [ ] **Documentation**: Technical implementation notes

## Sprint 1 Acceptance Criteria

- [ ] Backend logs successfully sent to Seq server
- [ ] Correlation IDs tracked across all requests
- [ ] Health check includes Seq connectivity status
- [ ] Unit test coverage ≥80% for new components
- [ ] Performance overhead <5ms per log entry

## TRD Task Tracking

**CRITICAL**: Update TRD checkboxes as you complete tasks:
- Update `docs/TRD/seq-integration-trd.md` 
- Change `[ ]` to `[x]` for completed tasks
- Maintain progressive implementation tracking

## Implementation Protocol

1. **Begin with Task 1.1**: seq-logging package setup
2. **Progressive Implementation**: Complete tasks in sequence
3. **Test Integration**: Validate each component before proceeding  
4. **Update TRD**: Mark tasks complete with checkboxes
5. **Performance Validation**: Benchmark against targets

**PROCEED WITH SPRINT 1 IMPLEMENTATION** - Start with Task 1.1 seq-logging package installation and SeqTransport class creation.

Execute the approved implementation plan with focus on backend foundation tasks.
