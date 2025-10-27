import PDFDocument from 'pdfkit';
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
        // Based on the template image positions (all moved 5px upward)
        const leftMargin = 280;  // Start position for field values (after labels)
        const rightMargin = pageWidth - 45;
        const fieldWidth = rightMargin - leftMargin;

        // Certificate Number and Date (top area) - moved 5px up
        doc.fontSize(10)
           .fillColor('#000000')
           .font('Helvetica');

        if (data.certificateNo) {
          doc.text(data.certificateNo, 90, 213, { width: 150 });
        }

        if (data.issueDate) {
          doc.text(data.issueDate, 445, 213, { width: 150 });
        }

        // Name of the Sports Person - Line 1 (moved 5px up)
        if (data.name) {
          doc.fontSize(10).text(data.name, leftMargin, 238, { width: fieldWidth });
        }

        // Son/Wife/Daughter of - Line 2 (moved 5px up)
        if (data.fatherName) {
          doc.text(data.fatherName, leftMargin, 262, { width: fieldWidth });
        }

        // Date of Birth - Line 3 (moved 5px up)
        if (data.dob) {
          doc.text(data.dob, leftMargin, 285, { width: fieldWidth });
        }

        // Resident of District - Line 4 (moved 5px up)
        if (data.district) {
          doc.text(data.district, leftMargin, 308, { width: fieldWidth });
        }

        // Representing District - Line 5 (moved 5px up)
        if (data.representingDistrict) {
          doc.text(data.representingDistrict, leftMargin, 331, { width: fieldWidth });
        }

        // District/Division/State/Country - Line 6 (moved 5px up)
        if (data.divisionStateCountry) {
          doc.text(data.divisionStateCountry, leftMargin, 355, { width: fieldWidth });
        }

        // Name of the Game - Line 7 (moved 5px up)
        if (data.gameName) {
          doc.text(data.gameName, leftMargin, 378, { width: fieldWidth });
        }

        // Name of the Competition - Line 8 (moved 5px up)
        if (data.competitionName) {
          doc.text(data.competitionName, leftMargin, 401, { width: fieldWidth });
        }

        // Period of the Competition - Line 9 (moved 5px up)
        if (data.competitionPeriod) {
          doc.text(data.competitionPeriod, leftMargin, 424, { width: fieldWidth });
        }

        // Competition Held at - Line 10 (moved 5px up)
        if (data.competitionHeldAt) {
          doc.text(data.competitionHeldAt, leftMargin, 447, { width: fieldWidth });
        }

        // Competition Level - Line 11 (moved 5px up)
        if (data.competitionLevel) {
          doc.text(data.competitionLevel, leftMargin, 471, { width: fieldWidth });
        }

        // Position Obtained - Line 12 (moved 5px up)
        if (data.positionObtained) {
          doc.text(data.positionObtained, leftMargin, 517, { width: fieldWidth });
        }

        // Certificate No. (appears again in the form) - Line 13 (moved 5px up)
        if (data.certificateNo) {
          doc.text(data.certificateNo, leftMargin, 540, { width: fieldWidth });
        }

        // Valid for employment to Group - Line 14 (moved 5px up)
        if (data.validForEmploymentGroup) {
          doc.text(data.validForEmploymentGroup, leftMargin, 563, { width: fieldWidth });
        }

        // Applicable Government Resolutions - Line 15 (moved 5px up)
        if (data.applicableGovtResolutions) {
          doc.fontSize(9).text(data.applicableGovtResolutions, leftMargin, 598, { width: fieldWidth });
        }

        // QR Code removed as per requirements

        // Digital signature indicator - moved 5px up and positioned at bottom
        if (data.digitalSignature) {
          doc.fontSize(5)
             .fillColor('#0066cc')
             .text(`Digital Signature: ${data.digitalSignature.algorithm}`, 380, 695, { width: 180 });

          doc.fontSize(5)
             .fillColor('#666666')
             .text(`Timestamp: ${new Date(data.digitalSignature.timestamp).toLocaleString('en-IN')}`, 380, 705, { width: 180 });
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