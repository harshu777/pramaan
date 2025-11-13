import { query } from '../config/database-sqlite';
import { logger } from './logger';

/**
 * Generate a unique ticket ID in the format: 2025DDMMYYYY-0001
 * where the number is a 4-digit sequential number that resets daily
 */
export async function generateTicketId(): Promise<string> {
  try {
    // Get current date components
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${year}${day}${month}${year}`;

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
    const ticketId = `${datePrefix}-${sequenceStr}`;

    logger.info(`Generated ticket ID: ${ticketId}`);

    return ticketId;
  } catch (error) {
    logger.error('Error generating ticket ID:', error);
    // Fallback to timestamp-based ID if database query fails
    const timestamp = Date.now();
    return `${timestamp}-0000`;
  }
}

/**
 * Validate ticket ID format
 */
export function isValidTicketId(ticketId: string): boolean {
  // Format: YYYYDDMMYYYY-XXXX (e.g., 2025131120225-0001)
  const regex = /^(\d{12}-\d{4}|\d{13}-\d{4})$/;
  return regex.test(ticketId);
}

/**
 * Extract date from ticket ID
 */
export function extractDateFromTicketId(ticketId: string): Date | null {
  try {
    const parts = ticketId.split('-');
    if (parts.length !== 2) {
      return null;
    }

    const dateStr = parts[0];
    if (dateStr.length === 12) {
      // Format: YYYYDDMMYYYY
      const year = parseInt(dateStr.substring(0, 4));
      const day = parseInt(dateStr.substring(4, 6));
      const month = parseInt(dateStr.substring(6, 8)) - 1; // Month is 0-indexed
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
