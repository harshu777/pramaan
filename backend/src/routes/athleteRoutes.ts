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

  // Auto-map existing competition records to this athlete
  try {
    // Find and link records based on name, DOB, and phone
    const mappingResult = await query(`
      UPDATE athlete_competitions
      SET athlete_id = ?
      WHERE athlete_id IS NULL
        AND (
          full_name = ?
          OR (full_name LIKE ? AND (dob = ? OR dob IS NULL))
          OR (full_name = ? AND dob = ?)
        )
    `, [athleteId, fullName, `%${fullName}%`, dob, fullName, dob]);

    const recordsMapped = mappingResult.rowCount || 0;
    logger.info(`Auto-mapped ${recordsMapped} competition records to athlete ${athleteId}`);
  } catch (mappingError) {
    logger.error('Error auto-mapping competition records:', mappingError);
    // Don't fail registration if mapping fails
  }

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

// Get athlete's competition records (from bulk upload)
router.get('/my-records', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.type !== 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Get athlete info
  const athleteResult = await query('SELECT * FROM athletes WHERE id = ?', [user.id]);
  if (athleteResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Athlete not found' });
  }

  const athlete = athleteResult.rows[0];

  // Get all competition records that match this athlete (by name, DOB, phone, or linked athlete_id)
  const result = await query(`
    SELECT * FROM athlete_competitions
    WHERE athlete_id = ?
       OR (full_name = ? AND (dob = ? OR dob IS NULL))
       OR (aadhar_number = ? AND aadhar_number IS NOT NULL)
    ORDER BY created_at DESC
  `, [user.id, athlete.full_name, athlete.dob, athlete.aadhar_number]);

  const records = result.rows.map((row: any) => ({
    id: row.id,
    fullName: row.full_name,
    fatherName: row.father_name,
    dob: row.dob,
    district: row.district,
    representingDistrict: row.representing_district,
    divisionStateCountry: row.division_state_country,
    gameName: row.game_name,
    competitionName: row.competition_name,
    competitionType: row.competition_type,
    competitionPeriod: row.competition_period,
    competitionHeldAt: row.competition_held_at,
    competitionLevel: row.competition_level,
    positionObtained: row.position_obtained,
    certificateNo: row.certificate_no,
    validForEmploymentGroup: row.valid_for_employment_group,
    applicableGovtResolutions: row.applicable_govt_resolutions,
    certificateIssued: row.certificate_issued,
    certificateRequested: row.certificate_requested,
    createdAt: row.created_at
  }));

  res.json({
    success: true,
    records,
    count: records.length
  });
}));

// Request certificate for a competition record - Auto-approve and generate immediately
router.post('/request-certificate/:recordId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { recordId } = req.params;

  if (user.type !== 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  // Check if record exists
  const recordResult = await query('SELECT * FROM athlete_competitions WHERE id = ?', [recordId]);
  if (recordResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Record not found' });
  }

  const record = recordResult.rows[0];

  // Check if certificate already issued
  if (record.certificate_issued) {
    return res.status(400).json({ success: false, message: 'Certificate already issued for this record' });
  }

  // Check if request already exists
  const existingRequest = await query(
    'SELECT * FROM quota_certificate_requests WHERE athlete_id = ? AND competition_record_id = ? AND status IN (?, ?)',
    [user.id, recordId, 'pending', 'approved']
  );

  if (existingRequest.rows.length > 0) {
    return res.status(400).json({ success: false, message: 'Request already exists for this record' });
  }

  // Get athlete email
  const athleteResult = await query('SELECT * FROM athletes WHERE id = ?', [user.id]);
  if (athleteResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Athlete not found' });
  }
  const athlete = athleteResult.rows[0];

  // Auto-generate certificate immediately (no admin approval needed)
  const { certificateService } = await import('../services/certificateService');
  const { pdfService } = await import('../services/pdfService');
  const { emailService } = await import('../services/emailService');

  try {
    // Create certificate request
    const requestId = uuidv4();
    await query(`
      INSERT INTO quota_certificate_requests (
        id, athlete_id, competition_record_id, status, requested_at, processed_at, processed_by
      ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `, [requestId, user.id, recordId, 'approved', 'system-auto-approved']);

    // Generate certificate
    const certificateData = {
      issuerDid: 'system',
      issuerName: 'Directorate of Sports and Youth Services',
      subjectName: record.full_name,
      subjectEmail: athlete.email,
      certificateType: record.competition_type || 'Sports Achievement',
      metadata: {
        fatherName: record.father_name,
        dob: record.dob,
        district: record.district,
        representingDistrict: record.representing_district,
        divisionStateCountry: record.division_state_country,
        gameName: record.game_name,
        competitionName: record.competition_name,
        competitionPeriod: record.competition_period,
        competitionHeldAt: record.competition_held_at,
        competitionLevel: record.competition_level,
        positionObtained: record.position_obtained,
        certificateNo: record.certificate_no,
        validForEmploymentGroup: record.valid_for_employment_group,
        applicableGovtResolutions: record.applicable_govt_resolutions
      }
    };

    const certificate = await certificateService.issueCertificate(certificateData);

    // Get certificate with digital signature
    const dbResult = await certificateService.validateCertificate(certificate.certHash);
    const digitalSignature = dbResult.certificate?.digitalSignature || null;

    // Generate PDF
    const pdfData = {
      name: record.full_name,
      fatherName: record.father_name,
      dob: record.dob,
      district: record.district,
      representingDistrict: record.representing_district,
      divisionStateCountry: record.division_state_country,
      gameName: record.game_name,
      competitionName: record.competition_name,
      competitionPeriod: record.competition_period,
      competitionHeldAt: record.competition_held_at,
      competitionLevel: record.competition_level,
      positionObtained: record.position_obtained,
      certificateNo: record.certificate_no,
      validForEmploymentGroup: record.valid_for_employment_group,
      applicableGovtResolutions: record.applicable_govt_resolutions,
      certHash: certificate.certHash,
      issuerName: 'Deputy Director',
      issuerTitle: 'Deputy Director',
      organizationName: 'Sports and Youth Services, Maharashtra State',
      issueDate: new Date().toLocaleDateString('en-IN'),
      digitalSignature
    };

    const pdfBuffer = await pdfService.generateCertificatePDF(pdfData);

    // Send email
    if (athlete.email) {
      await emailService.sendCertificateEmail(
        athlete.email,
        record.full_name,
        certificate.certHash,
        pdfBuffer,
        certificateData.certificateType
      );
    }

    // Update request with certificate info
    await query(`
      UPDATE quota_certificate_requests
      SET certificate_id = ?, certificate_hash = ?
      WHERE id = ?
    `, [certificate.id, certificate.certHash, requestId]);

    // Mark competition record as certificate issued
    await query(
      'UPDATE athlete_competitions SET certificate_issued = 1, certificate_requested = 1 WHERE id = ?',
      [recordId]
    );

    // Create certificate assignment
    await query(`
      INSERT INTO certificate_assignments (id, certificate_id, athlete_id, assigned_by)
      VALUES (?, ?, ?, ?)
    `, [uuidv4(), certificate.id, user.id, 'system-auto-approved']);

    logger.info(`Certificate auto-generated for athlete ${user.id}, request ${requestId}`);

    res.json({
      success: true,
      message: 'Certificate generated and issued successfully',
      requestId,
      certificateHash: certificate.certHash
    });

  } catch (error) {
    logger.error('Error auto-generating certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate certificate: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
}));

// Get athlete's certificate requests
router.get('/my-requests', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.type !== 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const result = await query(`
    SELECT qcr.*, ac.full_name, ac.game_name, ac.competition_name, ac.competition_level,
           (SELECT COUNT(*) FROM appeals WHERE request_id = qcr.id) as appeal_count
    FROM quota_certificate_requests qcr
    LEFT JOIN athlete_competitions ac ON qcr.competition_record_id = ac.id
    WHERE qcr.athlete_id = ?
    ORDER BY qcr.requested_at DESC
  `, [user.id]);

  const requests = result.rows.map((row: any) => ({
    id: row.id,
    competitionRecordId: row.competition_record_id,
    status: row.status,
    certificateHash: row.certificate_hash,
    adminNotes: row.admin_notes,
    rejectionReason: row.rejection_reason,
    requestedAt: row.requested_at,
    processedAt: row.processed_at,
    processedBy: row.processed_by,
    // Competition info
    fullName: row.full_name,
    gameName: row.game_name,
    competitionName: row.competition_name,
    competitionLevel: row.competition_level,
    // Appeal info
    hasAppeal: row.appeal_count > 0
  }));

  res.json({
    success: true,
    requests,
    count: requests.length
  });
}));

