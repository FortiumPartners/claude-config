#!/bin/bash

# Create Test Activities via API
# This script creates realistic development activities using the REST API

API_BASE="http://localhost:3001/api/v1"

echo "🚀 Creating test activities via API..."

# Test the test endpoint first
echo "🧪 Testing the WebSocket test endpoint..."
curl -X POST "$API_BASE/activities/test" \
  -H "Content-Type: application/json" \
  -w "\nStatus: %{http_code}\n" \
  || echo "❌ Test endpoint failed"

echo -e "\n📊 Creating realistic development activities..."

# Activity 1: File Read
echo "📄 Creating File Read activity..."
curl -X POST "$API_BASE/activities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "actionName": "File Read",
    "actionDescription": "Reading authentication module source code for analysis",
    "targetName": "src/auth/AuthProvider.tsx",
    "status": "success",
    "duration": 120,
    "isAutomated": false,
    "priority": "normal"
  }' \
  -w "\nStatus: %{http_code}\n" \
  && echo "✅ File Read activity created"

# Activity 2: Code Edit
echo -e "\n✏️  Creating Code Edit activity..."
curl -X POST "$API_BASE/activities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "actionName": "Code Edit",
    "actionDescription": "Implementing OAuth2 integration with enhanced error handling",
    "targetName": "src/auth/oauth-provider.ts",
    "status": "success",
    "duration": 2400,
    "isAutomated": false,
    "priority": "high"
  }' \
  -w "\nStatus: %{http_code}\n" \
  && echo "✅ Code Edit activity created"

# Activity 3: Git Commit
echo -e "\n📝 Creating Git Commit activity..."
curl -X POST "$API_BASE/activities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "actionName": "Git Commit",
    "actionDescription": "Committed OAuth integration with conventional commits format",
    "targetName": "feature/oauth-integration",
    "status": "success",
    "duration": 300,
    "isAutomated": true,
    "priority": "normal"
  }' \
  -w "\nStatus: %{http_code}\n" \
  && echo "✅ Git Commit activity created"

# Activity 4: Unit Tests
echo -e "\n🧪 Creating Unit Test activity..."
curl -X POST "$API_BASE/activities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "actionName": "Unit Tests",
    "actionDescription": "Running Jest test suite for authentication modules",
    "targetName": "auth.test.ts",
    "status": "success",
    "duration": 3200,
    "isAutomated": true,
    "priority": "high"
  }' \
  -w "\nStatus: %{http_code}\n" \
  && echo "✅ Unit Test activity created"

# Activity 5: Build Process
echo -e "\n🏗️  Creating Build Process activity..."
curl -X POST "$API_BASE/activities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "actionName": "Build Process",
    "actionDescription": "TypeScript compilation and asset bundling for production",
    "targetName": "Production Build",
    "status": "success",
    "duration": 15000,
    "isAutomated": true,
    "priority": "high"
  }' \
  -w "\nStatus: %{http_code}\n" \
  && echo "✅ Build Process activity created"

# Activity 6: E2E Testing
echo -e "\n🎯 Creating E2E Test activity..."
curl -X POST "$API_BASE/activities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "actionName": "E2E Testing",
    "actionDescription": "Playwright tests for complete user authentication flow",
    "targetName": "auth-flow.spec.ts",
    "status": "success",
    "duration": 18000,
    "isAutomated": true,
    "priority": "critical"
  }' \
  -w "\nStatus: %{http_code}\n" \
  && echo "✅ E2E Test activity created"

# Activity 7: Code Review
echo -e "\n👀 Creating Code Review activity..."
curl -X POST "$API_BASE/activities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "actionName": "Code Review",
    "actionDescription": "Security-focused review of OAuth implementation and RBAC",
    "targetName": "PR #156: Enhanced Authentication System",
    "status": "success",
    "duration": 3600,
    "isAutomated": false,
    "priority": "critical"
  }' \
  -w "\nStatus: %{http_code}\n" \
  && echo "✅ Code Review activity created"

# Activity 8: AI Agent Task
echo -e "\n🤖 Creating AI Agent activity..."
curl -X POST "$API_BASE/activities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "actionName": "AI Agent Task",
    "actionDescription": "Automated React component optimization and refactoring",
    "targetName": "react-component-architect",
    "status": "success",
    "duration": 5500,
    "isAutomated": true,
    "priority": "high"
  }' \
  -w "\nStatus: %{http_code}\n" \
  && echo "✅ AI Agent activity created"

# Activity 9: Database Migration
echo -e "\n🗄️  Creating Database Migration activity..."
curl -X POST "$API_BASE/activities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "actionName": "Database Migration",
    "actionDescription": "Applied schema updates for enhanced user authentication",
    "targetName": "migration_004_auth_enhancements",
    "status": "success",
    "duration": 2800,
    "isAutomated": false,
    "priority": "high"
  }' \
  -w "\nStatus: %{http_code}\n" \
  && echo "✅ Database Migration activity created"

# Activity 10: Error Activity for realism
echo -e "\n❌ Creating Error activity..."
curl -X POST "$API_BASE/activities" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d '{
    "actionName": "API Timeout",
    "actionDescription": "External OAuth provider exceeded timeout limit during integration test",
    "targetName": "OAuth Provider API",
    "status": "error",
    "duration": 30000,
    "isAutomated": false,
    "priority": "high"
  }' \
  -w "\nStatus: %{http_code}\n" \
  && echo "✅ Error activity created"

echo -e "\n📊 Fetching activity summary..."
curl -s "$API_BASE/activities/summary" | jq '.' || echo "Summary endpoint not available"

echo -e "\n🎉 Test activities creation complete!"
echo "🔗 You can now:"
echo "  • View activities: $API_BASE/activities"
echo "  • Open dashboard: http://localhost:3000"