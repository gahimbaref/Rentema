-- Migration: 004_create_processed_emails
-- Description: Create processed_emails table for tracking email processing history
-- Requirements: 5.5, 7.5

-- Processed Emails table
CREATE TABLE IF NOT EXISTS processed_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,
    email_id VARCHAR(255) NOT NULL,
    "from" VARCHAR(255) NOT NULL,
    subject TEXT,
    received_date TIMESTAMP NOT NULL,
    platform_type VARCHAR(50),
    inquiry_id UUID REFERENCES inquiries(id) ON DELETE SET NULL,
    processing_status VARCHAR(50) NOT NULL CHECK (processing_status IN ('success', 'failed', 'skipped')),
    parsing_errors JSONB,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connection_id, email_id)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_processed_emails_connection ON processed_emails(connection_id);
CREATE INDEX IF NOT EXISTS idx_processed_emails_email_id ON processed_emails(email_id);
CREATE INDEX IF NOT EXISTS idx_processed_emails_status ON processed_emails(processing_status);
CREATE INDEX IF NOT EXISTS idx_processed_emails_platform ON processed_emails(platform_type);
CREATE INDEX IF NOT EXISTS idx_processed_emails_processed_at ON processed_emails(processed_at);

-- Add comments
COMMENT ON TABLE processed_emails IS 'Tracks all emails that have been processed to prevent duplicates and provide audit trail';
COMMENT ON COLUMN processed_emails.email_id IS 'Gmail message ID for deduplication';
COMMENT ON COLUMN processed_emails.processing_status IS 'success: inquiry created, failed: parsing error, skipped: filtered out';
COMMENT ON COLUMN processed_emails.parsing_errors IS 'JSON array of error messages if parsing failed';
