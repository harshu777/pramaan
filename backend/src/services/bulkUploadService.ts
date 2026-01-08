import XLSX from 'xlsx';
import { certificateService } from './certificateService';
import { pdfService } from './pdfService';
import { emailService } from './emailService';
import { logger } from '../utils/logger';
import { generateCertificateNumber } from '../utils/certificateNumberGenerator';
import { normalizeDateFormat } from '../utils/dateUtils';
import path from 'path';
import fs from 'fs';

interface ExcelRow {
  // Primary column names (as per template)
  'Name of the Sports Person'?: string;
  "Father's Name / Spouse's Name"?: string;
  'Date of Birth'?: string;
  'Resident of District'?: string;
  'Representing (District/Division/State/Country)'?: string;
  'Name of the Game'?: string;
  'Game Code'?: string;
  'Age Group Code'?: string;
  'Gender Code'?: string;
  'Name of the Competition'?: string;
  'Period of Competition FROM'?: string;
  'Period of Competition TO'?: string;
  'Competition Held at'?: string;
  'Competition Level (State/National/International)'?: string;
  'Position Obtained'?: string;
  'Certificate No.'?: string;
  'Valid for Employment Group'?: string;
  // Alternative/legacy column names for backward compatibility
  'Name'?: string;
  'NAME'?: string;
  'Father Name'?: string;
  'FATHER NAME'?: string;
  'Son/Daughter/Wife of'?: string;
  'Son/Wife/Daughter of'?: string;
  'DOB'?: string;
  'District'?: string;
  'DISTRICT'?: string;
  'Game Name'?: string;
  'GAME NAME'?: string;
  'GAME CODE'?: string;
  'AGE GROUP CODE'?: string;
  'GENDER CODE'?: string;
  'Competition Name'?: string;
  'COMPETITION NAME'?: string;
  'Period of the Competition'?: string;
  'Competition Period'?: string;
  'COMPETITION PERIOD'?: string;
  'PERIOD OF COMPLETION FROM'?: string;
  'PERIOD OF COMPLETION TO'?: string;
  'Period of Completion FROM'?: string;
  'Period of Completion TO'?: string;
  'PERIOD OF COMPETITION FROM'?: string;
  'PERIOD OF COMPETITION TO'?: string;
  'Competition Held At'?: string;
  'COMPETITION HELD AT'?: string;
  'Competition Level'?: string;
  'COMPETITION LEVEL'?: string;
  'Certificate No'?: string;
  'CERTIFICATE NO'?: string;
  'Representing District'?: string;
  'Division/State/Country'?: string;
  'POSITION OBTAINED'?: string;
  'VALID FOR EMPLOYMENT GROUP'?: string;
  'Valid For Employment Group'?: string;
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
    // Primary fields use new template names, with fallback to legacy names
    const representing = row['Representing (District/Division/State/Country)'] || '';

    // Handle Period of Competition - new format uses FROM/TO, legacy uses single period field
    const periodFrom = row['Period of Competition FROM'] || row['PERIOD OF COMPETITION FROM'] || row['Period of Completion FROM'] || row['PERIOD OF COMPLETION FROM'] || '';
    const periodTo = row['Period of Competition TO'] || row['PERIOD OF COMPETITION TO'] || row['Period of Completion TO'] || row['PERIOD OF COMPLETION TO'] || '';
    const legacyPeriod = row['Period of the Competition'] || row['Competition Period'] || row['COMPETITION PERIOD'] || '';

    // Normalize DOB to DD-MM-YYYY format using shared utility
    const rawDob = row['Date of Birth'] || row['DOB'] || '';
    const normalizedDob = normalizeDateFormat(rawDob);

