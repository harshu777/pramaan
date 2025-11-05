# 🧪 RBAC Testing Guide

## Connection Error Fix

### Issue
"Connection error" when logging into document-manager-login.html

### Root Cause
The hardcoded `http://localhost:3000` in the fetch URL doesn't work when accessing the server from a different hostname/IP.

### ✅ Fix Applied
Changed from:
```javascript
const response = await fetch('http://localhost:3000/api/auth/login', {...});
```

To:
```javascript
const apiUrl = window.location.origin + '/api/auth/login';
const response = await fetch(apiUrl, {...});
```

This uses the current page's origin (protocol + hostname + port) automatically.

---

## ✅ API Endpoints Verified Working

### Test Results:

**Super Admin Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"SuperAdmin@123"}'
```
✅ **Result:** Success - Returns token and 24 permissions

**Document Manager Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"docmanager","password":"DocManager@123"}'
```
✅ **Result:** Success - Returns token and 6 document permissions

---

## 🔑 Test Credentials

### Super Administrator
- **URL:** http://YOUR_SERVER_IP:3000/static/login.html
- **Username:** `superadmin`
- **Password:** `SuperAdmin@123`
- **Expected:** Full access to all features

### Administrator
- **URL:** http://YOUR_SERVER_IP:3000/static/login.html
- **Username:** `admin`
- **Password:** `Admin@123`
- **Expected:** Certificate management, no user management

### Document Manager
- **URL:** http://YOUR_SERVER_IP:3000/static/document-manager-login.html
- **Username:** `docmanager`
- **Password:** `DocManager@123`
- **Expected:** Document upload and bulk upload only

---

## 📝 Testing Checklist

### 1. Super Admin Tests

- [ ] Login at `/static/login.html` with superadmin credentials
- [ ] Dashboard loads successfully
- [ ] Navigate to User Management: `/static/user-management.html`
- [ ] User Management page loads (should work)
- [ ] View user list
- [ ] Click "Create New User" button
- [ ] Fill form and create a test user
- [ ] Verify new user appears in list
- [ ] Try deleting a user (not yourself)
- [ ] Check statistics are showing correct numbers

### 2. Document Manager Tests

- [ ] Login at `/static/document-manager-login.html` with docmanager credentials
- [ ] Dashboard loads
- [ ] Only document/bulk upload sections visible
- [ ] Certificate sections are hidden
- [ ] Try to access `/static/user-management.html` directly
- [ ] Should get permission denied or redirect
- [ ] Upload a document (if available)
- [ ] View uploaded documents

### 3. Regular Admin Tests

- [ ] Login at `/static/login.html` with admin credentials
- [ ] Dashboard loads with certificate sections
- [ ] Can view certificates
- [ ] Can approve/reject requests
- [ ] Try to access `/static/user-management.html`
- [ ] Should get permission denied
- [ ] Bulk upload section hidden or disabled

### 4. Permission Enforcement Tests

**Test API Permissions Directly:**

```bash
# Get token for docmanager
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"docmanager","password":"DocManager@123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Try to access user management (should fail)
curl -X GET http://localhost:3000/api/user-management/users \
  -H "Authorization: Bearer $TOKEN"

# Expected: 403 Forbidden with "Insufficient permissions"
```

```bash
# Get token for superadmin
ADMIN_TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"SuperAdmin@123"}' | \
  grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Try to access user management (should succeed)
curl -X GET http://localhost:3000/api/user-management/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Expected: 200 OK with user list
```

### 5. Audit Log Tests

- [ ] Login as superadmin
- [ ] Perform various actions (create user, delete user, etc.)
- [ ] Check audit logs via API:
```bash
curl -X GET "http://localhost:3000/api/user-management/audit-logs?limit=20" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
- [ ] Verify actions are logged with correct details

---

## 🐛 Troubleshooting

### "Connection error" in Browser

**Possible Causes:**

1. **Wrong URL in Browser**
   - Make sure you're accessing: `http://YOUR_IP:3000/static/document-manager-login.html`
   - Replace `YOUR_IP` with actual server IP
   - If accessing remotely, don't use `localhost`

