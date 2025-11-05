# 🚀 RBAC Quick Start Guide

## What Was Implemented

✅ **Separate Login Portal for Document Management**
✅ **Role-Based Access Control (RBAC) System**
✅ **User Management Section in Admin Panel**
✅ **3 Predefined Roles with Granular Permissions**
✅ **Audit Logging System**

---

## 🔐 Login Portals

### 1. Admin Portal (Super Admin & Admin)
**URL:** `http://localhost:3000/static/login.html`

**Super Admin:**
- Username: `superadmin`
- Password: `SuperAdmin@123`
- Access: **Everything** (Full system access + User Management)

**Regular Admin:**
- Username: `admin`
- Password: `Admin@123`
- Access: Certificates, Requests, Appeals, Complaints (NO User Management)

### 2. Document Manager Portal
**URL:** `http://localhost:3000/static/document-manager-login.html`

**Document Manager:**
- Username: `docmanager`
- Password: `DocManager@123`
- Access: **Only** Document Upload & Bulk Upload

---

## 📁 Key Pages

| Page | URL | Access |
|------|-----|--------|
| Admin Login | `/static/login.html` | Everyone |
| Document Manager Login | `/static/document-manager-login.html` | Everyone |
| Main Dashboard | `/static/dashboard.html` | All logged-in users |
| User Management | `/static/user-management.html` | Super Admin only |

---

## 🎭 Roles & Permissions

### Super Administrator
✅ **Full Access** to everything:
- Certificates: View, Issue, Cancel
- Documents: View, Upload, Edit, Delete, Bulk Upload
- Requests: View, Approve, Reject
- Appeals: View, Resolve
- Complaints: View, Resolve
- **Users: View, Create, Edit, Delete, Assign Roles** ← Unique to Super Admin
- System: Settings, Audit Logs, Statistics

### Administrator
✅ **Certificate Management**:
- Certificates: View, Issue, Cancel, Search
- Documents: View only
- Requests: View, Approve, Reject
- Appeals: View, Resolve
- Complaints: View, Resolve
- Statistics: View

❌ **Cannot access:**
- User Management
- Document Upload/Edit/Delete
- System Settings

### Document Manager
✅ **Document Operations Only**:
- Documents: View, Upload, Edit, Delete, Bulk Upload
- Statistics: View (document-related)

❌ **Cannot access:**
- Certificates
- Requests
- Appeals
- Complaints
- User Management

---

## 🛠️ User Management (Super Admin Only)

### Access User Management:
1. Login as `superadmin`
2. Go to: `http://localhost:3000/static/user-management.html`

### Create New User:
1. Click **"➕ Create New User"**
2. Fill in:
   - Username (required)
   - Full Name (required)
   - Email (optional)
   - Organization (optional)
   - Password (required, min 8 chars)
   - Role (required): Choose from
     - Super Administrator
     - Administrator
     - Document Manager
3. Click **"Create User"**

### Features:
- View all admin users in a table
- See user stats (Total, Active, by Role)
- Delete users (except yourself)
- Edit user details
- Assign/remove roles

---

## 🔌 API Endpoints (for developers)

### Authentication
```bash
# Login (returns JWT token + permissions)
POST /api/auth/login
Body: { "username": "...", "password": "..." }

# Get current user info
GET /api/auth/me
Header: Authorization: Bearer <token>
```

### User Management (requires permissions)
```bash
# List all users
GET /api/user-management/users

# Create user
POST /api/user-management/users
Body: { "username", "name", "email", "password", "role" }

# Delete user
DELETE /api/user-management/users/:userId

# Get all roles
GET /api/user-management/roles

# Get all permissions
GET /api/user-management/permissions

# View audit logs
GET /api/user-management/audit-logs
```

---

## 🧪 Testing the System

### Test 1: Super Admin Full Access
```bash
1. Login at /static/login.html with superadmin
2. Access dashboard - should see everything
3. Go to /static/user-management.html - should work
4. Try creating a new user - should work
```

### Test 2: Admin Limited Access
```bash
1. Login at /static/login.html with admin
2. Access dashboard - should see certificates, requests, etc.
3. Try to access /static/user-management.html - should get permission error
4. Bulk upload section - should be hidden or disabled
```

