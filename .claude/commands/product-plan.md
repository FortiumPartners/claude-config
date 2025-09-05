---
name: product-plan
description: Trigger product management orchestrator to document and plan a feature or product initiative
---

# Product Planning Command

This command triggers the product-management-orchestrator agent to analyze, document, and create comprehensive plans for features or product initiatives.

## Usage

```
/product-plan <feature_description>
```

## Examples

- `/product-plan user authentication system with SSO support`
- `/product-plan mobile app dashboard redesign`
- `/product-plan API rate limiting and usage analytics`
- `/product-plan multi-tenant data isolation architecture`

## What This Command Does

The product-management-orchestrator will perform a complete product management workflow:

1. **Requirements Gathering**: Analyze the feature request and identify stakeholder needs
2. **Market Research**: Research competitive landscape and industry best practices
3. **User Experience Planning**: Define user personas, journeys, and acceptance criteria
4. **Feature Prioritization**: Apply RICE, MoSCoW, and Kano model frameworks
5. **Roadmap Planning**: Create strategic timeline with milestones and dependencies
6. **Risk Assessment**: Identify potential risks and mitigation strategies
7. **Success Metrics**: Define measurable success criteria and KPIs

## Deliverables

- Complete Product Requirements Document (PRD)
- User personas and journey maps
- Feature prioritization with scoring rationale
- Strategic roadmap with timelines
- Risk register with mitigation plans
- Stakeholder communication plan

## Integration

This command coordinates with other agents:
- **tech-lead-orchestrator**: For technical feasibility analysis
- **documentation-specialist**: For PRD creation and stakeholder materials
- **general-purpose**: For market research and competitive analysis