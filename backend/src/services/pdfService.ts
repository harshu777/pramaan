import PDFDocument from 'pdfkit';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';

interface CertificateData {
  name: string;
  fatherName?: string;
  dob?: string;
  district?: string;
  gameName?: string;
  competitionPeriod?: string;
  competitionName?: string;
  competitionHeldAt?: string;
  competitionLevel?: string;
  certificateNo?: string;
  representingDistrict?: string;
  divisionStateCountry?: string;
  positionObtained?: string;
  validForEmploymentGroup?: string;
  applicableGovtResolutions?: string;
  issuerName?: string;
  issuerTitle?: string;
  organizationName?: string;
  certHash?: string;
  issueDate?: string;
  digitalSignature?: {
    signature: string;
    algorithm: string;
    timestamp: string;
  };
}

class PDFService {
  async generateCertificatePDF(data: CertificateData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          layout: 'portrait',
          margin: 0
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const centerX = pageWidth / 2;

        // Use the new certificate template as background
        const imagesPath = path.join(__dirname, '../../public/images');
        const templatePath = path.join(imagesPath, 'certificate-template.jpg');

        if (fs.existsSync(templatePath)) {
          // Add template image as background covering full page
          doc.image(templatePath, 0, 0, { width: pageWidth, height: pageHeight });
        } else {
          logger.warn('Certificate template not found, using fallback design');
        }

        // Now overlay text on the template at specific positions
        // All text moved 20px down
        const leftMargin = 280;  // Start position for field values (after labels)
        const rightMargin = pageWidth - 45;
        const fieldWidth = rightMargin - leftMargin;

        // Certificate Number and Date (top area)
        doc.fontSize(10)
           .fillColor('#000000')
           .font('Helvetica');

        if (data.certificateNo) {
          doc.text(data.certificateNo, 100, 278, { width: 150 });
        }

        if (data.issueDate) {
          doc.text(data.issueDate, 455, 278, { width: 150 });
        }

        // Name of the Sports Person - Line 1
        if (data.name) {
          doc.fontSize(10).text(data.name, leftMargin, 298, { width: fieldWidth });
        }

        // Son/Wife/Daughter of - Line 2
        if (data.fatherName) {
          doc.text(data.fatherName, leftMargin, 322, { width: fieldWidth });
        }

        // Date of Birth - Line 3
        if (data.dob) {
          doc.text(data.dob, leftMargin, 345, { width: fieldWidth });
        }

        // Resident of District - Line 4
        if (data.district) {
          doc.text(data.district, leftMargin, 368, { width: fieldWidth });
        }

        // Representing District - Line 5
        if (data.representingDistrict) {
          doc.text(data.representingDistrict, leftMargin, 391, { width: fieldWidth });
        }

        // District/Division/State/Country - Line 6
        if (data.divisionStateCountry) {
          doc.text(data.divisionStateCountry, leftMargin, 415, { width: fieldWidth });
        }

        // Name of the Game - Line 7
        if (data.gameName) {
          doc.text(data.gameName, leftMargin, 438, { width: fieldWidth });
        }

        // Name of the Competition - Line 8
        if (data.competitionName) {
          doc.text(data.competitionName, leftMargin, 461, { width: fieldWidth });
        }

        // Period of the Competition - Line 9
        if (data.competitionPeriod) {
          doc.text(data.competitionPeriod, leftMargin, 484, { width: fieldWidth });
        }

        // Competition Held at - Line 10
        if (data.competitionHeldAt) {
          doc.text(data.competitionHeldAt, leftMargin, 507, { width: fieldWidth });
        }

        // Competition Level - Line 11
        if (data.competitionLevel) {
          doc.text(data.competitionLevel, leftMargin, 531, { width: fieldWidth });
        }

        // Position Obtained - Line 12
        if (data.positionObtained) {
          doc.text(data.positionObtained, leftMargin, 577, { width: fieldWidth });
        }

        // Certificate No. (appears again in the form) - Line 13
        if (data.certificateNo) {
          doc.text(data.certificateNo, leftMargin, 600, { width: fieldWidth });
        }

        // Valid for employment to Group - Line 14
        if (data.validForEmploymentGroup) {
          doc.text(data.validForEmploymentGroup, leftMargin, 623, { width: fieldWidth });
        }

        // Applicable Government Resolutions - Line 15
        if (data.applicableGovtResolutions) {
          doc.fontSize(9).text(data.applicableGovtResolutions, leftMargin, 658, { width: fieldWidth });
        }

        // Generate and add QR code for validation
        if (data.certHash) {
          try {
            const validationUrl = `https://pramaan.0-4.nl/static/validation.html?hash=${data.certHash}`;
            const qrCodeDataUrl = await QRCode.toDataURL(validationUrl, {
              errorCorrectionLevel: 'M',
              type: 'image/png',
              width: 100,
              margin: 1
            });

            // Convert data URL to buffer
            const qrBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

            // Add QR code to bottom left of certificate
            doc.image(qrBuffer, 50, 700, { width: 80, height: 80 });

            // Add small text below QR code
            doc.fontSize(7)
               .fillColor('#666666')
               .text('Scan to validate', 50, 785, { width: 80, align: 'center' });
          } catch (error) {
            logger.error('QR code generation error:', error);
          }
        }

        // Digital signature indicator - positioned on the right, below signature and above Deputy Director
        if (data.digitalSignature) {
          doc.fontSize(7)
             .fillColor('#0066cc')
             .text(`Digital Signature: ${data.digitalSignature.algorithm}`, 420, 722, { width: 150 });

          doc.fontSize(7)
             .fillColor('#666666')
             .text(`Timestamp: ${new Date(data.digitalSignature.timestamp).toLocaleString('en-IN')}`, 420, 734, { width: 150 });
        }

        // Note: Signature section, disclaimer, and footer text are already part of the template image
        // No need to add them programmatically

        doc.end();
      } catch (error) {
        logger.error('PDF generation error:', error);
        reject(error);
      }
    });
  }

  async generateBulkCertificates(certificates: CertificateData[]): Promise<Buffer[]> {
    const pdfs: Buffer[] = [];

    for (const cert of certificates) {
      try {
        const pdf = await this.generateCertificatePDF(cert);
        pdfs.push(pdf);
      } catch (error) {
        logger.error(`Failed to generate PDF for ${cert.name}:`, error);
        throw error;
      }
    }

    return pdfs;
  }
}

export const pdfService = new PDFService();