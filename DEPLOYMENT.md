# Certificate Management System - Deployment Guide

Complete guide for deploying the Certificate Management System in various environments.

## Table of Contents

1. [Local Development Deployment](#local-development-deployment)
2. [Production Deployment](#production-deployment)
3. [Docker Deployment](#docker-deployment)
4. [Cloud Deployment](#cloud-deployment)
5. [Troubleshooting](#troubleshooting)

---

## Local Development Deployment

### Quick Start (One-Click Setup)

```bash
# Make script executable (first time only)
chmod +x deploy.sh

# Deploy everything with one command
./deploy.sh
```

This will:
- ✅ Check prerequisites (Node.js, Docker, npm)
- ✅ Install all dependencies
- ✅ Start PostgreSQL, IPFS, and pgAdmin via Docker
- ✅ Compile and deploy smart contracts to local blockchain
- ✅ Build and start backend server
- ✅ Display all access points and credentials

### Manual Commands

```bash
# Stop all services
./deploy.sh stop

# Restart all services
./deploy.sh restart

# Clean all data and start fresh
./deploy.sh clean
```

### Access Points After Deployment

| Service | URL | Credentials |
|---------|-----|-------------|
| Backend API | http://localhost:3000 | - |
| Frontend | http://localhost:3000/static/index.html | - |
| pgAdmin | http://localhost:5050 | admin@cert.com / admin123 |
| IPFS Gateway | http://localhost:8080 | - |
| IPFS API | http://localhost:5001 | - |
| Blockchain RPC | http://localhost:8545 | - |

### Default Test Account

```
Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

---

## Production Deployment

### Prerequisites

- Ubuntu 20.04+ or similar Linux distribution
- Node.js 18+
- PostgreSQL 13+
- Nginx
- Domain name with DNS configured
- SSL certificate (Let's Encrypt recommended)

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2: Database Setup

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE certificate_db;
CREATE USER certadmin WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE certificate_db TO certadmin;
\c certificate_db
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
\q
```

```bash
# Run initialization script
sudo -u postgres psql -d certificate_db -f database/init.sql
```

### Step 3: Clone and Configure

```bash
# Clone repository
git clone <your-repo-url>
cd cert-management-system

# Install dependencies
npm ci --production
cd backend && npm ci --production && cd ..
```

### Step 4: Environment Configuration

```bash
# Create production environment file
cp backend/.env.example backend/.env.production

# Edit with production values
nano backend/.env.production
```

**Required production environment variables:**

```env
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://certadmin:your_secure_password@localhost:5432/certificate_db

# Blockchain
BLOCKCHAIN_RPC=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=your_wallet_private_key_without_0x_prefix
CONTRACT_ADDRESS=your_deployed_contract_address

# IPFS - Pinata (recommended for production)
IPFS_SERVICE=pinata
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key

# Security
JWT_SECRET=your_strong_random_secret_min_32_chars
QR_BASE_URL=https://your-domain.com

# Email (optional)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your_app_password
EMAIL_FROM="Cert System" <noreply@your-domain.com>

# Features
ENABLE_BLOCKCHAIN=true
ENABLE_EMAIL_NOTIFICATIONS=true
LOG_LEVEL=info
```

### Step 5: Deploy Smart Contract

```bash
# Configure network RPC in root .env
nano .env
```

Add:
```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

```bash
# Use production deployment script
./deploy-production.sh deploy-contract sepolia
```

Copy the contract address and update `CONTRACT_ADDRESS` in `backend/.env.production`.

### Step 6: Build Application

```bash
# Build everything
./deploy-production.sh build
```

### Step 7: Setup Systemd Service

```bash
# Generate service file
./deploy-production.sh systemd

# Install service
sudo cp cert-management.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cert-management
sudo systemctl start cert-management

# Check status
sudo systemctl status cert-management

# View logs
sudo journalctl -u cert-management -f
```

### Step 8: Configure Nginx

```bash
# Generate Nginx config
./deploy-production.sh nginx

# Edit and customize
nano nginx.conf

# Update domain name and paths
sed -i 's/your-domain.com/actual-domain.com/g' nginx.conf

# Copy to Nginx sites
sudo cp nginx.conf /etc/nginx/sites-available/cert-management
sudo ln -s /etc/nginx/sites-available/cert-management /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Reload Nginx
sudo systemctl reload nginx
```

### Step 9: Firewall Configuration

```bash
# Allow necessary ports
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Step 10: Verify Deployment

```bash
# Test API
curl https://your-domain.com/health

# Check SSL
curl -I https://your-domain.com
```

---

## Docker Deployment

### Development with Docker Compose

Already configured! Just run:

```bash
./deploy.sh
```

### Production Docker Deployment

#### Option 1: Backend Only

```bash
# Build production image
./deploy-production.sh docker

# Run container
docker run -d \
  --name cert-backend \
  --restart always \
  -p 3000:3000 \
  --env-file backend/.env.production \
  cert-management-backend:latest

# View logs
docker logs -f cert-backend
```

#### Option 2: Full Stack Docker Compose

Create `docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: certadmin
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
      POSTGRES_DB: certificate_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    secrets:
      - db_password
    networks:
      - cert_network
    restart: always

  backend:
    image: cert-management-backend:latest
    env_file:
      - backend/.env.production
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    networks:
      - cert_network
    restart: always

volumes:
  postgres_data:

networks:
  cert_network:

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

Deploy:

```bash
docker-compose -f docker-compose.production.yml up -d
```

---

## Cloud Deployment

### AWS Deployment

#### Using EC2

1. **Launch EC2 Instance**
   - AMI: Ubuntu 20.04 LTS
   - Instance Type: t3.medium (minimum)
   - Security Group: Allow 80, 443, SSH

2. **Connect and Deploy**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   # Follow production deployment steps above
   ```

3. **Use RDS for Database**
   - Create PostgreSQL RDS instance
   - Update `DATABASE_URL` in `.env.production`

4. **Use CloudWatch for Logging**
   - Install CloudWatch agent
   - Configure log streaming

#### Using ECS/Fargate

1. **Build and Push Image**
   ```bash
   # Authenticate to ECR
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin YOUR_ECR_URL

   # Build and tag
   docker build -t cert-backend:latest ./backend
   docker tag cert-backend:latest YOUR_ECR_URL/cert-backend:latest

   # Push
   docker push YOUR_ECR_URL/cert-backend:latest
   ```

2. **Create ECS Task Definition**
   - Use image from ECR
   - Configure environment variables from Secrets Manager
   - Set up RDS connection

3. **Deploy Service**
   - Create ECS Service
   - Configure Application Load Balancer
   - Set up auto-scaling

### Google Cloud Platform

#### Using Compute Engine

Follow similar steps as EC2 deployment.

#### Using Cloud Run

```bash
# Build and submit
gcloud builds submit --tag gcr.io/PROJECT_ID/cert-backend

# Deploy
gcloud run deploy cert-backend \
  --image gcr.io/PROJECT_ID/cert-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production
```

### DigitalOcean

#### Using Droplets

1. Create Ubuntu droplet (minimum 2GB RAM)
2. Follow production deployment steps
3. Configure firewall via DigitalOcean console

#### Using App Platform

```yaml
# app.yaml
name: cert-management
services:
  - name: backend
    github:
      repo: your-username/cert-management-system
      branch: main
      deploy_on_push: true
    dockerfile_path: backend/Dockerfile
    envs:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        type: SECRET
      - key: JWT_SECRET
        type: SECRET
    http_port: 3000

databases:
  - name: cert-db
    engine: PG
    version: "15"
```

Deploy:
```bash
doctl apps create --spec app.yaml
```

---

## Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (EKS, GKE, or AKS)
- kubectl configured
- Helm 3+ (optional)

### Deployment Files

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cert-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cert-backend
  template:
    metadata:
      labels:
        app: cert-backend
    spec:
      containers:
      - name: backend
        image: your-registry/cert-backend:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: cert-secrets
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: cert-backend-service
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: cert-backend
```

Create secrets:
```bash
kubectl create secret generic cert-secrets \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=JWT_SECRET='...' \
  --from-literal=CONTRACT_ADDRESS='...'
```

Deploy:
```bash
kubectl apply -f k8s/
```

---

## Monitoring and Logging

### Using PM2 (Alternative to systemd)

```bash
# Install PM2
npm install -g pm2

# Start application
cd backend
pm2 start dist/server.js --name cert-backend

# Save configuration
pm2 save
pm2 startup

# Monitor
pm2 monit

# View logs
pm2 logs cert-backend
```

### Logging Best Practices

The application uses Winston for logging. Logs are written to:
- `backend/combined.log` - All logs
- `backend/error.log` - Errors only
- Console output

Configure log rotation:

```bash
# Install logrotate config
sudo nano /etc/logrotate.d/cert-management
```

Add:
```
/path/to/cert-management-system/backend/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload cert-management
    endscript
}
```

---

## Backup and Recovery

### Database Backup

```bash
# Automated daily backup
cat > /etc/cron.daily/cert-db-backup <<'EOF'
#!/bin/bash
BACKUP_DIR=/var/backups/cert-management
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
pg_dump -U certadmin certificate_db | gzip > $BACKUP_DIR/cert_db_$DATE.sql.gz
find $BACKUP_DIR -name "cert_db_*.sql.gz" -mtime +30 -delete
EOF

chmod +x /etc/cron.daily/cert-db-backup
```

### IPFS Backup

```bash
# List all pinned CIDs
curl -X POST http://localhost:5001/api/v0/pin/ls > pinned_cids.json

# Backup pinned content
for cid in $(cat pinned_cids.json | jq -r '.Keys | keys[]'); do
    ipfs get $cid -o /backup/ipfs/$cid
done
```

### Restore Procedure

```bash
# Restore database
gunzip -c backup.sql.gz | psql -U certadmin certificate_db

# Re-pin IPFS content
for file in /backup/ipfs/*; do
    ipfs add -r $file
done
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -U certadmin -d certificate_db -h localhost

# Check logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

#### 2. Smart Contract Issues

```bash
# Verify contract is deployed
cast code $CONTRACT_ADDRESS --rpc-url $RPC_URL

# Check account balance
cast balance $WALLET_ADDRESS --rpc-url $RPC_URL

# Test contract call
cast call $CONTRACT_ADDRESS "getTotalCertificates()" --rpc-url $RPC_URL
```

#### 3. IPFS Upload Failing

```bash
# Test IPFS connection
curl http://localhost:5001/api/v0/version

# Check Pinata credentials
curl -X GET https://api.pinata.cloud/data/testAuthentication \
  -H "pinata_api_key: $PINATA_API_KEY" \
  -H "pinata_secret_api_key: $PINATA_SECRET_KEY"
```

#### 4. Backend Not Starting

```bash
# Check logs
tail -f backend.log
# or
sudo journalctl -u cert-management -f

# Check port availability
sudo lsof -i :3000

# Test manually
cd backend
NODE_ENV=production node dist/server.js
```

#### 5. High Memory Usage

```bash
# Check process memory
ps aux | grep node

# Restart service
sudo systemctl restart cert-management

# Consider increasing VM size or adding swap
```

### Performance Optimization

1. **Database Indexing**: Already configured in `database/init.sql`
2. **Caching**: Implement Redis for API responses
3. **Load Balancing**: Use Nginx upstream for multiple backend instances
4. **CDN**: Serve static assets via CloudFlare or AWS CloudFront

### Security Hardening

```bash
# Update Node.js packages
npm audit fix

# Enable fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban

# Configure firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Set up automatic security updates
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Support

For issues:
1. Check logs: `tail -f backend.log`
2. Review this troubleshooting guide
3. Check GitHub issues
4. Contact support team

## License

MIT
