const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcrypt');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function createDemoCertificates() {
  // Open database
  const db = await open({
    filename: path.join(__dirname, 'certificates.db'),
    driver: sqlite3.Database
  });

  try {
    // Check if athlete exists
    let athlete = await db.get('SELECT * FROM athletes WHERE email = ?', ['ninad@hostingduty.com']);

    if (!athlete) {
      // Create athlete
      const athleteId = uuidv4();
      const passwordHash = await bcrypt.hash('password123', 10);

      await db.run(`
        INSERT INTO athletes (id, unique_id, aadhar_number, full_name, email, phone_number, dob, password_hash, district, state, father_name, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        athleteId,
        'NINAD001',
        '123456789012',
        'Ninad Patil',
        'ninad@hostingduty.com',
        '+919876543210',
        '2000-05-15',
        passwordHash,
        'Mumbai',
        'Maharashtra',
        'Rajesh Patil',
        1
      ]);

      console.log('✅ Created athlete record for ninad@hostingduty.com');
      athlete = { id: athleteId };
    } else {
      console.log('✅ Athlete already exists for ninad@hostingduty.com');
    }

    // Create 3 competition records
    const competitions = [
      {
        id: uuidv4(),
        athlete_id: athlete.id,
        unique_id: 'NINAD001',
        aadhar_number: '123456789012',
        full_name: 'Ninad Patil',
        father_name: 'Rajesh Patil',
        dob: '2000-05-15',
        district: 'Mumbai',
        representing_district: 'Mumbai',
        division_state_country: 'Maharashtra State',
        game_name: 'Cricket',
        competition_name: 'Maharashtra State Cricket Championship 2024',
        competition_type: 'State Level',
        competition_period: '15th Jan 2024 to 20th Jan 2024',
        competition_held_at: 'Wankhede Stadium, Mumbai',
        competition_level: 'State',
        position_obtained: 'Gold Medal - 1st Position',
        certificate_no: 'MSC/2024/001',
        valid_for_employment_group: 'Group A, B, C',
        applicable_govt_resolutions: 'GR No. SPS-2018/CR-123/Sports-1, dated 15th March 2018',
        event_name: 'Under-25 Cricket Tournament',
        position: 1,
        medal_type: 'Gold',
        competition_date: '2024-01-20',
        organizing_body: 'Maharashtra Cricket Association',
        location: 'Mumbai',
        certificate_issued: false,
        certificate_requested: false
      },
      {
        id: uuidv4(),
        athlete_id: athlete.id,
        unique_id: 'NINAD001',
        aadhar_number: '123456789012',
        full_name: 'Ninad Patil',
        father_name: 'Rajesh Patil',
        dob: '2000-05-15',
        district: 'Mumbai',
        representing_district: 'Mumbai',
        division_state_country: 'India',
        game_name: 'Athletics',
        competition_name: 'National Inter-State Athletics Meet 2023',
        competition_type: 'National Level',
        competition_period: '10th Dec 2023 to 15th Dec 2023',
        competition_held_at: 'Jawaharlal Nehru Stadium, New Delhi',
        competition_level: 'National',
        position_obtained: 'Silver Medal - 2nd Position',
        certificate_no: 'NAT/2023/045',
        valid_for_employment_group: 'Group A, B',
        applicable_govt_resolutions: 'GR No. SPS-2018/CR-123/Sports-1, dated 15th March 2018',
        event_name: '100m Sprint',
        position: 2,
        medal_type: 'Silver',
        competition_date: '2023-12-12',
        organizing_body: 'Athletics Federation of India',
        location: 'New Delhi',
        certificate_issued: false,
        certificate_requested: false
      },
      {
        id: uuidv4(),
        athlete_id: athlete.id,
        unique_id: 'NINAD001',
        aadhar_number: '123456789012',
        full_name: 'Ninad Patil',
        father_name: 'Rajesh Patil',
        dob: '2000-05-15',
        district: 'Mumbai',
        representing_district: 'Mumbai District',
        division_state_country: 'Mumbai Division',
        game_name: 'Football',
        competition_name: 'Mumbai District Football League 2024',
        competition_type: 'District Level',
        competition_period: '1st March 2024 to 15th March 2024',
        competition_held_at: 'Cooperage Ground, Mumbai',
        competition_level: 'District',
        position_obtained: 'Bronze Medal - 3rd Position',
        certificate_no: 'MDF/2024/078',
        valid_for_employment_group: 'Group B, C, D',
        applicable_govt_resolutions: 'GR No. SPS-2018/CR-123/Sports-1, dated 15th March 2018',
        event_name: 'Senior Men Football',
        position: 3,
        medal_type: 'Bronze',
        competition_date: '2024-03-15',
        organizing_body: 'Mumbai District Football Association',
        location: 'Mumbai',
        certificate_issued: false,
        certificate_requested: false
      }
    ];

    // Insert competition records
    for (const comp of competitions) {
      await db.run(`
        INSERT INTO athlete_competitions (
          id, athlete_id, unique_id, aadhar_number, full_name, father_name, dob,
          district, representing_district, division_state_country, game_name,
          competition_name, competition_type, competition_period, competition_held_at,
          competition_level, position_obtained, certificate_no, valid_for_employment_group,
          applicable_govt_resolutions, event_name, position, medal_type, competition_date,
          organizing_body, location, certificate_issued, certificate_requested
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        comp.id, comp.athlete_id, comp.unique_id, comp.aadhar_number, comp.full_name,
        comp.father_name, comp.dob, comp.district, comp.representing_district,
        comp.division_state_country, comp.game_name, comp.competition_name,
        comp.competition_type, comp.competition_period, comp.competition_held_at,
        comp.competition_level, comp.position_obtained, comp.certificate_no,
        comp.valid_for_employment_group, comp.applicable_govt_resolutions,
        comp.event_name, comp.position, comp.medal_type, comp.competition_date,
        comp.organizing_body, comp.location, comp.certificate_issued ? 1 : 0,
        comp.certificate_requested ? 1 : 0
      ]);

      console.log(`✅ Created competition record: ${comp.competition_name}`);
    }

    console.log('\n🎉 Successfully created 3 demo competition records for ninad@hostingduty.com');
    console.log('\nNext steps:');
    console.log('1. Login as athlete: ninad@hostingduty.com / password123');
    console.log('2. View competitions in athlete dashboard');
    console.log('3. Request certificates for these competitions');
    console.log('4. Login as admin to approve and generate certificates');

  } catch (error) {
    console.error('❌ Error creating demo data:', error);
    throw error;
  } finally {
    await db.close();
  }
}

createDemoCertificates().catch(console.error);
