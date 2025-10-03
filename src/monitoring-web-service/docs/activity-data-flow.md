# Activity Data Flow Architecture

This document describes how activity data flows through the monitoring web service system, from Claude Code usage to real-time frontend updates.

## System Overview

The activity tracking system captures user interactions with Claude Code and displays them in real-time through a web interface. The flow involves hooks, APIs, database storage, and WebSocket broadcasting.

## Activity Data Flow Diagram

```mermaid
graph TD
    %% Source: Claude Code Usage
    A[Claude Code Session] -->|User executes commands/tools| B[Hooks System]

    %% Hooks Processing
    B -->|Pre-execution| C[Pre Hook]
    B -->|Post-execution| D[Post Hook]
    C -->|Generates activity data| E[Metrics API Client]
    D -->|Generates activity data| E

    %% API Client & Authentication
    E -->|HTTP POST with auth token| F[Activities API Endpoint<br>/api/v1/activities]
    E -->|Gets token from profile| G[User Profile<br>~/.ai-mesh/profile/user.json]
    G -.->|Provides auth token| E

    %% API Processing
    F -->|1. Validate request| H[Development Auth Middleware]
    H -->|Creates mock user context| I[User Validation]
    I -->|2. Ensure user exists| J[ensureUserExists Function]
    J -->|Creates user if needed| K[(PostgreSQL Database<br>fortium_schema.user)]

    %% Database Operations
    I -->|3. Write activity| L[(PostgreSQL Database<br>fortium_schema.activity_data)]
    L -->|Returns created activity| M[Transform to Response Format]

    %% WebSocket Broadcasting
    M -->|4. Broadcast to WebSocket| N[WebSocket Manager]
    N -->|broadcastActivityEvent| O[WebSocket Service]
    O -->|Sends 'activity_created' event| P[Connected WebSocket Clients]

    %% Frontend Integration
    P -->|Real-time event| Q[Frontend WebSocket Hook<br>useActivityStream]
    Q -->|Updates state| R[Real-time Activity Feed Widget]
    L -->|Also available via| S[GET /api/v1/activities]
    S -->|HTTP polling fallback| R

    %% Response Flow
    M -->|5. Return success| T[HTTP 201 Response]
    T -->|Success confirmation| E
    E -->|Hook completes| B

    %% Error Handling
    F -.->|If user creation fails| U[HTTP 400 Error]
    F -.->|If DB write fails| V[HTTP 500 Error]
    N -.->|If WebSocket fails| W[Log warning but continue]

    %% Styling
    classDef database fill:#e1f5fe
    classDef api fill:#f3e5f5
    classDef websocket fill:#e8f5e8
    classDef frontend fill:#fff3e0
    classDef hooks fill:#fce4ec

    class K,L database
    class F,H,I,J,M,S api
    class N,O,P websocket
    class Q,R frontend
    class A,B,C,D,E,G hooks
```

## Detailed Flow Description

### 1. Data Generation (Hooks System)
- **Source**: Claude Code user executes commands/tools
- **Pre Hook**: Captures command start events (`hooks/tool-metrics.js`)
- **Post Hook**: Captures command completion events with duration
- **Metrics API Client**: Sends HTTP POST to `/api/v1/activities` with authentication

### 2. API Processing (activities.routes.ts)
- **Authentication**: Development middleware creates mock user context
- **User Validation**: `ensureUserExists()` function ensures demo user exists in database
- **Database Write**: Activity data saved to `fortium_schema.activity_data` table
- **Response Transform**: Database record converted to standardized API response format

### 3. Real-time Broadcasting (WebSocket Integration)
- **WebSocket Manager**: Retrieved from Express app context (`req.app.wsManager`)
- **Broadcast Event**: Calls `broadcastActivityEvent('1', {type: 'activity_created', activity})`
- **WebSocket Service**: Distributes real-time events to connected clients
- **Error Handling**: WebSocket failures are logged but don't affect API response

### 4. Frontend Integration
- **WebSocket Hook**: `useActivityStream` receives real-time events via WebSocket
- **Activity Widget**: Updates immediately when new activities are broadcast
- **HTTP Fallback**: Can poll `GET /api/v1/activities` for data if WebSocket unavailable

