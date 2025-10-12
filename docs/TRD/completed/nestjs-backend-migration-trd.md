# Technical Requirements Document

# NestJS Backend Migration

**Document Version**: 1.0
**Created**: September 19, 2025
**Status**: Draft
**Product**: Fortium Monitoring Web Service Backend
**Migration Type**: Express.js → NestJS Enterprise Architecture

## Executive Summary

This Technical Requirements Document outlines the comprehensive migration strategy for transforming the Fortium backend services from Express.js to NestJS enterprise framework. The migration encompasses 50+ services and 20+ routes while maintaining 100% API compatibility, zero downtime, and achieving 20% performance improvements through NestJS's dependency injection, modular architecture, and enterprise-grade optimizations.

**Current State**: Express.js monolith with manual dependency management and complex middleware chains
**Target State**: NestJS enterprise modular architecture with automated DI container and standardized patterns
**Timeline**: 16 weeks (6 phases)
**Success Criteria**: Zero API disruption, 20% performance improvement, enhanced developer productivity

---

## System Context & Constraints

### Current Express.js Architecture Analysis

```
┌─────────────────────────────────────────────────────────────┐
│                 Express.js Monolith Architecture           │
├─────────────────────────────────────────────────────────────┤
│ Application Layer                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ • 20+ Route Files (router-based organization)          │ │
│ │ • Complex Middleware Chains (custom implementation)    │ │
│ │ • Manual Error Handling (inconsistent patterns)       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Service Layer                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ • 50+ Service Classes (manual dependency management)   │ │
│ │ • Direct Service-to-Service Coupling                   │ │
│ │ • Inconsistent Error Propagation                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Infrastructure Layer                                        │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ • Prisma ORM Integration (direct service usage)        │ │
│ │ • OpenTelemetry Instrumentation (manual setup)         │ │
│ │ • Multi-tenant Architecture (custom middleware)        │ │
│ │ • WebSocket Services (socket.io integration)           │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Current System Integration Points

- **Database**: PostgreSQL with Prisma ORM 4.x
- **Authentication**: JWT-based with refresh token mechanism
- **Real-time**: Socket.io for WebSocket communication
- **Monitoring**: OpenTelemetry with custom instrumentation
- **Cache**: Redis for session and data caching
- **Queue**: Background job processing with custom implementation
- **Deployment**: Docker containers with Kubernetes orchestration

### Technical Constraints

#### Framework Requirements
- **Node.js**: 18+ LTS (maintain current version compatibility)
- **TypeScript**: 5.0+ with strict mode enforcement
- **NestJS**: 10.x LTS with enterprise features
- **Prisma ORM**: Maintain current version and schema without modifications
- **Testing**: Jest framework with existing test infrastructure

#### Infrastructure Limitations
- **Zero Downtime**: Production deployment must maintain 100% uptime
- **API Compatibility**: All 20+ REST endpoints must maintain identical behavior
- **Database**: No schema modifications or data migrations allowed
- **Container**: Maintain current Docker container architecture
- **CI/CD**: GitHub Actions compatibility required

#### Security Policies
- **SOC 2 Type II**: Compliance maintained throughout migration
- **GDPR**: Data protection requirements preserved
- **Authentication**: JWT and SSO integration must function identically
- **Rate Limiting**: Current API rate limits and behavior preserved
- **Input Validation**: All request validation rules migrated to NestJS pipes

#### Performance Requirements
- **Response Time**: P95 ≤ current baseline (<200ms for API calls)
- **Throughput**: Handle ≥ 1000 req/min sustained load
- **Memory Usage**: ≤ 110% of current usage during steady state
- **Startup Time**: ≤ 30 seconds (vs current 15 seconds)
- **WebSocket Latency**: Real-time message delivery ≤ 100ms

---

## Architecture Overview

### Target NestJS Enterprise Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  NestJS Enterprise Platform               │
├─────────────────────────────────────────────────────────────┤
│ Application Module (Root)                                   │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │                App Module Orchestration                 │ │
│ │ • Global Configuration Management                       │ │
│ │ • Cross-Module Dependency Resolution                    │ │
│ │ • Application Lifecycle Management                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Core Business Modules                                       │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │    Auth     │ │  Metrics    │ │ Analytics   │            │
│ │   Module    │ │   Module    │ │   Module    │            │
│ │ • JWT Auth  │ │ • Collection│ │ • Reports   │            │
│ │ • Guards    │ │ • Processing│ │ • Trends    │            │
│ │ • Pipes     │ │ • Storage   │ │ • Insights  │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                             │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │  Websocket  │ │   Tenant    │ │    Logs     │            │
│ │   Module    │ │   Module    │ │   Module    │            │
│ │ • Gateway   │ │ • Isolation │ │ • Search    │            │
│ │ • Events    │ │ • Context   │ │ • Analysis  │            │
│ │ • Filters   │ │ • Security  │ │ • Retention │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                             │
│ Shared Infrastructure Layer                                 │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Config    │ Database  │ Logger    │ Cache    │ Queue    │ │
│ │ Module    │ Module    │ Module    │ Module   │ Module   │ │
│ │ • Env     │ • Prisma  │ • Winston │ • Redis  │ • Bull   │ │
│ │ • Flags   │ • Health  │ • Context │ • TTL    │ • Jobs   │ │
│ │ • Schema  │ • Trans   │ • Levels  │ • Keys   │ • Retry  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Cross-Cutting Concerns                                      │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Security  │ Health    │ Monitoring│ Documentation      │ │
│ │ Module    │ Module    │ Module    │ Module              │ │
│ │ • CORS    │ • Checks  │ • Telemetry│ • Swagger         │ │
│ │ • Headers │ • Status  │ • Metrics │ • OpenAPI          │ │
│ │ • Rate    │ • Probes  │ • Tracing │ • Examples         │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### High-Level Design Components

#### Core Business Modules

1. **AuthModule**: Centralized authentication and authorization
   - JWT service with token validation and refresh
   - Guards for route protection and role-based access
   - Pipes for request validation and sanitization
   - SSO integration with external providers

2. **MetricsModule**: Metrics collection and processing
   - Data collection services with real-time aggregation
   - Processing pipelines for analytics computation
   - Storage abstraction for multiple backend support
   - API endpoints for metrics retrieval and visualization

3. **AnalyticsModule**: Advanced analytics and reporting
   - Trend analysis and pattern recognition
   - Report generation with customizable parameters
   - Dashboard data aggregation and caching
   - Export functionality for external systems

4. **TenantModule**: Multi-tenant architecture support
   - Tenant isolation and context management
   - Data segregation and security enforcement
   - Resource allocation and quota management
   - Tenant-specific configuration and customization

5. **WebsocketModule**: Real-time communication
   - WebSocket gateway with room management
   - Event-driven architecture for real-time updates
   - Connection management and authentication
   - Message broadcasting and targeted delivery

6. **LogsModule**: Log aggregation and analysis
   - Structured logging with correlation IDs
   - Log search and filtering capabilities
   - Retention policy enforcement
   - Integration with external log management systems

#### Infrastructure Modules

1. **DatabaseModule**: Data persistence and management
   - Prisma service with connection pooling
   - Transaction management and rollback capabilities
   - Health monitoring and connection status
   - Migration support for future schema changes

2. **ConfigModule**: Configuration and environment management
   - Environment variable validation and type safety
   - Feature flag management and runtime configuration
   - Secret management and secure storage
   - Configuration schema validation

3. **CacheModule**: Performance optimization through caching
   - Redis integration with clustering support
   - Cache invalidation strategies and TTL management
   - Key namespace management for multi-tenancy
   - Performance monitoring and hit rate optimization

4. **QueueModule**: Background job processing
   - Job queue management with priority support
   - Retry logic and error handling for failed jobs
   - Job monitoring and status tracking
   - Scheduled task execution and cron job support

5. **HealthModule**: Service health monitoring
   - Health check endpoints for all critical services
   - Dependency health monitoring (database, cache, external APIs)
   - Performance metrics collection and reporting
   - Alerting integration for health status changes

### Data Flow Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Client       │    │   API Gateway   │    │   Controller    │
│   Applications  │───▶│   (NestJS)      │───▶│    Layer        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                       ┌─────────────────┐             │
                       │   Middleware    │◀────────────┘
                       │   • Auth Guard  │
                       │   • Validation  │
                       │   • Logging     │
                       └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   Service       │
                       │     Layer       │───┐
                       │   • Business    │   │
                       │   • Processing  │   │
                       └─────────────────┘   │
                                │            │
                       ┌─────────────────┐   │
                       │  Infrastructure │   │
                       │     Layer       │◀──┘
                       │   • Database    │
                       │   • Cache       │
                       │   • External    │
                       └─────────────────┘
```

