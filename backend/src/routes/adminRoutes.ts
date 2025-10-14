import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database-sqlite';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { certificateService } from '../services/certificateService';
import { pdfService } from '../services/pdfService';
import { emailService } from '../services/emailService';

const router = Router();

// Get all certificate requests
router.get('/certificate-requests', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.type !== 'issuer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied - Admin only'
    });
  }

  const status = req.query.status as string;
  let queryStr = `
    SELECT
      qcr.*,
      a.full_name as athlete_name,
      a.email as athlete_email,
      a.phone_number as athlete_phone,
      ac.full_name, ac.father_name, ac.dob, ac.district,
      ac.game_name, ac.competition_name, ac.competition_level,
      ac.competition_period, ac.competition_held_at, ac.position_obtained,
      ac.certificate_no, ac.representing_district, ac.division_state_country,
      ac.valid_for_employment_group, ac.applicable_govt_resolutions
    FROM quota_certificate_requests qcr
    INNER JOIN athletes a ON qcr.athlete_id = a.id
    INNER JOIN athlete_competitions ac ON qcr.competition_record_id = ac.id
  `;

  const params: any[] = [];
  if (status) {
    queryStr += ' WHERE qcr.status = ?';
    params.push(status);
  }

  queryStr += ' ORDER BY qcr.requested_at DESC';

  const result = await query(queryStr, params);

  const requests = result.rows.map((row: any) => ({
    id: row.id,
    athleteId: row.athlete_id,
    athleteName: row.athlete_name,
    athleteEmail: row.athlete_email,
    athletePhone: row.athlete_phone,
    competitionRecordId: row.competition_record_id,
    status: row.status,
    certificateHash: row.certificate_hash,
    adminNotes: row.admin_notes,
    rejectionReason: row.rejection_reason,
    requestedAt: row.requested_at,
    processedAt: row.processed_at,
    processedBy: row.processed_by,
    // Competition record details
    competitionData: {
      fullName: row.full_name,
      fatherName: row.father_name,
      dob: row.dob,
      district: row.district,
      representingDistrict: row.representing_district,
      divisionStateCountry: row.division_state_country,
      gameName: row.game_name,
      competitionName: row.competition_name,
      competitionLevel: row.competition_level,
      competitionPeriod: row.competition_period,
      competitionHeldAt: row.competition_held_at,
      positionObtained: row.position_obtained,
      certificateNo: row.certificate_no,
      validForEmploymentGroup: row.valid_for_employment_group,
      applicableGovtResolutions: row.applicable_govt_resolutions
    }
  }));

  res.json({
    success: true,
    requests,
    count: requests.length
  });
}));

// Approve certificate request and generate certificate
router.post('/approve-request/:requestId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { requestId } = req.params;
  const { adminNotes } = req.body;

  if (user.type !== 'issuer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied - Admin only'
    });
  }

  // Get request details
  const requestResult = await query(`
    SELECT qcr.*, ac.*, a.email as athlete_email
    FROM quota_certificate_requests qcr
    INNER JOIN athlete_competitions ac ON qcr.competition_record_id = ac.id
    INNER JOIN athletes a ON qcr.athlete_id = a.id
    WHERE qcr.id = ?
  `, [requestId]);

  if (requestResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  const request = requestResult.rows[0];

  if (request.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Request already processed' });
  }

  try {
    // Generate certificate
    const certificateData = {
      issuerDid: 'admin',
      issuerName: user.name || 'Directorate of Sports and Youth Services',
      subjectName: request.full_name,
      subjectEmail: request.athlete_email,
      certificateType: request.competition_type || 'Sports Achievement',
      metadata: {
        fatherName: request.father_name,
        dob: request.dob,
        district: request.district,
        representingDistrict: request.representing_district,
        divisionStateCountry: request.division_state_country,
        gameName: request.game_name,
        competitionName: request.competition_name,
        competitionPeriod: request.competition_period,
        competitionHeldAt: request.competition_held_at,
        competitionLevel: request.competition_level,
        positionObtained: request.position_obtained,
        certificateNo: request.certificate_no,
        validForEmploymentGroup: request.valid_for_employment_group,
        applicableGovtResolutions: request.applicable_govt_resolutions
      }
    };

    const certificate = await certificateService.issueCertificate(certificateData);

    // Get certificate with digital signature
    const dbResult = await certificateService.validateCertificate(certificate.certHash);
    const digitalSignature = dbResult.certificate?.digitalSignature || null;

    // Generate PDF
    const pdfData = {
      name: request.full_name,
      fatherName: request.father_name,
      dob: request.dob,
      district: request.district,
      representingDistrict: request.representing_district,
      divisionStateCountry: request.division_state_country,
      gameName: request.game_name,
      competitionName: request.competition_name,
      competitionPeriod: request.competition_period,
      competitionHeldAt: request.competition_held_at,
      competitionLevel: request.competition_level,
      positionObtained: request.position_obtained,
      certificateNo: request.certificate_no,
      validForEmploymentGroup: request.valid_for_employment_group,
      applicableGovtResolutions: request.applicable_govt_resolutions,
      certHash: certificate.certHash,
      issuerName: user.name || 'Deputy Director',
      issuerTitle: 'Deputy Director',
      organizationName: 'Sports and Youth Services, Maharashtra State',
      issueDate: new Date().toLocaleDateString('en-IN'),
      digitalSignature
    };

    const pdfBuffer = await pdfService.generateCertificatePDF(pdfData);

    // Send email
    if (request.athlete_email) {
      await emailService.sendCertificateEmail(
        request.athlete_email,
        request.full_name,
        certificate.certHash,
        pdfBuffer,
        certificateData.certificateType
      );
    }

    // Update request status
    await query(`
      UPDATE quota_certificate_requests
      SET status = ?, certificate_id = ?, certificate_hash = ?, admin_notes = ?,
          processed_at = datetime('now'), processed_by = ?
      WHERE id = ?
    `, ['approved', certificate.id, certificate.certHash, adminNotes, user.username || user.name, requestId]);

    // Mark competition record as certificate issued
    await query(
      'UPDATE athlete_competitions SET certificate_issued = 1 WHERE id = ?',
      [request.competition_record_id]
    );

    res.json({
      success: true,
      message: 'Certificate approved and generated successfully',
      certificateHash: certificate.certHash
    });

  } catch (error) {
    logger.error('Error approving certificate request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate certificate: ' + (error instanceof Error ? error.message : 'Unknown error')
    });
  }
}));

