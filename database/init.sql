-- Create certificate management database schema

-- Enable UUID and full-text search extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum for certificate status
CREATE TYPE cert_status AS ENUM ('active', 'revoked', 'expired');

-- Create main certificates table
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cert_hash VARCHAR(66) UNIQUE NOT NULL,
    ipfs_cid VARCHAR(255) NOT NULL,
    issuer_did VARCHAR(255) NOT NULL,
    issuer_name VARCHAR(255) NOT NULL,
    subject_did VARCHAR(255),
    subject_name VARCHAR(255) NOT NULL,
    subject_email VARCHAR(255),
    certificate_type VARCHAR(100) NOT NULL,
    issued_date TIMESTAMP NOT NULL DEFAULT NOW(),
    expiry_date TIMESTAMP,
    status cert_status DEFAULT 'active',
    blockchain_tx_hash VARCHAR(66),
    blockchain_block_number INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Full-text search column
    search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(subject_name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(issuer_name, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(certificate_type, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(subject_email, '')), 'D')
    ) STORED
);

-- Create indexes for better performance
CREATE INDEX idx_certificates_hash ON certificates(cert_hash);
CREATE INDEX idx_certificates_ipfs_cid ON certificates(ipfs_cid);
CREATE INDEX idx_certificates_issuer_did ON certificates(issuer_did);
CREATE INDEX idx_certificates_subject_did ON certificates(subject_did);
CREATE INDEX idx_certificates_status ON certificates(status);
CREATE INDEX idx_certificates_issued_date ON certificates(issued_date DESC);
CREATE INDEX idx_certificates_search ON certificates USING GIN(search_vector);

-- Create revocation logs table
CREATE TABLE revocation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,
    revoked_by VARCHAR(255) NOT NULL,
    revocation_reason TEXT,
    revoked_at TIMESTAMP DEFAULT NOW(),
    blockchain_tx_hash VARCHAR(66)
);

-- Create verification logs table
CREATE TABLE verification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    certificate_id UUID REFERENCES certificates(id) ON DELETE CASCADE,
    verified_at TIMESTAMP DEFAULT NOW(),
    verifier_ip VARCHAR(45),
    verification_result BOOLEAN,
    user_agent TEXT
);

-- Create issuers table for authorized issuers
CREATE TABLE issuers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    did VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    email VARCHAR(255),
    public_key TEXT,
    wallet_address VARCHAR(42),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_certificates_updated_at BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_issuers_updated_at BEFORE UPDATE ON issuers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create sample issuer for testing
INSERT INTO issuers (did, name, organization, email, wallet_address)
VALUES (
    'did:example:123456789',
    'Test University',
    'Education Department',
    'admin@testuniversity.edu',
    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'
);

-- Grant appropriate permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO certadmin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO certadmin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO certadmin;