# Technical Requirements Document

# Agent Analytics Platform

**Document Version**: 1.0
**Created**: September 29, 2025
**Status**: Implementation-Ready
**Based on PRD**: Version 2.0 - Implementation-Ready

---

## 1. System Context & Constraints

### 1.1 System Overview

The Agent Analytics Platform is a comprehensive multi-tenant analytics solution designed to track and accelerate AI adoption across organizations. Built on Elixir/Phoenix with PostgreSQL and ClickHouse, it provides real-time insights into agent usage, performance metrics, and adoption patterns with sophisticated business intelligence capabilities.

### 1.2 Technical Constraints

**Performance Requirements**:
- Dashboard loading: <1 second for all dashboard types
- Query response: <5000ms simple, <2s complex queries
- Real-time updates: <500ms delivery
- Sustained throughput: 10,000 events/second
- Concurrent users: 10-500 based on organization tier

**Scalability Constraints**:
- Support organizations with 10,000+ users
- Handle petabytes of analytical data
- Process 100+ million events per day
- Manage 10,000+ concurrent WebSocket connections

**Security Requirements**:
- Schema-per-tenant isolation with strict boundaries
- JWT authentication with 15-minute expiry
- OAuth integration (Google, GitHub, Office 365)
- Comprehensive audit trails (12-month retention)

### 1.3 Technology Stack

**Backend**: Elixir/Phoenix Framework with OTP principles
**Primary Database**: PostgreSQL (transactional data)
**Analytics Database**: ClickHouse (analytical queries)
**Caching**: Redis (pub/sub and session management)
**Frontend**: Phoenix LiveView with real-time updates
**Real-time**: Phoenix Channels (WebSocket communication)
**Infrastructure**: Docker + Kubernetes + Terraform

---

## 2. Architecture Overview

### 2.1 High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Load Balancer                               │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┼───────────────────────────────────────────┐
│                Phoenix Application Cluster                      │
│  ┌─────────────────┬┴─────────────────┬─────────────────────────┐│
│  │   LiveView UI   │  REST API        │  Phoenix Channels       ││
│  │   Dashboard     │  Rate Limited    │  Real-time Updates      ││
│  └─────────────────┼──────────────────┼─────────────────────────┘│
└─────────────────────┼──────────────────┼──────────────────────────┘
                      │                  │
            ┌─────────┼──────────────────┼─────────────┐
            │         │                  │             │
┌───────────▼─┐  ┌────▼────┐  ┌─────────▼──┐  ┌───────▼──────┐
│ PostgreSQL  │  │ Redis   │  │ ClickHouse │  │ Auth Service │
│ (Tenants)   │  │ Cache   │  │ Analytics  │  │ OAuth + JWT  │
└─────────────┘  └─────────┘  └────────────┘  └──────────────┘
```

### 2.2 Component Architecture

#### 2.2.1 Phoenix Application Layer
- **LiveView Frontend**: Server-rendered real-time UI with responsive design
- **REST API**: Rate-limited endpoints with comprehensive versioning
- **Phoenix Channels**: WebSocket gateway for real-time notifications
- **Authentication Service**: JWT + OAuth with multi-provider support
- **Hooks System**: Event ingestion and webhook management

#### 2.2.2 Data Layer
- **PostgreSQL**: Schema-per-tenant architecture for transactional data
- **ClickHouse**: High-performance analytical queries with tiered storage
- **Redis**: Session management, caching, and pub/sub messaging

#### 2.2.3 Processing Architecture
- **Real-Time** (<1s): Dashboard updates, active user counts
- **Near Real-Time** (1-60s): Metrics aggregation, adoption scoring
- **Batch Processing** (5+ min): Historical analysis, ROI calculations

---

## 3. Database Design

### 3.1 PostgreSQL Schema Architecture

#### 3.1.1 Multi-Tenant Isolation
```sql
-- Schema-per-tenant architecture
CREATE SCHEMA org_12345;  -- Unique schema per organization
CREATE SCHEMA org_67890;

-- Global system schema
CREATE SCHEMA system;
```

#### 3.1.2 Core Entity Design

**Organizations Table (system.organizations)**:
```sql
CREATE TABLE system.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('starter', 'professional', 'business', 'enterprise')),
    schema_name VARCHAR(63) NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Users Table (per org schema)**:
