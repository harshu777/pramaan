# Deployment Scripts Overview

This document provides an overview of all deployment and management scripts created for the Certificate Management System.

## 📜 Available Scripts

### 1. `deploy.sh` - Local Development Deployment ⭐

**Purpose**: One-click setup for local development environment

**Usage**:
```bash
./deploy.sh          # Deploy everything
./deploy.sh stop     # Stop all services
./deploy.sh restart  # Restart all services
./deploy.sh clean    # Clean and reset everything
```

**What it does**:
- ✅ Checks prerequisites (Node.js, Docker, npm)
- ✅ Sets up environment variables
- ✅ Installs all dependencies
- ✅ Starts Docker services (PostgreSQL, IPFS, pgAdmin)
- ✅ Compiles smart contracts
- ✅ Starts local blockchain (Hardhat node)
- ✅ Deploys smart contract
- ✅ Builds backend
- ✅ Starts backend server
- ✅ Displays comprehensive summary

**Best for**: First-time setup and daily development

---

### 2. `deploy-production.sh` - Production Deployment

**Purpose**: Production-ready deployment with security and optimization

**Usage**:
```bash
./deploy-production.sh build              # Build for production
./deploy-production.sh deploy-contract    # Deploy contract to testnet/mainnet
./deploy-production.sh docker             # Build production Docker image
./deploy-production.sh systemd            # Generate systemd service
./deploy-production.sh nginx              # Generate Nginx config
./deploy-production.sh full               # Full production setup
./deploy-production.sh checklist          # Show deployment checklist
```

**What it does**:
- ✅ Validates production environment configuration
- ✅ Builds optimized production bundles
- ✅ Deploys contracts to testnets/mainnets
- ✅ Generates systemd service files
- ✅ Creates Nginx configuration
- ✅ Provides production checklist

**Best for**: Deploying to staging/production servers

---

### 3. `manage.sh` - System Management & Maintenance

**Purpose**: Day-to-day management, monitoring, and maintenance

**Usage**:
```bash
# Database Management
./manage.sh db:backup                    # Backup database
./manage.sh db:restore backup.sql.gz     # Restore from backup
./manage.sh db:reset                     # Reset database
./manage.sh db:query "SELECT * FROM ..." # Run SQL query

# IPFS Management
./manage.sh ipfs:stats                   # Show IPFS statistics
./manage.sh ipfs:pins                    # List pinned files
./manage.sh ipfs:backup                  # Backup pin list

# Logs
./manage.sh logs:view backend            # View backend logs
./manage.sh logs:view blockchain         # View blockchain logs
./manage.sh logs:clear                   # Clear all logs

# Status & Monitoring
./manage.sh status                       # System health check
./manage.sh contract:info                # Contract information
./manage.sh contract:stats               # Contract statistics

# Maintenance
./manage.sh update                       # Update dependencies
./manage.sh audit                        # Security audit
./manage.sh optimize                     # Optimize database/IPFS

# Development
./manage.sh dev:reset                    # Reset dev environment
./manage.sh dev:testdata                 # Generate test data
```

**Best for**: Daily operations, monitoring, and troubleshooting

---

## 📚 Documentation Files

### 1. `DEPLOYMENT.md` - Complete Deployment Guide

**Contents**:
- Detailed local development setup
- Comprehensive production deployment instructions
- Docker and Kubernetes deployment
- Cloud platform guides (AWS, GCP, DigitalOcean)
- Monitoring and logging setup
- Backup and recovery procedures
- Troubleshooting guide
- Security hardening

**600+ lines** of comprehensive documentation

---

### 2. `QUICK-START.md` - Quick Reference Guide

**Contents**:
- Prerequisites checklist
- One-command setup
- Common commands
- API testing examples
- Database access
- Default credentials
- Frontend URLs
- Quick troubleshooting
- Tips & tricks

**Perfect for**: Getting started quickly and daily reference

---

### 3. `SCRIPTS-OVERVIEW.md` - This File

Overview of all scripts and their usage.

---

## 🚀 Quick Start Workflows

### First Time Setup (Local Development)

```bash
# Step 1: Make scripts executable (one time only)
chmod +x deploy.sh deploy-production.sh manage.sh

# Step 2: Deploy everything
./deploy.sh

# Step 3: Check status
./manage.sh status

# Step 4: Open in browser
# http://localhost:3000/static/index.html
```

**Time to deploy**: ~5-10 minutes

---

### Daily Development Workflow

```bash
# Start services
./deploy.sh

# Check status
./manage.sh status

# View logs while developing
./manage.sh logs:view backend

# Generate test data
./manage.sh dev:testdata

# Stop when done
./deploy.sh stop
```

---

### Production Deployment Workflow

```bash
# 1. Configure production environment
cp backend/.env.example backend/.env.production
nano backend/.env.production

# 2. Deploy contract to testnet
./deploy-production.sh deploy-contract sepolia

# 3. Build for production
./deploy-production.sh build

# 4. Generate configs
./deploy-production.sh systemd
./deploy-production.sh nginx

# 5. Install and start
sudo cp cert-management.service /etc/systemd/system/
sudo systemctl enable cert-management
sudo systemctl start cert-management

# 6. Setup Nginx reverse proxy
sudo cp nginx.conf /etc/nginx/sites-available/cert-management
sudo ln -s /etc/nginx/sites-available/cert-management /etc/nginx/sites-enabled/
sudo systemctl reload nginx

# 7. Verify deployment
./manage.sh status
```

