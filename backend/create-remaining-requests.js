const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

async function createRemainingRequests() {
  const db = await open({
    filename: path.join(__dirname, 'certificates.db'),
    driver: sqlite3.Database
  });

  try {
    // Get athlete
    const athlete = await db.get('SELECT * FROM athletes WHERE email = ?', ['ninad@hostingduty.com']);

    if (!athlete) {
      console.log('No athlete found');
      return;
    }

    // Get competitions without certificate issued
    const competitions = await db.all(
      'SELECT * FROM athlete_competitions WHERE athlete_id = ? AND certificate_issued = 0',
      [athlete.id]
    );

    console.log(`\n📋 Creating certificate requests for ${competitions.length} competitions...\n`);

    for (const comp of competitions) {
      const requestId = uuidv4();

      await db.run(`
        INSERT INTO quota_certificate_requests (
          id, athlete_id, competition_record_id, unique_id, aadhar_number,
          status, requested_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `, [requestId, athlete.id, comp.id, comp.unique_id, comp.aadhar_number, 'pending']);

      console.log(`✅ Created request for: ${comp.competition_name}`);
      console.log(`   Request ID: ${requestId}`);
      console.log(`   Game: ${comp.game_name}`);
      console.log(`   Level: ${comp.competition_level}\n`);
    }

    console.log('✅ All certificate requests created successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

createRemainingRequests().catch(console.error);
