# PRD: Critical Skills Gaps - Python/Django, Vue.js, and Terraform

**Product Name**: AI Mesh Framework Skills Expansion (Wave 1)
**Version**: 1.0
**Date**: October 31, 2025
**Status**: Approved for Development
**Priority**: P0 (Immediate Win)
**Owner**: AI Mesh Product Team

---

## Executive Summary

This initiative adds three critical framework skills to AI Mesh that represent 40%+ of the development market currently unsupported: Python/Django (18% backend market), Vue.js (16% frontend market), and Terraform (35% IaC market). These gaps significantly limit AI Mesh's addressable market and prevent adoption by teams using these industry-standard technologies.

**Problem**: AI Mesh currently supports React, Blazor, NestJS, Phoenix, Rails, .NET, Helm, Kubernetes, and Fly.io but lacks support for Python/Django (2nd most popular backend after Node.js), Vue.js (major React/Angular alternative), and Terraform (IaC industry standard).

**Solution**: Create comprehensive skill packages for Python/Django, Vue.js, and Terraform following the proven pattern established with Helm and Kubernetes skills: SKILL.md (quick reference, 20-25KB, <100ms load), REFERENCE.md (comprehensive guide, 30-40KB, production patterns), examples directory (8-12 production-ready templates), and detection patterns for automatic skill loading.

**Impact**: 40% broader market coverage, support for 3 major technology ecosystems, increased competitiveness, enhanced agent capabilities (backend-developer, frontend-developer, infrastructure-developer).

---

## Goals & Non-Goals

### Goals

1. **Market Expansion**: Cover 40% more of development market (Django 18%, Vue 16%, Terraform 35%)
2. **Competitive Parity**: Match capabilities of general-purpose AI coding assistants
3. **Quality Standards**: Match existing skill quality (Helm/K8s as benchmark)
4. **Detection Accuracy**: Achieve 95%+ detection accuracy for all three frameworks
5. **Fast Loading**: Maintain <100ms skill loading time for quick references

### Non-Goals

1. **All Frameworks**: Not adding Angular, Go, Spring Boot, etc. (separate PRD)
2. **Deep Integrations**: Not building IDE-specific features yet
3. **Training Materials**: Not creating video tutorials or courses
4. **Framework Migrations**: Not building Django→Rails or Vue→React converters

---

## User Personas & Use Cases

### Primary Personas

#### 1. Sarah - Python/Django Developer (25% of target audience)
- **Background**: Backend developer, 3 years Django experience, exploring AI tools
- **Pain Points**:
  - Current AI tools generic, not Django-aware
  - Needs Django ORM, migrations, DRF expertise
  - Security patterns specific to Django required
- **Needs**:
  - Django-specific code generation
  - ORM query optimization
  - DRF API patterns
  - Security best practices (CSRF, SQL injection, etc.)

#### 2. Mike - Vue.js Frontend Developer (20% of target audience)
- **Background**: Frontend specialist, prefers Vue over React, 2+ years experience
- **Pain Points**:
  - Most AI tools React-focused
  - Needs Composition API, Pinia, Vue Router patterns
  - Wants TypeScript + Vue integration
- **Needs**:
  - Vue 3 Composition API patterns
  - Pinia state management
  - Vue Router best practices
  - Component composition strategies

#### 3. Alex - DevOps/Infrastructure Engineer (30% of target audience)
- **Background**: Infrastructure specialist, Terraform expert, multi-cloud experience
- **Pain Points**:
  - Needs Terraform-specific patterns
  - Module design and reusability critical
  - State management and remote backends complex
- **Needs**:
  - HCL syntax expertise
  - Module design patterns
  - Multi-environment strategies
  - Security scanning (tfsec)

### Key Use Cases

#### Use Case 1: Django REST API Development (Sarah)
**Actor**: Sarah (Django Developer)
**Trigger**: Building new microservice with Django + DRF
**Flow**:
1. Sarah runs `/analyze-product` on new Django project
2. System detects `manage.py`, `settings.py` → auto-loads Python/Django skills
3. Sarah invokes backend-developer: "Create RESTful API with Django REST Framework"
4. Agent generates: models with proper field types, serializers with validation, viewsets with permissions, URL routing, test cases
5. All code follows Django/DRF best practices
6. Includes security (proper authentication, CSRF protection, SQL injection prevention)

