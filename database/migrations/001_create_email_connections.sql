-- Migration: 001_create_email_connections
-- Description: Create email_connections table for storing Gmail OAuth credentials
-- Requirements: 1.1, 1.2, 1.3, 1.4, 1.5

-- Email Connections table
CREATE TABLE IF NOT EXISTS email_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES property_managers(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL, -- encrypted with AES-256
    refresh_token TEXT NOT NULL, -- encrypted with AES-256
    token_expiry TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_poll_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manager_id, email_address)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_email_connections_manager ON email_connections(manager_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_active ON email_connections(is_active);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_email_connections_updated_at ON email_connections;
CREATE TRIGGER update_email_connections_updated_at 
    BEFORE UPDATE ON email_connections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comment
COMMENT ON TABLE email_connections IS 'Stores encrypted OAuth credentials for Gmail integration';
COMMENT ON COLUMN email_connections.access_token IS 'Encrypted OAuth access token for Gmail API';
COMMENT ON COLUMN email_connections.refresh_token IS 'Encrypted OAuth refresh token for token renewal';
COMMENT ON COLUMN email_connections.last_poll_time IS 'Timestamp of last email polling operation';
