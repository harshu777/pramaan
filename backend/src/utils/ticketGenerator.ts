import { query } from '../config/database-sqlite';
import { logger } from './logger';

/**
 * Generate a unique complaint ID in the format: DDMMYYYY-001
 * where the number is a 3-digit sequential number that resets daily
 */
export async function generateTicketId(): Promise<string> {
  try {
    // Get current date components
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${day}${month}${year}`;

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

    // Format as 3-digit number with leading zeros
    const sequenceStr = String(sequenceNumber).padStart(3, '0');

    // Generate complaint ID
    const ticketId = `${datePrefix}-${sequenceStr}`;

    logger.info(`Generated complaint ID: ${ticketId}`);

    return ticketId;
  } catch (error) {
    logger.error('Error generating complaint ID:', error);
    // Fallback to timestamp-based ID if database query fails
    const timestamp = Date.now();
    return `${timestamp}-000`;
  }
}

/**
 * Validate complaint ID format
 */
export function isValidTicketId(ticketId: string): boolean {
  // Format: DDMMYYYY-XXX (e.g., 04012025-001)
  const regex = /^(\d{8}-\d{3}|\d{13}-\d{3})$/;
  return regex.test(ticketId);
}

/**
 * Extract date from complaint ID
 */
export function extractDateFromTicketId(ticketId: string): Date | null {
  try {
    const parts = ticketId.split('-');
    if (parts.length !== 2) {
      return null;
    }

    const dateStr = parts[0];
    if (dateStr.length === 8) {
      // Format: DDMMYYYY
      const day = parseInt(dateStr.substring(0, 2));
      const month = parseInt(dateStr.substring(2, 4)) - 1; // Month is 0-indexed
      const year = parseInt(dateStr.substring(4, 8));
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
