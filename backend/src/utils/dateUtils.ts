import { logger } from './logger';

/**
 * Normalize date to DD-MM-YYYY format
 * Handles various input formats:
 * - DD-MM-YYYY (e.g., 26-05-1989)
 * - DD/MM/YYYY (e.g., 26/05/1989)
 * - D/M/YY (e.g., 7/5/94 -> 07-05-1994)
 * - M/D/YY (ambiguous, treated as D/M/YY for Indian context)
 * - Excel serial numbers
 * - YYYY-MM-DD (ISO format)
 */
export function normalizeDateFormat(dateStr: string): string {
  if (!dateStr || dateStr.trim() === '') return '';

  const trimmed = dateStr.trim();

  // Check if it's an Excel serial number (numeric)
  if (/^\d+$/.test(trimmed) && parseInt(trimmed) > 1000) {
    // Excel serial number - convert to date
    const excelEpoch = new Date(1899, 11, 30); // Excel epoch
    const days = parseInt(trimmed);
    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  // Already in DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(trimmed)) {
    return trimmed;
  }

  // DD/MM/YYYY format - convert to DD-MM-YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    return trimmed.replace(/\//g, '-');
  }

  // YYYY-MM-DD (ISO format) - convert to DD-MM-YYYY
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  }

  // D/M/YY or DD/MM/YY format (short year)
  const shortYearMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (shortYearMatch) {
    let day = shortYearMatch[1];
    let month = shortYearMatch[2];
    let year = shortYearMatch[3];

    // Convert 2-digit year to 4-digit
    // Assume 00-30 is 2000s, 31-99 is 1900s
    const yearNum = parseInt(year);
    const fullYear = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;

    // Pad day and month
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');

    return `${day}-${month}-${fullYear}`;
  }

  // D/M/YYYY or DD/MM/YYYY format (full year, variable day/month)
  const fullYearMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fullYearMatch) {
    let day = fullYearMatch[1].padStart(2, '0');
    let month = fullYearMatch[2].padStart(2, '0');
    let year = fullYearMatch[3];
    return `${day}-${month}-${year}`;
  }

  // DD-MM-YY format (short year with dashes)
  const dashShortYearMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
  if (dashShortYearMatch) {
    let day = dashShortYearMatch[1].padStart(2, '0');
    let month = dashShortYearMatch[2].padStart(2, '0');
    let year = dashShortYearMatch[3];
    const yearNum = parseInt(year);
    const fullYear = yearNum <= 30 ? 2000 + yearNum : 1900 + yearNum;
    return `${day}-${month}-${fullYear}`;
  }

  // Return as-is if format not recognized
  logger.warn(`Unrecognized date format: ${trimmed}`);
  return trimmed;
}

/**
 * Compare two dates for equality, normalizing both to DD-MM-YYYY format first
 */
export function datesMatch(date1: string, date2: string): boolean {
  if (!date1 || !date2) return false;

  const normalized1 = normalizeDateFormat(date1);
  const normalized2 = normalizeDateFormat(date2);

  return normalized1 === normalized2;
}
