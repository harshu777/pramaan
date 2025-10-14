import { query } from '../config/database-sqlite';
import { logger } from './logger';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

export async function seedTestData() {
  try {
    logger.info('Seeding test data for ninad@hostingduty.com');

    // Check if athlete exists
    const existingAthlete = await query(
      'SELECT * FROM athletes WHERE email = ?',
      ['ninad@hostingduty.com']
    );

    let athleteId: string;

    if (existingAthlete.rows.length === 0) {
      // Create athlete
      athleteId = uuidv4();
      const passwordHash = await bcrypt.hash('password123', 10);

      await query(`
        INSERT INTO athletes (
          id, full_name, email, phone_number, dob,
          password_hash, district, state, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        athleteId,
        'Ninad Kulkarni',
        'ninad@hostingduty.com',
        '9876543210',
        '1995-05-15',
        passwordHash,
        'Pune',
        'Maharashtra',
        1
      ]);

      logger.info(`Created athlete: ${athleteId}`);
    } else {
      athleteId = existingAthlete.rows[0].id;
      logger.info(`Athlete already exists: ${athleteId}`);
    }

    // Add competition records
    const competitions = [
      {
        fullName: 'Ninad Kulkarni',
        fatherName: 'Rajesh Kulkarni',
        dob: '1995-05-15',
        district: 'Pune',
        representingDistrict: 'Pune',
        divisionStateCountry: 'Maharashtra',
        gameName: 'Cricket',
        competitionName: 'State Level Cricket Championship',
        competitionPeriod: '01/01/2024 - 05/01/2024',
        competitionHeldAt: 'Pune Cricket Stadium',
        competitionLevel: 'State',
        positionObtained: '1st Position',
        certificateNo: 'CERT-MH-2024-001',
        validForEmploymentGroup: 'Group A',
        applicableGovtResolutions: 'GR-SPT-2024/CR.123/2024'
      },
      {
        fullName: 'Ninad Kulkarni',
        fatherName: 'Rajesh Kulkarni',
        dob: '1995-05-15',
        district: 'Pune',
        representingDistrict: 'Pune',
        divisionStateCountry: 'Maharashtra',
        gameName: 'Football',
        competitionName: 'Inter-District Football Tournament',
        competitionPeriod: '10/02/2024 - 15/02/2024',
        competitionHeldAt: 'Balewadi Sports Complex',
        competitionLevel: 'District',
        positionObtained: '2nd Position',
        certificateNo: 'CERT-MH-2024-045',
        validForEmploymentGroup: 'Group B',
        applicableGovtResolutions: 'GR-SPT-2024/CR.456/2024'
      },
      {
        fullName: 'Ninad Kulkarni',
        fatherName: 'Rajesh Kulkarni',
        dob: '1995-05-15',
        district: 'Pune',
        representingDistrict: 'Maharashtra',
        divisionStateCountry: 'India',
        gameName: 'Kabaddi',
        competitionName: 'National Kabaddi Championship',
        competitionPeriod: '15/03/2024 - 25/03/2024',
        competitionHeldAt: 'Shiv Chhatrapati Sports Complex, Pune',
        competitionLevel: 'National',
        positionObtained: '3rd Position',
        certificateNo: 'CERT-IN-2024-789',
        validForEmploymentGroup: 'Group A',
        applicableGovtResolutions: 'GR-SPT-2024/CR.789/2024'
      }
    ];

    const competitionIds: string[] = [];

    for (const comp of competitions) {
      const competitionId = uuidv4();
      competitionIds.push(competitionId);

      await query(`
        INSERT INTO athlete_competitions (
          id, athlete_id, full_name, father_name, dob, district,
          representing_district, division_state_country, game_name,
          competition_name, competition_type, competition_period,
          competition_held_at, competition_level, position_obtained,
          certificate_no, valid_for_employment_group,
          applicable_govt_resolutions, certificate_issued, certificate_requested
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        competitionId,
        athleteId,
        comp.fullName,
        comp.fatherName,
        comp.dob,
        comp.district,
        comp.representingDistrict,
        comp.divisionStateCountry,
        comp.gameName,
        comp.competitionName,
        'Sports Achievement',
        comp.competitionPeriod,
        comp.competitionHeldAt,
        comp.competitionLevel,
        comp.positionObtained,
        comp.certificateNo,
        comp.validForEmploymentGroup,
        comp.applicableGovtResolutions,
        0, // Not yet issued
        0  // Not yet requested
      ]);

      logger.info(`Created competition record: ${competitionId} - ${comp.gameName}`);
    }

    // Create certificate requests for the first two competitions (one pending, one approved)
    const requestId1 = uuidv4();
    await query(`
      INSERT INTO quota_certificate_requests (
        id, athlete_id, competition_record_id, status, requested_at
      ) VALUES (?, ?, ?, ?, datetime('now', '-20 days'))
    `, [requestId1, athleteId, competitionIds[0], 'pending']);

    logger.info(`Created pending certificate request: ${requestId1}`);

    // Create an approved request with actual certificate
    const requestId2 = uuidv4();
    await query(`
      INSERT INTO quota_certificate_requests (
        id, athlete_id, competition_record_id, status, requested_at
      ) VALUES (?, ?, ?, ?, datetime('now', '-10 days'))
    `, [requestId2, athleteId, competitionIds[1], 'approved']);

    // Generate certificate for the approved request
    const { certificateService } = await import('../services/certificateService');

    const comp2 = competitions[1];
    const certificateData = {
      issuerDid: 'admin',
      issuerName: 'Directorate of Sports and Youth Services, Maharashtra',
      subjectName: comp2.fullName,
      subjectEmail: 'ninad@hostingduty.com',
      certificateType: 'Sports Achievement Certificate',
      metadata: {
        fatherName: comp2.fatherName,
        dob: comp2.dob,
        district: comp2.district,
        representingDistrict: comp2.representingDistrict,
        divisionStateCountry: comp2.divisionStateCountry,
        gameName: comp2.gameName,
        competitionName: comp2.competitionName,
        competitionPeriod: comp2.competitionPeriod,
        competitionHeldAt: comp2.competitionHeldAt,
        competitionLevel: comp2.competitionLevel,
        positionObtained: comp2.positionObtained,
        certificateNo: comp2.certificateNo,
        validForEmploymentGroup: comp2.validForEmploymentGroup,
        applicableGovtResolutions: comp2.applicableGovtResolutions
      }
    };

    const certificate = await certificateService.issueCertificate(certificateData);

    // Update the request with certificate info
    await query(`
      UPDATE quota_certificate_requests
      SET certificate_id = ?, certificate_hash = ?, processed_at = datetime('now', '-8 days'), processed_by = 'admin'
      WHERE id = ?
    `, [certificate.id, certificate.certHash, requestId2]);

    // Mark competition as certificate issued
    await query(
      'UPDATE athlete_competitions SET certificate_issued = 1, certificate_requested = 1 WHERE id = ?',
      [competitionIds[1]]
    );

    // Assign certificate to athlete
    const assignmentId = uuidv4();
    await query(`
      INSERT INTO certificate_assignments (
        id, certificate_id, athlete_id, assigned_at, assigned_by
      ) VALUES (?, ?, ?, datetime('now', '-8 days'), 'admin')
    `, [assignmentId, certificate.id, athleteId]);

    logger.info(`Created certificate: ${certificate.certHash}`);

    logger.info('✅ Test data seeded successfully!');
    logger.info(`
      Test User Credentials:
      Email: ninad@hostingduty.com
      Password: password123

      Summary:
      - 3 competition records created
      - 1 pending certificate request (20 days old - eligible for appeal)
      - 1 approved certificate request with generated certificate
      - 1 competition record without request (can be requested)
    `);

  } catch (error) {
    logger.error('Error seeding test data:', error);
    throw error;
  }
}
