# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-03-external-metrics-service-#8/spec.md

> Created: 2025-09-03
> Version: 1.0.0

## API Architecture Overview

The External Metrics Web Service provides three primary API surfaces:
1. **REST API** - Standard HTTP endpoints for dashboard data, user management, and configuration
2. **WebSocket API** - Real-time updates for live dashboards and notifications
3. **MCP Server Interface** - Integration with existing Claude Code ecosystem for metrics collection

All APIs use JWT-based authentication with organization-scoped access control and comprehensive rate limiting.

## Authentication & Authorization

### JWT Token Structure
```json
{
  "sub": "user-uuid",
  "org": "organization-uuid",
  "role": "admin|manager|developer",
  "exp": 1693564800,
  "iat": 1693478400
}
```

### Authentication Flow
- **SSO Integration**: OAuth2/OIDC with enterprise identity providers
- **Token Refresh**: Automatic refresh with sliding window expiration
- **Organization Context**: All API calls scoped to authenticated user's organization

## REST API Endpoints

### Authentication Endpoints

#### POST /api/auth/login
**Purpose:** Authenticate user and obtain JWT tokens
**Parameters:** 
- `email`: User email address
- `password`: User password (for local auth)
- `sso_token`: SSO provider token (for enterprise auth)
**Response:** JWT access token and refresh token
**Errors:** 401 Unauthorized, 400 Bad Request

#### POST /api/auth/refresh
**Purpose:** Refresh expired JWT tokens
**Parameters:** `refresh_token`: Valid refresh token
**Response:** New JWT access token
**Errors:** 401 Unauthorized, 400 Bad Request

#### POST /api/auth/logout
**Purpose:** Invalidate user session and tokens
**Parameters:** None (uses Authorization header)
**Response:** 204 No Content
**Errors:** 401 Unauthorized

### User Management Endpoints

#### GET /api/users
**Purpose:** Retrieve organization users with role filtering
**Parameters:** 
- `role`: Filter by user role (optional)
- `team_id`: Filter by team membership (optional)
- `page`: Pagination page number
- `limit`: Results per page (max 100)
**Response:** Paginated list of user objects
**Errors:** 403 Forbidden, 400 Bad Request

#### POST /api/users
**Purpose:** Create new organization user (admin only)
**Parameters:** User object with email, name, role
**Response:** Created user object with generated UUID
**Errors:** 403 Forbidden, 409 Conflict, 400 Bad Request

#### PUT /api/users/:userId
**Purpose:** Update user profile and settings
**Parameters:** Updated user object fields
**Response:** Updated user object
**Errors:** 404 Not Found, 403 Forbidden, 400 Bad Request

### Team Management Endpoints

#### GET /api/teams
**Purpose:** Retrieve organization teams and memberships
**Parameters:** 
- `include_members`: Include team member details (optional)
- `page`: Pagination page number
**Response:** List of team objects with optional member details
**Errors:** 403 Forbidden

#### POST /api/teams
**Purpose:** Create new team (admin/manager only)
**Parameters:** Team object with name, description
**Response:** Created team object with generated UUID
**Errors:** 403 Forbidden, 409 Conflict, 400 Bad Request

#### POST /api/teams/:teamId/members
**Purpose:** Add user to team
**Parameters:** 
- `user_id`: UUID of user to add
- `role`: Team role (lead|member)
**Response:** Team membership object
**Errors:** 404 Not Found, 403 Forbidden, 409 Conflict

### Metrics Data Endpoints

#### GET /api/metrics/productivity
**Purpose:** Retrieve productivity metrics with filtering and aggregation
**Parameters:** 
- `user_id`: Filter by specific user (optional)
- `team_id`: Filter by team (optional)
- `metric_type`: Filter by metric type (optional)
- `start_date`: Start of date range (ISO 8601)
- `end_date`: End of date range (ISO 8601)
- `aggregation`: Time aggregation (hour|day|week|month)
- `page`: Pagination page number
**Response:** Time-series metrics data with aggregation
**Errors:** 400 Bad Request, 403 Forbidden

