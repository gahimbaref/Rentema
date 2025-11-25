/**
 * Property-based tests for Email Parser
 * Feature: email-integration
 */

import 'dotenv/config';
import * as fc from 'fast-check';
import { EmailParser } from '../../src/engines/EmailParser';
import { RawEmail, PlatformType } from '../../src/engines/PlatformMatcher';

describe('Email Parser Property-Based Tests', () => {
  let parser: EmailParser;

  beforeAll(() => {
    parser = new EmailParser();
  });

  // Arbitraries for generating test data
  const nameArbitrary = fc.tuple(
    fc.constantFrom('John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily'),
    fc.constantFrom('Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia')
  ).map(([first, last]) => `${first} ${last}`);

  const emailArbitrary = fc.emailAddress();

  const phoneArbitrary = fc.tuple(
    fc.integer({ min: 200, max: 999 }),
    fc.integer({ min: 200, max: 999 }),
    fc.integer({ min: 1000, max: 9999 })
  ).map(([area, prefix, line]) => `${area}-${prefix}-${line}`);

  // Generate realistic messages with actual words
  const messageArbitrary = fc.array(
    fc.constantFrom(
      'I am interested in this property',
      'When can I schedule a viewing',
      'Is this still available',
      'What are the lease terms',
      'I would like to apply',
      'Can you provide more details',
      'I have some questions about the rental'
    ),
    { minLength: 1, maxLength: 3 }
  ).map(phrases => phrases.join('. ') + '.');

  const addressArbitrary = fc.tuple(
    fc.integer({ min: 100, max: 9999 }),
    fc.constantFrom('Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm'),
    fc.constantFrom('St', 'Ave', 'Rd', 'Blvd', 'Dr', 'Ln')
  ).map(([num, street, type]) => `${num} ${street} ${type}`);

  /**
   * **Feature: email-integration, Property 10: Tenant name extraction**
   * For any inquiry email containing a tenant name, parsing should extract
   * and include the name in the parsed result
   * **Validates: Requirements 4.1**
   */
  it('Property 10: should extract tenant name when present in Facebook emails', async () => {
    const facebookEmailArbitrary = fc.record({
      id: fc.uuid(),
      name: nameArbitrary,
      message: messageArbitrary,
      receivedDate: fc.date()
    });

    await fc.assert(
      fc.asyncProperty(facebookEmailArbitrary, async (data) => {
        const email: RawEmail = {
          id: data.id,
          from: 'notification@facebookmail.com',
          subject: `New message from ${data.name}`,
          body: `<html><body>${data.name} wrote: ${data.message}</body></html>`,
          receivedDate: data.receivedDate
        };

        const result = await parser.parseEmail(email, 'facebook');

        // Verify tenant name is extracted
        expect(result.tenantName).toBeDefined();
        expect(result.tenantName).toBe(data.name);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 10: should extract tenant name when present in Zillow emails', async () => {
    const zillowEmailArbitrary = fc.record({
      id: fc.uuid(),
      name: nameArbitrary,
      email: emailArbitrary,
      message: messageArbitrary,
      receivedDate: fc.date()
    });

    await fc.assert(
      fc.asyncProperty(zillowEmailArbitrary, async (data) => {
        const email: RawEmail = {
          id: data.id,
          from: 'noreply@zillow.com',
          subject: 'New inquiry about your rental',
          body: `Name: ${data.name}\n\nEmail: ${data.email}\n\nMessage: ${data.message}`,
          receivedDate: data.receivedDate
        };

        const result = await parser.parseEmail(email, 'zillow');

        // Verify tenant name is extracted
        expect(result.tenantName).toBeDefined();
        expect(result.tenantName).toBe(data.name);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: email-integration, Property 11: Message content extraction**
   * For any inquiry email, parsing should extract the message content
   * **Validates: Requirements 4.2**
   */
  it('Property 11: should extract message content from all platform emails', async () => {
    const platforms: PlatformType[] = ['facebook', 'zillow', 'craigslist', 'turbotenant'];
    
    const emailWithMessageArbitrary = fc.record({
      id: fc.uuid(),
      platform: fc.constantFrom(...platforms),
      name: nameArbitrary,
      message: messageArbitrary,
      receivedDate: fc.date()
    });

    await fc.assert(
      fc.asyncProperty(emailWithMessageArbitrary, async (data) => {
        let email: RawEmail;

        // Create platform-specific email format
        switch (data.platform) {
          case 'facebook':
            email = {
              id: data.id,
              from: 'notification@facebookmail.com',
              subject: `Message from ${data.name}`,
              body: `${data.name} wrote: ${data.message}`,
              receivedDate: data.receivedDate
            };
            break;
          case 'zillow':
            email = {
              id: data.id,
              from: 'noreply@zillow.com',
              subject: 'Rental inquiry',
              body: `Name: ${data.name}\nMessage: ${data.message}`,
              receivedDate: data.receivedDate
            };
            break;
          case 'craigslist':
            email = {
              id: data.id,
              from: 'reply@craigslist.org',
              subject: 'Reply to your listing',
              body: data.message,
              receivedDate: data.receivedDate
            };
            break;
          case 'turbotenant':
            email = {
              id: data.id,
              from: 'notifications@turbotenant.com',
              subject: 'New inquiry',
              body: `Name: ${data.name}\nMessage: ${data.message}`,
              receivedDate: data.receivedDate
            };
            break;
          default:
            throw new Error('Unexpected platform');
        }

        const result = await parser.parseEmail(email, data.platform);

        // Verify message content is extracted
        expect(result.message).toBeDefined();
        expect(result.message.length).toBeGreaterThan(0);
        // Message should contain at least part of the original message (normalized)
        // stripHtml normalizes whitespace, so we check for the first word
        const firstWord = data.message.trim().split(/\s+/)[0];
        if (firstWord && firstWord.length > 0) {
          expect(result.message).toContain(firstWord);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: email-integration, Property 12: Property reference extraction**
   * For any inquiry email containing property information, parsing should extract
   * the property address or listing reference
   * **Validates: Requirements 4.3**
   */
  it('Property 12: should extract property reference when present', async () => {
    const emailWithPropertyArbitrary = fc.record({
      id: fc.uuid(),
      name: nameArbitrary,
      address: addressArbitrary,
      message: messageArbitrary,
      receivedDate: fc.date()
    });

    await fc.assert(
      fc.asyncProperty(emailWithPropertyArbitrary, async (data) => {
        // Test with Zillow format (includes property in body)
        const email: RawEmail = {
          id: data.id,
          from: 'noreply@zillow.com',
          subject: `Inquiry for ${data.address}`,
          body: `Name: ${data.name}\nProperty: ${data.address}\nMessage: ${data.message}`,
          receivedDate: data.receivedDate
        };

        const result = await parser.parseEmail(email, 'zillow');

        // Verify property reference is extracted
        expect(result.propertyAddress || result.propertyReference).toBeDefined();
        if (result.propertyAddress) {
          expect(result.propertyAddress).toContain(data.address.split(' ')[0]); // At least street number
        }
        if (result.propertyReference) {
          expect(result.propertyReference).toContain(data.address.split(' ')[0]);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: email-integration, Property 13: Contact information extraction**
   * For any inquiry email containing contact information, parsing should extract
   * the tenant's email or phone number
   * **Validates: Requirements 4.4**
   */
  it('Property 13: should extract email contact information when present', async () => {
    const emailWithContactArbitrary = fc.record({
      id: fc.uuid(),
      name: nameArbitrary,
      email: emailArbitrary.filter(e => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(e)),
      message: messageArbitrary,
      receivedDate: fc.date()
    });

    await fc.assert(
      fc.asyncProperty(emailWithContactArbitrary, async (data) => {
        const email: RawEmail = {
          id: data.id,
          from: 'noreply@zillow.com',
          subject: 'Rental inquiry',
          body: `Name: ${data.name}\n\nEmail: ${data.email}\n\nMessage: ${data.message}`,
          receivedDate: data.receivedDate
        };

        const result = await parser.parseEmail(email, 'zillow');

        // Verify email contact is extracted
        expect(result.tenantEmail).toBeDefined();
        expect(result.tenantEmail).toBe(data.email);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 13: should extract phone contact information when present', async () => {
    const emailWithPhoneArbitrary = fc.record({
      id: fc.uuid(),
      name: nameArbitrary,
      phone: phoneArbitrary,
      message: messageArbitrary,
      receivedDate: fc.date()
    });

    await fc.assert(
      fc.asyncProperty(emailWithPhoneArbitrary, async (data) => {
        const email: RawEmail = {
          id: data.id,
          from: 'noreply@zillow.com',
          subject: 'Rental inquiry',
          body: `Name: ${data.name}\nPhone: ${data.phone}\nMessage: ${data.message}`,
          receivedDate: data.receivedDate
        };

        const result = await parser.parseEmail(email, 'zillow');

        // Verify phone contact is extracted
        expect(result.tenantPhone).toBeDefined();
        // Phone should contain the digits from the original
        const originalDigits = data.phone.replace(/\D/g, '');
        const extractedDigits = result.tenantPhone!.replace(/\D/g, '');
        expect(extractedDigits).toBe(originalDigits);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: email-integration, Property 14: Graceful partial parsing**
   * For any inquiry email where required fields cannot be extracted, the system
   * should create an inquiry with available data and flag it for review
   * **Validates: Requirements 4.5**
   */
  it('Property 14: should create partial inquiry with available data when fields are missing', async () => {
    const partialEmailArbitrary = fc.record({
      id: fc.uuid(),
      platform: fc.constantFrom<PlatformType>('facebook', 'zillow', 'craigslist', 'turbotenant'),
      receivedDate: fc.date()
    });

    await fc.assert(
      fc.asyncProperty(partialEmailArbitrary, async (data) => {
        // Create email with minimal/missing information
        const email: RawEmail = {
          id: data.id,
          from: 'unknown@example.com',
          subject: 'Inquiry',
          body: 'Some text without clear structure',
          receivedDate: data.receivedDate
        };

        const result = await parser.parseEmail(email, data.platform);

        // Verify that parsing doesn't crash and returns a result
        expect(result).toBeDefined();
        expect(result.originalEmailId).toBe(data.id);
        expect(result.receivedDate).toEqual(data.receivedDate);
        expect(result.platformType).toBe(data.platform);
        
        // Verify that parsing errors are recorded
        expect(result.parsingErrors).toBeDefined();
        expect(Array.isArray(result.parsingErrors)).toBe(true);
        
        // When message extraction fails, it should be flagged
        if (!result.message || result.message.trim().length === 0) {
          expect(result.parsingErrors.length).toBeGreaterThan(0);
          expect(result.parsingErrors.some((e: string) => e.includes('message'))).toBe(true);
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('Property 14: should preserve available data even when some fields are missing', async () => {
    const partialDataArbitrary = fc.record({
      id: fc.uuid(),
      name: nameArbitrary,
      message: messageArbitrary,
      receivedDate: fc.date()
    });

    await fc.assert(
      fc.asyncProperty(partialDataArbitrary, async (data) => {
        // Create Zillow email with name and message but no contact info
        const email: RawEmail = {
          id: data.id,
          from: 'noreply@zillow.com',
          subject: 'Rental inquiry',
          body: `Name: ${data.name}\n\nMessage: ${data.message}`,
          receivedDate: data.receivedDate
        };

        const result = await parser.parseEmail(email, 'zillow');

        // Verify that available fields are extracted
        expect(result.tenantName).toBe(data.name);
        expect(result.message).toContain(data.message.split('.')[0]);
        
        // Verify that missing fields are undefined (not causing errors)
        expect(result.tenantEmail).toBeUndefined();
        expect(result.tenantPhone).toBeUndefined();
        
        // Should not have parsing errors since message was extracted
        expect(result.parsingErrors.length).toBe(0);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});