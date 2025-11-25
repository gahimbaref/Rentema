/**
 * Property-based tests for Property data model
 * Feature: rental-automation
 */

import 'dotenv/config';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { PropertyRepository } from '../../src/database/repositories/PropertyRepository';
import { createDatabasePool, closeDatabasePool, runMigrations, resetDatabase } from '../../src/database';

describe('Property Repository Property-Based Tests', () => {
  let pool: Pool;
  let propertyRepo: PropertyRepository;
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
    
    propertyRepo = new PropertyRepository(pool);
  });

  afterAll(async () => {
    await closeDatabasePool();
  });

  afterEach(async () => {
    // Clean up properties after each test
    await pool.query('DELETE FROM properties');
  });

  /**
   * **Feature: rental-automation, Property 3: Property data persistence**
   * For any valid property with details (address, rent, bedrooms, bathrooms, availability date),
   * creating it and then retrieving it should return all fields with matching values
   * **Validates: Requirements 2.1**
   */
  it('Property 3: should persist and retrieve property data correctly', async () => {
    const propertyArbitrary = fc.record({
      managerId: fc.constant(testManagerId),
      address: fc.string({ minLength: 5, maxLength: 200 }),
      rentAmount: fc.float({ min: 100, max: 10000, noNaN: true }).map(n => Math.round(n * 100) / 100),
      bedrooms: fc.integer({ min: 0, max: 10 }),
      bathrooms: fc.float({ min: 0, max: 10, noNaN: true }).map(n => Math.round(n * 2) / 2),
      // Use noon UTC to avoid timezone boundary issues
      availabilityDate: fc.date({ min: new Date('2020-01-01T12:00:00Z'), max: new Date('2030-12-31T12:00:00Z') }),
      isTestMode: fc.boolean(),
      isArchived: fc.boolean()
    });

    await fc.assert(
      fc.asyncProperty(propertyArbitrary, async (propertyData) => {
        // Create property
        const created = await propertyRepo.create(propertyData);
        
        // Retrieve property
        const retrieved = await propertyRepo.findById(created.id);
        
        // Verify all fields match
        expect(retrieved).not.toBeNull();
        expect(retrieved!.managerId).toBe(propertyData.managerId);
        expect(retrieved!.address).toBe(propertyData.address);
        expect(retrieved!.rentAmount).toBe(propertyData.rentAmount);
        expect(retrieved!.bedrooms).toBe(propertyData.bedrooms);
        expect(retrieved!.bathrooms).toBe(propertyData.bathrooms);
        // Compare dates using UTC date parts to avoid timezone issues
        const retrievedDate = new Date(retrieved!.availabilityDate);
        const expectedDate = new Date(propertyData.availabilityDate);
        expect(retrievedDate.getUTCFullYear()).toBe(expectedDate.getUTCFullYear());
        expect(retrievedDate.getUTCMonth()).toBe(expectedDate.getUTCMonth());
        expect(retrievedDate.getUTCDate()).toBe(expectedDate.getUTCDate());
        expect(retrieved!.isTestMode).toBe(propertyData.isTestMode);
        expect(retrieved!.isArchived).toBe(propertyData.isArchived);
        
        // Clean up
        await propertyRepo.delete(created.id);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 4: Property ID uniqueness**
   * For any set of created properties, all assigned property IDs should be unique
   * **Validates: Requirements 2.2**
   */
  it('Property 4: should assign unique IDs to all properties', async () => {
    const propertiesArbitrary = fc.array(
      fc.record({
        managerId: fc.constant(testManagerId),
        address: fc.string({ minLength: 5, maxLength: 200 }),
        rentAmount: fc.float({ min: 100, max: 10000, noNaN: true }).map(n => Math.round(n * 100) / 100),
        bedrooms: fc.integer({ min: 0, max: 10 }),
        bathrooms: fc.float({ min: 0, max: 10, noNaN: true }).map(n => Math.round(n * 2) / 2),
        // Use noon UTC to avoid timezone boundary issues
        availabilityDate: fc.date({ min: new Date('2020-01-01T12:00:00Z'), max: new Date('2030-12-31T12:00:00Z') }),
        isTestMode: fc.boolean(),
        isArchived: fc.boolean()
      }),
      { minLength: 2, maxLength: 10 }
    );

    await fc.assert(
      fc.asyncProperty(propertiesArbitrary, async (propertiesData) => {
        // Create multiple properties
        const createdProperties = await Promise.all(
          propertiesData.map(data => propertyRepo.create(data))
        );
        
        // Extract all IDs
        const ids = createdProperties.map(p => p.id);
        
        // Verify all IDs are unique
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
        
        // Clean up
        await Promise.all(createdProperties.map(p => propertyRepo.delete(p.id)));
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 5: Property update persistence**
   * For any existing property, updating its details and then retrieving it
   * should reflect all the updated values
   * **Validates: Requirements 2.3**
   */
  it('Property 5: should persist property updates correctly', async () => {
    const initialPropertyArbitrary = fc.record({
      managerId: fc.constant(testManagerId),
      address: fc.string({ minLength: 5, maxLength: 200 }),
      rentAmount: fc.float({ min: 100, max: 10000, noNaN: true }).map(n => Math.round(n * 100) / 100),
      bedrooms: fc.integer({ min: 0, max: 10 }),
      bathrooms: fc.float({ min: 0, max: 10, noNaN: true }).map(n => Math.round(n * 2) / 2),
      // Use noon UTC to avoid timezone boundary issues
      availabilityDate: fc.date({ min: new Date('2020-01-01T12:00:00Z'), max: new Date('2030-12-31T12:00:00Z') }),
      isTestMode: fc.boolean(),
      isArchived: fc.boolean()
    });

    const updatesArbitrary = fc.record({
      address: fc.option(fc.string({ minLength: 5, maxLength: 200 }), { nil: undefined }),
      rentAmount: fc.option(fc.float({ min: 100, max: 10000, noNaN: true }).map(n => Math.round(n * 100) / 100), { nil: undefined }),
      bedrooms: fc.option(fc.integer({ min: 0, max: 10 }), { nil: undefined }),
      bathrooms: fc.option(fc.float({ min: 0, max: 10, noNaN: true }).map(n => Math.round(n * 2) / 2), { nil: undefined }),
      // Use noon UTC to avoid timezone boundary issues
      availabilityDate: fc.option(fc.date({ min: new Date('2020-01-01T12:00:00Z'), max: new Date('2030-12-31T12:00:00Z') }), { nil: undefined }),
      isTestMode: fc.option(fc.boolean(), { nil: undefined }),
      isArchived: fc.option(fc.boolean(), { nil: undefined })
    });

    await fc.assert(
      fc.asyncProperty(
        initialPropertyArbitrary,
        updatesArbitrary,
        async (initialData, updates) => {
          // Create initial property
          const created = await propertyRepo.create(initialData);
          
          // Update property
          await propertyRepo.update(created.id, updates);
          
          // Retrieve property
          const retrieved = await propertyRepo.findById(created.id);
          
          // Verify updates were applied
          expect(retrieved).not.toBeNull();
          
          if (updates.address !== undefined) {
            expect(retrieved!.address).toBe(updates.address);
          } else {
            expect(retrieved!.address).toBe(initialData.address);
          }
          
          if (updates.rentAmount !== undefined) {
            expect(retrieved!.rentAmount).toBe(updates.rentAmount);
          } else {
            expect(retrieved!.rentAmount).toBe(initialData.rentAmount);
          }
          
          if (updates.bedrooms !== undefined) {
            expect(retrieved!.bedrooms).toBe(updates.bedrooms);
          } else {
            expect(retrieved!.bedrooms).toBe(initialData.bedrooms);
          }
          
          if (updates.bathrooms !== undefined) {
            expect(retrieved!.bathrooms).toBe(updates.bathrooms);
          } else {
            expect(retrieved!.bathrooms).toBe(initialData.bathrooms);
          }
          
          if (updates.availabilityDate !== undefined) {
            const retrievedDate = new Date(retrieved!.availabilityDate);
            const expectedDate = new Date(updates.availabilityDate);
            expect(retrievedDate.getUTCFullYear()).toBe(expectedDate.getUTCFullYear());
            expect(retrievedDate.getUTCMonth()).toBe(expectedDate.getUTCMonth());
            expect(retrievedDate.getUTCDate()).toBe(expectedDate.getUTCDate());
          } else {
            const retrievedDate = new Date(retrieved!.availabilityDate);
            const expectedDate = new Date(initialData.availabilityDate);
            expect(retrievedDate.getUTCFullYear()).toBe(expectedDate.getUTCFullYear());
            expect(retrievedDate.getUTCMonth()).toBe(expectedDate.getUTCMonth());
            expect(retrievedDate.getUTCDate()).toBe(expectedDate.getUTCDate());
          }
          
          if (updates.isTestMode !== undefined) {
            expect(retrieved!.isTestMode).toBe(updates.isTestMode);
          } else {
            expect(retrieved!.isTestMode).toBe(initialData.isTestMode);
          }
          
          if (updates.isArchived !== undefined) {
            expect(retrieved!.isArchived).toBe(updates.isArchived);
          } else {
            expect(retrieved!.isArchived).toBe(initialData.isArchived);
          }
          
          // Clean up
          await propertyRepo.delete(created.id);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 6: Property archival preservation**
   * For any property with associated inquiries, deleting the property should mark it
   * as archived and preserve all inquiry history
   * **Validates: Requirements 2.4**
   */
  it('Property 6: should archive property and preserve inquiry history on deletion', async () => {
    const propertyArbitrary = fc.record({
      managerId: fc.constant(testManagerId),
      address: fc.string({ minLength: 5, maxLength: 200 }),
      rentAmount: fc.float({ min: 100, max: 10000, noNaN: true }).map(n => Math.round(n * 100) / 100),
      bedrooms: fc.integer({ min: 0, max: 10 }),
      bathrooms: fc.float({ min: 0, max: 10, noNaN: true }).map(n => Math.round(n * 2) / 2),
      availabilityDate: fc.date({ min: new Date('2020-01-01T12:00:00Z'), max: new Date('2030-12-31T12:00:00Z') }),
      isTestMode: fc.boolean(),
      isArchived: fc.constant(false)
    });

    const inquiriesArbitrary = fc.array(
      fc.record({
        externalInquiryId: fc.uuid(),
        prospectiveTenantId: fc.uuid(),
        prospectiveTenantName: fc.string({ minLength: 3, maxLength: 50 }),
        status: fc.constantFrom('new', 'pre_qualifying', 'qualified', 'disqualified')
      }),
      { minLength: 1, maxLength: 5 }
    );

    await fc.assert(
      fc.asyncProperty(
        propertyArbitrary,
        inquiriesArbitrary,
        async (propertyData, inquiriesData) => {
          // Create property
          const property = await propertyRepo.create(propertyData);
          
          // Create a test platform connection for inquiries
          const platformResult = await pool.query(
            `INSERT INTO platform_connections (manager_id, platform_type, credentials, is_active)
             VALUES ($1, $2, $3, $4)
             RETURNING id`,
            [testManagerId, 'test', JSON.stringify({ apiKey: 'test' }), true]
          );
          const platformId = platformResult.rows[0].id;
          
          // Create inquiries associated with the property
          const inquiryIds: string[] = [];
          for (const inquiryData of inquiriesData) {
            const inquiryResult = await pool.query(
              `INSERT INTO inquiries (property_id, platform_id, external_inquiry_id, 
                                      prospective_tenant_id, prospective_tenant_name, status)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING id`,
              [
                property.id,
                platformId,
                inquiryData.externalInquiryId,
                inquiryData.prospectiveTenantId,
                inquiryData.prospectiveTenantName,
                inquiryData.status
              ]
            );
            inquiryIds.push(inquiryResult.rows[0].id);
          }
          
          // Archive the property (simulating deletion)
          const archivedProperty = await propertyRepo.archive(property.id);
          
          // Verify property is marked as archived
          expect(archivedProperty).not.toBeNull();
          expect(archivedProperty!.isArchived).toBe(true);
          
          // Verify property still exists in database
          const retrievedProperty = await propertyRepo.findById(property.id);
          expect(retrievedProperty).not.toBeNull();
          expect(retrievedProperty!.isArchived).toBe(true);
          
          // Verify all inquiries are still preserved
          for (const inquiryId of inquiryIds) {
            const inquiryResult = await pool.query(
              'SELECT * FROM inquiries WHERE id = $1',
              [inquiryId]
            );
            expect(inquiryResult.rows.length).toBe(1);
            expect(inquiryResult.rows[0].property_id).toBe(property.id);
          }
          
          // Verify inquiry count matches
          const inquiryCountResult = await pool.query(
            'SELECT COUNT(*) as count FROM inquiries WHERE property_id = $1',
            [property.id]
          );
          expect(parseInt(inquiryCountResult.rows[0].count)).toBe(inquiriesData.length);
          
          // Clean up
          await pool.query('DELETE FROM inquiries WHERE property_id = $1', [property.id]);
          await pool.query('DELETE FROM platform_connections WHERE id = $1', [platformId]);
          await propertyRepo.delete(property.id);
          
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
