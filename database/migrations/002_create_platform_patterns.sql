-- Migration: 002_create_platform_patterns
-- Description: Create platform_patterns table for email platform identification
-- Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

-- Platform Patterns table
CREATE TABLE IF NOT EXISTS platform_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform_type VARCHAR(50) NOT NULL,
    sender_pattern TEXT NOT NULL,
    subject_pattern TEXT,
    body_patterns JSONB,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_platform_patterns_updated_at ON platform_patterns;
CREATE TRIGGER update_platform_patterns_updated_at 
    BEFORE UPDATE ON platform_patterns 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Seed default platform patterns
INSERT INTO platform_patterns (platform_type, sender_pattern, subject_pattern, priority, is_active)
VALUES 
    ('facebook', '@facebookmail\.com', 'marketplace|inquiry|message', 1, TRUE),
    ('zillow', '@zillow\.com', 'inquiry|rental|contact', 1, TRUE),
    ('craigslist', '@craigslist\.org', 'reply|inquiry', 1, TRUE),
    ('turbotenant', '@turbotenant\.com', 'application|inquiry|message', 1, TRUE),
    ('direct', '.*', 'rent|rental|apartment|property|lease|interested|inquiry|available', 10, TRUE)
ON CONFLICT DO NOTHING;

-- Add comments
COMMENT ON TABLE platform_patterns IS 'Regex patterns for identifying rental inquiry emails from different platforms';
COMMENT ON COLUMN platform_patterns.sender_pattern IS 'Regex pattern to match email sender address';
COMMENT ON COLUMN platform_patterns.subject_pattern IS 'Regex pattern to match email subject line';
COMMENT ON COLUMN platform_patterns.body_patterns IS 'JSON object with field names and regex patterns for extracting data';
COMMENT ON COLUMN platform_patterns.priority IS 'Higher priority patterns are checked first (higher number = higher priority)';
