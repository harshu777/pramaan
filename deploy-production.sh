#!/bin/bash

#############################################
# Certificate Management System
# Production Deployment Script
#############################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_banner() {
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║   Certificate Management System - Production Deployment   ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check if production .env exists
check_production_env() {
    log_info "Checking production environment configuration..."

    if [ ! -f backend/.env.production ]; then
        log_error "backend/.env.production not found!"
        log_info "Please create backend/.env.production with the following required variables:"
        echo ""
        echo "  NODE_ENV=production"
        echo "  PORT=3000"
        echo "  DATABASE_URL=postgresql://user:pass@host:5432/dbname"
        echo "  BLOCKCHAIN_RPC=https://your-rpc-endpoint"
        echo "  PRIVATE_KEY=your-private-key"
        echo "  CONTRACT_ADDRESS=your-contract-address"
        echo "  IPFS_SERVICE=pinata|web3storage|local"
        echo "  PINATA_API_KEY=your-api-key"
        echo "  PINATA_SECRET_KEY=your-secret-key"
        echo "  JWT_SECRET=your-strong-secret"
        echo "  QR_BASE_URL=https://your-domain.com"
        echo ""
        exit 1
    fi

    # Check required variables
    source backend/.env.production
    local missing_vars=()

    [ -z "$DATABASE_URL" ] && missing_vars+=("DATABASE_URL")
    [ -z "$CONTRACT_ADDRESS" ] && missing_vars+=("CONTRACT_ADDRESS")
    [ -z "$JWT_SECRET" ] && missing_vars+=("JWT_SECRET")

    if [ ${#missing_vars[@]} -ne 0 ]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        exit 1
    fi

    log_success "Production environment configuration verified"
}

# Install production dependencies
install_production_deps() {
    log_info "Installing production dependencies..."

    npm ci --production
    cd backend && npm ci --production && cd ..

    log_success "Production dependencies installed"
}

# Build for production
build_production() {
    log_info "Building application for production..."

    # Compile contracts
    npm run compile

    # Build backend
    cd backend
    npm run build
    cd ..

    log_success "Production build completed"
}

# Deploy contract to network
deploy_contract_production() {
    local NETWORK=${1:-sepolia}

    log_info "Deploying contract to $NETWORK..."

    # Check if .env has network RPC configured
    if [ "$NETWORK" = "sepolia" ] && ! grep -q "SEPOLIA_RPC_URL" .env; then
        log_error "SEPOLIA_RPC_URL not configured in .env"
        exit 1
    fi

    # Deploy
    DEPLOY_OUTPUT=$(npm run deploy:testnet 2>&1)
    echo "$DEPLOY_OUTPUT"

    # Extract and save contract address
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -o "0x[a-fA-F0-9]\{40\}" | head -1)

    if [ -z "$CONTRACT_ADDRESS" ]; then
        log_error "Failed to extract contract address"
        exit 1
    fi

    log_success "Contract deployed to $NETWORK at: $CONTRACT_ADDRESS"
    log_warning "Update CONTRACT_ADDRESS in backend/.env.production with: $CONTRACT_ADDRESS"

    echo "{\"contractAddress\": \"$CONTRACT_ADDRESS\", \"network\": \"$NETWORK\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > deployment-info-production.json
}

# Create systemd service (Linux only)
create_systemd_service() {
    log_info "Creating systemd service..."

    local SERVICE_FILE="/etc/systemd/system/cert-management.service"
    local CURRENT_DIR=$(pwd)
    local USER=$(whoami)

    cat > cert-management.service <<EOF
[Unit]
Description=Certificate Management System Backend
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$CURRENT_DIR/backend
Environment=NODE_ENV=production
EnvironmentFile=$CURRENT_DIR/backend/.env.production
ExecStart=/usr/bin/node $CURRENT_DIR/backend/dist/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cert-management

[Install]
WantedBy=multi-user.target
EOF

    log_success "Systemd service file created: cert-management.service"
    log_info "To install, run: sudo cp cert-management.service $SERVICE_FILE"
    log_info "Then: sudo systemctl enable cert-management && sudo systemctl start cert-management"
}

# Docker production deployment
deploy_docker_production() {
    log_info "Building production Docker image..."

    # Build backend image
    docker build -t cert-management-backend:latest ./backend

    log_success "Docker image built successfully"
    log_info "To run:"
    echo "  docker run -d \\"
    echo "    --name cert-backend \\"
    echo "    -p 3000:3000 \\"
    echo "    --env-file backend/.env.production \\"
    echo "    cert-management-backend:latest"
}

# Nginx configuration template
create_nginx_config() {
    log_info "Creating Nginx configuration template..."

    cat > nginx.conf <<'EOF'
server {
    listen 80;
    server_name your-domain.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Client body size limit
    client_max_body_size 10M;

    # Backend proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files
    location /static {
        alias /path/to/cert-management-system/backend/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
}
EOF

    log_success "Nginx configuration template created: nginx.conf"
    log_info "Customize and copy to: /etc/nginx/sites-available/cert-management"
}

# Production checklist
print_production_checklist() {
    echo ""
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║            Production Deployment Checklist                ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "□ Domain name configured and DNS pointing to server"
    echo "□ SSL/TLS certificate obtained (Let's Encrypt recommended)"
    echo "□ PostgreSQL database set up and accessible"
    echo "□ IPFS pinning service configured (Pinata/Web3.Storage)"
    echo "□ Blockchain RPC endpoint configured (Infura/Alchemy)"
    echo "□ Contract deployed to target network and verified"
    echo "□ backend/.env.production configured with all required variables"
    echo "□ JWT_SECRET is strong and unique"
    echo "□ Private keys secured (use hardware wallet or KMS in production)"
    echo "□ Firewall configured (allow only 80, 443, SSH)"
    echo "□ Nginx or reverse proxy configured"
    echo "□ Rate limiting enabled"
    echo "□ Monitoring and logging set up"
    echo "□ Backup strategy implemented for database"
    echo "□ IPFS content pinned and backed up"
    echo ""
}

# Main production deployment
main() {
    print_banner

    case "${1:-help}" in
        build)
            check_production_env
            install_production_deps
            build_production
            log_success "Production build completed!"
            ;;
        deploy-contract)
            NETWORK=${2:-sepolia}
            deploy_contract_production $NETWORK
            ;;
        docker)
            check_production_env
            build_production
            deploy_docker_production
            ;;
        systemd)
            build_production
            create_systemd_service
            ;;
        nginx)
            create_nginx_config
            ;;
        full)
            check_production_env
            install_production_deps
            build_production
            create_systemd_service
            create_nginx_config
            print_production_checklist
            ;;
        checklist)
            print_production_checklist
            ;;
        *)
            log_info "Production Deployment Script"
            echo ""
            echo "Usage: $0 <command> [options]"
            echo ""
            echo "Commands:"
            echo "  build              - Build application for production"
            echo "  deploy-contract    - Deploy contract to testnet/mainnet"
            echo "                       Usage: $0 deploy-contract [network]"
            echo "  docker             - Build production Docker image"
            echo "  systemd            - Generate systemd service file"
            echo "  nginx              - Generate Nginx configuration"
            echo "  full               - Full production setup (build + configs)"
            echo "  checklist          - Show production deployment checklist"
            echo ""
            print_production_checklist
            ;;
    esac
}

main "$@"
