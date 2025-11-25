/**
 * Platform Pattern Seeds
 * Default patterns for identifying emails from various rental platforms
 * 
 * These patterns are used by the PlatformMatcher to identify which platform
 * sent an inquiry email based on sender address and subject line.
 */

import { Pool } from 'pg';

export interface PlatformPatternSeed {
  platformType: string;
  senderPattern: string;
  subjectPattern?: string;
  priority: number;
  isActive: boolean;
  description: string;
}

/**
 * Default platform patterns
 * These match the patterns in database/schema.sql
 */
export const DEFAULT_PLATFORM_PATTERNS: PlatformPatternSeed[] = [
  {
    platformType: 'facebook',
    senderPattern: '@facebookmail\\.com',
    subjectPattern: 'marketplace|inquiry|message|interested|listing',
    priority: 1,
    isActive: true,
    description: 'Facebook Marketplace inquiry emails'
  },
  {
    platformType: 'zillow',
    senderPattern: '@zillow\\.com',
    subjectPattern: 'inquiry|rental|contact|property|listing',
    priority: 1,
    isActive: true,
    description: 'Zillow rental inquiry emails'
  },
  {
    platformType: 'craigslist',
    senderPattern: '@craigslist\\.org',
    subjectPattern: 'reply|inquiry|re:',
    priority: 1,
    isActive: true,
    description: 'Craigslist inquiry emails (anonymized sender)'
  },
  {
    platformType: 'turbotenant',
    senderPattern: '@turbotenant\\.com',
    subjectPattern: 'application|inquiry|message|rental',
    priority: 1,
    isActive: true,
    description: 'TurboTenant rental application and inquiry emails'
  },
  {
    platformType: 'direct',
    senderPattern: '.*',
    subjectPattern: 'rent|rental|apartment|property|lease|interested|inquiry|available',
    priority: 10,
    isActive: true,
    description: 'Direct inquiry emails from prospective tenants (fallback pattern)'
  }
];

/**
 * Seed platform patterns into the database
 * This function can be called to ensure default patterns exist
 */
export async function seedPlatformPatterns(pool: Pool): Promise<void> {
  try {
    console.log('Seeding platform patterns...');
    
    for (const pattern of DEFAULT_PLATFORM_PATTERNS) {
      await pool.query(
        `INSERT INTO platform_patterns (platform_type, sender_pattern, subject_pattern, priority, is_active)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [
          pattern.platformType,
          pattern.senderPattern,
          pattern.subjectPattern || null,
          pattern.priority,
          pattern.isActive
        ]
      );
      console.log(`  ✓ Seeded pattern for ${pattern.platformType}`);
    }
    
    console.log('Platform patterns seeded successfully');
  } catch (error) {
    console.error('Error seeding platform patterns:', error);
    throw error;
  }
}

/**
 * Get default pattern for a specific platform
 */
export function getDefaultPattern(platformType: string): PlatformPatternSeed | undefined {
  return DEFAULT_PLATFORM_PATTERNS.find(p => p.platformType === platformType);
}

/**
 * Validate that a sender email matches a platform pattern
 */
export function validateSenderPattern(email: string, platformType: string): boolean {
  const pattern = getDefaultPattern(platformType);
  if (!pattern) return false;
  
  const regex = new RegExp(pattern.senderPattern, 'i');
  return regex.test(email);
}

/**
 * Validate that a subject line matches a platform pattern
 */
export function validateSubjectPattern(subject: string, platformType: string): boolean {
  const pattern = getDefaultPattern(platformType);
  if (!pattern || !pattern.subjectPattern) return true; // No subject pattern means any subject is valid
  
  const regex = new RegExp(pattern.subjectPattern, 'i');
  return regex.test(subject);
}
