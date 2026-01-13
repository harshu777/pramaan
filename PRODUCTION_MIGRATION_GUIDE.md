# Pramaan Production Migration Guide

## Server Architecture

| Role | Primary IP | Secondary IP | Purpose |
|------|-----------|--------------|---------|
| APP | 10.48.238.206 | 10.48.238.207 | Node.js backend + Frontend static files |
| DB | 10.48.239.8 | 10.48.239.9 | PostgreSQL (Primary + Replica) |
| Blockchain | 10.48.238.203 | 10.48.238.204 | Hardhat/Ethereum nodes |

---

## PHASE 1: Frontend Deployment (APP Servers)

### Step 1.1: Prepare APP Server 1 (10.48.238.206)

```bash
# SSH into APP Server 1
ssh root@10.48.238.206

# Update system packages
apt update && apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify installation
node --version  # Should be v18.x
npm --version

# Install PM2 for process management
npm install -g pm2

# Install nginx for reverse proxy
apt install -y nginx

# Create application directory
mkdir -p /var/www/pramaan
```

### Step 1.2: Deploy Frontend Files to APP Server 1

**From your staging server (current server):**

```bash
# On staging server - Package frontend files
cd /root/pramaan/backend
tar -czvf frontend.tar.gz public/

# Transfer to APP Server 1
scp frontend.tar.gz root@10.48.238.206:/var/www/pramaan/
```

**On APP Server 1 (10.48.238.206):**

```bash
# Extract frontend files
cd /var/www/pramaan
tar -xzvf frontend.tar.gz
mv public/* .
rm -rf public frontend.tar.gz

# Set proper permissions
chown -R www-data:www-data /var/www/pramaan
chmod -R 755 /var/www/pramaan
```

### Step 1.3: Configure Nginx on APP Server 1 (10.48.238.206)

```bash
# Create nginx configuration
cat > /etc/nginx/sites-available/pramaan << 'EOF'
server {
    listen 80;
    server_name _;  # Replace with your domain

    root /var/www/pramaan;
    index landing.html index.html;

    # Frontend static files
    location / {
        try_files $uri $uri/ /landing.html;
    }

    # API proxy (will be enabled in Phase 3)
    # location /api {
    #     proxy_pass http://127.0.0.1:3000;
    #     proxy_http_version 1.1;
    #     proxy_set_header Upgrade $http_upgrade;
    #     proxy_set_header Connection 'upgrade';
    #     proxy_set_header Host $host;
    #     proxy_set_header X-Real-IP $remote_addr;
    #     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #     proxy_set_header X-Forwarded-Proto $scheme;
    #     proxy_cache_bypass $http_upgrade;
    # }

    # Health check endpoint
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/pramaan /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and restart nginx
nginx -t
systemctl restart nginx
systemctl enable nginx
```

### Step 1.4: Replicate to APP Server 2 (10.48.238.207)

```bash
# SSH into APP Server 2
ssh root@10.48.238.207

# Run the same commands as Step 1.1
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs nginx
npm install -g pm2
mkdir -p /var/www/pramaan
```

**From staging server:**

```bash
# Transfer to APP Server 2
scp /root/pramaan/backend/frontend.tar.gz root@10.48.238.207:/var/www/pramaan/
```

**On APP Server 2 (10.48.238.207):**

```bash
cd /var/www/pramaan
tar -xzvf frontend.tar.gz
mv public/* .
rm -rf public frontend.tar.gz
chown -R www-data:www-data /var/www/pramaan
chmod -R 755 /var/www/pramaan

# Copy nginx config from APP Server 1
scp root@10.48.238.206:/etc/nginx/sites-available/pramaan /etc/nginx/sites-available/
ln -sf /etc/nginx/sites-available/pramaan /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
systemctl enable nginx
```

### Step 1.5: Verify Frontend Deployment

```bash
# Test from each server
curl http://10.48.238.206/
curl http://10.48.238.207/
```

---

## PHASE 2: Database Server Setup (PostgreSQL)

### Step 2.1: Setup Primary DB Server (10.48.239.8)

```bash
# SSH into DB Server 1 (Primary)
ssh root@10.48.239.8

# Update system
apt update && apt upgrade -y

# Install PostgreSQL 15
apt install -y postgresql-15 postgresql-contrib-15

# Verify installation
systemctl status postgresql
psql --version
```

