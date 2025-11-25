/**
 * Property-based tests for Email Filter Service
 * Feature: email-integration
 */

import 'dotenv/config';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { EmailFilterService, EmailFilters } from '../../src/engines/EmailFilterService';
import { RawEmail } from '../../src/engines/PlatformMatcher';
import { createDatabasePool, closeDatabasePool, runMigrations, resetDatabase } from '../../src/database';

describe('Email Filter Service Property-Based Tests', () => {
  let pool: Pool;
  let service: EmailFilterService;

  beforeAll(async () => {
    pool = createDatabasePool();
    await resetDatabase(pool);
    await runMigrations(pool);
    service = new EmailFilterService(pool);
  });

  afterAll(async () => {
    await closeDatabasePool();
  });

  // Helper function to create a test email connection
  async function createTestConnection(connectionId: string): Promise<void> {
    // First create a test manager
    await pool.query(
      `INSERT INTO property_managers (id, email, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [connectionId, `test-${connectionId}@example.com`, 'Test Manager']
    );

    // Then create the email connection
    await pool.query(
      `INSERT INTO email_connections (id, manager_id, email_address, access_token, refresh_token, token_expiry, is_active)
       VALUES ($1, $1, $2, $3, $4, NOW() + INTERVAL '1 hour', true)
       ON CONFLICT (id) DO NOTHING`,
      [connectionId, `test-${connectionId}@gmail.com`, 'encrypted_access', 'encrypted_refresh']
    );
  }

  // Arbitraries for generating test data
  const emailArbitrary = fc.record({
    id: fc.uuid(),
    from: fc.emailAddress(),
    subject: fc.string({ minLength: 5, maxLength: 100 }),
    body: fc.string({ minLength: 10, maxLength: 500 }),
    receivedDate: fc.date()
  });

  const domainArbitrary = fc.oneof(
    fc.constant('facebookmail.com'),
    fc.constant('zillow.com'),
    fc.constant('craigslist.org'),
    fc.constant('turbotenant.com'),
    fc.constant('example.com'),
    fc.constant('test.com')
  );

  const keywordArbitrary = fc.oneof(
    fc.constant('inquiry'),
    fc.constant('rental'),
    fc.constant('apartment'),
    fc.constant('interested'),
    fc.constant('lease'),
    fc.constant('spam'),
    fc.constant('unsubscribe')
  );

  const filtersArbitrary = fc.record({
    senderWhitelist: fc.array(domainArbitrary, { maxLength: 5 }),
    subjectKeywords: fc.array(keywordArbitrary, { maxLength: 5 }),
    excludeSenders: fc.array(domainArbitrary, { maxLength: 3 }),
    excludeSubjectKeywords: fc.array(keywordArbitrary, { maxLength: 3 })
  });

  /**
   * Property 20: Filter application
   * For any email that doesn't match configured sender or subject filters, 
   * the system should skip processing that email
   * Validates: Requirements 6.3
   */
  describe('Property 20: Filter application', () => {
    it('should skip emails from excluded senders', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          fc.array(fc.string({ minLength: 3, maxLength: 20 }), { minLength: 1, maxLength: 3 }),
          async (email: RawEmail, excludedDomains: string[]) => {
            const filters: EmailFilters = {
              senderWhitelist: [],
              subjectKeywords: [],
              excludeSenders: excludedDomains,
              excludeSubjectKeywords: []
            };

            // If email sender contains any excluded domain, it should be filtered out
            const shouldBeExcluded = excludedDomains.some(domain => 
              email.from.toLowerCase().includes(domain.toLowerCase())
            );

            const result = service.applyFilters(email, filters);

            if (shouldBeExcluded) {
              expect(result).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should skip emails with excluded subject keywords', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 1, maxLength: 3 }),
          async (email: RawEmail, excludedKeywords: string[]) => {
            const filters: EmailFilters = {
              senderWhitelist: [],
              subjectKeywords: [],
              excludeSenders: [],
              excludeSubjectKeywords: excludedKeywords
            };

            // If email subject contains any excluded keyword, it should be filtered out
            const shouldBeExcluded = excludedKeywords.some(keyword => 
              email.subject.toLowerCase().includes(keyword.toLowerCase())
            );

            const result = service.applyFilters(email, filters);

            if (shouldBeExcluded) {
              expect(result).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only process emails from whitelisted senders when whitelist is configured', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          fc.array(domainArbitrary, { minLength: 1, maxLength: 5 }),
          async (email: RawEmail, whitelistedDomains: string[]) => {
            const filters: EmailFilters = {
              senderWhitelist: whitelistedDomains,
              subjectKeywords: [],
              excludeSenders: [],
              excludeSubjectKeywords: []
            };

            const isWhitelisted = whitelistedDomains.some(domain => 
              email.from.toLowerCase().includes(domain.toLowerCase())
            );

            const result = service.applyFilters(email, filters);

            // If sender is not whitelisted, email should be filtered out
            if (!isWhitelisted) {
              expect(result).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should only process emails with required subject keywords when keywords are configured', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          fc.array(fc.string({ minLength: 3, maxLength: 15 }), { minLength: 1, maxLength: 5 }),
          async (email: RawEmail, requiredKeywords: string[]) => {
            const filters: EmailFilters = {
              senderWhitelist: [],
              subjectKeywords: requiredKeywords,
              excludeSenders: [],
              excludeSubjectKeywords: []
            };

            const hasKeyword = requiredKeywords.some(keyword => 
              email.subject.toLowerCase().includes(keyword.toLowerCase())
            );

            const result = service.applyFilters(email, filters);

            // If subject doesn't contain any required keyword, email should be filtered out
            if (!hasKeyword) {
              expect(result).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should pass emails through when no filters are configured', async () => {
      await fc.assert(
        fc.asyncProperty(
          emailArbitrary,
          async (email: RawEmail) => {
            const filters: EmailFilters = {
              senderWhitelist: [],
              subjectKeywords: [],
              excludeSenders: [],
              excludeSubjectKeywords: []
            };

            const result = service.applyFilters(email, filters);

            // With no filters configured, all emails should pass
            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should prioritize exclusions over inclusions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            from: fc.constant('test@facebookmail.com'),
            subject: fc.constant('rental inquiry'),
            body: fc.string(),
            receivedDate: fc.date()
          }),
          async (email: RawEmail) => {
            const filters: EmailFilters = {
              senderWhitelist: ['facebookmail.com'],
              subjectKeywords: ['inquiry'],
              excludeSenders: ['facebookmail.com'],
              excludeSubjectKeywords: []
            };

            const result = service.applyFilters(email, filters);

            // Even though sender is whitelisted and subject has keyword,
            // exclusion should take priority
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 21: Filter update propagation
   * For any filter configuration update, subsequent polling operations 
   * should apply the new filters
   * Validates: Requirements 6.4
   */
  describe('Property 21: Filter update propagation', () => {
    it('should retrieve updated filters after saving', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          filtersArbitrary,
          filtersArbitrary,
          async (connectionId: string, initialFilters: EmailFilters, updatedFilters: EmailFilters) => {
            // Create test connection first
            await createTestConnection(connectionId);

            // Save initial filters
            await service.saveFilters(connectionId, initialFilters);

            // Retrieve and verify initial filters
            const retrieved1 = await service.getFilters(connectionId);
            expect(retrieved1.senderWhitelist).toEqual(initialFilters.senderWhitelist);
            expect(retrieved1.subjectKeywords).toEqual(initialFilters.subjectKeywords);
            expect(retrieved1.excludeSenders).toEqual(initialFilters.excludeSenders);
            expect(retrieved1.excludeSubjectKeywords).toEqual(initialFilters.excludeSubjectKeywords);

            // Update filters
            await service.saveFilters(connectionId, updatedFilters);

            // Retrieve and verify updated filters
            const retrieved2 = await service.getFilters(connectionId);
            expect(retrieved2.senderWhitelist).toEqual(updatedFilters.senderWhitelist);
            expect(retrieved2.subjectKeywords).toEqual(updatedFilters.subjectKeywords);
            expect(retrieved2.excludeSenders).toEqual(updatedFilters.excludeSenders);
            expect(retrieved2.excludeSubjectKeywords).toEqual(updatedFilters.excludeSubjectKeywords);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply updated filters to email processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          emailArbitrary,
          fc.string({ minLength: 3, maxLength: 15 }),
          async (connectionId: string, email: RawEmail, excludeKeyword: string) => {
            // Create test connection first
            await createTestConnection(connectionId);

            // Initial filters allow all emails
            const initialFilters: EmailFilters = {
              senderWhitelist: [],
              subjectKeywords: [],
              excludeSenders: [],
              excludeSubjectKeywords: []
            };

            await service.saveFilters(connectionId, initialFilters);
            const filters1 = await service.getFilters(connectionId);
            const result1 = service.applyFilters(email, filters1);

            // Email should pass with no filters
            expect(result1).toBe(true);

            // Update filters to exclude emails with specific keyword
            const updatedFilters: EmailFilters = {
              senderWhitelist: [],
              subjectKeywords: [],
              excludeSenders: [],
              excludeSubjectKeywords: [excludeKeyword]
            };

            await service.saveFilters(connectionId, updatedFilters);
            const filters2 = await service.getFilters(connectionId);
            const result2 = service.applyFilters(email, filters2);

            // If email subject contains the excluded keyword, it should now be filtered
            if (email.subject.toLowerCase().includes(excludeKeyword.toLowerCase())) {
              expect(result2).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should persist filter changes across service instances', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          filtersArbitrary,
          async (connectionId: string, filters: EmailFilters) => {
            // Create test connection first
            await createTestConnection(connectionId);

            // Save filters with first service instance
            await service.saveFilters(connectionId, filters);

            // Create new service instance
            const newService = new EmailFilterService(pool);

            // Retrieve filters with new instance
            const retrieved = await newService.getFilters(connectionId);

            // Filters should match what was saved
            expect(retrieved.senderWhitelist).toEqual(filters.senderWhitelist);
            expect(retrieved.subjectKeywords).toEqual(filters.subjectKeywords);
            expect(retrieved.excludeSenders).toEqual(filters.excludeSenders);
            expect(retrieved.excludeSubjectKeywords).toEqual(filters.excludeSubjectKeywords);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Default filters', () => {
    it('should return default filters for connections without configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          async (connectionId: string) => {
            // Don't save any filters for this connection
            const filters = await service.getFilters(connectionId);

            // Should return default filters
            const defaults = service.getDefaultFilters();
            expect(filters.senderWhitelist).toEqual(defaults.senderWhitelist);
            expect(filters.subjectKeywords).toEqual(defaults.subjectKeywords);
            expect(filters.excludeSenders).toEqual(defaults.excludeSenders);
            expect(filters.excludeSubjectKeywords).toEqual(defaults.excludeSubjectKeywords);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should include common rental platform domains in default whitelist', () => {
      const defaults = service.getDefaultFilters();

      expect(defaults.senderWhitelist).toContain('facebookmail.com');
      expect(defaults.senderWhitelist).toContain('zillow.com');
      expect(defaults.senderWhitelist).toContain('craigslist.org');
      expect(defaults.senderWhitelist).toContain('turbotenant.com');
    });

    it('should include common rental keywords in default subject keywords', () => {
      const defaults = service.getDefaultFilters();

      expect(defaults.subjectKeywords).toContain('inquiry');
      expect(defaults.subjectKeywords).toContain('rental');
      expect(defaults.subjectKeywords).toContain('interested');
    });
  });
});
