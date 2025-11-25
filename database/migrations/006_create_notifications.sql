-- Migration: 006_create_notifications
-- Description: Create notifications table for email integration alerts
-- Requirements: 2.5

-- Notifications table for email integration alerts
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    manager_id UUID NOT NULL REFERENCES property_managers(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES email_connections(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_notifications_manager ON notifications(manager_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(manager_id, is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_connection ON notifications(connection_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Add comments
COMMENT ON TABLE notifications IS 'System notifications for email integration events (token expiration, polling failures, etc.)';
COMMENT ON COLUMN notifications.type IS 'Notification type (e.g., token_refresh_failed, polling_error, high_failure_rate)';
COMMENT ON COLUMN notifications.severity IS 'Severity level: info (informational), warning (needs attention), error (requires action)';
COMMENT ON COLUMN notifications.metadata IS 'Additional context data specific to the notification type';