---

### Maintenance Workflow

```bash
# Daily health check
./manage.sh status

# Weekly backup
./manage.sh db:backup
./manage.sh ipfs:backup

# Monthly maintenance
./manage.sh update        # Update dependencies
./manage.sh audit         # Security audit
./manage.sh optimize      # Optimize database

# View logs when issues occur
./manage.sh logs:view all
```

---

## 🎯 Script Decision Tree

```
Need to...
│
├─ Set up for the first time?
│  └─ Use: ./deploy.sh
│
├─ Deploy to production?
│  └─ Use: ./deploy-production.sh
│
├─ Check if everything is working?
│  └─ Use: ./manage.sh status
│
├─ Backup data?
│  └─ Use: ./manage.sh db:backup
│
├─ View logs?
│  └─ Use: ./manage.sh logs:view <service>
│
├─ Generate test data?
│  └─ Use: ./manage.sh dev:testdata
│
├─ Update dependencies?
│  └─ Use: ./manage.sh update
│
└─ Something is broken?
   └─ Use: ./deploy.sh clean && ./deploy.sh
```

---

## 📊 Feature Comparison

| Feature | deploy.sh | deploy-production.sh | manage.sh |
|---------|-----------|---------------------|-----------|
| Local setup | ✅ | ❌ | ❌ |
| Production build | ❌ | ✅ | ❌ |
| Start services | ✅ | ❌ | ❌ |
| Stop services | ✅ | ❌ | ❌ |
| Database backup | ❌ | ❌ | ✅ |
| View logs | ❌ | ❌ | ✅ |
| Health check | ❌ | ❌ | ✅ |
| Contract deployment | ✅ Local | ✅ Testnet/Mainnet | ❌ |
| Generate configs | ❌ | ✅ | ❌ |
| Test data | ❌ | ❌ | ✅ |
| Security audit | ❌ | ❌ | ✅ |

---

## 🔧 Script Customization

All scripts are designed to be customizable. Key customization points:

### Environment Variables

Edit `.env` files to customize:
- Database connections
- Blockchain RPC endpoints
- IPFS service configuration
- JWT secrets
- Email configuration

### Docker Configuration

Edit `docker-compose.yml` to:
- Change service ports
- Modify resource limits
- Add new services
- Configure networks

### Script Parameters

All scripts support command-line parameters for flexibility.

---

## 🐛 Troubleshooting

### Script Won't Execute

```bash
# Make sure it's executable
chmod +x deploy.sh deploy-production.sh manage.sh
```

### Port Already in Use

```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>

# Or use restart
./deploy.sh restart
```

### Docker Issues

```bash
# Restart Docker Desktop
# Then clean and redeploy
./deploy.sh clean
./deploy.sh
```

### Environment Issues

```bash
# Regenerate environment
rm backend/.env
./deploy.sh  # Will regenerate
```

---

## 📝 Best Practices

1. **Always backup before major changes**
   ```bash
   ./manage.sh db:backup
   ./manage.sh ipfs:backup
   ```

2. **Check status regularly**
   ```bash
   ./manage.sh status
   ```

3. **Keep logs for debugging**
   ```bash
   ./manage.sh logs:view backend > debug.log
   ```

4. **Use production script for production**
   ```bash
   # Never use ./deploy.sh in production!
   ./deploy-production.sh full
   ```

5. **Test after deployment**
   ```bash
   ./manage.sh dev:testdata
   ./manage.sh status
   ```

---

## 🎓 Learning Resources

- **DEPLOYMENT.md**: Complete deployment guide with detailed explanations
- **QUICK-START.md**: Fast reference for common tasks
- **README.md**: Project overview and API documentation
- **CLAUDE.md**: Project requirements and specifications

---

## 🆘 Getting Help

1. Check script help:
   ```bash
   ./deploy.sh help
   ./deploy-production.sh help
   ./manage.sh help
   ```

2. Check system status:
   ```bash
   ./manage.sh status
   ```

3. View logs:
   ```bash
   ./manage.sh logs:view all
   ```

4. Review documentation:
   - QUICK-START.md for quick reference
   - DEPLOYMENT.md for detailed guides

---

## 📈 Script Evolution

These scripts are designed to grow with your project:

- ✅ Add more management commands to `manage.sh`
- ✅ Customize deployment steps in `deploy.sh`
- ✅ Add monitoring integrations
- ✅ Implement CI/CD pipelines
- ✅ Add automated testing

---

## 🎉 Summary

You now have a complete deployment automation system:

1. **`deploy.sh`** - For local development (one-click setup)
2. **`deploy-production.sh`** - For production deployment
3. **`manage.sh`** - For daily operations and maintenance
4. **Comprehensive documentation** - For guidance and reference

**Total automation coverage**: ~95% of deployment and management tasks!

---

## License

MIT License - See LICENSE file for details