```sql
CREATE TABLE org_{id}.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'manager', 'developer')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Departments Table (per org schema)**:
```sql
CREATE TABLE org_{id}.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Department Memberships (per org schema)**:
```sql
CREATE TABLE org_{id}.department_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES org_{id}.users(id),
    department_id UUID NOT NULL REFERENCES org_{id}.departments(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, department_id)
);
```

### 3.2 ClickHouse Analytics Schema

#### 3.2.1 Events Table (Core Analytics)
```sql
CREATE TABLE events (
    event_id UUID,
    timestamp DateTime64(3),
    user_id UUID,
    organization_id UUID,
    department_id UUID,
    agent_name String,
    agent_version String,
    invocation_id UUID,
    parent_invocation_id Nullable(UUID),
    input_tokens UInt32,
    output_tokens UInt32,
    execution_time_ms UInt32,
    status Enum8('success' = 1, 'failure' = 2),
    tools_used Array(String),
    error_message Nullable(String),
    error_type Nullable(String),
    session_id UUID,
    correlation_id UUID,
    trace_id String,
    cost_usd Decimal64(4),
    model_used String,
    prompt_template_version String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (organization_id, timestamp, user_id)
SETTINGS index_granularity = 8192;
```

#### 3.2.2 Aggregation Tables
```sql
-- Hourly Aggregations
CREATE TABLE hourly_metrics (
    organization_id UUID,
    department_id UUID,
    user_id UUID,
    hour DateTime,
    total_invocations UInt32,
    successful_invocations UInt32,
    total_execution_time UInt64,
    total_tokens UInt64,
    total_cost Decimal64(4),
    unique_agents UInt16,
    unique_tools UInt16
) ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (organization_id, hour, department_id, user_id);
```

### 3.3 Tiered Storage Strategy

**Hot Storage** (0-30 days): Full-speed ClickHouse cluster
**Warm Storage** (31-90 days): Compressed ClickHouse with reduced replicas
**Cold Storage** (91+ days): Object storage with on-demand query capability

---

## 4. API Specifications

### 4.1 REST API Design

#### 4.1.1 Authentication Endpoints
```
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
POST /api/auth/oauth/{provider}
```

#### 4.1.2 Event Ingestion
```
POST /api/v1/events
Content-Type: application/json
X-Schema-Version: 1.0
Authorization: Bearer {jwt_token}

{
  "event_id": "uuid",
  "timestamp": "2025-09-29T10:00:00Z",
  "agent_name": "code-reviewer",
  "execution_time_ms": 1250,
  "status": "success",
  "input_tokens": 1500,
  "output_tokens": 800,
  ...
}
```

#### 4.1.3 Analytics Endpoints
```
GET  /api/v1/organizations/{org_id}/metrics
GET  /api/v1/departments/{dept_id}/adoption
GET  /api/v1/users/{user_id}/performance
POST /api/v1/reports/custom
GET  /api/v1/dashboards/widgets
```

#### 4.1.4 Rate Limiting Configuration
- **Interactive UI**: 10 requests/minute per user
- **Event Ingestion**: 50 events/minute per organization
- **Bulk Export**: 1 request/hour per organization
- **Admin Operations**: 10 requests/minute (bypass during incidents)

### 4.2 WebSocket API (Phoenix Channels)

#### 4.2.1 Channel Topics
```
"dashboard:org_{org_id}"          # Organization-wide updates
"dashboard:dept_{dept_id}"        # Department-specific updates
"dashboard:user_{user_id}"        # User-specific notifications
"alerts:support_{org_id}"         # Support identification alerts
"metrics:realtime_{org_id}"       # Real-time metric streams
```

#### 4.2.2 Message Formats
```elixir
# Real-time metric update
%{
  "event" => "metric_update",
  "data" => %{
    "metric_type" => "adoption_score",
    "user_id" => "uuid",
    "value" => 75.5,
    "timestamp" => "2025-09-29T10:00:00Z"
  }
}

# Support alert
%{
  "event" => "support_alert",
  "data" => %{
    "user_id" => "uuid",
    "trigger" => "low_adoption",
    "score" => 8.2,
    "suggestions" => ["link1", "link2"]
  }
}
```

