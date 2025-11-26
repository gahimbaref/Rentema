import { google } from 'googleapis';
import { encryptCredentials, decryptCredentials } from '../database/encryption';
import { getDatabasePool } from '../database/connection';
import { logger } from '../utils/logger';
import { NotificationService } from './NotificationService';

export interface EmailConnection {
  id: string;
  managerId: string;
  emailAddress: string;
  accessToken: string; // encrypted
  refreshToken: string; // encrypted
  tokenExpiry: Date;
  isActive: boolean;
  lastPollTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailVerification {
  isValid: boolean;
  emailAddress?: string;
  error?: string;
}

export class OAuthManager {
  private oauth2Client;
  private notificationService: NotificationService;

  constructor() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Gmail OAuth configuration missing. Please set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REDIRECT_URI environment variables.');
    }

    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );
    
    this.notificationService = new NotificationService(getDatabasePool());
  }

  /**
   * Generate OAuth authorization URL for user consent
   */
  getAuthorizationUrl(managerId: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/calendar', // For Google Meet integration
      'https://www.googleapis.com/auth/calendar.events' // For creating calendar events
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force consent to ensure we get refresh token
      state: managerId // Pass manager ID in state parameter
    });
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(code: string, managerId: string): Promise<EmailConnection> {
    const correlationId = logger.generateCorrelationId();
    const startTime = Date.now();
    
    logger.info('Starting OAuth token exchange', {
      correlationId,
      managerId,
      operation: 'oauth_exchange'
    });

    try {
      // Exchange code for tokens
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to obtain access or refresh token');
      }

      // Set credentials to get user email
      this.oauth2Client.setCredentials(tokens);
      
      // Get user's email address
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      const emailAddress = userInfo.data.email;

      if (!emailAddress) {
        throw new Error('Failed to retrieve user email address');
      }

      // Calculate token expiry
      const expiryDate = tokens.expiry_date 
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 3600 * 1000); // Default 1 hour

      // Encrypt tokens
      const encryptedAccessToken = encryptCredentials({ token: tokens.access_token });
      const encryptedRefreshToken = encryptCredentials({ token: tokens.refresh_token });

      // Store in database
      const pool = getDatabasePool();
      const result = await pool.query(
        `INSERT INTO email_connections 
         (manager_id, email_address, access_token, refresh_token, token_expiry, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, manager_id, email_address, access_token, refresh_token, token_expiry, is_active, last_poll_time, created_at, updated_at`,
        [managerId, emailAddress, encryptedAccessToken, encryptedRefreshToken, expiryDate, true]
      );

      const row = result.rows[0];
      
      const duration = Date.now() - startTime;
      logger.info('OAuth token exchange successful', {
        correlationId,
        managerId,
        connectionId: row.id,
        emailAddress,
        operation: 'oauth_exchange',
        duration
      });

      return {
        id: row.id,
        managerId: row.manager_id,
        emailAddress: row.email_address,
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        tokenExpiry: row.token_expiry,
        isActive: row.is_active,
        lastPollTime: row.last_poll_time,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('OAuth token exchange failed', {
        correlationId,
        managerId,
        operation: 'oauth_exchange',
        duration
      }, error instanceof Error ? error : new Error('Unknown error'));
      
      throw new Error(`Failed to exchange code for tokens: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Refresh expired access token with automatic retry logic
   */
  async refreshAccessToken(connectionId: string, retries: number = 3): Promise<void> {
    const correlationId = logger.generateCorrelationId();
    const startTime = Date.now();
    let lastError: Error | null = null;

    logger.info('Starting token refresh', {
      correlationId,
      connectionId,
      operation: 'oauth_refresh',
      maxRetries: retries
    });

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Get connection from database
        const pool = getDatabasePool();
        const result = await pool.query(
          'SELECT * FROM email_connections WHERE id = $1',
          [connectionId]
        );

        if (result.rows.length === 0) {
          throw new Error('Email connection not found');
        }

        const connection = result.rows[0];

        // Decrypt refresh token
        const decryptedRefreshToken = decryptCredentials(connection.refresh_token);
        
        // Set refresh token and get new access token
        this.oauth2Client.setCredentials({
          refresh_token: decryptedRefreshToken.token
        });

        const { credentials } = await this.oauth2Client.refreshAccessToken();

        if (!credentials.access_token) {
          throw new Error('Failed to refresh access token');
        }

        // Calculate new expiry
        const expiryDate = credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : new Date(Date.now() + 3600 * 1000);

        // Encrypt new access token
        const encryptedAccessToken = encryptCredentials({ token: credentials.access_token });

        // Update in database
        await pool.query(
          'UPDATE email_connections SET access_token = $1, token_expiry = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
          [encryptedAccessToken, expiryDate, connectionId]
        );

        const duration = Date.now() - startTime;
        logger.info('Token refresh successful', {
          correlationId,
          connectionId,
          operation: 'oauth_refresh',
          attempt,
          duration
        });

        // Success - return
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        logger.warn('Token refresh attempt failed', {
          correlationId,
          connectionId,
          operation: 'oauth_refresh',
          attempt,
          maxRetries: retries
        }, lastError);
        
        // If this is the last attempt, throw the error
        if (attempt === retries) {
          break;
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const duration = Date.now() - startTime;
    logger.error('Token refresh failed after all retries', {
      correlationId,
      connectionId,
      operation: 'oauth_refresh',
      attempts: retries,
      duration
    }, lastError || new Error('Unknown error'));

    // Send notification to user about token refresh failure
    try {
      const pool = getDatabasePool();
      const connectionResult = await pool.query(
        'SELECT manager_id, email_address FROM email_connections WHERE id = $1',
        [connectionId]
      );
      
      if (connectionResult.rows.length > 0) {
        const { manager_id, email_address } = connectionResult.rows[0];
        await this.notificationService.notifyTokenRefreshFailure(
          manager_id,
          connectionId,
          email_address,
          lastError?.message || 'Unknown error'
        );
      }
    } catch (notificationError) {
      logger.error('Failed to send token refresh failure notification', {
        correlationId,
        connectionId,
        operation: 'oauth_refresh'
      }, notificationError instanceof Error ? notificationError : new Error('Unknown error'));
    }

    throw new Error(`Failed to refresh access token after ${retries} attempts: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Verify connection by testing Gmail API access
   */
  async verifyConnection(connectionId: string): Promise<EmailVerification> {
    try {
      // Get connection from database
      const pool = getDatabasePool();
      const result = await pool.query(
        'SELECT * FROM email_connections WHERE id = $1',
        [connectionId]
      );

      if (result.rows.length === 0) {
        return {
          isValid: false,
          error: 'Email connection not found'
        };
      }

      const connection = result.rows[0];

      // Decrypt access token
      const decryptedAccessToken = decryptCredentials(connection.access_token);

      // Set credentials
      this.oauth2Client.setCredentials({
        access_token: decryptedAccessToken.token
      });

      // Try to get user profile
      const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client });
      const userInfo = await oauth2.userinfo.get();

      return {
        isValid: true,
        emailAddress: userInfo.data.email || connection.email_address
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Revoke access and clean up credentials
   */
  async revokeAccess(connectionId: string): Promise<void> {
    try {
      // Get connection from database
      const pool = getDatabasePool();
      const result = await pool.query(
        'SELECT * FROM email_connections WHERE id = $1',
        [connectionId]
      );

      if (result.rows.length === 0) {
        throw new Error('Email connection not found');
      }

      const connection = result.rows[0];

      // Decrypt access token
      const decryptedAccessToken = decryptCredentials(connection.access_token);

      // Revoke token with Google
      try {
        await this.oauth2Client.revokeToken(decryptedAccessToken.token);
        logger.info('Token revoked with Google', {
          connectionId,
          operation: 'oauth_revoke'
        });
      } catch (revokeError) {
        // Continue even if revocation fails (token might already be invalid)
        logger.warn('Failed to revoke token with Google', {
          connectionId,
          operation: 'oauth_revoke'
        }, revokeError instanceof Error ? revokeError : new Error('Unknown error'));
      }

      // Delete related records first (to avoid foreign key constraint violations)
      await pool.query(
        'DELETE FROM email_filter_configs WHERE connection_id = $1',
        [connectionId]
      );

      await pool.query(
        'DELETE FROM processed_emails WHERE connection_id = $1',
        [connectionId]
      );

      // Delete connection from database
      await pool.query(
        'DELETE FROM email_connections WHERE id = $1',
        [connectionId]
      );

      logger.info('Email connection revoked and deleted', {
        connectionId,
        operation: 'oauth_revoke'
      });
    } catch (error) {
      logger.error('Failed to revoke access', {
        connectionId,
        operation: 'oauth_revoke'
      }, error instanceof Error ? error : new Error('Unknown error'));
      
      throw new Error(`Failed to revoke access: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
