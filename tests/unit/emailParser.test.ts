/**
 * Unit tests for Email Parser
 */

import { EmailParser } from '../../src/engines/EmailParser';
import { RawEmail } from '../../src/engines/PlatformMatcher';

describe('EmailParser', () => {
  let parser: EmailParser;

  beforeEach(() => {
    parser = new EmailParser();
  });

  describe('testParse', () => {
    it('should parse email without creating inquiry and return extracted fields', async () => {
      const email: RawEmail = {
        id: 'test-123',
        from: 'noreply@zillow.com',
        subject: 'New inquiry',
        body: 'Name: John Doe\n\nEmail: john@example.com\n\nMessage: I am interested in this property',
        receivedDate: new Date()
      };

      const result = await parser.testParse(email, 'zillow');

      expect(result.success).toBe(true);
      expect(result.extractedFields.tenantName).toBe('John Doe');
      expect(result.extractedFields.tenantEmail).toBe('john@example.com');
      expect(result.extractedFields.message).toContain('interested');
      expect(result.errors).toHaveLength(0);
    });

    it('should return missing fields when data cannot be extracted', async () => {
      const email: RawEmail = {
        id: 'test-456',
        from: 'unknown@example.com',
        subject: 'Test',
        body: 'Incomplete data',
        receivedDate: new Date()
      };

      const result = await parser.testParse(email, 'zillow');

      expect(result.success).toBe(false);
      expect(result.missingFields).toContain('tenantName');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should display parsing errors in test mode', async () => {
      const email: RawEmail = {
        id: 'test-789',
        from: 'test@example.com',
        subject: 'Empty',
        body: '',
        receivedDate: new Date()
      };

      const result = await parser.testParse(email, 'facebook');

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Could not extract message content');
    });
  });

  describe('parseEmail', () => {
    it('should parse Facebook emails correctly', async () => {
      const email: RawEmail = {
        id: 'fb-123',
        from: 'notification@facebookmail.com',
        subject: 'New message from Jane Smith',
        body: 'Jane Smith wrote: I would like to schedule a viewing',
        receivedDate: new Date()
      };

      const result = await parser.parseEmail(email, 'facebook');

      expect(result.tenantName).toBe('Jane Smith');
      expect(result.message).toContain('schedule a viewing');
      expect(result.platformType).toBe('facebook');
      expect(result.parsingErrors).toHaveLength(0);
    });

    it('should handle unknown platform types', async () => {
      const email: RawEmail = {
        id: 'unknown-123',
        from: 'test@example.com',
        subject: 'Test',
        body: 'Test message',
        receivedDate: new Date()
      };

      const result = await parser.parseEmail(email, 'unknown');

      expect(result.parsingErrors.length).toBeGreaterThan(0);
      expect(result.parsingErrors[0]).toContain('Unknown platform');
    });
  });
});
