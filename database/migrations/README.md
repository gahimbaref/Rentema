# Database Migrations

This directory contains incremental database migration scripts for the Rentema email integration feature.

## Migration Files

Migrations are numbered sequentially and should be run in order:

1. **001_create_email_connections.sql** - Email OAuth connection storage
2. **002_create_platform_patterns.sql** - Platform identification patterns
3. **003_create_email_filter_configs.sql** - User-defined email filters
4. **004_create_processed_emails.sql** - Email processing history
5. **005_update_inquiries_for_email_source.sql** - Email source tracking
6. **006_create_notifications.sql** - Email integration notifications

## Running Migrations

### Option 1: Run All Migrations (Recommended for new installations)

Use the complete schema file which includes all tables:

```bash
psql -U postgres -d rentema -f database/schema.sql
```

### Option 2: Run Individual Migrations

For existing installations or incremental updates:

```bash
# Run migrations in order
psql -U postgres -d rentema -f database/migrations/001_create_email_connections.sql
psql -U postgres -d rentema -f database/migrations/002_create_platform_patterns.sql
psql -U postgres -d rentema -f database/migrations/003_create_email_filter_configs.sql
psql -U postgres -d rentema -f database/migrations/004_create_processed_emails.sql
psql -U postgres -d rentema -f database/migrations/005_update_inquiries_for_email_source.sql
psql -U postgres -d rentema -f database/migrations/006_create_notifications.sql
```

### Option 3: Use the Migration Script

Run all migrations programmatically:

```bash
npm run migrate
```

Or using the TypeScript migration runner:

```typescript
import { runEmailIntegrationMigrations } from './database/migrations/runner';
import { pool } from './database/connection';

await runEmailIntegrationMigrations(pool);
```

## Migration Details

### 001_create_email_connections.sql

Creates the `email_connections` table for storing Gmail OAuth credentials.

**Tables Created:**
- `email_connections`

**Indexes Created:**
- `idx_email_connections_manager`
- `idx_email_connections_active`

**Requirements Addressed:** 1.1, 1.2, 1.3, 1.4, 1.5

### 002_create_platform_patterns.sql

Creates the `platform_patterns` table and seeds default patterns for Facebook, Zillow, Craigslist, and TurboTenant.

**Tables Created:**
- `platform_patterns`

**Default Data:**
- Facebook Marketplace pattern
- Zillow pattern
- Craigslist pattern
- TurboTenant pattern

**Requirements Addressed:** 3.1, 3.2, 3.3, 3.4, 3.5, 3.6

### 003_create_email_filter_configs.sql

Creates the `email_filter_configs` table for user-defined email filtering rules.

**Tables Created:**
- `email_filter_configs`

**Requirements Addressed:** 6.1, 6.2, 6.3, 6.4, 6.5

### 004_create_processed_emails.sql

Creates the `processed_emails` table for tracking email processing history and preventing duplicates.

**Tables Created:**
- `processed_emails`

**Indexes Created:**
- `idx_processed_emails_connection`
- `idx_processed_emails_email_id`
- `idx_processed_emails_status`
- `idx_processed_emails_platform`
- `idx_processed_emails_processed_at`

**Requirements Addressed:** 5.5, 7.5

### 005_update_inquiries_for_email_source.sql

Adds email source tracking columns to the existing `inquiries` table.

**Columns Added:**
- `source_type` - Origin of inquiry (platform_api, email, manual)
- `source_email_id` - Gmail message ID
- `source_metadata` - Additional source data

**Indexes Created:**
- `idx_inquiries_source_type`
- `idx_inquiries_source_email_id`

**Requirements Addressed:** 7.1, 7.2, 7.3, 7.4, 7.5

### 006_create_notifications.sql

Creates the `notifications` table for email integration alerts and system notifications.

**Tables Created:**
- `notifications`

**Indexes Created:**
- `idx_notifications_manager`
- `idx_notifications_unread`
- `idx_notifications_connection`
- `idx_notifications_created_at`

**Requirements Addressed:** 2.5

## Rollback

To rollback email integration migrations:

```sql
-- Drop tables in reverse order
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS processed_emails CASCADE;
DROP TABLE IF EXISTS email_filter_configs CASCADE;
DROP TABLE IF EXISTS platform_patterns CASCADE;
DROP TABLE IF EXISTS email_connections CASCADE;

-- Remove columns from inquiries
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
```

## Verification

After running migrations, verify the tables were created:

```sql
-- Check email integration tables exist
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

-- Check inquiries columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inquiries' 
AND column_name IN ('source_type', 'source_email_id', 'source_metadata');

-- Check default platform patterns were seeded
SELECT platform_type, sender_pattern, is_active 
FROM platform_patterns;
```

## Troubleshooting

### Migration Already Applied

If you see errors like "relation already exists", the migration has already been applied. This is safe to ignore.

### Foreign Key Violations

Ensure migrations are run in order. Migration 004 depends on 001, and 005 depends on the base schema.

### Permission Errors

Ensure your database user has CREATE TABLE and CREATE INDEX permissions:

```sql
GRANT CREATE ON SCHEMA public TO your_user;
```

## Notes

- All migrations use `IF NOT EXISTS` clauses to be idempotent
- Migrations include comments for documentation
- Indexes are created for common query patterns
- Foreign keys include ON DELETE CASCADE/SET NULL for data integrity
- Default platform patterns are seeded automatically