---

## 5. Security Architecture

### 5.1 Authentication and Authorization

#### 5.1.1 JWT Token Structure
```json
{
  "sub": "user_uuid",
  "org_id": "org_uuid",
  "role": "manager",
  "departments": ["dept1_uuid", "dept2_uuid"],
  "scopes": ["read:analytics", "write:webhooks"],
  "exp": 1695984000,
  "iat": 1695983100
}
```

#### 5.1.2 OAuth Integration Flow
1. User clicks "Login with Google/GitHub/Office365"
2. Redirect to provider with org context
3. Provider callback with authorization code
4. Exchange code for provider token
5. Create/update user in org schema
6. Generate platform JWT with appropriate scopes
7. Return to dashboard with session established

#### 5.1.3 Role-Based Access Control

**Admin Permissions**:
- Full organization management
- All analytics access
- User/department management
- Billing and subscription management

**Manager Permissions**:
- Department analytics access
- Add/remove developers from assigned departments
- View support alerts for their departments

**Developer Permissions**:
- Personal analytics dashboard
- Token management for hooks
- Department-level read-only analytics

### 5.2 Data Security

#### 5.2.1 Schema Isolation
```elixir
# Ecto dynamic schema selection
def get_user(org_id, user_id) do
  schema_name = "org_#{org_id}"

  from(u in {"users", User},
    prefix: ^schema_name
  )
  |> where([u], u.id == ^user_id)
  |> Repo.one()
end
```

#### 5.2.2 Audit Trail Implementation
```sql
CREATE TABLE system.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## 6. Performance Architecture

### 6.1 Caching Strategy

#### 6.1.1 Redis Cache Layers
```elixir
# Dashboard metrics cache (5-minute TTL)
"dashboard:#{org_id}:#{user_id}:metrics" => cached_metrics

# Aggregation cache (1-hour TTL)
"analytics:#{org_id}:#{date}:aggregated" => hourly_aggregations

# User session cache (15-minute TTL)
"session:#{user_id}" => user_session_data
```

#### 6.1.2 ClickHouse Optimization
- **Materialized Views**: Pre-aggregated metrics for common queries
- **Projection**: Column-optimized storage for analytics
- **Partitioning**: By organization and date for query performance
- **Indexing**: Bloom filters on user_id and agent_name

### 6.2 Real-Time Processing

#### 6.2.1 Event Processing Pipeline
```
Event Ingestion → Validation → Real-time Broadcast → Async Aggregation
                     ↓
                Queue for ClickHouse → Batch Insert (1000 events/batch)
```

#### 6.2.2 Adoption Score Calculation
```elixir
def calculate_adoption_score(user_metrics) do
  usage_frequency = user_metrics.daily_usage / dept_avg.daily_usage * 40
  feature_diversity = user_metrics.unique_agents / total_agents * 30
  success_rate = user_metrics.success_rate * 20
  workflow_completion = user_metrics.workflows_completed / target_workflows * 10

  base_score = usage_frequency + feature_diversity + success_rate + workflow_completion
  peer_adjustment = calculate_peer_comparison(user_metrics, dept_metrics)

  min(100, base_score + peer_adjustment)
