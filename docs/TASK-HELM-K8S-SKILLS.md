# Task List: Helm & Kubernetes Skills Integration

**Project**: Add Helm and Kubernetes as dynamic skills for infrastructure-developer
**Goal**: Extract Helm/K8s expertise into reusable skills with auto-detection
**Timeline**: 1-2 weeks
**Priority**: Medium (v3.3.0 enhancement)

---

## Overview

### Current State Analysis

**Existing Capabilities**:
- ✅ **infrastructure-developer**: Has Kubernetes examples but no skill separation
- ✅ **helm-chart-specialist**: Dedicated Helm agent (27 agents currently)
- ✅ **Cloud skills pattern**: Established with AWS cloud skill (v3.2.0)
- ✅ **Detection system**: Cloud provider detector ready for extension

**Consolidation Opportunity**:
- **2 → 1 agents**: Merge helm-chart-specialist into infrastructure-developer via Helm skill
- **Agent count**: 27 → 26 agents (additional 4% reduction)
- **Skills created**: 2 new skills (Helm + Kubernetes)

### Benefits

1. **Consistency**: All infrastructure through one agent with dynamic skill loading
2. **Maintainability**: Helm expertise in centralized skill (easier updates)
3. **Performance**: <100ms skill loading (follows v3.1.0/v3.2.0 pattern)
4. **Extensibility**: Framework for future tools (Kustomize, ArgoCD, etc.)

---

## Task Breakdown

### Phase 1: Analysis & Design (2-3 days)

#### Task 1.1: Analyze Current State ✅ IN PROGRESS
**Estimated Time**: 2 hours

**Subtasks**:
- [x] Review infrastructure-developer Kubernetes capabilities
- [ ] Review helm-chart-specialist agent definition
- [ ] Identify Kubernetes expertise to extract
- [ ] Identify Helm expertise to extract
- [ ] Map capabilities to skills structure

**Deliverable**: Analysis document with capability mapping

---

#### Task 1.2: Design Helm Skill Structure
**Estimated Time**: 3 hours

**Subtasks**:
- [ ] Define Helm SKILL.md scope (quick reference, <100KB target)
  - Chart structure and templates
  - Values management
  - Dependency handling
  - Release management
  - Best practices
- [ ] Define Helm REFERENCE.md scope (comprehensive guide, <1MB target)
  - Advanced templating
  - Helm hooks
  - Testing strategies
  - CI/CD integration
  - Real-world chart examples
- [ ] Plan progressive disclosure pattern
- [ ] Identify 10+ production-ready Helm chart examples

**Deliverable**: Helm skill design document

---

#### Task 1.3: Design Kubernetes Skill Structure
**Estimated Time**: 3 hours

**Subtasks**:
- [ ] Define Kubernetes SKILL.md scope (quick reference, <100KB target)
  - Core resources (Deployments, Services, ConfigMaps, Secrets)
  - Security hardening patterns
  - Resource management
  - Networking (Services, Ingress, Network Policies)
  - Best practices
- [ ] Define Kubernetes REFERENCE.md scope (comprehensive guide, <1MB target)
  - Advanced patterns (StatefulSets, DaemonSets, Jobs, CronJobs)
  - Operators and CRDs
  - RBAC deep dive
  - Storage (PV, PVC, StorageClasses)
  - Observability (Prometheus, Grafana, logging)
  - Production troubleshooting
- [ ] Plan progressive disclosure pattern
- [ ] Identify 20+ production-ready Kubernetes manifest examples

**Deliverable**: Kubernetes skill design document

---

#### Task 1.4: Design Detection Patterns
**Estimated Time**: 4 hours

**Subtasks**:
- [ ] **Helm Detection Signals**:
  - Primary: `Chart.yaml` file presence (weight: 0.6)
  - Secondary: `values.yaml` file (weight: 0.3)
  - Tertiary: `templates/` directory (weight: 0.2)
  - CLI: `helm` commands in scripts (weight: 0.2)
  - Config: `.helmignore`, `requirements.yaml` (weight: 0.1)
- [ ] **Kubernetes Detection Signals**:
  - Primary: `*.yaml` files with `apiVersion: v1` or `apiVersion: apps/v1` (weight: 0.5)
  - Secondary: `kind:` with Deployment/Service/Pod/etc (weight: 0.4)
  - Tertiary: `kubectl` commands in scripts (weight: 0.2)
  - Config: `kubeconfig`, `.kube/` directory (weight: 0.2)
  - Namespace: `kustomization.yaml` (weight: 0.3)
