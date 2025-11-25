-- Migration: 007_add_body_to_processed_emails
-- Description: Add body column to processed_emails table for email parsing
-- This allows the EmailParser to extract information from email content

-- Add body column
ALTER TABLE processed_emails 
ADD COLUMN IF NOT EXISTS body TEXT;

-- Add comment
COMMENT ON COLUMN processed_emails.body IS 'Email body content for parsing inquiry details';
