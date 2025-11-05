const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'certificates.db');
const migrationPath = path.join(__dirname, 'src/migrations/add-documents-table.sql');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        process.exit(1);
    }
    console.log('📂 Connected to database:', dbPath);
});

const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

db.exec(migrationSQL, (err) => {
    if (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
    console.log('✅ Documents table created successfully!');

    // Verify table was created
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='documents'", (err, row) => {
        if (err) {
            console.error('❌ Error verifying table:', err.message);
        } else if (row) {
            console.log('✅ Verified: documents table exists');
        } else {
            console.log('⚠️  Warning: documents table not found');
        }
        db.close();
    });
});
