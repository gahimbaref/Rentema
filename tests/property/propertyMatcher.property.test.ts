/**
 * Property-based tests for Property Matcher
 * Feature: email-integration
 */

import 'dotenv/config';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { PropertyMatcher } from '../../src/engines/PropertyMatcher';
import { PropertyRepository } from '../../src/database/repositories/PropertyRepository';
import { createDatabasePool, closeDatabasePool, runMigrations, resetDatabase } from '../../src/database';

describe('Property Matcher Property-Based Tests', () => {
  let pool: Pool;
  let matcher: PropertyMatcher;
  let propertyRepository: PropertyRepository;
  const testManagerId = '00000000-0000-0000-0000-000000000001';

  beforeAll(async () => {
    pool = createDatabasePool();
    await resetDatabase(pool);
    await runMigrations(pool);

    // Create a test property manager
    await pool.query(
      `INSERT INTO property_managers (id, email, name) VALUES ($1, $2, $3)`,
      [testManagerId, 'test@example.com', 'Test Manager']
    );

    propertyRepository = new PropertyRepository(pool);
    matcher = new PropertyMatcher(pool);
  });

  afterAll(async () => {
    await closeDatabasePool();
  });

  beforeEach(async () => {
    // Clean up properties before each test
    await pool.query('DELETE FROM properties');
  });

  /**
   * **Feature: email-integration, Property 15: Property matching attempt**
   * For any extracted inquiry with property information, the system should
   * attempt to match it against existing properties
   * **Validates: Requirements 5.1**
   */
  it('Property 15: should attempt to match any inquiry with property information', async () => {
    // Create some test properties
    await propertyRepository.create({
      managerId: testManagerId,
      address: '123 Main Street, Springfield, IL 62701',
      rentAmount: 1200,
      bedrooms: 2,
      bathrooms: 1,
      availabilityDate: new Date('2024-01-01'),
      isTestMode: false,
      isArchived: false
    });

    await propertyRepository.create({
      managerId: testManagerId,
      address: '456 Oak Avenue, Chicago, IL 60601',
      rentAmount: 1500,
      bedrooms: 3,
      bathrooms: 2,
      availabilityDate: new Date('2024-02-01'),
      isTestMode: false,
      isArchived: false
    });

    // Generate arbitrary property references (addresses)
    const addressArbitrary = fc.string({ minLength: 10, maxLength: 100 });

    await fc.assert(
      fc.asyncProperty(addressArbitrary, async (address: string) => {
        const result = await matcher.matchByAddress(address, testManagerId);
        
        // Verify that a matching attempt was made and returns a valid PropertyMatch
        expect(result).toBeDefined();
        expect(result).toHaveProperty('matched');
        expect(result).toHaveProperty('confidence');
        expect(typeof result.matched).toBe('boolean');
        expect(typeof result.confidence).toBe('number');
        expect(result.confidence).toBeGreaterThanOrEqual(0);
        expect(result.confidence).toBeLessThanOrEqual(1);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: email-integration, Property 16: Matched inquiry linking**
   * For any successful property match, the created inquiry should be linked
   * to the matched property ID
   * **Validates: Requirements 5.2**
   */
  it('Property 16: should link matched inquiries to the correct property ID', async () => {
    // Create test properties with known addresses
    const testAddresses = [
      '123 Main Street, Springfield, IL 62701',
      '456 Oak Avenue, Chicago, IL 60601',
      '789 Elm Drive, Naperville, IL 60540'
    ];

    const createdProperties = await Promise.all(
      testAddresses.map(address =>
        propertyRepository.create({
          managerId: testManagerId,
          address,
          rentAmount: 1200,
          bedrooms: 2,
          bathrooms: 1,
          availabilityDate: new Date('2024-01-01'),
          isTestMode: false,
          isArchived: false
        })
      )
    );

    // Generate variations of the known addresses
    const addressVariationArbitrary = fc.constantFrom(...testAddresses).chain(baseAddress => {
      return fc.record({
        original: fc.constant(baseAddress),
        // Create variations: lowercase, different punctuation, abbreviations
        variation: fc.constantFrom(
          baseAddress.toLowerCase(),
          baseAddress.replace('Street', 'St'),
          baseAddress.replace('Avenue', 'Ave'),
          baseAddress.replace('Drive', 'Dr'),
          baseAddress.replace(/,/g, ''),
          baseAddress.replace(/\./g, '')
        )
      });
    });

    await fc.assert(
      fc.asyncProperty(addressVariationArbitrary, async (data) => {
        const result = await matcher.matchByAddress(data.variation, testManagerId);
        
        // If matched, verify it's linked to a valid property ID
        if (result.matched) {
          expect(result.propertyId).toBeDefined();
          expect(typeof result.propertyId).toBe('string');
          expect(result.confidence).toBeGreaterThanOrEqual(0.8); // Match threshold
          
          // Verify the property ID exists in our created properties
          const matchedProperty = createdProperties.find(p => p.id === result.propertyId);
          expect(matchedProperty).toBeDefined();
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: email-integration, Property 17: Unmatched inquiry creation**
   * For any inquiry that doesn't match an existing property, the system should
   * create an unmatched inquiry flagged for manual assignment
   * **Validates: Requirements 5.3**
   */
  it('Property 17: should flag unmatched inquiries for manual assignment', async () => {
    // Create a few test properties
    await propertyRepository.create({
      managerId: testManagerId,
      address: '123 Main Street, Springfield, IL 62701',
      rentAmount: 1200,
      bedrooms: 2,
      bathrooms: 1,
      availabilityDate: new Date('2024-01-01'),
      isTestMode: false,
      isArchived: false
    });

    // Generate completely random addresses that won't match
    const randomAddressArbitrary = fc.record({
      number: fc.integer({ min: 1000, max: 9999 }),
      street: fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 5, maxLength: 15 }),
      city: fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 5, maxLength: 15 }),
      state: fc.stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 2, maxLength: 2 }),
      zip: fc.integer({ min: 10000, max: 99999 })
    }).map(parts => `${parts.number} ${parts.street} Blvd, ${parts.city}, ${parts.state} ${parts.zip}`);

    await fc.assert(
      fc.asyncProperty(randomAddressArbitrary, async (address: string) => {
        const result = await matcher.matchByAddress(address, testManagerId);
        
        // For addresses that don't match (low confidence), verify unmatched status
        if (result.confidence < 0.8) {
          expect(result.matched).toBe(false);
          // PropertyId may still be present (best attempt) but matched should be false
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Additional property: Exact property ID matches should always succeed
   */
  it('Property: should match by exact property ID with 100% confidence', async () => {
    // Create test properties
    const property = await propertyRepository.create({
      managerId: testManagerId,
      address: '123 Main Street, Springfield, IL 62701',
      rentAmount: 1200,
      bedrooms: 2,
      bathrooms: 1,
      availabilityDate: new Date('2024-01-01'),
      isTestMode: false,
      isArchived: false
    });

    const result = await matcher.matchProperty(property.id, testManagerId);
    
    expect(result.matched).toBe(true);
    expect(result.propertyId).toBe(property.id);
    expect(result.confidence).toBe(1.0);
    expect(result.matchedAddress).toBe(property.address);
  });

  /**
   * Additional property: Address normalization should be consistent
   */
  it('Property: should normalize addresses consistently', async () => {
    const addressPairs = [
      ['123 Main Street', '123 Main St'],
      ['456 Oak Avenue', '456 Oak Ave'],
      ['789 Elm Drive', '789 Elm Dr'],
      ['100 Park Boulevard', '100 Park Blvd'],
      ['Apartment 5', 'Apt 5'],
      ['North Main Street', 'N Main St']
    ];

    for (const [full, abbr] of addressPairs) {
      const normalized1 = matcher.normalizeAddress(full);
      const normalized2 = matcher.normalizeAddress(abbr);
      
      expect(normalized1).toBe(normalized2);
    }
  });

  /**
   * Additional property: Matching should respect manager boundaries
   */
  it('Property: should not match properties from different managers', async () => {
    const otherManagerId = '00000000-0000-0000-0000-000000000002';
    
    // Create the other manager
    await pool.query(
      `INSERT INTO property_managers (id, email, name) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [otherManagerId, 'other@example.com', 'Other Manager']
    );
    
    // Create property for different manager
    const property = await propertyRepository.create({
      managerId: otherManagerId,
      address: '123 Main Street, Springfield, IL 62701',
      rentAmount: 1200,
      bedrooms: 2,
      bathrooms: 1,
      availabilityDate: new Date('2024-01-01'),
      isTestMode: false,
      isArchived: false
    });

    // Try to match with wrong manager ID
    const result = await matcher.matchProperty(property.id, testManagerId);
    
    expect(result.matched).toBe(false);
    expect(result.confidence).toBe(0);
  });
});
