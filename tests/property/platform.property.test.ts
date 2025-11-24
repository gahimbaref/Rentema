/**
 * Property-based tests for Platform Manager
 * Feature: rental-automation
 */

import 'dotenv/config';
import * as fc from 'fast-check';
import { Pool } from 'pg';
import { PlatformManager } from '../../src/engines/PlatformManager';
import { createDatabasePool, closeDatabasePool, runMigrations, resetDatabase } from '../../src/database';

describe('Platform Manager Property-Based Tests', () => {
  let pool: Pool;
  let platformManager: PlatformManager;
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
    
    platformManager = new PlatformManager(pool);
  });

  afterAll(async () => {
    await closeDatabasePool();
  });

  afterEach(async () => {
    // Clean up platform connections after each test
    await pool.query('DELETE FROM platform_connections');
  });

  /**
   * **Feature: rental-automation, Property 1: Platform credentials round-trip**
   * For any valid platform credentials, storing them and then retrieving them
   * should return equivalent credential data
   * **Validates: Requirements 1.1**
   */
  it('Property 1: should store and retrieve platform credentials correctly', async () => {
    const credentialsArbitrary = fc.record({
      platformType: fc.constant('test' as const),
      apiKey: fc.option(fc.string({ minLength: 10, maxLength: 50 }), { nil: undefined }),
      accessToken: fc.option(fc.string({ minLength: 20, maxLength: 100 }), { nil: undefined }),
      refreshToken: fc.option(fc.string({ minLength: 20, maxLength: 100 }), { nil: undefined }),
      customField: fc.option(fc.string({ minLength: 5, maxLength: 30 }), { nil: undefined })
    });

    await fc.assert(
      fc.asyncProperty(credentialsArbitrary, async (credentials) => {
        // Connect platform (stores credentials)
        const { connection } = await platformManager.connectPlatform(
          testManagerId,
          credentials
        );
        
        // Retrieve connections
        const connections = await platformManager.getConnections(testManagerId);
        
        // Find our connection
        const retrieved = connections.find(c => c.id === connection.id);
        
        // Verify credentials match
        expect(retrieved).toBeDefined();
        expect(retrieved!.credentials.platformType).toBe(credentials.platformType);
        
        if (credentials.apiKey !== undefined) {
          expect(retrieved!.credentials.apiKey).toBe(credentials.apiKey);
        }
        
        if (credentials.accessToken !== undefined) {
          expect(retrieved!.credentials.accessToken).toBe(credentials.accessToken);
        }
        
        if (credentials.refreshToken !== undefined) {
          expect(retrieved!.credentials.refreshToken).toBe(credentials.refreshToken);
        }
        
        if (credentials.customField !== undefined) {
          expect(retrieved!.credentials.customField).toBe(credentials.customField);
        }
        
        // Clean up
        await platformManager.disconnectPlatform(connection.id);
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: rental-automation, Property 2: Platform configuration isolation**
   * For any set of multiple platform connections, each platform's configuration
   * should remain independent and not interfere with other platforms' configurations
   * **Validates: Requirements 1.3**
   */
  it('Property 2: should maintain isolation between platform configurations', async () => {
    const platformConfigsArbitrary = fc.array(
      fc.record({
        platformType: fc.constant('test' as const),
        apiKey: fc.string({ minLength: 10, maxLength: 50 }),
        accessToken: fc.string({ minLength: 20, maxLength: 100 }),
        uniqueId: fc.string({ minLength: 5, maxLength: 20 })
      }),
      { minLength: 2, maxLength: 5 }
    );

    await fc.assert(
      fc.asyncProperty(platformConfigsArbitrary, async (configs) => {
        // Connect multiple platforms
        const connections = await Promise.all(
          configs.map(config => 
            platformManager.connectPlatform(testManagerId, config)
          )
        );
        
        // Retrieve all connections
        const retrieved = await platformManager.getConnections(testManagerId);
        
        // Verify each configuration is isolated and matches original
        for (let i = 0; i < configs.length; i++) {
          const originalConfig = configs[i];
          const connection = connections[i].connection;
          const retrievedConnection = retrieved.find(c => c.id === connection.id);
          
          expect(retrievedConnection).toBeDefined();
          expect(retrievedConnection!.credentials.apiKey).toBe(originalConfig.apiKey);
          expect(retrievedConnection!.credentials.accessToken).toBe(originalConfig.accessToken);
          expect(retrievedConnection!.credentials.uniqueId).toBe(originalConfig.uniqueId);
          
          // Verify this connection's credentials don't match other connections
          for (let j = 0; j < configs.length; j++) {
            if (i !== j) {
              const otherConfig = configs[j];
              // Credentials should be different (assuming generated strings are unique)
              if (originalConfig.uniqueId !== otherConfig.uniqueId) {
                expect(retrievedConnection!.credentials.uniqueId).not.toBe(otherConfig.uniqueId);
              }
            }
          }
        }
        
        // Clean up
        await Promise.all(
          connections.map(({ connection }) => 
            platformManager.disconnectPlatform(connection.id)
          )
        );
        
        return true;
      }),
      { numRuns: 100 }
    );
  });
});
