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
        // Aligned with the new certificate template
        const leftMargin = 240;  // Start position for field values (80 + 160 = moved right by 160px)
        const rightMargin = pageWidth - 40;
        const fieldWidth = rightMargin - leftMargin;

        // Set default font and color
        doc.fontSize(11)
           .fillColor('#000000')
           .font('Helvetica');

        // Certificate Number (top left - "No.DSYS/SRVC") - moved left by 150px total
        if (data.certificateNo) {
          doc.fontSize(10).text(data.certificateNo, 130, 297, { width: 200 });
        }

        // Date (top right) - ensure it's visible
        if (data.issueDate) {
          doc.fontSize(10).text(data.issueDate, 480, 297, { width: 100, align: 'left' });
        }

        // Name of the Sports Person - Line 1 (moved right by 160px, up by 10px)
        if (data.name) {
          doc.fontSize(11).text(data.name, leftMargin, 335, { width: fieldWidth });
        }

        // Son/Wife/Daughter of - Line 2 (moved right by 160px, up by 10px)
        if (data.fatherName) {
          doc.text(data.fatherName, leftMargin, 359, { width: fieldWidth });
        }

        // Date of Birth - Line 3 (up by 1px additional)
        if (data.dob) {
          doc.text(data.dob, leftMargin, 382, { width: fieldWidth });
        }

        // Resident of District - Line 4 (up by 2px more)
        if (data.district) {
          doc.text(data.district, leftMargin, 403, { width: fieldWidth });
        }

        // Representing(District/Division/State/Country) - Line 5 (up by 2px more)
        if (data.representingDistrict) {
          doc.text(data.representingDistrict, leftMargin, 426, { width: fieldWidth });
        }

        // Name of the Game - Line 6 (up by 4px more)
        if (data.gameName) {
          doc.text(data.gameName, leftMargin, 446, { width: fieldWidth });
        }

        // Name of the Competition - Line 7 (up by 4px more)
        if (data.competitionName) {
          doc.text(data.competitionName, leftMargin, 470, { width: fieldWidth });
        }

        // Period of the Competition - Line 8 (up by 5px more)
        if (data.competitionPeriod) {
          doc.text(data.competitionPeriod, leftMargin, 493, { width: fieldWidth });
        }

        // Competition Held at - Line 9 (up by 4px more)
        if (data.competitionHeldAt) {
          doc.text(data.competitionHeldAt, leftMargin, 518, { width: fieldWidth });
        }

        // Competition Level(State/National/International) - Line 10 (up by 4px more)
        if (data.competitionLevel) {
          doc.text(data.competitionLevel, leftMargin, 545, { width: fieldWidth });
        }

        // Position Obtained - Line 11 (up by 4px more)
        if (data.positionObtained) {
          doc.text(data.positionObtained, leftMargin, 569, { width: fieldWidth });
        }

        // Certificate No. (appears again in the form) - Line 12 (up by 2px more)
        if (data.certificateNo) {
          doc.text(data.certificateNo, leftMargin, 595, { width: fieldWidth });
        }

        // Valid for employment to Group - Line 13 (up by 2px more)
        if (data.validForEmploymentGroup) {
          doc.text(data.validForEmploymentGroup, leftMargin, 620, { width: fieldWidth });
        }

        // Applicable Government/Resolutions - Line 14 (up by 2px more)
        if (data.applicableGovtResolutions) {
          doc.fontSize(10).text(data.applicableGovtResolutions, leftMargin, 640, { width: fieldWidth });
        }

        // Generate and add QR code for validation (10% smaller)
        if (data.certHash) {
          try {
            const validationUrl = `https://pramaan.0-4.nl/static/validation.html?hash=${data.certHash}`;
            const qrCodeDataUrl = await QRCode.toDataURL(validationUrl, {
              errorCorrectionLevel: 'M',
              type: 'image/png',
              width: 120,
              margin: 1
            });

            // Convert data URL to buffer
            const qrBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');

            // Add QR code - 10% smaller (90 -> 81)
            doc.image(qrBuffer, pageWidth - 470, pageHeight - 160, { width: 81, height: 81 });
          } catch (error) {
            logger.error('QR code generation error:', error);
          }
        }

        // Digital signature indicator - moved down by 15px (20px down, then 5px up)
        if (data.digitalSignature) {
          doc.fontSize(7)
             .fillColor('#0066cc')
             .text(`Digital Signature: ${data.digitalSignature.algorithm}`, 420, 705, { width: 150 });

          doc.fontSize(7)
             .fillColor('#666666')
             .text(`Timestamp: ${new Date(data.digitalSignature.timestamp).toLocaleString('en-IN')}`, 430, 717, { width: 150 });
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