**Success Criteria**: Django API generated with production-ready patterns, passes security audit

#### Use Case 2: Vue 3 Component Development (Mike)
**Actor**: Mike (Vue Developer)
**Trigger**: Building reusable component library for SaaS app
**Flow**:
1. Mike's project has `vite.config.js` and Vue dependencies
2. System detects Vue → auto-loads Vue.js skills
3. Mike invokes frontend-developer: "Create form component with validation using Composition API"
4. Agent generates: composable for form state, validation logic, TypeScript types, component with script setup, Pinia store integration (if needed)
5. Follows Vue 3 + Composition API best practices
6. Includes accessibility (ARIA), responsiveness, testing setup

**Success Criteria**: Vue component production-ready, passes accessibility audit, fully typed

#### Use Case 3: Terraform Infrastructure as Code (Alex)
**Actor**: Alex (DevOps Engineer)
**Trigger**: Provisioning multi-environment AWS infrastructure
**Flow**:
1. Alex's project has `*.tf` files and `.terraform/` directory
2. System detects Terraform → auto-loads Terraform skills
3. Alex invokes infrastructure-developer: "Create Terraform module for multi-environment VPC setup"
4. Agent generates: module structure (variables, outputs, main.tf), multi-environment configurations (dev/staging/prod), remote state backend configuration, security groups with least privilege
5. Follows Terraform best practices (module design, DRY principles, state isolation)
6. Includes tfsec security scanning, Terratest examples

**Success Criteria**: Terraform modules production-ready, passes security scan, works across environments

---

## Functional Requirements

### FR-1: Python/Django Skill Package
**Priority**: P0
**Description**: Comprehensive Django development skills for backend-developer agent

**Package Structure**:
```
skills/python-django/
├── SKILL.md                    # Quick reference (22KB, <100ms load)
│   ├── Django MVT architecture
│   ├── ORM patterns and migrations
│   ├── Django REST Framework basics
│   ├── Common security patterns
│   ├── Testing strategies
│   └── Quick command reference
├── REFERENCE.md                # Comprehensive guide (35KB)
│   ├── Advanced ORM optimization (select_related, prefetch_related, etc.)
│   ├── Celery background tasks integration
│   ├── Django channels (WebSockets)
│   ├── Production deployment (Gunicorn, Nginx, Docker)
│   ├── Security hardening (OWASP Top 10 for Django)
│   ├── Performance optimization
│   └── Testing (pytest-django, factory_boy, fixtures)
└── examples/
    ├── api-crud.py             # Complete CRUD with DRF
    ├── authentication.py       # JWT + OAuth patterns
    ├── signals-hooks.py        # Signals for decoupled logic
    ├── admin-customization.py  # Django admin optimization
    ├── celery-tasks.py         # Background job patterns
    ├── middleware-custom.py    # Custom middleware examples
    ├── testing-patterns.py     # Test fixtures and factories
    └── deployment/
        ├── Dockerfile
        ├── docker-compose.yml
        └── gunicorn.conf.py
```

**Acceptance Criteria**:
- SKILL.md: 22KB ±2KB, loads in <100ms
- REFERENCE.md: 35KB ±5KB, comprehensive coverage
- 8+ production-ready examples
- Covers Django 4.2+ and Python 3.11+
- Includes security best practices (OWASP Django)
- Testing patterns with pytest-django

### FR-2: Vue.js Skill Package
**Priority**: P0
**Description**: Comprehensive Vue.js development skills for frontend-developer agent

**Package Structure**:
```
skills/vue-framework/
├── SKILL.md                    # Quick reference (20KB, <100ms load)
│   ├── Composition API patterns (setup, ref, reactive, computed)
│   ├── Pinia state management basics
│   ├── Vue Router best practices
│   ├── Component composition strategies
│   ├── Reactivity system fundamentals
│   └── Quick syntax reference
├── REFERENCE.md                # Comprehensive guide (32KB)
│   ├── Advanced composables (patterns, reusability)
│   ├── Performance optimization (lazy loading, code splitting)
│   ├── SSR with Nuxt 3
│   ├── Testing (Vitest + Testing Library)
│   ├── TypeScript integration (props, emits, generics)
│   ├── Directives and plugins
│   └── Teleport, Suspense, KeepAlive patterns
└── examples/
    ├── composable-pattern.vue  # Reusable logic extraction
    ├── form-handling.vue       # Form validation with composables
    ├── async-data.vue          # Data fetching patterns
    ├── pinia-store.ts          # State management patterns
    ├── router-config.ts        # Routing with guards
    ├── typescript-component.vue # Full TypeScript integration
    ├── testing/
    │   ├── component.spec.ts
    │   └── composable.spec.ts
    └── performance/
        ├── lazy-load.vue
        └── code-splitting.ts
```

