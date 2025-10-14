import XLSX from 'xlsx';
import { certificateService } from './certificateService';
import { pdfService } from './pdfService';
import { emailService } from './emailService';
import { logger } from '../utils/logger';
import path from 'path';
import fs from 'fs';

interface ExcelRow {
  'SR. NO'?: number;
  'Name'?: string;
  'Father Name'?: string;
  'DOB'?: string;
  'District'?: string;
  'Game Name'?: string;
  'Competition Period'?: string;
  'Competition Name'?: string;
  'Competition Held At'?: string;
  'Competition Level'?: string;
  'Certificate No'?: string;
  'Representing District'?: string;
  'Division/State/Country'?: string;
  'Position Obtained'?: string;
  'Valid For Employment Group'?: string;
  'Applicable Govt Resolutions'?: string;
  'Email'?: string;
  // Alternative column names
  'NAME'?: string;
  'FATHER NAME'?: string;
  'EMAIL'?: string;
  'DISTRICT'?: string;
  'GAME NAME'?: string;
  'COMPETITION PERIOD'?: string;
  'COMPETITION NAME'?: string;
  'COMPETITION HELD AT'?: string;
  'COMPETITION LEVEL'?: string;
  'CERTIFICATE NO'?: string;
  'REPRESENTING DISTRICT'?: string;
  'DIVISION/STATE/COUNTRY'?: string;
  'POSITION OBTAINED'?: string;
  'VALID FOR EMPLOYMENT GROUP'?: string;
  'APPLICABLE GOVT RESOLUTIONS'?: string;
  'Son/Wife/Daughter of'?: string;
  'Resident of District'?: string;
  'Name of the Game'?: string;
  'Period of the Competition'?: string;
  'Name of the Competition'?: string;
}

interface BulkUploadResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  emailsSent: number;
  emailsFailed: number;
  results: Array<{
    row: number;
    name: string;
    success: boolean;
    certificateHash?: string;
    error?: string;
    emailSent?: boolean;
  }>;
}

class BulkUploadService {
  private normalizeColumnName(name: string): string {
    return name.trim().toUpperCase().replace(/\s+/g, ' ');
  }

  private extractDataFromRow(row: ExcelRow): any {
    // Normalize and extract data with multiple possible column names
    return {
      name: row['Name'] || row['NAME'] || '',
      fatherName: row['Father Name'] || row['FATHER NAME'] || row['Son/Wife/Daughter of'] || '',
      dob: row['DOB'] || '',
      district: row['District'] || row['DISTRICT'] || row['Resident of District'] || '',
      gameName: row['Game Name'] || row['GAME NAME'] || row['Name of the Game'] || '',
      competitionPeriod: row['Competition Period'] || row['COMPETITION PERIOD'] || row['Period of the Competition'] || '',
      competitionName: row['Competition Name'] || row['COMPETITION NAME'] || row['Name of the Competition'] || '',
      competitionHeldAt: row['Competition Held At'] || row['COMPETITION HELD AT'] || '',
      competitionLevel: row['Competition Level'] || row['COMPETITION LEVEL'] || '',
      certificateNo: row['Certificate No'] || row['CERTIFICATE NO'] || '',
      representingDistrict: row['Representing District'] || row['REPRESENTING DISTRICT'] || '',
      divisionStateCountry: row['Division/State/Country'] || row['DIVISION/STATE/COUNTRY'] || '',
      positionObtained: row['Position Obtained'] || row['POSITION OBTAINED'] || '',
      validForEmploymentGroup: row['Valid For Employment Group'] || row['VALID FOR EMPLOYMENT GROUP'] || '',
      applicableGovtResolutions: row['Applicable Govt Resolutions'] || row['APPLICABLE GOVT RESOLUTIONS'] || '',
      email: row['Email'] || row['EMAIL'] || ''
    };
  }

  async processExcelFile(filePath: string, issuerData: {
    issuerDid: string;
    issuerName: string;
    certificateType: string;
    expiryDate?: Date;
  }): Promise<BulkUploadResult> {
    const results: BulkUploadResult['results'] = [];
    let successful = 0;
    let failed = 0;
    let emailsSent = 0;
    let emailsFailed = 0;

    try {
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
        defval: '',
        raw: false // Ensure dates are converted to strings
      });

      logger.info(`Processing ${data.length} rows from Excel file - storing in database only`);

      // Import query function
      const { query } = await import('../config/database-sqlite');
      const { v4: uuidv4 } = await import('uuid');

