COMMAND: /generate-api-docs
DESCRIPTION: Generate comprehensive OpenAPI/Swagger API documentation from codebase
VERSION: 1.0.0

PURPOSE:
Generate comprehensive API documentation from codebase analysis, including OpenAPI/Swagger
specifications, endpoint descriptions, request/response examples, and error documentation.

WORKFLOW:

Phase 1: API Discovery
  1. Endpoint Scanning: Scan codebase for API endpoints
  2. Schema Extraction: Extract request/response schemas

Phase 2: Documentation Generation
  1. OpenAPI Generation: Generate OpenAPI 3.0 specification
     Delegates to: api-documentation-specialist
  2. Example Creation: Create request/response examples

EXPECTED OUTPUT:
Format: OpenAPI 3.0 Specification
Structure:
- openapi.yaml: Complete OpenAPI specification
- API Documentation: Human-readable API documentation