// Create an appeal for a pending request (after 15 days)
router.post('/create-appeal/:requestId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { requestId } = req.params;
  const { reason } = req.body;

  if (user.type !== 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  if (!reason || reason.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Appeal reason is required'
    });
  }

  // Check if request exists and belongs to this athlete
  const requestResult = await query(
    'SELECT * FROM quota_certificate_requests WHERE id = ? AND athlete_id = ?',
    [requestId, user.id]
  );

  if (requestResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Request not found'
    });
  }

  const request = requestResult.rows[0];

  // Check if request is still pending
  if (request.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Appeals can only be created for pending requests'
    });
  }

  // Check if request is at least 15 days old
  const requestDate = new Date(request.requested_at);
  const currentDate = new Date();
  const daysDifference = Math.floor((currentDate.getTime() - requestDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysDifference < 15) {
    return res.status(400).json({
      success: false,
      message: `You can only appeal after 15 days. This request is ${daysDifference} days old.`,
      daysRemaining: 15 - daysDifference
    });
  }

  // Check if appeal already exists for this request
  const existingAppeal = await query(
    'SELECT * FROM appeals WHERE request_id = ?',
    [requestId]
  );

  if (existingAppeal.rows.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'An appeal already exists for this request'
    });
  }

  // Create appeal
  const appealId = uuidv4();
  await query(`
    INSERT INTO appeals (
      id, request_id, athlete_id, reason, status, created_at
    ) VALUES (?, ?, ?, ?, 'pending', datetime('now'))
  `, [appealId, requestId, user.id, reason]);

  logger.info(`Appeal created: ${appealId} for request ${requestId} by athlete ${user.id}`);

  res.status(201).json({
    success: true,
    message: 'Appeal submitted successfully',
    appealId
  });
}));

// Get athlete's appeals
router.get('/my-appeals', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.type !== 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const result = await query(`
    SELECT a.*, qcr.competition_record_id, ac.competition_name, ac.game_name, ac.competition_level
    FROM appeals a
    INNER JOIN quota_certificate_requests qcr ON a.request_id = qcr.id
    LEFT JOIN athlete_competitions ac ON qcr.competition_record_id = ac.id
    WHERE a.athlete_id = ?
    ORDER BY a.created_at DESC
  `, [user.id]);

  const appeals = result.rows.map((row: any) => ({
    id: row.id,
    requestId: row.request_id,
    reason: row.reason,
    status: row.status,
    adminResponse: row.admin_response,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    // Competition info
    competitionName: row.competition_name,
    gameName: row.game_name,
    competitionLevel: row.competition_level
  }));

  res.json({
    success: true,
    appeals,
    count: appeals.length
  });
}));

export default router;
