import { Pool } from 'pg';
import { logger } from '../utils/logger';

export enum NotificationType {
  TOKEN_REFRESH_FAILURE = 'token_refresh_failure',
  POLLING_FAILURE = 'polling_failure',
  HIGH_PARSING_FAILURE_RATE = 'high_parsing_failure_rate'
}

export interface Notification {
  id: string;
  managerId: string;
  connectionId?: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  isRead: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
}

/**
 * Notification Service
 * Handles creation and management of user notifications for email integration errors
 */
export class NotificationService {
  constructor(private pool: Pool) {}

  /**
   * Create a notification for token refresh failure
   */
  async notifyTokenRefreshFailure(
    managerId: string,
    connectionId: string,
    emailAddress: string,
    error: string
  ): Promise<void> {
    const correlationId = logger.generateCorrelationId();
    
    logger.info('Creating token refresh failure notification', {
      correlationId,
      managerId,
      connectionId,
      operation: 'notification_create'
    });

    try {
      await this.createNotification({
        managerId,
        connectionId,
        type: NotificationType.TOKEN_REFRESH_FAILURE,
        title: 'Email Connection Failed',
        message: `Your Gmail connection for ${emailAddress} has failed. Please reconnect your email account to continue receiving inquiries.`,
        severity: 'error',
        metadata: {
          emailAddress,
          error,
          action: 'reconnect_required'
        }
      });

      logger.info('Token refresh failure notification created', {
        correlationId,
        managerId,
        connectionId,
        operation: 'notification_create'
      });
    } catch (err) {
      logger.error('Failed to create token refresh failure notification', {
        correlationId,
        managerId,
        connectionId,
        operation: 'notification_create'
      }, err instanceof Error ? err : new Error('Unknown error'));
    }
  }

  /**
   * Create a notification for consecutive polling failures
   */
  async notifyPollingFailure(
    managerId: string,
    connectionId: string,
    emailAddress: string,
    consecutiveFailures: number,
    lastError?: string
  ): Promise<void> {
    const correlationId = logger.generateCorrelationId();
    
    logger.info('Creating polling failure notification', {
      correlationId,
      managerId,
      connectionId,
      consecutiveFailures,
      operation: 'notification_create'
    });

    try {
      await this.createNotification({
        managerId,
        connectionId,
        type: NotificationType.POLLING_FAILURE,
        title: 'Email Polling Issues',
        message: `We've encountered ${consecutiveFailures} consecutive failures while checking your email (${emailAddress}). This may affect inquiry capture.`,
        severity: 'warning',
        metadata: {
          emailAddress,
          consecutiveFailures,
          lastError,
          action: 'check_connection'
        }
      });

      logger.info('Polling failure notification created', {
        correlationId,
        managerId,
        connectionId,
        consecutiveFailures,
        operation: 'notification_create'
      });
    } catch (err) {
      logger.error('Failed to create polling failure notification', {
        correlationId,
        managerId,
        connectionId,
        operation: 'notification_create'
      }, err instanceof Error ? err : new Error('Unknown error'));
    }
  }

  /**
   * Create a notification for high parsing failure rate
   */
  async notifyHighParsingFailureRate(
    managerId: string,
    connectionId: string,
    emailAddress: string,
    failureRate: number,
    totalEmails: number,
    failedEmails: number
  ): Promise<void> {
    const correlationId = logger.generateCorrelationId();
    
    logger.info('Creating high parsing failure rate notification', {
      correlationId,
      managerId,
      connectionId,
      failureRate,
      operation: 'notification_create'
    });

    try {
      await this.createNotification({
        managerId,
        connectionId,
        type: NotificationType.HIGH_PARSING_FAILURE_RATE,
        title: 'Email Parsing Issues',
        message: `${failedEmails} out of ${totalEmails} recent emails from ${emailAddress} failed to parse correctly (${Math.round(failureRate * 100)}% failure rate). Some inquiries may require manual review.`,
        severity: 'warning',
        metadata: {
          emailAddress,
          failureRate,
          totalEmails,
          failedEmails,
          action: 'review_failed_emails'
        }
      });

      logger.info('High parsing failure rate notification created', {
        correlationId,
        managerId,
        connectionId,
        failureRate,
        operation: 'notification_create'
      });
    } catch (err) {
      logger.error('Failed to create high parsing failure rate notification', {
        correlationId,
        managerId,
        connectionId,
        operation: 'notification_create'
      }, err instanceof Error ? err : new Error('Unknown error'));
    }
  }

