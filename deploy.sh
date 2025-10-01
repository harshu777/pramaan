#!/bin/bash

#############################################
# Certificate Management System
# One-Click Deployment Script
#############################################

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_banner() {
    echo -e "${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║   Certificate Management System - Deployment Script       ║"
    echo "║   IPFS + Blockchain + PostgreSQL                          ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing_deps=()

    if ! command_exists node; then
        missing_deps+=("Node.js (v18+)")
    else
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -lt 18 ]; then
            log_error "Node.js version 18 or higher is required. Current: $(node -v)"
            exit 1
        fi
    fi

    if ! command_exists npm; then
        missing_deps+=("npm")
    fi

    if ! command_exists docker; then
        missing_deps+=("Docker")
    fi

    if ! command_exists docker-compose; then
        missing_deps+=("docker-compose")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Please install the missing dependencies and try again."
        exit 1
    fi

    log_success "All prerequisites satisfied"
}

# Setup environment variables
setup_environment() {
    log_info "Setting up environment variables..."

    if [ ! -f backend/.env ]; then
        log_info "Creating backend/.env from .env.example..."
        cp backend/.env.example backend/.env

        # Generate random JWT secret
        JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1)

        # Update .env with generated values
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" backend/.env
            sed -i '' "s|DATABASE_URL=.*|DATABASE_URL=postgresql://certadmin:certpass123@localhost:5432/certificate_db|g" backend/.env
            sed -i '' "s|BLOCKCHAIN_RPC=.*|BLOCKCHAIN_RPC=http://localhost:8545|g" backend/.env
            sed -i '' "s|IPFS_SERVICE=.*|IPFS_SERVICE=local|g" backend/.env
            sed -i '' "s|IPFS_API_URL=.*|IPFS_API_URL=http://localhost:5001|g" backend/.env
        else
            # Linux
            sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" backend/.env
            sed -i "s|DATABASE_URL=.*|DATABASE_URL=postgresql://certadmin:certpass123@localhost:5432/certificate_db|g" backend/.env
            sed -i "s|BLOCKCHAIN_RPC=.*|BLOCKCHAIN_RPC=http://localhost:8545|g" backend/.env
            sed -i "s|IPFS_SERVICE=.*|IPFS_SERVICE=local|g" backend/.env
            sed -i "s|IPFS_API_URL=.*|IPFS_API_URL=http://localhost:5001|g" backend/.env
        fi

        log_success "Environment file created with JWT secret"
    else
        log_warning "backend/.env already exists, skipping..."
    fi

    # Create root .env for hardhat if not exists
    if [ ! -f .env ]; then
        log_info "Creating root .env file..."
        echo "# Hardhat Network Configuration" > .env
        echo "PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" >> .env
        echo "BLOCKCHAIN_RPC=http://localhost:8545" >> .env
        echo "" >> .env
        echo "# Testnet Configuration (Optional)" >> .env
        echo "# SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY" >> .env
        echo "# ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY" >> .env
        log_success "Root .env file created"
    fi
}

# Install dependencies
install_dependencies() {
    log_info "Installing dependencies..."

    log_info "Installing root project dependencies..."
    npm install

    log_info "Installing backend dependencies..."
    cd backend && npm install && cd ..

    log_success "Dependencies installed"
}

# Start Docker services
start_docker_services() {
    log_info "Starting Docker services (PostgreSQL, IPFS, pgAdmin)..."

    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running. Please start Docker and try again."
        exit 1
    fi

    # Stop existing containers if any
    docker-compose down 2>/dev/null || true

    # Start services
    docker-compose up -d

    log_info "Waiting for services to be ready..."
    sleep 10

    # Check if PostgreSQL is ready
    log_info "Checking PostgreSQL connection..."
    for i in {1..30}; do
        if docker exec cert_postgres pg_isready -U certadmin >/dev/null 2>&1; then
            log_success "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "PostgreSQL failed to start"
            docker-compose logs postgres
            exit 1
        fi
        sleep 2
    done

    # Check if IPFS is ready
    log_info "Checking IPFS connection..."
    for i in {1..30}; do
        if curl -s http://localhost:5001/api/v0/version >/dev/null 2>&1; then
            log_success "IPFS is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "IPFS failed to start"
            docker-compose logs ipfs
            exit 1
        fi
        sleep 2
    done

    log_success "All Docker services are running"
}