2. **Server Not Running**
   ```bash
   # Check if server is running
   curl http://localhost:3000/health

   # Expected: {"status":"healthy","timestamp":"..."}
   ```

3. **Port 3000 Blocked**
   - Check firewall allows port 3000
   - Check if running behind a proxy

4. **CORS Issues**
   - Server has CORS enabled, so this shouldn't be an issue
   - Check browser console for CORS errors

### "Invalid credentials"

**Causes:**
- Wrong username or password
- User doesn't exist
- User is inactive

**Check:**
```bash
# List all users
sqlite3 /root/pramaan/backend/certificates.db "SELECT username, name, role, is_active FROM issuers;"
```

### "Permission denied" / 403 Errors

**Expected Behavior:**
- Document Managers cannot access `/api/user-management/*`
- Regular Admins cannot access `/api/user-management/*`
- Only Super Admins can access user management

**Check User Permissions:**
```bash
# In browser console after login:
const user = JSON.parse(localStorage.getItem('user'));
console.log('Permissions:', user.permissions);
```

### Dashboard Shows Wrong Sections

**Current Status:**
The main dashboard (`dashboard.html`) still shows all sections to everyone.

**To Fix:**
Add role-based visibility in dashboard.html:
```javascript
// Add this after login
const user = JSON.parse(localStorage.getItem('user'));

// Hide sections based on permissions
if (!user.permissions.includes('certificates.view')) {
  document.getElementById('certificates-section').style.display = 'none';
}

if (!user.permissions.includes('users.view')) {
  document.getElementById('user-management-link').style.display = 'none';
}

if (!user.permissions.includes('documents.upload')) {
  document.getElementById('bulk-upload-section').style.display = 'none';
}
```

---

## 📊 Expected Permission Results

### Super Admin
```json
{
  "permissions": [
    "certificates.view", "certificates.issue", "certificates.cancel", "certificates.search",
    "documents.view", "documents.upload", "documents.edit", "documents.delete", "documents.bulk_upload",
    "requests.view", "requests.approve", "requests.reject",
    "appeals.view", "appeals.resolve",
    "complaints.view", "complaints.resolve",
    "users.view", "users.create", "users.edit", "users.delete", "users.assign_roles",
    "system.settings", "system.audit_logs", "system.statistics"
  ]
}
```

### Administrator
```json
{
  "permissions": [
    "certificates.view", "certificates.issue", "certificates.cancel", "certificates.search",
    "documents.view",
    "requests.view", "requests.approve", "requests.reject",
    "appeals.view", "appeals.resolve",
    "complaints.view", "complaints.resolve",
    "system.statistics"
  ]
}
```

### Document Manager
```json
{
  "permissions": [
    "documents.view", "documents.upload", "documents.edit",
    "documents.delete", "documents.bulk_upload",
    "system.statistics"
  ]
}
```

---

## ✅ Verification Commands

### Check Server Health
```bash
curl http://localhost:3000/health
```

### Test Auth Endpoint
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"SuperAdmin@123"}'
```

### List All Users
```bash
sqlite3 /root/pramaan/backend/certificates.db \
  "SELECT id, username, name, role, is_active FROM issuers ORDER BY created_at DESC;"
```

### Check Roles
```bash
sqlite3 /root/pramaan/backend/certificates.db \
  "SELECT role_name, display_name FROM admin_roles WHERE is_active = 1;"
```

### View Audit Logs
```bash
sqlite3 /root/pramaan/backend/certificates.db \
  "SELECT user_name, action, module, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10;"
```

---

## 📞 Support Checklist

If something isn't working:

1. ✅ Check server is running: `curl http://localhost:3000/health`
2. ✅ Check server logs: `tail -f /root/pramaan/backend/server.log`
3. ✅ Verify user exists: `sqlite3 ... "SELECT * FROM issuers WHERE username='...'"`
4. ✅ Check browser console for errors (F12)
5. ✅ Try with correct URL (use server IP, not localhost if remote)
6. ✅ Clear browser cache and cookies
7. ✅ Try in incognito/private window
8. ✅ Verify port 3000 is accessible

---

**Document Version:** 1.0
**Last Updated:** November 5, 2025
**System:** E-Pramaan RBAC
