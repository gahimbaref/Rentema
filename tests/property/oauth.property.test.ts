/**
 * Property-based tests for OAuth Manager
 * Feature: email-integration
 */

import * as fc from 'fast-check';
import { encryptCredentials, decryptCredentials } from '../../src/database/encryption';
import { OAuthManager } from '../../src/engines/OAuthManager';
import { getDatabasePool } from '../../src/database/connection';

describe('OAuth Manager Property Tests', () => {
  /**
   * **Feature: email-integration, Property 1: OAuth token storage round-trip**
   * **Validates: Requirements 1.2**
   * 
   * For any valid OAuth access and refresh tokens, storing them encrypted 
   * and then retrieving them should return equivalent token data
   */
  it('Property 1: OAuth token storage round-trip', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 20, maxLength: 200 }), // access token
        fc.string({ minLength: 20, maxLength: 200 }), // refresh token
        (accessToken, refreshToken) => {
          // Encrypt tokens
          const encryptedAccess = encryptCredentials({ token: accessToken });
          const encryptedRefresh = encryptCredentials({ token: refreshToken });

          // Decrypt tokens
          const decryptedAccess = decryptCredentials(encryptedAccess);
          const decryptedRefresh = decryptCredentials(encryptedRefresh);

          // Verify round-trip preserves data
          return (
            decryptedAccess.token === accessToken &&
            decryptedRefresh.token === refreshToken
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: email-integration, Property 2: Email connection verification**
   * **Validates: Requirements 1.3**
   * 
   * For any stored OAuth tokens, verifying the connection should successfully 
   * retrieve the user's email address from Gmail API (or fail gracefully)
   * 
   * Note: This test verifies the structure and error handling of verification,
   * not actual Gmail API calls (which would require valid credentials)
   */
  it('Property 2: Email connection verification structure', async () => {
    // Skip if Gmail OAuth is not configured
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REDIRECT_URI) {
      console.log('Skipping Property 2: Gmail OAuth not configured');
      return;
    }

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (connectionId) => {
          // This test verifies that verifyConnection returns proper structure
          // We can't test actual Gmail API without valid credentials
          // So we test that it handles missing connections gracefully
          
          const manager = new OAuthManager();
          const result = await manager.verifyConnection(connectionId);

          // Should return EmailVerification structure
          return (
            typeof result.isValid === 'boolean' &&
            (result.isValid === false ? typeof result.error === 'string' : true)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: email-integration, Property 4: Credential cleanup on disconnect**
   * **Validates: Requirements 1.5**
   * 
   * For any active email connection, disconnecting should remove all stored 
   * credentials and mark the connection as inactive
   * 
   * Note: This test verifies the cleanup behavior by checking that after
   * revokeAccess is called, the connection is removed from the database
   */
  it('Property 4: Credential cleanup on disconnect', async () => {
    // Skip if Gmail OAuth is not configured or database is not available
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REDIRECT_URI) {
      console.log('Skipping Property 4: Gmail OAuth not configured');
      return;
    }

    const pool = getDatabasePool();
    
    // Test database connectivity first
    try {
      await pool.query('SELECT 1');
    } catch (error) {
      console.log('Skipping Property 4: Database not available');
      return;
    }
    
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // manager_id
        fc.emailAddress(),
        fc.string({ minLength: 20, maxLength: 200 }), // access token
        fc.string({ minLength: 20, maxLength: 200 }), // refresh token
        async (managerId, emailAddress, accessToken, refreshToken) => {
          // Create a test connection in the database
          const encryptedAccess = encryptCredentials({ token: accessToken });
          const encryptedRefresh = encryptCredentials({ token: refreshToken });
          const expiryDate = new Date(Date.now() + 3600 * 1000);

          const insertResult = await pool.query(
            `INSERT INTO email_connections 
             (manager_id, email_address, access_token, refresh_token, token_expiry, is_active)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [managerId, emailAddress, encryptedAccess, encryptedRefresh, expiryDate, true]
          );

          const connectionId = insertResult.rows[0].id;

          // Revoke access (this will attempt to revoke with Google, but will continue even if it fails)
          const manager = new OAuthManager();
          try {
            await manager.revokeAccess(connectionId);
          } catch (error) {
            // Expected to fail since we don't have valid Google credentials
            // But the database cleanup should still happen
          }

          // Verify connection is deleted from database
          const checkResult = await pool.query(
            'SELECT * FROM email_connections WHERE id = $1',
            [connectionId]
          );

          return checkResult.rows.length === 0;
        }
      ),
      { numRuns: 10 } // Reduced runs since this involves database operations
    );
  });
});
