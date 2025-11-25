# Email Integration Deployment Guide

This guide provides a quick reference for deploying the email integration feature to production.

## Pre-Deployment Checklist

### 1. Google Cloud Console Setup

- [ ] Create Google Cloud Project
- [ ] Enable Gmail API
- [ ] Configure OAuth consent screen
- [ ] Create OAuth 2.0 credentials
- [ ] Add authorized redirect URIs for production domain
- [ ] Save Client ID and Client Secret

### 2. Environment Configuration

Add to production `.env`:

```bash
# Gmail OAuth Configuration
GOOGLE_CLIENT_ID=your_production_client_id
GOOGLE_CLIENT_SECRET=your_production_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/api/email/callback

# Encryption key (32 characters minimum)
ENCRYPTION_KEY=your_secure_random_32_char_key
```

**Security Notes:**
- Use a secrets manager (AWS Secrets Manager, Azure Key Vault, etc.) in production
- Never commit credentials to version control
- Rotate encryption keys periodically
- Use different OAuth credentials for staging and production

### 3. Database Migration

Run email integration migrations:

```bash
# Option 1: Run all migrations at once
npm run migrate

# Option 2: Run email migrations incrementally
npm run migrate:email:run

# Option 3: Run and verify
npm run migrate:email:all

# Verify migrations
npm run migrate:email:verify
```

### 4. Verify Installation

```bash
# Test database connection
npm run verify

# Check email integration tables
psql -U postgres -d rentema -c "SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'email%' OR table_name = 'platform_patterns' OR table_name = 'notifications';"

# Verify platform patterns seeded
psql -U postgres -d rentema -c "SELECT platform_type, is_active FROM platform_patterns;"
```

## Deployment Steps

### Step 1: Deploy Code

```bash
# Build application
npm run build

# Deploy to production server
# (Use your deployment method: Docker, PM2, systemd, etc.)
```

### Step 2: Run Migrations

```bash
# On production server
npm run migrate:email:all
```

### Step 3: Start Application

```bash
# Start with process manager
pm2 start dist/index.js --name rentema

# Or with systemd
systemctl start rentema
```

### Step 4: Verify Email Integration

1. Log into the application
2. Navigate to Email Connection page
3. Click "Connect Gmail"
4. Complete OAuth flow
5. Verify connection status shows "Active"
6. Trigger manual sync to test

## Post-Deployment Monitoring

### Key Metrics to Monitor

1. **OAuth Token Health**
   - Token refresh success rate
   - Token expiration alerts
   - Connection status

2. **Email Polling**
   - Polling frequency (should be every 5 minutes)
   - Polling success rate
   - Emails processed per poll

3. **Parsing Success**
   - Successful extractions vs. failures
   - Platform identification accuracy
   - Property matching rate

4. **System Performance**
   - Email processing latency
   - Database query performance
   - API response times

### Monitoring Queries

```sql
-- Check active email connections
SELECT manager_id, email_address, is_active, last_poll_time 
FROM email_connections 
WHERE is_active = TRUE;

-- Check recent processing stats
SELECT 
    processing_status,
    COUNT(*) as count,
    platform_type
FROM processed_emails 
WHERE processed_at > NOW() - INTERVAL '24 hours'
GROUP BY processing_status, platform_type;

-- Check for errors
SELECT * FROM notifications 
WHERE severity = 'error' 
AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Check inquiry sources
SELECT 
    source_type,
    COUNT(*) as count
FROM inquiries
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY source_type;
```

## Troubleshooting Production Issues

### Issue: OAuth Connection Fails

**Symptoms:**
- Users cannot connect Gmail
- "Authorization failed" errors

**Solutions:**
1. Verify OAuth credentials in environment variables
2. Check redirect URI matches Google Cloud Console
3. Ensure Gmail API is enabled
4. Check application logs for specific errors

### Issue: Emails Not Being Processed

**Symptoms:**
- Last poll time not updating
- No new inquiries from email

