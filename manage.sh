#!/bin/bash

#############################################
# Certificate Management System
# Management and Maintenance Script
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

# Database management
db_backup() {
    log_info "Creating database backup..."
    BACKUP_DIR="./backups"
    mkdir -p $BACKUP_DIR
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/cert_db_$TIMESTAMP.sql.gz"

    docker exec cert_postgres pg_dump -U certadmin certificate_db | gzip > $BACKUP_FILE
    log_success "Database backed up to: $BACKUP_FILE"
}

db_restore() {
    if [ -z "$1" ]; then
        log_error "Please provide backup file path"
        echo "Usage: $0 db:restore <backup-file>"
        exit 1
    fi

    log_warning "This will replace the current database!"
    read -p "Continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi

    log_info "Restoring database from: $1"
    gunzip -c "$1" | docker exec -i cert_postgres psql -U certadmin certificate_db
    log_success "Database restored"
}

db_reset() {
    log_warning "This will DELETE all data and reinitialize the database!"
    read -p "Are you absolutely sure? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
        log_info "Reset cancelled"
        exit 0
    fi

    log_info "Resetting database..."
    docker-compose down -v
    docker-compose up -d postgres
    sleep 5
    docker exec cert_postgres psql -U certadmin -d certificate_db -f /docker-entrypoint-initdb.d/init.sql
    log_success "Database reset complete"
}

db_query() {
    if [ -z "$1" ]; then
        log_info "Opening interactive psql shell..."
        docker exec -it cert_postgres psql -U certadmin -d certificate_db
    else
        docker exec cert_postgres psql -U certadmin -d certificate_db -c "$1"
    fi
}

# IPFS management
ipfs_stats() {
    log_info "IPFS Statistics:"
    echo ""
    echo "Node ID:"
    curl -s -X POST http://localhost:5001/api/v0/id | jq -r .ID
    echo ""
    echo "Bandwidth Stats:"
    curl -s -X POST http://localhost:5001/api/v0/stats/bw | jq .
    echo ""
    echo "Pinned Files:"
    curl -s -X POST http://localhost:5001/api/v0/pin/ls | jq '.Keys | length'
}

ipfs_list_pins() {
    log_info "Listing all pinned files..."
    curl -s -X POST http://localhost:5001/api/v0/pin/ls | jq -r '.Keys | keys[]'
}

ipfs_backup() {
    log_info "Creating IPFS backup..."
    BACKUP_DIR="./backups/ipfs"
    mkdir -p $BACKUP_DIR
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)

    # Export list of pinned CIDs
    curl -s -X POST http://localhost:5001/api/v0/pin/ls > "$BACKUP_DIR/pinned_${TIMESTAMP}.json"
    log_success "IPFS pins list saved to: $BACKUP_DIR/pinned_${TIMESTAMP}.json"
}

# Logs management
logs_view() {
    case "$1" in
        backend)
            tail -f backend.log
            ;;
        blockchain)
            tail -f hardhat-node.log
            ;;
        postgres)
            docker logs -f cert_postgres
            ;;
        ipfs)
            docker logs -f cert_ipfs
            ;;
        all)
            docker-compose logs -f
            ;;
        *)
            log_error "Unknown log: $1"
            echo "Available logs: backend, blockchain, postgres, ipfs, all"
            exit 1
            ;;
    esac
}

logs_clear() {
    log_info "Clearing log files..."
    > backend.log
    > hardhat-node.log
    > backend/combined.log
    > backend/error.log
    log_success "Logs cleared"
}

