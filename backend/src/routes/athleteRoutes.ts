import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database-sqlite';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Athlete signup
router.post('/signup', asyncHandler(async (req: Request, res: Response) => {
  const { fullName, email, phoneNumber, dob, password, district, state } = req.body;

  // Validation
  if (!fullName || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Full name, email, and password are required'
    });
  }

  // Check if athlete already exists
  const existingAthlete = await query(
    'SELECT * FROM athletes WHERE email = ?',
    [email]
  );

  if (existingAthlete.rows.length > 0) {
    return res.status(409).json({
      success: false,
      message: 'Athlete with this email already exists'
    });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create athlete
  const athleteId = uuidv4();
  await query(
    `INSERT INTO athletes (id, full_name, email, phone_number, dob, password_hash, district, state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [athleteId, fullName, email, phoneNumber, dob, passwordHash, district, state]
  );

  // Generate token
  const token = jwt.sign(
    { id: athleteId, email, type: 'athlete' },
    process.env.JWT_SECRET || 'default_secret',
    { expiresIn: '7d' }
  );

  res.status(201).json({
    success: true,
    message: 'Athlete registered successfully',
    token,
    athlete: {
      id: athleteId,
      fullName,
      email,
      phoneNumber,
      dob,
      district,
      state
    }
  });
}));

// Athlete login
router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  // Find athlete
  const result = await query('SELECT * FROM athletes WHERE email = ?', [email]);

  if (result.rows.length === 0) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  const athlete = result.rows[0];

  // Verify password
  const isValidPassword = await bcrypt.compare(password, athlete.password_hash);

  if (!isValidPassword) {
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  if (!athlete.is_active) {
    return res.status(403).json({
      success: false,
      message: 'Account is inactive'
    });
  }

  // Generate token
  const token = jwt.sign(
    { id: athlete.id, email: athlete.email, type: 'athlete' },
    process.env.JWT_SECRET || 'default_secret',
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    message: 'Login successful',
    token,
    athlete: {
      id: athlete.id,
      fullName: athlete.full_name,
      email: athlete.email,
      phoneNumber: athlete.phone_number,
      dob: athlete.dob,
      district: athlete.district,
      state: athlete.state
    }
  });
}));

// Get athlete profile
router.get('/profile', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.type !== 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const result = await query('SELECT * FROM athletes WHERE id = ?', [user.id]);

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Athlete not found'
    });
  }

  const athlete = result.rows[0];

  res.json({
    success: true,
    athlete: {
      id: athlete.id,
      fullName: athlete.full_name,
      email: athlete.email,
      phoneNumber: athlete.phone_number,
      dob: athlete.dob,
      district: athlete.district,
      state: athlete.state,
      createdAt: athlete.created_at
    }
  });
}));

// Get athlete's certificates
router.get('/certificates', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.type !== 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const result = await query(`
    SELECT c.*, ca.assigned_at
    FROM certificates c
    INNER JOIN certificate_assignments ca ON c.id = ca.certificate_id
    WHERE ca.athlete_id = ?
    ORDER BY ca.assigned_at DESC
  `, [user.id]);

  const certificates = result.rows.map((row: any) => ({
    id: row.id,
    certHash: row.cert_hash,
    ipfsCid: row.ipfs_cid,
    issuerName: row.issuer_name,
    subjectName: row.subject_name,
    certificateType: row.certificate_type,
    issuedDate: row.issued_date,
    expiryDate: row.expiry_date,
    status: row.status,
    assignedAt: row.assigned_at,
    metadata: row.metadata ? JSON.parse(row.metadata) : {}
  }));

  res.json({
    success: true,
    certificates,
    count: certificates.length
  });
}));

// Validate certificate by hash (for athlete)
router.get('/certificates/:certHash', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { certHash } = req.params;

  if (user.type !== 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Check if certificate is assigned to this athlete
  const result = await query(`
    SELECT c.*, ca.assigned_at
    FROM certificates c
    INNER JOIN certificate_assignments ca ON c.id = ca.certificate_id
    WHERE ca.athlete_id = ? AND c.cert_hash = ?
  `, [user.id, certHash]);

  if (result.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Certificate not found or not assigned to you'
    });
  }

  const cert = result.rows[0];

  res.json({
    success: true,
    certificate: {
      id: cert.id,
      certHash: cert.cert_hash,
      ipfsCid: cert.ipfs_cid,
      issuerName: cert.issuer_name,
      subjectName: cert.subject_name,
      subjectEmail: cert.subject_email,
      certificateType: cert.certificate_type,
      issuedDate: cert.issued_date,
      expiryDate: cert.expiry_date,
      status: cert.status,
      blockchainTxHash: cert.blockchain_tx_hash,
      assignedAt: cert.assigned_at,
      metadata: cert.metadata ? JSON.parse(cert.metadata) : {}
    }
  });
}));

// Get all athletes (admin only)
router.get('/', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  // Only issuers/admins can view all athletes
  if (user.type === 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const result = await query('SELECT id, full_name, email, phone_number, dob, district, state, is_active, created_at FROM athletes ORDER BY created_at DESC');

  const athletes = result.rows.map((row: any) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    dob: row.dob,
    district: row.district,
    state: row.state,
    isActive: row.is_active,
    createdAt: row.created_at
  }));

  res.json({
    success: true,
    athletes,
    count: athletes.length
  });
}));

// Search athletes by name, email, or phone
router.get('/search', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const searchQuery = (req.query.q as string) || '';

  // Only issuers/admins can search athletes
  if (user.type === 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const result = await query(`
    SELECT id, full_name, email, phone_number, dob, district, state, is_active, created_at
    FROM athletes
    WHERE full_name LIKE ? OR email LIKE ? OR phone_number LIKE ?
    ORDER BY created_at DESC
  `, [`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`]);

  const athletes = result.rows.map((row: any) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phoneNumber: row.phone_number,
    dob: row.dob,
    district: row.district,
    state: row.state,
    isActive: row.is_active,
    createdAt: row.created_at
  }));

  res.json({
    success: true,
    athletes,
    count: athletes.length
  });
}));

export default router;
