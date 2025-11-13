import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

class EmailService {
  private transporter!: nodemailer.Transporter;

  constructor() {
    // Configure email transporter based on environment
    if (process.env.EMAIL_SERVICE === 'gmail') {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD // Use app-specific password for Gmail
        }
      });
    } else if (process.env.EMAIL_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });
    } else {
      // Default to test account for development
      this.setupTestAccount();
    }
  }

  private async setupTestAccount() {
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      logger.info(`Test email account created: ${testAccount.user}`);
      logger.info(`View emails at: https://ethereal.email/messages`);
    } catch (error) {
      logger.error('Failed to create test email account:', error);
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"Krida e-Pramaan" <noreply@certmanagement.com>',
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments
      };

      const info = await this.transporter.sendMail(mailOptions);

      if (process.env.NODE_ENV === 'development') {
        logger.info(`Email sent: ${info.messageId}`);
        logger.info(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      } else {
        logger.info(`Email sent to ${options.to}: ${info.messageId}`);
      }

      return true;
    } catch (error) {
      logger.error('Email sending failed:', error);
      return false;
    }
  }

  async sendCertificateEmail(
    recipientEmail: string,
    recipientName: string,
    certificateHash: string,
    pdfBuffer: Buffer,
    certificateType: string
  ): Promise<boolean> {
    const validationUrl = `${process.env.QR_BASE_URL || 'http://localhost:3000'}/api/certificates/verify/${certificateHash}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 14px;
          }
          .certificate-info {
            background: white;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .info-row {
            padding: 10px 0;
            border-bottom: 1px solid #eee;
          }
          .info-row:last-child {
            border-bottom: none;
          }
          .label {
            font-weight: bold;
            color: #555;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Certificate Issued Successfully</h1>
        </div>
        <div class="content">
          <p>Dear ${recipientName},</p>

          <p>Congratulations! Your <strong>${certificateType}</strong> certificate has been successfully issued and is attached to this email.</p>

          <div class="certificate-info">
            <div class="info-row">
              <span class="label">Certificate Type:</span> ${certificateType}
            </div>
            <div class="info-row">
              <span class="label">Recipient:</span> ${recipientName}
            </div>
            <div class="info-row">
              <span class="label">Certificate Hash:</span> ${certificateHash.substring(0, 16)}...
            </div>
            <div class="info-row">
              <span class="label">Issue Date:</span> ${new Date().toLocaleDateString()}
            </div>
          </div>

          <p>You can verify your certificate at any time by:</p>
          <ul>
            <li>Scanning the QR code on your certificate</li>
            <li>Visiting the validation link below</li>
            <li>Using the certificate hash on our verification portal</li>
          </ul>

          <center>
            <a href="${validationUrl}" class="button">Verify Certificate</a>
          </center>

          <p><strong>Important:</strong> This certificate has been secured using blockchain technology and IPFS storage, ensuring its authenticity and immutability.</p>

          <div class="footer">
            <p>This is an automated email from Krida e-Pramaan.</p>
            <p>Please do not reply to this email. For support, contact your administrator.</p>
            <p>&copy; ${new Date().getFullYear()} Krida e-Pramaan. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: recipientEmail,
      subject: `Your ${certificateType} Certificate - Issued Successfully`,
      html: emailHtml,
      attachments: [
        {
          filename: `certificate_${recipientName.replace(/\s+/g, '_')}_${certificateHash.substring(0, 8)}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    });
  }

  async sendBulkCertificateEmails(
    certificates: Array<{
      email: string;
      name: string;
      certificateHash: string;
      pdfBuffer: Buffer;
      certificateType: string;
    }>
  ): Promise<{ success: number; failed: number; results: Array<{ email: string; success: boolean; error?: string }> }> {
    const results: Array<{ email: string; success: boolean; error?: string }> = [];
    let success = 0;
    let failed = 0;

    for (const cert of certificates) {
      try {
        const sent = await this.sendCertificateEmail(
          cert.email,
          cert.name,
          cert.certificateHash,
          cert.pdfBuffer,
          cert.certificateType
        );

        if (sent) {
          success++;
          results.push({ email: cert.email, success: true });
        } else {
          failed++;
          results.push({ email: cert.email, success: false, error: 'Failed to send email' });
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        failed++;
        results.push({
          email: cert.email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        logger.error(`Failed to send email to ${cert.email}:`, error);
      }
    }

    return { success, failed, results };
  }
}

export const emailService = new EmailService();