- [ ] Define confidence thresholds (≥70% for auto-loading)
- [ ] Plan multi-signal boost logic
- [ ] Design detection algorithm integration

**Deliverable**: Detection patterns specification

---

### Phase 2: Implementation (1 week)

#### Task 2.1: Create Helm Skill
**Estimated Time**: 12 hours

**Subtasks**:
- [ ] Create `skills/helm/` directory
- [ ] Implement `skills/helm/SKILL.md`:
  - Chart structure overview
  - Template syntax quick reference
  - Values file patterns
  - Common helm commands
  - Dependency management
  - Release lifecycle
  - Testing with `helm lint` and `helm test`
  - Security best practices
- [ ] Implement `skills/helm/REFERENCE.md`:
  - Advanced templating (functions, pipelines, control structures)
  - Chart dependencies and subcharts
  - Helm hooks (pre-install, post-install, etc.)
  - Chart testing strategies
  - CI/CD integration (GitHub Actions, GitLab CI)
  - Helm plugins and extensions
  - OCI registry support
  - 10+ production-ready chart examples:
    - Web application chart
    - Microservices chart
    - Database chart (StatefulSet)
    - Job/CronJob chart
    - Multi-tier application
- [ ] Ensure file sizes: SKILL.md <100KB, REFERENCE.md <1MB

**Deliverable**: Complete Helm skill (2 files)

---

#### Task 2.2: Create Kubernetes Skill
**Estimated Time**: 16 hours

**Subtasks**:
- [ ] Create `skills/kubernetes/` directory
- [ ] Implement `skills/kubernetes/SKILL.md`:
  - Core resource quick reference (Pod, Deployment, Service, ConfigMap, Secret)
  - Security hardening checklist
  - Resource requests/limits guidelines
  - Networking basics (ClusterIP, NodePort, LoadBalancer, Ingress)
  - Storage overview (PV, PVC)
  - RBAC basics
  - Common kubectl commands
  - Troubleshooting quick guide
- [ ] Implement `skills/kubernetes/REFERENCE.md`:
  - Advanced workload types (StatefulSet, DaemonSet, Job, CronJob)
  - Custom Resource Definitions (CRDs)
  - Operators pattern
  - RBAC deep dive (Roles, ClusterRoles, ServiceAccounts)
  - Network Policies comprehensive guide
  - Storage classes and dynamic provisioning
  - Pod Security Standards (PSS) and Pod Security Admission (PSA)
  - Horizontal Pod Autoscaler (HPA) and Vertical Pod Autoscaler (VPA)
  - Cluster Autoscaler
  - Service mesh patterns (Istio, Linkerd basics)
  - Observability (Prometheus, Grafana, logging patterns)
  - Production troubleshooting guide
  - 20+ production-ready manifest examples:
    - Secure deployments (security context, non-root, read-only filesystem)
    - StatefulSet with persistent storage
    - CronJob for scheduled tasks
    - Network Policies for microsegmentation
    - RBAC configurations
    - Ingress with TLS
    - Multi-container pods (sidecar pattern)
    - Init containers
    - Resource quotas and limit ranges
- [ ] Ensure file sizes: SKILL.md <100KB, REFERENCE.md <1MB

**Deliverable**: Complete Kubernetes skill (2 files)

---

#### Task 2.3: Extend Detection System
**Estimated Time**: 6 hours

**Subtasks**:
- [ ] Update `skills/cloud-provider-detector/` or create `skills/tooling-detector/`:
  - Add Helm detection patterns
  - Add Kubernetes detection patterns
  - Implement confidence scoring
  - Add manual override flags (`--helm`, `--kubernetes`)
- [ ] Create detection tests:
  - Helm chart project detection
  - Kubernetes manifests detection
  - Mixed Helm + Kubernetes detection
  - False positive prevention
- [ ] Integrate with existing cloud provider detection
- [ ] Performance validation (<100ms detection)

**Deliverable**: Extended detection system with Helm/K8s support

---

#### Task 2.4: Update infrastructure-developer Agent
**Estimated Time**: 6 hours

**Subtasks**:
- [ ] Add Helm skill loading logic to `infrastructure-developer.yaml`:
  - Detection workflow for Helm projects
  - Automatic skill loading on detection
  - Manual override support
  - Integration with cloud provider detection
- [ ] Add Kubernetes skill loading logic:
  - Detection workflow for K8s manifests
  - Automatic skill loading on detection
  - Progressive disclosure (SKILL.md → REFERENCE.md)
