# Deployment Guide for pramaan.0-4.nl

## Issue
The remote server at `https://pramaan.0-4.nl/` is running old code that still uses `/revoke` endpoints, but the frontend has been updated to use `/cancel` endpoints.

## Solution Implemented

✅ **Added backward compatibility** - The backend now supports BOTH routes:
- `/api/certificates/cancel/:certHash` (NEW - preferred)
- `/api/certificates/revoke/:certHash` (LEGACY - for backward compatibility)

Both routes point to the same handler, so either will work.

## Deployment Steps

### Step 1: Upload Updated Code to Server

```bash
# From your local machine, sync the code to the remote server
rsync -avz --exclude 'node_modules' --exclude '.git' \
  /root/pramaan/backend/ user@pramaan.0-4.nl:/path/to/backend/

# OR use git if you have it set up
ssh user@pramaan.0-4.nl
cd /path/to/backend
git pull origin main
```

### Step 2: Rebuild on Remote Server

```bash
# SSH into the remote server
ssh user@pramaan.0-4.nl

# Navigate to backend directory
cd /path/to/backend

# Install dependencies (if needed)
npm install

# Build TypeScript code
npm run build
```

### Step 3: Restart the Server

```bash
# Find the running process
ps aux | grep "node.*server.js"

# Stop the old process
kill <PID>

# OR use pm2 if you have it
pm2 restart backend

# OR use systemd if configured
sudo systemctl restart pramaan-backend

# OR start manually
npm start
```

## Verification

After deployment, test both endpoints:

```bash
# Test the new cancel endpoint
curl -X POST https://pramaan.0-4.nl/api/certificates/cancel/test-hash \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Test"}'

# Test the legacy revoke endpoint (should also work)
curl -X POST https://pramaan.0-4.nl/api/certificates/revoke/test-hash \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Test"}'
```

Both should return the same response (or 401/403 without valid auth).

## What Changed?

### Backend Changes:
1. **Routes**: Added `/cancel` route, kept `/revoke` for compatibility
2. **Function names**: `revokeCertificate()` → `cancelCertificate()`
3. **Database**: `revocation_logs` → `cancellation_logs`
4. **Labels**: All "revoke" UI text → "cancel/cancelled"
5. **Ticket System**: Added ticket IDs to complaints

### Frontend Changes:
1. **API calls**: Updated to use `/cancel` endpoint
2. **UI labels**: "Revoke" → "Cancel" / "Cancelled"
3. **Complaint tracking**: Added ticket ID display and tracking

## Database Migration

If the remote server database needs updating:

### For SQLite:
```bash
# Backup existing database
cp certificates.db certificates.db.backup

# Option 1: Automatic migration (if schema auto-creates)
# Just restart the server and it may auto-migrate

# Option 2: Manual migration
sqlite3 certificates.db << 'EOF'
-- Add ticket_id column if not exists
ALTER TABLE complaints ADD COLUMN ticket_id TEXT UNIQUE;

-- Rename table (SQLite doesn't support direct rename)
CREATE TABLE cancellation_logs AS SELECT * FROM revocation_logs;
DROP TABLE revocation_logs;
EOF
```

### For PostgreSQL:
```sql
-- Add ticket_id to complaints
ALTER TABLE complaints ADD COLUMN IF NOT EXISTS ticket_id TEXT UNIQUE;

-- Rename revocation_logs to cancellation_logs
ALTER TABLE revocation_logs RENAME TO cancellation_logs;
ALTER TABLE cancellation_logs RENAME COLUMN revoked_by TO cancelled_by;
ALTER TABLE cancellation_logs RENAME COLUMN revocation_reason TO cancellation_reason;
ALTER TABLE cancellation_logs RENAME COLUMN revoked_at TO cancelled_at;

-- Update enum type
ALTER TYPE cert_status RENAME VALUE 'revoked' TO 'cancelled';
```

## Process Manager Setup (Recommended)

### Using PM2:
```bash
# Install PM2 globally
npm install -g pm2

# Start the server with PM2
cd /path/to/backend
pm2 start dist/server.js --name pramaan-backend

# Save the process list
pm2 save

# Set up auto-start on reboot
pm2 startup
```

### Using systemd:
Create `/etc/systemd/system/pramaan-backend.service`:

```ini
[Unit]
Description=Pramaan Backend Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/backend
ExecStart=/usr/bin/node /path/to/backend/dist/server.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable pramaan-backend
sudo systemctl start pramaan-backend
sudo systemctl status pramaan-backend
```

## Rollback Plan

If something goes wrong:

```bash
# Restore database backup
cp certificates.db.backup certificates.db

# Checkout previous version
git checkout HEAD~1

# Rebuild and restart
npm run build
pm2 restart backend
```

## Testing Checklist

After deployment, verify:

- [ ] Server is running (check status)
- [ ] Dashboard loads without errors
- [ ] Can view certificates
- [ ] Can cancel certificates (new endpoint)
- [ ] Can create complaints and receive ticket ID
- [ ] Can track complaints by ticket ID
- [ ] Admin panel shows ticket IDs in complaints table

## Notes

- The `/revoke` endpoint is kept for **backward compatibility only**
- Consider removing it in a future version after all clients are updated
- The ticket ID system requires the database schema to be updated
- Smart contract changes require redeployment to blockchain

## Support

If issues persist:
1. Check server logs: `pm2 logs backend` or `journalctl -u pramaan-backend -f`
2. Verify environment variables are set correctly
3. Check database connection
4. Ensure all dependencies are installed
5. Verify file permissions

## Quick Deployment Commands

```bash
# Full deployment sequence
ssh user@pramaan.0-4.nl << 'ENDSSH'
cd /path/to/backend
git pull
npm install
npm run build
pm2 restart backend
pm2 logs backend --lines 50
ENDSSH
```

That's it! The server should now support both the old and new endpoints.