**Solutions:**
1. Check email connection is active
2. Verify polling service is running
3. Check for token expiration
4. Review email filters (may be too restrictive)
5. Check application logs for polling errors

### Issue: High Parsing Failure Rate

**Symptoms:**
- Many emails with "failed" status
- Inquiries flagged for manual review

**Solutions:**
1. Review parsing errors in processed_emails table
2. Check if platform email formats changed
3. Update platform patterns if needed
4. Review sample failed emails in test mode

### Issue: Performance Degradation

**Symptoms:**
- Slow email processing
- High database load
- API timeouts

**Solutions:**
1. Check database indexes are present
2. Review query performance with EXPLAIN
3. Consider increasing polling interval
4. Implement connection pooling
5. Add caching for platform patterns

## Rollback Procedure

If you need to rollback email integration:

```bash
# Backup data first
pg_dump -U postgres -d rentema -t email_connections -t processed_emails -t platform_patterns -t email_filter_configs -t notifications > email_integration_backup.sql

# Run rollback
psql -U postgres -d rentema -f database/migrations/rollback.sql

# Redeploy previous version
git checkout previous_version
npm run build
pm2 restart rentema
```

## Scaling Considerations

### For High Volume (>1000 emails/day)

1. **Implement Queue System**
   - Use Bull queue for email processing
   - Separate polling from processing
   - Add worker processes

2. **Database Optimization**
   - Add partitioning to processed_emails table
   - Implement archiving for old records
   - Use read replicas for reporting

3. **Caching**
   - Cache platform patterns in Redis
   - Cache filter configurations
   - Implement result caching for statistics

4. **Horizontal Scaling**
   - Run multiple polling instances with distributed locking
   - Use load balancer for API endpoints
   - Separate email processing workers

## Security Hardening

### Production Security Checklist

- [ ] Use HTTPS for all endpoints
- [ ] Implement rate limiting on OAuth endpoints
- [ ] Enable audit logging for email access
- [ ] Rotate encryption keys regularly
- [ ] Use secrets manager for credentials
- [ ] Implement IP whitelisting for admin endpoints
- [ ] Enable database encryption at rest
- [ ] Set up intrusion detection
- [ ] Configure firewall rules
- [ ] Enable 2FA for admin accounts

### Compliance Considerations

- **GDPR**: Ensure email data retention policies
- **Data Privacy**: Document what email data is stored
- **Access Control**: Limit who can access email connections
- **Audit Trail**: Log all email access and processing
- **Data Deletion**: Implement right to be forgotten

## Support and Maintenance

### Regular Maintenance Tasks

**Daily:**
- Monitor error notifications
- Check polling health
- Review parsing failure rate

**Weekly:**
- Review processing statistics
- Check for platform pattern updates
- Analyze inquiry source distribution

**Monthly:**
- Review and optimize database queries
- Update platform patterns if needed
- Analyze feature usage metrics
- Review security logs

### Getting Help

1. Check logs: `pm2 logs rentema`
2. Review notifications table for system alerts
3. Check [Email Integration User Guide](EMAIL_INTEGRATION_GUIDE.md)
4. Review [Troubleshooting](#troubleshooting-production-issues) section
5. Contact support with:
   - Error messages
   - Relevant log entries
   - Steps to reproduce
   - Environment details

## Useful Commands

```bash
# Check application status
pm2 status rentema

# View logs
pm2 logs rentema --lines 100

# Restart application
pm2 restart rentema

# Run migrations
npm run migrate:email:all

# Verify migrations
npm run migrate:email:verify

# Database backup
pg_dump -U postgres -d rentema > rentema_backup_$(date +%Y%m%d).sql

# Check email connections
psql -U postgres -d rentema -c "SELECT * FROM email_connections;"

# Check recent errors
psql -U postgres -d rentema -c "SELECT * FROM notifications WHERE severity='error' ORDER BY created_at DESC LIMIT 10;"
```

---

*For detailed user instructions, see [Email Integration User Guide](EMAIL_INTEGRATION_GUIDE.md)*