### Test 3: Document Manager Restricted Access
```bash
1. Login at /static/document-manager-login.html with docmanager
2. Access dashboard - should only see bulk upload section
3. Certificates section - should be hidden
4. Try to access /static/user-management.html - should get permission error
```

---

## 📋 Permission Keys Reference

Use these in your code to check permissions:

```javascript
// Get user permissions
const user = JSON.parse(localStorage.getItem('user'));
const permissions = user.permissions; // Array of permission keys

// Check permission examples:
if (permissions.includes('users.create')) {
  // Show "Create User" button
}

if (permissions.includes('documents.bulk_upload')) {
  // Show bulk upload section
}

if (permissions.includes('certificates.cancel')) {
  // Show cancel certificate button
}
```

**All Permission Keys:**
- `certificates.view`, `certificates.issue`, `certificates.cancel`, `certificates.search`
- `documents.view`, `documents.upload`, `documents.edit`, `documents.delete`, `documents.bulk_upload`
- `requests.view`, `requests.approve`, `requests.reject`
- `appeals.view`, `appeals.resolve`
- `complaints.view`, `complaints.resolve`
- `users.view`, `users.create`, `users.edit`, `users.delete`, `users.assign_roles`
- `system.settings`, `system.audit_logs`, `system.statistics`

---

## 🔄 Creating Custom Roles (Advanced)

You can create custom roles via SQL:

```sql
-- Example: Create "Certificate Reviewer" role
INSERT INTO admin_roles (id, role_name, display_name, description, permissions, is_active)
VALUES (
  'role_cert_reviewer',
  'certificate_reviewer',
  'Certificate Reviewer',
  'Can only view and search certificates',
  '["certificates.view","certificates.search","system.statistics"]',
  1
);
```

Then assign to user:
```sql
INSERT INTO user_role_assignments (id, user_id, role_id, assigned_by)
VALUES ('assignment_id', 'user_id', 'role_cert_reviewer', 'superadmin');
```

---

## 🐛 Troubleshooting

### Issue: "Permission denied" when accessing page
**Solution:** Check user role and permissions
```javascript
// In browser console:
const user = JSON.parse(localStorage.getItem('user'));
console.log('Role:', user.role);
console.log('Permissions:', user.permissions);
```

### Issue: User Management page shows 403 error
**Solution:** Only Super Admins can access User Management. Regular admins and document managers cannot.

### Issue: Document Manager can't login at admin portal
**Solution:** Document Managers must use `/static/document-manager-login.html`, not the regular admin login.

### Issue: Can't see certain sections in dashboard
**Solution:** This is expected behavior based on role. Each role has different access levels.

---

## 📊 Audit Logs

All admin actions are logged automatically. Super Admins can view logs:

```bash
GET /api/user-management/audit-logs?module=users&limit=100
```

Logs include:
- Who performed the action
- What action was performed
- When it happened
- IP address
- User agent
- Resource affected

---

## 🔒 Security Best Practices

1. **Change Default Passwords** immediately after first login
2. **Use Strong Passwords**: Min 8 chars, include numbers, special chars
3. **Review Audit Logs** regularly for suspicious activity
4. **Limit Super Admin** access to trusted personnel only
5. **Rotate JWT Secrets** periodically (in `.env` file)

---

## ✅ Quick Checklist

- [ ] RBAC system is running
- [ ] All 3 default users created
- [ ] Super Admin can login at `/static/login.html`
- [ ] Document Manager can login at `/static/document-manager-login.html`
- [ ] User Management accessible to Super Admin only
- [ ] Permissions are working at API level
- [ ] Audit logs are being created
- [ ] Default passwords have been changed

---

## 📞 Support

For issues or questions:
1. Check server logs: `tail -f /root/pramaan/backend/server.log`
2. Check database: `sqlite3 /root/pramaan/backend/certificates.db`
3. Review: `/root/pramaan/RBAC_IMPLEMENTATION.md` for technical details

---

**System:** E-Pramaan Certificate Management
**Version:** 1.0 RBAC
**Updated:** November 5, 2025