### Step 2.2: Configure PostgreSQL on Primary (10.48.239.8)

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user (run in psql)
CREATE DATABASE pramaan_db;
CREATE USER pramaan_user WITH ENCRYPTED PASSWORD 'YourSecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE pramaan_db TO pramaan_user;
ALTER DATABASE pramaan_db OWNER TO pramaan_user;

-- Grant schema privileges
\c pramaan_db
GRANT ALL ON SCHEMA public TO pramaan_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO pramaan_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO pramaan_user;

\q
```

### Step 2.3: Configure PostgreSQL for Remote Connections (10.48.239.8)

```bash
# Edit postgresql.conf
nano /etc/postgresql/15/main/postgresql.conf

# Find and modify these lines:
# listen_addresses = 'localhost'  -> listen_addresses = '*'
# port = 5432                     -> port = 5432 (keep as is)

# Edit pg_hba.conf to allow connections from APP servers
nano /etc/postgresql/15/main/pg_hba.conf

# Add these lines at the end:
# TYPE  DATABASE        USER            ADDRESS                 METHOD
host    pramaan_db      pramaan_user    10.48.238.206/32        scram-sha-256
host    pramaan_db      pramaan_user    10.48.238.207/32        scram-sha-256
host    pramaan_db      pramaan_user    10.48.239.9/32          scram-sha-256
host    replication     replicator      10.48.239.9/32          scram-sha-256

# Restart PostgreSQL
systemctl restart postgresql
systemctl enable postgresql

# Configure firewall (if ufw is enabled)
ufw allow from 10.48.238.206 to any port 5432
ufw allow from 10.48.238.207 to any port 5432
ufw allow from 10.48.239.9 to any port 5432
```

### Step 2.4: Create Database Schema on Primary (10.48.239.8)

**From staging server, copy schema file:**

```bash
# On staging server
scp /root/pramaan/backend/scripts/postgres-schema.sql root@10.48.239.8:/tmp/
```

**On DB Server 1 (10.48.239.8):**

```bash
# Apply the schema
sudo -u postgres psql -d pramaan_db -f /tmp/postgres-schema.sql

# Verify tables were created
sudo -u postgres psql -d pramaan_db -c "\dt"
```

### Step 2.5: Setup Replica DB Server (10.48.239.9) - Optional for HA

```bash
# SSH into DB Server 2 (Replica)
ssh root@10.48.239.9

# Install PostgreSQL
apt update && apt upgrade -y
apt install -y postgresql-15 postgresql-contrib-15

# Stop PostgreSQL on replica
systemctl stop postgresql
```

**On Primary (10.48.239.8) - Create replication user:**

```bash
sudo -u postgres psql

