#!/bin/bash

echo "Certificate Management System - Demo"
echo "====================================="
echo ""

# Login to get JWT token
echo "1. Logging in as issuer..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/issuers/login \
  -H "Content-Type: application/json" \
  -d '{"did":"did:example:testuser","password":"testpass123"}')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
  echo "Failed to login. Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✓ Login successful!"
echo ""

# Issue a certificate
echo "2. Issuing a certificate..."
CERT_RESPONSE=$(curl -s -X POST http://localhost:3000/api/certificates/issue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "issuerDid": "did:example:testuser",
    "issuerName": "Test University",
    "subjectDid": "did:example:student123",
    "subjectName": "Alice Johnson",
    "subjectEmail": "alice@example.com",
    "certificateType": "degree",
    "metadata": {
      "degree": "Bachelor of Science",
      "major": "Computer Science",
      "graduationDate": "2024-06-15"
    }
  }')

CERT_HASH=$(echo $CERT_RESPONSE | grep -o '"certHash":"[^"]*' | sed 's/"certHash":"//')

if [ -z "$CERT_HASH" ]; then
  echo "Failed to issue certificate. Response: $CERT_RESPONSE"
  exit 1
fi

echo "✓ Certificate issued successfully!"
echo "  Certificate Hash: $CERT_HASH"
echo ""

# Verify the certificate
echo "3. Verifying the certificate..."
VERIFY_RESPONSE=$(curl -s http://localhost:3000/api/certificates/validate/$CERT_HASH)

IS_VALID=$(echo $VERIFY_RESPONSE | grep -o '"isValid":[^,]*' | sed 's/"isValid"://')

if [ "$IS_VALID" = "true" ]; then
  echo "✓ Certificate is VALID!"
else
  echo "✗ Certificate validation failed"
fi

echo ""
echo "4. Certificate details:"
echo "$VERIFY_RESPONSE" | python3 -m json.tool | head -20

echo ""
echo "5. Access the web interface at:"
echo "   http://localhost:3000/static/index.html"
echo ""
echo "6. Verify certificate at:"
echo "   http://localhost:3000/api/certificates/verify/$CERT_HASH"