### Module Dependency Graph

```
AppModule (Root)
├── ConfigModule (Global)
├── DatabaseModule (Global)
├── LoggerModule (Global)
├── SecurityModule (Global)
│
├── AuthModule
│   ├── depends: ConfigModule, DatabaseModule
│   └── provides: AuthService, JwtService, Guards
│
├── MetricsModule
│   ├── depends: AuthModule, DatabaseModule, CacheModule
│   └── provides: MetricsService, MetricsController
│
├── AnalyticsModule
│   ├── depends: AuthModule, MetricsModule, QueueModule
│   └── provides: AnalyticsService, ReportsService
│
├── TenantModule
│   ├── depends: AuthModule, DatabaseModule
│   └── provides: TenantService, TenantContext
│
├── WebsocketModule
│   ├── depends: AuthModule, TenantModule
│   └── provides: WebsocketGateway, EventHandlers
│
└── LogsModule
    ├── depends: AuthModule, TenantModule, DatabaseModule
    └── provides: LogsService, SearchService
```

---

## Interfaces & Data Contracts

### API Specifications

#### REST Endpoint Migration Strategy

All existing REST endpoints will maintain identical interfaces during migration:

**Metrics Endpoints**:
```typescript
// Current Express Pattern
GET /api/metrics/:id
POST /api/metrics
PUT /api/metrics/:id
DELETE /api/metrics/:id

// Target NestJS Pattern (Identical Interface)
@Controller('api/metrics')
export class MetricsController {
  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get metrics by ID' })
  async findById(@Param('id') id: string): Promise<ApiResponse<Metrics>> {
    // Implementation maintains identical response format
  }

  @Post()
  @UseGuards(AuthGuard)
  @UsePipes(ValidationPipe)
  @ApiOperation({ summary: 'Create new metrics entry' })
  async create(@Body() createMetricsDto: CreateMetricsDto): Promise<ApiResponse<Metrics>> {
    // Implementation maintains identical response format
  }
}
```

**Analytics Endpoints**:
```typescript
// Existing endpoints maintaining identical interfaces
GET /api/analytics/reports/:reportId
POST /api/analytics/reports
GET /api/analytics/trends?startDate=&endDate=&granularity=
GET /api/analytics/dashboard/:tenantId
```

**Authentication Endpoints**:
```typescript
// JWT authentication flow preserved
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET /auth/profile
POST /auth/sso/initiate
GET /auth/sso/callback
```

#### Request/Response Formats

**Standard API Response Format** (Preserved):
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}
```

**Error Response Format** (Preserved):
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;           // HTTP_400_BAD_REQUEST
    message: string;        // Human-readable message
    details?: {
      field?: string;       // For validation errors
      constraint?: string;  // Validation constraint violated
      value?: any;         // Invalid value provided
    };
  };
  metadata: {
    timestamp: string;
    requestId: string;
    path: string;
  };
}
```

#### Versioning Strategy

- **API Version**: Maintain current versioning scheme (`/api/v1/`)
- **Backward Compatibility**: 100% compatibility for all v1 endpoints
- **Content Negotiation**: Preserve existing content-type handling
- **Headers**: Maintain all custom headers and their behavior

### External Integrations

#### Authentication Flow Integration

**JWT Token Validation**:
```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    // Maintain identical token validation logic
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }
}
```

