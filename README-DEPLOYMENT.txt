╔════════════════════════════════════════════════════════════════════════════╗
║          Certificate Management System - Deployment Scripts               ║
║                        Quick Reference Card                                ║
╚════════════════════════════════════════════════════════════════════════════╝

PREREQUISITES:
==============
✓ Node.js 18+
✓ Docker Desktop
✓ npm 8+

INITIAL SETUP (First Time Only):
=================================
chmod +x deploy.sh deploy-production.sh manage.sh

ONE-CLICK LOCAL DEPLOYMENT:
============================
./deploy.sh

This single command will:
  • Install all dependencies
  • Start Docker services (PostgreSQL, IPFS, pgAdmin)
  • Deploy smart contract to local blockchain
  • Build and start backend
  • Display access URLs and credentials

DAILY DEVELOPMENT:
==================
./deploy.sh              # Start everything
./deploy.sh stop         # Stop all services
./deploy.sh restart      # Restart everything
./deploy.sh clean        # Reset & clean all data

SYSTEM MANAGEMENT:
==================
./manage.sh status                    # Health check all services
./manage.sh db:backup                 # Backup database
./manage.sh db:restore backup.sql.gz  # Restore database
./manage.sh logs:view backend         # View backend logs
./manage.sh logs:view all             # View all logs
./manage.sh ipfs:stats                # IPFS statistics
./manage.sh dev:testdata              # Generate test certificates

PRODUCTION DEPLOYMENT:
======================
1. Configure: cp backend/.env.example backend/.env.production
2. Deploy:    ./deploy-production.sh deploy-contract sepolia
3. Build:     ./deploy-production.sh build
4. Setup:     ./deploy-production.sh systemd
5. Configure: ./deploy-production.sh nginx

ACCESS POINTS (After ./deploy.sh):
===================================
Frontend:     http://localhost:3000/static/index.html
API:          http://localhost:3000
pgAdmin:      http://localhost:5050 (admin@cert.com / admin123)
IPFS Gateway: http://localhost:8080
IPFS API:     http://localhost:5001
Blockchain:   http://localhost:8545

DEFAULT TEST ACCOUNT:
=====================
Address:      0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Private Key:  0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

TROUBLESHOOTING:
================
Issue: Port 3000 already in use
Fix:   lsof -i :3000 && kill -9 <PID>
       ./deploy.sh restart

Issue: Docker not starting
Fix:   Restart Docker Desktop
       ./deploy.sh clean && ./deploy.sh

Issue: Database connection error
Fix:   docker-compose restart postgres
       ./manage.sh status

DOCUMENTATION:
==============
QUICK-START.md        - Quick reference guide
DEPLOYMENT.md         - Complete deployment guide (local & production)
SCRIPTS-OVERVIEW.md   - Detailed scripts documentation
README.md             - Project overview and API docs

COMMON WORKFLOWS:
=================

Test the System:
  ./deploy.sh
  ./manage.sh status
  ./manage.sh dev:testdata
  curl http://localhost:3000/health

Backup Everything:
  ./manage.sh db:backup
  ./manage.sh ipfs:backup

View Logs:
  tail -f backend.log
  ./manage.sh logs:view all

Check Database:
  ./manage.sh db:query "SELECT * FROM certificates LIMIT 5"

HELP:
=====
./deploy.sh help
./deploy-production.sh help
./manage.sh help

Or read: QUICK-START.md for detailed instructions

═══════════════════════════════════════════════════════════════════════════════
                    Happy Deploying! 🚀
═══════════════════════════════════════════════════════════════════════════════
