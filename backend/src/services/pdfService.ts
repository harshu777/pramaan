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
  competitionPeriodFrom?: string;
  competitionPeriodTo?: string;
  competitionName?: string;
  competitionHeldAt?: string;
  competitionLevel?: string;
  certificateNo?: string;
  // Generated certificate number in DSYS/GameCode/AgeGroupCode/000001 format for upper left "No." field
  generatedCertificateNo?: string;
  // Excel certificate number for bottom "Certificate No." field
  excelCertificateNo?: string;
  representingDistrict?: string;
  divisionStateCountry?: string;
  positionObtained?: string;
  validForEmploymentGroup?: string;
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
        // Aligned with the new certificate template (Krida E-Pramaan)
        const leftMargin = 265;  // Start position for field values
        const rightMargin = pageWidth - 40;
        const fieldWidth = rightMargin - leftMargin;

        // Set default font and color
        doc.fontSize(11)
           .fillColor('#000000')
           .font('Helvetica');

        // Certificate Number (top left - "No.") - ONLY show generated DSYS format number
        // Use ONLY generated certificate number (DSYS/GameCode/AgeGroupCode/000001 format) for upper left
        logger.info(`PDF Generation - Certificate numbers: Generated="${data.generatedCertificateNo || ''}", Excel="${data.excelCertificateNo || ''}", Legacy="${data.certificateNo || ''}"`);
        if (data.generatedCertificateNo) {
          doc.fontSize(10).text(data.generatedCertificateNo, 85, 311, { width: 200 });
          logger.info(`PDF Generation - Upper left No. field: "${data.generatedCertificateNo}"`);
        }

        // Date (top right) - left by 7px, down by 3px
        if (data.issueDate) {
          doc.fontSize(10).text(data.issueDate, 498, 311, { width: 100, align: 'left' });
        }

        // Name of the Sports Person - Line 1 (up by 7px)
        if (data.name) {
          doc.fontSize(11).text(data.name, leftMargin, 329, { width: fieldWidth });
        }

        // Father/Spouse's Name - Line 2
        if (data.fatherName) {
          doc.text(data.fatherName, leftMargin, 352, { width: fieldWidth });
        }

        // Date of Birth - Line 3
        if (data.dob) {
          doc.text(data.dob, leftMargin, 375, { width: fieldWidth });
        }

        // Resident of District - Line 4
        if (data.district) {
          doc.text(data.district, leftMargin, 398, { width: fieldWidth });
        }

        // Representing (District/Division/State/Country) - Line 5
        if (data.representingDistrict) {
          doc.text(data.representingDistrict, leftMargin, 421, { width: fieldWidth });
        }

        // Name of the Game - Line 6
        if (data.gameName) {
          doc.text(data.gameName, leftMargin, 444, { width: fieldWidth });
        }

        // Name of the Competition - Line 7
        if (data.competitionName) {
          doc.text(data.competitionName, leftMargin, 467, { width: fieldWidth });
        }

        // Period of the Competition - FROM (Line 8) and TO (Line 9) on SEPARATE lines
        // Handle both separate From/To fields and combined format "24TH MAY 2022 - 27TH MAY 2022"
        let periodFrom = data.competitionPeriodFrom || '';
        let periodTo = data.competitionPeriodTo || '';

        // Log the date values for debugging
        logger.info(`PDF Generation - Period dates: From="${periodFrom}", To="${periodTo}", Combined="${data.competitionPeriod || ''}"`);

        // If From/To not available but competitionPeriod has combined format, parse it
        if ((!periodFrom || !periodTo) && data.competitionPeriod) {
          // Try to parse combined format like "24TH MAY 2022 - 27TH MAY 2022" or "01-01-2024 to 05-01-2024"
          // Split on " - " (space-dash-space), " – " (space-endash-space), or " to " (case insensitive)
          // This avoids incorrectly splitting on dashes within dates like "01-01-2024"
          const periodParts = data.competitionPeriod.split(/\s+[-–]\s+|\s+to\s+/i);
          if (periodParts.length >= 2) {
            periodFrom = periodFrom || periodParts[0].trim();
            periodTo = periodTo || periodParts[1].trim();
          } else if (!periodFrom) {
            // If can't parse, use the whole thing for From
            periodFrom = data.competitionPeriod;
          }
          logger.info(`PDF Generation - Parsed from combined: From="${periodFrom}", To="${periodTo}"`);
        }

        // Line 8 - Period of Competition FROM (Y position 490)
        if (periodFrom) {
          doc.text(periodFrom, leftMargin, 490, { width: fieldWidth });
          logger.info(`PDF Generation - Rendered periodFrom at Y=490: "${periodFrom}"`);
        }

        // Line 9 - Period of Competition TO (Y position 513) - SEPARATE LINE
        if (periodTo) {
          doc.text(periodTo, leftMargin, 513, { width: fieldWidth });
          logger.info(`PDF Generation - Rendered periodTo at Y=513: "${periodTo}"`);
        }

        // Competition Held at - Line 10
        if (data.competitionHeldAt) {
          doc.text(data.competitionHeldAt, leftMargin, 536, { width: fieldWidth });
        }

        // Competition Level (State/National/International) - Line 11
        if (data.competitionLevel) {
          doc.text(data.competitionLevel, leftMargin, 559, { width: fieldWidth });
        }

        // Position Obtained - Line 12
        if (data.positionObtained) {
          doc.text(data.positionObtained, leftMargin, 582, { width: fieldWidth });
        }

        // Certificate No. - Line 13 (bottom field)
        // Use ONLY Excel certificate number from file (not the generated DSYS number)
        if (data.excelCertificateNo) {
          doc.text(data.excelCertificateNo, leftMargin, 605, { width: fieldWidth });
          logger.info(`PDF Generation - Bottom Certificate No. field: "${data.excelCertificateNo}"`);
        }

        // Valid for employment to Group - Line 14
        if (data.validForEmploymentGroup) {
          doc.text(data.validForEmploymentGroup, leftMargin, 628, { width: fieldWidth });
        }

        // Generate and add QR code for validation
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

            // Add QR code - positioned in the bottom area (moved up by 30px)
            doc.image(qrBuffer, 150, pageHeight - 160, { width: 75, height: 75 });
          } catch (error) {
            logger.error('QR code generation error:', error);
          }
        }

        // Digital signature indicator - moved right by 15px more
        if (data.digitalSignature) {
          doc.fontSize(6)
             .fillColor('#0066cc')
             .text(`Digital Signature: ${data.digitalSignature.algorithm}`, 440, 705, { width: 150 });

          doc.fontSize(6)
             .fillColor('#666666')
             .text(`Timestamp: ${new Date(data.digitalSignature.timestamp).toLocaleString('en-IN')}`, 440, 715, { width: 150 });
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