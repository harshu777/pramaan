import { query } from '../config/database-sqlite';
import { logger } from './logger';

/**
 * Generate a unique certificate number in the format: DSYS/SRVC/000001
 * where the number is a 6-digit sequential number across all certificates
 */
export async function generateCertificateNumber(): Promise<string> {
  try {
    // Get the total count of certificates issued
    const result = await query(
      `SELECT COUNT(*) as count FROM athlete_competitions WHERE certificate_no IS NOT NULL AND certificate_no != ''`
    );

    // Increment by 1 to get the next sequence number
    const sequenceNumber = (result.rows[0]?.count || 0) + 1;

    // Format as 6-digit number with leading zeros
    const sequenceStr = String(sequenceNumber).padStart(6, '0');

    // Generate certificate number
    const certificateNo = `DSYS/SRVC/${sequenceStr}`;

    logger.info(`Generated certificate number: ${certificateNo}`);

    return certificateNo;
  } catch (error) {
    logger.error('Error generating certificate number:', error);
    // Fallback to timestamp-based ID if database query fails
    const timestamp = Date.now();
    return `DSYS/SRVC/${String(timestamp).slice(-6)}`;
  }
}

/**
 * Validate certificate number format
 */
export function isValidCertificateNumber(certificateNo: string): boolean {
  // Format: DSYS/SRVC/XXXXXX (6 digits)
  const regex = /^DSYS\/SRVC\/\d{6}$/;
  return regex.test(certificateNo);
}

/**
 * Extract sequence number from certificate number
 */
export function extractSequenceFromCertificateNumber(certificateNo: string): number | null {
  try {
    const parts = certificateNo.split('/');
    if (parts.length !== 3 || parts[0] !== 'DSYS' || parts[1] !== 'SRVC') {
      return null;
    }

    const sequence = parseInt(parts[2]);
    return isNaN(sequence) ? null : sequence;
  } catch (error) {
    return null;
  }
}
