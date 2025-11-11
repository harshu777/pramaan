#!/bin/bash

# Certificate Management System - Status Script
# This script checks the status of all services

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
print_running() {
    echo -e "${GREEN}[RUNNING]${NC} $1"
}

print_stopped() {
    echo -e "${RED}[STOPPED]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# Function to check service status
check_service() {
    local pid_file=$1
    local service_name=$2
    local log_file=$3

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")

        if ps -p "$pid" > /dev/null 2>&1; then
            print_running "$service_name (PID: $pid)"

            # Show last few log lines if available
            if [ -f "$log_file" ] && [ "$4" == "verbose" ]; then
                echo "  Last 5 log lines:"
                tail -n 5 "$log_file" | sed 's/^/    /'
            fi
        else
            print_stopped "$service_name (stale PID file found)"
        fi
    else
        print_stopped "$service_name (PID file not found)"
    fi
}

# Main execution
main() {
    local verbose=$1

    echo "=========================================="
    echo "Certificate Management System - Status"
    echo "=========================================="
    echo ""

    # Check services
    check_service "$HARDHAT_PID_FILE" "Hardhat Node" "$HARDHAT_LOG" "$verbose"
    check_service "$BACKEND_PID_FILE" "Backend Server" "$BACKEND_LOG" "$verbose"

    echo ""
    echo "Log Files:"
    echo "  - Hardhat: $HARDHAT_LOG"
    echo "  - Backend: $BACKEND_LOG"
    echo ""
    echo "Commands:"
    echo "  - Start services: ./start.sh"
    echo "  - Stop services: ./stop.sh"
    echo "  - View logs: tail -f $HARDHAT_LOG"
    echo "             tail -f $BACKEND_LOG"
    echo "=========================================="
}

# Run main function
main "$1"
