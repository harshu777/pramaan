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
          margin: 30
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        const centerX = pageWidth / 2;

        // Decorative golden border with corner ornaments
        // Outer border
        doc.rect(20, 20, pageWidth - 40, pageHeight - 40)
           .strokeColor('#D4AF37')
           .lineWidth(3)
           .stroke();

        // Inner border
        doc.rect(30, 30, pageWidth - 60, pageHeight - 60)
           .strokeColor('#B8860B')
           .lineWidth(1)
           .stroke();

        // Three logos at the top
        const imagesPath = path.join(__dirname, '../../public/images');

        // Government Emblem (center) - PNG works
        try {
          const emblemPath = path.join(imagesPath, 'NE_Preview1.png');
          if (fs.existsSync(emblemPath)) {
            doc.image(emblemPath, centerX - 30, 45, { width: 60, height: 60 });
          }
        } catch (e) {
          // Skip if image fails
        }

        // Sports Logo (right) - JPEG works
        try {
          const sportsLogoPath = path.join(imagesPath, 'images.jpeg');
          if (fs.existsSync(sportsLogoPath)) {
            doc.image(sportsLogoPath, pageWidth - 120, 45, { width: 60, height: 60 });
          }
        } catch (e) {
          // Skip if image fails
        }

        // Text placeholder for Maharashtra Seal (left) since SVG doesn't work with PDFKit
        doc.fontSize(10)
           .fillColor('#000000')
           .font('Helvetica-Bold')
           .text('Maharashtra', 60, 60, { width: 60, align: 'center' })
           .text('State', 60, 75, { width: 60, align: 'center' });

        // Organization Header
        doc.fontSize(14)
           .fillColor('#8B0000')
           .font('Helvetica-Bold')
           .text('Directorate of Sports and Youth Services,', 50, 115, {
             align: 'center',
             width: pageWidth - 100
           });

        doc.fontSize(13)
           .text('Maharashtra State', 50, 135, {
             align: 'center',
             width: pageWidth - 100
           });

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#000000')
           .text('Shivchhatrapati Sports Complex,Mahalunge-Balewadi,Pune-411045', 50, 155, {
             align: 'center',
             width: pageWidth - 100
           });

        // Contact info
        doc.fontSize(9)
           .text('Website: sports.maharashtra.gov.in', 100, 175);

        doc.text('Email: desk15.dsys-mh@gov.in', pageWidth - 200, 175);

        // Certificate Title
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Certificate to a Meritorious Sports Person for', 50, 200, {
             align: 'center',
             width: pageWidth - 100
           });

        doc.text('Employment to Group A/B/C/D Service under the', 50, 220, {
             align: 'center',
             width: pageWidth - 100
           });

        doc.text('State Government', 50, 240, {
             align: 'center',
             width: pageWidth - 100
           });

        // Certificate Number and Date
        const leftMargin = 60;
        const rightMargin = pageWidth - 60;
        const fieldWidth = rightMargin - leftMargin;

        doc.fontSize(11)
           .font('Helvetica')
           .text('No.', leftMargin, 270);

        // Draw underline for certificate number
        doc.moveTo(leftMargin + 25, 280)
           .lineTo(centerX - 50, 280)
           .strokeColor('#000000')
           .lineWidth(0.5)
           .stroke();

        if (data.certificateNo) {
          doc.text(data.certificateNo, leftMargin + 30, 268);
        }

        doc.text('Date', centerX + 50, 270);

        // Draw underline for date
        doc.moveTo(centerX + 80, 280)
           .lineTo(rightMargin, 280)
           .stroke();

        if (data.issueDate) {
          doc.text(data.issueDate, centerX + 85, 268);
        }

        // Form fields
        let yPos = 300;
        const lineHeight = 25;

        // Helper function to add field with underline
        const addField = (label: string, value: string | undefined, y: number): number => {
          doc.fontSize(11)
             .font('Helvetica')
             .text(label, leftMargin, y);

          const labelWidth = doc.widthOfString(label);

          // Draw underline
          doc.moveTo(leftMargin + labelWidth + 5, y + 10)
             .lineTo(rightMargin, y + 10)
             .strokeColor('#000000')
             .lineWidth(0.5)
             .stroke();

          if (value) {
            doc.fontSize(10)
               .text(value, leftMargin + labelWidth + 10, y);
          }

          return y + lineHeight;
        };

        yPos = addField('Name of the Sports Person', data.name, yPos);
        yPos = addField('Son/Wife/Daughter of', data.fatherName, yPos);
        yPos = addField('Date of Birth', data.dob, yPos);
        yPos = addField('Resident of District', data.district, yPos);

        // Representing field (aligned properly)
        doc.fontSize(11)
           .font('Helvetica')
           .text('Representing', leftMargin, yPos);

        const representingLabelWidth = doc.widthOfString('Representing');
        doc.moveTo(leftMargin + representingLabelWidth + 5, yPos + 10)
           .lineTo(rightMargin, yPos + 10)
           .stroke();

        if (data.representingDistrict) {
          doc.fontSize(10).text(data.representingDistrict, leftMargin + representingLabelWidth + 10, yPos);
        }

        yPos += lineHeight;

        doc.fontSize(10)
           .text('District/Division/State/Country', leftMargin, yPos);

        if (data.divisionStateCountry) {
          doc.text(data.divisionStateCountry, leftMargin + 160, yPos - 2);
        }

        yPos += lineHeight;

        yPos = addField('Name of the Game', data.gameName, yPos);
        yPos = addField('Name of the Competition', data.competitionName, yPos);
        yPos = addField('Period of the Competition', data.competitionPeriod, yPos);
        yPos = addField('Competition Held at', data.competitionHeldAt, yPos);

        // Competition Level (aligned properly)
        doc.fontSize(11)
           .font('Helvetica')
           .text('Competition Level', leftMargin, yPos);

        const competitionLevelWidth = doc.widthOfString('Competition Level');
        doc.moveTo(leftMargin + competitionLevelWidth + 5, yPos + 10)
           .lineTo(rightMargin, yPos + 10)
           .stroke();

        if (data.competitionLevel) {
          doc.fontSize(10).text(data.competitionLevel, leftMargin + competitionLevelWidth + 10, yPos);
        }

        yPos += lineHeight;

        doc.fontSize(9)
           .text('(State/National/International)', leftMargin, yPos);

        yPos += lineHeight;

        yPos = addField('Position Obtained', data.positionObtained, yPos);

        // Remove duplicate Certificate No. field as it's already added above

        yPos = addField('Valid for employment to Group', data.validForEmploymentGroup, yPos);

        // Applicable Government Resolutions - combine into single field
        yPos = addField('Applicable Government Resolutions', data.applicableGovtResolutions, yPos);

        // Add some space before footer
        yPos += lineHeight * 2;

        // Footer text - position dynamically based on content
        const footerY = Math.min(yPos + 20, pageHeight - 200);
        doc.fontSize(9)
           .font('Helvetica')
           .fillColor('#000000')
           .text('This Certificate is being issued based on records available in this office.',
                 leftMargin, footerY, {
                   align: 'center',
                   width: fieldWidth
                 });

        // QR Code - position relative to footer
        if (data.certHash) {
          const qrData = `${process.env.QR_BASE_URL || 'http://localhost:3000'}/static/validation.html?hash=${data.certHash}`;
          const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            width: 100,
            margin: 1,
          });

          const qrCodeBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
          const qrY = Math.min(footerY + 20, pageHeight - 180);
          doc.image(qrCodeBuffer, leftMargin, qrY, { width: 80, height: 80 });

          doc.fontSize(8)
             .fillColor('#000000')
             .text('SCAN ME', leftMargin + 15, qrY + 85);
        }

        // Signature section
        doc.fontSize(11)
           .font('Helvetica')
           .fillColor('#000000')
           .text('Deputy Director,', pageWidth - 180, pageHeight - 160);

        doc.text('Sports and Youth Services,', pageWidth - 180, pageHeight - 145);
        doc.text('Maharashtra', pageWidth - 180, pageHeight - 130);

        // Digital signature indicator if present
        if (data.digitalSignature) {
          doc.fontSize(7)
             .fillColor('#0066cc')
             .text('Digitally Signed', pageWidth - 180, pageHeight - 115);

          doc.fontSize(6)
             .fillColor('#666666')
             .text(`Algorithm: ${data.digitalSignature.algorithm}`, pageWidth - 180, pageHeight - 105);

          doc.text(`Timestamp: ${new Date(data.digitalSignature.timestamp).toLocaleString('en-IN')}`, pageWidth - 180, pageHeight - 95);
        }

        // Disclaimer
        doc.fontSize(7)
           .font('Helvetica')
           .fillColor('#333333')
           .text('Disclaimer : This certificate is granted based on records submitted by the relevant State Sports Association or event organizer. The Directorate of Sports and Youth Services (DSYS) reserves the right to revoke this certificate if any objections arise. The issuing sports association is solely responsible for the authenticity of the provided documentation. The certificate\'s validity for sports reservation purposes is subject to the rules and policies in effect at the time of recruitment.',
                 leftMargin, pageHeight - 80, {
                   align: 'justify',
                   width: fieldWidth
                 });

        // Software watermark
        doc.fontSize(7)
           .fillColor('#666666')
           .text('This is software generated verification certificate and need not to be verified again.',
                 leftMargin, pageHeight - 40, {
                   align: 'center',
                   width: fieldWidth
                 });

        doc.text('You can verify through QR code.',
                 leftMargin, pageHeight - 30, {
                   align: 'center',
                   width: fieldWidth
                 });

        // Add corner decorations (optional ornamental elements)
        // Top-left corner
        doc.circle(35, 35, 3).fillColor('#D4AF37').fill();
        // Top-right corner
        doc.circle(pageWidth - 35, 35, 3).fillColor('#D4AF37').fill();
        // Bottom-left corner
        doc.circle(35, pageHeight - 35, 3).fillColor('#D4AF37').fill();
        // Bottom-right corner
        doc.circle(pageWidth - 35, pageHeight - 35, 3).fillColor('#D4AF37').fill();

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