end
```

---

## 7. Implementation Plan

### Sprint 1: Core Infrastructure (TRD-001 to TRD-015)

#### Database & Schema Setup
- [ ] TRD-001: Set up PostgreSQL with multi-tenant schema architecture (6h)
- [ ] TRD-002: Implement organization and department management tables (4h)
- [ ] TRD-003: Create user management with role-based access control (6h)
- [ ] TRD-004: Set up ClickHouse cluster for analytics data (8h)
- [ ] TRD-005: Design and implement events table with partitioning (6h)

#### Core Phoenix Application
- [ ] TRD-006: Initialize Phoenix project with OTP supervision tree (4h)
- [ ] TRD-007: Configure Ecto for dynamic schema selection (6h)
- [ ] TRD-008: Set up Phoenix Channels for real-time communication (4h)
- [ ] TRD-009: Implement basic LiveView application structure (6h)
- [ ] TRD-010: Create Redis integration for caching and pub/sub (4h)

#### Authentication Foundation
- [ ] TRD-011: Implement JWT authentication with claims structure (6h)
- [ ] TRD-012: Set up OAuth integration (Google, GitHub, Office 365) (8h)
- [ ] TRD-013: Create role-based authorization middleware (4h)
- [ ] TRD-014: Implement audit logging for security compliance (4h)
- [ ] TRD-015: Set up rate limiting for API endpoints (4h)

**Sprint 1 Total**: 80 hours
**Dependencies**: Database setup → Phoenix app → Authentication
**Success Criteria**: Multi-tenant authentication working with basic dashboard

### Sprint 2: Event Processing & Analytics Engine (TRD-016 to TRD-030)

#### Event Ingestion System
- [ ] TRD-016: Create event ingestion API with schema validation (6h)
- [ ] TRD-017: Implement event deduplication and error handling (4h)
- [ ] TRD-018: Set up webhook retry logic with exponential backoff (4h)
- [ ] TRD-019: Create event processing pipeline with queues (6h)
- [ ] TRD-020: Implement batch insertion to ClickHouse (4h)

#### Analytics Processing
- [ ] TRD-021: Create real-time aggregation workers (6h)
- [ ] TRD-022: Implement adoption score calculation algorithm (8h)
- [ ] TRD-023: Set up materialized views for common queries (4h)
- [ ] TRD-024: Create department and organization rollup jobs (6h)
- [ ] TRD-025: Implement performance metrics calculations (4h)

#### Core Analytics Queries
- [ ] TRD-026: Build user performance analytics queries (6h)
- [ ] TRD-027: Create department comparison analytics (4h)
- [ ] TRD-028: Implement agent usage tracking queries (4h)
- [ ] TRD-029: Set up error analysis and tracking (4h)
- [ ] TRD-030: Create ROI calculation engine (6h)

**Sprint 2 Total**: 76 hours
**Dependencies**: Sprint 1 completion → Event system → Analytics engine
**Success Criteria**: Event ingestion working with real-time analytics calculations

### Sprint 3: Dashboard Framework & UI Components (TRD-031 to TRD-045)

#### Dashboard Infrastructure
- [ ] TRD-031: Create 12-column responsive grid system for widgets (6h)
- [ ] TRD-032: Implement drag-and-drop widget positioning (8h)
- [ ] TRD-033: Build widget resize functionality (6h)
- [ ] TRD-034: Create widget configuration and settings system (6h)
- [ ] TRD-035: Implement dashboard layout persistence per user (4h)

#### Core Widgets Development
- [ ] TRD-036: Build User Ranking widget with department comparison (6h)
- [ ] TRD-037: Create Agent Usage tracking widget (6h)
- [ ] TRD-038: Implement Workflow Adoption widget (6h)
- [ ] TRD-039: Build Command Usage analytics widget (4h)
- [ ] TRD-040: Create Error & Failure Trends widget (6h)

#### Real-Time Dashboard Updates
- [ ] TRD-041: Implement Phoenix Channels integration for widgets (6h)
- [ ] TRD-042: Create real-time data streaming for dashboard (4h)
- [ ] TRD-043: Set up widget refresh and update mechanisms (4h)
- [ ] TRD-044: Implement dashboard performance optimization (4h)
- [ ] TRD-045: Create dashboard template system for different roles (4h)

**Sprint 3 Total**: 80 hours
**Dependencies**: Sprint 2 analytics → Dashboard framework → Widget system
**Success Criteria**: Functional customizable dashboards with real-time updates

### Sprint 4: Advanced Analytics & Support System (TRD-046 to TRD-060)

#### Support Identification System
- [ ] TRD-046: Implement support trigger detection algorithms (8h)
- [ ] TRD-047: Create automated user flagging system (6h)
- [ ] TRD-048: Build intervention recommendation engine (6h)
- [ ] TRD-049: Implement notification system for support alerts (4h)
- [ ] TRD-050: Create intervention tracking and effectiveness metrics (6h)

#### Advanced Analytics Widgets
- [ ] TRD-051: Build Intervention Alerts widget for managers (6h)
- [ ] TRD-052: Create Adoption Heatmap visualization (8h)
- [ ] TRD-053: Implement ROI/Value Metrics widget (6h)
- [ ] TRD-054: Build Knowledge Sharing tracking widget (4h)
- [ ] TRD-055: Create Learning Path recommendations widget (6h)

#### Reporting System
- [ ] TRD-056: Implement standard report generation (6h)
- [ ] TRD-057: Create weekly/monthly support reports (4h)
- [ ] TRD-058: Build trend analysis reporting (6h)
- [ ] TRD-059: Implement data export functionality (CSV, JSON, PDF) (4h)
- [ ] TRD-060: Create report scheduling and delivery system (6h)

**Sprint 4 Total**: 82 hours
**Dependencies**: Sprint 3 widgets → Support system → Advanced reporting
**Success Criteria**: Complete support identification with automated interventions

### Sprint 5: Token Management & Integration (TRD-061 to TRD-075)

#### Hook Token System
- [ ] TRD-061: Create secure token generation and storage system (6h)
- [ ] TRD-062: Implement token-based authentication for hooks (4h)
- [ ] TRD-063: Build Token Management widget for user dashboard (6h)
- [ ] TRD-064: Create token audit trail and activity logging (4h)
- [ ] TRD-065: Implement token revocation and regeneration (4h)

#### Webhook Management
- [ ] TRD-066: Create webhook configuration API (6h)
- [ ] TRD-067: Implement webhook delivery system with retries (6h)
- [ ] TRD-068: Build webhook testing and validation tools (4h)
- [ ] TRD-069: Create webhook management UI (6h)
- [ ] TRD-070: Implement webhook analytics and monitoring (4h)

#### External Integrations
- [ ] TRD-071: Build integration with external systems API framework (6h)
- [ ] TRD-072: Create data import/export APIs (6h)
- [ ] TRD-073: Implement scheduled data synchronization (4h)
- [ ] TRD-074: Build integration health monitoring (4h)
- [ ] TRD-075: Create integration documentation and testing tools (4h)

**Sprint 5 Total**: 74 hours
**Dependencies**: Sprint 4 reporting → Token system → Webhook infrastructure
**Success Criteria**: Complete integration capabilities with secure token management

### Sprint 6: A/B Testing & Advanced Features (TRD-076 to TRD-090)

#### A/B Testing Framework
- [ ] TRD-076: Design A/B testing infrastructure and data model (8h)
- [ ] TRD-077: Implement experiment configuration and management (6h)
- [ ] TRD-078: Create statistical significance calculation engine (6h)
- [ ] TRD-079: Build A/B test results widget (6h)
- [ ] TRD-080: Implement automated winner determination (4h)

#### Knowledge Management System
- [ ] TRD-081: Create knowledge artifact tracking system (6h)
- [ ] TRD-082: Implement knowledge graph relationships (8h)
- [ ] TRD-083: Build expertise identification algorithms (6h)
- [ ] TRD-084: Create knowledge flow analytics (6h)
- [ ] TRD-085: Implement knowledge sharing recommendations (4h)

#### Performance Optimization
- [ ] TRD-086: Implement query optimization and caching strategies (6h)
- [ ] TRD-087: Create performance monitoring and alerting (4h)
- [ ] TRD-088: Build auto-scaling configuration (6h)
- [ ] TRD-089: Implement data archival and retention policies (6h)
- [ ] TRD-090: Create system health dashboard for administrators (4h)

**Sprint 6 Total**: 76 hours
**Dependencies**: Sprint 5 integrations → A/B testing → Knowledge management
**Success Criteria**: Production-ready platform with advanced analytics capabilities

---

## 8. Quality Gates & Testing Strategy

### 8.1 Testing Framework

#### 8.1.1 Unit Testing (>80% Coverage)
```elixir
# Example test structure
defmodule AnalyticsPlatform.AdoptionScoreTest do
  use ExUnit.Case

  test "calculates adoption score correctly" do
    user_metrics = %{daily_usage: 50, unique_agents: 8, success_rate: 0.95}
    dept_metrics = %{avg_daily_usage: 40, total_agents: 10}

    score = AdoptionScore.calculate(user_metrics, dept_metrics)
    assert score >= 70 and score <= 100
  end
