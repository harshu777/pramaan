-- RBAC System Migration for Krida e-Pramaan
-- Adds Role-Based Access Control with separate Document Manager and Admin roles

-- Add role column to issuers table if not exists (already exists as 'admin')
-- We'll expand roles to: 'super_admin', 'admin', 'document_manager'

-- Create admin_roles table for role definitions
CREATE TABLE IF NOT EXISTS admin_roles (
  id TEXT PRIMARY KEY,
  role_name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL, -- JSON array of permissions
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create admin_permissions table for granular permissions
CREATE TABLE IF NOT EXISTS admin_permissions (
  id TEXT PRIMARY KEY,
  permission_key TEXT UNIQUE NOT NULL,
  permission_name TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL, -- e.g., 'certificates', 'users', 'documents', 'appeals'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create user_role_assignments table (many-to-many)
CREATE TABLE IF NOT EXISTS user_role_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  assigned_by TEXT,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES issuers(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE,
  UNIQUE(user_id, role_id)
);

-- Create audit_logs table for tracking admin actions
CREATE TABLE IF NOT EXISTS audit_logs (
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

-- Insert default permissions
INSERT INTO admin_permissions (id, permission_key, permission_name, description, module) VALUES
-- Certificate Management
('perm_cert_view', 'certificates.view', 'View Certificates', 'View all certificates in the system', 'certificates'),
('perm_cert_issue', 'certificates.issue', 'Issue Certificates', 'Issue new certificates', 'certificates'),
('perm_cert_cancel', 'certificates.cancel', 'Cancel Certificates', 'Cancel existing certificates', 'certificates'),
('perm_cert_search', 'certificates.search', 'Search Certificates', 'Search and filter certificates', 'certificates'),

-- Document Management
('perm_doc_view', 'documents.view', 'View Documents', 'View uploaded documents', 'documents'),
('perm_doc_upload', 'documents.upload', 'Upload Documents', 'Upload competition records and documents', 'documents'),
('perm_doc_edit', 'documents.edit', 'Edit Documents', 'Edit document details', 'documents'),
('perm_doc_delete', 'documents.delete', 'Delete Documents', 'Delete documents from system', 'documents'),
('perm_doc_bulk', 'documents.bulk_upload', 'Bulk Upload', 'Perform bulk document uploads', 'documents'),

-- Request Management
('perm_req_view', 'requests.view', 'View Requests', 'View certificate requests', 'requests'),
('perm_req_approve', 'requests.approve', 'Approve Requests', 'Approve certificate requests', 'requests'),
('perm_req_reject', 'requests.reject', 'Reject Requests', 'Reject certificate requests', 'requests'),

-- Appeal Management
('perm_appeal_view', 'appeals.view', 'View Appeals', 'View athlete appeals', 'appeals'),
('perm_appeal_resolve', 'appeals.resolve', 'Resolve Appeals', 'Accept or reject appeals', 'appeals'),

-- Complaint Management
('perm_complaint_view', 'complaints.view', 'View Complaints', 'View complaints', 'complaints'),
('perm_complaint_resolve', 'complaints.resolve', 'Resolve Complaints', 'Update complaint status', 'complaints'),

-- User Management
('perm_user_view', 'users.view', 'View Users', 'View admin users and athletes', 'users'),
('perm_user_create', 'users.create', 'Create Users', 'Create new admin users', 'users'),
('perm_user_edit', 'users.edit', 'Edit Users', 'Edit user details', 'users'),
('perm_user_delete', 'users.delete', 'Delete Users', 'Delete admin users', 'users'),
('perm_user_role', 'users.assign_roles', 'Assign Roles', 'Assign roles to users', 'users'),

-- System Management
('perm_system_settings', 'system.settings', 'System Settings', 'Access system settings', 'system'),
('perm_system_audit', 'system.audit_logs', 'Audit Logs', 'View audit logs', 'system'),
('perm_system_stats', 'system.statistics', 'View Statistics', 'View system statistics', 'system');

-- Insert default roles
INSERT INTO admin_roles (id, role_name, display_name, description, permissions) VALUES
-- Super Admin (Full Access)
('role_super_admin', 'super_admin', 'Super Administrator', 'Full system access with all permissions',
'["certificates.view","certificates.issue","certificates.cancel","certificates.search","documents.view","documents.upload","documents.edit","documents.delete","documents.bulk_upload","requests.view","requests.approve","requests.reject","appeals.view","appeals.resolve","complaints.view","complaints.resolve","users.view","users.create","users.edit","users.delete","users.assign_roles","system.settings","system.audit_logs","system.statistics"]'),

-- Admin (Certificate & Request Management)
('role_admin', 'admin', 'Administrator', 'Manage certificates, requests, and appeals',
'["certificates.view","certificates.issue","certificates.cancel","certificates.search","documents.view","requests.view","requests.approve","requests.reject","appeals.view","appeals.resolve","complaints.view","complaints.resolve","system.statistics"]'),

-- Document Manager (Document & Upload Management Only)
('role_doc_manager', 'document_manager', 'Document Manager', 'Manage documents and bulk uploads only',
'["documents.view","documents.upload","documents.edit","documents.delete","documents.bulk_upload","system.statistics"]');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role ON user_role_assignments(role_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
