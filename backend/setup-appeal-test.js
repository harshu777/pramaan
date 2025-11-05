/**
 * Setup script to create test data for appeal testing
 * This will create a pending certificate request for prasad@gmail.com
 * so they can test the appeal functionality
 */

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function setupAppealTest() {
  console.log('Setting up appeal test for prasad@gmail.com...\n');

  // Open database
  const db = await open({
    filename: path.join(__dirname, 'certificates.db'),
    driver: sqlite3.Database
  });

  try {
    // 1. Find prasad@gmail.com athlete
    const athlete = await db.get('SELECT * FROM athletes WHERE email = ?', ['prasad@gmail.com']);

    if (!athlete) {
      console.log('❌ Athlete prasad@gmail.com not found!');
      console.log('Please make sure the user is registered first.\n');
      return;
    }

    console.log('✅ Found athlete:', athlete.full_name, '(', athlete.email, ')');

    // 2. Find or create a competition record for this athlete
    let competitionRecord = await db.get(
      'SELECT * FROM athlete_competitions WHERE athlete_id = ? OR LOWER(TRIM(full_name)) = LOWER(TRIM(?)) LIMIT 1',
      [athlete.id, athlete.full_name]
    );

    if (!competitionRecord) {
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
        'Test Father Name',
        athlete.dob || '2000-01-01',
        athlete.district || 'Test District',
        'Cricket',
        'State Level Cricket Championship 2024',
        'State Level',
        'State',
        'First',
        'TEST-2024-001',
        '2024-01-15 to 2024-01-20',
        'Mumbai',
        athlete.district || 'Test District',
        'Group A'
      ]);

      competitionRecord = await db.get('SELECT * FROM athlete_competitions WHERE id = ?', [recordId]);
      console.log('✅ Created test competition record:', competitionRecord.competition_name);
    } else {
      console.log('✅ Found existing competition record:', competitionRecord.competition_name);

      // Link it to the athlete if not already linked
      if (!competitionRecord.athlete_id || competitionRecord.athlete_id !== athlete.id) {
        await db.run(
          'UPDATE athlete_competitions SET athlete_id = ? WHERE id = ?',
          [athlete.id, competitionRecord.id]
        );
        console.log('✅ Linked competition record to athlete');
      }
    }

    // 3. Check if there's already a pending request
    const existingRequest = await db.get(
      'SELECT * FROM quota_certificate_requests WHERE athlete_id = ? AND competition_record_id = ?',
      [athlete.id, competitionRecord.id]
    );

    let requestId;
    if (existingRequest) {
      requestId = existingRequest.id;
      console.log('✅ Found existing certificate request (Status:', existingRequest.status, ')');

      // If it's not pending, update it to pending
      if (existingRequest.status !== 'pending') {
        await db.run(
          'UPDATE quota_certificate_requests SET status = ?, processed_at = NULL, rejection_reason = NULL WHERE id = ?',
          ['pending', requestId]
        );
        console.log('✅ Reset request status to pending');
      }
    } else {
      // Create a pending certificate request
      requestId = uuidv4();
      // Set requested_at to current time (no backdating needed since prasad@gmail.com bypasses time check)
      await db.run(`
        INSERT INTO quota_certificate_requests (
          id, athlete_id, competition_record_id, status, requested_at
        ) VALUES (?, ?, ?, 'pending', datetime('now'))
      `, [requestId, athlete.id, competitionRecord.id]);

      console.log('✅ Created pending certificate request');
    }

    // 4. Clean up any existing appeals for this request (for fresh testing)
    const existingAppeals = await db.all(
      'SELECT * FROM appeals WHERE request_id = ?',
      [requestId]
    );

    if (existingAppeals.length > 0) {
      console.log(`\n⚠️  Found ${existingAppeals.length} existing appeal(s) for this request`);
      console.log('Options:');
      console.log('  1. Keep existing appeals (to test second appeal if first is rejected)');
      console.log('  2. Delete existing appeals (to test first appeal from scratch)');
      console.log('\nTo delete existing appeals and start fresh, run:');
      console.log(`  DELETE FROM appeals WHERE request_id = '${requestId}';`);

      existingAppeals.forEach((appeal, index) => {
        console.log(`\n  Appeal ${index + 1}:`);
        console.log(`    Status: ${appeal.status}`);
        console.log(`    Created: ${appeal.created_at}`);
        if (appeal.resolved_at) console.log(`    Resolved: ${appeal.resolved_at}`);
      });
    } else {
      console.log('✅ No existing appeals - ready for first appeal test');
    }

    // 5. Display test instructions
    console.log('\n' + '='.repeat(70));
    console.log('🎯 APPEAL TEST SETUP COMPLETE');
    console.log('='.repeat(70));
    console.log('\n📋 Test Instructions:\n');
    console.log('1. LOGIN AS TEST USER:');
    console.log('   Email: prasad@gmail.com');
    console.log('   Password: Prasad@123');
    console.log('');
    console.log('2. TEST FIRST APPEAL:');
    console.log('   - Go to "My Requests" button');
    console.log('   - You should see a pending request');
    console.log('   - Click "Raise Appeal" button (no waiting period for test user)');
    console.log('   - Enter a reason and submit');
    console.log('   - Check "My Appeals" to see your appeal');
    console.log('');
    console.log('3. ADMIN REJECTS FIRST APPEAL:');
    console.log('   - Login to admin panel');
    console.log('   - Go to Appeals section');
    console.log('   - Find prasad\'s appeal and REJECT it');
    console.log('   - Provide a rejection reason');
    console.log('');
    console.log('4. TEST SECOND APPEAL:');
    console.log('   - Login again as prasad@gmail.com');
    console.log('   - Go to "My Appeals"');
    console.log('   - You should see rejected first appeal');
    console.log('   - You should see "Submit Second Appeal" button (no waiting period)');
    console.log('   - Click and submit second appeal');
    console.log('');
    console.log('5. VERIFY:');
    console.log('   - Check that both appeals show in "My Appeals"');
    console.log('   - Verify you cannot submit a 3rd appeal (max 2)');
    console.log('');
    console.log('='.repeat(70));
    console.log('\n💡 Note: prasad@gmail.com bypasses the 20-day waiting period');
    console.log('   You can test appeals immediately!\n');

  } catch (error) {
    console.error('❌ Error setting up test:', error);
  } finally {
    await db.close();
  }
}

// Run the setup
setupAppealTest().catch(console.error);
