-- Migration: 003_create_email_filter_configs
-- Description: Create email_filter_configs table for user-defined email filtering
-- Requirements: 6.1, 6.2, 6.3, 6.4, 6.5

-- Email Filter Configs table
CREATE TABLE IF NOT EXISTS email_filter_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,
    sender_whitelist JSONB DEFAULT '[]',
    subject_keywords JSONB DEFAULT '[]',
    exclude_senders JSONB DEFAULT '[]',
    exclude_subject_keywords JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connection_id)
);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_email_filter_configs_updated_at ON email_filter_configs;
CREATE TRIGGER update_email_filter_configs_updated_at 
    BEFORE UPDATE ON email_filter_configs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE email_filter_configs IS 'User-defined filters for controlling which emails are processed';
COMMENT ON COLUMN email_filter_configs.sender_whitelist IS 'JSON array of email addresses or domains to include';
COMMENT ON COLUMN email_filter_configs.subject_keywords IS 'JSON array of keywords that should appear in subject line';
COMMENT ON COLUMN email_filter_configs.exclude_senders IS 'JSON array of email addresses or domains to exclude';
COMMENT ON COLUMN email_filter_configs.exclude_subject_keywords IS 'JSON array of keywords that cause emails to be skipped';
