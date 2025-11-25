import { PlatformMatcher, RawEmail } from '../../src/engines/PlatformMatcher';
import { PlatformPattern } from '../../src/database/repositories/PlatformPatternRepository';

// Mock the repository
const mockPatterns: PlatformPattern[] = [
  {
    id: '1',
    platformType: 'facebook',
    senderPattern: '@facebookmail\\.com$',
    subjectPattern: 'marketplace|inquiry|message',
    priority: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '2',
    platformType: 'zillow',
    senderPattern: '@zillow\\.com$',
    subjectPattern: 'inquiry|rental|contact',
    priority: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '3',
    platformType: 'craigslist',
    senderPattern: '@craigslist\\.org$',
    subjectPattern: 'reply|inquiry',
    priority: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: '4',
    platformType: 'turbotenant',
    senderPattern: '@turbotenant\\.com$',
    subjectPattern: 'application|inquiry|message',
    priority: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

// Create a mock pool
const mockPool: any = {
  query: jest.fn()
};

// Mock the repository methods
jest.mock('../../src/database/repositories/PlatformPatternRepository', () => {
  return {
    PlatformPatternRepository: jest.fn().mockImplementation(() => {
      return {
        findAll: jest.fn().mockResolvedValue(mockPatterns),
        create: jest.fn().mockImplementation((pattern) => {
          const newPattern = {
            ...pattern,
            id: String(mockPatterns.length + 1),
            createdAt: new Date(),
            updatedAt: new Date()
          };
          mockPatterns.push(newPattern);
          return Promise.resolve(newPattern);
        })
      };
    })
  };
});

describe('PlatformMatcher', () => {
  let matcher: PlatformMatcher;

  beforeEach(() => {
    // Reset mock patterns to original state
    mockPatterns.length = 0;
    mockPatterns.push(
      {
        id: '1',
        platformType: 'facebook',
        senderPattern: '@facebookmail\\.com$',
        subjectPattern: 'marketplace|inquiry|message',
        priority: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '2',
        platformType: 'zillow',
        senderPattern: '@zillow\\.com$',
        subjectPattern: 'inquiry|rental|contact',
        priority: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '3',
        platformType: 'craigslist',
        senderPattern: '@craigslist\\.org$',
        subjectPattern: 'reply|inquiry',
        priority: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: '4',
        platformType: 'turbotenant',
        senderPattern: '@turbotenant\\.com$',
        subjectPattern: 'application|inquiry|message',
        priority: 1,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    );
    matcher = new PlatformMatcher(mockPool);
  });

  describe('Facebook Marketplace email identification', () => {
    it('should identify Facebook Marketplace email with sender and subject match', async () => {
      const email: RawEmail = {
        id: 'test-1',
        from: 'notification@facebookmail.com',
        subject: 'New marketplace inquiry about your listing',
        body: 'Someone is interested in your property',
        receivedDate: new Date()
      };

      const result = await matcher.identifyPlatform(email);

      expect(result.platformType).toBe('facebook');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.matchedPattern).toBeDefined();
    });

    it('should identify Facebook email with only sender match', async () => {
      const email: RawEmail = {
        id: 'test-2',
        from: 'noreply@facebookmail.com',
        subject: 'Some other subject',
        body: 'Email body',
        receivedDate: new Date()
      };

      const result = await matcher.identifyPlatform(email);

      expect(result.platformType).toBe('facebook');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Zillow email identification', () => {
    it('should identify Zillow email with sender and subject match', async () => {
      const email: RawEmail = {
        id: 'test-3',
        from: 'rentals@zillow.com',
        subject: 'New rental inquiry for your property',
        body: 'A prospective tenant has contacted you',
        receivedDate: new Date()
      };

      const result = await matcher.identifyPlatform(email);

      expect(result.platformType).toBe('zillow');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.matchedPattern).toBeDefined();
    });

    it('should identify Zillow email with only sender match', async () => {
      const email: RawEmail = {
        id: 'test-4',
        from: 'notifications@zillow.com',
        subject: 'Update on your listing',
        body: 'Email body',
        receivedDate: new Date()
      };

      const result = await matcher.identifyPlatform(email);

      expect(result.platformType).toBe('zillow');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Craigslist email identification', () => {
    it('should identify Craigslist email with sender and subject match', async () => {
      const email: RawEmail = {
        id: 'test-5',
        from: 'reply-abc123@craigslist.org',
        subject: 'Reply to your rental listing',
        body: 'I am interested in your property',
        receivedDate: new Date()
      };

      const result = await matcher.identifyPlatform(email);

      expect(result.platformType).toBe('craigslist');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.matchedPattern).toBeDefined();
    });

    it('should identify Craigslist email with only sender match', async () => {
      const email: RawEmail = {
        id: 'test-6',
        from: 'noreply@craigslist.org',
        subject: 'Your posting has been published',
        body: 'Email body',
        receivedDate: new Date()
      };

      const result = await matcher.identifyPlatform(email);

      expect(result.platformType).toBe('craigslist');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('TurboTenant email identification', () => {
    it('should identify TurboTenant email with sender and subject match', async () => {
      const email: RawEmail = {
        id: 'test-7',
        from: 'notifications@turbotenant.com',
        subject: 'New rental application received',
        body: 'A tenant has submitted an application',
        receivedDate: new Date()
      };

      const result = await matcher.identifyPlatform(email);

      expect(result.platformType).toBe('turbotenant');
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.matchedPattern).toBeDefined();
    });

    it('should identify TurboTenant email with only sender match', async () => {
      const email: RawEmail = {
        id: 'test-8',
        from: 'support@turbotenant.com',
        subject: 'Account update',
        body: 'Email body',
        receivedDate: new Date()
      };

      const result = await matcher.identifyPlatform(email);

      expect(result.platformType).toBe('turbotenant');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('Unknown email handling', () => {
    it('should return unknown for unrecognized sender', async () => {
      const email: RawEmail = {
        id: 'test-9',
        from: 'someone@example.com',
        subject: 'Random email',
        body: 'This is not from a known platform',
        receivedDate: new Date()
      };

      const result = await matcher.identifyPlatform(email);

      expect(result.platformType).toBe('unknown');
      expect(result.confidence).toBe(0);
      expect(result.matchedPattern).toBeUndefined();
    });

    it('should return unknown for email with no sender match even with matching subject', async () => {
      const email: RawEmail = {
        id: 'test-10',
        from: 'random@example.com',
        subject: 'inquiry about rental property',
        body: 'Email body',
        receivedDate: new Date()
      };

      const result = await matcher.identifyPlatform(email);

      expect(result.platformType).toBe('unknown');
      expect(result.confidence).toBe(0);
    });
  });

  describe('Pattern priority', () => {
    it('should return the best matching pattern when multiple patterns could match', async () => {
      const email: RawEmail = {
        id: 'test-11',
        from: 'notification@facebookmail.com',
        subject: 'New marketplace message',
        body: 'Email body',
        receivedDate: new Date()
      };

      const result = await matcher.identifyPlatform(email);

      expect(result.platformType).toBe('facebook');
      expect(result.confidence).toBeGreaterThan(0);
    });
  });
});
