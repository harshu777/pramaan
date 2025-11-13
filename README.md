# Krida e-Pramaan - IPFS & Blockchain

A secure, decentralized certificate management system for sports achievements that leverages IPFS for storage and blockchain for immutable verification.

## Features

- **Blockchain Anchoring**: Certificate hashes stored on Ethereum/Polygon for immutability
- **IPFS Storage**: Decentralized storage of certificate documents
- **QR Code Generation**: Each certificate gets a unique QR code for easy verification
- **Full-Text Search**: PostgreSQL-based search across certificates
- **Revocation Support**: Ability to revoke certificates with reason tracking
- **Multi-Provider Support**: Works with local IPFS, Pinata, or Web3.Storage
- **Docker Support**: Complete containerized deployment

## Architecture

```
┌─────────────┐     ┌──────────┐     ┌────────────┐
│   Frontend  │────▶│  Backend │────▶│ PostgreSQL │
└─────────────┘     └──────────┘     └────────────┘
                           │
                    ┌──────┴───────┐
                    ▼              ▼
              ┌──────────┐   ┌────────────┐
              │   IPFS   │   │ Blockchain │
              └──────────┘   └────────────┘
```

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository>
cd cert-management-system
npm run setup
```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration
```

### 3. Start Services with Docker

```bash
# Start all services (PostgreSQL, IPFS, pgAdmin)
docker-compose up -d

# Check logs
docker-compose logs -f
```

### 4. Deploy Smart Contract

```bash
# Start local blockchain
npx hardhat node

# In another terminal, deploy contract
npm run deploy:local

# Note the contract address and update backend/.env
```

### 5. Start Backend

```bash
cd backend
npm run dev
```

### 6. Access the Application

- **Frontend**: http://localhost:3000/static/index.html
- **API**: http://localhost:3000
- **pgAdmin**: http://localhost:5050 (admin@cert.com / admin123)
- **IPFS Gateway**: http://localhost:8080
- **IPFS API**: http://localhost:5001

## API Endpoints

### Certificate Operations

#### Issue Certificate
```http
POST /api/certificates/issue
Authorization: Bearer <token>

{
  "issuerDid": "did:example:issuer123",
  "issuerName": "University Name",
  "subjectName": "John Doe",
  "subjectEmail": "john@example.com",
  "certificateType": "degree",
  "expiryDate": "2025-12-31T00:00:00Z",
  "metadata": {}
}
```

#### Verify Certificate
```http
GET /api/certificates/validate/{certHash}
```

#### Search Certificates
```http
GET /api/certificates/search?q=John
```

#### Revoke Certificate
```http
POST /api/certificates/revoke/{certHash}
Authorization: Bearer <token>

{
  "reason": "Certificate issued in error"
}
```

#### Get QR Code
```http
GET /api/certificates/qr/{certHash}
```

### Issuer Operations

#### Register Issuer
```http
POST /api/issuers/register

{
  "did": "did:example:university",
  "name": "University Name",
  "organization": "Education Dept",
  "email": "admin@university.edu",
  "password": "secure_password",
  "walletAddress": "0x..."
}
```

#### Login
```http
POST /api/issuers/login

{
  "did": "did:example:university",
  "password": "secure_password"
}
```

## Testing

### Run Smart Contract Tests
```bash
npm test
```

### Test with Hardhat Console
```bash
npx hardhat console --network localhost

> const Registry = await ethers.getContractFactory("CertificateRegistry")
> const registry = await Registry.attach("CONTRACT_ADDRESS")
> await registry.getTotalCertificates()
```

### Manual Testing Flow

1. **Register an Issuer**
```bash
curl -X POST http://localhost:3000/api/issuers/register \
  -H "Content-Type: application/json" \
  -d '{
    "did": "did:example:test",
    "name": "Test University",
    "email": "test@university.edu",
    "password": "testpass123"
  }'
```

2. **Login to Get Token**
```bash
curl -X POST http://localhost:3000/api/issuers/login \
  -H "Content-Type: application/json" \
  -d '{
    "did": "did:example:test",
    "password": "testpass123"
  }'
```

3. **Issue a Certificate** (requires contract deployment and issuer authorization)
```bash
curl -X POST http://localhost:3000/api/certificates/issue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "issuerDid": "did:example:test",
    "issuerName": "Test University",
    "subjectName": "Jane Smith",
    "certificateType": "degree"
  }'
```

4. **Verify Certificate**
```bash
curl http://localhost:3000/api/certificates/validate/CERT_HASH
```

## Deployment to Testnet

### 1. Configure for Sepolia/Mumbai

Update `.env`:
```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### 2. Deploy Contract

```bash
npm run deploy:testnet
```

### 3. Verify Contract

```bash
npx hardhat verify --network sepolia CONTRACT_ADDRESS
```

## Security Considerations

1. **Private Keys**: Never commit private keys or .env files
2. **PII Protection**: Don't store personal data on-chain
3. **Access Control**: Implement proper authentication for issuers
4. **Key Management**: Use hardware wallets in production
5. **IPFS Pinning**: Ensure certificates are properly pinned
6. **Rate Limiting**: API includes rate limiting by default

## Production Deployment

### Using Docker

```bash
# Build production image
docker build -t cert-system ./backend

# Run with production config
docker run -d \
  -p 3000:3000 \
  --env-file .env.production \
  cert-system
```

### Environment Variables

Required for production:
- `DATABASE_URL`: PostgreSQL connection string
- `CONTRACT_ADDRESS`: Deployed contract address
- `PRIVATE_KEY`: Issuer wallet private key
- `JWT_SECRET`: Strong secret for JWT tokens
- `PINATA_API_KEY` & `PINATA_SECRET_KEY`: For IPFS pinning

## Troubleshooting

### Common Issues

1. **Contract not deploying**: Ensure Hardhat node is running
2. **IPFS upload failing**: Check IPFS node is accessible
3. **Database connection error**: Verify PostgreSQL is running
4. **Authentication failing**: Check JWT token is valid

### Reset Everything

```bash
# Stop all services
docker-compose down -v

# Clean build artifacts
rm -rf artifacts cache
rm -rf backend/dist backend/node_modules

# Reinstall
npm run setup
```

## License

MIT

## Support

For issues and questions, please open an issue in the repository.