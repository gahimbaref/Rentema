import { Pool } from 'pg';
import { PlatformPatternRepository, PlatformPattern } from '../database/repositories/PlatformPatternRepository';

export interface RawEmail {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedDate: Date;
}

export type PlatformType = 'facebook' | 'zillow' | 'craigslist' | 'turbotenant' | 'unknown';

export interface PlatformMatch {
  platformType: PlatformType;
  confidence: number; // 0-1
  matchedPattern?: string;
}

/**
 * Platform Matcher
 * Identifies which listing platform sent an email using pattern matching
 */
export class PlatformMatcher {
  private repository: PlatformPatternRepository;
  private patternsCache: PlatformPattern[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(pool: Pool) {
    this.repository = new PlatformPatternRepository(pool);
  }

  /**
   * Identify which platform sent an email
   * Returns platform type and confidence score
   */
  async identifyPlatform(email: RawEmail): Promise<PlatformMatch> {
    const patterns = await this.getPatterns();
    
    let bestMatch: PlatformMatch = {
      platformType: 'unknown',
      confidence: 0
    };

    for (const pattern of patterns) {
      const match = this.matchPattern(email, pattern);
      
      if (match.confidence > bestMatch.confidence) {
        bestMatch = match;
      }
    }

    return bestMatch;
  }

  /**
   * Add a new platform pattern
   */
  async addPlatformPattern(pattern: Omit<PlatformPattern, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlatformPattern> {
    this.invalidateCache();
    return await this.repository.create(pattern);
  }

  /**
   * Get all platform patterns
   */
  async getPlatformPatterns(): Promise<PlatformPattern[]> {
    return await this.getPatterns();
  }

  /**
   * Match an email against a specific pattern
   */
  private matchPattern(email: RawEmail, pattern: PlatformPattern): PlatformMatch {
    let confidence = 0;
    let senderMatches = false;

    // Check sender pattern (required)
    try {
      const senderRegex = new RegExp(pattern.senderPattern, 'i');
      if (senderRegex.test(email.from)) {
        senderMatches = true;
        confidence += 0.6; // Sender match is weighted heavily
      }
    } catch (error) {
      // Invalid regex, skip this pattern
      return {
        platformType: 'unknown',
        confidence: 0
      };
    }

    // If sender doesn't match, return unknown immediately
    // Sender match is required for platform identification
    if (!senderMatches) {
      return {
        platformType: 'unknown',
        confidence: 0
      };
    }

    // Check subject pattern (optional but adds confidence)
    if (pattern.subjectPattern) {
      try {
        const subjectRegex = new RegExp(pattern.subjectPattern, 'i');
        if (subjectRegex.test(email.subject)) {
          confidence += 0.4; // Subject match adds additional confidence
        }
      } catch (error) {
        // Invalid regex, skip subject check
      }
    }

    // At this point, sender matched, so we have a valid platform match
    return {
      platformType: pattern.platformType as PlatformType,
      confidence: confidence,
      matchedPattern: pattern.id
    };
  }

  /**
   * Get patterns from cache or database
   */
  private async getPatterns(): Promise<PlatformPattern[]> {
    const now = Date.now();
    
    if (this.patternsCache && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.patternsCache;
    }

    this.patternsCache = await this.repository.findAll();
    this.cacheTimestamp = now;
    
    return this.patternsCache;
  }

  /**
   * Invalidate the patterns cache
   */
  private invalidateCache(): void {
    this.patternsCache = null;
    this.cacheTimestamp = 0;
  }
}
