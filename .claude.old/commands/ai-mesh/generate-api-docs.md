# @ai-mesh-command
# Command: generate-api-docs
# Version: 1.0.0
# Category: documentation
# Source: fortium
# Maintainer: Fortium Software Configuration Team
# Last Updated: 2025-10-13

---
name: generate-api-docs
description: Generate comprehensive OpenAPI/Swagger API documentation from codebase
version: 1.0.0
category: documentation
---

## Mission

Generate comprehensive API documentation from codebase analysis, including OpenAPI/Swagger
specifications, endpoint descriptions, request/response examples, and error documentation.



## Workflow

### Phase 1: API Discovery

1. **Endpoint Scanning**: Scan codebase for API endpoints
2. **Schema Extraction**: Extract request/response schemas

### Phase 2: Documentation Generation

1. **OpenAPI Generation**: Generate OpenAPI 3.0 specification
   - **Delegates to**: api-documentation-specialist
   - **Context**: Discovered endpoints and schemas
2. **Example Creation**: Create request/response examples


## Expected Output

**Format**: OpenAPI 3.0 Specification

**Structure**:
- **openapi.yaml**: Complete OpenAPI specification
- **API Documentation**: Human-readable API documentation
