# Certificate Management System - Quick Start Guide

## 🚀 One-Click Local Development Setup

```bash
./deploy.sh
```

That's it! The script will automatically:
- ✅ Check prerequisites
- ✅ Install dependencies
- ✅ Start Docker services (PostgreSQL, IPFS, pgAdmin)
- ✅ Deploy smart contract to local blockchain
- ✅ Start backend server

**Access Points:**
- Frontend: http://localhost:3000/static/index.html
- API: http://localhost:3000
- pgAdmin: http://localhost:5050 (admin@cert.com / admin123)

---

## 📋 Prerequisites

Before running the deployment script, ensure you have:

- ✅ **Node.js 18+** ([Download](https://nodejs.org/))
- ✅ **Docker Desktop** ([Download](https://www.docker.com/products/docker-desktop))
- ✅ **npm** (comes with Node.js)

**Check versions:**
```bash
node --version    # Should be v18 or higher
npm --version     # Should be 8+
docker --version  # Should be 20+
```

---

## 🎯 Common Commands

### Local Development

```bash
# Start everything (first time)
./deploy.sh

# Stop all services
./deploy.sh stop

# Restart all services
./deploy.sh restart

# Clean everything and start fresh
./deploy.sh clean

# View backend logs
tail -f backend.log

# View blockchain logs
tail -f hardhat-node.log
```

### Testing the API

```bash
# Health check
curl http://localhost:3000/health

# Register an issuer
curl -X POST http://localhost:3000/api/issuers/register \
  -H "Content-Type: application/json" \
  -d '{
    "did": "did:example:test",
    "name": "Test University",
    "email": "test@university.edu",
    "password": "testpass123",
    "walletAddress": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  }'

# Login
curl -X POST http://localhost:3000/api/issuers/login \
  -H "Content-Type: application/json" \
  -d '{
    "did": "did:example:test",
    "password": "testpass123"
  }'

# Issue a certificate (use token from login)
curl -X POST http://localhost:3000/api/certificates/issue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "issuerDid": "did:example:test",
    "issuerName": "Test University",
    "subjectName": "John Doe",
    "subjectEmail": "john@example.com",
    "certificateType": "degree"
  }'
```

---

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 PID

# Or just restart
./deploy.sh restart
```

### Docker Issues

```bash
# Restart Docker Desktop
# Then run:
docker-compose down -v
./deploy.sh
```

### Database Connection Error

```bash
# Check PostgreSQL container
docker ps | grep postgres

# Restart database
docker-compose restart postgres

# Check logs
docker logs cert_postgres
```

### IPFS Upload Failing

```bash
# Check IPFS container
docker ps | grep ipfs

# Test IPFS API
curl http://localhost:5001/api/v0/version

# Restart IPFS
docker-compose restart ipfs
```

---

## 📁 Project Structure

```
cert-management-system/
├── deploy.sh                    # Local development deployment
├── deploy-production.sh         # Production deployment
├── DEPLOYMENT.md               # Full deployment guide
├── docker-compose.yml          # Docker services configuration
├── package.json                # Root dependencies
├── hardhat.config.ts           # Blockchain configuration
│
├── contracts/                  # Smart contracts
│   └── CertificateRegistry.sol
│
├── scripts/                    # Deployment scripts
│   ├── deploy.ts
│   └── authorize-issuer.ts
│
├── database/                   # Database schemas
│   └── init.sql
│
└── backend/                    # Backend application
    ├── src/
    │   ├── server.ts          # Main entry point
    │   ├── routes/            # API routes
    │   ├── services/          # Business logic
    │   ├── middleware/        # Express middleware
    │   └── config/            # Configuration
    ├── public/                # Frontend files
    ├── .env                   # Environment variables
    └── package.json           # Backend dependencies
```

---

## 🌐 Production Deployment

### Quick Production Setup

```bash
# 1. Create production environment file
cp backend/.env.example backend/.env.production
nano backend/.env.production

# 2. Deploy contract to testnet
./deploy-production.sh deploy-contract sepolia

# 3. Build for production
./deploy-production.sh build

# 4. Generate systemd service
./deploy-production.sh systemd

# 5. Install and start service
sudo cp cert-management.service /etc/systemd/system/
sudo systemctl enable cert-management
sudo systemctl start cert-management
```

**See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete production guide.**

---

## 📊 Database Access

### Via pgAdmin (GUI)

1. Open http://localhost:5050
2. Login: admin@cert.com / admin123
3. Add server:
   - Name: Local PostgreSQL
   - Host: postgres (or localhost)
   - Port: 5432
   - Database: certificate_db
   - Username: certadmin
   - Password: certpass123

### Via Command Line

```bash
# Connect to database
docker exec -it cert_postgres psql -U certadmin -d certificate_db

# Common queries
SELECT * FROM certificates LIMIT 10;
SELECT * FROM issuers;
SELECT status, COUNT(*) FROM certificates GROUP BY status;
```

---

## 🔐 Default Credentials

### Hardhat Test Account
```
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### PostgreSQL
```
Host: localhost
Port: 5432
Database: certificate_db
Username: certadmin
Password: certpass123
```

### pgAdmin
```
URL: http://localhost:5050
Email: admin@cert.com
Password: admin123
```

---

## 📚 API Documentation

### Issuer Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/issuers/register` | Register new issuer |
| POST | `/api/issuers/login` | Login and get JWT token |
| GET | `/api/issuers/me` | Get current issuer info |
| GET | `/api/issuers` | List all issuers |

### Certificate Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/certificates/issue` | Issue new certificate |
| GET | `/api/certificates/validate/:hash` | Validate certificate |
| POST | `/api/certificates/revoke/:hash` | Revoke certificate |
| GET | `/api/certificates/search` | Search certificates |
| GET | `/api/certificates/qr/:hash` | Get QR code |
| GET | `/api/certificates/:hash` | Get certificate details |

### Bulk Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bulk/upload` | Bulk upload via Excel |
| POST | `/api/bulk/issue` | Bulk issue certificates |
| GET | `/api/bulk/status/:batchId` | Check batch status |

---

## 🎨 Frontend URLs

- **Home Page**: http://localhost:3000/static/index.html
- **Issue Certificate**: http://localhost:3000/static/issue.html
- **Verify Certificate**: http://localhost:3000/static/verify.html
- **Search**: http://localhost:3000/static/search.html
- **Bulk Upload**: http://localhost:3000/static/bulk.html

---

## 💡 Tips & Tricks

### Faster Development

```bash
# Watch backend changes (auto-reload)
cd backend
npm run dev

# Watch smart contract changes
npx hardhat watch compilation
```

### Testing Smart Contracts

```bash
# Run tests
npm test

# Get test coverage
npm run coverage

# Interactive console
npx hardhat console --network localhost
```

### Database Migrations

```bash
# Backup database
docker exec cert_postgres pg_dump -U certadmin certificate_db > backup.sql

# Restore database
cat backup.sql | docker exec -i cert_postgres psql -U certadmin certificate_db

# Reset database
docker-compose down -v
docker-compose up -d
```

### IPFS Management

```bash
# List pinned files
curl http://localhost:5001/api/v0/pin/ls

# Unpin file
curl -X POST "http://localhost:5001/api/v0/pin/rm?arg=QmHash..."

# Check node status
curl http://localhost:5001/api/v0/stats/bw
```

---

## 🆘 Getting Help

1. **Check Logs**
   ```bash
   tail -f backend.log
   docker-compose logs -f
   ```

2. **Common Issues**: See [Troubleshooting](#troubleshooting) above

3. **Full Documentation**: See [DEPLOYMENT.md](./DEPLOYMENT.md)

4. **GitHub Issues**: Report bugs or request features

---

## 🎯 Next Steps

After successful deployment:

1. ✅ **Test the API** - Try issuing and verifying certificates
2. ✅ **Configure IPFS** - Set up Pinata for production
3. ✅ **Deploy to Testnet** - Deploy contract to Sepolia
4. ✅ **Setup Email** - Configure email notifications
5. ✅ **Customize Frontend** - Modify HTML/CSS to match branding

---

## 📖 Additional Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [IPFS Documentation](https://docs.ipfs.tech/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Express.js Documentation](https://expressjs.com/)

---

## License

MIT License - See LICENSE file for details
