#!/bin/bash

# Get admin token
TOKEN=$(curl -s -X POST http://localhost:3000/api/issuers/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Checking pending certificate requests..."
PENDING_REQUESTS=$(curl -s "http://localhost:3000/api/admin/certificate-requests?status=pending" \
  -H "Authorization: Bearer $TOKEN")

echo "$PENDING_REQUESTS" | grep -o '"count":[0-9]*'
echo ""

echo "Checking pending appeals..."
PENDING_APPEALS=$(curl -s "http://localhost:3000/api/admin/appeals?status=pending" \
  -H "Authorization: Bearer $TOKEN")

echo "$PENDING_APPEALS" | grep -o '"count":[0-9]*'
