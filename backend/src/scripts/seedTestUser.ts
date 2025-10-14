import { initializeDatabase } from '../config/database-sqlite';
import { seedTestData } from '../utils/seedTestData';
import { logger } from '../utils/logger';

async function main() {
  try {
    logger.info('Starting test data seeding...');

    // Initialize database connection
    await initializeDatabase();

    // Seed test data
    await seedTestData();

    logger.info('Test data seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed test data:', error);
    process.exit(1);
  }
}

main();
