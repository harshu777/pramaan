const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function checkNinadStatus() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 NINAD ACCOUNT STATUS CHECK');
  console.log('='.repeat(70) + '\n');

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

    console.log('👤 ATHLETE:', athlete.full_name);
    console.log('   Email:', athlete.email);
    console.log('   ID:', athlete.id);
    console.log('');

    // Get requests
    const requests = await db.all(
      `SELECT qcr.*, ac.competition_name
       FROM quota_certificate_requests qcr
       LEFT JOIN athlete_competitions ac ON qcr.competition_record_id = ac.id
       WHERE qcr.athlete_id = ?
       ORDER BY qcr.requested_at DESC`,
      [athlete.id]
    );

    console.log('📋 CERTIFICATE REQUESTS:', requests.length);
    if (requests.length > 0) {
      requests.forEach((req, i) => {
        console.log(`   ${i+1}. ${req.competition_name || 'Unknown'}`);
        console.log(`      Status: ${req.status}`);
        console.log(`      Requested: ${req.requested_at}`);
      });
    }
    console.log('');

    // Get appeals
    const appeals = await db.all(
      `SELECT a.*,
              CAST((julianday('now') - julianday(a.resolved_at)) AS INTEGER) as days_since_resolution,
              qcr.competition_record_id,
              ac.competition_name
       FROM appeals a
       LEFT JOIN quota_certificate_requests qcr ON a.request_id = qcr.id
       LEFT JOIN athlete_competitions ac ON qcr.competition_record_id = ac.id
       WHERE a.athlete_id = ?
       ORDER BY a.created_at ASC`,
      [athlete.id]
    );

    console.log('⚖️  APPEALS:', appeals.length);
    if (appeals.length > 0) {
      appeals.forEach((appeal, i) => {
        console.log(`   ${i+1}. Appeal for: ${appeal.competition_name || 'Unknown'}`);
        console.log(`      Status: ${appeal.status.toUpperCase()}`);
        console.log(`      Created: ${appeal.created_at}`);
        if (appeal.resolved_at) {
          console.log(`      Resolved: ${appeal.resolved_at}`);
          console.log(`      Days since: ${appeal.days_since_resolution || 0} days`);
        }
        if (appeal.admin_response) {
          console.log(`      Admin: ${appeal.admin_response.substring(0, 60)}...`);
        }
      });
    }
    console.log('');

    // Check eligibility for second appeal
    const rejectedAppeal = appeals.find(a => a.status === 'rejected');
    if (rejectedAppeal) {
      const daysSince = rejectedAppeal.days_since_resolution || 0;
      console.log('🎯 SECOND APPEAL ELIGIBILITY:');
      if (daysSince >= 20) {
        console.log('   ✅ ELIGIBLE - Can submit second appeal now!');
        console.log(`   ✅ First appeal rejected ${daysSince} days ago`);
      } else {
        console.log(`   ⏳ NOT YET - Need to wait ${20 - daysSince} more days`);
      }
    } else if (appeals.length === 0) {
      console.log('🎯 STATUS: No appeals yet - can submit first appeal');
    } else {
      console.log('🎯 STATUS: First appeal pending or accepted');
    }
    console.log('');

    console.log('='.repeat(70));
    console.log('🚀 NEXT STEPS:');
    console.log('='.repeat(70));
    console.log('');

    if (appeals.length === 0) {
      console.log('1. Login as ninad@hostingduty.com');
      console.log('2. Go to "My Requests"');
      console.log('3. Click "Raise Appeal"');
      console.log('4. Submit first appeal');
    } else if (appeals.length === 1 && appeals[0].status === 'rejected') {
      const daysSince = appeals[0].days_since_resolution || 0;
      if (daysSince >= 20) {
        console.log('✅ READY TO TEST SECOND APPEAL!');
        console.log('');
        console.log('1. Login as ninad@hostingduty.com');
        console.log('2. Go to "My Appeals"');
        console.log('3. You should see:');
        console.log('   - First appeal marked as REJECTED');
        console.log('   - "Submit Second Appeal" button visible');
        console.log('4. Click "Submit Second Appeal"');
        console.log('5. Enter reason and submit');
        console.log('6. Verify both appeals show in "My Appeals"');
      } else {
        console.log('⏳ First appeal rejected too recently');
        console.log(`   Need to wait ${20 - daysSince} more days`);
        console.log('');
        console.log('To bypass: Run backdate-ninad-appeal.js');
      }
    } else if (appeals.length === 2) {
      console.log('✅ Both appeals exist!');
      console.log('');
      console.log('Appeal 1:', appeals[0].status);
      console.log('Appeal 2:', appeals[1].status);
    } else {
      console.log('Check appeal status above for next steps');
    }

    console.log('');
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await db.close();
  }
}

checkNinadStatus().catch(console.error);
