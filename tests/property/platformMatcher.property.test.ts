/**
 * Property-based tests for Platform Matcher
 * Feature: email-integration
 */

import 'dotenv/config';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { PlatformMatcher, RawEmail } from '../../src/engines/PlatformMatcher';
import { PlatformPatternRepository } from '../../src/database/repositories/PlatformPatternRepository';
import { createDatabasePool, closeDatabasePool, runMigrations, resetDatabase } from '../../src/database';

describe('Platform Matcher Property-Based Tests', () => {
  let pool: Pool;
  let matcher: PlatformMatcher;
  let repository: PlatformPatternRepository;

  beforeAll(async () => {
    pool = createDatabasePool();
    await resetDatabase(pool);
    await runMigrations(pool);

    repository = new PlatformPatternRepository(pool);
    matcher = new PlatformMatcher(pool);

    // Seed test patterns for known platforms
    await repository.create({
      platformType: 'facebook',
      senderPattern: '@facebookmail\\.com$',
      subjectPattern: 'marketplace|inquiry|message',
      priority: 1,
      isActive: true
    });

    await repository.create({
      platformType: 'zillow',
      senderPattern: '@zillow\\.com$',
      subjectPattern: 'inquiry|rental|contact',
      priority: 1,
      isActive: true
    });

    await repository.create({
      platformType: 'craigslist',
      senderPattern: '@craigslist\\.org$',
      subjectPattern: 'reply|inquiry',
      priority: 1,
      isActive: true
    });

    await repository.create({
      platformType: 'turbotenant',
      senderPattern: '@turbotenant\\.com$',
      subjectPattern: 'application|inquiry|message',
      priority: 1,
      isActive: true
    });
  });

  afterAll(async () => {
    await closeDatabasePool();
  });

  /**
   * **Feature: email-integration, Property 9: Unknown email skipping**
   * For any email that doesn't match any platform patterns, the system should
   * skip processing and not create an inquiry
   * **Validates: Requirements 3.5**
   */
  it('Property 9: should identify emails from unknown senders as unknown', async () => {
    // Generate arbitrary emails with senders that don't match known patterns
    const unknownEmailArbitrary = fc.record({
      id: fc.uuid(),
      from: fc.emailAddress().filter(email => 
        !email.endsWith('@facebookmail.com') &&
        !email.endsWith('@zillow.com') &&
        !email.endsWith('@craigslist.org') &&
        !email.endsWith('@turbotenant.com')
      ),
      subject: fc.string({ minLength: 5, maxLength: 100 }),
      body: fc.string({ minLength: 10, maxLength: 500 }),
      receivedDate: fc.date()
    });

    await fc.assert(
      fc.asyncProperty(unknownEmailArbitrary, async (email: RawEmail) => {
        const result = await matcher.identifyPlatform(email);
        
        // Verify that unknown emails are identified as 'unknown'
        expect(result.platformType).toBe('unknown');
        expect(result.confidence).toBe(0);
        expect(result.matchedPattern).toBeUndefined();
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Known platform emails should be identified correctly
   */
  it('Property: should identify emails from known platforms correctly', async () => {
    const knownPlatforms = [
      { domain: '@facebookmail.com', expectedType: 'facebook' },
      { domain: '@zillow.com', expectedType: 'zillow' },
      { domain: '@craigslist.org', expectedType: 'craigslist' },
      { domain: '@turbotenant.com', expectedType: 'turbotenant' }
    ];

    const knownEmailArbitrary = fc.record({
      id: fc.uuid(),
      platform: fc.constantFrom(...knownPlatforms),
      localPart: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')), { minLength: 3, maxLength: 20 }),
      subject: fc.string({ minLength: 5, maxLength: 100 }),
      body: fc.string({ minLength: 10, maxLength: 500 }),
      receivedDate: fc.date()
    });

    await fc.assert(
      fc.asyncProperty(knownEmailArbitrary, async (emailData) => {
        const email: RawEmail = {
          id: emailData.id,
          from: `${emailData.localPart}${emailData.platform.domain}`,
          subject: emailData.subject,
          body: emailData.body,
          receivedDate: emailData.receivedDate
        };

        const result = await matcher.identifyPlatform(email);
        
        // Verify that known platform emails are identified correctly
        expect(result.platformType).toBe(emailData.platform.expectedType);
        expect(result.confidence).toBeGreaterThan(0);
        expect(result.matchedPattern).toBeDefined();
        
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