**Acceptance Criteria**:
- SKILL.md: 20KB ±2KB, loads in <100ms
- REFERENCE.md: 32KB ±5KB, comprehensive coverage
- 8+ production-ready examples
- Covers Vue 3.3+ with Composition API
- TypeScript integration throughout
- Testing patterns with Vitest

### FR-3: Terraform Skill Package
**Priority**: P0
**Description**: Comprehensive Terraform IaC skills for infrastructure-developer agent

**Package Structure**:
```
skills/terraform/
├── SKILL.md                    # Quick reference (24KB, <100ms load)
│   ├── HCL syntax essentials
│   ├── Provider configuration
│   ├── Resource definitions
│   ├── Module patterns
│   ├── State management basics
│   └── Common CLI commands
├── REFERENCE.md                # Comprehensive guide (40KB)
│   ├── Advanced module design (composition, reusability)
│   ├── Workspace strategies (multi-environment)
│   ├── Remote state backends (S3, Terraform Cloud, etc.)
│   ├── Testing with Terratest
│   ├── Security scanning (tfsec, checkov)
│   ├── Import existing infrastructure
│   ├── Refactoring strategies
│   └── CI/CD integration
└── examples/
    ├── aws-vpc-module/
    │   ├── main.tf
    │   ├── variables.tf
    │   ├── outputs.tf
    │   └── README.md
    ├── kubernetes-cluster/
    │   ├── eks-cluster.tf
    │   ├── node-groups.tf
    │   └── security-groups.tf
    ├── multi-environment/
    │   ├── dev.tfvars
    │   ├── staging.tfvars
    │   └── prod.tfvars
    ├── security-groups/
    │   ├── web-tier.tf
    │   ├── app-tier.tf
    │   └── data-tier.tf
    ├── remote-state/
    │   └── backend-s3.tf
    └── testing/
        └── example_test.go
```

**Acceptance Criteria**:
- SKILL.md: 24KB ±2KB, loads in <100ms
- REFERENCE.md: 40KB ±5KB, comprehensive coverage
- 12+ production-ready examples
- Covers Terraform 1.5+ and HCL2
- AWS, GCP, Azure provider examples
- Security scanning integration (tfsec)

### FR-4: Enhanced Tooling Detection
**Priority**: P0
**Description**: Detect Python/Django, Vue.js, and Terraform projects automatically

**Detection Patterns** (add to `skills/tooling-detector/tooling-patterns.json`):
```json
{
  "python-django": {
    "files": ["manage.py", "settings.py", "wsgi.py", "asgi.py"],
    "directories": ["migrations/", "apps/"],
    "imports": ["django", "django.conf", "django.db"],
    "configs": ["requirements.txt", "Pipfile", "pyproject.toml", "setup.py"],
    "patterns": ["from django", "import django"]
  },
  "vue": {
    "files": ["vue.config.js", "vite.config.js", "vite.config.ts"],
    "directories": ["src/components/", "src/views/"],
    "dependencies": ["vue", "vue-router", "pinia", "@vue/", "nuxt"],
    "patterns": ["*.vue", "<script setup>", "defineComponent"]
  },
  "terraform": {
    "files": ["*.tf", "*.tfvars", "terraform.tfvars", ".terraform.lock.hcl"],
    "directories": [".terraform/", "modules/"],
    "patterns": ["provider \"", "resource \"", "module \"", "terraform {"]
  }
}
```

**Acceptance Criteria**:
- Detection accuracy >95% for each framework
- Detection time <500ms per project
- Zero false positives (no incorrect framework detection)
- Works with monorepos (detects multiple frameworks)
- Caching to avoid repeated scans

### FR-5: Agent Integration
**Priority**: P0
**Description**: Enable backend-developer, frontend-developer, infrastructure-developer to use new skills