- [ ] Update mission statement:
  - Add Helm as supported tool
  - Add explicit Kubernetes skill mention
- [ ] Update expertise section:
  - Document Helm skill loading
  - Document Kubernetes skill loading
- [ ] Update examples with skill loading workflows
- [ ] Update delegation criteria

**Deliverable**: Updated infrastructure-developer.yaml

---

#### Task 2.5: Deprecate or Enhance helm-chart-specialist
**Estimated Time**: 4 hours

**Decision Point**:
- **Option A (Deprecate)**: Mark helm-chart-specialist as deprecated, update to load Helm skill
- **Option B (Enhance)**: Keep helm-chart-specialist, have it load Helm skill dynamically

**Recommended**: Option A (deprecate and consolidate into infrastructure-developer)

**Subtasks** (if deprecating):
- [ ] Add deprecation notice to `helm-chart-specialist.yaml`
- [ ] Update `agents/README.md` with deprecation notice
- [ ] Update `ai-mesh-orchestrator.yaml` delegation logic
- [ ] Create migration guide (helm-chart-specialist → infrastructure-developer)
- [ ] Schedule removal for v3.4.0

**Deliverable**: Deprecation notice and migration path

---

### Phase 3: Testing & Validation (3-4 days)

#### Task 3.1: Create Helm Skill Tests
**Estimated Time**: 6 hours

**Subtasks**:
- [ ] Create test suite: `tests/integration/helm-skill/test-helm-skill.md`
- [ ] Test scenarios:
  - Helm chart detection (95%+ accuracy)
  - Skill loading performance (<100ms)
  - Chart template validation
  - Values override testing
  - Release management workflows
  - Dependency resolution
  - 5+ real-world chart tests
- [ ] Feature parity validation with helm-chart-specialist

**Deliverable**: Helm skill test suite

---

#### Task 3.2: Create Kubernetes Skill Tests
**Estimated Time**: 8 hours

**Subtasks**:
- [ ] Create test suite: `tests/integration/kubernetes-skill/test-kubernetes-skill.md`
- [ ] Test scenarios:
  - Kubernetes manifest detection (95%+ accuracy)
  - Skill loading performance (<100ms)
  - Security hardening validation
  - Resource management tests
  - Networking configuration tests
  - RBAC validation
  - 10+ real-world manifest tests
- [ ] Feature parity validation with infrastructure-developer K8s capabilities

**Deliverable**: Kubernetes skill test suite

---

#### Task 3.3: Integration Testing
**Estimated Time**: 6 hours

**Subtasks**:
- [ ] Test combined cloud + Helm + Kubernetes scenarios:
  - AWS EKS + Helm charts
  - GCP GKE + Kubernetes manifests
  - Multi-cloud Kubernetes deployments
- [ ] Test skill loading cascade:
  - Cloud provider → Kubernetes → Helm
  - Automatic detection workflow
  - Manual override combinations
- [ ] Performance validation:
  - Multiple skill loading (<200ms total)
  - Cache effectiveness
  - Concurrent skill access
- [ ] User acceptance testing:
  - Real-world Helm chart deployment
  - Real-world Kubernetes application deployment
  - Combined infrastructure + application deployment

**Deliverable**: Integration test results

---

### Phase 4: Documentation & Release (2-3 days)

#### Task 4.1: Update Agent Documentation
**Estimated Time**: 4 hours

**Subtasks**:
- [ ] Update `agents/README.md`:
  - Add Helm skill documentation
  - Add Kubernetes skill documentation
  - Update infrastructure-developer capabilities
  - Add deprecation notice for helm-chart-specialist
- [ ] Update `ai-mesh-orchestrator.yaml`:
  - Update delegation logic for Helm tasks
  - Update delegation logic for Kubernetes tasks
  - Add skill loading awareness

**Deliverable**: Updated agent documentation

---

#### Task 4.2: Create Migration Guide
**Estimated Time**: 3 hours

**Subtasks**:
- [ ] Create `docs/MIGRATION-HELM-K8S-SKILLS.md`:
  - Migration from helm-chart-specialist to infrastructure-developer + Helm skill
  - Skill loading workflow examples
  - Detection pattern examples
  - Troubleshooting guide

**Deliverable**: Migration guide

---

#### Task 4.3: Update CHANGELOG
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] Add v3.3.0 entry to `CHANGELOG.md`:
  - Helm skill addition
  - Kubernetes skill addition
  - helm-chart-specialist deprecation
  - Agent count reduction (27 → 26)
  - Performance metrics
  - Breaking changes (if any)