CREATE ROLE replicator WITH REPLICATION LOGIN ENCRYPTED PASSWORD 'ReplicaPassword123!';
\q
```

**On Replica (10.48.239.9) - Setup streaming replication:**

```bash
# Remove default data directory
rm -rf /var/lib/postgresql/15/main/*

# Take base backup from primary
sudo -u postgres pg_basebackup -h 10.48.239.8 -D /var/lib/postgresql/15/main -U replicator -P -R

# The -R flag creates standby.signal and configures recovery

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Verify replication status
sudo -u postgres psql -c "SELECT * FROM pg_stat_wal_receiver;"
```

---

## PHASE 3: SQLite to PostgreSQL Migration

### Step 3.1: Prepare Migration on Staging Server

```bash
# On staging server
cd /root/pramaan/backend

# Install PostgreSQL client (for testing connection)
apt install -y postgresql-client

# Test connection to new PostgreSQL server
psql -h 10.48.239.8 -U pramaan_user -d pramaan_db -c "SELECT 1;"
# Enter password when prompted
```

### Step 3.2: Update Backend Configuration

Create production environment file:

```bash
# On staging server
cat > /root/pramaan/backend/.env.production << 'EOF'
# Server Configuration
NODE_ENV=production
PORT=3000

# Database Configuration - PostgreSQL
DB_TYPE=postgres
DATABASE_URL=postgresql://pramaan_user:YourSecurePassword123!@10.48.239.8:5432/pramaan_db

# Blockchain Configuration (will be updated in Phase 4)
BLOCKCHAIN_RPC=http://10.48.238.203:8545
CONTRACT_ADDRESS=0x_YOUR_CONTRACT_ADDRESS_HERE
PRIVATE_KEY=0x_YOUR_PRIVATE_KEY_HERE

# IPFS Configuration
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs

# JWT Configuration
JWT_SECRET=your-super-secure-production-jwt-secret-change-this
JWT_EXPIRY=7d

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=your-app-password
EMAIL_FROM="Pramaan Certificate System"

# Feature Flags
ENABLE_BLOCKCHAIN=true
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_BULK_UPLOAD=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
```

### Step 3.3: Run SQLite to PostgreSQL Migration

```bash
# On staging server
cd /root/pramaan/backend

# Install dependencies if not already installed
npm install

# First, do a dry run to validate
npx ts-node scripts/migrate-to-postgres.ts --dry-run

# If dry run succeeds, run actual migration
npx ts-node scripts/migrate-to-postgres.ts

# Verify migration on PostgreSQL
psql -h 10.48.239.8 -U pramaan_user -d pramaan_db -c "SELECT COUNT(*) FROM certificates;"
psql -h 10.48.239.8 -U pramaan_user -d pramaan_db -c "SELECT COUNT(*) FROM athletes;"
psql -h 10.48.239.8 -U pramaan_user -d pramaan_db -c "SELECT COUNT(*) FROM issuers;"
```

### Step 3.4: Manual Migration (Alternative Method)

If the migration script has issues, use this manual approach:

```bash
# On staging server - Export from SQLite
cd /root/pramaan/backend

# Create export directory
mkdir -p /tmp/sqlite_export

# Export each table to CSV
sqlite3 -header -csv certificates.db "SELECT * FROM certificates;" > /tmp/sqlite_export/certificates.csv
sqlite3 -header -csv certificates.db "SELECT * FROM athletes;" > /tmp/sqlite_export/athletes.csv
sqlite3 -header -csv certificates.db "SELECT * FROM issuers;" > /tmp/sqlite_export/issuers.csv
sqlite3 -header -csv certificates.db "SELECT * FROM athlete_competitions;" > /tmp/sqlite_export/athlete_competitions.csv
sqlite3 -header -csv certificates.db "SELECT * FROM certificate_assignments;" > /tmp/sqlite_export/certificate_assignments.csv
sqlite3 -header -csv certificates.db "SELECT * FROM cancellation_logs;" > /tmp/sqlite_export/cancellation_logs.csv
sqlite3 -header -csv certificates.db "SELECT * FROM verification_logs;" > /tmp/sqlite_export/verification_logs.csv
sqlite3 -header -csv certificates.db "SELECT * FROM complaints;" > /tmp/sqlite_export/complaints.csv
sqlite3 -header -csv certificates.db "SELECT * FROM quota_certificate_requests;" > /tmp/sqlite_export/quota_certificate_requests.csv
sqlite3 -header -csv certificates.db "SELECT * FROM appeals;" > /tmp/sqlite_export/appeals.csv
sqlite3 -header -csv certificates.db "SELECT * FROM certificate_appeals;" > /tmp/sqlite_export/certificate_appeals.csv

# Transfer to DB server
scp -r /tmp/sqlite_export root@10.48.239.8:/tmp/
```

**On DB Server (10.48.239.8):**

```bash
# Import CSVs into PostgreSQL
cd /tmp/sqlite_export

# Import each table (adjust column names as needed)
sudo -u postgres psql -d pramaan_db << 'EOSQL'

-- Temporarily disable foreign key checks
SET session_replication_role = replica;

-- Import issuers first (no dependencies)
\copy issuers FROM '/tmp/sqlite_export/issuers.csv' WITH (FORMAT csv, HEADER true);

-- Import athletes
\copy athletes FROM '/tmp/sqlite_export/athletes.csv' WITH (FORMAT csv, HEADER true);

-- Import certificates
\copy certificates FROM '/tmp/sqlite_export/certificates.csv' WITH (FORMAT csv, HEADER true);

-- Import athlete_competitions
\copy athlete_competitions FROM '/tmp/sqlite_export/athlete_competitions.csv' WITH (FORMAT csv, HEADER true);

-- Import certificate_assignments
\copy certificate_assignments FROM '/tmp/sqlite_export/certificate_assignments.csv' WITH (FORMAT csv, HEADER true);

-- Import other tables
\copy cancellation_logs FROM '/tmp/sqlite_export/cancellation_logs.csv' WITH (FORMAT csv, HEADER true);
\copy verification_logs FROM '/tmp/sqlite_export/verification_logs.csv' WITH (FORMAT csv, HEADER true);
\copy complaints FROM '/tmp/sqlite_export/complaints.csv' WITH (FORMAT csv, HEADER true);
\copy quota_certificate_requests FROM '/tmp/sqlite_export/quota_certificate_requests.csv' WITH (FORMAT csv, HEADER true);
\copy appeals FROM '/tmp/sqlite_export/appeals.csv' WITH (FORMAT csv, HEADER true);
\copy certificate_appeals FROM '/tmp/sqlite_export/certificate_appeals.csv' WITH (FORMAT csv, HEADER true);

-- Re-enable foreign key checks
SET session_replication_role = DEFAULT;

-- Update sequences to match imported data
SELECT setval('certificates_id_seq', (SELECT MAX(id) FROM certificates));
SELECT setval('athletes_id_seq', (SELECT MAX(id) FROM athletes));
SELECT setval('issuers_id_seq', (SELECT MAX(id) FROM issuers));
SELECT setval('athlete_competitions_id_seq', (SELECT MAX(id) FROM athlete_competitions));

EOSQL
```

---

## PHASE 4: Backend Deployment (APP Servers)

### Step 4.1: Deploy Backend to APP Server 1 (10.48.238.206)

**From staging server:**

```bash
# Package backend (excluding node_modules and database)
cd /root/pramaan
tar --exclude='backend/node_modules' \
    --exclude='backend/certificates.db' \
    --exclude='backend/dist' \
    --exclude='backend/logs' \
    -czvf backend.tar.gz backend/

# Transfer to APP Server 1
scp backend.tar.gz root@10.48.238.206:/var/www/pramaan/
scp /root/pramaan/backend/.env.production root@10.48.238.206:/var/www/pramaan/
```

**On APP Server 1 (10.48.238.206):**

```bash
cd /var/www/pramaan

# Extract backend
tar -xzvf backend.tar.gz
mv backend/* .
rm -rf backend backend.tar.gz

# Rename production env file
mv .env.production .env

# Install dependencies
npm install --production

# Build TypeScript
npm run build

# Create logs directory
mkdir -p logs

# Test the application
npm start
# Press Ctrl+C after verifying it starts

# Setup PM2 for production
pm2 start dist/server.js --name pramaan-backend
pm2 save
pm2 startup
```

### Step 4.2: Configure Nginx to Proxy API (APP Server 1)

```bash
# Update nginx config to enable API proxy
nano /etc/nginx/sites-available/pramaan

# Uncomment the API location block:
# location /api {
#     proxy_pass http://127.0.0.1:3000;
#     ...
# }

# Also add health check for backend:
# location /api/health {
#     proxy_pass http://127.0.0.1:3000/health;
# }

# Restart nginx
nginx -t
systemctl restart nginx
```

### Step 4.3: Replicate Backend to APP Server 2 (10.48.238.207)

```bash
# From staging server
scp /root/pramaan/backend.tar.gz root@10.48.238.207:/var/www/pramaan/
scp /root/pramaan/backend/.env.production root@10.48.238.207:/var/www/pramaan/
```

**On APP Server 2 (10.48.238.207):**

```bash
cd /var/www/pramaan
tar -xzvf backend.tar.gz
mv backend/* .
rm -rf backend backend.tar.gz
mv .env.production .env

npm install --production
npm run build
mkdir -p logs

pm2 start dist/server.js --name pramaan-backend
pm2 save
pm2 startup

# Update nginx config
nano /etc/nginx/sites-available/pramaan
# Enable API proxy block
nginx -t
systemctl restart nginx
```

---

## PHASE 5: Blockchain Server Setup

### Step 5.1: Setup Blockchain Node 1 (10.48.238.203)

```bash
# SSH into Blockchain Server 1
ssh root@10.48.238.203

# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install PM2
npm install -g pm2

# Create blockchain directory
mkdir -p /var/www/blockchain
```

**From staging server:**

```bash
# Package blockchain-related files
cd /root/pramaan
tar -czvf blockchain.tar.gz \
    contracts/ \
    hardhat.config.ts \
    package.json \
    package-lock.json \
    tsconfig.json \
    scripts/

scp blockchain.tar.gz root@10.48.238.203:/var/www/blockchain/
```

**On Blockchain Server 1 (10.48.238.203):**

```bash
cd /var/www/blockchain
tar -xzvf blockchain.tar.gz
rm blockchain.tar.gz

# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Start Hardhat node (persistent local blockchain)
pm2 start "npx hardhat node --hostname 0.0.0.0" --name hardhat-node
pm2 save
pm2 startup

# Deploy contract
npx hardhat run scripts/deploy.ts --network localhost

# Note the contract address from output - you'll need this!
# Save it: CONTRACT_ADDRESS=0x...
```

### Step 5.2: Configure Firewall for Blockchain Server

```bash
# Allow connections from APP servers
ufw allow from 10.48.238.206 to any port 8545
ufw allow from 10.48.238.207 to any port 8545
```

### Step 5.3: Setup Blockchain Node 2 (10.48.238.204) - Backup Node

Repeat the same steps on the second blockchain server for redundancy.

### Step 5.4: Update APP Servers with Contract Address

**On both APP Servers (10.48.238.206 and 10.48.238.207):**

```bash
# Update .env with contract address
nano /var/www/pramaan/.env

# Update these values:
# BLOCKCHAIN_RPC=http://10.48.238.203:8545
# CONTRACT_ADDRESS=0x_YOUR_DEPLOYED_CONTRACT_ADDRESS
# PRIVATE_KEY=0x_YOUR_ISSUER_PRIVATE_KEY

# Restart backend
pm2 restart pramaan-backend
```

---

## PHASE 6: Load Balancer Setup (Optional)

If you have a load balancer in front of APP servers:

### Nginx Load Balancer Configuration

```nginx
upstream pramaan_backend {
    least_conn;
    server 10.48.238.206:80 weight=1;
    server 10.48.238.207:80 weight=1;
}

server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://pramaan_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## VERIFICATION CHECKLIST

### Frontend Verification
```bash
# From any machine
curl -I http://10.48.238.206/
curl -I http://10.48.238.207/
# Both should return HTTP 200
```

### Database Verification
```bash
# From APP Server
psql -h 10.48.239.8 -U pramaan_user -d pramaan_db -c "SELECT COUNT(*) FROM certificates;"
```

### Backend Verification
```bash
# From any machine
curl http://10.48.238.206/api/health
curl http://10.48.238.207/api/health
# Should return {"status":"ok",...}
```

### Blockchain Verification
```bash
# From APP Server
curl -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://10.48.238.203:8545
# Should return block number
```

---

## ROLLBACK PLAN

### If Frontend Fails
```bash
# Restore from staging
scp root@STAGING_IP:/root/pramaan/backend/public/* /var/www/pramaan/
systemctl restart nginx
```

### If Database Migration Fails
```bash
# On APP servers - revert to SQLite
# Update .env: DB_TYPE=sqlite
pm2 restart pramaan-backend
```

### If Backend Fails
```bash
# Check PM2 logs
pm2 logs pramaan-backend

# Restart backend
pm2 restart pramaan-backend

# If needed, rollback code
scp root@STAGING_IP:/root/pramaan/backend.tar.gz /var/www/pramaan/
cd /var/www/pramaan && tar -xzvf backend.tar.gz
pm2 restart pramaan-backend
```

---

## MAINTENANCE COMMANDS

### PM2 Commands (APP Servers)
```bash
pm2 status                    # Check status
pm2 logs pramaan-backend      # View logs
pm2 restart pramaan-backend   # Restart
pm2 reload pramaan-backend    # Zero-downtime reload
pm2 stop pramaan-backend      # Stop
```

### PostgreSQL Commands (DB Server)
```bash
sudo -u postgres psql -d pramaan_db    # Connect to database
systemctl status postgresql             # Check status
systemctl restart postgresql            # Restart
```

### Hardhat Commands (Blockchain Server)
```bash
pm2 logs hardhat-node         # View logs
pm2 restart hardhat-node      # Restart node
```

---

## SECURITY RECOMMENDATIONS

1. **Change all default passwords** in production
2. **Use SSL/TLS certificates** (Let's Encrypt)
3. **Configure firewall rules** to restrict access
4. **Enable fail2ban** for SSH protection
5. **Regular backups** of PostgreSQL database
6. **Monitor logs** with centralized logging (ELK stack)
7. **Update JWT_SECRET** to a strong random value
8. **Restrict blockchain RPC** to only allow APP servers

---

## QUICK REFERENCE - Server IPs

| Task | Server | IP |
|------|--------|-----|
| Deploy Frontend | APP 1 | `ssh root@10.48.238.206` |
| Deploy Frontend | APP 2 | `ssh root@10.48.238.207` |
| Setup PostgreSQL | DB Primary | `ssh root@10.48.239.8` |
| Setup PostgreSQL | DB Replica | `ssh root@10.48.239.9` |
| Deploy Blockchain | BC 1 | `ssh root@10.48.238.203` |
| Deploy Blockchain | BC 2 | `ssh root@10.48.238.204` |
