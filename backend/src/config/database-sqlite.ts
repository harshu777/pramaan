import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { logger } from '../utils/logger';
import path from 'path';
// Force restart

let db: any;

export async function initializeDatabase(): Promise<void> {
  try {
    db = await open({
      filename: path.join(__dirname, '../../certificates.db'),
      driver: sqlite3.Database
    });

    await db.exec(`
      CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        cert_hash TEXT UNIQUE NOT NULL,
        ipfs_cid TEXT NOT NULL,
        issuer_did TEXT,
        issuer_name TEXT,
        subject_did TEXT,
        subject_name TEXT,
        subject_email TEXT,
        certificate_type TEXT,
        issued_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiry_date DATETIME,
        status TEXT DEFAULT 'active',
        blockchain_tx_hash TEXT,
        blockchain_block_number INTEGER,
        metadata TEXT,
        digital_signature TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        search_vector TEXT
      );

      CREATE TABLE IF NOT EXISTS issuers (
        id TEXT PRIMARY KEY,
        did TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        organization TEXT,
        email TEXT,
        password_hash TEXT,
        public_key TEXT,
        wallet_address TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS athletes (
        id TEXT PRIMARY KEY,
        unique_id TEXT UNIQUE,
        aadhar_number TEXT UNIQUE,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone_number TEXT,
        dob TEXT,
        password_hash TEXT NOT NULL,
        district TEXT,
        state TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS certificate_assignments (
        id TEXT PRIMARY KEY,
        certificate_id TEXT NOT NULL,
        athlete_id TEXT NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        assigned_by TEXT,
        FOREIGN KEY (certificate_id) REFERENCES certificates(id),
        FOREIGN KEY (athlete_id) REFERENCES athletes(id),
        UNIQUE(certificate_id, athlete_id)
      );

      CREATE TABLE IF NOT EXISTS revocation_logs (
        id TEXT PRIMARY KEY,
        certificate_id TEXT,
        revoked_by TEXT NOT NULL,
        revocation_reason TEXT,
        revoked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        blockchain_tx_hash TEXT,
        FOREIGN KEY (certificate_id) REFERENCES certificates(id)
      );

      CREATE TABLE IF NOT EXISTS verification_logs (
        id TEXT PRIMARY KEY,
        certificate_id TEXT,
        verified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        verifier_ip TEXT,
        verification_result BOOLEAN,
        user_agent TEXT,
        FOREIGN KEY (certificate_id) REFERENCES certificates(id)
      );

      CREATE TABLE IF NOT EXISTS complaints (
        id TEXT PRIMARY KEY,
        cert_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        resolution TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        resolved_by TEXT,
        FOREIGN KEY (cert_hash) REFERENCES certificates(cert_hash)
      );

      CREATE TABLE IF NOT EXISTS athlete_competitions (
        id TEXT PRIMARY KEY,
        athlete_id TEXT,
        unique_id TEXT,
        aadhar_number TEXT,
        competition_name TEXT NOT NULL,
        competition_type TEXT NOT NULL,
        event_name TEXT,
        position INTEGER,
        medal_type TEXT,
        competition_date TEXT,
        competition_level TEXT,
        organizing_body TEXT,
        location TEXT,
        certificate_issued BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (athlete_id) REFERENCES athletes(id)
      );

      CREATE TABLE IF NOT EXISTS quota_certificate_requests (
        id TEXT PRIMARY KEY,
        athlete_id TEXT NOT NULL,
        unique_id TEXT NOT NULL,
        aadhar_number TEXT NOT NULL,
        selected_records TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        certificate_id TEXT,
        admin_notes TEXT,
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed_at DATETIME,
        processed_by TEXT,
        FOREIGN KEY (athlete_id) REFERENCES athletes(id),
        FOREIGN KEY (certificate_id) REFERENCES certificates(id)
      );

      CREATE TABLE IF NOT EXISTS certificate_appeals (
        id TEXT PRIMARY KEY,
        request_id TEXT,
        athlete_id TEXT NOT NULL,
        appeal_type TEXT NOT NULL,
        appeal_level INTEGER NOT NULL,
        reason TEXT NOT NULL,
        supporting_documents TEXT,
        status TEXT DEFAULT 'pending',
        resolution TEXT,
        resolved_by TEXT,
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (request_id) REFERENCES quota_certificate_requests(id),
        FOREIGN KEY (athlete_id) REFERENCES athletes(id)
      );

      CREATE INDEX IF NOT EXISTS idx_cert_hash ON certificates(cert_hash);
      CREATE INDEX IF NOT EXISTS idx_issuer_did ON certificates(issuer_did);
      CREATE INDEX IF NOT EXISTS idx_subject_name ON certificates(subject_name);
      CREATE INDEX IF NOT EXISTS idx_athlete_email ON athletes(email);
      CREATE INDEX IF NOT EXISTS idx_athlete_phone ON athletes(phone_number);
      CREATE INDEX IF NOT EXISTS idx_athlete_unique_id ON athletes(unique_id);
      CREATE INDEX IF NOT EXISTS idx_athlete_aadhar ON athletes(aadhar_number);
      CREATE INDEX IF NOT EXISTS idx_certificate_assignments_athlete ON certificate_assignments(athlete_id);
      CREATE INDEX IF NOT EXISTS idx_certificate_assignments_cert ON certificate_assignments(certificate_id);
      CREATE INDEX IF NOT EXISTS idx_complaints_cert_hash ON complaints(cert_hash);
      CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
      CREATE INDEX IF NOT EXISTS idx_competitions_athlete ON athlete_competitions(athlete_id);
      CREATE INDEX IF NOT EXISTS idx_competitions_unique_id ON athlete_competitions(unique_id);
      CREATE INDEX IF NOT EXISTS idx_competitions_aadhar ON athlete_competitions(aadhar_number);
      CREATE INDEX IF NOT EXISTS idx_quota_requests_athlete ON quota_certificate_requests(athlete_id);
      CREATE INDEX IF NOT EXISTS idx_quota_requests_status ON quota_certificate_requests(status);
      CREATE INDEX IF NOT EXISTS idx_appeals_athlete ON certificate_appeals(athlete_id);
      CREATE INDEX IF NOT EXISTS idx_appeals_request ON certificate_appeals(request_id);
      CREATE INDEX IF NOT EXISTS idx_appeals_status ON certificate_appeals(status);
      CREATE INDEX IF NOT EXISTS idx_appeals_level ON certificate_appeals(appeal_level);
    `);

    // Insert default issuer with hashed password
    const bcrypt = require('bcrypt');
    const defaultPassword = 'testpass123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    await db.run(`
      INSERT OR IGNORE INTO issuers (id, did, name, organization, email, password_hash, wallet_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      '123e4567-e89b-12d3-a456-426614174000',
      'did:example:123456789',
      'Test University',
      'Education Department',
      'admin@testuniversity.edu',
      passwordHash,
      '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
    ]);

    logger.info('SQLite database initialized');

    // Check if we should seed competition data
    if (process.env.SEED_COMPETITION_DATA === 'true') {
      const { seedCompetitionData } = await import('../utils/seedCompetitionData');
      await seedCompetitionData();
    }
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

export async function query(text: string, params?: any[]): Promise<any> {
  try {
    // Normalize the query text to check for SELECT statements
    const normalizedText = text.trim().toLowerCase();

    if (normalizedText.startsWith('select')) {
      const rows = await db.all(text, params);
      logger.debug(`SELECT query returned ${rows?.length || 0} rows`);
      return { rows };
    } else {
      const result = await db.run(text, params);
      return { rows: [{ id: result.lastID }], rowCount: result.changes };
    }
  } catch (error) {
    logger.error('Database query error:', error);
    logger.error('Query text:', text);
    logger.error('Params:', params);
    throw error;
  }
}

export async function getClient() {
  return {
    query: async (text: string, params?: any[]) => query(text, params),
    release: () => {}
  };
}

export default db;