    return {
      name: row['Name of the Sports Person'] || row['Name'] || row['NAME'] || '',
      fatherName: row["Father's Name / Spouse's Name"] || row['Son/Daughter/Wife of'] || row['Son/Wife/Daughter of'] || row['Father Name'] || row['FATHER NAME'] || '',
      dob: normalizedDob,
      district: row['Resident of District'] || row['District'] || row['DISTRICT'] || '',
      gameName: row['Name of the Game'] || row['Game Name'] || row['GAME NAME'] || '',
      gameCode: row['Game Code'] || row['GAME CODE'] || '',
      ageGroupCode: row['Age Group Code'] || row['AGE GROUP CODE'] || '',
      genderCode: row['Gender Code'] || row['GENDER CODE'] || '',
      periodOfCompletionFrom: periodFrom,
      periodOfCompletionTo: periodTo,
      competitionPeriod: legacyPeriod || (periodFrom && periodTo ? `${periodFrom} - ${periodTo}` : ''),
      competitionName: row['Name of the Competition'] || row['Competition Name'] || row['COMPETITION NAME'] || '',
      competitionHeldAt: row['Competition Held at'] || row['Competition Held At'] || row['COMPETITION HELD AT'] || '',
      competitionLevel: row['Competition Level (State/National/International)'] || row['Competition Level'] || row['COMPETITION LEVEL'] || '',
      certificateNo: row['Certificate No.'] || row['Certificate No'] || row['CERTIFICATE NO'] || '',
      representing: representing,
      representingDistrict: row['Representing District'] || '',
      divisionStateCountry: row['Division/State/Country'] || '',
      positionObtained: row['Position Obtained'] || row['POSITION OBTAINED'] || '',
      validForEmploymentGroup: row['Valid for Employment Group'] || row['Valid For Employment Group'] || row['VALID FOR EMPLOYMENT GROUP'] || ''
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
          const certificateNo = extractedData.certificateNo || await generateCertificateNumber(extractedData.gameCode, extractedData.ageGroupCode);

          // Handle representing field - use combined field or fall back to legacy separate fields
          const representingValue = extractedData.representing || extractedData.representingDistrict || '';
          const divisionStateCountryValue = extractedData.representing ? '' : (extractedData.divisionStateCountry || '');

          await query(`
            INSERT INTO athlete_competitions (
              id, unique_id, aadhar_number, full_name, father_name, dob, district,
              representing_district, division_state_country, game_name, game_code,
              age_group_code, gender_code, competition_name, competition_type,
              competition_period, period_of_completion_from, period_of_completion_to,
              competition_held_at, competition_level, position_obtained, certificate_no,
              valid_for_employment_group, certificate_issued, certificate_requested
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            recordId,
            null, // unique_id will be filled when athlete registers
            null, // aadhar_number will be filled when athlete registers
            extractedData.name,
            extractedData.fatherName,
            extractedData.dob,
            extractedData.district,
            representingValue,
            divisionStateCountryValue,
            extractedData.gameName,
            extractedData.gameCode,
            extractedData.ageGroupCode,
            extractedData.genderCode,
            extractedData.competitionName,
            issuerData.certificateType,
            extractedData.competitionPeriod,
            extractedData.periodOfCompletionFrom,
            extractedData.periodOfCompletionTo,
            extractedData.competitionHeldAt,
            extractedData.competitionLevel,
            extractedData.positionObtained,
            certificateNo,
            extractedData.validForEmploymentGroup,
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

      // Check for required columns - support both new and legacy column names
      const requiredColumns = ['Name of the Sports Person', 'Name', 'NAME', 'name'];
      const hasNameColumn = columns.some(col => requiredColumns.includes(col));

      if (!hasNameColumn) {
        errors.push('Missing required column: Name of the Sports Person');
      }

      // Validate each row
      let rowsWithoutName = 0;

      data.forEach((row, index) => {
        const extractedData = this.extractDataFromRow(row);

        if (!extractedData.name) {
          rowsWithoutName++;
        }
      });

      if (rowsWithoutName > 0) {
        warnings.push(`${rowsWithoutName} rows have missing names`);
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