**SSO Integration** (Preserved):
- OAuth 2.0 flow with external providers
- SAML integration for enterprise customers
- Token exchange and validation mechanisms
- User provisioning and role mapping

#### Database Integration Contracts

**Prisma Service Integration**:
```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit', async () => {
      await app.close();
    });
  }
}
```

**Transaction Management**:
```typescript
@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  async executeTransaction<T>(
    operation: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(operation);
  }
}
```

#### WebSocket Integration

**Real-time Event Contracts**:
```typescript
@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @SubscribeMessage('join-room')
  handleJoinRoom(client: Socket, room: string): WsResponse<string> {
    // Maintain identical room joining behavior
    client.join(room);
    return { event: 'joined-room', data: room };
  }

  @SubscribeMessage('metrics-update')
  handleMetricsUpdate(client: Socket, data: MetricsUpdateDto): void {
    // Broadcast to specific tenant rooms
    this.server.to(`tenant-${data.tenantId}`).emit('metrics-updated', data);
  }
}
```

---

## Non-functional Requirements

### Performance Requirements

#### Response Time Targets
- **API Endpoints**: P95 response time ≤ 200ms (maintain current baseline)
- **Database Queries**: P95 query execution time ≤ 50ms
- **WebSocket Messages**: Latency ≤ 100ms for real-time delivery
- **Cache Operations**: Redis operations ≤ 5ms
- **Authentication**: JWT validation ≤ 10ms per request

#### Throughput Requirements
- **Sustained Load**: Handle ≥ 1000 requests/minute continuous load
- **Peak Load**: Handle 2000 requests/minute for 15-minute periods
- **Concurrent WebSocket**: Support ≥ 500 simultaneous connections
- **Database Connections**: Optimize connection pool (20-50 connections)
- **Queue Processing**: Process ≥ 100 background jobs/minute

#### Scalability Considerations
- **Horizontal Scaling**: Support multiple application instances
- **Database Scaling**: Read replica support for analytics queries
- **Cache Scaling**: Redis cluster support for high availability
- **Load Balancing**: Session-aware load balancing for WebSocket
- **Resource Optimization**: Memory usage ≤ 110% of current baseline

#### Resource Utilization Limits
- **Memory Usage**: ≤ 512MB per application instance during normal operation
- **CPU Usage**: ≤ 70% utilization under normal load
- **Startup Time**: Application boot time ≤ 30 seconds
- **Garbage Collection**: GC pause time ≤ 100ms
- **File Descriptors**: Optimize connection and file handle usage

### Security Requirements

#### Authentication & Authorization
- **JWT Security**: Token validation with RSA256 signing
- **Session Management**: Secure session handling with Redis storage
- **Multi-factor Authentication**: Support for TOTP and SMS-based MFA
- **Role-Based Access Control**: Granular permissions with resource-level access
- **API Key Management**: Support for service-to-service authentication

#### Data Protection
- **Encryption in Transit**: TLS 1.3 for all external communications
- **Encryption at Rest**: Database encryption with customer-managed keys
- **PII Protection**: Automatic detection and masking of sensitive data
- **Data Classification**: Implement data sensitivity levels and handling
- **Audit Logging**: Comprehensive audit trail for all data access

#### Input Validation
- **Request Validation**: Schema-based validation for all API inputs
- **SQL Injection Prevention**: Parameterized queries through Prisma ORM
- **XSS Prevention**: Input sanitization and output encoding
- **CSRF Protection**: Token-based CSRF protection for state-changing operations
- **Rate Limiting**: Per-user and per-IP rate limiting with progressive delays

#### Security Scanning Requirements
- **Dependency Scanning**: Automated vulnerability scanning of npm packages
- **SAST**: Static Application Security Testing in CI/CD pipeline
- **DAST**: Dynamic security testing of deployed applications
- **Penetration Testing**: Quarterly security assessments
- **Compliance Scanning**: SOC 2 and GDPR compliance validation

### Reliability & Observability

#### Uptime Targets
- **Service Availability**: 99.9% uptime SLA (≤ 43 minutes downtime/month)
- **Database Availability**: 99.95% availability with automated failover
- **Cache Availability**: 99.9% Redis availability with cluster support
- **External Dependencies**: Circuit breaker pattern for external services
- **Graceful Degradation**: Maintain core functionality during partial outages

#### Error Handling Strategy
- **Global Exception Filter**: Centralized error handling and logging
- **Circuit Breakers**: Prevent cascade failures with configurable thresholds
- **Retry Logic**: Exponential backoff with jitter for transient failures
- **Fallback Mechanisms**: Default responses for non-critical failures
- **Error Classification**: Distinguish between user errors and system errors

#### Monitoring & Alerting
- **Application Metrics**: Response times, throughput, error rates
- **Infrastructure Metrics**: CPU, memory, disk, network utilization
- **Business Metrics**: User activity, feature usage, conversion rates
- **Custom Dashboards**: Real-time visualization of key performance indicators
- **Alerting Rules**: Configurable thresholds with escalation procedures

#### Logging Requirements
- **Structured Logging**: JSON-formatted logs with consistent schema
- **Correlation IDs**: Trace requests across service boundaries
- **Log Levels**: Configurable log levels (debug, info, warn, error)
- **Log Aggregation**: Centralized log collection and searchability
- **Log Retention**: Configurable retention policies (30 days default)

#### Disaster Recovery
- **Backup Strategy**: Automated daily backups with point-in-time recovery
- **RTO Target**: Recovery Time Objective ≤ 15 minutes
- **RPO Target**: Recovery Point Objective ≤ 5 minutes
- **Failover Testing**: Monthly disaster recovery drills
- **Data Replication**: Cross-region replication for critical data

---

## Test Strategy

### Unit Testing Strategy

#### Coverage Targets
- **Business Logic**: ≥ 90% test coverage for service classes
- **Controllers**: ≥ 85% test coverage for endpoint handlers
- **Utilities**: ≥ 95% test coverage for helper functions
- **Guards & Pipes**: ≥ 90% test coverage for security components
- **Overall Target**: ≥ 85% total code coverage