end
```

#### 8.1.2 Integration Testing
- Database schema validation across all tenant schemas
- Phoenix Channels real-time communication testing
- ClickHouse analytics query performance validation
- OAuth provider integration testing

#### 8.1.3 Performance Testing
- Load testing: 10,000 events/second sustained throughput
- Dashboard loading: <1 second SLA validation
- Concurrent user testing: Tier-based limits verification
- WebSocket connection scaling: 10,000+ concurrent connections

### 8.2 Security Testing

#### 8.2.1 Security Validation
- Schema isolation verification (no cross-tenant data access)
- JWT token validation and expiry testing
- Rate limiting enforcement testing
- OAuth provider security flow validation

#### 8.2.2 Compliance Testing
- GDPR data handling compliance
- SOC 2 security controls validation
- Audit trail completeness verification
- Data retention policy enforcement

---

## 9. Deployment & Infrastructure

### 9.1 Container Architecture

#### 9.1.1 Docker Configuration
```dockerfile
# Phoenix Application Container
FROM elixir:1.15-alpine
RUN apk add --no-cache build-base npm git
WORKDIR /app
COPY mix.exs mix.lock ./
RUN mix deps.get --only prod
COPY . .
RUN mix compile
RUN mix assets.deploy
RUN mix release
EXPOSE 4000
CMD ["_build/prod/rel/analytics_platform/bin/analytics_platform", "start"]
```

#### 9.1.2 Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: analytics-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: analytics-platform
  template:
    spec:
      containers:
      - name: phoenix-app
        image: analytics-platform:latest
        ports:
        - containerPort: 4000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
```

