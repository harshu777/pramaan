import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { query } from '../config/database-sqlite';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { requirePermission, requireRole, auditLog } from '../middleware/rbac';
import { logger } from '../utils/logger';

const router = Router();

// Get all admin users
router.get('/users',
  authenticate,
  requirePermission('users.view'),
  auditLog('View Users', 'users'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await query(`
      SELECT
        i.id, i.username, i.name, i.email, i.organization,
        i.role, i.is_active, i.created_at,
        GROUP_CONCAT(r.display_name) as assigned_roles
      FROM issuers i
      LEFT JOIN user_role_assignments ura ON i.id = ura.user_id
      LEFT JOIN admin_roles r ON ura.role_id = r.id
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `, []);

    const users = result.rows.map((row: any) => ({
      id: row.id,
      username: row.username,
      name: row.name,
      email: row.email,
      organization: row.organization,
      role: row.role,
      assignedRoles: row.assigned_roles ? row.assigned_roles.split(',') : [],
      isActive: row.is_active === 1,
      createdAt: row.created_at
    }));

    res.json({
      success: true,
      users,
      count: users.length
    });
  })
);

// Get all available roles
router.get('/roles',
  authenticate,
  requirePermission('users.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await query(`
      SELECT id, role_name, display_name, description, permissions, is_active
      FROM admin_roles
      WHERE is_active = 1
      ORDER BY role_name
    `, []);

    const roles = result.rows.map((row: any) => ({
      id: row.id,
      roleName: row.role_name,
      displayName: row.display_name,
      description: row.description,
      permissions: JSON.parse(row.permissions || '[]'),
      isActive: row.is_active === 1
    }));

    res.json({
      success: true,
      roles
    });
  })
);

// Get all permissions
router.get('/permissions',
  authenticate,
  requirePermission('users.view'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await query(`
      SELECT permission_key, permission_name, description, module
      FROM admin_permissions
      ORDER BY module, permission_name
    `, []);

    const permissions = result.rows.map((row: any) => ({
      key: row.permission_key,
      name: row.permission_name,
      description: row.description,
      module: row.module
    }));

    // Group by module
    const groupedPermissions = permissions.reduce((acc: any, perm: any) => {
      if (!acc[perm.module]) {
        acc[perm.module] = [];
      }
      acc[perm.module].push(perm);
      return acc;
    }, {});

    res.json({
      success: true,
      permissions: groupedPermissions
    });
  })
);

// Create new admin user
router.post('/users',
  authenticate,
  requirePermission('users.create'),
  auditLog('Create User', 'users', 'user'),
  asyncHandler(async (req: Request, res: Response) => {
    const { username, name, email, password, organization, role } = req.body;
    const currentUser = (req as any).user;

    // Validation
    if (!username || !name || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username, name, and password are required'
      });
    }

    // Check if username already exists
    const existingUser = await query('SELECT id FROM issuers WHERE username = ?', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    const userId = uuidv4();

    // Create user
    await query(`
      INSERT INTO issuers (id, username, name, email, organization, password_hash, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [userId, username, name, email || null, organization || null, passwordHash, role || 'admin']);

    // If role is provided, assign it
    if (role) {
      const roleResult = await query('SELECT id FROM admin_roles WHERE role_name = ?', [role]);
      if (roleResult.rows.length > 0) {
        await query(`
          INSERT INTO user_role_assignments (id, user_id, role_id, assigned_by)
          VALUES (?, ?, ?, ?)
        `, [uuidv4(), userId, roleResult.rows[0].id, currentUser.username]);
      }
    }

    logger.info(`User ${username} created by ${currentUser.username}`);

    res.json({
      success: true,
      message: 'User created successfully',
      userId
    });
  })
);

// Update user
router.put('/users/:userId',
  authenticate,
  requirePermission('users.edit'),
  auditLog('Update User', 'users', 'user'),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { name, email, organization, isActive } = req.body;

    // Check if user exists
    const userResult = await query('SELECT id FROM issuers WHERE id = ?', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await query(`
      UPDATE issuers
      SET name = ?, email = ?, organization = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [name, email || null, organization || null, isActive ? 1 : 0, userId]);

    logger.info(`User ${userId} updated`);

    res.json({
      success: true,
      message: 'User updated successfully'
    });
  })
);

// Assign role to user
router.post('/users/:userId/roles',
  authenticate,
  requirePermission('users.assign_roles'),
  auditLog('Assign Role', 'users', 'role_assignment'),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { roleId } = req.body;
    const currentUser = (req as any).user;

    if (!roleId) {
      return res.status(400).json({
        success: false,
        message: 'Role ID is required'
      });
    }

    // Check if user and role exist
    const userResult = await query('SELECT id FROM issuers WHERE id = ?', [userId]);
    const roleResult = await query('SELECT id FROM admin_roles WHERE id = ?', [roleId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (roleResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }

    // Check if assignment already exists
    const existingAssignment = await query(
      'SELECT id FROM user_role_assignments WHERE user_id = ? AND role_id = ?',
      [userId, roleId]
    );

    if (existingAssignment.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Role already assigned to user'
      });
    }

    // Create assignment
    await query(`
      INSERT INTO user_role_assignments (id, user_id, role_id, assigned_by)
      VALUES (?, ?, ?, ?)
    `, [uuidv4(), userId, roleId, currentUser.username]);

    logger.info(`Role ${roleId} assigned to user ${userId} by ${currentUser.username}`);

    res.json({
      success: true,
      message: 'Role assigned successfully'
    });
  })
);

// Remove role from user
router.delete('/users/:userId/roles/:roleId',
  authenticate,
  requirePermission('users.assign_roles'),
  auditLog('Remove Role', 'users', 'role_assignment'),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId, roleId } = req.params;

    await query(
      'DELETE FROM user_role_assignments WHERE user_id = ? AND role_id = ?',
      [userId, roleId]
    );

    logger.info(`Role ${roleId} removed from user ${userId}`);

    res.json({
      success: true,
      message: 'Role removed successfully'
    });
  })
);

// Delete user
router.delete('/users/:userId',
  authenticate,
  requirePermission('users.delete'),
  auditLog('Delete User', 'users', 'user'),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const currentUser = (req as any).user;

    // Prevent self-deletion
    if (userId === currentUser.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Check if user exists
    const userResult = await query('SELECT username FROM issuers WHERE id = ?', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const username = userResult.rows[0].username;

    // Delete user (role assignments will be deleted by cascade)
    await query('DELETE FROM issuers WHERE id = ?', [userId]);

    logger.info(`User ${username} (${userId}) deleted by ${currentUser.username}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  })
);

// Get audit logs
router.get('/audit-logs',
  authenticate,
  requirePermission('system.audit_logs'),
  asyncHandler(async (req: Request, res: Response) => {
    const { module, userId, limit = 100, offset = 0 } = req.query;

    let queryStr = `
      SELECT * FROM audit_logs
      WHERE 1=1
    `;
    const params: any[] = [];

    if (module) {
      queryStr += ' AND module = ?';
      params.push(module);
    }

    if (userId) {
      queryStr += ' AND user_id = ?';
      params.push(userId);
    }

    queryStr += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const result = await query(queryStr, params);

    res.json({
      success: true,
      logs: result.rows,
      count: result.rows.length
    });
  })
);

export default router;
