#!/bin/bash

# Certificate Management System - Start Script
# This script starts Hardhat node and Backend server in the background

set -e

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# PID file locations
HARDHAT_PID_FILE=".hardhat.pid"
BACKEND_PID_FILE=".backend.pid"

# Log file locations
HARDHAT_LOG="hardhat-node.log"
BACKEND_LOG="backend.log"

# Function to print colored messages
print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a process is running
is_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        fi
    fi
    return 1
}

# Function to start Hardhat node
start_hardhat() {
    print_info "Starting Hardhat node..."

    if is_running "$HARDHAT_PID_FILE"; then
        print_info "Hardhat node is already running (PID: $(cat $HARDHAT_PID_FILE))"
        return
    fi

    # Start Hardhat node in background
    nohup npx hardhat node > "$HARDHAT_LOG" 2>&1 &
    local pid=$!
    echo $pid > "$HARDHAT_PID_FILE"

    print_success "Hardhat node started (PID: $pid)"
    print_info "Logs: $HARDHAT_LOG"

    # Wait for Hardhat to be ready
    print_info "Waiting for Hardhat node to be ready..."
    sleep 5

    if is_running "$HARDHAT_PID_FILE"; then
        print_success "Hardhat node is running on http://localhost:8545"
    else
        print_error "Hardhat node failed to start. Check $HARDHAT_LOG for details."
        exit 1
    fi
}

# Function to deploy contracts
deploy_contracts() {
    print_info "Deploying smart contracts to local Hardhat network..."

    if ! is_running "$HARDHAT_PID_FILE"; then
        print_error "Hardhat node is not running. Cannot deploy contracts."
        exit 1
    fi

    # Deploy contracts
    npm run deploy:local

    if [ $? -eq 0 ]; then
        print_success "Contracts deployed successfully"
    else
        print_error "Contract deployment failed"
        exit 1
    fi
}

# Function to start backend server
start_backend() {
    print_info "Starting backend server..."

    if is_running "$BACKEND_PID_FILE"; then
        print_info "Backend server is already running (PID: $(cat $BACKEND_PID_FILE))"
        return
    fi

    # Navigate to backend directory and start server
    cd backend

    # Start backend in background
    nohup npm run dev > "../$BACKEND_LOG" 2>&1 &
    local pid=$!
    echo $pid > "../$BACKEND_PID_FILE"

    cd ..

    print_success "Backend server started (PID: $pid)"
    print_info "Logs: $BACKEND_LOG"

    # Wait for backend to be ready
    print_info "Waiting for backend server to be ready..."
    sleep 5

    if is_running "$BACKEND_PID_FILE"; then
        print_success "Backend server is running"
    else
        print_error "Backend server failed to start. Check $BACKEND_LOG for details."
        exit 1
    fi
}

# Main execution
main() {
    echo "=========================================="
    echo "Certificate Management System - Startup"
    echo "=========================================="
    echo ""

    # Check if node_modules exist
    if [ ! -d "node_modules" ]; then
        print_info "Installing root dependencies..."
        npm install
    fi

    if [ ! -d "backend/node_modules" ]; then
        print_info "Installing backend dependencies..."
        cd backend && npm install && cd ..
    fi

    # Start services
    start_hardhat
    deploy_contracts
    start_backend

    echo ""
    echo "=========================================="
    print_success "All services started successfully!"
    echo "=========================================="
    echo ""
    echo "Service Status:"
    echo "  - Hardhat Node: http://localhost:8545"
    echo "  - Backend API: Check backend logs for port"
    echo ""
    echo "PID Files:"
    echo "  - Hardhat: $HARDHAT_PID_FILE"
    echo "  - Backend: $BACKEND_PID_FILE"
    echo ""
    echo "Log Files:"
    echo "  - Hardhat: $HARDHAT_LOG"
    echo "  - Backend: $BACKEND_LOG"
    echo ""
    echo "To stop services, run: ./stop.sh"
    echo "To view logs: tail -f $HARDHAT_LOG"
    echo "             tail -f $BACKEND_LOG"
    echo "=========================================="
}

# Run main function
main