### 9.2 Infrastructure as Code

#### 9.2.1 Terraform Configuration
```hcl
# PostgreSQL Cluster
resource "aws_rds_cluster" "main" {
  cluster_identifier = "analytics-platform-postgres"
  engine            = "aurora-postgresql"
  engine_version    = "14.9"
  database_name     = "analytics_platform"
  master_username   = var.db_username
  master_password   = var.db_password

  backup_retention_period = 7
  preferred_backup_window = "07:00-09:00"

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
}

# ClickHouse Cluster
resource "aws_instance" "clickhouse" {
  count         = 3
  ami           = var.clickhouse_ami
  instance_type = "r5.2xlarge"

  vpc_security_group_ids = [aws_security_group.clickhouse.id]
  subnet_id             = aws_subnet.private[count.index].id

  user_data = templatefile("clickhouse-setup.sh", {
    cluster_name = "analytics-cluster"
    shard_id     = count.index + 1
  })
}
```

---

## 10. Monitoring & Observability

### 10.1 Application Monitoring

#### 10.1.1 Phoenix Telemetry
```elixir
defmodule AnalyticsPlatform.Telemetry do
  use Supervisor

  def start_link(arg) do
    Supervisor.start_link(__MODULE__, arg, name: __MODULE__)
  end

  def init(_arg) do
    children = [
      {:telemetry_poller, measurements: periodic_measurements(), period: 10_000},
      {TelemetryMetricsPrometheus, metrics: metrics()}
    ]

    Supervisor.init(children, strategy: :one_for_one)
  end

  defp metrics do
    [
      # Phoenix Metrics
      summary("phoenix.endpoint.stop.duration"),
      counter("phoenix.endpoint.stop.count"),

      # Database Metrics
      summary("analytics_platform.repo.query.total_time"),
      counter("analytics_platform.repo.query.count"),

      # Business Metrics
      counter("analytics_platform.events.ingested.count"),
      summary("analytics_platform.adoption_score.calculation.duration")
    ]
  end
end
```

#### 10.1.2 Alert Configuration
```yaml
# Prometheus AlertManager rules
groups:
  - name: analytics_platform
    rules:
    - alert: DashboardLoadTimeSLA
      expr: phoenix_endpoint_stop_duration_seconds{quantile="0.95"} > 1
      for: 2m
      labels:
        severity: warning
      annotations:
        summary: "Dashboard load time exceeding 1 second SLA"

    - alert: EventIngestionRate
      expr: rate(analytics_platform_events_ingested_count[5m]) < 100
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Event ingestion rate below expected threshold"
```

### 10.2 Business Intelligence Monitoring

#### 10.2.1 KPI Dashboards
- **User Adoption Metrics**: Real-time adoption score distributions
- **System Performance**: Query response times, event processing rates
- **Support Effectiveness**: Intervention success rates, user progression
- **Resource Utilization**: Database performance, WebSocket connections

