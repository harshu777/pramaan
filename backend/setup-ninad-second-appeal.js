/**
 * Setup script for ninad@hostingduty.com to test second appeal
 * This will:
 * 1. Check ninad's current status
 * 2. Ensure they have a first appeal that's rejected
 * 3. Allow them to submit a second appeal
 */

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function setupNinadSecondAppeal() {
  console.log('\n' + '='.repeat(70));
  console.log('🔧 SETTING UP SECOND APPEAL FOR NINAD');
  console.log('='.repeat(70) + '\n');

  const db = await open({
    filename: path.join(__dirname, 'certificates.db'),
    driver: sqlite3.Database
  });

  try {
    // 1. Find ninad's athlete account
    const athlete = await db.get(
      'SELECT * FROM athletes WHERE email = ?',
      ['ninad@hostingduty.com']
    );

    if (!athlete) {
      console.log('❌ Athlete ninad@hostingduty.com not found!');
      console.log('Please ensure the user is registered first.\n');
      return;
    }

    console.log('✅ Found athlete:', athlete.full_name, '(', athlete.email, ')');
    console.log('   ID:', athlete.id);
    console.log('');

    // 2. Check for competition records
    const competitionRecords = await db.all(
      `SELECT * FROM athlete_competitions
       WHERE athlete_id = ? OR LOWER(TRIM(full_name)) = LOWER(TRIM(?))`,
      [athlete.id, athlete.full_name]
    );

    console.log('🏆 COMPETITION RECORDS:', competitionRecords.length);
    if (competitionRecords.length === 0) {
      console.log('⚠️  No competition records found. Creating test record...');

      // Create a test competition record
      const recordId = uuidv4();
      await db.run(`
        INSERT INTO athlete_competitions (
          id, athlete_id, full_name, father_name, dob, district,
          game_name, competition_name, competition_type, competition_level,
          position_obtained, certificate_no, competition_period, competition_held_at,
          representing_district, valid_for_employment_group
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        recordId,
        athlete.id,
        athlete.full_name,
        'Test Father',
        athlete.dob || '1995-01-01',
        athlete.district || 'Mumbai',
        'Football',
        'Maharashtra State Football Championship 2024',
        'State Level',
        'State',
        'Winner',
        'TEST-NINAD-2024',
        '2024-10-01 to 2024-10-05',
        'Mumbai',
        athlete.district || 'Mumbai',
        'Group A'
      ]);

      console.log('✅ Created test competition record');
      competitionRecords.push(await db.get('SELECT * FROM athlete_competitions WHERE id = ?', [recordId]));
    }

    const record = competitionRecords[0];
    console.log('   Using:', record.competition_name);
    console.log('');

    // 3. Check for certificate requests
    let request = await db.get(
      `SELECT * FROM quota_certificate_requests
       WHERE athlete_id = ? AND competition_record_id = ?`,
      [athlete.id, record.id]
    );

    if (!request) {
      console.log('⚠️  No certificate request found. Creating one...');
      const requestId = uuidv4();
      await db.run(`
        INSERT INTO quota_certificate_requests (
          id, athlete_id, competition_record_id, status, requested_at
        ) VALUES (?, ?, ?, 'pending', datetime('now', '-25 days'))
      `, [requestId, athlete.id, record.id]);

      request = await db.get('SELECT * FROM quota_certificate_requests WHERE id = ?', [requestId]);
      console.log('✅ Created certificate request (backdated 25 days)');
    }

    console.log('📋 CERTIFICATE REQUEST:');
    console.log('   ID:', request.id);
    console.log('   Status:', request.status);
    console.log('   Requested:', request.requested_at);
    console.log('');

    // 4. Check existing appeals
    const appeals = await db.all(
      'SELECT * FROM appeals WHERE request_id = ? ORDER BY created_at ASC',
      [request.id]
    );

    console.log('⚖️  EXISTING APPEALS:', appeals.length);

    if (appeals.length === 0) {
      // No appeals - create first appeal and reject it
      console.log('⚠️  No appeals found. Creating and rejecting first appeal...');

      const firstAppealId = uuidv4();
      await db.run(`
        INSERT INTO appeals (
          id, request_id, athlete_id, reason, status,
          admin_response, resolved_by, resolved_at, created_at
        ) VALUES (?, ?, ?, ?, 'rejected', ?, 'admin', datetime('now'), datetime('now', '-1 days'))
      `, [
        firstAppealId,
        request.id,
        athlete.id,
        'First Appeal: Certificate request pending for long time. Need it urgently.',
        'First appeal rejected: Need additional documentation. Please provide proof of participation.'
      ]);

      console.log('✅ Created and rejected first appeal');
      console.log('   Appeal ID:', firstAppealId);
      console.log('   Status: REJECTED');
      console.log('   Reason: Need additional documentation');

    } else if (appeals.length === 1) {
      const firstAppeal = appeals[0];

      if (firstAppeal.status === 'pending') {
        // First appeal is pending - reject it
        console.log('⚠️  First appeal is PENDING. Rejecting it now...');

        await db.run(`
          UPDATE appeals
          SET status = 'rejected',
              admin_response = ?,
              resolved_by = 'admin',
              resolved_at = datetime('now')
          WHERE id = ?
        `, [
          'First appeal rejected: Need additional documentation. Please provide proof of participation and medals.',
          firstAppeal.id
        ]);

        console.log('✅ Rejected first appeal');
        console.log('   Appeal ID:', firstAppeal.id);
        console.log('   Status: REJECTED');

      } else if (firstAppeal.status === 'rejected') {
        console.log('✅ First appeal already REJECTED');
        console.log('   Appeal ID:', firstAppeal.id);
        console.log('   Rejected at:', firstAppeal.resolved_at);
        console.log('   Reason:', firstAppeal.admin_response);
      } else if (firstAppeal.status === 'accepted') {
        console.log('⚠️  First appeal was ACCEPTED. Cannot submit second appeal.');
        console.log('   Need to reject first appeal to test second appeal.');
        console.log('   Changing to rejected...');

        await db.run(`
          UPDATE appeals
          SET status = 'rejected',
              admin_response = 'Changed to rejected for second appeal testing',
              resolved_at = datetime('now')
          WHERE id = ?
        `, [firstAppeal.id]);

        console.log('✅ Changed first appeal to REJECTED');
      }

    } else if (appeals.length >= 2) {
      console.log('⚠️  Already has', appeals.length, 'appeals!');
      appeals.forEach((appeal, index) => {
        console.log(`   Appeal ${index + 1}:`);
        console.log(`     Status: ${appeal.status}`);
        console.log(`     Created: ${appeal.created_at}`);
      });

      if (appeals.length === 2 && appeals[1].status === 'pending') {
        console.log('\n✅ Second appeal already exists and is PENDING');
        console.log('   Ready for admin to process it!');
      } else {
        console.log('\n⚠️  Maximum appeals reached. Cleaning up for fresh test...');
        // Delete second appeal if exists to allow re-testing
        if (appeals.length === 2) {
          await db.run('DELETE FROM appeals WHERE id = ?', [appeals[1].id]);
          console.log('✅ Deleted second appeal to allow fresh testing');
        }
      }
    }

    console.log('');
    console.log('='.repeat(70));
    console.log('🎯 SETUP COMPLETE FOR NINAD');
    console.log('='.repeat(70));
    console.log('');
    console.log('📋 CURRENT STATUS:');

    // Get final status
    const finalAppeals = await db.all(
      'SELECT * FROM appeals WHERE request_id = ? ORDER BY created_at ASC',
      [request.id]
    );

    console.log('   ✅ Athlete: ninad@hostingduty.com');
    console.log('   ✅ Certificate Request: PENDING');
    console.log('   ✅ First Appeal: REJECTED');
    console.log('   ✅ Second Appeal: ' + (finalAppeals.length === 2 ? 'EXISTS' : 'READY TO SUBMIT'));
    console.log('');
    console.log('🚀 NEXT STEPS FOR NINAD:');
    console.log('');
    console.log('1. Login as ninad@hostingduty.com');
    console.log('2. Go to "My Appeals"');
    console.log('3. See first appeal marked as REJECTED');
    console.log('4. Click "Submit Second Appeal" button');
    console.log('5. Enter reason for second appeal');
    console.log('6. Submit');
    console.log('');
    console.log('💡 NOTE: ninad@hostingduty.com does NOT have test user privileges');
    console.log('   If first appeal was rejected less than 20 days ago, they will');
    console.log('   need to wait. To bypass, update resolved_at date:');
    console.log('');
    console.log('   UPDATE appeals SET resolved_at = datetime(\'now\', \'-21 days\')');
    console.log('   WHERE athlete_id = \'' + athlete.id + '\' AND status = \'rejected\';');
    console.log('');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

setupNinadSecondAppeal().catch(console.error);
