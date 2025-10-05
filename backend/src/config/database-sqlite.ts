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

      CREATE INDEX IF NOT EXISTS idx_cert_hash ON certificates(cert_hash);
      CREATE INDEX IF NOT EXISTS idx_issuer_did ON certificates(issuer_did);
      CREATE INDEX IF NOT EXISTS idx_subject_name ON certificates(subject_name);
      CREATE INDEX IF NOT EXISTS idx_athlete_email ON athletes(email);
      CREATE INDEX IF NOT EXISTS idx_athlete_phone ON athletes(phone_number);
      CREATE INDEX IF NOT EXISTS idx_certificate_assignments_athlete ON certificate_assignments(athlete_id);
      CREATE INDEX IF NOT EXISTS idx_certificate_assignments_cert ON certificate_assignments(certificate_id);
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