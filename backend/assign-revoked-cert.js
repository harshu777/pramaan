const sqlite3 = require('sqlite3');
const { v4: uuidv4 } = require('uuid');
const db = new sqlite3.Database('./certificates.db');

// Get the revoked certificate
db.get('SELECT * FROM certificates WHERE cert_hash = ?', ['98d72655287fbddf266845484bd5c86467f49318c95e5f837affff758a4939d9'], (err, cert) => {
  if (err || !cert) {
    console.error('Certificate not found');
    db.close();
    return;
  }

  console.log('Found revoked certificate:', cert.cert_hash.substring(0, 20) + '...');
  console.log('Subject:', cert.subject_name);
  console.log('Status:', cert.status);

  // Assign to Priya
  const assignmentId = uuidv4();
  const priyaId = 'ee866740-7b93-45ff-9dc4-e01c92da2d42';

  db.run('INSERT INTO certificate_assignments (id, certificate_id, athlete_id, assigned_by) VALUES (?, ?, ?, ?)',
    [assignmentId, cert.id, priyaId, 'admin-test'],
    function(err) {
      if (err) {
        console.error('Error assigning certificate:', err);
      } else {
        console.log('');
        console.log('✅ Successfully assigned revoked certificate to priya.sharma@example.com');
      }
      db.close();
    }
  );
});
