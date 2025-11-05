const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function resetNinadAppeals() {
  console.log('\n🔄 Resetting Ninad\'s appeals for second appeal testing...\n');

  const db = await open({
    filename: path.join(__dirname, 'certificates.db'),
    driver: sqlite3.Database
  });

  try {
    const athlete = await db.get(
      'SELECT * FROM athletes WHERE email = ?',
      ['ninad@hostingduty.com']
    );

    if (!athlete) {
      console.log('❌ Athlete not found!\n');
      return;
    }

    // Delete all existing appeals
    const deleteResult = await db.run(
      'DELETE FROM appeals WHERE athlete_id = ?',
      [athlete.id]
    );

    console.log('✅ Deleted', deleteResult.changes, 'existing appeal(s)');

    // Find a pending or rejected request
    const request = await db.get(
      `SELECT qcr.*, ac.competition_name
       FROM quota_certificate_requests qcr
       LEFT JOIN athlete_competitions ac ON qcr.competition_record_id = ac.id
       WHERE qcr.athlete_id = ?
         AND qcr.status IN ('pending', 'rejected')
       ORDER BY qcr.requested_at DESC
       LIMIT 1`,
      [athlete.id]
    );

    if (!request) {
      console.log('❌ No suitable request found for appeals\n');
      return;
    }

    // Create one rejected appeal (backdated 21 days)
    const { v4: uuidv4 } = require('uuid');
    const appealId = uuidv4();

    await db.run(`
      INSERT INTO appeals (
        id, request_id, athlete_id, reason, status,
        admin_response, resolved_by, resolved_at, created_at
      ) VALUES (?, ?, ?, ?, 'rejected', ?, 'admin', datetime('now', '-21 days'), datetime('now', '-22 days'))
    `, [
      appealId,
      request.id,
      athlete.id,
      'First Appeal: My certificate request has been pending for a long time. I need this certificate urgently for my job application.',
      'First appeal rejected: Need additional documentation. Please provide proof of participation, photos of the event, and medal certificate.'
    ]);

    console.log('✅ Created first appeal and marked as REJECTED');
    console.log('   Appeal ID:', appealId);
    console.log('   For request:', request.competition_name);
    console.log('   Rejected 21 days ago');
    console.log('');

    // Verify
    const appeals = await db.all(
      `SELECT * FROM appeals WHERE athlete_id = ?`,
      [athlete.id]
    );

    console.log('📊 FINAL STATUS:');
    console.log('   Total appeals:', appeals.length);
    console.log('   Status: REJECTED (21 days ago)');
    console.log('');
    console.log('✅ Ready for second appeal testing!');
    console.log('');
    console.log('🚀 NEXT STEPS:');
    console.log('1. Login as ninad@hostingduty.com');
    console.log('2. Go to "My Appeals"');
    console.log('3. See first appeal as REJECTED');
    console.log('4. Click "Submit Second Appeal" button');
    console.log('5. Enter reason and submit');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

resetNinadAppeals().catch(console.error);
