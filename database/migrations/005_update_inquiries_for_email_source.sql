-- Migration: 005_update_inquiries_for_email_source
-- Description: Add email source tracking columns to inquiries table
-- Requirements: 7.1, 7.2, 7.3, 7.4, 7.5

-- Add source tracking columns to inquiries table
ALTER TABLE inquiries 
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'platform_api' 
        CHECK (source_type IN ('platform_api', 'email', 'manual')),
    ADD COLUMN IF NOT EXISTS source_email_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_metadata JSONB;

-- Create index for source filtering
CREATE INDEX IF NOT EXISTS idx_inquiries_source_type ON inquiries(source_type);
CREATE INDEX IF NOT EXISTS idx_inquiries_source_email_id ON inquiries(source_email_id);

-- Add comments
COMMENT ON COLUMN inquiries.source_type IS 'Origin of the inquiry: platform_api (direct API), email (email integration), or manual (user created)';
COMMENT ON COLUMN inquiries.source_email_id IS 'Gmail message ID if inquiry originated from email';
COMMENT ON COLUMN inquiries.source_metadata IS 'Additional source-specific data (e.g., platform type, received date, parsing errors)';

-- Update existing inquiries to have source_type = 'platform_api'
UPDATE inquiries 
SET source_type = 'platform_api' 
WHERE source_type IS NULL;