  /**
   * Create a notification in the database
   */
  private async createNotification(params: {
    managerId: string;
    connectionId?: string;
    type: NotificationType;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
    metadata?: Record<string, any>;
  }): Promise<Notification> {
    const result = await this.pool.query(
      `INSERT INTO notifications 
       (manager_id, connection_id, type, title, message, severity, is_read, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, manager_id, connection_id, type, title, message, severity, is_read, metadata, created_at`,
      [
        params.managerId,
        params.connectionId || null,
        params.type,
        params.title,
        params.message,
        params.severity,
        false,
        params.metadata ? JSON.stringify(params.metadata) : null
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      managerId: row.manager_id,
      connectionId: row.connection_id,
      type: row.type,
      title: row.title,
      message: row.message,
      severity: row.severity,
      isRead: row.is_read,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at
    };
  }

  /**
   * Get unread notifications for a manager
   */
  async getUnreadNotifications(managerId: string): Promise<Notification[]> {
    const result = await this.pool.query(
      `SELECT id, manager_id, connection_id, type, title, message, severity, is_read, metadata, created_at
       FROM notifications
       WHERE manager_id = $1 AND is_read = false
       ORDER BY created_at DESC`,
      [managerId]
    );

    return result.rows.map(row => ({
      id: row.id,
      managerId: row.manager_id,
      connectionId: row.connection_id,
      type: row.type,
      title: row.title,
      message: row.message,
      severity: row.severity,
      isRead: row.is_read,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: row.created_at
    }));
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await this.pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1',
      [notificationId]
    );
  }

  /**
   * Check parsing failure rate and notify if threshold exceeded
   */
  async checkParsingFailureRate(connectionId: string): Promise<void> {
    const correlationId = logger.generateCorrelationId();
    
    try {
      // Get connection details
      const connectionResult = await this.pool.query(
        'SELECT manager_id, email_address FROM email_connections WHERE id = $1',
        [connectionId]
      );

      if (connectionResult.rows.length === 0) {
        return;
      }

      const { manager_id: managerId, email_address: emailAddress } = connectionResult.rows[0];

      // Get recent email processing stats (last 24 hours)
      const statsResult = await this.pool.query(
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed
         FROM processed_emails
         WHERE connection_id = $1 
         AND processed_at > NOW() - INTERVAL '24 hours'`,
        [connectionId]
      );

      const { total, failed } = statsResult.rows[0];
      const totalCount = parseInt(total);
      const failedCount = parseInt(failed);

      // Only check if we have a meaningful sample size
      if (totalCount < 10) {
        return;
      }

      const failureRate = failedCount / totalCount;

      // Notify if failure rate exceeds 30%
      if (failureRate > 0.3) {
        logger.warn('High parsing failure rate detected', {
          correlationId,
          connectionId,
          managerId,
          failureRate,
          totalCount,
          failedCount,
          operation: 'parsing_failure_check'
        });

        await this.notifyHighParsingFailureRate(
          managerId,
          connectionId,
          emailAddress,
          failureRate,
          totalCount,
          failedCount
        );
      }
    } catch (error) {
      logger.error('Failed to check parsing failure rate', {
        correlationId,
        connectionId,
        operation: 'parsing_failure_check'
      }, error instanceof Error ? error : new Error('Unknown error'));
    }
  }
}