**Acceptance Criteria**:
- backend-developer uses Python/Django skills when Django detected
- frontend-developer uses Vue.js skills when Vue detected
- infrastructure-developer uses Terraform skills when Terraform detected
- Skill loading transparent (automatic or on-demand per progressive disclosure)
- Agents degrade gracefully if skills declined by user

---

## Non-Functional Requirements

### NFR-1: Performance
- Skill loading time: <100ms for SKILL.md
- Detection time: <500ms per project
- File sizes: SKILL.md ≤25KB, REFERENCE.md ≤45KB
- Examples compile/run successfully (validated)
- No performance degradation to existing skills

### NFR-2: Quality
- Documentation accuracy: 100% (all code examples work)
- Code quality: Production-ready patterns
- Security: No vulnerable patterns, follows OWASP
- Testing: All examples include test cases
- Accessibility: Frontend examples meet WCAG 2.1 AA (Vue.js)

### NFR-3: Maintainability
- Follow established pattern (Helm/K8s skills as template)
- Clear documentation structure
- Version-specific guidance (framework versions)
- Easy to update as frameworks evolve
- Examples use current best practices

### NFR-4: Compatibility
- Works with existing agent architecture
- Compatible with progressive disclosure system
- Supports offline usage (bundled with installation)
- Cross-platform (macOS, Linux, Windows)
- No external dependencies

---

## Acceptance Criteria

### Python/Django Acceptance Criteria

**AC-1: Django Detection**
- GIVEN a project with `manage.py` and `settings.py`
- WHEN detection runs
- THEN system must detect Django with >95% confidence
- AND prompt user to load Python/Django skills (if not installed)

**AC-2: Django Code Generation**
- GIVEN backend-developer with Django skills loaded
- WHEN user requests "Create Django REST API with authentication"
- THEN generated code must include: models, serializers, viewsets, URLs, authentication
- AND code must follow Django/DRF best practices
- AND include security patterns (parameterized queries, CSRF, etc.)

**AC-3: Django Documentation Quality**
- GIVEN SKILL.md and REFERENCE.md
- WHEN reviewed for accuracy
- THEN all code examples must execute successfully
- AND documentation must cover Django 4.2+ features
- AND security guidance must align with OWASP recommendations

### Vue.js Acceptance Criteria

**AC-4: Vue Detection**
- GIVEN a project with `vite.config.js` and Vue dependencies in package.json
- WHEN detection runs
- THEN system must detect Vue with >95% confidence
- AND prompt user to load Vue.js skills (if not installed)

**AC-5: Vue Code Generation**
- GIVEN frontend-developer with Vue skills loaded
- WHEN user requests "Create Vue component with form validation"
- THEN generated code must use Composition API (script setup)
- AND include TypeScript types, Pinia integration if needed, accessibility
- AND follow Vue 3 best practices

**AC-6: Vue Documentation Quality**
- GIVEN SKILL.md and REFERENCE.md
- WHEN reviewed for accuracy
- THEN all code examples must compile and run
- AND documentation must cover Vue 3.3+ Composition API
- AND TypeScript integration must be complete

### Terraform Acceptance Criteria

**AC-7: Terraform Detection**
- GIVEN a project with `*.tf` files and `.terraform/` directory
- WHEN detection runs
- THEN system must detect Terraform with >95% confidence
- AND prompt user to load Terraform skills (if not installed)

**AC-8: Terraform Code Generation**
- GIVEN infrastructure-developer with Terraform skills loaded
- WHEN user requests "Create Terraform module for AWS VPC"
- THEN generated code must include: variables, main.tf, outputs, examples
- AND follow Terraform best practices (modules, state, naming)
- AND pass tfsec security scan

**AC-9: Terraform Documentation Quality**
- GIVEN SKILL.md and REFERENCE.md
- WHEN reviewed for accuracy
- THEN all Terraform examples must initialize and plan successfully
- AND documentation must cover Terraform 1.5+ features
- AND security guidance must include tfsec/checkov integration

### Detection Accuracy Acceptance Criteria

**AC-10: Detection Performance**
- GIVEN 100 test projects (Django, Vue, Terraform, and non-matching)
- WHEN detection runs on each
- THEN accuracy must be >95% (≤5 false positives/negatives)
- AND detection time must be <500ms per project

---

## Success Metrics

### Primary Metrics