#### POST /api/metrics/productivity
**Purpose:** Ingest new productivity metrics (MCP server use)
**Parameters:** Array of metric objects with timestamp, type, value, metadata
**Response:** 201 Created with ingestion summary
**Errors:** 400 Bad Request, 413 Payload Too Large, 429 Too Many Requests

#### GET /api/metrics/agents
**Purpose:** Retrieve agent usage metrics and performance data
**Parameters:** 
- `agent_name`: Filter by specific agent (optional)
- `user_id`: Filter by user (optional)
- `success_only`: Filter successful executions only (optional)
- `start_date`: Start of date range (ISO 8601)
- `end_date`: End of date range (ISO 8601)
**Response:** Agent usage statistics and performance metrics
**Errors:** 400 Bad Request, 403 Forbidden

#### POST /api/metrics/agents
**Purpose:** Ingest agent usage data from MCP servers
**Parameters:** Array of agent execution objects
**Response:** 201 Created with ingestion confirmation
**Errors:** 400 Bad Request, 429 Too Many Requests

### Dashboard Configuration Endpoints

#### GET /api/dashboards
**Purpose:** Retrieve user's dashboard configurations
**Parameters:** 
- `scope`: Filter by scope (user|team|organization)
- `default_only`: Retrieve only default configurations
**Response:** List of dashboard configuration objects
**Errors:** 403 Forbidden

#### POST /api/dashboards
**Purpose:** Create new dashboard configuration
**Parameters:** Dashboard object with name, layout, filters
**Response:** Created dashboard configuration
**Errors:** 400 Bad Request, 403 Forbidden

#### PUT /api/dashboards/:dashboardId
**Purpose:** Update existing dashboard configuration
**Parameters:** Updated dashboard object
**Response:** Updated dashboard configuration
**Errors:** 404 Not Found, 403 Forbidden, 400 Bad Request

#### DELETE /api/dashboards/:dashboardId
**Purpose:** Delete dashboard configuration
**Parameters:** None
**Response:** 204 No Content
**Errors:** 404 Not Found, 403 Forbidden

### Analytics and Reporting Endpoints

#### GET /api/analytics/productivity-trends
**Purpose:** Generate productivity trend analysis across date ranges
**Parameters:** 
- `team_id`: Analyze specific team (optional)
- `comparison_period`: Previous period for comparison (optional)
- `start_date`: Analysis start date
- `end_date`: Analysis end date
**Response:** Trend analysis with growth rates and insights
**Errors:** 400 Bad Request, 403 Forbidden

#### GET /api/analytics/team-comparison
**Purpose:** Compare productivity metrics across teams
**Parameters:** 
- `team_ids`: Array of team UUIDs to compare
- `metric_types`: Array of metrics to include
- `date_range`: Time period for comparison
**Response:** Comparative analytics with team rankings
**Errors:** 400 Bad Request, 403 Forbidden

#### POST /api/reports/export
**Purpose:** Generate and export productivity reports
**Parameters:** 
- `format`: Export format (pdf|csv|xlsx)
- `report_type`: Type of report (productivity|agents|teams)
- `filters`: Report filtering criteria
**Response:** Export job identifier and status URL
**Errors:** 400 Bad Request, 403 Forbidden

## WebSocket API for Real-Time Updates

### Connection Endpoint
- **URL:** `wss://api.metrics.fortium.com/ws`
- **Authentication:** JWT token via query parameter or headers
- **Protocol:** Socket.io with fallback to long polling

### Event Types

#### dashboard_update
**Purpose:** Live dashboard data updates
**Payload:** 
```json
{
  "dashboard_id": "uuid",
  "widget_id": "string",
  "data": "object",
  "timestamp": "ISO 8601"
}
```

