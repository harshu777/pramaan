/**
 * Script to normalize all DOB dates in athlete_competitions table
 * Run with: npx ts-node scripts/normalize-dates.ts
 */

import { query, initializeDatabase } from '../src/config/database-sqlite';
import { normalizeDateFormat } from '../src/utils/dateUtils';

async function normalizeDates() {
  console.log('Initializing database...');
  await initializeDatabase();
  console.log('Database initialized.\n');

  console.log('Starting date normalization...\n');

  // Get all records with DOB
  const result = await query('SELECT id, full_name, dob FROM athlete_competitions WHERE dob IS NOT NULL AND dob != ""');

  console.log(`Found ${result.rows.length} records with DOB to process.\n`);

  let updated = 0;
  let alreadyNormalized = 0;
  let errors = 0;

  for (const row of result.rows) {
    try {
      const originalDob = row.dob;
      const normalizedDob = normalizeDateFormat(originalDob);

      if (originalDob !== normalizedDob) {
        await query('UPDATE athlete_competitions SET dob = ? WHERE id = ?', [normalizedDob, row.id]);
        console.log(`Updated: ${row.full_name} - "${originalDob}" -> "${normalizedDob}"`);
        updated++;
      } else {
        alreadyNormalized++;
      }
    } catch (error) {
      console.error(`Error processing ${row.full_name} (${row.dob}):`, error);
      errors++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total records processed: ${result.rows.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Already normalized: ${alreadyNormalized}`);
  console.log(`Errors: ${errors}`);
  console.log('\nDate normalization complete!');

  process.exit(0);
}

normalizeDates().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
