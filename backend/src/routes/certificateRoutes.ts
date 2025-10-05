import { Router, Request, Response } from 'express';
import { certificateService } from '../services/certificateService';
import { pdfService } from '../services/pdfService';
import { validateCertificateInput, validateSearchInput } from '../middleware/validation';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticate, authorize } from '../middleware/auth';
import { logger } from '../utils/logger';
import { query } from '../config/database-sqlite';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for certificate file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/certificates');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `cert-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

router.post('/issue',
  upload.single('certificateFile'),
  // Temporarily disable auth for testing
  // authenticate,
  // authorize('issuer'),
  // validateCertificateInput,  // Temporarily disable validation
  asyncHandler(async (req: Request, res: Response) => {
    let certificateFilePath: string | undefined;

    // If a file was uploaded, use its path
    if (req.file) {
      certificateFilePath = req.file.path;
      logger.info(`File uploaded: ${certificateFilePath}`);
    }

    // Parse metadata if it's a JSON string
    let metadata = {};
    if (req.body.metadata) {
      try {
        metadata = typeof req.body.metadata === 'string'
          ? JSON.parse(req.body.metadata)
          : req.body.metadata;
      } catch (e) {
        metadata = {};
      }
    }

    const certificateData = {
      issuerDid: req.body.issuerDid,
      issuerName: req.body.issuerName,
      subjectDid: req.body.subjectDid,
      subjectName: req.body.subjectName,
      subjectEmail: req.body.subjectEmail,
      certificateType: req.body.certificateType,
      expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
      metadata: metadata,
      uploadedFilePath: certificateFilePath, // Store the uploaded file path
    };

    const certificate = await certificateService.issueCertificate(certificateData);

    res.status(201).json({
      success: true,
      message: 'Certificate issued successfully',
      data: certificate,
      uploadedFile: certificateFilePath ? path.basename(certificateFilePath) : null,
    });
  })
);

router.get('/search',
  validateSearchInput,
  asyncHandler(async (req: Request, res: Response) => {
    const searchQuery = (req.query.q as string) || '';

    // Allow empty query to return all certificates
    const certificates = await certificateService.searchCertificates(searchQuery);

    res.json({
      success: true,
      data: certificates,
      count: certificates.length,
    });
  })
);

router.get('/validate/:certHash',
  asyncHandler(async (req: Request, res: Response) => {
    const { certHash } = req.params;

    const validation = await certificateService.validateCertificate(certHash);

    if (!validation.isValid && !validation.certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found',
      });
    }

    res.json({
      success: true,
      isValid: validation.isValid,
      certificate: validation.certificate,
      verification: {
        blockchain: validation.blockchainData,
        ipfs: validation.ipfsData ? { verified: true } : { verified: false },
      },
    });
  })
);

router.post('/revoke/:certHash',
  authenticate,
  authorize('issuer', 'admin'),
  asyncHandler(async (req: Request, res: Response) => {
    const { certHash } = req.params;
    const { reason } = req.body;
    const revokedBy = (req as any).user?.did || 'system';

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Revocation reason is required',
      });
    }

    await certificateService.revokeCertificate(certHash, reason, revokedBy);

    res.json({
      success: true,
      message: 'Certificate revoked successfully',
    });
  })
);

router.get('/qr/:certHash',
  asyncHandler(async (req: Request, res: Response) => {
    const { certHash } = req.params;

    const qrCode = await certificateService.generateQRCode(certHash);

    res.json({
      success: true,
      qrCode,
      validationUrl: `${process.env.QR_BASE_URL || 'http://localhost:3000'}/validate/${certHash}`,
    });
  })
);

