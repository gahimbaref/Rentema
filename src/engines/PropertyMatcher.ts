import { Pool } from 'pg';
import { PropertyRepository } from '../database/repositories/PropertyRepository';

export interface PropertyMatch {
  matched: boolean;
  propertyId?: string;
  confidence: number;
  matchedAddress?: string;
}

export class PropertyMatcher {
  private propertyRepository: PropertyRepository;

  constructor(pool: Pool) {
    this.propertyRepository = new PropertyRepository(pool);
  }

  /**
   * Match property by reference (exact property ID)
   */
  async matchProperty(propertyReference: string, managerId: string): Promise<PropertyMatch> {
    // Try to match by property ID first
    const property = await this.propertyRepository.findById(propertyReference);
    
    if (property && property.managerId === managerId) {
      return {
        matched: true,
        propertyId: property.id,
        confidence: 1.0,
        matchedAddress: property.address
      };
    }

    return {
      matched: false,
      confidence: 0
    };
  }

  /**
   * Match property by address using fuzzy matching with Levenshtein distance
   */
  async matchByAddress(address: string, managerId: string): Promise<PropertyMatch> {
    const properties = await this.propertyRepository.findByManagerId(managerId);
    
    if (properties.length === 0) {
      return {
        matched: false,
        confidence: 0
      };
    }

    const normalizedSearchAddress = this.normalizeAddress(address);
    let bestMatch: PropertyMatch = {
      matched: false,
      confidence: 0
    };

    for (const property of properties) {
      const normalizedPropertyAddress = this.normalizeAddress(property.address);
      const distance = this.levenshteinDistance(normalizedSearchAddress, normalizedPropertyAddress);
      const maxLength = Math.max(normalizedSearchAddress.length, normalizedPropertyAddress.length);
      
      // Calculate similarity as 1 - (distance / maxLength)
      const similarity = maxLength > 0 ? 1 - (distance / maxLength) : 0;
      
      if (similarity > bestMatch.confidence) {
        bestMatch = {
          matched: similarity >= 0.8, // 80% similarity threshold
          propertyId: property.id,
          confidence: similarity,
          matchedAddress: property.address
        };
      }
    }

    return bestMatch;
  }

  /**
   * Normalize address for comparison
   * - Remove punctuation and extra whitespace
   * - Standardize abbreviations
   * - Convert to lowercase
   */
  normalizeAddress(address: string): string {
    let normalized = address.toLowerCase().trim();
    
    // Remove punctuation
    normalized = normalized.replace(/[.,#]/g, '');
    
    // Standardize common abbreviations
    const abbreviations: Record<string, string> = {
      'street': 'st',
      'avenue': 'ave',
      'road': 'rd',
      'drive': 'dr',
      'boulevard': 'blvd',
      'lane': 'ln',
      'court': 'ct',
      'place': 'pl',
      'circle': 'cir',
      'parkway': 'pkwy',
      'apartment': 'apt',
      'suite': 'ste',
      'unit': 'unit',
      'north': 'n',
      'south': 's',
      'east': 'e',
      'west': 'w'
    };

    // Replace full words with abbreviations
    for (const [full, abbr] of Object.entries(abbreviations)) {
      const regex = new RegExp(`\\b${full}\\b`, 'gi');
      normalized = normalized.replace(regex, abbr);
    }

    // Remove extra whitespace
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    return normalized;
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Returns the minimum number of single-character edits required to change one string into the other
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    
    // Create a 2D array for dynamic programming
    const dp: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));
    
    // Initialize first row and column
    for (let i = 0; i <= len1; i++) {
      dp[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      dp[0][j] = j;
    }
    
    // Fill the dp table
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // deletion
            dp[i][j - 1] + 1,     // insertion
            dp[i - 1][j - 1] + 1  // substitution
          );
        }
      }
    }
    
    return dp[len1][len2];
  }
}