#### Testing Frameworks & Tools
- **Primary Framework**: Jest with TypeScript support
- **Mocking**: jest.mock() for dependencies and external services
- **Test Utilities**: @nestjs/testing for module testing infrastructure
- **Coverage Reporting**: Istanbul/NYC for coverage analysis
- **Assertion Library**: Jest built-in assertions with custom matchers

#### Mock Strategy
```typescript
// Service Layer Mocking
describe('MetricsService', () => {
  let service: MetricsService;
  let prismaService: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: PrismaService,
          useValue: {
            metrics: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
    prismaService = module.get(PrismaService);
  });

  it('should find metrics by id', async () => {
    const mockMetrics = { id: '1', name: 'test', value: 100 };
    prismaService.metrics.findUnique.mockResolvedValue(mockMetrics);

    const result = await service.findById('1');
    expect(result).toEqual(mockMetrics);
    expect(prismaService.metrics.findUnique).toHaveBeenCalledWith({
      where: { id: '1' },
    });
  });
});
```

### Integration Testing Strategy

#### API Contract Testing
- **Endpoint Testing**: Validate all REST endpoints with real HTTP requests
- **Response Validation**: Verify response schemas and data types
- **Error Scenarios**: Test error handling and status codes
- **Authentication**: Validate JWT token handling and authorization
- **Rate Limiting**: Test rate limiting behavior and responses

#### Database Integration
- **Repository Testing**: Test Prisma repository operations with test database
- **Transaction Testing**: Validate transaction rollback and commit behavior
- **Migration Testing**: Test database schema migrations and rollbacks
- **Performance Testing**: Validate query performance against benchmarks
- **Connection Testing**: Test connection pooling and timeout handling

#### External Service Mocking
- **HTTP Mocking**: Use nock or similar for external API mocking
- **WebSocket Testing**: Test real-time communication with mock clients
- **Cache Testing**: Integration testing with Redis test instance
- **Queue Testing**: Background job processing with test queue
- **File System**: Test file upload/download with temporary storage

#### Coverage Targets
- **API Endpoints**: ≥ 80% endpoint coverage with positive and negative tests
- **Database Operations**: ≥ 75% repository method coverage
- **External Integrations**: ≥ 70% integration point coverage
- **Error Scenarios**: ≥ 80% error path coverage

### End-to-End Testing Strategy

#### User Journey Coverage
- **Authentication Flow**: Complete login/logout/refresh token cycles
- **Data Management**: CRUD operations for all major entities
- **Real-time Features**: WebSocket connection and message delivery
- **Multi-tenant Scenarios**: Tenant isolation and data segregation
- **Analytics Workflows**: Report generation and data visualization

#### Cross-Browser Testing
- **Browser Support**: Chrome, Firefox, Safari, Edge latest versions
- **Mobile Testing**: iOS Safari and Android Chrome
- **WebSocket Testing**: Real-time features across different browsers
- **Performance Testing**: Load testing across browser environments

#### Performance Testing
- **Load Testing**: Concurrent user simulation (500+ users)
- **Stress Testing**: Peak load scenarios (2000+ requests/minute)
- **Endurance Testing**: Long-running scenarios (24+ hours)
- **Spike Testing**: Sudden traffic increases and recovery
- **Volume Testing**: Large dataset processing and retrieval

#### Accessibility Testing
- **WCAG 2.1 AA**: Compliance testing for web interfaces
- **Screen Reader**: Testing with assistive technologies
- **Keyboard Navigation**: Full keyboard accessibility validation
- **Color Contrast**: Visual accessibility compliance
- **Semantic HTML**: Proper markup and ARIA implementation

#### E2E Testing Infrastructure
```typescript
// Playwright E2E Test Example
describe('Metrics Management E2E', () => {
  let page: Page;
  let context: BrowserContext;

  beforeAll(async () => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  it('should create, read, update, and delete metrics', async () => {
    // Login
    await page.goto('/auth/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');

    // Create metrics
    await page.goto('/metrics/new');
    await page.fill('[data-testid="metric-name"]', 'Test Metric');
    await page.fill('[data-testid="metric-value"]', '100');
    await page.click('[data-testid="save-button"]');

    // Verify creation
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();

    // Additional CRUD operations...
  });
});
```

---

## Implementation Plan

### Phase 1: Foundation & Infrastructure (Weeks 1-3)

#### Sprint 1.1: Project Setup & Core Infrastructure (Week 1)

- [ ] **Initialize NestJS Application** (4h)
  - Set up NestJS CLI and project structure
  - Configure TypeScript with strict mode
  - Set up ESLint and Prettier with existing rules
  - Configure package.json and dependencies

- [ ] **ConfigModule Implementation** (6h)
  - Create global configuration module
  - Implement environment variable validation with Joi
  - Set up configuration schema and type safety
  - Migrate existing environment variables

- [ ] **LoggerModule Setup** (4h)
  - Implement Winston logger with NestJS integration
  - Configure log levels and output formats
  - Set up correlation ID generation
  - Implement structured logging patterns

- [ ] **Development Environment** (4h)
  - Configure hot reload and debugging
  - Set up development scripts and commands
  - Configure VS Code settings and extensions
  - Document development setup procedures

**Sprint 1.1 Acceptance Criteria**:
- [ ] NestJS application starts successfully
- [ ] Configuration loads from environment variables
- [ ] Logging outputs structured JSON logs
- [ ] Development hot reload works in <3 seconds

#### Sprint 1.2: Database & Health Infrastructure (Week 2)

- [ ] **DatabaseModule Implementation** (8h)
  - Create Prisma service with NestJS integration
  - Configure connection pooling and health checks
  - Implement transaction management service
  - Set up database connection monitoring

- [ ] **HealthModule Setup** (4h)
  - Implement health check endpoints
  - Configure database health monitoring
  - Set up dependency health checks
  - Create health check dashboard

- [ ] **Testing Infrastructure** (6h)
  - Set up Jest testing configuration
  - Configure test database and migrations
  - Implement testing utilities and helpers
  - Set up coverage reporting

