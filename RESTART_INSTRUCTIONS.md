# Server Restart Instructions

## Error: 404 on /api/certificates/cancel

You're seeing this error because the backend server is still running the old code with `/revoke` routes, but the frontend has been updated to use `/cancel` routes.

## Solution

### Option 1: Restart Backend Server (Recommended)

1. **Stop the current backend server** (if running):
   ```bash
   # Find the process
   ps aux | grep node
   # Kill it
   kill <process_id>
   # OR use pkill
   pkill -f "node.*backend"
   ```

2. **Rebuild and start the backend**:
   ```bash
   cd /root/pramaan/backend
   npm run build
   npm start
   ```

### Option 2: Use Development Mode (Auto-reload)

If you're in development, use nodemon for auto-reload:

```bash
cd /root/pramaan/backend
npm run dev
```

## What Changed?

We renamed all "revoke" terminology to "cancelled" across the entire application:

- Route: `/api/certificates/revoke/:certHash` → `/api/certificates/cancel/:certHash`
- Function: `revokeCertificate()` → `cancelCertificate()`
- Database: `revocation_logs` → `cancellation_logs`
- Smart Contract: `revokeCertificate()` → `cancelCertificate()`
- All UI labels: "Revoke" → "Cancel"/"Cancelled"

## Verification

After restarting, verify the route works:

```bash
# Check if the route is accessible (should return 401/403 without auth)
curl http://localhost:3000/api/certificates/cancel/test-hash
```

## Additional Changes - Ticket ID System

We also added a ticket ID system for complaints:

- New utility: `backend/src/utils/ticketGenerator.ts`
- Updated database schema to include `ticket_id` column
- Format: `TKT-YYYYMMDD-XXXX`
- New endpoint: `GET /api/complaints/ticket/:ticketId`

## Database Migration Needed?

If you see database errors about missing `ticket_id` column:

1. **For SQLite (default)**: Delete and recreate the database:
   ```bash
   cd /root/pramaan/backend
   rm certificates.db
   npm start  # Will auto-create with new schema
   ```

2. **For PostgreSQL**: Run migration:
   ```sql
   ALTER TABLE complaints ADD COLUMN ticket_id TEXT UNIQUE;
   ALTER TABLE cert_status TYPE RENAME VALUE 'revoked' TO 'cancelled';
   ALTER TABLE revocation_logs RENAME TO cancellation_logs;
   -- etc.
   ```

## Smart Contract Redeployment

The Solidity contract was also updated. To use the new contract:

1. **Compile the contract**:
   ```bash
   cd /root/pramaan
   npx hardhat compile
   ```

2. **Deploy to your network**:
   ```bash
   npx hardhat run scripts/deploy.ts --network <your-network>
   ```

3. **Update contract address** in backend configuration

## Quick Start Commands

```bash
# Full restart process
cd /root/pramaan/backend
npm run build
npm start

# Or in development mode with auto-reload
npm run dev
```

That's it! After restarting the server, the cancel functionality will work properly.
