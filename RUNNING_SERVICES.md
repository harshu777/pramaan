# Pramaan Certificate Management System - Service Status

## ✅ All Services Running on pramaan.0-4.nl

### 1. Hardhat Blockchain Node
- **Status:** Running (PID: 15497)
- **Port:** 8545
- **RPC:** http://127.0.0.1:8545
- **Contract Address:** 0x5FbDB2315678afecb367f032d93F642f64180aa3
- **Log File:** /root/pramaan/hardhat-node.log
- **PID File:** /root/pramaan/.hardhat.pid

### 2. Backend Server
- **Status:** Running (PID: 17140)
- **Port:** 3000
- **Environment:** Development
- **Database:** SQLite (/root/pramaan/backend/certificates.db)
- **IPFS:** Mock storage (development mode)
- **Log File:** /root/pramaan/backend.log
- **PID File:** /root/pramaan/.backend.pid

### 3. Nginx Reverse Proxy
- **Status:** Active
- **Domain:** pramaan.0-4.nl
- **Config:** /etc/nginx/sites-available/pramaan
- **Max Upload:** 50MB

## 🌐 Access URLs

- **Application:** http://pramaan.0-4.nl
- **Health Check:** http://pramaan.0-4.nl/health
- **API Base:** http://pramaan.0-4.nl/api/

## 🔑 Configuration

### Environment Variables (backend/.env)
- BLOCKCHAIN_RPC=http://127.0.0.1:8545
- CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
- PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
- PORT=3000

### Wallet Information
- **Deployer Address:** 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
- **Network:** Local Hardhat (Chain ID: 31337)

## 📊 Service Management

### Stop Services
```bash
# Stop Hardhat
kill $(cat /root/pramaan/.hardhat.pid)

# Stop Backend
kill $(cat /root/pramaan/.backend.pid)

# Stop Nginx
systemctl stop nginx
```

### Restart Services
```bash
# Restart Hardhat
cd /root/pramaan
npx hardhat node > hardhat-node.log 2>&1 &
echo $! > .hardhat.pid

# Redeploy Contracts
npx hardhat run scripts/deploy.ts --network localhost

# Restart Backend
cd /root/pramaan/backend
npm run dev > ../backend.log 2>&1 &
echo $! > ../.backend.pid

# Reload Nginx
systemctl reload nginx
```

### View Logs
```bash
# Hardhat logs
tail -f /root/pramaan/hardhat-node.log

# Backend logs
tail -f /root/pramaan/backend.log

# Nginx logs
tail -f /var/log/nginx/pramaan_access.log
tail -f /var/log/nginx/pramaan_error.log
```

## 🔍 Health Check
```bash
curl http://pramaan.0-4.nl/health
```

Expected response:
```json
{"status":"healthy","timestamp":"2025-10-05T16:31:58.210Z"}
```

---
*Last Updated: 2025-10-05*
