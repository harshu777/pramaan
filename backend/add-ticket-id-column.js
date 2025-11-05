const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'certificates.db');
const db = new sqlite3.Database(dbPath);

console.log('Adding ticket_id column to complaints table...');

db.serialize(() => {
    // Check if column exists
    db.all("PRAGMA table_info(complaints)", (err, tableInfo) => {
        if (err) {
            console.error('❌ Error checking table info:', err);
            db.close();
            process.exit(1);
            return;
        }

        const hasTicketId = tableInfo.some(col => col.name === 'ticket_id');

        if (hasTicketId) {
            console.log('✓ ticket_id column already exists');
            db.close();
            return;
        }

        // Add the ticket_id column
        db.run('ALTER TABLE complaints ADD COLUMN ticket_id TEXT', (err) => {
            if (err) {
                console.error('❌ Error adding column:', err);
                db.close();
                process.exit(1);
                return;
            }

            console.log('✓ Added ticket_id column');

            // Update existing rows with generated ticket IDs
            db.all('SELECT id, created_at FROM complaints WHERE ticket_id IS NULL', (err, complaints) => {
                if (err) {
                    console.error('❌ Error fetching complaints:', err);
                    db.close();
                    process.exit(1);
                    return;
                }

                if (complaints.length === 0) {
                    console.log('✓ No existing complaints to update');
                    console.log('\n✅ Migration completed successfully!');
                    db.close();
                    return;
                }

                let updated = 0;
                const updateStmt = db.prepare('UPDATE complaints SET ticket_id = ? WHERE id = ?');

                complaints.forEach((complaint, index) => {
                    const date = new Date(complaint.created_at);
                    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
                    const ticketId = `TKT-${dateStr}-${String(index + 1).padStart(4, '0')}`;

                    updateStmt.run(ticketId, complaint.id, (err) => {
                        if (err) {
                            console.error(`❌ Error updating complaint ${complaint.id}:`, err);
                        } else {
                            console.log(`  Updated complaint ${complaint.id} with ticket ID: ${ticketId}`);
                        }

                        updated++;
                        if (updated === complaints.length) {
                            updateStmt.finalize();
                            console.log(`✓ Updated ${complaints.length} existing complaints with ticket IDs`);
                            console.log('✓ Note: ticket_id uniqueness enforced at application level');
                            console.log('\n✅ Migration completed successfully!');
                            db.close();
                        }
                    });
                });
            });
        });
    });
});
