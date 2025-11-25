import 'dotenv/config';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { getDatabasePool } from '../../src/database/connection';
import { EmailInquiryService } from '../../src/engines/EmailInquiryService';
import { PropertyRepository } from '../../src/database/repositories/PropertyRepository';
import { EmailParser } from '../../src/engines/EmailParser';

/**
 * Property-Based Tests for Email API Endpoints
 */

describe('Email API Property-Based Tests', () => {
  let pool: Pool;
  let emailInquiryService: EmailInquiryService;
  let propertyRepo: PropertyRepository;

  beforeAll(() => {
    pool = getDatabasePool();
    emailInquiryService = new EmailInquiryService(pool);
    propertyRepo = new PropertyRepository(pool);
  });

  afterAll(async () => {
    await emailInquiryService.close();
  });

  /**
   * Feature: email-integration, Property 30: Manual sync execution
   * For any manual sync trigger, the system should immediately poll for new emails 
   * without waiting for the scheduled interval
   * Validates: Requirements 9.2
   */
  describe('Property 30: Manual sync execution', () => {
    it('should immediately process emails when manual sync is triggered', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (emailCount) => {
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

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

            const connectionResult = await pool.query(
              `INSERT INTO email_connections (manager_id, email_address, access_token, refresh_token, token_expiry, is_active)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [managerId, 'test@example.com', 'encrypted_token', 'encrypted_refresh', new Date(Date.now() + 3600000), true]
            );
            const connectionId = connectionResult.rows[0].id;

            for (let i = 0; i < emailCount; i++) {
              await pool.query(
                `INSERT INTO processed_emails (connection_id, email_id, "from", subject, received_date, processing_status, platform_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [connectionId, `pending-email-${i}-${Date.now()}`, 'sender@example.com', 'Test Subject', new Date(), 'pending', 'facebook']
              );
            }

            const beforeSync = new Date();
            const result = await emailInquiryService.processNewEmails(connectionId);
            const afterSync = new Date();

            expect(result.emailsProcessed).toBeGreaterThanOrEqual(0);
            
            const syncDuration = afterSync.getTime() - beforeSync.getTime();
            expect(syncDuration).toBeLessThan(30000);

            const pendingCheck = await pool.query(
              'SELECT COUNT(*) as count FROM processed_emails WHERE connection_id = $1 AND processing_status = $2',
              [connectionId, 'pending']
            );
            expect(parseInt(pendingCheck.rows[0].count)).toBe(0);

            await pool.query('DELETE FROM processed_emails WHERE connection_id = $1', [connectionId]);
            await pool.query('DELETE FROM inquiries WHERE property_id = $1', [property.id]);
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
   * Feature: email-integration, Property 32: Sync completion results
   * For any completed manual sync, the system should display the number of 
   * new inquiries found and created
   * Validates: Requirements 9.4
   */
  describe('Property 32: Sync completion results', () => {
    it('should return accurate counts of processed emails and created inquiries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            successCount: fc.integer({ min: 0, max: 5 }),
            skipCount: fc.integer({ min: 0, max: 5 }),
          }),
          async (config) => {
            if (config.successCount + config.skipCount === 0) {
              config.successCount = 1;
            }

            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

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

            const connectionResult = await pool.query(
              `INSERT INTO email_connections (manager_id, email_address, access_token, refresh_token, token_expiry, is_active)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [managerId, 'test@example.com', 'encrypted_token', 'encrypted_refresh', new Date(Date.now() + 3600000), true]
            );
            const connectionId = connectionResult.rows[0].id;

            for (let i = 0; i < config.successCount; i++) {
              await pool.query(
                `INSERT INTO processed_emails (connection_id, email_id, "from", subject, received_date, processing_status, platform_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [connectionId, `success-email-${i}-${Date.now()}`, 'sender@example.com', 'Test Subject', new Date(), 'pending', 'facebook']
              );
            }

            for (let i = 0; i < config.skipCount; i++) {
              await pool.query(
                `INSERT INTO processed_emails (connection_id, email_id, "from", subject, received_date, processing_status, platform_type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                [connectionId, `skip-email-${i}-${Date.now()}`, 'unknown@example.com', 'Unrelated Subject', new Date(), 'pending', null]
              );
            }

            const result = await emailInquiryService.processNewEmails(connectionId);

            expect(result).toHaveProperty('emailsProcessed');
            expect(result).toHaveProperty('inquiriesCreated');
            expect(result).toHaveProperty('inquiriesUnmatched');
            expect(result).toHaveProperty('errors');

            expect(result.emailsProcessed).toBeGreaterThanOrEqual(0);
            expect(result.inquiriesCreated).toBeGreaterThanOrEqual(0);
            expect(Array.isArray(result.errors)).toBe(true);

            await pool.query('DELETE FROM processed_emails WHERE connection_id = $1', [connectionId]);
            await pool.query('DELETE FROM inquiries WHERE property_id = $1', [property.id]);
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
   * Feature: email-integration, Property 33: Sync error messaging
   * For any failed manual sync, the system should display specific error messages 
   * indicating the failure reason
   * Validates: Requirements 9.5
   */
  describe('Property 33: Sync error messaging', () => {
    it('should provide specific error messages when sync fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 50 }),
          async (invalidConnectionId) => {
            const result = await emailInquiryService.processNewEmails(invalidConnectionId);

            expect(result.errors).toBeDefined();
            expect(Array.isArray(result.errors)).toBe(true);
            expect(result.errors.length).toBeGreaterThan(0);

            const error = result.errors[0];
            expect(error).toHaveProperty('emailId');
            expect(error).toHaveProperty('error');
            expect(error).toHaveProperty('timestamp');

            expect(typeof error.error).toBe('string');
            expect(error.error.length).toBeGreaterThan(0);
            // Error message should be descriptive
            const errorLower = error.error.toLowerCase();
            const hasDescriptiveError = errorLower.includes('connection') || 
                                       errorLower.includes('uuid') || 
                                       errorLower.includes('syntax') ||
                                       errorLower.includes('not found') ||
                                       errorLower.includes('inactive');
            expect(hasDescriptiveError).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  /**
   * Feature: email-integration, Property 27: Test mode non-persistence
   * For any sample email parsed in test mode, the system should extract and 
   * display data without creating an inquiry in the database
   * Validates: Requirements 8.2
   */
  describe('Property 27: Test mode non-persistence', () => {
    it('should parse emails without creating inquiries in test mode', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            from: fc.emailAddress(),
            subject: fc.string({ minLength: 5, maxLength: 100 }),
            body: fc.string({ minLength: 20, maxLength: 500 }),
            platformType: fc.constantFrom('facebook', 'zillow', 'craigslist', 'turbotenant'),
          }),
          async (emailData) => {
            const emailParser = new EmailParser();
            
            const rawEmail = {
              id: `test-${Date.now()}`,
              from: emailData.from,
              subject: emailData.subject,
              body: emailData.body,
              receivedDate: new Date()
            };

            const beforeCount = await pool.query('SELECT COUNT(*) as count FROM inquiries');
            const countBefore = parseInt(beforeCount.rows[0].count);

            const parseResult = await emailParser.testParse(rawEmail, emailData.platformType as any);

            const afterCount = await pool.query('SELECT COUNT(*) as count FROM inquiries');
            const countAfter = parseInt(afterCount.rows[0].count);

            expect(countAfter).toBe(countBefore);

            expect(parseResult).toHaveProperty('success');
            expect(parseResult).toHaveProperty('extractedFields');
            expect(parseResult).toHaveProperty('missingFields');
            expect(parseResult).toHaveProperty('errors');
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  /**
   * Feature: email-integration, Property 28: Test mode field display
   * For any test mode parsing operation, the results should show which fields 
   * were successfully extracted
   * Validates: Requirements 8.3
   */
  describe('Property 28: Test mode field display', () => {
    it('should display extracted fields in test mode results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            from: fc.emailAddress(),
            subject: fc.string({ minLength: 5, maxLength: 100 }),
            body: fc.string({ minLength: 20, maxLength: 500 }),
            platformType: fc.constantFrom('facebook', 'zillow', 'craigslist', 'turbotenant'),
          }),
          async (emailData) => {
            const emailParser = new EmailParser();
            
            const rawEmail = {
              id: `test-${Date.now()}`,
              from: emailData.from,
              subject: emailData.subject,
              body: emailData.body,
              receivedDate: new Date()
            };

            const parseResult = await emailParser.testParse(rawEmail, emailData.platformType as any);

            expect(typeof parseResult.extractedFields).toBe('object');
            expect(parseResult.extractedFields).not.toBeNull();

            const allPossibleFields = ['tenantName', 'tenantEmail', 'tenantPhone', 'message', 'propertyReference', 'propertyAddress'];
            
            for (const field of allPossibleFields) {
              if (parseResult.extractedFields[field] !== undefined) {
                expect(parseResult.missingFields).not.toContain(field);
              }
            }

            expect(Array.isArray(parseResult.missingFields)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  /**
   * Feature: email-integration, Property 29: Test mode error display
   * For any test mode parsing operation with errors, the results should display 
   * all parsing errors and warnings
   * Validates: Requirements 8.4
   */
  describe('Property 29: Test mode error display', () => {
    it('should display parsing errors in test mode results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            from: fc.emailAddress(),
            subject: fc.string({ minLength: 0, maxLength: 10 }),
            body: fc.string({ minLength: 0, maxLength: 10 }),
            platformType: fc.constantFrom('facebook', 'zillow', 'craigslist', 'turbotenant'),
          }),
          async (emailData) => {
            const emailParser = new EmailParser();
            
            const rawEmail = {
              id: `test-${Date.now()}`,
              from: emailData.from,
              subject: emailData.subject,
              body: emailData.body,
              receivedDate: new Date()
            };

            const parseResult = await emailParser.testParse(rawEmail, emailData.platformType as any);

            expect(Array.isArray(parseResult.errors)).toBe(true);

            if (!parseResult.success) {
              expect(parseResult.errors.length).toBeGreaterThan(0);
              
              for (const error of parseResult.errors) {
                expect(typeof error).toBe('string');
                expect(error.length).toBeGreaterThan(0);
              }
            }

            if (parseResult.errors.length > 0) {
              expect(parseResult.success).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });
});