**Deliverable**: Updated CHANGELOG.md

---

#### Task 4.4: Create Pull Request
**Estimated Time**: 2 hours

**Subtasks**:
- [ ] Create feature branch: `feature/helm-k8s-skills`
- [ ] Comprehensive PR description
- [ ] Link to related issues/PRDs
- [ ] Request reviews

**Deliverable**: Pull Request for review

---

## Success Criteria

### Performance Targets
- [ ] Helm detection accuracy: ≥95%
- [ ] Kubernetes detection accuracy: ≥95%
- [ ] Helm skill loading: <100ms
- [ ] Kubernetes skill loading: <100ms
- [ ] Combined skill loading: <200ms

### Quality Targets
- [ ] Feature parity: 100% with helm-chart-specialist
- [ ] Feature parity: 100% with infrastructure-developer K8s capabilities
- [ ] Security: All examples follow best practices
- [ ] Documentation: Comprehensive with examples
- [ ] Test coverage: 15+ integration tests

### Agent Optimization
- [ ] Agent count: 27 → 26 (additional 4% reduction)
- [ ] Infrastructure consolidation complete
- [ ] Skills-based architecture extended

---

## File Structure

```
skills/
├── helm/
│   ├── SKILL.md                    # <100KB quick reference
│   ├── REFERENCE.md                # <1MB comprehensive guide
│   └── examples/                   # (optional) standalone chart examples
│       ├── web-app/
│       ├── microservices/
│       └── database/
├── kubernetes/
│   ├── SKILL.md                    # <100KB quick reference
│   ├── REFERENCE.md                # <1MB comprehensive guide
│   └── examples/                   # (optional) standalone manifests
│       ├── secure-deployment/
│       ├── statefulset/
│       ├── network-policies/
│       └── rbac/
├── cloud-provider-detector/        # (existing)
└── aws-cloud/                      # (existing)

agents/yaml/
├── infrastructure-developer.yaml   # Updated with Helm/K8s skill loading
└── helm-chart-specialist.yaml      # Deprecated (to be removed in v3.4.0)

tests/integration/
├── helm-skill/
│   └── test-helm-skill.md
└── kubernetes-skill/
    └── test-kubernetes-skill.md

docs/
├── MIGRATION-HELM-K8S-SKILLS.md    # New migration guide
└── TRD/
    └── helm-k8s-skills-trd.md      # (optional) detailed TRD
```

---

## Risk Mitigation

### Risk 1: Scope Creep
**Mitigation**: Strictly adhere to SKILL.md (<100KB) and REFERENCE.md (<1MB) size limits

### Risk 2: Performance Degradation
**Mitigation**: Implement caching, follow v3.1.0/v3.2.0 performance patterns

### Risk 3: Feature Parity Loss
**Mitigation**: Comprehensive testing against helm-chart-specialist baseline

### Risk 4: User Confusion
**Mitigation**: Clear migration guide, deprecation notices, examples

---

## Dependencies

**Required**:
- ✅ v3.2.0 Infrastructure Consolidation (cloud provider detection foundation)
- ✅ v3.1.0 Skills-Based Framework Architecture (skill loading pattern)

**Optional**:
- Future: Kustomize skill (v3.4.0+)
- Future: ArgoCD/Flux skill (v3.4.0+)

---

## Timeline Estimate

| Phase | Duration | Tasks |
|-------|----------|-------|
| Phase 1: Analysis & Design | 2-3 days | Tasks 1.1 - 1.4 |
| Phase 2: Implementation | 1 week | Tasks 2.1 - 2.5 |
| Phase 3: Testing & Validation | 3-4 days | Tasks 3.1 - 3.3 |
| Phase 4: Documentation & Release | 2-3 days | Tasks 4.1 - 4.4 |
| **Total** | **2-3 weeks** | **19 tasks** |

---

## Next Steps

1. **Approve Scope**: Review and approve this task list
2. **Create Feature Branch**: `feature/helm-k8s-skills`
3. **Begin Phase 1**: Start with Task 1.1 (Current state analysis)
4. **Create TRD** (optional): Detailed TRD document if needed
5. **Execute Tasks**: Follow task breakdown sequentially

---

**Status**: 📋 Task list created, awaiting approval to proceed

**Version**: 1.0.0
**Created**: 2025-10-23
**Next Review**: After Phase 1 completion
