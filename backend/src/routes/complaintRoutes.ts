import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database-sqlite';
import { logger } from '../utils/logger';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// Create a new complaint
router.post('/create', asyncHandler(async (req: Request, res: Response) => {
  const { certHash, name, email, type, description } = req.body;

  // Validate required fields
  if (!certHash || !name || !email || !type || !description) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: certHash, name, email, type, description'
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    });
  }

  // Validate complaint type
  const validTypes = ['incorrect_info', 'fraudulent', 'unauthorized', 'technical', 'other'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid complaint type'
    });
  }

  try {
    // Check if certificate exists
    const certResult = await query(
      'SELECT id FROM certificates WHERE cert_hash = ?',
      [certHash]
    );

    if (!certResult.rows || certResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }

    const complaintId = uuidv4();

    // Insert complaint
    await query(
      `INSERT INTO complaints (id, cert_hash, name, email, type, description, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [complaintId, certHash, name, email, type, description]
    );

    logger.info(`Complaint created: ${complaintId} for certificate ${certHash}`);

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      complaintId
    });
  } catch (error) {
    logger.error('Error creating complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create complaint'
    });
  }
}));

// Get all complaints (admin only)
router.get('/all', asyncHandler(async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let queryText = `
      SELECT
        c.id,
        c.cert_hash,
        c.name,
        c.email,
        c.type,
        c.description,
        c.status,
        c.resolution,
        c.created_at,
        c.updated_at,
        c.resolved_at,
        c.resolved_by,
        cert.subject_name,
        cert.certificate_type,
        cert.issuer_name
      FROM complaints c
      LEFT JOIN certificates cert ON c.cert_hash = cert.cert_hash
    `;

    const params: any[] = [];

    if (status) {
      queryText += ' WHERE c.status = ?';
      params.push(status);
    }

    queryText += ' ORDER BY c.created_at DESC';

    const result = await query(queryText, params);

    res.json({
      success: true,
      complaints: result.rows || []
    });
  } catch (error) {
    logger.error('Error fetching complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints'
    });
  }
}));

// Get complaint by ID
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const result = await query(
      `SELECT
        c.*,
        cert.subject_name,
        cert.certificate_type,
        cert.issuer_name
      FROM complaints c
      LEFT JOIN certificates cert ON c.cert_hash = cert.cert_hash
      WHERE c.id = ?`,
      [id]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    res.json({
      success: true,
      complaint: result.rows[0]
    });
  } catch (error) {
    logger.error('Error fetching complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaint'
    });
  }
}));

// Update complaint status (admin only)
router.put('/:id/status', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, resolution, resolvedBy } = req.body;

  // Validate status
  const validStatuses = ['pending', 'in_progress', 'resolved', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status value'
    });
  }

  try {
    // Check if complaint exists
    const checkResult = await query(
      'SELECT id FROM complaints WHERE id = ?',
      [id]
    );

    if (!checkResult.rows || checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found'
      });
    }

    // Update complaint
    let updateQuery = 'UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [status];

    if (resolution) {
      updateQuery += ', resolution = ?';
      params.push(resolution);
    }

    if (status === 'resolved' || status === 'rejected') {
      updateQuery += ', resolved_at = CURRENT_TIMESTAMP';
      if (resolvedBy) {
        updateQuery += ', resolved_by = ?';
        params.push(resolvedBy);
      }
    }

    updateQuery += ' WHERE id = ?';
    params.push(id);

    await query(updateQuery, params);

    logger.info(`Complaint ${id} updated to status: ${status}`);

    res.json({
      success: true,
      message: 'Complaint updated successfully'
    });
  } catch (error) {
    logger.error('Error updating complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update complaint'
    });
  }
}));

// Get complaints by certificate hash
router.get('/certificate/:certHash', asyncHandler(async (req: Request, res: Response) => {
  const { certHash } = req.params;

  try {
    const result = await query(
      `SELECT * FROM complaints WHERE cert_hash = ? ORDER BY created_at DESC`,
      [certHash]
    );

    res.json({
      success: true,
      complaints: result.rows || []
    });
  } catch (error) {
    logger.error('Error fetching complaints by certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch complaints'
    });
  }
}));

// Get complaint statistics (admin only)
router.get('/stats/summary', asyncHandler(async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM complaints
    `);

    res.json({
      success: true,
      stats: result.rows[0] || {
        total: 0,
        pending: 0,
        in_progress: 0,
        resolved: 0,
        rejected: 0
      }
    });
  } catch (error) {
    logger.error('Error fetching complaint statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
}));

export default router;
