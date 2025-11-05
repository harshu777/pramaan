const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('./certificates.db');

// Get Priya Sharma's ID and certificates
db.get('SELECT id, full_name, email FROM athletes WHERE email = ?', ['priya.sharma@example.com'], (err, athlete) => {
  if (err || !athlete) {
    console.error('Athlete not found');
    db.close();
    return;
  }

  console.log('Athlete:', athlete.full_name, '(', athlete.email, ')');
  console.log('Athlete ID:', athlete.id);
  console.log('');

  // Get assigned certificates
  db.all(`
    SELECT c.cert_hash, c.subject_name, c.certificate_type, c.status, c.issued_date, ca.assigned_at
    FROM certificates c
    INNER JOIN certificate_assignments ca ON c.id = ca.certificate_id
    WHERE ca.athlete_id = ?
    ORDER BY ca.assigned_at DESC
  `, [athlete.id], (err, certs) => {
    if (err) {
      console.error('Error:', err);
    } else if (certs.length === 0) {
      console.log('❌ NO CERTIFICATES ASSIGNED to this athlete!');
      console.log('');
      console.log('Let me check all certificates and assignments...');

      // Show all certificates
      db.all('SELECT cert_hash, subject_name, status FROM certificates LIMIT 5', (err, allCerts) => {
        if (err) {
          console.error('Error getting certs:', err);
        } else {
          console.log('\nAll Certificates in DB:');
          allCerts.forEach(c => {
            console.log(`  - ${c.cert_hash.substring(0, 16)}... | ${c.status} | ${c.subject_name}`);
          });
        }

        // Show all assignments
        db.all(`SELECT ca.*, a.email FROM certificate_assignments ca JOIN athletes a ON ca.athlete_id = a.id LIMIT 5`, (err, assigns) => {
          if (err) {
            console.error('Error getting assignments:', err);
          } else {
            console.log('\nAll Certificate Assignments:');
            assigns.forEach(a => {
              console.log(`  - ${a.certificate_id.substring(0, 16)}... assigned to ${a.email}`);
            });
          }
          db.close();
        });
      });
    } else {
      console.log('Assigned Certificates:');
      certs.forEach(cert => {
        const statusIcon = cert.status === 'revoked' ? '🔴' : cert.status === 'active' ? '🟢' : '🟡';
        console.log(`${statusIcon} ${cert.cert_hash.substring(0, 16)}... | Status: ${cert.status.toUpperCase()} | ${cert.subject_name}`);
      });
      db.close();
    }
  });
});
