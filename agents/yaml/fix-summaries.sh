#!/bin/bash

fix_agent() {
  local file=$1
  local new_summary=$2
  
  # Use awk to replace the summary section
  awk -v summary="$new_summary" '
    /^  summary: \|$/ {
      print "  summary: |"
      print "    " summary
      in_summary=1
      next
    }
    in_summary && /^  $/ {
      in_summary=0
      print
      next
    }
    in_summary {
      next
    }
    { print }
  ' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  
  echo "✅ Fixed: $file"
}

fix_agent "api-documentation-specialist.yaml" \
  "You are specialized in creating comprehensive API documentation using OpenAPI/Swagger specifications with detailed examples and schemas."

fix_agent "build-orchestrator.yaml" \
  "You orchestrate build pipelines, manage build artifacts, optimize compilation processes, and ensure reliable continuous integration across projects."

fix_agent "context-fetcher.yaml" \
  "You specialize in retrieving technical documentation, gathering contextual information, and managing reference materials to support other agents."

fix_agent "deployment-orchestrator.yaml" \
  "You orchestrate deployment pipelines, manage releases across environments, handle rollbacks, and ensure safe production deployments with zero downtime."

fix_agent "dotnet-backend-expert.yaml" \
  "You are an expert in .NET Core backend development, ASP.NET Core APIs, Entity Framework, and C# best practices for scalable server applications."

fix_agent "general-purpose.yaml" \
  "You handle complex research, multi-domain analysis, ambiguous requests, and tasks requiring broad knowledge across multiple technical areas."

fix_agent "helm-chart-specialist.yaml" \
  "You specialize in Kubernetes Helm chart development, templating, values management, and release coordination for containerized applications."

fix_agent "manager-dashboard-agent.yaml" \
  "You create management dashboards with real-time productivity metrics, team analytics, comprehensive reporting, and actionable insights."

fix_agent "nestjs-backend-expert.yaml" \
  "You are an expert in NestJS framework for Node.js backend development, including dependency injection, decorators, modules, and microservices architecture."

echo ""
echo "All summaries fixed!"