- [ ] **Docker Configuration** (4h)
  - Update Dockerfile for NestJS application
  - Configure docker-compose for development
  - Set up environment variable handling
  - Test container build and deployment

**Sprint 1.2 Acceptance Criteria**:
- [ ] Database connections work with health monitoring
- [ ] Health check endpoints return proper status
- [ ] Test suite runs with coverage reporting
- [ ] Docker containers build and run successfully

#### Sprint 1.3: CI/CD & Security Foundation (Week 3)

- [ ] **CI/CD Pipeline Updates** (6h)
  - Update GitHub Actions for NestJS build
  - Configure automated testing pipeline
  - Set up code coverage reporting
  - Implement deployment automation

- [ ] **SecurityModule Foundation** (6h)
  - Implement CORS configuration
  - Set up security headers middleware
  - Configure rate limiting foundation
  - Implement input sanitization pipes

- [ ] **Documentation Setup** (4h)
  - Configure Swagger/OpenAPI documentation
  - Set up automated API documentation
  - Create architecture documentation
  - Document migration procedures

- [ ] **Monitoring Integration** (6h)
  - Set up OpenTelemetry with NestJS
  - Configure metrics collection
  - Implement tracing infrastructure
  - Set up monitoring dashboards

**Sprint 1.3 Acceptance Criteria**:
- [ ] CI/CD pipeline builds and tests successfully
- [ ] Security headers and CORS work properly
- [ ] API documentation generates automatically
- [ ] OpenTelemetry collects metrics and traces

### Phase 2: Authentication & Security (Weeks 4-5)

#### Sprint 2.1: Authentication Core (Week 4)

- [ ] **AuthModule Implementation** (8h)
  - Create JWT service with token validation
  - Implement authentication guards
  - Set up passport strategies
  - Configure token refresh mechanism

- [ ] **User Management Migration** (6h)
  - Migrate user service to NestJS providers
  - Implement password hashing and validation
  - Set up user role and permission system
  - Create user management controllers

- [ ] **Guards & Middleware** (6h)
  - Implement JWT authentication guard
  - Create role-based authorization guards
  - Set up request validation pipes
  - Implement tenant context middleware

- [ ] **Session Management** (4h)
  - Integrate Redis for session storage
  - Implement session-based authentication
  - Set up session cleanup and expiration
  - Configure session security policies

**Sprint 2.1 Acceptance Criteria**:
- [ ] JWT authentication works identically to Express version
- [ ] User login/logout flow functions properly
- [ ] Role-based access control enforces permissions
- [ ] Session management maintains security standards

#### Sprint 2.2: Advanced Security & Validation (Week 5)

- [ ] **Input Validation System** (8h)
  - Implement class-validator pipes
  - Create validation DTOs for all endpoints
  - Set up custom validation decorators
  - Implement sanitization and transformation

- [ ] **Authorization Enhancement** (6h)
  - Implement resource-based authorization
  - Set up permission hierarchies
  - Create authorization decorators
  - Implement tenant-based access control

- [ ] **Security Middleware** (6h)
  - Implement rate limiting per user/IP
  - Set up CSRF protection
  - Configure security headers
  - Implement request filtering

- [ ] **Error Handling** (4h)
  - Create global exception filters
  - Implement security-aware error responses
  - Set up error logging and monitoring
  - Configure error response sanitization

**Sprint 2.2 Acceptance Criteria**:
- [ ] All API inputs validated according to schemas
- [ ] Resource-based authorization enforces access control
- [ ] Rate limiting prevents abuse
- [ ] Error responses maintain security and consistency

### Phase 3: Core Business Services (Weeks 6-9)

#### Sprint 3.1: MetricsModule Migration (Week 6)

- [ ] **Metrics Service Migration** (10h)
  - Convert metrics service to NestJS provider
  - Implement dependency injection for service dependencies
  - Migrate metrics collection and aggregation logic
  - Set up metrics processing pipelines

- [ ] **Metrics Controller Implementation** (6h)
  - Create metrics REST endpoints with decorators
  - Implement request/response DTOs
  - Set up authentication and authorization guards
  - Add Swagger documentation for metrics API

- [ ] **Metrics Data Layer** (6h)
  - Integrate metrics repository with Prisma
  - Implement query optimization for analytics
  - Set up caching layer for frequently accessed metrics
  - Configure metrics data retention policies

- [ ] **Testing & Validation** (6h)
  - Create comprehensive unit tests for metrics service
  - Implement integration tests for metrics API
  - Set up performance tests for metrics queries
  - Validate API compatibility with existing clients

**Sprint 3.1 Acceptance Criteria**:
- [ ] All metrics endpoints respond identically to Express version
- [ ] Metrics collection and aggregation maintain performance
- [ ] Caching improves response times for dashboard queries
- [ ] Test coverage meets quality standards (≥90%)

#### Sprint 3.2: AnalyticsModule Migration (Week 7)

- [ ] **Analytics Service Migration** (10h)
  - Convert analytics computation services
  - Implement reporting and trend analysis
  - Set up dashboard data aggregation
  - Migrate export functionality

- [ ] **Analytics Controllers** (6h)
  - Create analytics API endpoints
  - Implement report generation endpoints
  - Set up dashboard data endpoints
  - Add analytics API documentation

- [ ] **Performance Optimization** (6h)
  - Implement query optimization for large datasets
  - Set up background processing for heavy computations
  - Configure caching for dashboard queries
  - Optimize memory usage for data processing

- [ ] **Integration Testing** (6h)
  - Test analytics API endpoints
  - Validate report generation accuracy
  - Test dashboard data consistency
  - Performance test with large datasets

**Sprint 3.2 Acceptance Criteria**:
- [ ] Analytics endpoints maintain identical functionality
- [ ] Report generation completes within performance targets
- [ ] Dashboard queries return within 200ms P95
- [ ] Background processing handles large datasets efficiently

#### Sprint 3.3: TenantModule Migration (Week 8)

- [ ] **Tenant Service Migration** (8h)
  - Convert tenant management service
  - Implement tenant context and isolation
  - Set up tenant provisioning and configuration
  - Migrate tenant-specific resource management

