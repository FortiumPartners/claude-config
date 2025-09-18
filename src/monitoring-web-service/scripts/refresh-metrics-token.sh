#!/bin/bash

# Refresh Metrics API Token Script
# Updates the token used by hooks to send metrics to the External Metrics Web Service

set -e

# Configuration
API_URL="${METRICS_API_URL:-http://localhost:3002/api/v1}"
TOKEN_FILE="$HOME/.ai-mesh/metrics/.auth-token"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔐 Metrics API Token Refresh Tool"
echo "================================="
echo ""

# Check if backend is running
echo -n "Checking if metrics API is available... "
if curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" | grep -q "200"; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo -e "${YELLOW}Warning: API server may not be running at $API_URL${NC}"
    echo "Start the backend with: PORT=3002 npx tsx src/server-websocket.ts"
    exit 1
fi

# Prompt for credentials or use demo account
echo ""
echo "Choose authentication method:"
echo "1) Use demo account (demo@fortium.com)"
echo "2) Enter custom credentials"
echo -n "Selection (1 or 2): "
read -r choice

if [ "$choice" = "2" ]; then
    echo -n "Email: "
    read -r email
    echo -n "Password: "
    read -r -s password
    echo ""
else
    email="demo@fortium.com"
    password="Demo123!@#"
    echo "Using demo account..."
fi

# Authenticate and get token
echo -n "Authenticating... "
response=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"$email\", \"password\": \"$password\"}" 2>/dev/null)

# Check if authentication was successful
if echo "$response" | grep -q '"success":true'; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "Authentication failed. Response:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    exit 1
fi

# Extract token
TOKEN=$(echo "$response" | jq -r '.data.tokens.accessToken' 2>/dev/null)
REFRESH_TOKEN=$(echo "$response" | jq -r '.data.tokens.refreshToken' 2>/dev/null)

if [ -z "$TOKEN" ]; then
    echo -e "${RED}Error: Could not extract token from response${NC}"
    exit 1
fi

# Calculate expiration (24 hours from now)
if command -v gdate &> /dev/null; then
    # macOS with GNU date installed
    EXPIRES_AT=$(gdate -u -d '+24 hours' '+%Y-%m-%dT%H:%M:%SZ')
elif date --version 2>&1 | grep -q GNU; then
    # Linux with GNU date
    EXPIRES_AT=$(date -u -d '+24 hours' '+%Y-%m-%dT%H:%M:%SZ')
else
    # macOS default date
    EXPIRES_AT=$(date -u -v+24H '+%Y-%m-%dT%H:%M:%SZ')
fi

# Save token to file
echo -n "Saving token... "
mkdir -p "$(dirname "$TOKEN_FILE")"
cat > "$TOKEN_FILE" << EOF
{
  "accessToken": "$TOKEN",
  "refreshToken": "$REFRESH_TOKEN",
  "expiresAt": "$EXPIRES_AT",
  "email": "$email",
  "apiUrl": "$API_URL"
}
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Token successfully refreshed!${NC}"
echo ""
echo "Token details:"
echo "  • User: $email"
echo "  • Valid until: $EXPIRES_AT"
echo "  • Saved to: $TOKEN_FILE"
echo "  • API URL: $API_URL"
echo ""
echo "Your hooks will now automatically use this token when sending metrics."
echo ""
echo "To manually test the token:"
echo "  curl -H \"Authorization: Bearer \$TOKEN\" $API_URL/metrics/dashboard"
echo ""
echo "To refresh again, run: $0"