## Key Components

### Database Schema
```sql
-- fortium_schema.user table
CREATE TABLE user (
    id UUID PRIMARY KEY,
    email VARCHAR NOT NULL,
    firstName VARCHAR,
    lastName VARCHAR,
    role VARCHAR,
    tenantId VARCHAR,
    isActive BOOLEAN,
    createdAt TIMESTAMP,
    updatedAt TIMESTAMP
);

-- fortium_schema.activity_data table
CREATE TABLE activity_data (
    id UUID PRIMARY KEY,
    actionName VARCHAR NOT NULL,
    actionDescription VARCHAR,
    targetName VARCHAR NOT NULL,
    status VARCHAR,
    duration INTEGER,
    isAutomated BOOLEAN,
    priority INTEGER,
    timestamp TIMESTAMP,
    userId UUID REFERENCES user(id)
);
```

### API Endpoints
- **POST /api/v1/activities**: Create new activity
- **POST /api/v1/activities/test**: Create test activity for WebSocket testing
- **GET /api/v1/activities**: Retrieve activities with pagination and filtering
- **GET /api/v1/activities/summary**: Get activity statistics

### WebSocket Events
- **activity_created**: Broadcast when new activity is created
- **Connection Path**: `/ws`
- **Authentication**: JWT token-based (development mode uses mock auth)

## Authentication Flow

### Development Mode
```javascript
// Development auth middleware creates mock user
req.user = {
    userId: '8985da03-bd7f-4316-9316-afd59d319c13',
    tenantId: 'a1b2c3d4-e5f6-4789-a012-345678901234',
    email: 'demo@fortium.com',
    role: 'admin',
    permissions: ['read', 'write', 'admin']
};
```

### User Profile System
- **Location**: `~/.ai-mesh/profile/user.json`
- **Purpose**: Stores user identity and authentication token for hooks
- **Auto-creation**: Development user created automatically if missing from database

## Error Handling

### Database Errors
- **Foreign Key Constraints**: Returns HTTP 400 with specific error message
- **Connection Issues**: Returns HTTP 500 with generic error message
- **User Creation Failures**: Returns HTTP 400 before attempting activity creation

### WebSocket Errors
- **Connection Failures**: Logged as warnings, don't affect API response
- **Broadcast Failures**: Activity still saved to database, WebSocket notification skipped

### Resilience Features
- **Graceful Degradation**: System works without WebSocket connectivity
- **Automatic User Creation**: Missing users created automatically in development
- **Comprehensive Logging**: All errors logged with context for debugging

## Performance Characteristics

### Response Times (Typical)
- **Database Write**: 10-50ms
- **WebSocket Broadcast**: 1-5ms
- **Total API Response**: 50-100ms

### Scalability Considerations
- **Database Connection Pooling**: Configured for optimal performance
- **WebSocket Connection Limits**: Max 1000 concurrent connections
- **Tenant Isolation**: Multi-tenant architecture with schema-based separation

## Configuration

### Environment Variables
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/metrics_development"

# Server
PORT=3001
NODE_ENV=development

# WebSocket
CORS_ORIGIN=http://localhost:3001,http://localhost:3000

# Metrics API (for hooks)
METRICS_API_URL=http://localhost:3001/api/v1
```

### Key Files
- **Activities Routes**: `src/routes/activities.routes.ts`
- **WebSocket Service**: `src/services/websocket.service.ts`
- **Hooks Client**: `hooks/metrics-api-client.js`
- **Frontend Hook**: `frontend/src/hooks/useActivityStream.ts`
- **App Integration**: `src/app.ts` (WebSocket manager attachment)

## Monitoring and Debugging

### Logging
- **Activity Creation**: Logged with activity ID and user context
- **WebSocket Events**: Broadcast success/failure logged
- **Database Operations**: Errors logged with stack traces
- **Performance Metrics**: OpenTelemetry integration for detailed tracing

### Debug Endpoints
- **GET /api/v1/activities/summary**: Activity statistics
- **POST /api/v1/activities/test**: WebSocket testing endpoint

This architecture ensures reliable activity tracking with real-time updates while maintaining data consistency and providing comprehensive error handling.