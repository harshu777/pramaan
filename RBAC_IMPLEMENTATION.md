# 🔐 RBAC Implementation for E-Pramaan System

## Overview

Successfully implemented a comprehensive Role-Based Access Control (RBAC) system with separate login portals for Document Management and User Management sections.

---

## 🎯 Key Features

### 1. **Separate Login Portals**
- **Admin Login**: `/static/login.html` - For Super Admin and Admin roles
- **Document Manager Login**: `/static/document-manager-login.html` - For Document Managers

### 2. **Three Predefined Roles**
- **Super Administrator**: Full system access including user management
- **Administrator**: Certificate and request management (no user management)
- **Document Manager**: Document upload and bulk upload only

### 3. **Granular Permissions**
- Module-based permissions (certificates, documents, requests, appeals, users, etc.)
- 23 fine-grained permissions across 7 modules
- Permission checking at API endpoint level

### 4. **User Management Interface**
- Create, edit, and delete admin users
- Assign roles to users
- View audit logs
- Accessible at: `/static/user-management.html`

### 5. **Audit Logging**
- All admin actions are logged
- Track who did what and when
- IP address and user agent tracking

---

## 📋 Default Users Created

### Super Admin
```
URL: http://localhost:3000/static/login.html
Username: superadmin
Password: SuperAdmin@123
Access: Full system access including user management
```

### Administrator
```
URL: http://localhost:3000/static/login.html
Username: admin
Password: Admin@123
Access: Certificate & request management (no user management)
```

### Document Manager
```
URL: http://localhost:3000/static/document-manager-login.html
Username: docmanager
Password: DocManager@123
Access: Document upload & bulk upload only
```

---

## 🗄️ Database Schema

### New Tables Created

