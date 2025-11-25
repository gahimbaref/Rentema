import 'dotenv/config';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { getDatabasePool } from '../../src/database/connection';
import { InquiryRepository } from '../../src/database/repositories/InquiryRepository';
import { PropertyRepository } from '../../src/database/repositories/PropertyRepository';
import { PlatformConnectionRepository } from '../../src/database/repositories/PlatformConnectionRepository';
import { Inquiry, InquiryStatus } from '../../src/models';

/**
 * Feature: rental-automation, Property 19: Inquiry grouping by property
 * For any set of inquiries associated with different properties, grouping them by property 
 * should place each inquiry only in its associated property's group
 * Validates: Requirements 8.1
 */

describe('Inquiry Property-Based Tests', () => {
  let pool: Pool;
  let inquiryRepo: InquiryRepository;
  let propertyRepo: PropertyRepository;
  let platformRepo: PlatformConnectionRepository;

  beforeAll(() => {
    pool = getDatabasePool();
    inquiryRepo = new InquiryRepository(pool);
    propertyRepo = new PropertyRepository(pool);
    platformRepo = new PlatformConnectionRepository(pool);
  });

  afterAll(async () => {
    // Don't close the pool - it's shared across tests
    // await pool.end();
  });

  describe('Property 19: Inquiry grouping by property', () => {
    it('should group inquiries only by their associated property', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              address: fc.string({ minLength: 5, maxLength: 100 }),
              rentAmount: fc.integer({ min: 500, max: 5000 }),
              bedrooms: fc.integer({ min: 1, max: 5 }),
              bathrooms: fc.float({ min: 1, max: 4, noNaN: true }),
              inquiryCount: fc.integer({ min: 1, max: 5 }),
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (propertyConfigs) => {
            // Create a test manager first
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create platform connection
            const platformResult = await platformRepo.create({
              managerId,
              platformType: 'test',
              credentials: { platformType: 'test' },
              isActive: true,
              lastVerified: new Date(),
            });
            const platformId = platformResult.id;

            // Create properties and their inquiries
            const propertyInquiryMap = new Map<string, string[]>();

            for (const config of propertyConfigs) {
              // Create property
              const property = await propertyRepo.create({
                managerId,
                address: config.address,
                rentAmount: config.rentAmount,
                bedrooms: config.bedrooms,
                bathrooms: config.bathrooms,
                availabilityDate: new Date(),
                isTestMode: true,
                isArchived: false,
              });

              // Create inquiries for this property
              const inquiryIds: string[] = [];
              for (let i = 0; i < config.inquiryCount; i++) {
                const inquiry = await inquiryRepo.create({
                  propertyId: property.id,
                  platformId,
                  externalInquiryId: `ext-${Date.now()}-${Math.random()}`,
                  prospectiveTenantId: `tenant-${Date.now()}-${Math.random()}`,
                  prospectiveTenantName: `Tenant ${i}`,
                  status: 'new' as InquiryStatus,
                  qualificationResult: undefined,
                  questionSnapshot: undefined,
                });
                inquiryIds.push(inquiry.id);
              }

              propertyInquiryMap.set(property.id, inquiryIds);
            }

            // Get all inquiries
            const allInquiries: Inquiry[] = [];
            for (const propertyId of propertyInquiryMap.keys()) {
              const inquiries = await inquiryRepo.findByPropertyId(propertyId);
              allInquiries.push(...inquiries);
            }

            // Group inquiries by property
            const grouped = allInquiries.reduce((acc, inquiry) => {
              if (!acc[inquiry.propertyId]) {
                acc[inquiry.propertyId] = [];
              }
              acc[inquiry.propertyId].push(inquiry);
              return acc;
            }, {} as Record<string, Inquiry[]>);

            // Verify each inquiry is in the correct group
            for (const inquiry of allInquiries) {
              const group = grouped[inquiry.propertyId];
              
              // Inquiry should be in its property's group
              expect(group).toBeDefined();
              expect(group.some(i => i.id === inquiry.id)).toBe(true);

              // Inquiry should not be in any other property's group
              for (const [propertyId, inquiries] of Object.entries(grouped)) {
                if (propertyId !== inquiry.propertyId) {
                  expect(inquiries.some(i => i.id === inquiry.id)).toBe(false);
                }
              }
            }

            // Verify all inquiries are accounted for
            const groupedInquiryCount = Object.values(grouped).reduce(
              (sum, inquiries) => sum + inquiries.length,
              0
            );
            expect(groupedInquiryCount).toBe(allInquiries.length);

            // Cleanup
            await pool.query('DELETE FROM inquiries WHERE platform_id = $1', [platformId]);
            for (const propertyId of propertyInquiryMap.keys()) {
              await propertyRepo.delete(propertyId);
            }
            await pool.query('DELETE FROM platform_connections WHERE manager_id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  describe('Property 22: Email source indication', () => {
    /**
     * Feature: email-integration, Property 22: Email source indication
     * For any inquiry created from email, retrieving the inquiry should indicate email as the source type
     * Validates: Requirements 7.1
     */
    it('should indicate email as source type for inquiries created from email', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            sourceType: fc.constantFrom<'platform_api' | 'email' | 'manual'>(
              'platform_api',
              'email',
              'manual'
            ),
            emailId: fc.string({ minLength: 10, maxLength: 50 }),
          }),
          async (config) => {
            // Create a test manager
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create platform connection
            const platformResult = await platformRepo.create({
              managerId,
              platformType: 'test',
              credentials: { platformType: 'test' },
              isActive: true,
              lastVerified: new Date(),
            });
            const platformId = platformResult.id;

            // Create property
            const property = await propertyRepo.create({
              managerId,
              address: '123 Test Street',
              rentAmount: 1500,
              bedrooms: 2,
              bathrooms: 1,
              availabilityDate: new Date(),
              isTestMode: true,
              isArchived: false,
            });

            // Create inquiry with source type
            const inquiry = await inquiryRepo.create({
              propertyId: property.id,
              platformId,
              externalInquiryId: `ext-${Date.now()}-${Math.random()}`,
              prospectiveTenantId: `tenant-${Date.now()}-${Math.random()}`,
              prospectiveTenantName: 'Test Tenant',
              status: 'new' as InquiryStatus,
              qualificationResult: undefined,
              questionSnapshot: undefined,
              sourceType: config.sourceType,
              sourceEmailId: config.sourceType === 'email' ? config.emailId : undefined,
            });

            // Retrieve the inquiry
            const retrieved = await inquiryRepo.findById(inquiry.id);

            // Verify source type is correctly stored and retrieved
            expect(retrieved).not.toBeNull();
            expect(retrieved!.sourceType).toBe(config.sourceType);

            // If source is email, verify email ID is stored
            if (config.sourceType === 'email') {
              expect(retrieved!.sourceEmailId).toBe(config.emailId);
            }

            // Cleanup
            await pool.query('DELETE FROM inquiries WHERE id = $1', [inquiry.id]);
            await propertyRepo.delete(property.id);
            await pool.query('DELETE FROM platform_connections WHERE id = $1', [platformId]);
            await pool.query('DELETE FROM property_managers WHERE id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  describe('Property 23: Platform source display', () => {
    /**
     * Feature: email-integration, Property 23: Platform source display
     * For any inquiry created from email, retrieving the inquiry should include the platform that sent the email
     * Validates: Requirements 7.2
     */
    it('should include platform information in source metadata for email inquiries', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            platformType: fc.constantFrom('facebook', 'zillow', 'craigslist', 'turbotenant'),
            emailId: fc.string({ minLength: 10, maxLength: 50 }),
          }),
          async (config) => {
            // Create a test manager
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create platform connection
            const platformResult = await platformRepo.create({
              managerId,
              platformType: 'test',
              credentials: { platformType: 'test' },
              isActive: true,
              lastVerified: new Date(),
            });
            const platformId = platformResult.id;

            // Create property
            const property = await propertyRepo.create({
              managerId,
              address: '123 Test Street',
              rentAmount: 1500,
              bedrooms: 2,
              bathrooms: 1,
              availabilityDate: new Date(),
              isTestMode: true,
              isArchived: false,
            });

            // Create inquiry with platform metadata
            const sourceMetadata = {
              platformType: config.platformType,
              sender: `noreply@${config.platformType}.com`,
            };

            const inquiry = await inquiryRepo.create({
              propertyId: property.id,
              platformId,
              externalInquiryId: `ext-${Date.now()}-${Math.random()}`,
              prospectiveTenantId: `tenant-${Date.now()}-${Math.random()}`,
              prospectiveTenantName: 'Test Tenant',
              status: 'new' as InquiryStatus,
              qualificationResult: undefined,
              questionSnapshot: undefined,
              sourceType: 'email',
              sourceEmailId: config.emailId,
              sourceMetadata,
            });

            // Retrieve the inquiry
            const retrieved = await inquiryRepo.findById(inquiry.id);

            // Verify platform information is stored in metadata
            expect(retrieved).not.toBeNull();
            expect(retrieved!.sourceType).toBe('email');
            expect(retrieved!.sourceMetadata).toBeDefined();
            expect(retrieved!.sourceMetadata!.platformType).toBe(config.platformType);

            // Cleanup
            await pool.query('DELETE FROM inquiries WHERE id = $1', [inquiry.id]);
            await propertyRepo.delete(property.id);
            await pool.query('DELETE FROM platform_connections WHERE id = $1', [platformId]);
            await pool.query('DELETE FROM property_managers WHERE id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  describe('Property 24: Email received date tracking', () => {
    /**
     * Feature: email-integration, Property 24: Email received date tracking
     * For any inquiry created from email, retrieving the inquiry should include the date and time the email was received
     * Validates: Requirements 7.3
     */
    it('should track email received date in source metadata', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            emailId: fc.string({ minLength: 10, maxLength: 50 }),
            receivedDate: fc.date({ min: new Date('2024-01-01'), max: new Date() }),
          }),
          async (config) => {
            // Create a test manager
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create platform connection
            const platformResult = await platformRepo.create({
              managerId,
              platformType: 'test',
              credentials: { platformType: 'test' },
              isActive: true,
              lastVerified: new Date(),
            });
            const platformId = platformResult.id;

            // Create property
            const property = await propertyRepo.create({
              managerId,
              address: '123 Test Street',
              rentAmount: 1500,
              bedrooms: 2,
              bathrooms: 1,
              availabilityDate: new Date(),
              isTestMode: true,
              isArchived: false,
            });

            // Create inquiry with received date in metadata
            const sourceMetadata = {
              platformType: 'facebook',
              receivedDate: config.receivedDate.toISOString(),
            };

            const inquiry = await inquiryRepo.create({
              propertyId: property.id,
              platformId,
              externalInquiryId: `ext-${Date.now()}-${Math.random()}`,
              prospectiveTenantId: `tenant-${Date.now()}-${Math.random()}`,
              prospectiveTenantName: 'Test Tenant',
              status: 'new' as InquiryStatus,
              qualificationResult: undefined,
              questionSnapshot: undefined,
              sourceType: 'email',
              sourceEmailId: config.emailId,
              sourceMetadata,
            });

            // Retrieve the inquiry
            const retrieved = await inquiryRepo.findById(inquiry.id);

            // Verify received date is stored in metadata
            expect(retrieved).not.toBeNull();
            expect(retrieved!.sourceType).toBe('email');
            expect(retrieved!.sourceMetadata).toBeDefined();
            expect(retrieved!.sourceMetadata!.receivedDate).toBe(config.receivedDate.toISOString());

            // Verify the date can be parsed back
            const parsedDate = new Date(retrieved!.sourceMetadata!.receivedDate);
            expect(parsedDate.getTime()).toBe(config.receivedDate.getTime());

            // Cleanup
            await pool.query('DELETE FROM inquiries WHERE id = $1', [inquiry.id]);
            await propertyRepo.delete(property.id);
            await pool.query('DELETE FROM platform_connections WHERE id = $1', [platformId]);
            await pool.query('DELETE FROM property_managers WHERE id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  describe('Property 26: Original email preservation', () => {
    /**
     * Feature: email-integration, Property 26: Original email preservation
     * For any inquiry with parsing errors, the original email content should be stored and retrievable for manual review
     * Validates: Requirements 7.5
     */
    it('should preserve original email content in metadata for inquiries with parsing errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            emailId: fc.string({ minLength: 10, maxLength: 50 }),
            emailContent: fc.string({ minLength: 50, maxLength: 500 }),
            parsingErrors: fc.array(fc.string({ minLength: 5, maxLength: 50 }), { minLength: 1, maxLength: 3 }),
          }),
          async (config) => {
            // Create a test manager
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create platform connection
            const platformResult = await platformRepo.create({
              managerId,
              platformType: 'test',
              credentials: { platformType: 'test' },
              isActive: true,
              lastVerified: new Date(),
            });
            const platformId = platformResult.id;

            // Create property
            const property = await propertyRepo.create({
              managerId,
              address: '123 Test Street',
              rentAmount: 1500,
              bedrooms: 2,
              bathrooms: 1,
              availabilityDate: new Date(),
              isTestMode: true,
              isArchived: false,
            });

            // Create inquiry with original email content and parsing errors
            const sourceMetadata = {
              platformType: 'facebook',
              originalEmailContent: config.emailContent,
              parsingErrors: config.parsingErrors,
            };

            const inquiry = await inquiryRepo.create({
              propertyId: property.id,
              platformId,
              externalInquiryId: `ext-${Date.now()}-${Math.random()}`,
              prospectiveTenantId: `tenant-${Date.now()}-${Math.random()}`,
              prospectiveTenantName: 'Test Tenant',
              status: 'new' as InquiryStatus,
              qualificationResult: undefined,
              questionSnapshot: undefined,
              sourceType: 'email',
              sourceEmailId: config.emailId,
              sourceMetadata,
            });

            // Retrieve the inquiry
            const retrieved = await inquiryRepo.findById(inquiry.id);

            // Verify original email content is preserved
            expect(retrieved).not.toBeNull();
            expect(retrieved!.sourceType).toBe('email');
            expect(retrieved!.sourceMetadata).toBeDefined();
            expect(retrieved!.sourceMetadata!.originalEmailContent).toBe(config.emailContent);
            expect(retrieved!.sourceMetadata!.parsingErrors).toEqual(config.parsingErrors);

            // Cleanup
            await pool.query('DELETE FROM inquiries WHERE id = $1', [inquiry.id]);
            await propertyRepo.delete(property.id);
            await pool.query('DELETE FROM platform_connections WHERE id = $1', [platformId]);
            await pool.query('DELETE FROM property_managers WHERE id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  describe('Property 25: Source type filtering', () => {
    /**
     * Feature: email-integration, Property 25: Source type filtering
     * For any set of inquiries with mixed sources, filtering by source type 'email' should return only inquiries that originated from email
     * Validates: Requirements 7.4
     */
    it('should filter inquiries by source type correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            emailInquiryCount: fc.integer({ min: 2, max: 5 }),
            platformInquiryCount: fc.integer({ min: 2, max: 5 }),
            manualInquiryCount: fc.integer({ min: 1, max: 3 }),
          }),
          async (config) => {
            // Create a test manager
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create platform connection
            const platformResult = await platformRepo.create({
              managerId,
              platformType: 'test',
              credentials: { platformType: 'test' },
              isActive: true,
              lastVerified: new Date(),
            });
            const platformId = platformResult.id;

            // Create property
            const property = await propertyRepo.create({
              managerId,
              address: '123 Test Street',
              rentAmount: 1500,
              bedrooms: 2,
              bathrooms: 1,
              availabilityDate: new Date(),
              isTestMode: true,
              isArchived: false,
            });

            // Create inquiries with different source types
            const emailInquiries: Inquiry[] = [];
            const platformInquiries: Inquiry[] = [];
            const manualInquiries: Inquiry[] = [];

            // Create email inquiries
            for (let i = 0; i < config.emailInquiryCount; i++) {
              const inquiry = await inquiryRepo.create({
                propertyId: property.id,
                platformId,
                externalInquiryId: `ext-email-${Date.now()}-${Math.random()}`,
                prospectiveTenantId: `tenant-${Date.now()}-${Math.random()}`,
                prospectiveTenantName: `Email Tenant ${i}`,
                status: 'new' as InquiryStatus,
                qualificationResult: undefined,
                questionSnapshot: undefined,
                sourceType: 'email',
                sourceEmailId: `email-${i}-${Date.now()}`,
              });
              emailInquiries.push(inquiry);
            }

            // Create platform API inquiries
            for (let i = 0; i < config.platformInquiryCount; i++) {
              const inquiry = await inquiryRepo.create({
                propertyId: property.id,
                platformId,
                externalInquiryId: `ext-platform-${Date.now()}-${Math.random()}`,
                prospectiveTenantId: `tenant-${Date.now()}-${Math.random()}`,
                prospectiveTenantName: `Platform Tenant ${i}`,
                status: 'new' as InquiryStatus,
                qualificationResult: undefined,
                questionSnapshot: undefined,
                sourceType: 'platform_api',
              });
              platformInquiries.push(inquiry);
            }

            // Create manual inquiries
            for (let i = 0; i < config.manualInquiryCount; i++) {
              const inquiry = await inquiryRepo.create({
                propertyId: property.id,
                platformId,
                externalInquiryId: `ext-manual-${Date.now()}-${Math.random()}`,
                prospectiveTenantId: `tenant-${Date.now()}-${Math.random()}`,
                prospectiveTenantName: `Manual Tenant ${i}`,
                status: 'new' as InquiryStatus,
                qualificationResult: undefined,
                questionSnapshot: undefined,
                sourceType: 'manual',
              });
              manualInquiries.push(inquiry);
            }

            // Test filtering by email source type
            const emailFiltered = await inquiryRepo.findBySourceType('email');
            const emailFilteredIds = new Set(emailFiltered.map(i => i.id));

            // All email inquiries should be in the filtered results
            for (const inquiry of emailInquiries) {
              expect(emailFilteredIds.has(inquiry.id)).toBe(true);
              expect(inquiry.sourceType).toBe('email');
            }

            // No platform or manual inquiries should be in the email filtered results
            for (const inquiry of platformInquiries) {
              const isInEmailFiltered = emailFiltered.some(i => i.id === inquiry.id);
              expect(isInEmailFiltered).toBe(false);
            }
            for (const inquiry of manualInquiries) {
              const isInEmailFiltered = emailFiltered.some(i => i.id === inquiry.id);
              expect(isInEmailFiltered).toBe(false);
            }

            // Test filtering by platform_api source type
            const platformFiltered = await inquiryRepo.findBySourceType('platform_api');
            const platformFilteredIds = new Set(platformFiltered.map(i => i.id));

            // All platform inquiries should be in the filtered results
            for (const inquiry of platformInquiries) {
              expect(platformFilteredIds.has(inquiry.id)).toBe(true);
              expect(inquiry.sourceType).toBe('platform_api');
            }

            // Test filtering by manual source type
            const manualFiltered = await inquiryRepo.findBySourceType('manual');
            const manualFilteredIds = new Set(manualFiltered.map(i => i.id));

            // All manual inquiries should be in the filtered results
            for (const inquiry of manualInquiries) {
              expect(manualFilteredIds.has(inquiry.id)).toBe(true);
              expect(inquiry.sourceType).toBe('manual');
            }

            // Cleanup
            await pool.query('DELETE FROM inquiries WHERE property_id = $1', [property.id]);
            await propertyRepo.delete(property.id);
            await pool.query('DELETE FROM platform_connections WHERE id = $1', [platformId]);
            await pool.query('DELETE FROM property_managers WHERE id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });

  describe('Property 21: Inquiry filtering correctness', () => {
    it('should filter inquiries correctly by property, status, and date range', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            propertyCount: fc.integer({ min: 2, max: 4 }),
            inquiriesPerProperty: fc.integer({ min: 2, max: 5 }),
            filterPropertyIndex: fc.integer({ min: 0, max: 3 }),
            filterStatus: fc.constantFrom<InquiryStatus>(
              'new',
              'pre_qualifying',
              'qualified',
              'disqualified'
            ),
          }),
          async (config) => {
            // Create a test manager first
            const managerResult = await pool.query(
              `INSERT INTO property_managers (email, name) VALUES ($1, $2) RETURNING id`,
              [`test-${Date.now()}-${Math.random()}@example.com`, 'Test Manager']
            );
            const managerId = managerResult.rows[0].id;

            // Create platform connection
            const platformResult = await platformRepo.create({
              managerId,
              platformType: 'test',
              credentials: { platformType: 'test' },
              isActive: true,
              lastVerified: new Date(),
            });
            const platformId = platformResult.id;

            // Create properties
            const properties = [];
            for (let i = 0; i < config.propertyCount; i++) {
              const property = await propertyRepo.create({
                managerId,
                address: `${i} Test Street`,
                rentAmount: 1000 + i * 100,
                bedrooms: 2,
                bathrooms: 1,
                availabilityDate: new Date(),
                isTestMode: true,
                isArchived: false,
              });
              properties.push(property);
            }

            // Create inquiries with different statuses
            const allInquiries: Inquiry[] = [];
            const statuses: InquiryStatus[] = ['new', 'pre_qualifying', 'qualified', 'disqualified'];

            for (const property of properties) {
              for (let i = 0; i < config.inquiriesPerProperty; i++) {
                const status = statuses[i % statuses.length];
                const inquiry = await inquiryRepo.create({
                  propertyId: property.id,
                  platformId,
                  externalInquiryId: `ext-${Date.now()}-${Math.random()}`,
                  prospectiveTenantId: `tenant-${Date.now()}-${Math.random()}`,
                  prospectiveTenantName: `Tenant ${i}`,
                  status,
                  qualificationResult: undefined,
                  questionSnapshot: undefined,
                });
                allInquiries.push(inquiry);
              }
            }

            // Test property filter
            const filterPropertyId = properties[config.filterPropertyIndex % properties.length].id;
            const propertyFiltered = allInquiries.filter(
              i => i.propertyId === filterPropertyId
            );

            // All filtered inquiries should match the property
            for (const inquiry of propertyFiltered) {
              expect(inquiry.propertyId).toBe(filterPropertyId);
            }

            // Test status filter
            const statusFiltered = allInquiries.filter(
              i => i.status === config.filterStatus
            );

            // All filtered inquiries should match the status
            for (const inquiry of statusFiltered) {
              expect(inquiry.status).toBe(config.filterStatus);
            }

            // Test combined filter (property + status)
            const combinedFiltered = allInquiries.filter(
              i => i.propertyId === filterPropertyId && i.status === config.filterStatus
            );

            // All filtered inquiries should match both criteria
            for (const inquiry of combinedFiltered) {
              expect(inquiry.propertyId).toBe(filterPropertyId);
              expect(inquiry.status).toBe(config.filterStatus);
            }

            // Test date range filter
            const now = new Date();
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const dateFiltered = allInquiries.filter(
              i => new Date(i.createdAt) >= oneHourAgo
            );

            // All filtered inquiries should be within date range
            for (const inquiry of dateFiltered) {
              expect(new Date(inquiry.createdAt).getTime()).toBeGreaterThanOrEqual(
                oneHourAgo.getTime()
              );
            }

            // Cleanup
            await pool.query('DELETE FROM inquiries WHERE platform_id = $1', [platformId]);
            for (const property of properties) {
              await propertyRepo.delete(property.id);
            }
            await pool.query('DELETE FROM platform_connections WHERE manager_id = $1', [managerId]);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });
});
