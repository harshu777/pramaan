-- Migration: Add Documents Table
-- Description: Table to store uploaded documents (PDFs, Word, Images, etc.)
-- Created: 2025-11-05

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    description TEXT,
    category TEXT,
    uploaded_by TEXT NOT NULL,
    uploader_name TEXT,
    uploader_role TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uploaded_by) REFERENCES issuers(id) ON DELETE CASCADE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_is_active ON documents(is_active);

-- Sample categories (optional)
-- Examples: 'Guidelines', 'Forms', 'Policies', 'Certificates', 'Reports', 'Other'
