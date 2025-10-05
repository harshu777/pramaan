import crypto from 'crypto';
import QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database-sqlite';
import { ipfsService } from './ipfsService';
import { blockchainService } from './blockchainService';
import { digitalSignatureService } from './digitalSignatureService';
import { logger } from '../utils/logger';

interface CertificateData {
  issuerDid: string;
  issuerName: string;
  subjectDid?: string;
  subjectName: string;
  subjectEmail?: string;
  certificateType: string;
  expiryDate?: Date;
  metadata?: any;
  uploadedFilePath?: string;
}

interface Certificate {
  id: string;
  certHash: string;
  ipfsCid: string;
  qrCode: string;
  blockchainTxHash?: string;
}

class CertificateService {
  private async computeHash(data: any): Promise<string> {
    const sortedData = this.canonicalizeJSON(data);
    const jsonString = JSON.stringify(sortedData);
    const hash = crypto.createHash('sha256').update(jsonString).digest('hex');
    return hash;
  }

  private canonicalizeJSON(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.canonicalizeJSON(item));
    }

    const sortedKeys = Object.keys(obj).sort();
    const result: any = {};

    for (const key of sortedKeys) {
      result[key] = this.canonicalizeJSON(obj[key]);
    }

    return result;
  }

  async issueCertificate(data: CertificateData): Promise<Certificate> {
    try {
      const certificateId = uuidv4();
      const issuedDate = new Date();

      // Add uploaded file path to metadata if present
      const metadataWithFile = data.uploadedFilePath
        ? { ...data.metadata, uploadedFilePath: data.uploadedFilePath }
        : data.metadata;

      if (data.uploadedFilePath) {
        logger.info(`Certificate will include uploaded file: ${data.uploadedFilePath}`);
      }

      const certificateContent = {
        id: certificateId,
        issuerDid: data.issuerDid,
        issuerName: data.issuerName,
        subjectDid: data.subjectDid,
        subjectName: data.subjectName,
        subjectEmail: data.subjectEmail,
        certificateType: data.certificateType,
        issuedDate: issuedDate.toISOString(),
        expiryDate: data.expiryDate?.toISOString(),
        metadata: metadataWithFile,
      };

      const certHash = await this.computeHash(certificateContent);
      logger.info(`Generated certificate hash: ${certHash}`);

      // Generate digital signature
      let digitalSignature: any = null;
      try {
        await digitalSignatureService.initializeDefaultKeys();
        digitalSignature = await digitalSignatureService.signCertificate(certificateContent);
        logger.info('Digital signature generated for certificate');
      } catch (signError) {
        logger.error('Digital signature generation failed:', signError);
      }

      // Add signature to certificate content before uploading to IPFS
      const certificateWithSignature = {
        ...certificateContent,
        digitalSignature
      };

      const ipfsCid = await ipfsService.uploadJSON(certificateWithSignature);
      logger.info(`Certificate uploaded to IPFS: ${ipfsCid}`);

      let blockchainTxHash: string | undefined;
      let blockNumber: number | undefined;

      try {
        const expiryTimestamp = data.expiryDate ? Math.floor(data.expiryDate.getTime() / 1000) : 0;
        blockchainTxHash = await blockchainService.issueCertificate(certHash, ipfsCid, expiryTimestamp);

        const receipt = await blockchainService.getTransactionReceipt(blockchainTxHash);
        blockNumber = receipt?.blockNumber;

        logger.info(`Certificate anchored on blockchain: ${blockchainTxHash}`);
      } catch (blockchainError) {
        logger.error('Blockchain anchoring failed (continuing without it):', blockchainError);
      }

      const qrData = `${process.env.QR_BASE_URL || 'http://localhost:3000'}/static/validation.html?hash=${certHash}`;
      const qrCode = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        width: 300,
        margin: 2,
      });

      const insertQuery = `
        INSERT INTO certificates (
          id, cert_hash, ipfs_cid, issuer_did, issuer_name,
          subject_did, subject_name, subject_email, certificate_type,
          issued_date, expiry_date, blockchain_tx_hash, blockchain_block_number,
          metadata, status, digital_signature
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const values = [
        certificateId,
        certHash,
        ipfsCid,
        data.issuerDid,
        data.issuerName,
        data.subjectDid,
        data.subjectName,
        data.subjectEmail,
        data.certificateType,
        issuedDate.toISOString(),
        data.expiryDate?.toISOString(),
        blockchainTxHash,
        blockNumber,
        JSON.stringify(metadataWithFile), // Use metadataWithFile instead of data.metadata
        'active',
        digitalSignature ? JSON.stringify(digitalSignature) : null
      ];

      const result = await query(insertQuery, values);
      logger.info(`Certificate stored in database: ${certificateId}`);

      return {
        id: certificateId,
        certHash,
        ipfsCid,
        qrCode,
        blockchainTxHash,
      };
    } catch (error) {
      logger.error('Certificate issuance failed:', error);
      throw new Error('Failed to issue certificate');
    }
  }

  async searchCertificates(searchQuery: string): Promise<any[]> {
    try {
      const searchQueryText = `
        SELECT
          id, cert_hash, ipfs_cid, issuer_name, subject_name,
          subject_email, certificate_type, issued_date, expiry_date,
          status, blockchain_tx_hash
        FROM certificates
        WHERE subject_name LIKE ? OR issuer_name LIKE ? OR certificate_type LIKE ?
        ORDER BY issued_date DESC
        LIMIT 50
      `;

      const searchPattern = `%${searchQuery}%`;
      const result = await query(searchQueryText, [searchPattern, searchPattern, searchPattern]);
      return result.rows;
    } catch (error) {
      logger.error('Certificate search failed:', error);
      throw new Error('Failed to search certificates');
    }
  }

  async validateCertificate(certHash: string): Promise<{
    isValid: boolean;
    certificate: any;
    blockchainData?: any;
    ipfsData?: any;
  }> {
    try {
      const dbQuery = `
        SELECT * FROM certificates
        WHERE cert_hash = ?
      `;

      const dbResult = await query(dbQuery, [certHash]);

      if (dbResult.rows.length === 0) {
        return {
          isValid: false,
          certificate: null,
        };
      }

      const certificate = dbResult.rows[0];

      await query(
        'INSERT INTO verification_logs (id, certificate_id, verification_result) VALUES (?, ?, ?)',
        [uuidv4(), certificate.id, true]
      );

      let blockchainData;
      try {
        blockchainData = await blockchainService.verifyCertificate(certHash);
      } catch (error) {
        logger.error('Blockchain verification failed:', error);
      }

      let ipfsData;
      try {
        ipfsData = await ipfsService.getJSON(certificate.ipfs_cid);
      } catch (error) {
        logger.error('IPFS retrieval failed:', error);
      }

      // Verify digital signature if present
      let signatureVerified = false;
      if (certificate.digital_signature) {
        try {
          const signature = JSON.parse(certificate.digital_signature);
          const certificateData = ipfsData ? { ...ipfsData } : null;
          if (certificateData && certificateData.digitalSignature) {
            delete certificateData.digitalSignature;
            signatureVerified = await digitalSignatureService.verifyCertificateSignature(
              certificateData,
              signature.signature
            );
          }
        } catch (error) {
          logger.error('Signature verification failed:', error);
        }
      }

      const isExpired = certificate.expiry_date && new Date(certificate.expiry_date) < new Date();
      const isRevoked = certificate.status === 'revoked';
      const isValid = !isExpired && !isRevoked && certificate.status === 'active';

      // Parse metadata if it's a JSON string
      let parsedMetadata = certificate.metadata;
      if (typeof certificate.metadata === 'string') {
        try {
          parsedMetadata = JSON.parse(certificate.metadata);
        } catch (e) {
          // Keep as string if parsing fails
        }
      }

      const validationInfo = {
        certificateHash: certHash,
        issuerName: certificate.issuer_name,
        issuerDid: certificate.issuer_did,
        subjectName: certificate.subject_name,
        subjectEmail: certificate.subject_email,
        subjectDid: certificate.subject_did,
        certificateType: certificate.certificate_type,
        issuedDate: certificate.issued_date,
        expiryDate: certificate.expiry_date,
        status: certificate.status,
        metadata: parsedMetadata,
        ipfsCid: certificate.ipfs_cid,
        blockchainTxHash: certificate.blockchain_tx_hash,
        isExpired,
        isRevoked,
        blockchainVerified: !!blockchainData?.isValid,
        ipfsVerified: !!ipfsData,
        digitalSignatureVerified: signatureVerified,
        digitalSignature: certificate.digital_signature ? JSON.parse(certificate.digital_signature) : null
      };

      return {
        isValid,
        certificate: validationInfo,
        blockchainData,
        ipfsData,
      };
    } catch (error) {
      logger.error('Certificate validation failed:', error);
      throw new Error('Failed to validate certificate');
    }
  }

  async revokeCertificate(certHash: string, reason: string, revokedBy: string): Promise<void> {
    try {
      const updateQuery = `
        UPDATE certificates
        SET status = 'revoked', updated_at = datetime('now')
        WHERE cert_hash = ?
      `;

      // First get the certificate ID
      const selectResult = await query('SELECT id FROM certificates WHERE cert_hash = ?', [certHash]);

      if (selectResult.rows.length === 0) {
        throw new Error('Certificate not found');
      }

      const certificateId = selectResult.rows[0].id;

      // Then update it
      await query(updateQuery, [certHash]);

      await query(
        'INSERT INTO revocation_logs (id, certificate_id, revoked_by, revocation_reason) VALUES (?, ?, ?, ?)',
        [uuidv4(), certificateId, revokedBy, reason]
      );

      try {
        const txHash = await blockchainService.revokeCertificate(certHash, reason);
        await query(
          'UPDATE revocation_logs SET blockchain_tx_hash = ? WHERE certificate_id = ?',
          [txHash, certificateId]
        );
      } catch (blockchainError) {
        logger.error('Blockchain revocation failed:', blockchainError);
      }

      logger.info(`Certificate revoked: ${certHash}`);
    } catch (error) {
      logger.error('Certificate revocation failed:', error);
      throw new Error('Failed to revoke certificate');
    }
  }

  async generateQRCode(certHash: string): Promise<string> {
    const qrData = `${process.env.QR_BASE_URL || 'http://localhost:3000'}/static/validation.html?hash=${certHash}`;
    const qrCode = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
    });
    return qrCode;
  }
}

export const certificateService = new CertificateService();