**M-1: Market Coverage Expansion**
- **Target**: 40% increase in addressable market
- **Measurement**: % of developers using supported frameworks
- **Baseline**: Current 60% (React, Angular, .NET, etc.)
- **Target**: 100% (add Django 18%, Vue 16%, Terraform 35%, with overlap)

**M-2: Skill Adoption Rate**
- **Target**: >70% of eligible users adopt new skills
- **Measurement**: % of Django/Vue/Terraform projects with skills loaded
- **Baseline**: N/A (new feature)
- **Target**: >70% within 30 days of launch

**M-3: Code Generation Quality**
- **Target**: >85% acceptance rate for generated code
- **Measurement**: % of generated code used without major modifications
- **Baseline**: Current 80-85% for existing skills
- **Target**: ≥85% for Django/Vue/Terraform

### Secondary Metrics

**M-4: Detection Accuracy**
- **Target**: >95% detection accuracy
- **Measurement**: False positive/negative rate in real projects
- **Expected**: ≤5% error rate

**M-5: User Satisfaction**
- **Target**: >4.0/5.0 rating for new skills
- **Measurement**: User feedback, GitHub reactions, surveys
- **Baseline**: Current skills avg 4.2/5.0
- **Target**: ≥4.0/5.0

**M-6: Documentation Usage**
- **Target**: High documentation reference rate
- **Measurement**: Skill loading frequency, time spent
- **Expected**: SKILL.md used 80%, REFERENCE.md used 40%

---

## Implementation Plan

### Phase 1: Python/Django Skills (Days 1-7)
- Day 1-2: Research Django best practices, structure SKILL.md
- Day 3-4: Write REFERENCE.md with advanced patterns
- Day 5-6: Create 8 production examples (CRUD, auth, Celery, etc.)
- Day 7: Testing, validation, integration with backend-developer

**Deliverables**: Python/Django skill package ready for production

### Phase 2: Vue.js Skills (Days 8-13)
- Day 8-9: Research Vue 3 Composition API, structure SKILL.md
- Day 10-11: Write REFERENCE.md with advanced composables
- Day 12: Create 8 examples (components, Pinia, router, testing)
- Day 13: Testing, validation, integration with frontend-developer

**Deliverables**: Vue.js skill package ready for production

### Phase 3: Terraform Skills (Days 14-21)
- Day 14-16: Research Terraform best practices, structure SKILL.md
- Day 17-18: Write REFERENCE.md with advanced module patterns
- Day 19-20: Create 12 examples (VPC, K8s, multi-env, security)
- Day 21: Testing, validation, integration with infrastructure-developer

**Deliverables**: Terraform skill package ready for production

### Phase 4: Detection & Launch (Days 22-23)
- Day 22: Enhance tooling-detector with new patterns
- Day 22: Integration testing across all three skills
- Day 23: Documentation, launch preparation, metrics dashboard

**Total Timeline**: 23 days (~5 weeks) for all three skills

---

## Dependencies & Prerequisites

### Required Before Start
- ✅ Existing skill system architecture (React, Helm, K8s patterns)
- ✅ Tooling-detector framework (95%+ accuracy baseline)
- ✅ Agent integration points (backend/frontend/infrastructure-developer)

### Required During Development
- Expert reviews (Django, Vue, Terraform specialists)
- Test projects for validation
- Security audits (OWASP, tfsec, etc.)
- Example code testing (all examples must work)

### Required for Launch
- Documentation complete and reviewed
- All examples validated and tested
- Detection patterns tested on real projects
- Integration with progressive disclosure system

---

## Open Questions

1. **Q**: Should we include older framework versions (Django 3.x, Vue 2.x, Terraform 0.x)?
   **A**: Focus on current versions initially, add legacy support in v2 if demand exists

2. **Q**: How to handle framework updates (new Django/Vue/Terraform releases)?
   **A**: Quarterly review cycle, update docs and examples as frameworks evolve

3. **Q**: Should examples use Docker, or bare metal deployment?
   **A**: Both - Docker for consistency, bare metal for flexibility

4. **Q**: How to prioritize next wave of skills (Angular, Go, Spring Boot)?
   **A**: User demand + market share analysis after this wave launches

---

**Document Version**: 1.0
**Last Updated**: October 31, 2025
**Next Review**: After Phase 4 (Day 23)
**Approval**: Pending Implementation
