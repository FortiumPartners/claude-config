#!/bin/bash

# API Documentation Validation Script
# Validates all OpenAPI specifications in the docs/api/specs/ directory

set -e

echo "🔍 Validating OpenAPI Specifications..."
echo "========================================"

SPEC_DIR="docs/api/specs"
SCHEMA_DIR="docs/api/schemas"
EXAMPLES_DIR="docs/api/examples"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_dependencies() {
    echo -e "${BLUE}Checking dependencies...${NC}"

    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is required but not installed${NC}"
        exit 1
    fi

    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is required but not installed${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Dependencies OK${NC}"
}

# Install validation tools if needed
install_tools() {
    echo -e "${BLUE}Installing validation tools...${NC}"

    if ! npm list -g @apidevtools/swagger-parser &> /dev/null; then
        echo "Installing @apidevtools/swagger-parser..."
        npm install -g @apidevtools/swagger-parser
    fi

    if ! npm list -g @openapitools/openapi-generator-cli &> /dev/null; then
        echo "Installing @openapitools/openapi-generator-cli..."
        npm install -g @openapitools/openapi-generator-cli
    fi

    echo -e "${GREEN}✅ Tools installed${NC}"
}

# Validate OpenAPI specification
validate_spec() {
    local spec_file="$1"
    local spec_name=$(basename "$spec_file" .yaml)

    echo -e "${BLUE}Validating ${spec_name}...${NC}"

    if [ ! -f "$spec_file" ]; then
        echo -e "${RED}❌ Specification file not found: ${spec_file}${NC}"
        return 1
    fi

    # Validate with swagger-parser
    if swagger-parser validate "$spec_file" &> /dev/null; then
        echo -e "${GREEN}✅ ${spec_name} - Valid OpenAPI specification${NC}"
        return 0
    else
        echo -e "${RED}❌ ${spec_name} - Invalid OpenAPI specification${NC}"
        swagger-parser validate "$spec_file"
        return 1
    fi
}

# Validate all specifications
validate_all_specs() {
    echo -e "${BLUE}Validating API specifications...${NC}"

    local failed_specs=()
    local spec_count=0

    for spec_file in "$SPEC_DIR"/*.yaml; do
        if [ -f "$spec_file" ]; then
            spec_count=$((spec_count + 1))
            if ! validate_spec "$spec_file"; then
                failed_specs+=("$(basename "$spec_file" .yaml)")
            fi
        fi
    done

    if [ ${#failed_specs[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ All ${spec_count} specifications are valid!${NC}"
        return 0
    else
        echo -e "${RED}❌ ${#failed_specs[@]} of ${spec_count} specifications failed validation:${NC}"
        printf '  - %s\n' "${failed_specs[@]}"
        return 1
    fi
}

# Validate shared schemas
validate_schemas() {
    echo -e "${BLUE}Validating shared schemas...${NC}"

    local schema_files=("$SCHEMA_DIR/common-types.yaml" "$SCHEMA_DIR/error-responses.yaml" "$SCHEMA_DIR/pagination.yaml")
    local failed_schemas=()

    for schema_file in "${schema_files[@]}"; do
        if [ -f "$schema_file" ]; then
            local schema_name=$(basename "$schema_file" .yaml)
            echo -e "${BLUE}Validating ${schema_name}...${NC}"

            if swagger-parser validate "$schema_file" &> /dev/null; then
                echo -e "${GREEN}✅ ${schema_name} - Valid schema${NC}"
            else
                echo -e "${RED}❌ ${schema_name} - Invalid schema${NC}"
                failed_schemas+=("$schema_name")
            fi
        else
            echo -e "${YELLOW}⚠️  Schema file not found: ${schema_file}${NC}"
        fi
    done

    if [ ${#failed_schemas[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ All shared schemas are valid!${NC}"
        return 0
    else
        echo -e "${RED}❌ ${#failed_schemas[@]} shared schemas failed validation${NC}"
        return 1
    fi
}

# Validate examples against schemas
validate_examples() {
    echo -e "${BLUE}Validating examples...${NC}"

    # This is a basic check - in a real implementation, you'd use
    # JSON Schema validation or OpenAPI example validation

    local example_count=0
    local valid_examples=0

    for example_file in "$EXAMPLES_DIR"/*/*.json; do
        if [ -f "$example_file" ]; then
            example_count=$((example_count + 1))

            # Basic JSON validation
            if jq empty "$example_file" &> /dev/null; then
                valid_examples=$((valid_examples + 1))
            else
                echo -e "${RED}❌ Invalid JSON in ${example_file}${NC}"
            fi
        fi
    done

    if [ $valid_examples -eq $example_count ]; then
        echo -e "${GREEN}✅ All ${example_count} examples are valid JSON!${NC}"
        return 0
    else
        echo -e "${RED}❌ ${example_count - valid_examples} of ${example_count} examples have invalid JSON${NC}"
        return 1
    fi
}

# Generate validation report
generate_report() {
    echo -e "${BLUE}Generating validation report...${NC}"

    local report_file="docs/api/validation-report.md"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    cat > "$report_file" << EOF
# API Documentation Validation Report

**Generated:** ${timestamp}

## Summary

| Component | Status | Count | Valid | Invalid |
|-----------|--------|-------|-------|---------|
| API Specifications | $([ -d "$SPEC_DIR" ] && find "$SPEC_DIR" -name "*.yaml" | wc -l || echo "0") | - | - | - |
| Shared Schemas | $([ -d "$SCHEMA_DIR" ] && find "$SCHEMA_DIR" -name "*.yaml" | wc -l || echo "0") | - | - | - |
| Examples | $([ -d "$EXAMPLES_DIR" ] && find "$EXAMPLES_DIR" -name "*.json" | wc -l || echo "0") | - | - | - |

## Validation Results

### API Specifications
$(for spec_file in "$SPEC_DIR"/*.yaml; do
    if [ -f "$spec_file" ]; then
        spec_name=$(basename "$spec_file" .yaml)
        if swagger-parser validate "$spec_file" &> /dev/null; then
            echo "- ✅ ${spec_name} - Valid"
        else
            echo "- ❌ ${spec_name} - Invalid"
        fi
    fi
done)

### Shared Schemas
$(for schema_file in "$SCHEMA_DIR"/*.yaml; do
    if [ -f "$schema_file" ]; then
        schema_name=$(basename "$schema_file" .yaml)
        if swagger-parser validate "$schema_file" &> /dev/null; then
            echo "- ✅ ${schema_name} - Valid"
        else
            echo "- ❌ ${schema_name} - Invalid"
        fi
    fi
done)

### Examples
$(for example_file in "$EXAMPLES_DIR"/*/*.json; do
    if [ -f "$example_file" ]; then
        example_name=$(basename "$example_file" .json)
        if jq empty "$example_file" &> /dev/null; then
            echo "- ✅ ${example_name} - Valid JSON"
        else
            echo "- ❌ ${example_name} - Invalid JSON"
        fi
    fi
done)

## Recommendations

- Ensure all API specifications pass OpenAPI 3.0 validation
- Verify that examples match their corresponding schemas
- Keep shared schemas updated with any API changes
- Run validation before committing API documentation changes

---
*Generated by API Documentation Validation Script*
EOF

    echo -e "${GREEN}✅ Validation report generated: ${report_file}${NC}"
}

# Main execution
main() {
    echo "🚀 Starting API Documentation Validation"
    echo "========================================"

    check_dependencies
    install_tools

    local validation_passed=true

    if ! validate_all_specs; then
        validation_passed=false
    fi

    if ! validate_schemas; then
        validation_passed=false
    fi

    if ! validate_examples; then
        validation_passed=false
    fi

    generate_report

    echo ""
    if [ "$validation_passed" = true ]; then
        echo -e "${GREEN}🎉 All validations passed!${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some validations failed. Check the validation report for details.${NC}"
        exit 1
    fi
}

# Run main function
main "$@"