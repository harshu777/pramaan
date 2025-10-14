import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

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
        // Based on the template image positions
        const leftMargin = 260;  // Start position for field values (after labels)
        const rightMargin = pageWidth - 45;
        const fieldWidth = rightMargin - leftMargin;

        // Certificate Number and Date (top right area)
        doc.fontSize(10)
           .fillColor('#000000')
           .font('Helvetica');

        if (data.certificateNo) {
          doc.text(data.certificateNo, 75, 224, { width: 150 });
        }

        if (data.issueDate) {
          doc.text(data.issueDate, 420, 224, { width: 150 });
        }

        // Name of the Sports Person
        if (data.name) {
          doc.fontSize(10).text(data.name, leftMargin, 264, { width: fieldWidth });
        }

        // Son/Wife/Daughter of
        if (data.fatherName) {
          doc.text(data.fatherName, leftMargin, 288, { width: fieldWidth });
        }

        // Date of Birth
        if (data.dob) {
          doc.text(data.dob, leftMargin, 312, { width: fieldWidth });
        }

        // Resident of District
        if (data.district) {
          doc.text(data.district, leftMargin, 336, { width: fieldWidth });
        }

        // Representing (District/Division/State/Country)
        if (data.representingDistrict || data.divisionStateCountry) {
          const representingText = data.representingDistrict || '';
          doc.text(representingText, leftMargin, 360, { width: fieldWidth });

          if (data.divisionStateCountry) {
            doc.text(data.divisionStateCountry, leftMargin, 384, { width: fieldWidth });
          }
        }

        // Name of the Game
        if (data.gameName) {
          doc.text(data.gameName, leftMargin, 432, { width: fieldWidth });
        }

        // Name of the Competition
        if (data.competitionName) {
          doc.text(data.competitionName, leftMargin, 456, { width: fieldWidth });
        }

        // Period of the Competition
        if (data.competitionPeriod) {
          doc.text(data.competitionPeriod, leftMargin, 480, { width: fieldWidth });
        }

        // Competition Held at
        if (data.competitionHeldAt) {
          doc.text(data.competitionHeldAt, leftMargin, 504, { width: fieldWidth });
        }

        // Competition Level
        if (data.competitionLevel) {
          doc.text(data.competitionLevel, leftMargin, 528, { width: fieldWidth });
        }

        // Position Obtained
        if (data.positionObtained) {
          doc.text(data.positionObtained, leftMargin, 576, { width: fieldWidth });
        }

        // Certificate No. (appears again in the form)
        if (data.certificateNo) {
          doc.text(data.certificateNo, leftMargin, 600, { width: fieldWidth });
        }

        // Valid for employment to Group
        if (data.validForEmploymentGroup) {
          doc.text(data.validForEmploymentGroup, leftMargin, 624, { width: fieldWidth });
        }

        // Applicable Government Resolutions
        if (data.applicableGovtResolutions) {
          doc.fontSize(9).text(data.applicableGovtResolutions, leftMargin, 648, { width: fieldWidth });
        }

        // QR Code - position at bottom left as per template
        if (data.certHash) {
          const qrData = `${process.env.QR_BASE_URL || 'http://localhost:3000'}/static/validation.html?hash=${data.certHash}`;
          const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 120,
            margin: 1,
          });

          const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
          // Position QR code at bottom left (around where "SCAN ME" text is in template)
          doc.image(qrCodeBuffer, 85, 710, { width: 90, height: 90 });
        }

        // Digital signature indicator if present (optional, can be added)
        if (data.digitalSignature) {
          doc.fontSize(6)
             .fillColor('#0066cc')
             .text(`Digital Signature: ${data.digitalSignature.algorithm}`, 400, 710);

          doc.fontSize(5)
             .fillColor('#666666')
             .text(`Timestamp: ${new Date(data.digitalSignature.timestamp).toLocaleString('en-IN')}`, 400, 720);
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