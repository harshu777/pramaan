import { query } from '../config/database-sqlite';
import { logger } from './logger';

/**
 * Generate a unique ticket ID in the format: TKT-YYYYMMDD-XXXX
 * where XXXX is a 4-digit sequential number for the day
 */
export async function generateTicketId(): Promise<string> {
  try {
    // Get current date in YYYYMMDD format
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${year}${month}${day}`;

    // Get the count of tickets created today
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const result = await query(
      `SELECT COUNT(*) as count FROM complaints
       WHERE created_at >= ? AND created_at < ?`,
      [startOfDay.toISOString(), endOfDay.toISOString()]
    );

    // Increment by 1 to get the next sequence number
    const sequenceNumber = (result.rows[0]?.count || 0) + 1;

    // Format as 4-digit number with leading zeros
    const sequenceStr = String(sequenceNumber).padStart(4, '0');

    // Generate ticket ID
    const ticketId = `TKT-${datePrefix}-${sequenceStr}`;

    logger.info(`Generated ticket ID: ${ticketId}`);

    return ticketId;
  } catch (error) {
    logger.error('Error generating ticket ID:', error);
    // Fallback to timestamp-based ID if database query fails
    const timestamp = Date.now();
    return `TKT-${timestamp}`;
  }
}

/**
 * Validate ticket ID format
 */
export function isValidTicketId(ticketId: string): boolean {
  // Format: TKT-YYYYMMDD-XXXX or TKT-{timestamp}
  const regex = /^TKT-(\d{8}-\d{4}|\d{13})$/;
  return regex.test(ticketId);
}

/**
 * Extract date from ticket ID
 */
export function extractDateFromTicketId(ticketId: string): Date | null {
  try {
    const parts = ticketId.split('-');
    if (parts.length !== 3 || parts[0] !== 'TKT') {
      return null;
    }

    const dateStr = parts[1];
    if (dateStr.length === 8) {
      // Format: YYYYMMDD
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(dateStr.substring(6, 8));
      return new Date(year, month, day);
    } else if (dateStr.length === 13) {
      // Timestamp fallback
      return new Date(parseInt(dateStr));
    }

    return null;
  } catch (error) {
    return null;
  }
}
