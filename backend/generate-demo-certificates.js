const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Import services
const { certificateService } = require('./dist/services/certificateService');
const { pdfService } = require('./dist/services/pdfService');

async function generateDemoCertificates() {
  const db = await open({
    filename: path.join(__dirname, 'certificates.db'),
    driver: sqlite3.Database
  });

  try {
    console.log('🔍 Finding competition records for ninad@hostingduty.com...\n');

    // Get athlete
    const athlete = await db.get('SELECT * FROM athletes WHERE email = ?', ['ninad@hostingduty.com']);

    if (!athlete) {
      console.error('❌ Athlete not found');
      return;
    }

    // Get competition records
    const competitions = await db.all(
      'SELECT * FROM athlete_competitions WHERE athlete_id = ? AND certificate_issued = 0',
      [athlete.id]
    );

    if (competitions.length === 0) {
      console.log('No competitions found or certificates already issued');
      return;
    }

    console.log(`Found ${competitions.length} competitions\n`);

    // Get admin user
    const admin = await db.get("SELECT * FROM issuers WHERE username = 'admin'");

    for (const comp of competitions) {
      console.log(`\n📝 Processing: ${comp.competition_name}`);

      // Create certificate request
      const requestId = uuidv4();
      await db.run(`
        INSERT INTO quota_certificate_requests (
          id, athlete_id, competition_record_id, unique_id, aadhar_number,
          status, requested_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `, [requestId, athlete.id, comp.id, comp.unique_id, comp.aadhar_number, 'pending']);

      console.log('  ✓ Created certificate request');

      // Generate certificate
      const certificateData = {
        issuerDid: 'admin',
        issuerName: 'Directorate of Sports and Youth Services',
        subjectName: comp.full_name,
        subjectEmail: athlete.email,
        certificateType: comp.competition_type || 'Sports Achievement',
        metadata: {
          fatherName: comp.father_name,
          dob: comp.dob,
          district: comp.district,
          representingDistrict: comp.representing_district,
          divisionStateCountry: comp.division_state_country,
          gameName: comp.game_name,
          competitionName: comp.competition_name,
          competitionPeriod: comp.competition_period,
          competitionHeldAt: comp.competition_held_at,
          competitionLevel: comp.competition_level,
          positionObtained: comp.position_obtained,
          certificateNo: comp.certificate_no,
          validForEmploymentGroup: comp.valid_for_employment_group,
          applicableGovtResolutions: comp.applicable_govt_resolutions
        }
      };

      const certificate = await certificateService.issueCertificate(certificateData);
      console.log(`  ✓ Generated certificate with hash: ${certificate.certHash.substring(0, 16)}...`);

      // Get certificate with digital signature
      const dbResult = await certificateService.validateCertificate(certificate.certHash);
      const digitalSignature = dbResult.certificate?.digitalSignature || null;

      // Generate PDF
      const pdfData = {
        name: comp.full_name,
        fatherName: comp.father_name,
        dob: comp.dob,
        district: comp.district,
        representingDistrict: comp.representing_district,
        divisionStateCountry: comp.division_state_country,
        gameName: comp.game_name,
        competitionName: comp.competition_name,
        competitionPeriod: comp.competition_period,
        competitionHeldAt: comp.competition_held_at,
        competitionLevel: comp.competition_level,
        positionObtained: comp.position_obtained,
        certificateNo: comp.certificate_no,
        validForEmploymentGroup: comp.valid_for_employment_group,
        applicableGovtResolutions: comp.applicable_govt_resolutions,
        certHash: certificate.certHash,
        issuerName: 'Deputy Director',
        issuerTitle: 'Deputy Director',
        organizationName: 'Sports and Youth Services, Maharashtra State',
        issueDate: new Date().toLocaleDateString('en-IN'),
        digitalSignature
      };

      await pdfService.generateCertificatePDF(pdfData);
      console.log('  ✓ Generated PDF certificate');

      // Update request status
      await db.run(`
        UPDATE quota_certificate_requests
        SET status = ?, certificate_id = ?, certificate_hash = ?,
            processed_at = datetime('now'), processed_by = ?
        WHERE id = ?
      `, ['approved', certificate.id, certificate.certHash, admin.username, requestId]);

      // Mark competition as certificate issued
      await db.run(
        'UPDATE athlete_competitions SET certificate_issued = 1 WHERE id = ?',
        [comp.id]
      );

      // Create certificate assignment
      await db.run(`
        INSERT INTO certificate_assignments (id, certificate_id, athlete_id, assigned_by)
        VALUES (?, ?, ?, ?)
      `, [uuidv4(), certificate.id, athlete.id, admin.username]);

      console.log(`  ✓ Approved and assigned certificate`);
      console.log(`  📋 Certificate No: ${comp.certificate_no}`);
      console.log(`  🏆 Competition: ${comp.competition_name}`);
      console.log(`  🔗 Verification URL: http://localhost:3000/static/validation.html?hash=${certificate.certHash}`);
    }

    console.log('\n\n🎉 Successfully generated and assigned 3 certificates!');
    console.log('\n📧 Login credentials for athlete:');
    console.log('   Email: ninad@hostingduty.com');
    console.log('   Password: password123');
    console.log('\n🔍 View certificates at:');
    console.log('   http://localhost:3000/static/athlete-dashboard.html');

  } catch (error) {
    console.error('\n❌ Error generating certificates:', error);
    throw error;
  } finally {
    await db.close();
  }
}

generateDemoCertificates().catch(console.error);
