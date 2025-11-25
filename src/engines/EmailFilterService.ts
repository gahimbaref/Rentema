import { Pool } from 'pg';
import { EmailFilterConfigRepository } from '../database/repositories/EmailFilterConfigRepository';
import { RawEmail } from './PlatformMatcher';

export interface EmailFilters {
  senderWhitelist: string[]; // email addresses or domains
  subjectKeywords: string[];
  excludeSenders: string[];
  excludeSubjectKeywords: string[];
}

/**
 * Email Filter Service
 * Manages user-defined filters for email processing
 */
export class EmailFilterService {
  private repository: EmailFilterConfigRepository;

  constructor(pool: Pool) {
    this.repository = new EmailFilterConfigRepository(pool);
  }

  /**
   * Save filter configuration for a connection
   */
  async saveFilters(connectionId: string, filters: EmailFilters): Promise<void> {
    const existing = await this.repository.findByConnectionId(connectionId);
    
    if (existing) {
      await this.repository.update(connectionId, filters);
    } else {
      await this.repository.create({
        connectionId,
        ...filters
      });
    }
  }

  /**
   * Retrieve filter configuration for a connection
   */
  async getFilters(connectionId: string): Promise<EmailFilters> {
    const config = await this.repository.findByConnectionId(connectionId);
    
    if (!config) {
      // Return default filters if none exist
      return this.getDefaultFilters();
    }

    return {
      senderWhitelist: config.senderWhitelist,
      subjectKeywords: config.subjectKeywords,
      excludeSenders: config.excludeSenders,
      excludeSubjectKeywords: config.excludeSubjectKeywords
    };
  }

  /**
   * Check if an email passes the configured filters
   * Returns true if the email should be processed, false if it should be skipped
   */
  applyFilters(email: RawEmail, filters: EmailFilters): boolean {
    // Check exclude senders first (highest priority)
    if (filters.excludeSenders.length > 0) {
      const emailLower = email.from.toLowerCase();
      for (const excludeSender of filters.excludeSenders) {
        const excludeLower = excludeSender.toLowerCase();
        // Check if sender matches email address or domain
        if (emailLower === excludeLower || emailLower.endsWith(`@${excludeLower}`) || emailLower.includes(excludeLower)) {
          return false; // Skip this email
        }
      }
    }

    // Check exclude subject keywords
    if (filters.excludeSubjectKeywords.length > 0) {
      const subjectLower = email.subject.toLowerCase();
      for (const keyword of filters.excludeSubjectKeywords) {
        if (subjectLower.includes(keyword.toLowerCase())) {
          return false; // Skip this email
        }
      }
    }

    // If sender whitelist is configured, check if sender matches
    if (filters.senderWhitelist.length > 0) {
      const emailLower = email.from.toLowerCase();
      let senderMatches = false;
      
      for (const whitelistSender of filters.senderWhitelist) {
        const whitelistLower = whitelistSender.toLowerCase();
        // Check if sender matches email address or domain
        if (emailLower === whitelistLower || emailLower.endsWith(`@${whitelistLower}`) || emailLower.includes(whitelistLower)) {
          senderMatches = true;
          break;
        }
      }
      
      if (!senderMatches) {
        return false; // Skip if sender doesn't match whitelist
      }
    }

    // If subject keywords are configured, check if subject contains any keyword
    if (filters.subjectKeywords.length > 0) {
      const subjectLower = email.subject.toLowerCase();
      let keywordMatches = false;
      
      for (const keyword of filters.subjectKeywords) {
        if (subjectLower.includes(keyword.toLowerCase())) {
          keywordMatches = true;
          break;
        }
      }
      
      if (!keywordMatches) {
        return false; // Skip if subject doesn't contain any keyword
      }
    }

    // Email passes all filters
    return true;
  }

  /**
   * Get default filter configuration with common platform senders
   */
  getDefaultFilters(): EmailFilters {
    return {
      senderWhitelist: [
        'facebookmail.com',
        'zillow.com',
        'craigslist.org',
        'turbotenant.com',
        'apartments.com',
        'trulia.com',
        'rent.com'
      ],
      subjectKeywords: [
        'inquiry',
        'interested',
        'rental',
        'apartment',
        'property',
        'lease',
        'tour',
        'viewing',
        'application'
      ],
      excludeSenders: [],
      excludeSubjectKeywords: []
    };
  }
}
