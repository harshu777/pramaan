const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function backdateAppeal() {
  const db = await open({
    filename: path.join(__dirname, 'certificates.db'),
    driver: sqlite3.Database
  });

  try {
    const result = await db.run(`
      UPDATE appeals
      SET resolved_at = datetime('now', '-21 days')
      WHERE athlete_id = '2e0cf523-acfc-4a2c-8002-062d566be0e4'
        AND status = 'rejected'
    `);

    console.log('✅ Backdated appeal rejection by 21 days');
    console.log('   Rows updated:', result.changes);

    // Verify
    const appeal = await db.get(`
      SELECT id, status, created_at, resolved_at,
             CAST((julianday('now') - julianday(resolved_at)) AS INTEGER) as days_since_rejection
      FROM appeals
      WHERE athlete_id = '2e0cf523-acfc-4a2c-8002-062d566be0e4'
        AND status = 'rejected'
    `);

    if (appeal) {
      console.log('\n📋 Appeal Details:');
      console.log('   ID:', appeal.id);
      console.log('   Status:', appeal.status);
      console.log('   Created:', appeal.created_at);
      console.log('   Resolved:', appeal.resolved_at);
      console.log('   Days since rejection:', appeal.days_since_rejection);
      console.log('');
      console.log('✅ Second appeal can now be submitted immediately!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

backdateAppeal().catch(console.error);
