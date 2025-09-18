---
name: generate-api-docs
description: Generate comprehensive OpenAPI 3.0 specifications for all web APIs in the project
parameters:
  - name: framework
    type: string
    description: Web framework to analyze (express, nestjs, fastapi, flask, rails, auto-detect)
    required: false
    default: "auto-detect"
  - name: output_dir
    type: string
    description: Directory to store generated API specifications
    required: false
    default: "docs/api"
  - name: include_examples
    type: boolean
    description: Generate request/response examples
    required: false
    default: true
  - name: validate_specs
    type: boolean
    description: Validate generated OpenAPI specifications
    required: false
    default: true
  - name: update_existing
    type: boolean
    description: Update existing API specifications instead of overwriting
    required: false
    default: false
---

# Generate API Documentation

This command invokes the `api-documentation-specialist` agent to automatically generate comprehensive OpenAPI 3.0 specifications for all web APIs in your project.

## What it does

1. **Scans your codebase** to identify API endpoints, controllers, and routes
2. **Analyzes framework-specific patterns** (Express.js, NestJS, FastAPI, Flask, Rails, etc.)
3. **Extracts schemas** from TypeScript interfaces, Python type hints, or database models
4. **Generates OpenAPI 3.0 specs** with complete endpoint documentation
5. **Creates examples** for all request/response combinations
6. **Validates specifications** to ensure compliance with OpenAPI standards
7. **Organizes documentation** in the `docs/api/` directory structure

## Usage Examples

### Basic usage (auto-detect framework)
```bash
/generate-api-docs
```

### Specify framework explicitly
```bash
/generate-api-docs framework="nestjs"
```

### Generate without examples
```bash
/generate-api-docs include_examples=false
```

### Update existing documentation
```bash
/generate-api-docs update_existing=true
```

### Custom output directory
```bash
/generate-api-docs output_dir="custom/docs/api"
```

## Generated Structure

```
docs/api/
├── README.md                    # API documentation overview
├── specs/                       # OpenAPI specification files
│   ├── users-api.yaml          # User management API
│   ├── products-api.yaml       # Product management API
│   └── orders-api.yaml         # Order processing API
├── examples/                    # Request/response examples
│   ├── users/
│   │   ├── get-user-request.json
│   │   └── get-user-response.json
│   └── products/
└── schemas/                     # Shared schema definitions
    ├── common-types.yaml
    ├── error-responses.yaml
    └── pagination.yaml
```

## Framework Support

### Supported Frameworks
- **Express.js** - Detects `app.get()`, `app.post()`, etc.
- **NestJS** - Analyzes decorators like `@Get()`, `@Post()`
- **FastAPI** - Extracts from route decorators and Pydantic models
- **Flask** - Detects `@app.route()` decorators
- **Ruby on Rails** - Analyzes Rails routes and controllers
- **Spring Boot** - Detects `@RequestMapping` annotations

### Auto-Detection
The agent automatically detects your framework by analyzing:
- Package.json dependencies
- Import statements
- File extensions and naming patterns
- Route definition patterns

## Quality Standards

### Generated Documentation Includes
- ✅ Complete endpoint coverage (100%)
- ✅ Request/response schemas with proper types
- ✅ Authentication and security requirements
- ✅ Parameter validation rules and constraints
- ✅ Error response definitions
- ✅ Realistic request/response examples
- ✅ Pagination support where applicable
- ✅ HATEOAS links for resource navigation

### Validation Checks
- OpenAPI 3.0 specification compliance
- Schema reference resolution
- Example validity against schemas
- Required field validation
- Security scheme configuration

## Integration with Development Workflow

### Pre-commit Hooks
Set up automatic API documentation generation on commits:

```bash
# In package.json
{
  "scripts": {
    "pre-commit": "generate-api-docs validate_specs=true"
  }
}
```

### CI/CD Integration
```yaml
# In .github/workflows/ci.yml
- name: Generate API Docs
  run: generate-api-docs
- name: Validate API Specs
  run: npx @apidevtools/swagger-parser validate docs/api/specs/*.yaml
```

### Development Server
```bash
# Start documentation server
npx swagger-ui-dist serve docs/api/specs/
```

## Customization

### Custom Schema Templates
Create custom schema templates in `docs/api/schemas/`:
- `custom-types.yaml` - Your domain-specific types
- `business-rules.yaml` - Business logic validation rules
- `domain-models.yaml` - Your application's domain models

### Framework-Specific Rules
Configure framework-specific extraction rules:
```yaml
# In docs/api/config.yaml
framework:
  nestjs:
    controller_pattern: "**/*.controller.ts"
    decorator_mapping:
      "@Get()": "get"
      "@Post()": "post"
```

## Troubleshooting

### Common Issues

**"No APIs detected"**
- Check that your API files are in the expected locations
- Verify framework detection is working correctly
- Ensure route definitions use standard patterns

**"Schema validation errors"**
- Check TypeScript interfaces for proper typing
- Verify Python type hints are complete
- Ensure database models are properly defined

**"Missing examples"**
- Add example data to your test fixtures
- Provide sample data in comments or separate files
- Use the `include_examples=true` flag

### Getting Help
- Run with verbose logging: `generate-api-docs --verbose`
- Check the generated `docs/api/README.md` for framework-specific guidance
- Contact the API documentation specialist agent directly

## Examples

### Generated API Specification
```yaml
openapi: 3.0.3
info:
  title: Users API
  version: 1.0.0
  description: User management endpoints
paths:
  /users:
    get:
      summary: List users
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 1
      responses:
        '200':
          description: Successful response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PaginatedUsers'
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        name:
          type: string
      required:
        - id
        - email
```

### Generated Examples
```json
// Request example
{
  "email": "john.doe@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe"
}

// Response example
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "status": "active",
    "createdAt": "2025-01-08T10:30:00Z"
  }
}
```

## Next Steps

After generating API documentation:

1. **Review and validate** the generated specifications
2. **Add custom examples** for complex use cases
3. **Configure authentication** schemes if needed
4. **Set up documentation hosting** (Swagger UI, Redoc)
5. **Integrate with CI/CD** for automatic updates
6. **Share with stakeholders** for API design review

The API documentation specialist ensures your APIs have professional-grade documentation that serves as both developer reference and contract for API consumers.