# Compile smart contracts
compile_contracts() {
    log_info "Compiling smart contracts..."
    npm run compile
    log_success "Smart contracts compiled"
}

# Start local blockchain
start_blockchain() {
    log_info "Starting local blockchain (Hardhat node)..."

    # Check if hardhat node is already running
    if lsof -Pi :8545 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "Port 8545 is already in use. Skipping blockchain startup..."
        return
    fi

    # Start Hardhat node in background
    npm run node > hardhat-node.log 2>&1 &
    HARDHAT_PID=$!
    echo $HARDHAT_PID > .hardhat.pid

    log_info "Waiting for blockchain to be ready..."
    sleep 5

    # Check if blockchain is ready
    for i in {1..30}; do
        if curl -s -X POST -H "Content-Type: application/json" \
           --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
           http://localhost:8545 >/dev/null 2>&1; then
            log_success "Blockchain is ready (PID: $HARDHAT_PID)"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "Blockchain failed to start"
            cat hardhat-node.log
            exit 1
        fi
        sleep 2
    done
}

# Deploy smart contract
deploy_contract() {
    log_info "Deploying smart contract to local blockchain..."

    # Deploy and capture output
    DEPLOY_OUTPUT=$(npm run deploy:local 2>&1)
    echo "$DEPLOY_OUTPUT"

    # Extract contract address
    CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -o "0x[a-fA-F0-9]\{40\}" | head -1)

    if [ -z "$CONTRACT_ADDRESS" ]; then
        log_error "Failed to extract contract address from deployment output"
        exit 1
    fi

    log_success "Smart contract deployed at: $CONTRACT_ADDRESS"

    # Update backend .env with contract address
    log_info "Updating backend/.env with contract address..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|CONTRACT_ADDRESS=.*|CONTRACT_ADDRESS=$CONTRACT_ADDRESS|g" backend/.env
    else
        sed -i "s|CONTRACT_ADDRESS=.*|CONTRACT_ADDRESS=$CONTRACT_ADDRESS|g" backend/.env
    fi

    # Save deployment info
    echo "{\"contractAddress\": \"$CONTRACT_ADDRESS\", \"network\": \"localhost\", \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > deployment-info.json
    log_success "Contract address saved to deployment-info.json"
}

# Build backend
build_backend() {
    log_info "Building backend..."
    cd backend
    npm run build
    cd ..
    log_success "Backend built successfully"
}

# Start backend server
start_backend() {
    log_info "Starting backend server..."

    # Check if backend is already running
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "Port 3000 is already in use. Stopping existing backend..."
        pkill -f "tsx watch src/server.ts" 2>/dev/null || true
        pkill -f "node dist/server.js" 2>/dev/null || true
        sleep 2
    fi

    # Start backend in background
    cd backend
    npm run dev > ../backend.log 2>&1 &
    BACKEND_PID=$!
    cd ..
    echo $BACKEND_PID > .backend.pid

    log_info "Waiting for backend to be ready..."
    sleep 5

    # Check if backend is ready
    for i in {1..30}; do
        if curl -s http://localhost:3000/health >/dev/null 2>&1; then
            log_success "Backend is ready (PID: $BACKEND_PID)"
            break
        fi
        if [ $i -eq 30 ]; then
            log_warning "Backend health check failed, but continuing..."
            break
        fi
        sleep 2
    done
}

