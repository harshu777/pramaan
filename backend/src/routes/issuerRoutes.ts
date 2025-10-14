import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../config/database-sqlite';
import { asyncHandler } from '../middleware/asyncHandler';
import { logger } from '../utils/logger';

const router = Router();

router.post('/register',
  asyncHandler(async (req: Request, res: Response) => {
    const { username, name, organization, email, password, role } = req.body;

    if (!username || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: username, name, email, password',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = `
      INSERT INTO issuers (id, username, name, organization, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const issuerId = crypto.randomUUID();
      await query(insertQuery, [
        issuerId,
        username,
        name,
        organization,
        email,
        hashedPassword,
        role || 'admin'
      ]);

      const issuer = { id: issuerId, username, name, organization, email, role: role || 'admin', is_active: true };

      res.status(201).json({
        success: true,
        message: 'Admin user registered successfully',
        data: issuer,
      });
    } catch (error: any) {
      if (error.code === '23505' || error.message.includes('UNIQUE')) {
        return res.status(400).json({
          success: false,
          message: 'User with this username already exists',
        });
      }
      throw error;
    }
  })
);

router.post('/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    const result = await query(
      'SELECT * FROM issuers WHERE username = ? AND is_active = 1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const issuer = result.rows[0];

    if (!issuer.password_hash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const isValid = await bcrypt.compare(password, issuer.password_hash);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = jwt.sign(
      {
        id: issuer.id,
        username: issuer.username,
        name: issuer.name,
        role: issuer.role || 'admin',
        type: 'issuer'
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      issuer: {
        id: issuer.id,
        username: issuer.username,
        name: issuer.name,
        organization: issuer.organization,
        email: issuer.email,
        role: issuer.role || 'admin'
      },
    });
  })
);

router.get('/list',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await query(
      'SELECT id, username, name, organization, email, role, is_active, created_at FROM issuers ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  })
);

export default router;