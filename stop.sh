#!/bin/bash

# Certificate Management System - Stop Script
# This script stops all running services

set -e

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# PID file locations
HARDHAT_PID_FILE=".hardhat.pid"
BACKEND_PID_FILE=".backend.pid"

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

# Function to stop a service
stop_service() {
    local pid_file=$1
    local service_name=$2

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")

        if ps -p "$pid" > /dev/null 2>&1; then
            print_info "Stopping $service_name (PID: $pid)..."
            kill "$pid"

            # Wait for process to stop
            local count=0
            while ps -p "$pid" > /dev/null 2>&1 && [ $count -lt 10 ]; do
                sleep 1
                count=$((count + 1))
            done

            # Force kill if still running
            if ps -p "$pid" > /dev/null 2>&1; then
                print_info "Force stopping $service_name..."
                kill -9 "$pid"
            fi

            print_success "$service_name stopped"
        else
            print_info "$service_name is not running (stale PID file)"
        fi

        rm -f "$pid_file"
    else
        print_info "$service_name PID file not found"
    fi
}

# Main execution
main() {
    echo "=========================================="
    echo "Certificate Management System - Shutdown"
    echo "=========================================="
    echo ""

    # Stop services
    stop_service "$BACKEND_PID_FILE" "Backend Server"
    stop_service "$HARDHAT_PID_FILE" "Hardhat Node"

    echo ""
    print_success "All services stopped!"
    echo "=========================================="
}

# Run main function
main