- [ ] **Multi-tenancy Infrastructure** (8h)
  - Implement tenant context middleware
  - Set up data isolation patterns
  - Configure tenant-based routing
  - Implement tenant-specific caching

- [ ] **Tenant API Implementation** (6h)
  - Create tenant management endpoints
  - Implement tenant configuration API
  - Set up tenant health monitoring
  - Add tenant API documentation

- [ ] **Security & Testing** (6h)
  - Validate tenant data isolation
  - Test cross-tenant security boundaries
  - Implement tenant-based authorization
  - Test tenant provisioning workflows

**Sprint 3.3 Acceptance Criteria**:
- [ ] Tenant isolation maintains security boundaries
- [ ] Tenant context propagates correctly through request lifecycle
- [ ] Tenant management API functions identically
- [ ] Multi-tenant performance meets baseline requirements

#### Sprint 3.4: Service Integration & Testing (Week 9)

- [ ] **Cross-Service Integration** (8h)
  - Implement service-to-service communication
  - Set up dependency injection between modules
  - Configure event-driven communication patterns
  - Test service interaction scenarios

- [ ] **Data Transfer Objects** (6h)
  - Create comprehensive DTO classes
  - Implement validation schemas
  - Set up transformation and serialization
  - Add API documentation for all DTOs

- [ ] **Integration Testing** (8h)
  - Test complete business workflows
  - Validate cross-module interactions
  - Test transaction boundaries
  - Performance test integrated scenarios

- [ ] **Documentation & Monitoring** (6h)
  - Update API documentation
  - Configure monitoring for new services
  - Set up alerting for service health
  - Document troubleshooting procedures

**Sprint 3.4 Acceptance Criteria**:
- [ ] All core business modules integrate successfully
- [ ] Cross-module workflows maintain consistency
- [ ] API documentation reflects all changes
- [ ] Monitoring provides visibility into service health

### Phase 4: Real-time & External Integrations (Weeks 10-11)

#### Sprint 4.1: WebSocket Migration (Week 10)

- [ ] **WebSocketModule Implementation** (10h)
  - Create WebSocket gateway with NestJS decorators
  - Implement connection management and authentication
  - Set up room management for multi-tenancy
  - Migrate real-time event handling

- [ ] **Event-Driven Architecture** (8h)
  - Implement event emitters and listeners
  - Set up event-driven communication between modules
  - Create event schemas and validation
  - Configure event persistence and replay

- [ ] **Real-time Features Migration** (6h)
  - Migrate live dashboard updates
  - Implement real-time notification system
  - Set up live metrics streaming
  - Configure real-time chat functionality

- [ ] **WebSocket Testing** (4h)
  - Test WebSocket connection and authentication
  - Validate real-time message delivery
  - Test multi-tenant room isolation
  - Performance test concurrent connections

**Sprint 4.1 Acceptance Criteria**:
- [ ] WebSocket connections authenticate properly
- [ ] Real-time features maintain identical functionality
- [ ] Multi-tenant isolation works in real-time communication
- [ ] WebSocket performance meets latency requirements (<100ms)

#### Sprint 4.2: External Integrations & Background Jobs (Week 11)

- [ ] **External API Integration** (8h)
  - Migrate external service HTTP clients
  - Implement circuit breaker patterns
  - Set up API authentication and rate limiting
  - Configure retry logic and error handling

- [ ] **QueueModule Implementation** (8h)
  - Set up Bull queue with Redis backend
  - Implement job processing and scheduling
  - Configure job retry and failure handling
  - Set up job monitoring and management

- [ ] **File Handling Migration** (6h)
  - Migrate file upload/download functionality
  - Implement multipart file processing
  - Set up file validation and security scanning
  - Configure cloud storage integration

- [ ] **Background Services** (6h)
  - Migrate scheduled tasks and cron jobs
  - Implement background data processing
  - Set up cleanup and maintenance tasks
  - Configure monitoring for background jobs

**Sprint 4.2 Acceptance Criteria**:
- [ ] External API integrations work with circuit breakers
- [ ] Background job processing maintains reliability
- [ ] File upload/download maintains security and functionality
- [ ] Scheduled tasks run according to existing schedules

### Phase 5: Observability & Monitoring (Weeks 12-13)

#### Sprint 5.1: Enhanced Observability (Week 12)

- [ ] **OpenTelemetry Enhancement** (8h)
  - Implement NestJS-specific instrumentation
  - Set up custom metrics collection
  - Configure distributed tracing
  - Integrate with existing monitoring systems

- [ ] **Structured Logging Enhancement** (6h)
  - Implement correlation IDs across service calls
  - Set up log aggregation and searching
  - Configure log levels and filtering
  - Implement security-aware logging

- [ ] **Custom Metrics Collection** (6h)
  - Implement business metrics collection
  - Set up performance monitoring
  - Configure error rate and latency tracking
  - Create custom dashboard metrics

- [ ] **Monitoring Integration** (8h)
  - Configure monitoring dashboards
  - Set up alerting rules and thresholds
  - Implement health check monitoring
  - Configure performance baseline monitoring

**Sprint 5.1 Acceptance Criteria**:
- [ ] OpenTelemetry provides comprehensive tracing
- [ ] Structured logging enables effective debugging
- [ ] Custom metrics provide business insights
- [ ] Monitoring dashboards show application health

#### Sprint 5.2: Documentation & Performance Monitoring (Week 13)

- [ ] **API Documentation Enhancement** (6h)
  - Complete Swagger/OpenAPI documentation
  - Add examples and usage guides
  - Implement interactive API explorer
  - Create API client libraries

- [ ] **Performance Monitoring** (8h)
  - Set up application performance monitoring
  - Configure performance baselines and alerting
  - Implement performance regression detection
  - Set up capacity planning metrics

- [ ] **Security Monitoring** (6h)
  - Implement security event logging
  - Set up intrusion detection alerts
  - Configure compliance monitoring
  - Implement audit trail analysis