# Print summary
print_summary() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          Deployment Completed Successfully! 🎉            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    log_info "Access Points:"
    echo "  🌐 Backend API:        http://localhost:3000"
    echo "  🌐 Frontend:           http://localhost:3000/static/index.html"
    echo "  📊 pgAdmin:            http://localhost:5050"
    echo "     Email:             admin@cert.com"
    echo "     Password:          admin123"
    echo "  🔗 IPFS Gateway:       http://localhost:8080"
    echo "  🔗 IPFS API:           http://localhost:5001"
    echo "  ⛓️  Blockchain RPC:     http://localhost:8545"
    echo ""
    log_info "Deployment Information:"
    if [ -f deployment-info.json ]; then
        CONTRACT_ADDR=$(cat deployment-info.json | grep -o '"contractAddress": "[^"]*"' | cut -d'"' -f4)
        echo "  📝 Contract Address:   $CONTRACT_ADDR"
    fi
    echo "  📄 Deployment Info:    $(pwd)/deployment-info.json"
    echo "  📋 Backend Logs:       $(pwd)/backend.log"
    echo "  📋 Blockchain Logs:    $(pwd)/hardhat-node.log"
    echo ""
    log_info "Default Test Account (Hardhat):"
    echo "  Address:  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    echo "  Key:      0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    echo ""
    log_info "Useful Commands:"
    echo "  📊 View logs:          tail -f backend.log"
    echo "  🛑 Stop services:      ./deploy.sh stop"
    echo "  🔄 Restart services:   ./deploy.sh restart"
    echo "  🧹 Clean up:           ./deploy.sh clean"
    echo ""
}

# Stop all services
stop_services() {
    log_info "Stopping all services..."

    # Stop backend
    if [ -f .backend.pid ]; then
        BACKEND_PID=$(cat .backend.pid)
        if ps -p $BACKEND_PID > /dev/null 2>&1; then
            log_info "Stopping backend (PID: $BACKEND_PID)..."
            kill $BACKEND_PID 2>/dev/null || true
        fi
        rm .backend.pid
    fi
    pkill -f "tsx watch src/server.ts" 2>/dev/null || true

    # Stop blockchain
    if [ -f .hardhat.pid ]; then
        HARDHAT_PID=$(cat .hardhat.pid)
        if ps -p $HARDHAT_PID > /dev/null 2>&1; then
            log_info "Stopping blockchain (PID: $HARDHAT_PID)..."
            kill $HARDHAT_PID 2>/dev/null || true
        fi
        rm .hardhat.pid
    fi
    pkill -f "hardhat node" 2>/dev/null || true

    # Stop Docker services
    log_info "Stopping Docker services..."
    docker-compose down

    log_success "All services stopped"
}

# Clean up everything
clean_all() {
    log_warning "This will remove all data including database volumes!"
    read -p "Are you sure? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
        log_info "Clean up cancelled"
        exit 0
    fi

    stop_services

    log_info "Removing Docker volumes..."
    docker-compose down -v

    log_info "Removing build artifacts..."
    rm -rf artifacts cache typechain-types
    rm -rf backend/dist backend/node_modules
    rm -rf node_modules

    log_info "Removing logs and databases..."
    rm -f backend.log hardhat-node.log
    rm -f backend/*.db backend/*.log
    rm -f deployment-info.json

    log_success "Clean up completed"
}

# Main deployment flow
main() {
    print_banner

    case "${1:-deploy}" in
        deploy|start)
            check_prerequisites
            setup_environment
            install_dependencies
            start_docker_services
            compile_contracts
            start_blockchain
            deploy_contract
            build_backend
            start_backend
            print_summary
            ;;
        stop)
            stop_services
            ;;
        restart)
            stop_services
            sleep 2
            main deploy
            ;;
        clean)
            clean_all
            ;;
        *)
            log_error "Unknown command: $1"
            echo "Usage: $0 {deploy|start|stop|restart|clean}"
            echo ""
            echo "Commands:"
            echo "  deploy|start  - Deploy and start all services (default)"
            echo "  stop          - Stop all running services"
            echo "  restart       - Restart all services"
            echo "  clean         - Stop services and clean all data"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
