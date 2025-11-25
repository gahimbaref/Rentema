import { google } from 'googleapis';
import * as cron from 'node-cron';
import { getDatabasePool } from '../database/connection';
import { decryptCredentials } from '../database/encryption';
import { OAuthManager } from './OAuthManager';
import { logger } from '../utils/logger';
import { NotificationService } from './NotificationService';

export interface PollResult {
  emailsFound: number;
  emailsProcessed: number;
  emailsSkipped: number;
  errors: string[];
  timestamp: Date;
}

export interface PollingStatus {
  isActive: boolean;
  lastPollTime?: Date;
  nextPollTime?: Date;
  consecutiveFailures: number;
}

export interface RawEmail {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedDate: Date;
}

/**
 * EmailPoller handles periodic checking of Gmail accounts for new inquiry emails
 */
export class InquiryPollingService {
  private oauth2Client;
  private oauthManager: OAuthManager;
  private notificationService: NotificationService;
  private pollingJobs: Map<string, cron.ScheduledTask> = new Map();
  private pollingStatus: Map<string, PollingStatus> = new Map();

  constructor() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Gmail OAuth configuration missing');
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    this.oauthManager = new OAuthManager();
    this.notificationService = new NotificationService(getDatabasePool());
  }

  /**
   * Poll Gmail account immediately for new emails
   * Fetches unread emails from the last 7 days
   */
  async pollNow(connectionId: string): Promise<PollResult> {
    const correlationId = logger.generateCorrelationId();
    const startTime = Date.now();
    
    logger.info('Starting email poll', {
      correlationId,
      connectionId,
      operation: 'email_poll'
    });

    const result: PollResult = {
      emailsFound: 0,
      emailsProcessed: 0,
      emailsSkipped: 0,
      errors: [],
      timestamp: new Date()
    };

    try {
      const pool = getDatabasePool();
      
      // Get connection details
      const connectionResult = await pool.query(
        'SELECT * FROM email_connections WHERE id = $1 AND is_active = true',
        [connectionId]
      );

      if (connectionResult.rows.length === 0) {
        logger.warn('Email connection not found or inactive', {
          correlationId,
          connectionId,
          operation: 'email_poll'
        });
        result.errors.push('Email connection not found or inactive');
        return result;
      }

      const connection = connectionResult.rows[0];

      // Check if token is expired
      const now = new Date();
      const tokenExpiry = new Date(connection.token_expiry);
      
      if (tokenExpiry <= now) {
        // Token expired, try to refresh
        logger.info('Token expired, attempting refresh', {
          correlationId,
          connectionId,
          operation: 'email_poll'
        });
        
        try {
          await this.oauthManager.refreshAccessToken(connectionId);
          
          // Re-fetch connection with new token
          const refreshedResult = await pool.query(
            'SELECT * FROM email_connections WHERE id = $1',
            [connectionId]
          );
          
          if (refreshedResult.rows.length === 0) {
            result.errors.push('Connection lost after token refresh');
            return result;
          }
          
          connection.access_token = refreshedResult.rows[0].access_token;
          
          logger.info('Token refreshed successfully during poll', {
            correlationId,
            connectionId,
            operation: 'email_poll'
          });
        } catch (error) {
          logger.error('Token refresh failed during poll', {
            correlationId,
            connectionId,
            operation: 'email_poll'
          }, error instanceof Error ? error : new Error('Unknown error'));
          
          result.errors.push(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          await this.incrementFailureCount(connectionId);
          return result;
        }
      }

      // Decrypt access token
      const decryptedToken = decryptCredentials(connection.access_token);
      
      // Set credentials
      this.oauth2Client.setCredentials({
        access_token: decryptedToken.token
      });

      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Calculate date 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const afterTimestamp = Math.floor(sevenDaysAgo.getTime() / 1000);

      // Query for unread messages from last 7 days
      const query = `is:unread after:${afterTimestamp}`;
      
      const listResponse = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 100
      });

      const messages = listResponse.data.messages || [];
      result.emailsFound = messages.length;

      logger.info('Retrieved emails from Gmail', {
        correlationId,
        connectionId,
        operation: 'email_poll',
        emailsFound: messages.length
      });

      // Process each message
      for (const message of messages) {
        try {
          if (!message.id) {
            result.emailsSkipped++;
            continue;
          }

          // Check if already processed
          const processedCheck = await pool.query(
            'SELECT id FROM processed_emails WHERE email_id = $1 AND connection_id = $2',
            [message.id, connectionId]
          );

          if (processedCheck.rows.length > 0) {
            result.emailsSkipped++;
            continue;
          }

          // Fetch full message
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full'
          });

          // Extract email data
          const rawEmail = this.extractEmailData(fullMessage.data);

          if (!rawEmail) {
            result.emailsSkipped++;
            continue;
          }

          // Mark as read
          await gmail.users.messages.modify({
            userId: 'me',
            id: message.id,
            requestBody: {
              removeLabelIds: ['UNREAD']
            }
          });

          // Store in processed_emails (will be processed by EmailInquiryService)
          await pool.query(
            `INSERT INTO processed_emails 
             (connection_id, email_id, "from", subject, body, received_date, processing_status)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [connectionId, message.id, rawEmail.from, rawEmail.subject, rawEmail.body, rawEmail.receivedDate, 'pending']
          );

          result.emailsProcessed++;
        } catch (error) {
          logger.error('Error processing email message', {
            correlationId,
            connectionId,
            emailId: message.id || 'unknown',
            operation: 'email_poll'
          }, error instanceof Error ? error : new Error('Unknown error'));
          
          result.errors.push(`Error processing message ${message.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.emailsSkipped++;
        }
      }

      // Update last poll time
      await pool.query(
        'UPDATE email_connections SET last_poll_time = CURRENT_TIMESTAMP WHERE id = $1',
        [connectionId]
      );

      // Reset failure count on success
      await this.resetFailureCount(connectionId);

      const duration = Date.now() - startTime;
      logger.info('Email poll completed successfully', {
        correlationId,
        connectionId,
        operation: 'email_poll',
        emailsFound: result.emailsFound,
        emailsProcessed: result.emailsProcessed,
        emailsSkipped: result.emailsSkipped,
        duration
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Email poll failed', {
        correlationId,
        connectionId,
        operation: 'email_poll',
        duration
      }, error instanceof Error ? error : new Error('Unknown error'));
      
      result.errors.push(`Polling failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.incrementFailureCount(connectionId);
      return result;
    }
  }

  /**
   * Extract email data from Gmail message
   */
  private extractEmailData(message: any): RawEmail | null {
    try {
      const headers = message.payload?.headers || [];
      
      const fromHeader = headers.find((h: any) => h.name.toLowerCase() === 'from');
      const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === 'subject');
      const dateHeader = headers.find((h: any) => h.name.toLowerCase() === 'date');

      if (!fromHeader || !subjectHeader) {
        return null;
      }

      // Extract body
      let body = '';
      if (message.payload?.body?.data) {
        body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
      } else if (message.payload?.parts) {
        // Multi-part message
        for (const part of message.payload.parts) {
          if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
            if (part.body?.data) {
              body += Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
          }
        }
      }

      const receivedDate = dateHeader ? new Date(dateHeader.value) : new Date(parseInt(message.internalDate));

      return {
        id: message.id,
        from: fromHeader.value,
        subject: subjectHeader.value,
        body,
        receivedDate
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Start scheduled polling for a connection (every 5 minutes)
   */
  startPolling(connectionId: string): void {
    // Stop existing job if any
    this.stopPolling(connectionId);

    // Create cron job for every 5 minutes
    const job = cron.schedule('*/5 * * * *', async () => {
      await this.pollNow(connectionId);
    });

    this.pollingJobs.set(connectionId, job);
    
    this.pollingStatus.set(connectionId, {
      isActive: true,
      lastPollTime: undefined,
      nextPollTime: this.getNextPollTime(),
      consecutiveFailures: 0
    });
  }

  /**
   * Stop scheduled polling for a connection
   */
  stopPolling(connectionId: string): void {
    const job = this.pollingJobs.get(connectionId);
    if (job) {
      job.stop();
      this.pollingJobs.delete(connectionId);
    }

    const status = this.pollingStatus.get(connectionId);
    if (status) {
      status.isActive = false;
      this.pollingStatus.set(connectionId, status);
    }
  }

  /**
   * Get polling status for a connection
   */
  getPollingStatus(connectionId: string): PollingStatus {
    return this.pollingStatus.get(connectionId) || {
      isActive: false,
      consecutiveFailures: 0
    };
  }

  /**
   * Calculate next poll time (5 minutes from now)
   */
  private getNextPollTime(): Date {
    const next = new Date();
    next.setMinutes(next.getMinutes() + 5);
    return next;
  }

  /**
   * Increment consecutive failure count
   */
  private async incrementFailureCount(connectionId: string): Promise<void> {
    const status = this.pollingStatus.get(connectionId) || {
      isActive: false,
      consecutiveFailures: 0
    };

    status.consecutiveFailures++;
    this.pollingStatus.set(connectionId, status);

    // If too many failures, notify user
    if (status.consecutiveFailures >= 3) {
      logger.error('Connection has multiple consecutive failures', {
        connectionId,
        consecutiveFailures: status.consecutiveFailures,
        operation: 'email_poll'
      });
      
      // Send notification to property manager
      try {
        const pool = getDatabasePool();
        const connectionResult = await pool.query(
          'SELECT manager_id, email_address FROM email_connections WHERE id = $1',
          [connectionId]
        );
        
        if (connectionResult.rows.length > 0) {
          const { manager_id, email_address } = connectionResult.rows[0];
          await this.notificationService.notifyPollingFailure(
            manager_id,
            connectionId,
            email_address,
            status.consecutiveFailures
          );
        }
      } catch (notificationError) {
        logger.error('Failed to send polling failure notification', {
          connectionId,
          operation: 'email_poll'
        }, notificationError instanceof Error ? notificationError : new Error('Unknown error'));
      }
    }
  }

  /**
   * Reset consecutive failure count
   */
  private async resetFailureCount(connectionId: string): Promise<void> {
    const status = this.pollingStatus.get(connectionId);
    if (status) {
      status.consecutiveFailures = 0;
      status.lastPollTime = new Date();
      status.nextPollTime = this.getNextPollTime();
      this.pollingStatus.set(connectionId, status);
    }
  }
}
