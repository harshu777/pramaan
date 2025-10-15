#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Logging in as admin...${NC}"

# Login as admin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/issuers/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}❌ Failed to login as admin${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Admin logged in successfully${NC}\n"

# Get all pending certificate requests
echo -e "${BLUE}📋 Fetching pending certificate requests...${NC}"

REQUESTS=$(curl -s -X GET "http://localhost:3000/api/admin/certificate-requests?status=pending" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

echo "$REQUESTS"

# Extract request IDs (using grep and cut instead of jq)
REQUEST_IDS=$(echo "$REQUESTS" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ -z "$REQUEST_IDS" ]; then
  echo -e "${RED}❌ No pending requests found${NC}"
  exit 1
fi

echo -e "\n${BLUE}📝 Approving and generating certificates...${NC}\n"

# Loop through each request and approve
for REQUEST_ID in $REQUEST_IDS; do
  echo -e "${BLUE}Processing request: $REQUEST_ID${NC}"

  RESULT=$(curl -s -X POST "http://localhost:3000/api/admin/approve-request/$REQUEST_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d '{
      "adminNotes": "Demo certificate approved automatically"
    }')

  SUCCESS=$(echo "$RESULT" | grep -o '"success":[^,]*' | cut -d':' -f2)
  CERT_HASH=$(echo "$RESULT" | grep -o '"certificateHash":"[^"]*' | cut -d'"' -f4)

  if [ "$SUCCESS" = "true" ]; then
    echo -e "${GREEN}✅ Certificate generated: ${CERT_HASH:0:16}...${NC}"
    echo -e "${GREEN}   🔗 Verify at: http://localhost:3000/static/validation.html?hash=$CERT_HASH${NC}\n"
  else
    MESSAGE=$(echo "$RESULT" | grep -o '"message":"[^"]*' | cut -d'"' -f4)
    echo -e "${RED}❌ Failed: $MESSAGE${NC}\n"
  fi
done

echo -e "\n${GREEN}🎉 All certificates generated successfully!${NC}"
echo -e "\n${BLUE}📧 Login credentials for athlete:${NC}"
echo -e "   Email: ninad@hostingduty.com"
echo -e "   Password: password123"
echo -e "\n${BLUE}🔍 View certificates at:${NC}"
echo -e "   http://localhost:3000/static/athlete-dashboard.html"
