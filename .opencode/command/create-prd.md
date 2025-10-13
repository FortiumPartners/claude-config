COMMAND: /create-prd
DESCRIPTION: Create comprehensive Product Requirements Document from product description
VERSION: 1.0.0

PURPOSE:
Create a comprehensive Product Requirements Document (PRD) from a product description
or feature idea. Delegates to product-management-orchestrator for user analysis,
acceptance criteria definition, and structured requirements documentation.

WORKFLOW:

Phase 1: Product Analysis
  1. Product Description Analysis: Analyze provided product description or feature idea
  2. User Research: Identify primary users, personas, and pain points
  3. Goal Definition: Define primary goals, success criteria, and non-goals

Phase 2: Requirements Definition
  1. Functional Requirements: Define what the product must do
  2. Non-Functional Requirements: Define performance, security, accessibility requirements
  3. Acceptance Criteria: Create measurable, testable acceptance criteria

Phase 3: Output Management
  1. PRD Creation: Generate comprehensive PRD document
  2. File Organization: Save to @docs/PRD/ directory

EXPECTED OUTPUT:
Format: Product Requirements Document (PRD)
Structure:
- Product Summary: Problem statement, solution, value proposition
- User Analysis: Users, personas, pain points, journey
- Goals & Non-Goals: Objectives, success criteria, scope boundaries
- Acceptance Criteria: Measurable success criteria with test scenarios
