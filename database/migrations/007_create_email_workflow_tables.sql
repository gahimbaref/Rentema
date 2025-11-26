-- Migration 007: Create Email Workflow Tables
-- Creates tables for email-based pre-qualification and scheduling workflow

-- Questionnaire Tokens Table
CREATE TABLE IF NOT EXISTS questionnaire_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_questionnaire_tokens_inquiry ON questionnaire_tokens(inquiry_id);
CREATE INDEX idx_questionnaire_tokens_token ON questionnaire_tokens(token);
CREATE INDEX idx_questionnaire_tokens_expires ON questionnaire_tokens(expires_at);

-- Sent Email Logs Table
CREATE TABLE IF NOT EXISTS sent_email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES email_connections(id) ON DELETE SET NULL,
  email_type VARCHAR(50) NOT NULL,
  to_address VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  gmail_message_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'sent',
  error TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sent_email_logs_inquiry ON sent_email_logs(inquiry_id);
CREATE INDEX idx_sent_email_logs_type ON sent_email_logs(email_type);
CREATE INDEX idx_sent_email_logs_sent_at ON sent_email_logs(sent_at);

-- Booking Tokens Table
CREATE TABLE IF NOT EXISTS booking_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  slot_start_time TIMESTAMP NOT NULL,
  slot_end_time TIMESTAMP NOT NULL,
  appointment_type VARCHAR(50) NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_booking_tokens_inquiry ON booking_tokens(inquiry_id);
CREATE INDEX idx_booking_tokens_token ON booking_tokens(token);
CREATE INDEX idx_booking_tokens_slot_start ON booking_tokens(slot_start_time);
CREATE INDEX idx_booking_tokens_expires ON booking_tokens(expires_at);

-- Email Templates Table
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES property_managers(id) ON DELETE CASCADE,
  template_type VARCHAR(50) NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  plain_text_body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_templates_manager ON email_templates(manager_id);
CREATE INDEX idx_email_templates_type ON email_templates(template_type);
CREATE UNIQUE INDEX idx_email_templates_manager_type_default 
  ON email_templates(manager_id, template_type) 
  WHERE is_default = TRUE;