- [ ] **Operational Documentation** (8h)
  - Create deployment procedures
  - Document troubleshooting guides
  - Set up runbook documentation
  - Create disaster recovery procedures

**Sprint 5.2 Acceptance Criteria**:
- [ ] API documentation provides comprehensive guidance
- [ ] Performance monitoring detects regressions
- [ ] Security monitoring provides threat visibility
- [ ] Operational documentation enables effective support

### Phase 6: Testing & Deployment (Weeks 14-16)

#### Sprint 6.1: Comprehensive Testing (Week 14)

- [ ] **End-to-End Test Suite** (10h)
  - Create comprehensive E2E tests for all user journeys
  - Implement cross-browser testing
  - Set up automated regression testing
  - Configure test data management

- [ ] **Load Testing Implementation** (8h)
  - Create load testing scenarios
  - Implement performance benchmarking
  - Set up scalability testing
  - Configure stress testing procedures

- [ ] **Security Testing** (6h)
  - Implement security scanning automation
  - Set up penetration testing procedures
  - Configure vulnerability assessment
  - Implement compliance validation

- [ ] **Integration Test Enhancement** (4h)
  - Enhance integration test coverage
  - Implement chaos engineering tests
  - Set up dependency testing
  - Configure contract testing

**Sprint 6.1 Acceptance Criteria**:
- [ ] E2E tests cover all critical user journeys
- [ ] Load testing validates performance requirements
- [ ] Security testing passes all compliance requirements
- [ ] Integration tests provide comprehensive coverage

#### Sprint 6.2: Production Deployment Preparation (Week 15)

- [ ] **Deployment Strategy Implementation** (8h)
  - Implement blue-green deployment strategy
  - Set up canary deployment procedures
  - Configure rollback mechanisms
  - Test deployment automation

- [ ] **Production Configuration** (6h)
  - Configure production environment settings
  - Set up production monitoring and alerting
  - Implement production security configurations
  - Configure production backup procedures

- [ ] **Migration Scripts & Procedures** (6h)
  - Create data migration validation scripts
  - Implement configuration migration procedures
  - Set up rollback scripts and procedures
  - Configure migration monitoring

- [ ] **Disaster Recovery Testing** (8h)
  - Test backup and recovery procedures
  - Implement disaster recovery automation
  - Configure cross-region failover
  - Test emergency response procedures

**Sprint 6.2 Acceptance Criteria**:
- [ ] Blue-green deployment works flawlessly
- [ ] Production configuration meets security standards
- [ ] Migration procedures are tested and documented
- [ ] Disaster recovery procedures meet RTO/RPO targets

#### Sprint 6.3: Production Deployment & Validation (Week 16)

- [ ] **Production Deployment** (8h)
  - Execute blue-green deployment to production
  - Monitor deployment metrics and health
  - Validate all services are functioning
  - Configure production traffic routing

- [ ] **Post-Deployment Validation** (6h)
  - Validate API compatibility with existing clients
  - Test real-time features in production
  - Validate performance meets baseline requirements
  - Test monitoring and alerting in production

- [ ] **User Acceptance Testing** (6h)
  - Coordinate stakeholder validation
  - Execute user acceptance test scenarios
  - Validate business functionality
  - Gather feedback and address issues

- [ ] **Documentation & Handover** (8h)
  - Complete production documentation
  - Update operational procedures
  - Conduct team training sessions
  - Create post-migration support procedures

**Sprint 6.3 Acceptance Criteria**:
- [ ] Production deployment completes with zero downtime
- [ ] All API endpoints function identically to Express version
- [ ] Performance meets or exceeds baseline requirements
- [ ] Stakeholders validate successful migration

---

## Deployment & Migration Notes

### Deployment Strategy

#### Blue-Green Deployment Implementation

**Infrastructure Setup**:
```yaml
# Blue-Green Environment Configuration
environments:
  blue:
    name: "production-blue"
    replicas: 3
    version: "express-current"
    traffic_weight: 100%

  green:
    name: "production-green"
    replicas: 3
    version: "nestjs-migrated"
    traffic_weight: 0%

load_balancer:
  type: "application"
  health_check:
    path: "/health"
    interval: 30s
    timeout: 5s
    healthy_threshold: 2
```

**Deployment Process**:
1. **Pre-deployment Validation** (30 minutes)
   - Deploy to green environment with 0% traffic
   - Run comprehensive health checks
   - Validate database connectivity and migrations
   - Execute smoke tests for critical functionality

2. **Gradual Traffic Shift** (2 hours)
   - Route 5% traffic to green environment
   - Monitor metrics and error rates for 30 minutes
   - Increase to 25% traffic if metrics are stable
   - Monitor for 30 minutes, then increase to 50%
   - Final switch to 100% traffic to green environment

3. **Post-deployment Monitoring** (24 hours)
   - Monitor application performance and error rates
   - Validate real-time features and WebSocket connections
   - Check database performance and query optimization
   - Monitor external API integrations and rate limits

#### Rollout Plan

**Phase 1: Internal Testing** (Week 14)
- Deploy to staging environment
- Execute comprehensive test suite
- Validate performance benchmarks
- Security testing and compliance validation

**Phase 2: Canary Deployment** (Week 15)
- Deploy to production with 5% traffic
- Monitor for 24 hours with minimal traffic
- Gradually increase traffic based on metrics
- Maintain rollback capability throughout

**Phase 3: Full Production** (Week 16)
- Complete traffic migration to NestJS
- Monitor for 72 hours post-migration
- Validate all functionality and performance
- Decommission Express.js environment

#### Feature Flags Configuration

```typescript
@Controller('api/metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly configService: ConfigService,
  ) {}

  @Get(':id')
  async findById(@Param('id') id: string) {
    // Feature flag for gradual migration
    const useNestJSService = this.configService.get<boolean>('NESTJS_METRICS_ENABLED', false);

    if (useNestJSService) {
      return this.metricsService.findById(id);
    } else {
      // Fallback to Express service during transition
      return this.legacyMetricsService.findById(id);
    }
  }
}
```

#### Rollback Procedures

