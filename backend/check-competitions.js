const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function checkCompetitions() {
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

    console.log(`\n✅ Athlete: ${athlete.full_name} (${athlete.email})\n`);

    // Get all competition records
    const competitions = await db.all(
      'SELECT * FROM athlete_competitions WHERE athlete_id = ?',
      [athlete.id]
    );

    console.log(`Found ${competitions.length} competition records:\n`);

    for (const comp of competitions) {
      console.log(`📋 ${comp.competition_name}`);
      console.log(`   Game: ${comp.game_name}`);
      console.log(`   Level: ${comp.competition_level}`);
      console.log(`   Certificate No: ${comp.certificate_no}`);
      console.log(`   Certificate Issued: ${comp.certificate_issued ? 'Yes' : 'No'}`);
      console.log(`   Certificate Requested: ${comp.certificate_requested ? 'Yes' : 'No'}`);
      console.log(``);
    }

    // Get certificate requests
    const requests = await db.all(
      'SELECT * FROM quota_certificate_requests WHERE athlete_id = ?',
      [athlete.id]
    );

    console.log(`Found ${requests.length} certificate requests:\n`);

    for (const req of requests) {
      console.log(`📝 Request ID: ${req.id}`);
      console.log(`   Status: ${req.status}`);
      console.log(`   Requested at: ${req.requested_at}`);
      console.log(`   Certificate Hash: ${req.certificate_hash || 'Not generated'}`);
      console.log(``);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

checkCompetitions().catch(console.error);