# Status and health checks
check_status() {
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     System Status Check                ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""

    # Docker services
    echo "Docker Services:"
    docker-compose ps
    echo ""

    # Backend
    echo "Backend API:"
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Backend is running"
    else
        echo -e "  ${RED}✗${NC} Backend is not responding"
    fi

    # PostgreSQL
    echo "PostgreSQL:"
    if docker exec cert_postgres pg_isready -U certadmin > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} PostgreSQL is ready"
        CERT_COUNT=$(docker exec cert_postgres psql -U certadmin -d certificate_db -tAc "SELECT COUNT(*) FROM certificates" 2>/dev/null || echo "0")
        echo "  Certificates in DB: $CERT_COUNT"
    else
        echo -e "  ${RED}✗${NC} PostgreSQL is not ready"
    fi

    # IPFS
    echo "IPFS:"
    if curl -s http://localhost:5001/api/v0/version > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} IPFS is running"
        VERSION=$(curl -s -X POST http://localhost:5001/api/v0/version | jq -r .Version)
        echo "  Version: $VERSION"
    else
        echo -e "  ${RED}✗${NC} IPFS is not responding"
    fi

    # Blockchain
    echo "Blockchain:"
    if curl -s -X POST -H "Content-Type: application/json" \
       --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
       http://localhost:8545 > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} Blockchain is running"
        BLOCK=$(curl -s -X POST -H "Content-Type: application/json" \
               --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
               http://localhost:8545 | jq -r .result)
        echo "  Latest block: $BLOCK"
    else
        echo -e "  ${RED}✗${NC} Blockchain is not responding"
    fi

    echo ""
}

# Contract management
contract_info() {
    if [ ! -f deployment-info.json ]; then
        log_error "No deployment info found. Run './deploy.sh' first."
        exit 1
    fi

    log_info "Smart Contract Information:"
    cat deployment-info.json | jq .
}

contract_stats() {
    log_info "Fetching contract statistics..."

    # Load contract address
    if [ ! -f deployment-info.json ]; then
        log_error "No deployment info found"
        exit 1
    fi

    CONTRACT_ADDRESS=$(cat deployment-info.json | jq -r .contractAddress)

    echo "Contract Address: $CONTRACT_ADDRESS"
    echo ""

    # Get total certificates (if contract is deployed)
    if command -v cast > /dev/null 2>&1; then
        cast call $CONTRACT_ADDRESS "getTotalCertificates()(uint256)" --rpc-url http://localhost:8545
    else
        log_warning "Install foundry (cast) for detailed contract stats"
    fi
}

# Maintenance tasks
update_dependencies() {
    log_info "Updating dependencies..."

    log_info "Updating root dependencies..."
    npm update

    log_info "Updating backend dependencies..."
    cd backend && npm update && cd ..

    log_success "Dependencies updated"
}

security_audit() {
    log_info "Running security audit..."

    log_info "Root project audit:"
    npm audit

    log_info "Backend audit:"
    cd backend && npm audit && cd ..

    log_info "Smart contract analysis (if slither installed):"
    if command -v slither > /dev/null 2>&1; then
        slither contracts/CertificateRegistry.sol
    else
        log_warning "Install slither for smart contract security analysis"
        log_info "pip3 install slither-analyzer"
    fi
}

optimize() {
    log_info "Running optimization tasks..."

    # Database vacuum
    log_info "Optimizing database..."
    docker exec cert_postgres psql -U certadmin -d certificate_db -c "VACUUM ANALYZE;"

    # IPFS garbage collection
    log_info "Running IPFS garbage collection..."
    curl -X POST http://localhost:5001/api/v0/repo/gc

    log_success "Optimization complete"
}

# Development helpers
dev_reset() {
    log_warning "This will reset the entire development environment!"
    read -p "Continue? (yes/no): " -r
    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
        exit 0
    fi

    log_info "Stopping services..."
    ./deploy.sh stop

    log_info "Cleaning..."
    ./deploy.sh clean

    log_info "Redeploying..."
    ./deploy.sh

    log_success "Development environment reset complete"
}

generate_test_data() {
    log_info "Generating test certificates..."

    # Get auth token
    TOKEN=$(curl -s -X POST http://localhost:3000/api/issuers/login \
        -H "Content-Type: application/json" \
        -d '{"did":"did:example:123456789","password":"admin123"}' | jq -r .token)

    if [ "$TOKEN" = "null" ]; then
        log_error "Failed to authenticate. Make sure the default issuer exists."
        exit 1
    fi

    # Generate 5 test certificates
    NAMES=("Alice Johnson" "Bob Smith" "Carol Williams" "David Brown" "Eve Davis")
    TYPES=("degree" "diploma" "certificate" "transcript" "award")

    for i in {0..4}; do
        log_info "Creating certificate for ${NAMES[$i]}..."
        curl -s -X POST http://localhost:3000/api/certificates/issue \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $TOKEN" \
            -d "{
                \"issuerDid\": \"did:example:123456789\",
                \"issuerName\": \"Test University\",
                \"subjectName\": \"${NAMES[$i]}\",
                \"subjectEmail\": \"${NAMES[$i],,}@example.com\",
                \"certificateType\": \"${TYPES[$i]}\"
            }" | jq .
        sleep 1
    done

    log_success "Test data generated"
}

# Help
show_help() {
    cat << EOF
Certificate Management System - Management Script

Usage: $0 <command> [options]

DATABASE COMMANDS:
  db:backup              Create database backup
  db:restore <file>      Restore database from backup
  db:reset               Reset database to initial state
  db:query [sql]         Execute SQL query or open psql shell

IPFS COMMANDS:
  ipfs:stats            Show IPFS statistics
  ipfs:pins             List all pinned files
  ipfs:backup           Backup list of pinned CIDs

LOGS COMMANDS:
  logs:view <service>   View logs (backend|blockchain|postgres|ipfs|all)
  logs:clear            Clear all log files

STATUS COMMANDS:
  status                Show system status
  contract:info         Show contract deployment info
  contract:stats        Show contract statistics

MAINTENANCE COMMANDS:
  update                Update dependencies
  audit                 Run security audit
  optimize              Run optimization tasks

DEVELOPMENT COMMANDS:
  dev:reset             Reset entire development environment
  dev:testdata          Generate test certificates

EXAMPLES:
  $0 status                          # Check system status
  $0 db:backup                       # Backup database
  $0 db:query "SELECT * FROM certificates LIMIT 5"
  $0 logs:view backend               # View backend logs
  $0 ipfs:stats                      # Show IPFS stats
  $0 dev:testdata                    # Generate test data

EOF
}

# Main
main() {
    case "${1:-help}" in
        db:backup)
            db_backup
            ;;
        db:restore)
            db_restore "$2"
            ;;
        db:reset)
            db_reset
            ;;
        db:query)
            db_query "$2"
            ;;
        ipfs:stats)
            ipfs_stats
            ;;
        ipfs:pins)
            ipfs_list_pins
            ;;
        ipfs:backup)
            ipfs_backup
            ;;
        logs:view)
            logs_view "$2"
            ;;
        logs:clear)
            logs_clear
            ;;
        status)
            check_status
            ;;
        contract:info)
            contract_info
            ;;
        contract:stats)
            contract_stats
            ;;
        update)
            update_dependencies
            ;;
        audit)
            security_audit
            ;;
        optimize)
            optimize
            ;;
        dev:reset)
            dev_reset
            ;;
        dev:testdata)
            generate_test_data
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

main "$@"
