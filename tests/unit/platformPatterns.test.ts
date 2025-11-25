/**
 * Unit tests for platform pattern validation
 */

import { 
  DEFAULT_PLATFORM_PATTERNS, 
  validateSenderPattern, 
  validateSubjectPattern,
  getDefaultPattern 
} from '../../src/database/seeds/platformPatterns';

describe('Platform Patterns', () => {
  describe('Default Patterns', () => {
    it('should have patterns for all supported platforms', () => {
      const platforms = ['facebook', 'zillow', 'craigslist', 'turbotenant'];
      
      platforms.forEach(platform => {
        const pattern = getDefaultPattern(platform);
        expect(pattern).toBeDefined();
        expect(pattern?.platformType).toBe(platform);
      });
    });

    it('should have valid regex patterns', () => {
      DEFAULT_PLATFORM_PATTERNS.forEach(pattern => {
        // Should not throw when creating regex
        expect(() => new RegExp(pattern.senderPattern)).not.toThrow();
        if (pattern.subjectPattern) {
          expect(() => new RegExp(pattern.subjectPattern as string)).not.toThrow();
        }
      });
    });
  });

  describe('Sender Pattern Validation', () => {
    it('should match Facebook emails', () => {
      expect(validateSenderPattern('notification@facebookmail.com', 'facebook')).toBe(true);
      expect(validateSenderPattern('noreply@facebookmail.com', 'facebook')).toBe(true);
      expect(validateSenderPattern('test@facebook.com', 'facebook')).toBe(false);
    });

    it('should match Zillow emails', () => {
      expect(validateSenderPattern('noreply@zillow.com', 'zillow')).toBe(true);
      expect(validateSenderPattern('notifications@zillow.com', 'zillow')).toBe(true);
      expect(validateSenderPattern('test@zillowgroup.com', 'zillow')).toBe(false);
    });

    it('should match Craigslist emails', () => {
      expect(validateSenderPattern('reply-abc123@craigslist.org', 'craigslist')).toBe(true);
      expect(validateSenderPattern('reply-xyz789def456@craigslist.org', 'craigslist')).toBe(true);
      expect(validateSenderPattern('test@craigslist.com', 'craigslist')).toBe(false);
    });

    it('should match TurboTenant emails', () => {
      expect(validateSenderPattern('notifications@turbotenant.com', 'turbotenant')).toBe(true);
      expect(validateSenderPattern('noreply@turbotenant.com', 'turbotenant')).toBe(true);
      expect(validateSenderPattern('test@turbotenant.net', 'turbotenant')).toBe(false);
    });
  });

  describe('Subject Pattern Validation', () => {
    it('should match Facebook subjects', () => {
      expect(validateSubjectPattern('New message from John', 'facebook')).toBe(true);
      expect(validateSubjectPattern('Marketplace inquiry', 'facebook')).toBe(true);
      expect(validateSubjectPattern('Someone is interested in your listing', 'facebook')).toBe(true);
      expect(validateSubjectPattern('Random subject', 'facebook')).toBe(false);
    });

    it('should match Zillow subjects', () => {
      expect(validateSubjectPattern('New inquiry for your property', 'zillow')).toBe(true);
      expect(validateSubjectPattern('Rental contact request', 'zillow')).toBe(true);
      expect(validateSubjectPattern('Property listing inquiry', 'zillow')).toBe(true);
      expect(validateSubjectPattern('Random subject', 'zillow')).toBe(false);
    });

    it('should match Craigslist subjects', () => {
      expect(validateSubjectPattern('Reply to: Your listing', 'craigslist')).toBe(true);
      expect(validateSubjectPattern('Re: Apartment for rent', 'craigslist')).toBe(true);
      expect(validateSubjectPattern('Inquiry about your post', 'craigslist')).toBe(true);
      expect(validateSubjectPattern('Random subject', 'craigslist')).toBe(false);
    });

    it('should match TurboTenant subjects', () => {
      expect(validateSubjectPattern('New rental application', 'turbotenant')).toBe(true);
      expect(validateSubjectPattern('Inquiry about your property', 'turbotenant')).toBe(true);
      expect(validateSubjectPattern('Message from applicant', 'turbotenant')).toBe(true);
      expect(validateSubjectPattern('Random subject', 'turbotenant')).toBe(false);
    });
  });

  describe('Pattern Priority', () => {
    it('should have consistent priority across patterns', () => {
      const priorities = DEFAULT_PLATFORM_PATTERNS.map(p => p.priority);
      const uniquePriorities = new Set(priorities);
      
      // All patterns currently have priority 1
      expect(uniquePriorities.size).toBe(1);
      expect(uniquePriorities.has(1)).toBe(true);
    });
  });

  describe('Pattern Activity', () => {
    it('should have all patterns active by default', () => {
      DEFAULT_PLATFORM_PATTERNS.forEach(pattern => {
        expect(pattern.isActive).toBe(true);
      });
    });
  });
});