#### 1. `admin_roles`
Stores role definitions with permissions:
```sql
CREATE TABLE admin_roles (
  id TEXT PRIMARY KEY,
  role_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL, -- JSON array
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. `admin_permissions`
Defines all available permissions:
```sql
CREATE TABLE admin_permissions (
  id TEXT PRIMARY KEY,
  permission_key TEXT UNIQUE NOT NULL,
  permission_name TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 3. `user_role_assignments`
Many-to-many relationship between users and roles:
```sql
CREATE TABLE user_role_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  assigned_by TEXT,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES issuers(id),
  FOREIGN KEY (role_id) REFERENCES admin_roles(id),
  UNIQUE(user_id, role_id)
);
```

#### 4. `audit_logs`
Tracks all admin actions:
```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES issuers(id)
);
```

---

## 🔑 Permission System

### Permission Modules & Keys

#### **Certificates Module**
- `certificates.view` - View all certificates
- `certificates.issue` - Issue new certificates
- `certificates.cancel` - Cancel existing certificates
- `certificates.search` - Search and filter certificates

#### **Documents Module**
- `documents.view` - View uploaded documents
- `documents.upload` - Upload competition records
- `documents.edit` - Edit document details
- `documents.delete` - Delete documents
- `documents.bulk_upload` - Perform bulk uploads

#### **Requests Module**
- `requests.view` - View certificate requests
- `requests.approve` - Approve requests
- `requests.reject` - Reject requests

#### **Appeals Module**
- `appeals.view` - View athlete appeals
- `appeals.resolve` - Accept or reject appeals

#### **Complaints Module**
- `complaints.view` - View complaints
- `complaints.resolve` - Update complaint status

#### **Users Module**
- `users.view` - View admin users and athletes
- `users.create` - Create new admin users
- `users.edit` - Edit user details
- `users.delete` - Delete admin users
- `users.assign_roles` - Assign roles to users

#### **System Module**
- `system.settings` - Access system settings
- `system.audit_logs` - View audit logs
- `system.statistics` - View system statistics

---

## 🛡️ Role Permissions Matrix

| Permission | Super Admin | Admin | Document Manager |
|-----------|-------------|-------|------------------|
| **Certificates** | | | |
| View Certificates | ✅ | ✅ | ❌ |
| Issue Certificates | ✅ | ✅ | ❌ |
| Cancel Certificates | ✅ | ✅ | ❌ |
| Search Certificates | ✅ | ✅ | ❌ |
| **Documents** | | | |
| View Documents | ✅ | ✅ | ✅ |
| Upload Documents | ✅ | ❌ | ✅ |
| Edit Documents | ✅ | ❌ | ✅ |
| Delete Documents | ✅ | ❌ | ✅ |
| Bulk Upload | ✅ | ❌ | ✅ |
| **Requests** | | | |
| View Requests | ✅ | ✅ | ❌ |
| Approve Requests | ✅ | ✅ | ❌ |
| Reject Requests | ✅ | ✅ | ❌ |
| **Appeals** | | | |
| View Appeals | ✅ | ✅ | ❌ |
| Resolve Appeals | ✅ | ✅ | ❌ |
| **Complaints** | | | |
| View Complaints | ✅ | ✅ | ❌ |
| Resolve Complaints | ✅ | ✅ | ❌ |
| **Users** | | | |
| View Users | ✅ | ❌ | ❌ |
| Create Users | ✅ | ❌ | ❌ |
| Edit Users | ✅ | ❌ | ❌ |
| Delete Users | ✅ | ❌ | ❌ |
| Assign Roles | ✅ | ❌ | ❌ |
| **System** | | | |
| System Settings | ✅ | ❌ | ❌ |
| Audit Logs | ✅ | ❌ | ❌ |
| Statistics | ✅ | ✅ | ✅ |

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - Login with RBAC support
- `GET /api/auth/me` - Get current user with permissions

### User Management
- `GET /api/user-management/users` - List all users
- `POST /api/user-management/users` - Create new user
- `PUT /api/user-management/users/:userId` - Update user
- `DELETE /api/user-management/users/:userId` - Delete user
- `GET /api/user-management/roles` - List all roles
- `GET /api/user-management/permissions` - List all permissions
- `POST /api/user-management/users/:userId/roles` - Assign role to user
- `DELETE /api/user-management/users/:userId/roles/:roleId` - Remove role from user
- `GET /api/user-management/audit-logs` - View audit logs

---

## 💻 Implementation Files

### Backend

#### Middleware
- `/backend/src/middleware/rbac.ts` - RBAC middleware with permission checking
  - `requirePermission(...permissions)` - Check user has required permissions
  - `requireRole(...roles)` - Check user has required roles
  - `getUserPermissions(userId)` - Get all user permissions
  - `auditLog(action, module, resourceType)` - Log admin actions

#### Routes
- `/backend/src/routes/authRoutes.ts` - Authentication with RBAC
- `/backend/src/routes/userManagementRoutes.ts` - User management endpoints

#### Database
- `/backend/src/migrations/add-rbac-system.sql` - RBAC schema migration
- `/backend/create-rbac-users.js` - Script to create default users

### Frontend

#### Login Pages
- `/backend/public/login.html` - Admin login (Super Admin & Admin)
- `/backend/public/document-manager-login.html` - Document Manager login

#### Management Pages
- `/backend/public/user-management.html` - User management interface
- `/backend/public/dashboard.html` - Main admin dashboard (needs role-based sections)

---

## 🚀 Usage Examples

### Creating a New User (via API)

```javascript
const response = await fetch('http://localhost:3000/api/user-management/users', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    username: 'newuser',
    name: 'New User',
    email: 'new@example.com',
    password: 'SecurePass123',
    organization: 'Sports Department',
    role: 'document_manager'
  })
});
```

### Checking Permissions in Frontend

```javascript
const user = JSON.parse(localStorage.getItem('user'));
if (user.permissions.includes('users.create')) {
  // Show "Create User" button
}
```

### Protecting Routes with Middleware

```typescript
router.post('/some-endpoint',
  authenticate,
  requirePermission('some.permission'),
  auditLog('Some Action', 'module'),
  async (req, res) => {
    // Handler code
  }
);
```

---

## 🔧 Setup & Testing

### 1. Run Migration
```bash
cd /root/pramaan/backend
node -e "
const sqlite3 = require('sqlite3');
const fs = require('fs');
const db = new sqlite3.Database('./certificates.db');
const sql = fs.readFileSync('./src/migrations/add-rbac-system.sql', 'utf8');
db.exec(sql, (err) => {
  if (err) console.error(err);
  else console.log('Migration complete');
  db.close();
});
"
```

### 2. Create Default Users
```bash
node create-rbac-users.js
```

### 3. Build & Restart Server
```bash
npm run build
pm2 restart server  # or your restart command
```

### 4. Test Logins

**Test Super Admin:**
1. Go to: `http://localhost:3000/static/login.html`
2. Login with: `superadmin` / `SuperAdmin@123`
3. Access User Management: `http://localhost:3000/static/user-management.html`

**Test Document Manager:**
1. Go to: `http://localhost:3000/static/document-manager-login.html`
2. Login with: `docmanager` / `DocManager@123`
3. Should only see bulk upload section

---

## 📊 Features Summary

| Feature | Status |
|---------|--------|
| RBAC Database Schema | ✅ Complete |
| Permission System | ✅ Complete |
| Role System | ✅ Complete |
| RBAC Middleware | ✅ Complete |
| Audit Logging | ✅ Complete |
| User Management API | ✅ Complete |
| User Management UI | ✅ Complete |
| Document Manager Login | ✅ Complete |
| Auth API with Permissions | ✅ Complete |
| Default Users Created | ✅ Complete |
| Role-Based Dashboard Sections | ⚠️ Pending |

---

## 🔜 Next Steps

### Dashboard Role-Based Sections
The main admin dashboard needs to be updated to show/hide sections based on user role:

1. **For Document Managers**: Show only
   - Bulk Upload section
   - My Uploaded Documents
   - Statistics (document-related only)

2. **For Admins**: Show
   - Certificate Management
   - Request Approval
   - Appeals Management
   - Complaints Management
   - Statistics

3. **For Super Admins**: Show everything including
   - User Management link in navigation
   - System Settings
   - Audit Logs

### Implementation Approach
```javascript
// In dashboard.html
const user = JSON.parse(localStorage.getItem('user'));

// Hide sections based on permissions
if (!user.permissions.includes('certificates.view')) {
  document.getElementById('certificates-section').style.display = 'none';
}

if (!user.permissions.includes('users.view')) {
  document.getElementById('user-management-link').style.display = 'none';
}
```

---

## 📝 Security Notes

1. **JWT Tokens**: 24-hour expiration
2. **Password Hashing**: bcrypt with 10 rounds
3. **Permission Checking**: At both middleware and application level
4. **Audit Logging**: All sensitive actions logged
5. **Self-Deletion Prevention**: Users cannot delete themselves
6. **Role Validation**: Checked before every protected action

---

## ✅ Testing Checklist

- [ ] Super Admin can access User Management
- [ ] Admin cannot access User Management
- [ ] Document Manager can only see bulk upload
- [ ] Permissions are enforced at API level
- [ ] Audit logs are created for actions
- [ ] Users can be created, edited, deleted
- [ ] Roles can be assigned and removed
- [ ] Document Manager login works separately
- [ ] Dashboard shows role-appropriate sections

---

**Implementation Date:** November 5, 2025
**Version:** 1.0
**System:** E-Pramaan Certificate Management