router.get('/download/:certHash',
  asyncHandler(async (req: Request, res: Response) => {
    const { certHash } = req.params;

    const dbQuery = `
      SELECT * FROM certificates
      WHERE cert_hash = ?
    `;

    const dbResult = await query(dbQuery, [certHash]);

    if (dbResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found',
      });
    }

    const certificate = dbResult.rows[0];

    // Parse metadata
    let metadata = certificate.metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        metadata = {};
      }
    }

    // Check if certificate has an uploaded file
    if (metadata.uploadedFilePath && fs.existsSync(metadata.uploadedFilePath)) {
      // Serve the uploaded file directly
      const fileName = path.basename(metadata.uploadedFilePath);
      const fileExt = path.extname(fileName).toLowerCase();

      let contentType = 'application/octet-stream';
      if (fileExt === '.pdf') {
        contentType = 'application/pdf';
      } else if (['.jpg', '.jpeg'].includes(fileExt)) {
        contentType = 'image/jpeg';
      } else if (fileExt === '.png') {
        contentType = 'image/png';
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      const fileStream = fs.createReadStream(metadata.uploadedFilePath);
      return fileStream.pipe(res);
    }

    // Generate PDF certificate if no uploaded file
    try {
      // Parse digital signature if present
      let digitalSignature = null;
      if (certificate.digital_signature) {
        try {
          digitalSignature = JSON.parse(certificate.digital_signature);
        } catch (e) {
          // Ignore if parsing fails
        }
      }

      const pdfData = {
        name: certificate.subject_name,
        fatherName: metadata.fatherName || '',
        dob: metadata.dob || '',
        district: metadata.district || '',
        gameName: metadata.gameName || '',
        competitionPeriod: metadata.competitionPeriod || '',
        competitionName: metadata.competitionName || '',
        competitionHeldAt: metadata.competitionHeldAt || '',
        competitionLevel: metadata.competitionLevel || '',
        certificateNo: metadata.certificateNo || certificate.id,
        representingDistrict: metadata.representingDistrict || '',
        divisionStateCountry: metadata.divisionStateCountry || '',
        positionObtained: metadata.positionObtained || '',
        validForEmploymentGroup: metadata.validForEmploymentGroup || '',
        applicableGovtResolutions: metadata.applicableGovtResolutions || '',
        issuerName: certificate.issuer_name,
        issuerTitle: 'Deputy Director',
        organizationName: 'Sports and Youth Services, Maharashtra State',
        certHash: certificate.cert_hash,
        issueDate: new Date(certificate.issued_date).toLocaleDateString('en-IN'),
        digitalSignature
      };

      const pdfBuffer = await pdfService.generateCertificatePDF(pdfData);

      // Set headers for PDF download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="certificate_${certificate.subject_name.replace(/\s+/g, '_')}_${certHash.substring(0, 8)}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length.toString());

      return res.send(pdfBuffer);
    } catch (error) {
      logger.error('Failed to generate PDF:', error);

      // Fallback to JSON if PDF generation fails
      const certificateDoc = {
        certificateHash: certHash,
        issuerName: certificate.issuer_name,
        subjectName: certificate.subject_name,
        subjectEmail: certificate.subject_email,
        certificateType: certificate.certificate_type,
        issuedDate: certificate.issued_date,
        expiryDate: certificate.expiry_date,
        status: certificate.status,
        blockchainTxHash: certificate.blockchain_tx_hash,
        ipfsCid: certificate.ipfs_cid,
        metadata: metadata
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="certificate_${certHash.substring(0, 8)}.json"`);
      res.json(certificateDoc);
    }
  })
);

// Assign certificate to athlete
router.post('/assign/:certHash', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { certHash } = req.params;
  const { athleteId } = req.body;
  const assignedBy = (req as any).user?.did || (req as any).user?.email || 'system';

  if (!athleteId) {
    return res.status(400).json({
      success: false,
      message: 'Athlete ID is required'
    });
  }

  // Check if certificate exists
  const certResult = await query('SELECT * FROM certificates WHERE cert_hash = ?', [certHash]);

  if (certResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Certificate not found'
    });
  }

  const certificate = certResult.rows[0];

  // Check if athlete exists
  const athleteResult = await query('SELECT * FROM athletes WHERE id = ?', [athleteId]);

  if (athleteResult.rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Athlete not found'
    });
  }

  // Check if already assigned
  const existingAssignment = await query(
    'SELECT * FROM certificate_assignments WHERE certificate_id = ? AND athlete_id = ?',
    [certificate.id, athleteId]
  );

  if (existingAssignment.rows.length > 0) {
    return res.status(409).json({
      success: false,
      message: 'Certificate already assigned to this athlete'
    });
  }

  // Create assignment
  const assignmentId = require('uuid').v4();
  await query(
    `INSERT INTO certificate_assignments (id, certificate_id, athlete_id, assigned_by)
     VALUES (?, ?, ?, ?)`,
    [assignmentId, certificate.id, athleteId, assignedBy]
  );

  res.json({
    success: true,
    message: 'Certificate assigned successfully',
    assignment: {
      id: assignmentId,
      certificateId: certificate.id,
      certHash: certificate.cert_hash,
      athleteId
    }
  });
}));

// Auto-assign bulk certificates based on matching criteria
router.post('/auto-assign', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const assignedBy = (req as any).user?.did || (req as any).user?.email || 'system';

  // Get all unassigned certificates with metadata
  const certResult = await query(`
    SELECT c.* FROM certificates c
    LEFT JOIN certificate_assignments ca ON c.id = ca.certificate_id
    WHERE ca.id IS NULL AND c.metadata IS NOT NULL AND c.metadata != '{}'
  `);

  const certificates = certResult.rows;
  const assignments = [];
  const failures = [];

  for (const cert of certificates) {
    let metadata;
    try {
      metadata = typeof cert.metadata === 'string' ? JSON.parse(cert.metadata) : cert.metadata;
    } catch (e) {
      continue;
    }

    // Try to find matching athlete based on full name, DOB, email, or phone
    const matchCriteria = [];
    const matchParams = [];

    if (cert.subject_email) {
      matchCriteria.push('email = ?');
      matchParams.push(cert.subject_email);
    } else if (cert.subject_name && metadata.dob) {
      matchCriteria.push('(full_name = ? AND dob = ?)');
      matchParams.push(cert.subject_name, metadata.dob);
    } else if (cert.subject_name) {
      matchCriteria.push('full_name = ?');
      matchParams.push(cert.subject_name);
    }

    if (matchCriteria.length === 0) {
      failures.push({ certHash: cert.cert_hash, reason: 'Insufficient matching criteria' });
      continue;
    }

    const athleteResult = await query(
      `SELECT * FROM athletes WHERE ${matchCriteria.join(' OR ')} LIMIT 1`,
      matchParams
    );

    if (athleteResult.rows.length > 0) {
      const athlete = athleteResult.rows[0];

      // Check if already assigned
      const existingAssignment = await query(
        'SELECT * FROM certificate_assignments WHERE certificate_id = ? AND athlete_id = ?',
        [cert.id, athlete.id]
      );

      if (existingAssignment.rows.length === 0) {
        const assignmentId = require('uuid').v4();
        await query(
          `INSERT INTO certificate_assignments (id, certificate_id, athlete_id, assigned_by)
           VALUES (?, ?, ?, ?)`,
          [assignmentId, cert.id, athlete.id, assignedBy]
        );

        assignments.push({
          certHash: cert.cert_hash,
          athleteId: athlete.id,
          athleteName: athlete.full_name
        });
      }
    } else {
      failures.push({ certHash: cert.cert_hash, reason: 'No matching athlete found' });
    }
  }

  res.json({
    success: true,
    message: `Auto-assignment completed`,
    assigned: assignments.length,
    failed: failures.length,
    assignments,
    failures
  });
}));

router.get('/verify/:certHash',
  asyncHandler(async (req: Request, res: Response) => {
    const { certHash } = req.params;

    const validation = await certificateService.validateCertificate(certHash);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Certificate Validation</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container {
            background: white;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
          }
          .status {
            text-align: center;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .valid {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }
          .invalid {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
          }
          .expired {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeeba;
          }
          .info {
            margin: 15px 0;
            padding: 10px;
            background: #f8f9fa;
            border-radius: 5px;
          }
          .label {
            font-weight: bold;
            color: #495057;
          }
          .value {
            color: #212529;
          }
          h1 {
            color: #212529;
            text-align: center;
          }
          .verification-badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 3px;
            font-size: 12px;
            margin-left: 10px;
          }
          .verified {
            background: #28a745;
            color: white;
          }
          .unverified {
            background: #dc3545;
            color: white;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Certificate Validation</h1>
          ${validation.certificate ? `
            <div class="status ${validation.isValid ? 'valid' : validation.certificate.isExpired ? 'expired' : 'invalid'}">
              <h2>${validation.isValid ? '✓ Valid Certificate' : validation.certificate.isExpired ? '⚠ Expired Certificate' : '✗ Invalid Certificate'}</h2>
            </div>
            <div class="info">
              <span class="label">Certificate Hash:</span>
              <span class="value">${validation.certificate.certificateHash}</span>
            </div>
            <div class="info">
              <span class="label">Subject:</span>
              <span class="value">${validation.certificate.subjectName}</span>
            </div>
            <div class="info">
              <span class="label">Issuer:</span>
              <span class="value">${validation.certificate.issuerName}</span>
            </div>
            <div class="info">
              <span class="label">Type:</span>
              <span class="value">${validation.certificate.certificateType}</span>
            </div>
            <div class="info">
              <span class="label">Issued Date:</span>
              <span class="value">${new Date(validation.certificate.issuedDate).toLocaleDateString()}</span>
            </div>
            ${validation.certificate.expiryDate ? `
              <div class="info">
                <span class="label">Expiry Date:</span>
                <span class="value">${new Date(validation.certificate.expiryDate).toLocaleDateString()}</span>
              </div>
            ` : ''}
            <div class="info">
              <span class="label">Status:</span>
              <span class="value">${validation.certificate.status}</span>
              ${validation.certificate.isRevoked ? '<span class="verification-badge unverified">Revoked</span>' : ''}
            </div>
            <div class="info">
              <span class="label">Blockchain:</span>
              <span class="value">Verification</span>
              <span class="verification-badge ${validation.certificate.blockchainVerified ? 'verified' : 'unverified'}">
                ${validation.certificate.blockchainVerified ? 'Verified' : 'Not Verified'}
              </span>
            </div>
            <div class="info">
              <span class="label">IPFS:</span>
              <span class="value">Storage</span>
              <span class="verification-badge ${validation.certificate.ipfsVerified ? 'verified' : 'unverified'}">
                ${validation.certificate.ipfsVerified ? 'Verified' : 'Not Verified'}
              </span>
            </div>
          ` : `
            <div class="status invalid">
              <h2>✗ Certificate Not Found</h2>
              <p>The certificate with this hash does not exist in our system.</p>
            </div>
          `}
        </div>
      </body>
      </html>
    `;

    res.send(html);
  })
);

export default router;