const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcrypt');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function createDummyData() {
  const db = await open({
    filename: path.join(__dirname, 'certificates.db'),
    driver: sqlite3.Database
  });

  try {
    console.log('\n🏃 Creating dummy athletes and data...\n');

    // Create 3 additional dummy athletes
    const dummyAthletes = [
      {
        id: uuidv4(),
        unique_id: 'ATH002',
        aadhar_number: '234567890123',
        full_name: 'Priya Sharma',
        email: 'priya.sharma@example.com',
        phone_number: '+919876543211',
        dob: '1998-03-20',
        district: 'Pune',
        state: 'Maharashtra',
        father_name: 'Ramesh Sharma'
      },
      {
        id: uuidv4(),
        unique_id: 'ATH003',
        aadhar_number: '345678901234',
        full_name: 'Rahul Deshmukh',
        email: 'rahul.deshmukh@example.com',
        phone_number: '+919876543212',
        dob: '1999-07-10',
        district: 'Nagpur',
        state: 'Maharashtra',
        father_name: 'Suresh Deshmukh'
      },
      {
        id: uuidv4(),
        unique_id: 'ATH004',
        aadhar_number: '456789012345',
        full_name: 'Sneha Kulkarni',
        email: 'sneha.kulkarni@example.com',
        phone_number: '+919876543213',
        dob: '2001-11-15',
        district: 'Thane',
        state: 'Maharashtra',
        father_name: 'Anil Kulkarni'
      }
    ];

    const passwordHash = await bcrypt.hash('password123', 10);

    // Insert dummy athletes
    for (const athlete of dummyAthletes) {
      await db.run(`
        INSERT INTO athletes (id, unique_id, aadhar_number, full_name, email, phone_number, dob, password_hash, district, state, father_name, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        athlete.id, athlete.unique_id, athlete.aadhar_number, athlete.full_name,
        athlete.email, athlete.phone_number, athlete.dob, passwordHash,
        athlete.district, athlete.state, athlete.father_name, 1
      ]);

      console.log(`✅ Created athlete: ${athlete.full_name}`);
    }

    // Create competition records for these athletes
    const competitions = [
      // Priya Sharma - Badminton
      {
        id: uuidv4(),
        athlete_id: dummyAthletes[0].id,
        unique_id: dummyAthletes[0].unique_id,
        aadhar_number: dummyAthletes[0].aadhar_number,
        full_name: dummyAthletes[0].full_name,
        father_name: dummyAthletes[0].father_name,
        dob: dummyAthletes[0].dob,
        district: dummyAthletes[0].district,
        representing_district: 'Pune',
        division_state_country: 'Maharashtra State',
        game_name: 'Badminton',
        competition_name: 'Maharashtra State Badminton Championship 2024',
        competition_type: 'State Level',
        competition_period: '5th Feb 2024 to 10th Feb 2024',
        competition_held_at: 'Shiv Chhatrapati Sports Complex, Pune',
        competition_level: 'State',
        position_obtained: 'Silver Medal - 2nd Position',
        certificate_no: 'MSB/2024/015',
        valid_for_employment_group: 'Group A, B',
        applicable_govt_resolutions: 'GR No. SPS-2018/CR-123/Sports-1, dated 15th March 2018'
      },
      // Rahul Deshmukh - Wrestling
      {
        id: uuidv4(),
        athlete_id: dummyAthletes[1].id,
        unique_id: dummyAthletes[1].unique_id,
        aadhar_number: dummyAthletes[1].aadhar_number,
        full_name: dummyAthletes[1].full_name,
        father_name: dummyAthletes[1].father_name,
        dob: dummyAthletes[1].dob,
        district: dummyAthletes[1].district,
        representing_district: 'Nagpur District',
        division_state_country: 'Vidarbha Division',
        game_name: 'Wrestling',
        competition_name: 'Vidarbha Division Wrestling Championship 2024',
        competition_type: 'Division Level',
        competition_period: '20th Jan 2024 to 25th Jan 2024',
        competition_held_at: 'Yashwantrao Chavan Stadium, Nagpur',
        competition_level: 'Division',
        position_obtained: 'Gold Medal - 1st Position',
        certificate_no: 'VDW/2024/023',
        valid_for_employment_group: 'Group A, B, C',
        applicable_govt_resolutions: 'GR No. SPS-2018/CR-123/Sports-1, dated 15th March 2018'
      },
      // Sneha Kulkarni - Table Tennis
      {
        id: uuidv4(),
        athlete_id: dummyAthletes[2].id,
        unique_id: dummyAthletes[2].unique_id,
        aadhar_number: dummyAthletes[2].aadhar_number,
        full_name: dummyAthletes[2].full_name,
        father_name: dummyAthletes[2].father_name,
        dob: dummyAthletes[2].dob,
        district: dummyAthletes[2].district,
        representing_district: 'Thane',
        division_state_country: 'Maharashtra State',
        game_name: 'Table Tennis',
        competition_name: 'Inter-District Table Tennis Tournament 2024',
        competition_type: 'District Level',
        competition_period: '15th March 2024 to 18th March 2024',
        competition_held_at: 'Thane Municipal Corporation Sports Complex',
        competition_level: 'District',
        position_obtained: 'Bronze Medal - 3rd Position',
        certificate_no: 'TTH/2024/087',
        valid_for_employment_group: 'Group B, C, D',
        applicable_govt_resolutions: 'GR No. SPS-2018/CR-123/Sports-1, dated 15th March 2018'
      }
    ];

    console.log('\n📋 Creating competition records...\n');

    for (const comp of competitions) {
      await db.run(`
        INSERT INTO athlete_competitions (
          id, athlete_id, unique_id, aadhar_number, full_name, father_name, dob,
          district, representing_district, division_state_country, game_name,
          competition_name, competition_type, competition_period, competition_held_at,
          competition_level, position_obtained, certificate_no, valid_for_employment_group,
          applicable_govt_resolutions, certificate_issued, certificate_requested
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        comp.id, comp.athlete_id, comp.unique_id, comp.aadhar_number, comp.full_name,
        comp.father_name, comp.dob, comp.district, comp.representing_district,
        comp.division_state_country, comp.game_name, comp.competition_name,
        comp.competition_type, comp.competition_period, comp.competition_held_at,
        comp.competition_level, comp.position_obtained, comp.certificate_no,
        comp.valid_for_employment_group, comp.applicable_govt_resolutions, 0, 0
      ]);

      console.log(`✅ Created competition: ${comp.competition_name} for ${comp.full_name}`);
    }

    // Create pending certificate requests
    console.log('\n📝 Creating pending certificate requests...\n');

    const requests = [
      {
        id: uuidv4(),
        athlete_id: dummyAthletes[0].id,
        competition_record_id: competitions[0].id,
        unique_id: dummyAthletes[0].unique_id,
        aadhar_number: dummyAthletes[0].aadhar_number,
        status: 'pending'
      },
      {
        id: uuidv4(),
        athlete_id: dummyAthletes[1].id,
        competition_record_id: competitions[1].id,
        unique_id: dummyAthletes[1].unique_id,
        aadhar_number: dummyAthletes[1].aadhar_number,
        status: 'pending'
      }
    ];

    for (const req of requests) {
      await db.run(`
        INSERT INTO quota_certificate_requests (
          id, athlete_id, competition_record_id, unique_id, aadhar_number,
          status, requested_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `, [req.id, req.athlete_id, req.competition_record_id, req.unique_id, req.aadhar_number, req.status]);

      const athlete = dummyAthletes.find(a => a.id === req.athlete_id);
      console.log(`✅ Created pending request for: ${athlete.full_name}`);
    }

    // Get existing athlete (ninad@hostingduty.com) for rejected request
    const existingAthlete = await db.get('SELECT * FROM athletes WHERE email = ?', ['ninad@hostingduty.com']);

    if (existingAthlete) {
      // Get one of their competition records
      const existingComp = await db.get('SELECT * FROM athlete_competitions WHERE athlete_id = ? LIMIT 1', [existingAthlete.id]);

      if (existingComp) {
        // Create a rejected request
        const rejectedRequestId = uuidv4();
        await db.run(`
          INSERT INTO quota_certificate_requests (
            id, athlete_id, competition_record_id, unique_id, aadhar_number,
            status, rejection_reason, admin_notes, requested_at, processed_at, processed_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-5 days'), datetime('now', '-3 days'), ?)
        `, [
          rejectedRequestId, existingAthlete.id, existingComp.id,
          existingComp.unique_id, existingComp.aadhar_number,
          'rejected',
          'Incomplete documentation - Please submit original competition certificate',
          'Documents verification failed',
          'admin'
        ]);

        console.log(`✅ Created rejected request for: ${existingAthlete.full_name}`);
      }
    }

    // Create appeals
    console.log('\n⚖️  Creating appeals...\n');

    // Appeal 1: For Sneha Kulkarni (new rejection - we'll create it)
    const snehaCompId = competitions[2].id;
    const snehaRequestId = uuidv4();

    await db.run(`
      INSERT INTO quota_certificate_requests (
        id, athlete_id, competition_record_id, unique_id, aadhar_number,
        status, rejection_reason, admin_notes, requested_at, processed_at, processed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-7 days'), datetime('now', '-5 days'), ?)
    `, [
      snehaRequestId, dummyAthletes[2].id, snehaCompId,
      dummyAthletes[2].unique_id, dummyAthletes[2].aadhar_number,
      'rejected',
      'Medal certificate not clearly visible in uploaded documents',
      'Unable to verify position obtained',
      'admin'
    ]);

    console.log(`✅ Created rejected request for appeal: ${dummyAthletes[2].full_name}`);

    // Create appeals for rejected requests
    const appeals = [
      {
        id: uuidv4(),
        request_id: snehaRequestId,
        athlete_id: dummyAthletes[2].id,
        reason: 'I have attached a high-resolution scan of my medal certificate and participation certificate. The original documents clearly show my 3rd position. I am also providing a letter from the organizing committee confirming my participation and medal.',
        status: 'pending'
      }
    ];

    if (existingAthlete) {
      const rejectedReq = await db.get(
        'SELECT * FROM quota_certificate_requests WHERE athlete_id = ? AND status = ? ORDER BY requested_at DESC LIMIT 1',
        [existingAthlete.id, 'rejected']
      );

      if (rejectedReq) {
        appeals.push({
          id: uuidv4(),
          request_id: rejectedReq.id,
          athlete_id: existingAthlete.id,
          reason: 'I have now obtained the original competition certificate from the organizing body. The certificate is duly signed and stamped. I request you to please reconsider my application.',
          status: 'pending'
        });
      }
    }

    for (const appeal of appeals) {
      await db.run(`
        INSERT INTO appeals (id, request_id, athlete_id, reason, status, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `, [appeal.id, appeal.request_id, appeal.athlete_id, appeal.reason, appeal.status]);

      const athlete = dummyAthletes.find(a => a.id === appeal.athlete_id) || existingAthlete;
      console.log(`✅ Created appeal for: ${athlete.full_name}`);
    }

    // Summary
    console.log('\n\n🎉 Dummy data created successfully!\n');
    console.log('📊 Summary:');
    console.log(`   • ${dummyAthletes.length} new athletes created`);
    console.log(`   • ${competitions.length} competition records created`);
    console.log(`   • ${requests.length} pending certificate requests`);
    console.log(`   • 1 rejected certificate request (for appeal demo)`);
    console.log(`   • ${appeals.length} pending appeals`);

    console.log('\n👥 Athlete Login Credentials (password: password123):');
    dummyAthletes.forEach(a => console.log(`   • ${a.email}`));
    console.log('   • ninad@hostingduty.com');

    console.log('\n🔐 Admin Login:');
    console.log('   • Username: admin');
    console.log('   • Password: admin123');

  } catch (error) {
    console.error('❌ Error creating dummy data:', error);
    throw error;
  } finally {
    await db.close();
  }
}

createDummyData().catch(console.error);
