import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database-sqlite';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Validate athlete and retrieve competition data
router.post('/validate', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { uniqueId, aadharNumber } = req.body;

  if (user.type !== 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only athletes can request certificates.'
    });
  }

  // Validation
  if (!uniqueId || !aadharNumber) {
    return res.status(400).json({
      success: false,
      message: 'Unique ID and Aadhar number are required'
    });
  }

  try {
    // Verify athlete credentials match
    const athleteResult = await query(
      'SELECT * FROM athletes WHERE id = ? AND (unique_id = ? OR aadhar_number = ?)',
      [user.id, uniqueId, aadharNumber]
    );

    if (athleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The application to issue the certificate is being received and will receive the update in 15 days',
        dataFound: false
      });
    }

    // Fetch competition records
    const competitionResult = await query(
      `SELECT * FROM athlete_competitions
       WHERE (athlete_id = ? OR unique_id = ? OR aadhar_number = ?)
       AND certificate_issued = 0
       ORDER BY competition_date DESC`,
      [user.id, uniqueId, aadharNumber]
    );

    if (competitionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The application to issue the certificate is being received and will receive the update in 15 days',
        dataFound: false
      });
    }

    // Return competition data in tabular format
    res.json({
      success: true,
      dataFound: true,
      athlete: {
        id: athleteResult.rows[0].id,
        fullName: athleteResult.rows[0].full_name,
        email: athleteResult.rows[0].email,
        uniqueId: athleteResult.rows[0].unique_id,
        aadharNumber: athleteResult.rows[0].aadhar_number
      },
      competitions: competitionResult.rows.map((comp: any) => ({
        id: comp.id,
        competitionName: comp.competition_name,
        competitionType: comp.competition_type,
        eventName: comp.event_name,
        position: comp.position,
        medalType: comp.medal_type,
        competitionDate: comp.competition_date,
        competitionLevel: comp.competition_level,
        organizingBody: comp.organizing_body,
        location: comp.location
      }))
    });

  } catch (error) {
    logger.error('Error validating athlete data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate athlete data'
    });
  }
}));

// Submit certificate request with selected records
router.post('/request', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { uniqueId, aadharNumber, selectedRecords } = req.body;

  if (user.type !== 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only athletes can request certificates.'
    });
  }

  // Validation
  if (!uniqueId || !aadharNumber || !selectedRecords || !Array.isArray(selectedRecords) || selectedRecords.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Unique ID, Aadhar number, and selected records are required'
    });
  }

  try {
    // Verify athlete exists
    const athleteResult = await query(
      'SELECT * FROM athletes WHERE id = ?',
      [user.id]
    );

    if (athleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Athlete not found'
      });
    }

    // Verify selected competition records exist and belong to athlete
    const recordIds = selectedRecords.join("','");
    const verifyResult = await query(
      `SELECT COUNT(*) as count FROM athlete_competitions
       WHERE id IN ('${recordIds}')
       AND (athlete_id = ? OR unique_id = ? OR aadhar_number = ?)`,
      [user.id, uniqueId, aadharNumber]
    );

    if (verifyResult.rows[0].count !== selectedRecords.length) {
      return res.status(400).json({
        success: false,
        message: 'Invalid competition records selected'
      });
    }

    // Create certificate request
    const requestId = uuidv4();
    await query(
      `INSERT INTO quota_certificate_requests
       (id, athlete_id, unique_id, aadhar_number, selected_records, status, requested_at)
       VALUES (?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)`,
      [requestId, user.id, uniqueId, aadharNumber, JSON.stringify(selectedRecords)]
    );

    // Auto-approve and issue certificate (as per requirements - system automatically issues)
    // Note: In a real system, you might want admin approval first
    // For now, we'll mark it as approved and trigger certificate generation

    await query(
      `UPDATE quota_certificate_requests
       SET status = 'approved', processed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [requestId]
    );

    // Mark selected competitions as certificate_issued
    const updateQuery = `UPDATE athlete_competitions
                         SET certificate_issued = 1
                         WHERE id IN ('${recordIds}')`;
    await query(updateQuery);

    logger.info(`5% Quota certificate request created and auto-approved: ${requestId} for athlete ${user.id}`);

    res.status(201).json({
      success: true,
      message: 'Certificate request submitted and approved successfully. Your certificate is being generated.',
      requestId,
      status: 'approved'
    });

  } catch (error) {
    logger.error('Error creating certificate request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create certificate request'
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

  try {
    const result = await query(
      `SELECT * FROM quota_certificate_requests
       WHERE athlete_id = ?
       ORDER BY requested_at DESC`,
      [user.id]
    );

    const requests = result.rows.map((req: any) => ({
      id: req.id,
      uniqueId: req.unique_id,
      aadharNumber: req.aadhar_number,
      selectedRecords: JSON.parse(req.selected_records),
      status: req.status,
      certificateId: req.certificate_id,
      adminNotes: req.admin_notes,
      requestedAt: req.requested_at,
      processedAt: req.processed_at
    }));

    res.json({
      success: true,
      requests
    });

  } catch (error) {
    logger.error('Error fetching certificate requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificate requests'
    });
  }
}));

// Admin: Get all certificate requests
router.get('/admin/all', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { status } = req.query;

  // Only admins/issuers can view all requests
  if (user.type === 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  try {
    let queryText = `
      SELECT qcr.*, a.full_name, a.email
      FROM quota_certificate_requests qcr
      INNER JOIN athletes a ON qcr.athlete_id = a.id
    `;

    const params: any[] = [];

    if (status) {
      queryText += ' WHERE qcr.status = ?';
      params.push(status);
    }

    queryText += ' ORDER BY qcr.requested_at DESC';

    const result = await query(queryText, params);

    const requests = result.rows.map((req: any) => ({
      id: req.id,
      athleteId: req.athlete_id,
      athleteName: req.full_name,
      athleteEmail: req.email,
      uniqueId: req.unique_id,
      aadharNumber: req.aadhar_number,
      selectedRecords: JSON.parse(req.selected_records),
      status: req.status,
      certificateId: req.certificate_id,
      adminNotes: req.admin_notes,
      requestedAt: req.requested_at,
      processedAt: req.processed_at,
      processedBy: req.processed_by
    }));

    res.json({
      success: true,
      requests
    });

  } catch (error) {
    logger.error('Error fetching all certificate requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch certificate requests'
    });
  }
}));

// Admin: Update certificate request status
router.put('/admin/:requestId/status', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { requestId } = req.params;
  const { status, adminNotes, certificateId } = req.body;

  // Only admins/issuers can update status
  if (user.type === 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const validStatuses = ['pending', 'approved', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status value'
    });
  }

  try {
    // Check if request exists
    const checkResult = await query(
      'SELECT * FROM quota_certificate_requests WHERE id = ?',
      [requestId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certificate request not found'
      });
    }

    // Update request
    let updateQuery = 'UPDATE quota_certificate_requests SET status = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?';
    const params: any[] = [status, user.id];

    if (adminNotes) {
      updateQuery += ', admin_notes = ?';
      params.push(adminNotes);
    }

    if (certificateId) {
      updateQuery += ', certificate_id = ?';
      params.push(certificateId);
    }

    updateQuery += ' WHERE id = ?';
    params.push(requestId);

    await query(updateQuery, params);

    logger.info(`Certificate request ${requestId} updated to status: ${status} by ${user.id}`);

    res.json({
      success: true,
      message: 'Certificate request updated successfully'
    });

  } catch (error) {
    logger.error('Error updating certificate request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update certificate request'
    });
  }
}));

export default router;