**Immediate Rollback Triggers**:
- Error rate increase >2% above baseline
- Response time P95 increase >50% above baseline
- Database connection failures >1%
- WebSocket connection drop rate >5%
- Critical security incident detection

**Rollback Process** (15-minute target):
1. **Trigger Detection** (1 minute)
   - Automated monitoring alerts
   - Manual trigger via operations dashboard
   - Circuit breaker activation

2. **Traffic Redirection** (5 minutes)
   - Immediate traffic routing to blue environment
   - Health check validation of blue environment
   - DNS/load balancer configuration update

3. **Validation & Communication** (9 minutes)
   - Validate traffic restoration to blue environment
   - Confirm error rates return to baseline
   - Notify stakeholders of rollback execution
   - Begin root cause analysis

### Database Migrations

#### Schema Compatibility Strategy

**No Schema Changes Required**:
- NestJS migration maintains identical Prisma schema
- All database operations use existing table structures
- No data migration or transformation needed
- Maintains backward compatibility with existing data

**Connection Management**:
```typescript
// Prisma Configuration for NestJS
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: async (configService: ConfigService) => {
        const prisma = new PrismaService({
          datasources: {
            db: {
              url: configService.get<string>('DATABASE_URL'),
            },
          },
          log: ['query', 'info', 'warn', 'error'],
        });

        await prisma.$connect();
        return prisma;
      },
      inject: [ConfigService],
    },
  ],
  exports: [PrismaService],
})
export class DatabaseModule {}
```

#### Connection Pool Configuration

**Optimized Pool Settings**:
```env
# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/db?connection_limit=20&pool_timeout=20"
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
DATABASE_POOL_ACQUIRE_TIMEOUT=60000
DATABASE_POOL_IDLE_TIMEOUT=300000
```

**Health Monitoring**:
```typescript
@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true, { message: 'Database connection is healthy' });
    } catch (error) {
      return this.getStatus(key, false, { message: error.message });
    }
  }
}
```

#### Backward Compatibility

**Query Compatibility**:
- All Prisma queries maintain identical syntax
- Transaction boundaries preserved
- Query optimization maintains performance
- Error handling maintains existing behavior

**Data Access Patterns**:
```typescript
// Maintaining identical data access patterns
@Injectable()
export class MetricsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Identical method signature to Express version
  async findById(id: string): Promise<Metrics | null> {
    return this.prisma.metrics.findUnique({
      where: { id },
      include: {
        tags: true,
        aggregations: {
          orderBy: { timestamp: 'desc' },
          take: 100,
        },
      },
    });
  }

  // Maintains identical transaction handling
  async createWithTags(data: CreateMetricsDto): Promise<Metrics> {
    return this.prisma.$transaction(async (prisma) => {
      const metrics = await prisma.metrics.create({
        data: {
          name: data.name,
          value: data.value,
          timestamp: data.timestamp,
        },
      });

      if (data.tags?.length) {
        await prisma.metricsTag.createMany({
          data: data.tags.map(tag => ({
            metricsId: metrics.id,
            key: tag.key,
            value: tag.value,
          })),
        });
      }

      return metrics;
    });
  }
}
```

### Infrastructure Requirements

#### Resource Provisioning

**Application Server Requirements**:
```yaml
# Kubernetes Deployment Configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nestjs-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nestjs-backend
  template:
    spec:
      containers:
      - name: nestjs-app
        image: nestjs-backend:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

**Database Configuration**:
- Maintain existing PostgreSQL instance
- No additional database resources required
- Connection pool optimization for NestJS
- Backup and recovery procedures unchanged

**Cache Configuration**:
- Redis cluster configuration maintained
- Memory allocation increased by 10% for session storage
- TTL policies optimized for NestJS caching patterns
- High availability configuration preserved

#### Configuration Changes

**Environment Variables**:
```env
# NestJS-specific Configuration
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database Configuration (unchanged)
DATABASE_URL=postgresql://user:password@host:5432/db
DATABASE_POOL_SIZE=20

# Redis Configuration (unchanged)
REDIS_URL=redis://host:6379
REDIS_CLUSTER_ENABLED=true

# JWT Configuration (unchanged)
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# OpenTelemetry Configuration
OTEL_SERVICE_NAME=nestjs-backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:14268/api/traces
```

**Feature Flags**:
```env
# Migration Feature Flags
NESTJS_MIGRATION_ENABLED=true
NESTJS_METRICS_MODULE_ENABLED=true
NESTJS_ANALYTICS_MODULE_ENABLED=true
NESTJS_WEBSOCKET_MODULE_ENABLED=true
LEGACY_FALLBACK_ENABLED=false
```

#### Environment Setup

**Development Environment**:
```bash
# Development Setup Script
#!/bin/bash
set -e

echo "Setting up NestJS development environment..."

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.development

# Set up database
npm run db:migrate
npm run db:seed

# Start development servers
npm run start:dev &
npm run redis:start &

echo "Development environment ready!"
echo "Application: http://localhost:3000"
echo "API Documentation: http://localhost:3000/api/docs"
echo "Health Check: http://localhost:3000/health"
```

**Production Environment**:
```bash
# Production Deployment Script
#!/bin/bash
set -e

echo "Deploying NestJS to production..."

# Build application
npm run build

# Run database migrations (if any)
npm run db:migrate:prod

# Health check before deployment
npm run health:check

# Deploy with zero downtime
kubectl apply -f k8s/deployment.yaml
kubectl rollout status deployment/nestjs-backend

# Validate deployment
npm run e2e:prod

echo "Production deployment completed successfully!"
```

---

**Document Status**: Complete - Ready for Implementation
**Next Steps**: Development Kickoff → Phase 1 Implementation → Sprint Execution
**Approval Required**: Technical Architecture Review → Development Team Approval → Implementation Start

---

*This Technical Requirements Document provides comprehensive guidance for migrating the Fortium backend services from Express.js to NestJS while maintaining operational excellence, API compatibility, and zero-downtime deployment. The 16-week implementation plan includes detailed task breakdowns, acceptance criteria, and quality gates to ensure successful migration.*