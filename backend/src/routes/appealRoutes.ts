import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database-sqlite';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

// Create a new appeal (First or Second)
router.post('/create', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { requestId, appealLevel, reason, supportingDocuments } = req.body;

  if (user.type !== 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Only athletes can file appeals.'
    });
  }

  // Validation
  if (!appealLevel || !reason) {
    return res.status(400).json({
      success: false,
      message: 'Appeal level and reason are required'
    });
  }

  if (![1, 2].includes(appealLevel)) {
    return res.status(400).json({
      success: false,
      message: 'Appeal level must be 1 (First Appeal) or 2 (Second Appeal)'
    });
  }

  try {
    // If requestId is provided, verify it exists and belongs to the athlete
    if (requestId) {
      const requestResult = await query(
        'SELECT * FROM quota_certificate_requests WHERE id = ? AND athlete_id = ?',
        [requestId, user.id]
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Certificate request not found or does not belong to you'
        });
      }

      // Check if request was rejected
      if (requestResult.rows[0].status !== 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'You can only appeal rejected certificate requests'
        });
      }
    }

    // For second appeal, verify first appeal was rejected
    if (appealLevel === 2) {
      const firstAppealResult = await query(
        `SELECT * FROM certificate_appeals
         WHERE athlete_id = ? AND appeal_level = 1
         ${requestId ? 'AND request_id = ?' : ''}
         ORDER BY created_at DESC
         LIMIT 1`,
        requestId ? [user.id, requestId] : [user.id]
      );

      if (firstAppealResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'You must file a first appeal before filing a second appeal'
        });
      }

      if (firstAppealResult.rows[0].status !== 'rejected') {
        return res.status(400).json({
          success: false,
          message: 'You can only file a second appeal if your first appeal was rejected'
        });
      }
    }

    // Create appeal
    const appealId = uuidv4();
    const appealType = appealLevel === 1 ? 'first_appeal' : 'second_appeal';

    await query(
      `INSERT INTO certificate_appeals
       (id, request_id, athlete_id, appeal_type, appeal_level, reason, supporting_documents, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [appealId, requestId || null, user.id, appealType, appealLevel, reason, supportingDocuments || null]
    );

    const authority = appealLevel === 1
      ? 'Joint Director, Sports and Youth Services'
      : 'Commissioner, Sports and Youth Services, Pune';

    logger.info(`Appeal created: ${appealId} (Level ${appealLevel}) for athlete ${user.id}`);

    res.status(201).json({
      success: true,
      message: `Your ${appealType.replace('_', ' ')} has been submitted to ${authority}`,
      appealId,
      appealLevel,
      authority
    });

  } catch (error) {
    logger.error('Error creating appeal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create appeal'
    });
  }
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

  try {
    const result = await query(
      `SELECT ca.*, qcr.unique_id, qcr.aadhar_number
       FROM certificate_appeals ca
       LEFT JOIN quota_certificate_requests qcr ON ca.request_id = qcr.id
       WHERE ca.athlete_id = ?
       ORDER BY ca.created_at DESC`,
      [user.id]
    );

    const appeals = result.rows.map((appeal: any) => ({
      id: appeal.id,
      requestId: appeal.request_id,
      appealType: appeal.appeal_type,
      appealLevel: appeal.appeal_level,
      reason: appeal.reason,
      supportingDocuments: appeal.supporting_documents,
      status: appeal.status,
      resolution: appeal.resolution,
      resolvedBy: appeal.resolved_by,
      resolvedAt: appeal.resolved_at,
      createdAt: appeal.created_at,
      updatedAt: appeal.updated_at,
      uniqueId: appeal.unique_id,
      aadharNumber: appeal.aadhar_number
    }));

    res.json({
      success: true,
      appeals
    });

  } catch (error) {
    logger.error('Error fetching appeals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appeals'
    });
  }
}));

// Admin: Get all appeals
router.get('/admin/all', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { status, appealLevel } = req.query;

  // Only admins/issuers can view all appeals
  if (user.type === 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  try {
    let queryText = `
      SELECT ca.*, a.full_name, a.email, a.unique_id, a.aadhar_number,
             qcr.status as request_status
      FROM certificate_appeals ca
      INNER JOIN athletes a ON ca.athlete_id = a.id
      LEFT JOIN quota_certificate_requests qcr ON ca.request_id = qcr.id
    `;

    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      conditions.push('ca.status = ?');
      params.push(status);
    }

    if (appealLevel) {
      conditions.push('ca.appeal_level = ?');
      params.push(appealLevel);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY ca.created_at DESC';

    const result = await query(queryText, params);

    const appeals = result.rows.map((appeal: any) => ({
      id: appeal.id,
      requestId: appeal.request_id,
      athleteId: appeal.athlete_id,
      athleteName: appeal.full_name,
      athleteEmail: appeal.email,
      uniqueId: appeal.unique_id,
      aadharNumber: appeal.aadhar_number,
      appealType: appeal.appeal_type,
      appealLevel: appeal.appeal_level,
      reason: appeal.reason,
      supportingDocuments: appeal.supporting_documents,
      status: appeal.status,
      resolution: appeal.resolution,
      resolvedBy: appeal.resolved_by,
      resolvedAt: appeal.resolved_at,
      createdAt: appeal.created_at,
      updatedAt: appeal.updated_at,
      requestStatus: appeal.request_status
    }));

    res.json({
      success: true,
      appeals
    });

  } catch (error) {
    logger.error('Error fetching all appeals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appeals'
    });
  }
}));

// Admin: Get appeal by ID
router.get('/admin/:appealId', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { appealId } = req.params;

  // Only admins/issuers can view appeal details
  if (user.type === 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  try {
    const result = await query(
      `SELECT ca.*, a.full_name, a.email, a.unique_id, a.aadhar_number,
              qcr.status as request_status, qcr.selected_records
       FROM certificate_appeals ca
       INNER JOIN athletes a ON ca.athlete_id = a.id
       LEFT JOIN quota_certificate_requests qcr ON ca.request_id = qcr.id
       WHERE ca.id = ?`,
      [appealId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appeal not found'
      });
    }

    const appeal = result.rows[0];

    res.json({
      success: true,
      appeal: {
        id: appeal.id,
        requestId: appeal.request_id,
        athleteId: appeal.athlete_id,
        athleteName: appeal.full_name,
        athleteEmail: appeal.email,
        uniqueId: appeal.unique_id,
        aadharNumber: appeal.aadhar_number,
        appealType: appeal.appeal_type,
        appealLevel: appeal.appeal_level,
        reason: appeal.reason,
        supportingDocuments: appeal.supporting_documents,
        status: appeal.status,
        resolution: appeal.resolution,
        resolvedBy: appeal.resolved_by,
        resolvedAt: appeal.resolved_at,
        createdAt: appeal.created_at,
        updatedAt: appeal.updated_at,
        requestStatus: appeal.request_status,
        selectedRecords: appeal.selected_records ? JSON.parse(appeal.selected_records) : null
      }
    });

  } catch (error) {
    logger.error('Error fetching appeal details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch appeal details'
    });
  }
}));

// Admin: Resolve appeal (Approve/Reject)
router.put('/admin/:appealId/resolve', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { appealId } = req.params;
  const { status, resolution } = req.body;

  // Only admins/issuers can resolve appeals
  if (user.type === 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const validStatuses = ['approved', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Status must be either "approved" or "rejected"'
    });
  }

  if (!resolution) {
    return res.status(400).json({
      success: false,
      message: 'Resolution reason is required'
    });
  }

  try {
    // Check if appeal exists
    const checkResult = await query(
      'SELECT * FROM certificate_appeals WHERE id = ?',
      [appealId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Appeal not found'
      });
    }

    const appeal = checkResult.rows[0];

    if (appeal.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'This appeal has already been resolved'
      });
    }

    // Update appeal status
    await query(
      `UPDATE certificate_appeals
       SET status = ?, resolution = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [status, resolution, user.id, appealId]
    );

    // If appeal is approved and there's a linked request, update the request status to allow re-application
    if (status === 'approved' && appeal.request_id) {
      await query(
        `UPDATE quota_certificate_requests
         SET status = 'appeal_approved', admin_notes = ?, processed_at = CURRENT_TIMESTAMP, processed_by = ?
         WHERE id = ?`,
        [`Appeal approved: ${resolution}`, user.id, appeal.request_id]
      );
    }

    logger.info(`Appeal ${appealId} resolved as ${status} by ${user.id}`);

    res.json({
      success: true,
      message: `Appeal ${status} successfully`,
      appealId,
      status,
      canReapply: status === 'approved'
    });

  } catch (error) {
    logger.error('Error resolving appeal:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve appeal'
    });
  }
}));

// Get appeal statistics (Admin)
router.get('/admin/stats/summary', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;

  // Only admins/issuers can view statistics
  if (user.type === 'athlete') {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  try {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN appeal_level = 1 THEN 1 ELSE 0 END) as first_appeals,
        SUM(CASE WHEN appeal_level = 2 THEN 1 ELSE 0 END) as second_appeals
      FROM certificate_appeals
    `);

    res.json({
      success: true,
      stats: result.rows[0] || {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        first_appeals: 0,
        second_appeals: 0
      }
    });

  } catch (error) {
    logger.error('Error fetching appeal statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
}));

export default router;
