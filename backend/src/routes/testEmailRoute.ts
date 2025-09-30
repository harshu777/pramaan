import { Router, Request, Response } from 'express';
import { emailService } from '../services/emailService';
import { pdfService } from '../services/pdfService';
import { certificateService } from '../services/certificateService';
import { asyncHandler } from '../middleware/asyncHandler';
import { query } from '../config/database-sqlite';
import { logger } from '../utils/logger';

const router = Router();

router.post('/send-test-email',
  asyncHandler(async (req: Request, res: Response) => {
    const { email, certificateHash } = req.body;

    // Use provided email or default to the test email
    const recipientEmail = email || 'laron.miller52@ethereal.email';

    try {
      if (certificateHash) {
        // Send existing certificate
        const dbQuery = `SELECT * FROM certificates WHERE cert_hash = ?`;
        const dbResult = await query(dbQuery, [certificateHash]);

        if (dbResult.rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Certificate not found'
          });
        }

        const certificate = dbResult.rows[0];
        let metadata = certificate.metadata;
        if (typeof metadata === 'string') {
          try {
            metadata = JSON.parse(metadata);
          } catch (e) {
            metadata = {};
          }
        }

        // Generate PDF
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
          certHash: certificate.cert_hash
        };

        const pdfBuffer = await pdfService.generateCertificatePDF(pdfData);

        // Send email
        const emailSent = await emailService.sendCertificateEmail(
          recipientEmail,
          certificate.subject_name,
          certificate.cert_hash,
          pdfBuffer,
          certificate.certificate_type
        );

        return res.json({
          success: emailSent,
          message: emailSent ?
            `Certificate email sent to ${recipientEmail}` :
            'Failed to send email',
          recipientEmail,
          certificateHash: certificate.cert_hash
        });

      } else {
        // Create and send a new test certificate
        const testCertificateData = {
          issuerDid: 'did:test:123456',
          issuerName: 'Sports and Youth Services, Maharashtra State',
          subjectName: 'Test User',
          subjectEmail: recipientEmail,
          certificateType: 'Sports Achievement Certificate',
          expiryDate: undefined,
          metadata: {
            fatherName: 'Test Father',
            dob: '01/01/1990',
            district: 'Mumbai',
            gameName: 'Kho Kho',
            competitionPeriod: '01/01/2024 - 05/01/2024',
            competitionName: 'State Championship 2024',
            competitionHeldAt: 'Mumbai Sports Complex',
            competitionLevel: 'STATE',
            certificateNo: 'TEST-' + Date.now(),
            representingDistrict: 'Mumbai',
            divisionStateCountry: 'Maharashtra',
            positionObtained: '1st',
            validForEmploymentGroup: 'Group A',
            applicableGovtResolutions: 'GR-2024/123'
          }
        };

        // Issue certificate
        const certificate = await certificateService.issueCertificate(testCertificateData);

        // Generate PDF
        const pdfData = {
          name: testCertificateData.subjectName,
          ...testCertificateData.metadata,
          issuerName: testCertificateData.issuerName,
          issuerTitle: 'Deputy Director',
          organizationName: 'Sports and Youth Services, Maharashtra State',
          certHash: certificate.certHash
        };

        const pdfBuffer = await pdfService.generateCertificatePDF(pdfData);

        // Send email
        const emailSent = await emailService.sendCertificateEmail(
          recipientEmail,
          testCertificateData.subjectName,
          certificate.certHash,
          pdfBuffer,
          testCertificateData.certificateType
        );

        return res.json({
          success: emailSent,
          message: emailSent ?
            `Test certificate created and emailed to ${recipientEmail}` :
            'Certificate created but email failed',
          certificateHash: certificate.certHash,
          recipientEmail,
          validationUrl: `${process.env.QR_BASE_URL || 'http://localhost:3000'}/api/certificates/verify/${certificate.certHash}`
        });
      }
    } catch (error) {
      logger.error('Test email error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error sending test email',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })
);

router.get('/test-email-info',
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Email service is configured',
      testAccounts: {
        ethereal: {
          viewEmails: 'https://ethereal.email/messages',
          info: 'Test emails are captured by Ethereal Email service'
        }
      },
      endpoints: {
        sendTestEmail: 'POST /api/test/send-test-email',
        parameters: {
          email: 'Recipient email (optional, defaults to laron.miller52@ethereal.email)',
          certificateHash: 'Hash of existing certificate to send (optional)'
        }
      }
    });
  })
);

export default router;