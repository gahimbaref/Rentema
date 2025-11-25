/**
 * Property-based tests for Messaging Engine
 * Feature: rental-automation
 */

import 'dotenv/config';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { MessagingEngine } from '../../src/engines/MessagingEngine';
import { InquiryRepository } from '../../src/database/repositories/InquiryRepository';
import { PropertyRepository } from '../../src/database/repositories/PropertyRepository';
import { PlatformConnectionRepository } from '../../src/database/repositories/PlatformConnectionRepository';
import { MessageRepository } from '../../src/database/repositories/MessageRepository';
import { createDatabasePool, closeDatabasePool, runMigrations, resetDatabase } from '../../src/database';

describe('Messaging Engine Property-Based Tests', () => {
  let pool: Pool;
  let messagingEngine: MessagingEngine;
  let inquiryRepository: InquiryRepository;
  let propertyRepository: PropertyRepository;
  let platformConnectionRepository: PlatformConnectionRepository;
  let messageRepository: MessageRepository;
  
  const testManagerId = '00000000-0000-0000-0000-000000000001';
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  beforeAll(async () => {
    pool = createDatabasePool();
    await resetDatabase(pool);
    await runMigrations(pool);
    
    // Create a test property manager
    await pool.query(
      `INSERT INTO property_managers (id, email, name) VALUES ($1, $2, $3)`,
      [testManagerId, 'test@example.com', 'Test Manager']
    );
    
    messagingEngine = new MessagingEngine(pool, redisUrl);
    inquiryRepository = new InquiryRepository(pool);
    propertyRepository = new PropertyRepository(pool);
    platformConnectionRepository = new PlatformConnectionRepository(pool);
    messageRepository = new MessageRepository(pool);
  });

  afterAll(async () => {
    await messagingEngine.close();
    await closeDatabasePool();
  });

  afterEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM messages');
    await pool.query('DELETE FROM inquiries');
    await pool.query('DELETE FROM properties WHERE manager_id = $1', [testManagerId]);
    await pool.query('DELETE FROM platform_connections WHERE manager_id = $1', [testManagerId]);
  });

  /**
   * **Feature: rental-automation, Property 20: Inquiry history completeness**
   * For any inquiry with conversation messages and responses,
   * retrieving the inquiry should return the complete conversation history and all collected responses
   * **Validates: Requirements 8.3**
   */
  it('Property 20: should return complete conversation history for any inquiry', async () => {
    // Arbitrary for message content
    const messageContentArbitrary = fc.string({ minLength: 1, maxLength: 500 });
    
    // Arbitrary for message direction
    const messageDirectionArbitrary = fc.constantFrom('inbound', 'outbound');
    
    // Arbitrary for message status
    const messageStatusArbitrary = fc.constantFrom('sent', 'delivered', 'failed');
    
    // Arbitrary for a list of messages (1 to 20 messages)
    const messagesArbitrary = fc.array(
      fc.record({
        content: messageContentArbitrary,
        direction: messageDirectionArbitrary,
        status: messageStatusArbitrary
      }),
      { minLength: 1, maxLength: 20 }
    );

    await fc.assert(
      fc.asyncProperty(messagesArbitrary, async (messages) => {
        // Create a test property
        const property = await propertyRepository.create({
          managerId: testManagerId,
          address: '123 Test St',
          rentAmount: 1000,
          bedrooms: 2,
          bathrooms: 1,
          availabilityDate: new Date(),
          isTestMode: true,
          isArchived: false
        });

        // Create a test platform connection
        const platform = await platformConnectionRepository.create({
          managerId: testManagerId,
          platformType: 'test',
          credentials: { apiKey: 'test-key' },
          isActive: true
        });

        // Create a test inquiry
        const inquiry = await inquiryRepository.create({
          propertyId: property.id,
          platformId: platform.id,
          externalInquiryId: `ext-${Date.now()}`,
          prospectiveTenantId: `tenant-${Date.now()}`,
          prospectiveTenantName: 'Test Tenant',
          status: 'pre_qualifying'
        });

        // Store all messages for this inquiry
        for (const msg of messages) {
          await messageRepository.create({
            inquiryId: inquiry.id,
            direction: msg.direction as any,
            content: msg.content,
            status: msg.status as any
          });
        }

        // Retrieve conversation history
        const history = await messagingEngine.getConversationHistory(inquiry.id);

        // Verify completeness: all messages should be returned
        expect(history.length).toBe(messages.length);

        // Verify all messages are present with correct data
        for (let i = 0; i < messages.length; i++) {
          const original = messages[i];
          const retrieved = history[i];

          expect(retrieved.inquiryId).toBe(inquiry.id);
          expect(retrieved.content).toBe(original.content);
          expect(retrieved.direction).toBe(original.direction);
          expect(retrieved.status).toBe(original.status);
          expect(retrieved.timestamp).toBeDefined();
        }

        // Verify messages are ordered by timestamp (ascending)
        for (let i = 1; i < history.length; i++) {
          expect(history[i].timestamp.getTime()).toBeGreaterThanOrEqual(
            history[i - 1].timestamp.getTime()
          );
        }

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
