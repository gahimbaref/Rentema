-- Rollback Script for Email Integration Migrations
-- WARNING: This will delete all email integration data
-- Run this script only if you need to completely remove email integration

-- Drop tables in reverse order of dependencies
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS processed_emails CASCADE;
DROP TABLE IF EXISTS email_filter_configs CASCADE;
DROP TABLE IF EXISTS platform_patterns CASCADE;
DROP TABLE IF EXISTS email_connections CASCADE;

-- Remove columns from inquiries table
ALTER TABLE inquiries 
    DROP COLUMN IF EXISTS source_type,
    DROP COLUMN IF EXISTS source_email_id,
    DROP COLUMN IF EXISTS source_metadata;

-- Drop indexes
DROP INDEX IF EXISTS idx_email_connections_manager;
DROP INDEX IF EXISTS idx_email_connections_active;
DROP INDEX IF EXISTS idx_processed_emails_connection;
DROP INDEX IF EXISTS idx_processed_emails_email_id;
DROP INDEX IF EXISTS idx_processed_emails_status;
DROP INDEX IF EXISTS idx_processed_emails_platform;
DROP INDEX IF EXISTS idx_processed_emails_processed_at;
DROP INDEX IF EXISTS idx_inquiries_source_type;
DROP INDEX IF EXISTS idx_inquiries_source_email_id;
DROP INDEX IF EXISTS idx_notifications_manager;
DROP INDEX IF EXISTS idx_notifications_unread;
DROP INDEX IF EXISTS idx_notifications_connection;
DROP INDEX IF EXISTS idx_notifications_created_at;

-- Verify rollback
SELECT 'Rollback completed. Verifying...' AS status;

-- Check that email integration tables are gone
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'email_connections',
    'platform_patterns',
    'email_filter_configs',
    'processed_emails',
    'notifications'
);

-- If no rows returned, rollback was successful
SELECT CASE 
    WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'email_connections',
            'platform_patterns',
            'email_filter_configs',
            'processed_emails',
            'notifications'
        )
    ) THEN '✓ Rollback successful - all email integration tables removed'
    ELSE '✗ Rollback incomplete - some tables still exist'
END AS result;
