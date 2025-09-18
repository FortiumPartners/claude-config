# API Documentation

This directory contains comprehensive OpenAPI 3.0 specifications for all web APIs in the project. The documentation is automatically generated and maintained by the `api-documentation-specialist` agent.

## Directory Structure

```
docs/api/
├── README.md                    # This overview document
├── specs/                       # OpenAPI specification files
│   ├── users-api.yaml          # User management API
│   ├── products-api.yaml       # Product management API
│   ├── orders-api.yaml         # Order processing API
│   └── analytics-api.yaml      # Analytics and reporting API
├── examples/                    # Request/response examples
│   ├── users/
│   ├── products/
│   └── orders/
└── schemas/                     # Shared schema definitions
    ├── common-types.yaml
    ├── error-responses.yaml
    └── pagination.yaml
```

## API Specifications

### Available APIs

| API | Description | Status | Version |
|-----|-------------|--------|---------|
| Users API | User management, authentication, profiles | Active | v1.0.0 |
| Products API | Product catalog, inventory management | Active | v1.0.0 |
| Orders API | Order processing, payment integration | Active | v1.0.0 |
| Analytics API | Usage analytics, reporting | Active | v1.0.0 |

### Accessing Documentation

#### Interactive Documentation
- **Swagger UI**: [https://api.company.com/docs](https://api.company.com/docs)
- **ReDoc**: [https://api.company.com/redoc](https://api.company.com/redoc)

#### Static Documentation
- View individual OpenAPI specs in the `specs/` directory
- Use any OpenAPI-compatible viewer or editor

## Development Workflow

### For API Developers
1. Implement your API endpoints with proper TypeScript types or Python type hints
2. Run the API documentation generation: `/generate-api-docs`
3. Review the generated OpenAPI specification
4. Update examples and descriptions as needed
5. Commit the updated documentation

### For API Consumers
1. Check the latest API specifications in `specs/`
2. Use the interactive documentation for testing
3. Refer to examples in the `examples/` directory
4. Validate your client code against the schemas

## Quality Standards

### Documentation Requirements
- ✅ 100% endpoint coverage
- ✅ Complete parameter documentation with types and examples
- ✅ Request/response schemas for all operations
- ✅ Authentication and security requirements documented
- ✅ Error responses and status codes defined

### Validation
- All specifications must pass OpenAPI 3.0 validation
- Schemas must match actual API implementations
- Examples must be syntactically correct and realistic

## Tools & Commands

### Validation
```bash
# Validate a specific API spec
npx @apidevtools/swagger-parser validate specs/users-api.yaml

# Validate all API specs
find specs/ -name "*.yaml" -exec npx @apidevtools/swagger-parser validate {} \;
```

### Documentation Generation
```bash
# Generate HTML documentation
npx redoc-cli bundle specs/users-api.yaml -o docs/users-api.html

# Generate client SDK (TypeScript)
npx @openapitools/openapi-generator-cli generate \
  -i specs/users-api.yaml \
  -g typescript-fetch \
  -o generated-client
```

### Development Server
```bash
# Start local documentation server
npx swagger-ui-dist serve specs/
```

## Contributing

### Adding New APIs
1. Create a new OpenAPI spec file in `specs/`
2. Follow the naming convention: `{resource}-api.yaml`
3. Include all required components (info, servers, paths, components)
4. Add examples in the appropriate `examples/` subdirectory
5. Update this README with the new API information

### Updating Existing APIs
1. Run the API documentation generation tool
2. Review the generated changes
3. Update examples and descriptions
4. Validate the specification
5. Commit the changes

## Support

### Common Issues
- **Schema validation errors**: Check that your TypeScript interfaces match the OpenAPI schemas
- **Missing examples**: Add realistic examples in the `examples/` directory
- **Authentication issues**: Ensure security schemes are properly defined in the spec

### Getting Help
- Check the [API Development Guide](../development/api-guide.md)
- Contact the API documentation specialist agent: `/api-docs-help`
- Review existing specifications for patterns and conventions

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-01-08 | Initial API documentation structure |
| 1.1.0 | TBD | Add automated generation workflow |

---

**Last Updated**: January 8, 2025
**Maintained by**: api-documentation-specialist agent