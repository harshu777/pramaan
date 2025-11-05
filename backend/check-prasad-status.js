/**
 * Quick status check for prasad@gmail.com
 * Shows current state of athlete, requests, and appeals
 */

const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function checkPrasadStatus() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 PRASAD ACCOUNT STATUS CHECK');
  console.log('='.repeat(70) + '\n');

  const db = await open({
    filename: path.join(__dirname, 'certificates.db'),
    driver: sqlite3.Database
  });

  try {
    // Get athlete info
    const athlete = await db.get(
      'SELECT * FROM athletes WHERE email = ?',
      ['prasad@gmail.com']
    );

    if (!athlete) {
      console.log('❌ Athlete prasad@gmail.com not found!\n');
      return;
    }

    console.log('👤 ATHLETE INFORMATION:');
    console.log('   Name:', athlete.full_name);
    console.log('   Email:', athlete.email);
    console.log('   ID:', athlete.id);
    console.log('   District:', athlete.district);
    console.log('   DOB:', athlete.dob);
    console.log('');

    // Get competition records
    const competitionRecords = await db.all(
      `SELECT * FROM athlete_competitions
       WHERE athlete_id = ? OR LOWER(TRIM(full_name)) = LOWER(TRIM(?))`,
      [athlete.id, athlete.full_name]
    );

    console.log('🏆 COMPETITION RECORDS:');
    if (competitionRecords.length === 0) {
      console.log('   No competition records found');
    } else {
      competitionRecords.forEach((record, index) => {
        console.log(`   ${index + 1}. ${record.competition_name}`);
        console.log(`      Game: ${record.game_name}`);
        console.log(`      Level: ${record.competition_level}`);
        console.log(`      Position: ${record.position_obtained}`);
        console.log(`      Certificate Issued: ${record.certificate_issued ? 'Yes' : 'No'}`);
        console.log(`      Certificate Requested: ${record.certificate_requested ? 'Yes' : 'No'}`);
      });
    }
    console.log('');

    // Get certificate requests
    const requests = await db.all(
      `SELECT qcr.*, ac.competition_name, ac.game_name
       FROM quota_certificate_requests qcr
       LEFT JOIN athlete_competitions ac ON qcr.competition_record_id = ac.id
       WHERE qcr.athlete_id = ?
       ORDER BY qcr.requested_at DESC`,
      [athlete.id]
    );

    console.log('📋 CERTIFICATE REQUESTS:');
    if (requests.length === 0) {
      console.log('   No certificate requests found');
      console.log('   ⚠️  You need at least one pending request to test appeals!');
    } else {
      requests.forEach((req, index) => {
        console.log(`   ${index + 1}. ${req.competition_name || 'Unknown Competition'}`);
        console.log(`      Request ID: ${req.id}`);
        console.log(`      Status: ${req.status.toUpperCase()}`);
        console.log(`      Requested: ${req.requested_at}`);
        if (req.processed_at) console.log(`      Processed: ${req.processed_at}`);
        if (req.rejection_reason) console.log(`      Rejection: ${req.rejection_reason}`);
      });
    }
    console.log('');

    // Get appeals
    const appeals = await db.all(
      `SELECT a.*, qcr.competition_record_id, ac.competition_name
       FROM appeals a
       LEFT JOIN quota_certificate_requests qcr ON a.request_id = qcr.id
       LEFT JOIN athlete_competitions ac ON qcr.competition_record_id = ac.id
       WHERE a.athlete_id = ?
       ORDER BY a.created_at DESC`,
      [athlete.id]
    );

    console.log('⚖️  APPEALS:');
    if (appeals.length === 0) {
      console.log('   No appeals found');
      console.log('   ✅ Ready to test first appeal!');
    } else {
      appeals.forEach((appeal, index) => {
        console.log(`   ${index + 1}. Appeal for: ${appeal.competition_name || 'Unknown'}`);
        console.log(`      Appeal ID: ${appeal.id}`);
        console.log(`      Status: ${appeal.status.toUpperCase()}`);
        console.log(`      Created: ${appeal.created_at}`);
        console.log(`      Reason: ${appeal.reason.substring(0, 60)}...`);
        if (appeal.resolved_at) {
          console.log(`      Resolved: ${appeal.resolved_at}`);
          console.log(`      By: ${appeal.resolved_by}`);
        }
        if (appeal.admin_response) {
          console.log(`      Admin Response: ${appeal.admin_response}`);
        }
      });

      console.log('');
      console.log('   Total Appeals:', appeals.length);
      if (appeals.length >= 2) {
        console.log('   ⚠️  Maximum appeals (2) already reached!');
      } else if (appeals.length === 1) {
        const lastAppeal = appeals[0];
        if (lastAppeal.status === 'pending') {
          console.log('   ⏳ First appeal is pending - waiting for admin response');
        } else if (lastAppeal.status === 'rejected') {
          console.log('   ✅ First appeal rejected - ready to test second appeal!');
        } else if (lastAppeal.status === 'accepted') {
          console.log('   ✅ First appeal accepted - no second appeal needed!');
        }
      }
    }
    console.log('');

    // Show next steps
    console.log('📝 NEXT STEPS:');
    console.log('');

    if (requests.length === 0) {
      console.log('   1. Run setup script to create a pending request:');
      console.log('      node setup-appeal-test.js');
    } else if (appeals.length === 0) {
      console.log('   1. Login as prasad@gmail.com');
      console.log('   2. Click "My Requests"');
      console.log('   3. Click "Raise Appeal"');
      console.log('   4. Enter appeal reason and submit');
    } else if (appeals.length === 1 && appeals[0].status === 'pending') {
      console.log('   1. Login to admin panel');
      console.log('   2. Go to Appeals section');
      console.log('   3. Find Prasad\'s appeal');
      console.log('   4. REJECT it to test second appeal');
    } else if (appeals.length === 1 && appeals[0].status === 'rejected') {
      console.log('   1. Login as prasad@gmail.com');
      console.log('   2. Go to "My Appeals"');
      console.log('   3. Click "Submit Second Appeal"');
      console.log('   4. Enter reason and submit');
    } else {
      console.log('   Test complete! Check admin panel to process appeals.');
    }

    console.log('');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

checkPrasadStatus().catch(console.error);
