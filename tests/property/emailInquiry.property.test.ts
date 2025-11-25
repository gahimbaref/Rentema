import 'dotenv/config';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { getDatabasePool } from '../../src/database/connection';
import { EmailInquiryService } from '../../src/engines/EmailInquiryService';
import { InquiryRepository } from '../../src/database/repositories/InquiryRepository';
import { PropertyRepository } from '../../src/database/repositories/PropertyRepository';
import { ParsedInquiry } from '../../src/engines/EmailParser';

/**
 * Property-Based Tests for Email Inquiry Service
 */

describe('Email Inquiry Service Property-Based Tests', () => {
  let pool: Pool;
  let emailInquiryService: EmailInquiryService;
  let inquiryRepo: InquiryRepository;
  let propertyRepo: PropertyRepository;

  beforeAll(() => {
    pool = getDatabasePool();
    emailInquiryService = new EmailInquiryService(pool);
    inquiryRepo = new InquiryRepository(pool);
    propertyRepo = new PropertyRepository(pool);
  });

  afterAll(async () => {
    await emailInquiryService.close();
    // Don't close the pool - it's shared across tests
  });

  /**
   * Feature: email-integration, Property 18: Workflow trigger on creation
   * For any inquiry created from email, the pre-qualification workflow should be triggered
   * Validates: Requirements 5.4
   */
  describe('Property 18: Workflow trigger on creation', () => {
    it('should trigger pre-qualification workflow for all inquiries created from email', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              tenantName: fc.string({ minLength: 3, maxLength: 50 }),
              tenantEmail: fc.emailAddress(),
              message: fc.string({ minLength: 10, maxLength: 200 }),
              platformType: fc.constantFrom('facebook', 'zillow', 'craigslist', 'turbotenant'),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (inquiryConfigs) => {
            // Create a test manager
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create a property
            const property = await propertyRepo.create({
              managerId,
              address: `${Date.now()} Test Street`,
              rentAmount: 1500,
              bedrooms: 2,
              bathrooms: 1.5,
              availabilityDate: new Date(),
              isTestMode: true,
              isArchived: false,
            });

            // Create email connection
            const connectionResult = await pool.query(
              `INSERT INTO email_connections (manager_id, email_address, access_token, refresh_token, token_expiry, is_active)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [managerId, 'test@example.com', 'encrypted_token', 'encrypted_refresh', new Date(Date.now() + 3600000), true]
            );
            const connectionId = connectionResult.rows[0].id;

            const createdInquiryIds: string[] = [];

            for (const config of inquiryConfigs) {
              // Create parsed inquiry
              const parsedInquiry: ParsedInquiry = {
                tenantName: config.tenantName,
                tenantEmail: config.tenantEmail,
                message: config.message,
                platformType: config.platformType,
                originalEmailId: `email-${Date.now()}-${Math.random()}`,
                receivedDate: new Date(),
                parsingErrors: [],
              };

              // Create inquiry from email
              const inquiryId = await emailInquiryService.createInquiryFromEmail(
                parsedInquiry,
                managerId,
                connectionId
              );

              createdInquiryIds.push(inquiryId);

              // Verify inquiry was created
              const inquiry = await inquiryRepo.findById(inquiryId);
              expect(inquiry).toBeDefined();
              expect(inquiry?.propertyId).toBe(property.id);
              expect(inquiry?.sourceType).toBe('email');
              expect(inquiry?.sourceEmailId).toBe(parsedInquiry.originalEmailId);

              // Verify workflow was triggered by checking status changed from 'new'
              // The workflow should have updated the status to 'pre_qualifying' or 'qualified'
              // depending on whether questions are configured
              expect(inquiry?.status).not.toBe('new');
            }

            // Cleanup
            await pool.query('DELETE FROM inquiries WHERE id = ANY($1)', [createdInquiryIds]);
            await pool.query('DELETE FROM email_connections WHERE id = $1', [connectionId]);
            await propertyRepo.delete(property.id);
            await pool.query('DELETE FROM platform_connections WHERE manager_id = $1', [managerId]);
            await pool.query('DELETE FROM property_managers WHERE id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  /**
   * Feature: email-integration, Property 19: Email ID storage for deduplication
   * For any created inquiry from email, the original email ID should be stored, 
   * and processing the same email ID again should not create a duplicate inquiry
   * Validates: Requirements 5.5
   */
  describe('Property 19: Email ID storage for deduplication', () => {
    it('should store email ID and prevent duplicate inquiry creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantName: fc.string({ minLength: 3, maxLength: 50 }),
            tenantEmail: fc.emailAddress(),
            message: fc.string({ minLength: 10, maxLength: 200 }),
            platformType: fc.constantFrom('facebook', 'zillow', 'craigslist', 'turbotenant'),
            emailId: fc.string({ minLength: 10, maxLength: 50 }),
          }),
          async (config) => {
            // Create a test manager
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create a property
            const property = await propertyRepo.create({
              managerId,
              address: `${Date.now()} Test Street`,
              rentAmount: 1500,
              bedrooms: 2,
              bathrooms: 1.5,
              availabilityDate: new Date(),
              isTestMode: true,
              isArchived: false,
            });

            // Create email connection
            const connectionResult = await pool.query(
              `INSERT INTO email_connections (manager_id, email_address, access_token, refresh_token, token_expiry, is_active)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [managerId, 'test@example.com', 'encrypted_token', 'encrypted_refresh', new Date(Date.now() + 3600000), true]
            );
            const connectionId = connectionResult.rows[0].id;

            // Create parsed inquiry with unique email ID
            const parsedInquiry: ParsedInquiry = {
              tenantName: config.tenantName,
              tenantEmail: config.tenantEmail,
              message: config.message,
              platformType: config.platformType,
              originalEmailId: config.emailId,
              receivedDate: new Date(),
              parsingErrors: [],
            };

            // Create inquiry from email (first time)
            const firstInquiryId = await emailInquiryService.createInquiryFromEmail(
              parsedInquiry,
              managerId,
              connectionId
            );

            // Verify inquiry was created and email ID was stored
            const firstInquiry = await inquiryRepo.findById(firstInquiryId);
            expect(firstInquiry).toBeDefined();
            expect(firstInquiry?.sourceEmailId).toBe(config.emailId);

            // Try to create inquiry from same email ID (should detect duplicate)
            // First, insert the email into processed_emails to simulate polling
            await pool.query(
              `INSERT INTO processed_emails (connection_id, email_id, "from", subject, received_date, processing_status)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [connectionId, config.emailId, config.tenantEmail, 'Test Subject', new Date(), 'pending']
            );

            // Process new emails (should detect duplicate and not create new inquiry)
            await emailInquiryService.processNewEmails(connectionId);

            // Verify no new inquiry was created
            const allInquiries = await pool.query(
              'SELECT id FROM inquiries WHERE source_email_id = $1',
              [config.emailId]
            );

            // Should still only have one inquiry with this email ID
            expect(allInquiries.rows.length).toBe(1);
            expect(allInquiries.rows[0].id).toBe(firstInquiryId);

            // Cleanup
            await pool.query('DELETE FROM processed_emails WHERE connection_id = $1', [connectionId]);
            await pool.query('DELETE FROM inquiries WHERE id = $1', [firstInquiryId]);
            await pool.query('DELETE FROM email_connections WHERE id = $1', [connectionId]);
            await propertyRepo.delete(property.id);
            await pool.query('DELETE FROM platform_connections WHERE manager_id = $1', [managerId]);
            await pool.query('DELETE FROM property_managers WHERE id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  /**
   * Feature: email-integration, Property 34: Statistics accuracy - total processed
   * For any email connection, the dashboard statistics for total emails processed 
   * should equal the count of all processed emails for that connection
   * Validates: Requirements 10.1
   */
  describe('Property 34: Statistics accuracy - total processed', () => {
    it('should accurately count total emails processed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 20 }),
          async (emailCount) => {
            // Create a test manager
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create email connection
            const connectionResult = await pool.query(
              `INSERT INTO email_connections (manager_id, email_address, access_token, refresh_token, token_expiry, is_active)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [managerId, 'test@example.com', 'encrypted_token', 'encrypted_refresh', new Date(Date.now() + 3600000), true]
            );
            const connectionId = connectionResult.rows[0].id;

            // Create processed emails with various statuses
            for (let i = 0; i < emailCount; i++) {
              const status = i % 3 === 0 ? 'success' : i % 3 === 1 ? 'failed' : 'skipped';
              await pool.query(
                `INSERT INTO processed_emails (connection_id, email_id, "from", subject, received_date, processing_status, platform_type, processed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
                [connectionId, `email-${i}`, 'sender@example.com', 'Test Subject', new Date(), status, 'facebook']
              );
            }

            // Get statistics
            const stats = await emailInquiryService.getProcessingStats(connectionId);

            // Verify total processed count
            expect(stats.totalEmailsProcessed).toBe(emailCount);

            // Cleanup
            await pool.query('DELETE FROM processed_emails WHERE connection_id = $1', [connectionId]);
            await pool.query('DELETE FROM email_connections WHERE id = $1', [connectionId]);
            await pool.query('DELETE FROM platform_connections WHERE manager_id = $1', [managerId]);
            await pool.query('DELETE FROM property_managers WHERE id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  /**
   * Feature: email-integration, Property 35: Statistics accuracy - successful extractions
   * For any email connection, the dashboard statistics for successful extractions 
   * should equal the count of emails that resulted in created inquiries
   * Validates: Requirements 10.2
   */
  describe('Property 35: Statistics accuracy - successful extractions', () => {
    it('should accurately count successful extractions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            successCount: fc.integer({ min: 1, max: 10 }),
            failureCount: fc.integer({ min: 0, max: 10 }),
          }),
          async (config) => {
            // Create a test manager
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create email connection
            const connectionResult = await pool.query(
              `INSERT INTO email_connections (manager_id, email_address, access_token, refresh_token, token_expiry, is_active)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [managerId, 'test@example.com', 'encrypted_token', 'encrypted_refresh', new Date(Date.now() + 3600000), true]
            );
            const connectionId = connectionResult.rows[0].id;

            // Create successful processed emails
            for (let i = 0; i < config.successCount; i++) {
              await pool.query(
                `INSERT INTO processed_emails (connection_id, email_id, "from", subject, received_date, processing_status, platform_type, processed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
                [connectionId, `success-${i}`, 'sender@example.com', 'Test Subject', new Date(), 'success', 'facebook']
              );
            }

            // Create failed processed emails
            for (let i = 0; i < config.failureCount; i++) {
              await pool.query(
                `INSERT INTO processed_emails (connection_id, email_id, "from", subject, received_date, processing_status, platform_type, processed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
                [connectionId, `failed-${i}`, 'sender@example.com', 'Test Subject', new Date(), 'failed', 'zillow']
              );
            }

            // Get statistics
            const stats = await emailInquiryService.getProcessingStats(connectionId);

            // Verify successful extractions count
            expect(stats.successfulExtractions).toBe(config.successCount);

            // Cleanup
            await pool.query('DELETE FROM processed_emails WHERE connection_id = $1', [connectionId]);
            await pool.query('DELETE FROM email_connections WHERE id = $1', [connectionId]);
            await pool.query('DELETE FROM platform_connections WHERE manager_id = $1', [managerId]);
            await pool.query('DELETE FROM property_managers WHERE id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  /**
   * Feature: email-integration, Property 36: Statistics accuracy - failed parsing
   * For any email connection, the dashboard statistics for failed parsing 
   * should equal the count of emails with processing status 'failed'
   * Validates: Requirements 10.3
   */
  describe('Property 36: Statistics accuracy - failed parsing', () => {
    it('should accurately count failed parsing attempts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            successCount: fc.integer({ min: 0, max: 10 }),
            failureCount: fc.integer({ min: 1, max: 10 }),
          }),
          async (config) => {
            // Create a test manager
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create email connection
            const connectionResult = await pool.query(
              `INSERT INTO email_connections (manager_id, email_address, access_token, refresh_token, token_expiry, is_active)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [managerId, 'test@example.com', 'encrypted_token', 'encrypted_refresh', new Date(Date.now() + 3600000), true]
            );
            const connectionId = connectionResult.rows[0].id;

            // Create successful processed emails
            for (let i = 0; i < config.successCount; i++) {
              await pool.query(
                `INSERT INTO processed_emails (connection_id, email_id, "from", subject, received_date, processing_status, platform_type, processed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
                [connectionId, `success-${i}`, 'sender@example.com', 'Test Subject', new Date(), 'success', 'facebook']
              );
            }

            // Create failed processed emails
            for (let i = 0; i < config.failureCount; i++) {
              await pool.query(
                `INSERT INTO processed_emails (connection_id, email_id, "from", subject, received_date, processing_status, platform_type, processed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
                [connectionId, `failed-${i}`, 'sender@example.com', 'Test Subject', new Date(), 'failed', 'zillow']
              );
            }

            // Get statistics
            const stats = await emailInquiryService.getProcessingStats(connectionId);

            // Verify failed parsing count
            expect(stats.failedParsing).toBe(config.failureCount);

            // Cleanup
            await pool.query('DELETE FROM processed_emails WHERE connection_id = $1', [connectionId]);
            await pool.query('DELETE FROM email_connections WHERE id = $1', [connectionId]);
            await pool.query('DELETE FROM platform_connections WHERE manager_id = $1', [managerId]);
            await pool.query('DELETE FROM property_managers WHERE id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  /**
   * Feature: email-integration, Property 37: Last sync tracking
   * For any email connection, the dashboard should display the timestamp 
   * and status of the most recent polling operation
   * Validates: Requirements 10.4
   */
  describe('Property 37: Last sync tracking', () => {
    it('should track the most recent sync time', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }),
          async (emailCount) => {
            // Create a test manager
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create email connection
            const connectionResult = await pool.query(
              `INSERT INTO email_connections (manager_id, email_address, access_token, refresh_token, token_expiry, is_active)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [managerId, 'test@example.com', 'encrypted_token', 'encrypted_refresh', new Date(Date.now() + 3600000), true]
            );
            const connectionId = connectionResult.rows[0].id;

            // Create processed emails with different timestamps
            let latestTimestamp: Date | null = null;
            for (let i = 0; i < emailCount; i++) {
              const timestamp = new Date(Date.now() - (emailCount - i) * 1000);
              if (!latestTimestamp || timestamp > latestTimestamp) {
                latestTimestamp = timestamp;
              }
              
              await pool.query(
                `INSERT INTO processed_emails (connection_id, email_id, "from", subject, received_date, processing_status, platform_type, processed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [connectionId, `email-${i}`, 'sender@example.com', 'Test Subject', new Date(), 'success', 'facebook', timestamp]
              );
            }

            // Get statistics
            const stats = await emailInquiryService.getProcessingStats(connectionId);

            // Verify last sync time is the most recent
            expect(stats.lastSyncTime).toBeDefined();
            if (stats.lastSyncTime && latestTimestamp) {
              // Allow for small time differences due to database precision
              const timeDiff = Math.abs(stats.lastSyncTime.getTime() - latestTimestamp.getTime());
              expect(timeDiff).toBeLessThan(1000); // Within 1 second
            }

            // Cleanup
            await pool.query('DELETE FROM processed_emails WHERE connection_id = $1', [connectionId]);
            await pool.query('DELETE FROM email_connections WHERE id = $1', [connectionId]);
            await pool.query('DELETE FROM platform_connections WHERE manager_id = $1', [managerId]);
            await pool.query('DELETE FROM property_managers WHERE id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  /**
   * Feature: email-integration, Property 38: Platform breakdown accuracy
   * For any email connection, the dashboard platform breakdown should correctly 
   * group processed emails by identified platform type
   * Validates: Requirements 10.5
   */
  describe('Property 38: Platform breakdown accuracy', () => {
    it('should accurately break down emails by platform', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            facebookCount: fc.integer({ min: 0, max: 10 }),
            zillowCount: fc.integer({ min: 0, max: 10 }),
            craigslistCount: fc.integer({ min: 0, max: 10 }),
            turbotenanCount: fc.integer({ min: 0, max: 10 }),
          }),
          async (config) => {
            // Ensure at least one email
            if (config.facebookCount + config.zillowCount + config.craigslistCount + config.turbotenanCount === 0) {
              config.facebookCount = 1;
            }

            // Create a test manager
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create email connection
            const connectionResult = await pool.query(
              `INSERT INTO email_connections (manager_id, email_address, access_token, refresh_token, token_expiry, is_active)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [managerId, 'test@example.com', 'encrypted_token', 'encrypted_refresh', new Date(Date.now() + 3600000), true]
            );
            const connectionId = connectionResult.rows[0].id;

            // Create processed emails for each platform
            const platforms = [
              { type: 'facebook', count: config.facebookCount },
              { type: 'zillow', count: config.zillowCount },
              { type: 'craigslist', count: config.craigslistCount },
              { type: 'turbotenant', count: config.turbotenanCount },
            ];

            for (const platform of platforms) {
              for (let i = 0; i < platform.count; i++) {
                await pool.query(
                  `INSERT INTO processed_emails (connection_id, email_id, "from", subject, received_date, processing_status, platform_type, processed_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
                  [connectionId, `${platform.type}-${i}`, 'sender@example.com', 'Test Subject', new Date(), 'success', platform.type]
                );
              }
            }

            // Get statistics
            const stats = await emailInquiryService.getProcessingStats(connectionId);

            // Verify platform breakdown
            expect(stats.platformBreakdown['facebook'] || 0).toBe(config.facebookCount);
            expect(stats.platformBreakdown['zillow'] || 0).toBe(config.zillowCount);
            expect(stats.platformBreakdown['craigslist'] || 0).toBe(config.craigslistCount);
            expect(stats.platformBreakdown['turbotenant'] || 0).toBe(config.turbotenanCount);

            // Verify total matches sum of platform counts
            const totalFromBreakdown = Object.values(stats.platformBreakdown).reduce((sum: number, count) => sum + (count as number), 0);
            expect(totalFromBreakdown).toBe(stats.totalEmailsProcessed);

            // Cleanup
            await pool.query('DELETE FROM processed_emails WHERE connection_id = $1', [connectionId]);
            await pool.query('DELETE FROM email_connections WHERE id = $1', [connectionId]);
            await pool.query('DELETE FROM platform_connections WHERE manager_id = $1', [managerId]);
            await pool.query('DELETE FROM property_managers WHERE id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });
});