// Reject certificate request
router.post('/reject-request/:requestId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { requestId } = req.params;
  const { rejectionReason, adminNotes } = req.body;

  if (user.type !== 'issuer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied - Admin only'
    });
  }

  if (!rejectionReason) {
    return res.status(400).json({ success: false, message: 'Rejection reason is required' });
  }

  // Get request
  const requestResult = await query(
    'SELECT * FROM quota_certificate_requests WHERE id = ?',
    [requestId]
  );

  if (requestResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Request not found' });
  }

  const request = requestResult.rows[0];

  if (request.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Request already processed' });
  }

  // Update request status
  await query(`
    UPDATE quota_certificate_requests
    SET status = ?, rejection_reason = ?, admin_notes = ?,
        processed_at = datetime('now'), processed_by = ?
    WHERE id = ?
  `, ['rejected', rejectionReason, adminNotes, user.username || user.name, requestId]);

  res.json({
    success: true,
    message: 'Certificate request rejected'
  });
}));

// Get all appeals
router.get('/appeals', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  if (user.type !== 'issuer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied - Admin only'
    });
  }

  const status = req.query.status as string;
  let queryStr = `
    SELECT
      app.*,
      a.full_name as athlete_name,
      a.email as athlete_email,
      a.phone_number as athlete_phone,
      qcr.status as request_status,
      qcr.requested_at,
      ac.game_name,
      ac.competition_name,
      ac.competition_level,
      ac.position_obtained
    FROM appeals app
    INNER JOIN athletes a ON app.athlete_id = a.id
    INNER JOIN quota_certificate_requests qcr ON app.request_id = qcr.id
    LEFT JOIN athlete_competitions ac ON qcr.competition_record_id = ac.id
  `;

  const params: any[] = [];
  if (status) {
    queryStr += ' WHERE app.status = ?';
    params.push(status);
  }

  queryStr += ' ORDER BY app.created_at DESC';

  const result = await query(queryStr, params);

  const appeals = result.rows.map((row: any) => ({
    id: row.id,
    requestId: row.request_id,
    athleteId: row.athlete_id,
    athleteName: row.athlete_name,
    athleteEmail: row.athlete_email,
    athletePhone: row.athlete_phone,
    reason: row.reason,
    status: row.status,
    adminResponse: row.admin_response,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    requestStatus: row.request_status,
    requestedAt: row.requested_at,
    // Competition info
    gameName: row.game_name,
    competitionName: row.competition_name,
    competitionLevel: row.competition_level,
    positionObtained: row.position_obtained
  }));

  res.json({
    success: true,
    appeals,
    count: appeals.length
  });
}));

// Resolve appeal
router.post('/resolve-appeal/:appealId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { appealId } = req.params;
  const { adminResponse, status } = req.body;

  if (user.type !== 'issuer') {
    return res.status(403).json({
      success: false,
      message: 'Access denied - Admin only'
    });
  }

  if (!adminResponse || !status) {
    return res.status(400).json({ success: false, message: 'Admin response and status are required' });
  }

  if (!['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status. Must be "accepted" or "rejected"' });
  }

  // Get appeal details
  const appealResult = await query(
    'SELECT * FROM appeals WHERE id = ?',
    [appealId]
  );

  if (appealResult.rows.length === 0) {
    return res.status(404).json({ success: false, message: 'Appeal not found' });
  }

  const appeal = appealResult.rows[0];

  if (appeal.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Appeal already resolved' });
  }

  // Update appeal
  await query(`
    UPDATE appeals
    SET status = ?, admin_response = ?, resolved_by = ?, resolved_at = datetime('now')
    WHERE id = ?
  `, [status, adminResponse, user.username || user.name, appealId]);

  logger.info(`Appeal ${appealId} resolved with status: ${status} by ${user.username || user.name}`);

  // If accepted, potentially auto-approve the request
  // (You may want to handle this differently based on your requirements)

  // TODO: Send notification to athlete via email

  res.json({
    success: true,
    message: `Appeal ${status} successfully`
  });
}));

export default router;
