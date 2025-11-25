/**
 * Unit tests for sample emails
 * Verifies that sample emails can be parsed correctly
 */

import { SAMPLE_EMAILS, getSampleEmail, getAllSampleEmails, getSampleEmailsByPlatform } from '../../src/data/sampleEmails';
import { EmailParser } from '../../src/engines/EmailParser';
import { PlatformType } from '../../src/engines/PlatformMatcher';

describe('Sample Emails', () => {
  const parser = new EmailParser();

  describe('Sample Email Structure', () => {
    it('should have all required fields', () => {
      Object.values(SAMPLE_EMAILS).forEach(sample => {
        expect(sample.name).toBeDefined();
        expect(sample.platform).toBeDefined();
        expect(sample.from).toBeDefined();
        expect(sample.subject).toBeDefined();
        expect(sample.body).toBeDefined();
        expect(sample.description).toBeDefined();
      });
    });

    it('should have samples for all platforms', () => {
      const platforms = ['facebook', 'zillow', 'craigslist', 'turbotenant'];
      
      platforms.forEach(platform => {
        const samples = getSampleEmailsByPlatform(platform);
        expect(samples.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Sample Email Retrieval', () => {
    it('should retrieve sample by key', () => {
      const sample = getSampleEmail('facebook');
      expect(sample).toBeDefined();
      expect(sample?.platform).toBe('facebook');
    });

    it('should return undefined for invalid key', () => {
      const sample = getSampleEmail('invalid');
      expect(sample).toBeUndefined();
    });

    it('should retrieve all samples', () => {
      const samples = getAllSampleEmails();
      expect(samples.length).toBeGreaterThan(0);
      expect(samples.length).toBe(Object.keys(SAMPLE_EMAILS).length);
    });

    it('should filter samples by platform', () => {
      const facebookSamples = getSampleEmailsByPlatform('facebook');
      facebookSamples.forEach(sample => {
        expect(sample.platform).toBe('facebook');
      });
    });
  });

  describe('Sample Email Parsing', () => {
    it('should parse Facebook sample successfully', async () => {
      const sample = getSampleEmail('facebook');
      expect(sample).toBeDefined();
      
      const result = await parser.parseEmail({
        id: 'test-1',
        from: sample!.from,
        subject: sample!.subject,
        body: sample!.body,
        receivedDate: new Date()
      }, 'facebook' as PlatformType);

      expect(result.tenantName).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.parsingErrors.length).toBe(0);
    });

    it('should parse Zillow sample successfully', async () => {
      const sample = getSampleEmail('zillow');
      expect(sample).toBeDefined();
      
      const result = await parser.parseEmail({
        id: 'test-2',
        from: sample!.from,
        subject: sample!.subject,
        body: sample!.body,
        receivedDate: new Date()
      }, 'zillow' as PlatformType);

      expect(result.tenantName).toBeDefined();
      expect(result.tenantEmail).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.parsingErrors.length).toBe(0);
    });

    it('should parse Craigslist sample successfully', async () => {
      const sample = getSampleEmail('craigslist');
      expect(sample).toBeDefined();
      
      const result = await parser.parseEmail({
        id: 'test-3',
        from: sample!.from,
        subject: sample!.subject,
        body: sample!.body,
        receivedDate: new Date()
      }, 'craigslist' as PlatformType);

      expect(result.message).toBeDefined();
      expect(result.message.length).toBeGreaterThan(0);
      expect(result.parsingErrors.length).toBe(0);
    });

    it('should parse TurboTenant sample successfully', async () => {
      const sample = getSampleEmail('turbotenant');
      expect(sample).toBeDefined();
      
      const result = await parser.parseEmail({
        id: 'test-4',
        from: sample!.from,
        subject: sample!.subject,
        body: sample!.body,
        receivedDate: new Date()
      }, 'turbotenant' as PlatformType);

      expect(result.tenantName).toBeDefined();
      expect(result.tenantEmail).toBeDefined();
      expect(result.message).toBeDefined();
      expect(result.parsingErrors.length).toBe(0);
    });

    it('should handle HTML sample correctly', async () => {
      const sample = getSampleEmail('facebookHtml');
      expect(sample).toBeDefined();
      
      const result = await parser.parseEmail({
        id: 'test-5',
        from: sample!.from,
        subject: sample!.subject,
        body: sample!.body,
        receivedDate: new Date()
      }, 'facebook' as PlatformType);

      expect(result.message).toBeDefined();
      expect(result.message).not.toContain('<html>');
      expect(result.message).not.toContain('<div>');
      expect(result.parsingErrors.length).toBe(0);
    });

    it('should handle minimal info sample gracefully', async () => {
      const sample = getSampleEmail('zillowMinimal');
      expect(sample).toBeDefined();
      
      const result = await parser.parseEmail({
        id: 'test-6',
        from: sample!.from,
        subject: sample!.subject,
        body: sample!.body,
        receivedDate: new Date()
      }, 'zillow' as PlatformType);

      expect(result.message).toBeDefined();
      // Should create inquiry even with minimal info
      expect(result.platformType).toBe('zillow');
    });
  });

  describe('Sample Email Sender Patterns', () => {
    it('should have valid sender addresses', () => {
      Object.values(SAMPLE_EMAILS).forEach(sample => {
        expect(sample.from).toMatch(/@/);
        expect(sample.from.length).toBeGreaterThan(5);
      });
    });

    it('should match platform patterns', () => {
      const facebookSample = getSampleEmail('facebook');
      expect(facebookSample?.from).toMatch(/@facebookmail\.com$/);

      const zillowSample = getSampleEmail('zillow');
      expect(zillowSample?.from).toMatch(/@zillow\.com$/);

      const craigslistSample = getSampleEmail('craigslist');
      expect(craigslistSample?.from).toMatch(/@craigslist\.org$/);

      const turbotenantSample = getSampleEmail('turbotenant');
      expect(turbotenantSample?.from).toMatch(/@turbotenant\.com$/);
    });
  });
});
