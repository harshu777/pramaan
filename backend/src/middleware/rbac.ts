import { Request, Response, NextFunction } from 'express';
import { query } from '../config/database-sqlite';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: any;
}

/**
 * Check if user has specific permission
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    // Get user's role assignments
    const roleAssignments = await query(`
      SELECT r.permissions
      FROM user_role_assignments ura
      INNER JOIN admin_roles r ON ura.role_id = r.id
      WHERE ura.user_id = ? AND r.is_active = 1
    `, [userId]);

    if (roleAssignments.rows.length === 0) {
      // Fallback to legacy role field in issuers table
      const userResult = await query('SELECT role FROM issuers WHERE id = ?', [userId]);
      if (userResult.rows.length > 0) {
        const role = userResult.rows[0].role;

        // Map legacy roles to permissions
        if (role === 'super_admin') {
          const allPerms = await query('SELECT permission_key FROM admin_permissions');
          return allPerms.rows.map((p: any) => p.permission_key);
        } else if (role === 'admin') {
          // Admin has most permissions except user management
          return [
            'certificates.view', 'certificates.issue', 'certificates.cancel', 'certificates.search',
            'documents.view', 'requests.view', 'requests.approve', 'requests.reject',
            'appeals.view', 'appeals.resolve', 'complaints.view', 'complaints.resolve',
            'system.statistics'
          ];
        } else if (role === 'document_manager') {
          return [
            'documents.view', 'documents.upload', 'documents.edit',
            'documents.delete', 'documents.bulk_upload', 'system.statistics'
          ];
        }
      }
      return [];
    }

    // Aggregate permissions from all assigned roles
    const allPermissions = new Set<string>();
    for (const row of roleAssignments.rows) {
      try {
        const permissions = JSON.parse(row.permissions);
        permissions.forEach((perm: string) => allPermissions.add(perm));
      } catch (e) {
        logger.error('Error parsing permissions:', e);
      }
    }

    return Array.from(allPermissions);
  } catch (error) {
    logger.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * RBAC Middleware - Check if user has required permission
 */
export function requirePermission(...permissions: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userId = req.user.id;
      const userPermissions = await getUserPermissions(userId);

      // Check if user has at least one of the required permissions
      const hasPermission = permissions.some(perm => userPermissions.includes(perm));

      if (!hasPermission) {
        logger.warn(`Access denied for user ${userId}. Required: ${permissions.join(' or ')}, Has: ${userPermissions.join(', ')}`);
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions',
          required: permissions,
          userPermissions: userPermissions
        });
      }

      // Attach permissions to request for later use
      req.user.permissions = userPermissions;
      next();
    } catch (error) {
      logger.error('RBAC middleware error:', error);
      return res.status(500).json({
        success: false,
        message: 'Permission check failed'
      });
    }
  };
}

/**
 * Check if user has any of the specified roles
 */
export function requireRole(...roles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userId = req.user.id;

      // Check role assignments table first
      const roleAssignments = await query(`
        SELECT r.role_name
        FROM user_role_assignments ura
        INNER JOIN admin_roles r ON ura.role_id = r.id
        WHERE ura.user_id = ? AND r.is_active = 1
      `, [userId]);

      let userRoles: string[] = [];

      if (roleAssignments.rows.length > 0) {
        userRoles = roleAssignments.rows.map((r: any) => r.role_name);
      } else {
        // Fallback to legacy role field
        const userResult = await query('SELECT role FROM issuers WHERE id = ?', [userId]);
        if (userResult.rows.length > 0) {
          userRoles = [userResult.rows[0].role];
        }
      }

      const hasRole = roles.some(role => userRoles.includes(role));

      if (!hasRole) {
        logger.warn(`Role check failed for user ${userId}. Required: ${roles.join(' or ')}, Has: ${userRoles.join(', ')}`);
        return res.status(403).json({
          success: false,
          message: 'Insufficient role permissions',
          required: roles,
          userRoles: userRoles
        });
      }

      req.user.roles = userRoles;
      next();
    } catch (error) {
      logger.error('Role check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Role check failed'
      });
    }
  };
}

/**
 * Audit log middleware - Log all admin actions
 */
export function auditLog(action: string, module: string, resourceType?: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user) {
        const resourceId = req.params.id || req.params.certHash || req.params.requestId || req.params.appealId || null;
        const description = `${action} - ${req.method} ${req.path}`;

        await query(`
          INSERT INTO audit_logs (
            id, user_id, user_name, user_role, action, module,
            resource_type, resource_id, description, ip_address, user_agent
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          require('uuid').v4(),
          req.user.id,
          req.user.name || req.user.username,
          req.user.role || 'unknown',
          action,
          module,
          resourceType || null,
          resourceId,
          description,
          req.ip || req.connection.remoteAddress,
          req.get('user-agent') || null
        ]);
      }
    } catch (error) {
      logger.error('Audit log error:', error);
      // Don't block the request if audit logging fails
    }
    next();
  };
}
