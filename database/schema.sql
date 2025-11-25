-- Rentema Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Property Managers table
CREATE TABLE IF NOT EXISTS property_managers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES property_managers(id),
    address TEXT NOT NULL,
    rent_amount DECIMAL(10, 2) NOT NULL,
    bedrooms INTEGER NOT NULL,
    bathrooms DECIMAL(3, 1) NOT NULL,
    availability_date DATE NOT NULL,
    is_test_mode BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform Connections table
CREATE TABLE IF NOT EXISTS platform_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES property_managers(id),
    platform_type VARCHAR(50) NOT NULL,
    credentials JSONB NOT NULL, -- encrypted credentials
    is_active BOOLEAN DEFAULT TRUE,
    last_verified TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email Connections table
CREATE TABLE IF NOT EXISTS email_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES property_managers(id),
    email_address VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL, -- encrypted
    refresh_token TEXT NOT NULL, -- encrypted
    token_expiry TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_poll_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manager_id, email_address)
);

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

-- Email Filter Configs table
CREATE TABLE IF NOT EXISTS email_filter_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES email_connections(id),
    sender_whitelist JSONB DEFAULT '[]',
    subject_keywords JSONB DEFAULT '[]',
    exclude_senders JSONB DEFAULT '[]',
    exclude_subject_keywords JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connection_id)
);

-- Questions table
CREATE TABLE IF NOT EXISTS questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id),
    text TEXT NOT NULL,
    response_type VARCHAR(50) NOT NULL,
    options JSONB,
    order_index INTEGER NOT NULL,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Qualification Criteria table
CREATE TABLE IF NOT EXISTS qualification_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id),
    question_id UUID NOT NULL REFERENCES questions(id),
    operator VARCHAR(50) NOT NULL,
    expected_value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inquiries table
CREATE TABLE IF NOT EXISTS inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id),
    platform_id UUID NOT NULL REFERENCES platform_connections(id),
    external_inquiry_id VARCHAR(255) NOT NULL,
    prospective_tenant_id VARCHAR(255) NOT NULL,
    prospective_tenant_name VARCHAR(255),
    status VARCHAR(50) NOT NULL,
    qualification_result JSONB,
    question_snapshot JSONB, -- stores questions at time of inquiry
    source_type VARCHAR(50) DEFAULT 'platform_api',
    source_email_id VARCHAR(255),
    source_metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform_id, external_inquiry_id)
);

-- Processed Emails table (moved after inquiries to resolve foreign key dependency)
CREATE TABLE IF NOT EXISTS processed_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connection_id UUID NOT NULL REFERENCES email_connections(id),
    email_id VARCHAR(255) NOT NULL,
    "from" VARCHAR(255) NOT NULL,
    subject TEXT,
    body TEXT,
    received_date TIMESTAMP NOT NULL,
    platform_type VARCHAR(50),
    inquiry_id UUID REFERENCES inquiries(id),
    processing_status VARCHAR(50) NOT NULL,
    parsing_errors JSONB,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(connection_id, email_id)
);

-- Responses table
CREATE TABLE IF NOT EXISTS responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inquiry_id UUID NOT NULL REFERENCES inquiries(id),
    question_id UUID NOT NULL REFERENCES questions(id),
    value JSONB NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inquiry_id UUID NOT NULL REFERENCES inquiries(id),
    direction VARCHAR(20) NOT NULL, -- 'inbound' or 'outbound'
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'sent',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Message Templates table
CREATE TABLE IF NOT EXISTS message_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES property_managers(id),
    template_type VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    required_variables JSONB NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manager_id, template_type)
);

-- Availability Schedules table
CREATE TABLE IF NOT EXISTS availability_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES property_managers(id),
    schedule_type VARCHAR(50) NOT NULL, -- 'video_call' or 'tour'
    recurring_weekly JSONB NOT NULL,
    blocked_dates JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manager_id, schedule_type)
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inquiry_id UUID NOT NULL REFERENCES inquiries(id),
    appointment_type VARCHAR(50) NOT NULL, -- 'video_call' or 'tour'
    scheduled_time TIMESTAMP NOT NULL,
    duration INTEGER NOT NULL, -- in minutes
    zoom_link TEXT,
    property_address TEXT,
    status VARCHAR(50) DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inquiry Notes table
CREATE TABLE IF NOT EXISTS inquiry_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inquiry_id UUID NOT NULL REFERENCES inquiries(id),
    note TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES property_managers(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_properties_manager ON properties(manager_id);
CREATE INDEX IF NOT EXISTS idx_properties_archived ON properties(is_archived);
CREATE INDEX IF NOT EXISTS idx_inquiries_property ON inquiries(property_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_inquiries_source_email_id ON inquiries(source_email_id);
CREATE INDEX IF NOT EXISTS idx_messages_inquiry ON messages(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_responses_inquiry ON responses(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_appointments_inquiry ON appointments(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_time ON appointments(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_questions_property ON questions(property_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_manager ON email_connections(manager_id);
CREATE INDEX IF NOT EXISTS idx_email_connections_active ON email_connections(is_active);
CREATE INDEX IF NOT EXISTS idx_processed_emails_connection ON processed_emails(connection_id);
CREATE INDEX IF NOT EXISTS idx_processed_emails_email_id ON processed_emails(email_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_property_managers_updated_at ON property_managers;
CREATE TRIGGER update_property_managers_updated_at BEFORE UPDATE ON property_managers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_platform_connections_updated_at ON platform_connections;
CREATE TRIGGER update_platform_connections_updated_at BEFORE UPDATE ON platform_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inquiries_updated_at ON inquiries;
CREATE TRIGGER update_inquiries_updated_at BEFORE UPDATE ON inquiries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_message_templates_updated_at ON message_templates;
CREATE TRIGGER update_message_templates_updated_at BEFORE UPDATE ON message_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_availability_schedules_updated_at ON availability_schedules;
CREATE TRIGGER update_availability_schedules_updated_at BEFORE UPDATE ON availability_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_connections_updated_at ON email_connections;
CREATE TRIGGER update_email_connections_updated_at BEFORE UPDATE ON email_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_platform_patterns_updated_at ON platform_patterns;
CREATE TRIGGER update_platform_patterns_updated_at BEFORE UPDATE ON platform_patterns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_filter_configs_updated_at ON email_filter_configs;
CREATE TRIGGER update_email_filter_configs_updated_at BEFORE UPDATE ON email_filter_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default platform patterns
INSERT INTO platform_patterns (platform_type, sender_pattern, subject_pattern, priority, is_active)
VALUES 
    ('facebook', '@facebookmail\.com$', 'marketplace|inquiry|message', 1, TRUE),
    ('zillow', '@zillow\.com$', 'inquiry|rental|contact', 1, TRUE),
    ('craigslist', '@craigslist\.org$', 'reply|inquiry', 1, TRUE),
    ('turbotenant', '@turbotenant\.com$', 'application|inquiry|message', 1, TRUE)
ON CONFLICT DO NOTHING;

-- Notifications table for email integration alerts
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manager_id UUID NOT NULL REFERENCES property_managers(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES email_connections(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_manager ON notifications(manager_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(manager_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_connection ON notifications(connection_id);

-- Insert test manager for development mode
-- This manager is used when authenticating with dev-token-* in development
INSERT INTO property_managers (id, email, name, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'dev@rentema.local',
    'Development Manager',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;