---

## 11. Success Criteria & Acceptance Testing

### 11.1 Functional Acceptance Criteria

- [ ] **Multi-tenant isolation**: No cross-tenant data access in any scenario
- [ ] **Real-time updates**: Dashboard updates within 500ms of events
- [ ] **Support identification**: Automatic flagging based on adoption criteria
- [ ] **Performance SLAs**: All dashboard types load within 1 second
- [ ] **Scalability**: Support 10,000+ users per organization
- [ ] **Security compliance**: JWT + OAuth + RBAC fully implemented

### 11.2 Technical Acceptance Criteria

- [ ] **Event throughput**: Sustained 10,000 events/second processing
- [ ] **Query performance**: Analytics queries complete within SLA times
- [ ] **High availability**: 99.9% uptime with automatic failover
- [ ] **Data integrity**: Zero data loss during normal operations
- [ ] **Audit compliance**: Complete audit trails for all sensitive operations

### 11.3 Business Acceptance Criteria

- [ ] **Adoption scoring**: Algorithm identifies users needing support accurately
- [ ] **ROI calculation**: Time savings and error prevention properly quantified
- [ ] **Dashboard customization**: Users can configure layouts within 60 minutes
- [ ] **Onboarding flow**: 90%+ completion rate for 5-step wizard
- [ ] **Integration success**: Hook authentication and webhook delivery functional

---

## 12. Risk Assessment & Mitigation

### 12.1 Technical Risks

**High Risk: ClickHouse Performance at Scale**
- *Impact*: Query response times could exceed SLAs under load
- *Mitigation*: Implement materialized views, optimize partitioning strategy, add read replicas

**Medium Risk: WebSocket Connection Limits**
- *Impact*: Real-time updates may fail for large organizations
- *Mitigation*: Implement connection pooling, fallback to polling, horizontal scaling

**Medium Risk: Schema Migration Complexity**
- *Impact*: Multi-tenant schema updates could cause downtime
- *Mitigation*: Blue-green deployment strategy, automated rollback procedures

### 12.2 Business Risks

**Medium Risk: Adoption Score Algorithm Accuracy**
- *Impact*: Incorrect support identification could frustrate users
- *Mitigation*: A/B testing for algorithm parameters, user feedback loop

**Low Risk: OAuth Provider Availability**
- *Impact*: Authentication failures if providers have outages
- *Mitigation*: Multiple provider support, graceful degradation to email/password

---

## 13. Timeline & Resource Allocation

### 13.1 Development Schedule

**Total Implementation Time**: 6 sprints × 2 weeks = 12 weeks
**Total Development Hours**: 468 hours
**Team Composition**: 2 senior Elixir developers, 1 DevOps engineer, 1 QA engineer

### 13.2 Sprint Breakdown

| Sprint | Focus | Hours | Key Deliverables |
|--------|-------|-------|------------------|
| 1 | Core Infrastructure | 80h | Multi-tenant auth, basic dashboard |
| 2 | Analytics Engine | 76h | Event processing, adoption scoring |
| 3 | Dashboard Framework | 80h | Widget system, real-time updates |
| 4 | Support System | 82h | Intervention alerts, reporting |
| 5 | Integration Layer | 74h | Token management, webhooks |
| 6 | Advanced Features | 76h | A/B testing, knowledge management |

### 13.3 Resource Requirements

**Development Team**:
- 2 × Senior Elixir/Phoenix Developers (full-time)
- 1 × DevOps Engineer (50% allocation)
- 1 × QA Engineer (full-time)
- 1 × Technical Lead/Architect (25% allocation)

**Infrastructure**:
- PostgreSQL Aurora cluster (multi-AZ)
- ClickHouse cluster (3 nodes, r5.2xlarge)
- Redis cluster (elasticache)
- Kubernetes cluster (3 worker nodes)
- Load balancers and monitoring infrastructure

---

**Document Status**: Ready for implementation approval and resource allocation
**Next Steps**: Review with development team, finalize sprint planning, begin Sprint 1 tasks
**Implementation Command**: Use `/implement-trd` to begin task execution with approval workflows