      // Process each row
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2; // Excel rows start at 1, plus header row

        try {
          const extractedData = this.extractDataFromRow(row);

          if (!extractedData.name) {
            results.push({
              row: rowNumber,
              name: 'Unknown',
              success: false,
              error: 'Name is required'
            });
            failed++;
            continue;
          }

          // Insert into athlete_competitions table (NOT generating certificate)
          const recordId = uuidv4();
          const certificateNo = extractedData.certificateNo || `CERT-${Date.now()}-${i}`;

          await query(`
            INSERT INTO athlete_competitions (
              id, unique_id, aadhar_number, full_name, father_name, dob, district,
              representing_district, division_state_country, game_name, competition_name,
              competition_type, competition_period, competition_held_at, competition_level,
              position_obtained, certificate_no, valid_for_employment_group,
              applicable_govt_resolutions, certificate_issued, certificate_requested
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            recordId,
            null, // unique_id will be filled when athlete registers
            null, // aadhar_number will be filled when athlete registers
            extractedData.name,
            extractedData.fatherName,
            extractedData.dob,
            extractedData.district,
            extractedData.representingDistrict,
            extractedData.divisionStateCountry,
            extractedData.gameName,
            extractedData.competitionName,
            issuerData.certificateType,
            extractedData.competitionPeriod,
            extractedData.competitionHeldAt,
            extractedData.competitionLevel,
            extractedData.positionObtained,
            certificateNo,
            extractedData.validForEmploymentGroup,
            extractedData.applicableGovtResolutions,
            0, // certificate_issued = false
            0  // certificate_requested = false
          ]);

          successful++;
          results.push({
            row: rowNumber,
            name: extractedData.name,
            success: true,
            certificateHash: undefined, // No certificate generated yet
            emailSent: false
          });

          logger.info(`Successfully stored data for ${extractedData.name} (Row ${rowNumber}) - Certificate will be generated on request`);
        } catch (error) {
          failed++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const extractedData = this.extractDataFromRow(row);
          results.push({
            row: rowNumber,
            name: extractedData.name || 'Unknown',
            success: false,
            error: errorMessage
          });

          logger.error(`Failed to process row ${rowNumber}:`, error);
        }

        // Add small delay to prevent overwhelming the system
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return {
        totalProcessed: data.length,
        successful,
        failed,
        emailsSent: 0, // No emails sent during bulk upload
        emailsFailed: 0,
        results
      };
    } catch (error) {
      logger.error('Bulk upload processing error:', error);
      throw new Error('Failed to process Excel file: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async validateExcelFile(filePath: string): Promise<{
    isValid: boolean;
    rowCount: number;
    columns: string[];
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, { defval: '' });

      if (data.length === 0) {
        errors.push('Excel file is empty');
        return {
          isValid: false,
          rowCount: 0,
          columns: [],
          errors,
          warnings
        };
      }

      // Get column names
      const columns = Object.keys(data[0]);

      // Check for required columns
      const requiredColumns = ['Name', 'NAME', 'name'];
      const hasNameColumn = columns.some(col => requiredColumns.includes(col));

      if (!hasNameColumn) {
        errors.push('Missing required column: Name');
      }

      // Check for email column (warning if missing)
      const emailColumns = ['Email', 'EMAIL', 'email'];
      const hasEmailColumn = columns.some(col => emailColumns.includes(col));

      if (!hasEmailColumn) {
        warnings.push('No email column found - certificates will not be sent via email');
      }

      // Validate each row
      let rowsWithoutName = 0;
      let rowsWithInvalidEmail = 0;

      data.forEach((row, index) => {
        const extractedData = this.extractDataFromRow(row);

        if (!extractedData.name) {
          rowsWithoutName++;
        }

        if (extractedData.email && !this.isValidEmail(extractedData.email)) {
          rowsWithInvalidEmail++;
        }
      });

      if (rowsWithoutName > 0) {
        warnings.push(`${rowsWithoutName} rows have missing names`);
      }

      if (rowsWithInvalidEmail > 0) {
        warnings.push(`${rowsWithInvalidEmail} rows have invalid email addresses`);
      }

      return {
        isValid: errors.length === 0,
        rowCount: data.length,
        columns,
        errors,
        warnings
      };
    } catch (error) {
      errors.push('Failed to read Excel file: ' + (error instanceof Error ? error.message : 'Unknown error'));
      return {
        isValid: false,
        rowCount: 0,
        columns: [],
        errors,
        warnings
      };
    }
  }
}

export const bulkUploadService = new BulkUploadService();