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
    const { did, name, organization, email, password, walletAddress } = req.body;

    if (!did || !name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = `
      INSERT INTO issuers (id, did, name, organization, email, wallet_address, public_key)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      const issuerId = crypto.randomUUID();
      await query(insertQuery, [
        issuerId,
        did,
        name,
        organization,
        email,
        walletAddress,
        hashedPassword
      ]);

      const issuer = { id: issuerId, did, name, organization, email, is_active: true };

      res.status(201).json({
        success: true,
        message: 'Issuer registered successfully',
        data: issuer,
      });
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({
          success: false,
          message: 'Issuer with this DID already exists',
        });
      }
      throw error;
    }
  })
);

router.post('/login',
  asyncHandler(async (req: Request, res: Response) => {
    const { did, password } = req.body;

    if (!did || !password) {
      return res.status(400).json({
        success: false,
        message: 'DID and password are required',
      });
    }

    const result = await query(
      'SELECT * FROM issuers WHERE did = ? AND is_active = 1',
      [did]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const issuer = result.rows[0];
    const isValid = await bcrypt.compare(password, issuer.public_key);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = jwt.sign(
      {
        id: issuer.id,
        did: issuer.did,
        name: issuer.name,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      issuer: {
        id: issuer.id,
        did: issuer.did,
        name: issuer.name,
        organization: issuer.organization,
        email: issuer.email,
      },
    });
  })
);

router.get('/list',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await query(
      'SELECT id, did, name, organization, email, is_active, created_at FROM issuers ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  })
);

export default router;