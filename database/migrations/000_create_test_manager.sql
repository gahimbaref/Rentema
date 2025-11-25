-- Create test manager for development
-- This manager is used when authenticating with dev-token-* in development mode

INSERT INTO property_managers (id, email, name, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'dev@rentema.local',
    'Development Manager',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;