#### metric_ingested
**Purpose:** Notification of new metrics data
**Payload:**
```json
{
  "metric_type": "string",
  "user_id": "uuid",
  "team_id": "uuid",
  "count": "number",
  "timestamp": "ISO 8601"
}
```

#### alert_triggered
**Purpose:** Real-time alerts for productivity anomalies
**Payload:**
```json
{
  "alert_id": "uuid",
  "rule_name": "string",
  "severity": "low|medium|high|critical",
  "metric_value": "number",
  "threshold": "number",
  "affected_users": ["uuid"],
  "timestamp": "ISO 8601"
}
```

### Client Subscription
```javascript
socket.emit('subscribe', {
  rooms: ['dashboard:uuid', 'team:uuid', 'alerts'],
  user_id: 'current-user-uuid'
});
```

## MCP Server Integration Interface

The service provides a specialized MCP server interface that maintains backward compatibility with existing Claude Code configurations while enabling centralized metrics collection.

### MCP Server Endpoints

#### POST /mcp/metrics/collect
**Purpose:** Primary endpoint for MCP server metrics ingestion
**Authentication:** MCP server API key with organization scope
**Parameters:**
```json
{
  "session_id": "string",
  "user_identifier": "string", 
  "agent_name": "string",
  "command": "string",
  "execution_time_ms": "number",
  "success": "boolean",
  "error_details": "string|null",
  "metadata": "object",
  "timestamp": "ISO 8601"
}
```
**Response:** Ingestion acknowledgment with batch ID
**Rate Limiting:** 10,000 requests per minute per organization

#### GET /mcp/config/:organizationId
**Purpose:** Retrieve MCP server configuration for organization
**Parameters:** Organization UUID in path
**Response:** MCP server configuration including endpoints, auth tokens, and collection settings
**Errors:** 404 Not Found, 403 Forbidden

#### POST /mcp/hooks/register
**Purpose:** Register webhooks for Claude Code integration
**Parameters:**
```json
{
  "hook_url": "https://webhook.endpoint",
  "events": ["metrics.collected", "alert.triggered"],
  "organization_id": "uuid",
  "secret": "webhook-secret"
}
```
**Response:** Webhook registration confirmation with ID
**Errors:** 400 Bad Request, 403 Forbidden

### Webhook Payload Examples

#### Metrics Collection Hook
```json
{
  "event": "metrics.collected",
  "organization_id": "uuid",
  "batch_id": "string",
  "metric_count": "number",
  "timestamp": "ISO 8601",
  "signature": "HMAC-SHA256-signature"
}
```

#### Alert Triggered Hook  
```json
{
  "event": "alert.triggered",
  "organization_id": "uuid",
  "alert": {
    "id": "uuid",
    "name": "string",
    "severity": "string",
    "metric_value": "number",
    "threshold": "number"
  },
  "timestamp": "ISO 8601",
  "signature": "HMAC-SHA256-signature"
}
```

## Error Handling and Status Codes

### Standard HTTP Status Codes
- **200 OK**: Successful request with response body
- **201 Created**: Successful resource creation
- **204 No Content**: Successful request without response body
- **400 Bad Request**: Invalid request parameters or payload
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions for requested action
- **404 Not Found**: Requested resource does not exist
- **409 Conflict**: Resource conflict (e.g., duplicate email)
- **413 Payload Too Large**: Request payload exceeds size limits
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Unexpected server error

### Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error description",
    "details": {
      "field": "Specific field validation error"
    },
    "timestamp": "ISO 8601",
    "request_id": "unique-request-identifier"
  }
}
```

## Rate Limiting

### API Rate Limits
- **Dashboard APIs**: 1,000 requests per hour per user
- **Metrics Ingestion**: 10,000 requests per hour per organization
- **Export APIs**: 10 requests per hour per user
- **WebSocket Connections**: 5 concurrent connections per user

### Rate Limit Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1693564800
X-RateLimit-Retry-After: 3600
```

All API endpoints include comprehensive OpenAPI documentation with request/response schemas, authentication requirements, and example usage.