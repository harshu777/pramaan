import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from '../config/database-sqlite';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { getUserPermissions } from '../middleware/rbac';
import { logger } from '../utils/logger';

const router = Router();

// Admin login endpoint with RBAC support
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    });
  }

  // Find user
  const result = await query(
    'SELECT * FROM issuers WHERE username = ? AND is_active = 1',
    [username]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  const user = result.rows[0];

  // Verify password
  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  // Get user permissions
  const permissions = await getUserPermissions(user.id);

  // Get user roles
  const rolesResult = await query(`
    SELECT r.role_name, r.display_name
    FROM user_role_assignments ura
    INNER JOIN admin_roles r ON ura.role_id = r.id
    WHERE ura.user_id = ? AND r.is_active = 1
  `, [user.id]);

  const roles = rolesResult.rows.map((r: any) => ({
    name: r.role_name,
    displayName: r.display_name
  }));

  // If no role assignments, use legacy role
  const primaryRole = roles.length > 0 ? roles[0].name : (user.role || 'admin');

  // Generate JWT token
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      type: 'issuer',
      role: primaryRole
    },
    process.env.JWT_SECRET || 'secret',
    { expiresIn: '24h' }
  );

  logger.info(`User ${username} logged in successfully`);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      organization: user.organization,
      role: primaryRole,
      roles: roles,
      permissions: permissions
    }
  });
}));

// Get current user info
router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  // Get fresh permissions
  const permissions = await getUserPermissions(user.id);

  // Get roles
  const rolesResult = await query(`
    SELECT r.role_name, r.display_name
    FROM user_role_assignments ura
    INNER JOIN admin_roles r ON ura.role_id = r.id
    WHERE ura.user_id = ? AND r.is_active = 1
  `, [user.id]);

  const roles = rolesResult.rows.map((r: any) => ({
    name: r.role_name,
    displayName: r.display_name
  }));

  res.json({
    success: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      organization: user.organization,
      role: user.role || (roles.length > 0 ? roles[0].name : 'admin'),
      roles: roles,
      permissions: permissions
    }
  });
}));

export default router;
