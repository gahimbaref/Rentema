import { Pool } from 'pg';
import { PlatformMatcher, RawEmail } from './PlatformMatcher';
import { EmailParser, ParsedInquiry } from './EmailParser';
import { PropertyMatcher } from './PropertyMatcher';
import { WorkflowOrchestrator } from './WorkflowOrchestrator';
import { EmailFilterService } from './EmailFilterService';
import { InquiryRepository } from '../database/repositories/InquiryRepository';
import { logger } from '../utils/logger';
import { NotificationService } from './NotificationService';

export interface ProcessingResult {
  emailsProcessed: number;
  inquiriesCreated: number;
  inquiriesUnmatched: number;
  errors: ProcessingError[];
}

export interface ProcessingError {
  emailId: string;
  error: string;
  timestamp: Date;
}

export interface EmailStats {
  totalEmailsProcessed: number;
  successfulExtractions: number;
  failedParsing: number;
  platformBreakdown: Record<string, number>;
  lastSyncTime?: Date;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Email Inquiry Service
 * Orchestrates the email-to-inquiry conversion process
 * Coordinates polling, parsing, property matching, and inquiry creation
 */
export class EmailInquiryService {
  private pool: Pool;
  private platformMatcher: PlatformMatcher;
  private emailParser: EmailParser;
  private propertyMatcher: PropertyMatcher;
  private workflowOrchestrator: WorkflowOrchestrator;
  private emailFilterService: EmailFilterService;
  private inquiryRepository: InquiryRepository;
  private notificationService: NotificationService;

  constructor(pool: Pool, redisUrl?: string) {
    this.pool = pool;
    this.platformMatcher = new PlatformMatcher(pool);
    this.emailParser = new EmailParser();
    this.propertyMatcher = new PropertyMatcher(pool);
    this.workflowOrchestrator = new WorkflowOrchestrator(pool, redisUrl);
    this.emailFilterService = new EmailFilterService(pool);
    this.inquiryRepository = new InquiryRepository(pool);
    this.notificationService = new NotificationService(pool);
  }

  /**
   * Process new emails from a connection
   * Coordinates the full pipeline: filtering, platform matching, parsing, property matching, inquiry creation
   */
  async processNewEmails(connectionId: string): Promise<ProcessingResult> {
    const correlationId = logger.generateCorrelationId();
    const startTime = Date.now();
    
    logger.info('Starting email processing', {
      correlationId,
      connectionId,
      operation: 'email_processing'
    });

    const result: ProcessingResult = {
      emailsProcessed: 0,
      inquiriesCreated: 0,
      inquiriesUnmatched: 0,
      errors: []
    };

    try {
      // Get connection details
      const connectionResult = await this.pool.query(
        'SELECT * FROM email_connections WHERE id = $1 AND is_active = true',
        [connectionId]
      );

      if (connectionResult.rows.length === 0) {
        result.errors.push({
          emailId: 'N/A',
          error: 'Email connection not found or inactive',
          timestamp: new Date()
        });
        return result;
      }

      const connection = connectionResult.rows[0];
      const managerId = connection.manager_id;

      // Get email filters for this connection
      const filters = await this.emailFilterService.getFilters(connectionId);

      // Get pending emails to process
      const pendingEmailsResult = await this.pool.query(
        `SELECT * FROM processed_emails 
         WHERE connection_id = $1 AND processing_status = 'pending'
         ORDER BY received_date ASC`,
        [connectionId]
      );

      const pendingEmails = pendingEmailsResult.rows;

      for (const emailRecord of pendingEmails) {
        try {
          // Construct RawEmail object
          const rawEmail: RawEmail = {
            id: emailRecord.email_id,
            from: emailRecord.from,
            subject: emailRecord.subject || '',
            body: emailRecord.body || '',
            receivedDate: new Date(emailRecord.received_date)
          };

          // Apply filters
          const passesFilter = this.emailFilterService.applyFilters(rawEmail, filters);
          
          if (!passesFilter) {
            // Mark as skipped
            await this.pool.query(
              `UPDATE processed_emails 
               SET processing_status = 'skipped', processed_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [emailRecord.id]
            );
            continue;
          }

          // Check for duplicate by email_id
          const duplicateCheck = await this.pool.query(
            'SELECT id FROM inquiries WHERE source_email_id = $1',
            [emailRecord.email_id]
          );

          if (duplicateCheck.rows.length > 0) {
            // Already processed, mark as success
            await this.pool.query(
              `UPDATE processed_emails 
               SET processing_status = 'success', inquiry_id = $1, processed_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [duplicateCheck.rows[0].id, emailRecord.id]
            );
            continue;
          }

          // Identify platform
          const platformMatch = await this.platformMatcher.identifyPlatform(rawEmail);
          
          if (platformMatch.platformType === 'unknown') {
            // Unknown platform, mark as skipped
            await this.pool.query(
              `UPDATE processed_emails 
               SET processing_status = 'skipped', platform_type = 'unknown', processed_at = CURRENT_TIMESTAMP
               WHERE id = $1`,
              [emailRecord.id]
            );
            continue;
          }

          // Update platform type in processed_emails
          await this.pool.query(
            'UPDATE processed_emails SET platform_type = $1 WHERE id = $2',
            [platformMatch.platformType, emailRecord.id]
          );

          // Parse email to extract inquiry data
          // Note: We need to fetch the full email body from Gmail for proper parsing
          // For now, we'll work with what we have
          const parsedInquiry = await this.emailParser.parseEmail(rawEmail, platformMatch.platformType);

          // Check if parsing was successful
          if (parsedInquiry.parsingErrors.length > 0 && !parsedInquiry.message) {
            // Critical parsing failure
            logger.error('Critical parsing failure', {
              correlationId,
              connectionId,
              emailId: emailRecord.email_id,
              platformType: platformMatch.platformType,
              operation: 'email_processing',
              errors: parsedInquiry.parsingErrors
            });

            await this.pool.query(
              `UPDATE processed_emails 
               SET processing_status = 'failed', parsing_errors = $1, processed_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [JSON.stringify(parsedInquiry.parsingErrors), emailRecord.id]
            );
            
            result.errors.push({
              emailId: emailRecord.email_id,
              error: `Parsing failed: ${parsedInquiry.parsingErrors.join(', ')}`,
              timestamp: new Date()
            });
            continue;
          }

          // Create inquiry from parsed data
          const inquiryId = await this.createInquiryFromEmail(parsedInquiry, managerId, connectionId);

          // Update processed_emails record
          await this.pool.query(
            `UPDATE processed_emails 
             SET processing_status = 'success', inquiry_id = $1, 
                 parsing_errors = $2, processed_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [
              inquiryId,
              parsedInquiry.parsingErrors.length > 0 ? JSON.stringify(parsedInquiry.parsingErrors) : null,
              emailRecord.id
            ]
          );

          result.emailsProcessed++;
          result.inquiriesCreated++;

          logger.info('Successfully created inquiry from email', {
            correlationId,
            connectionId,
            emailId: emailRecord.email_id,
            inquiryId,
            platformType: platformMatch.platformType,
            operation: 'email_processing'
          });

        } catch (error) {
          // Log error and continue with next email
          logger.error('Failed to process email', {
            correlationId,
            connectionId,
            emailId: emailRecord.email_id,
            operation: 'email_processing'
          }, error instanceof Error ? error : new Error('Unknown error'));

          result.errors.push({
            emailId: emailRecord.email_id,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          });

          // Mark as failed
          await this.pool.query(
            `UPDATE processed_emails 
             SET processing_status = 'failed', 
                 parsing_errors = $1, 
                 processed_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [JSON.stringify([error instanceof Error ? error.message : 'Unknown error']), emailRecord.id]
          );
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Email processing completed', {
        correlationId,
        connectionId,
        operation: 'email_processing',
        emailsProcessed: result.emailsProcessed,
        inquiriesCreated: result.inquiriesCreated,
        inquiriesUnmatched: result.inquiriesUnmatched,
        errors: result.errors.length,
        duration
      });

      // Check parsing failure rate and notify if needed
      await this.notificationService.checkParsingFailureRate(connectionId);

      // Update last_poll_time for the connection
      await this.pool.query(
        'UPDATE email_connections SET last_poll_time = CURRENT_TIMESTAMP WHERE id = $1',
        [connectionId]
      );

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Email processing failed', {
        correlationId,
        connectionId,
        operation: 'email_processing',
        duration
      }, error instanceof Error ? error : new Error('Unknown error'));

      result.errors.push({
        emailId: 'N/A',
        error: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      });
      return result;
    }
  }

  /**
   * Create an inquiry from parsed email data
   * Handles property matching and workflow triggering
   */
  async createInquiryFromEmail(
    parsedInquiry: ParsedInquiry,
    managerId: string,
    _connectionId: string
  ): Promise<string> {
    // Try to match property
    let propertyId: string | undefined;
    let propertyMatch;

    if (parsedInquiry.propertyAddress) {
      propertyMatch = await this.propertyMatcher.matchByAddress(parsedInquiry.propertyAddress, managerId);
    } else if (parsedInquiry.propertyReference) {
      propertyMatch = await this.propertyMatcher.matchProperty(parsedInquiry.propertyReference, managerId);
    }

    if (propertyMatch && propertyMatch.matched && propertyMatch.propertyId) {
      propertyId = propertyMatch.propertyId;
    }

    // If no property match, we need to handle unmatched inquiry
    // For now, we'll throw an error or create with a placeholder
    if (!propertyId) {
      // Get the first property for this manager as a fallback
      // In production, this should create an "unmatched" inquiry for manual assignment
      const propertiesResult = await this.pool.query(
        'SELECT id FROM properties WHERE manager_id = $1 AND is_archived = false LIMIT 1',
        [managerId]
      );

      if (propertiesResult.rows.length === 0) {
        throw new Error('No properties found for manager and no property match');
      }

      propertyId = propertiesResult.rows[0].id as string;
    }

    // Get or create platform connection for email
    // We need a platform_id for the inquiry
    // For email-based inquiries, we'll use a special "email" platform connection
    let platformId: string;
    
    const platformResult = await this.pool.query(
      `SELECT id FROM platform_connections 
       WHERE manager_id = $1 AND platform_type = 'email'
       LIMIT 1`,
      [managerId]
    );

    if (platformResult.rows.length > 0) {
      platformId = platformResult.rows[0].id;
    } else {
      // Create email platform connection
      const createPlatformResult = await this.pool.query(
        `INSERT INTO platform_connections (manager_id, platform_type, credentials, is_active)
         VALUES ($1, 'email', '{}', true)
         RETURNING id`,
        [managerId]
      );
      platformId = createPlatformResult.rows[0].id;
    }

    // Create inquiry
    const inquiry = await this.inquiryRepository.create({
      propertyId,
      platformId,
      externalInquiryId: parsedInquiry.originalEmailId,
      prospectiveTenantId: parsedInquiry.tenantEmail || parsedInquiry.originalEmailId,
      prospectiveTenantName: parsedInquiry.tenantName,
      status: 'new',
      sourceType: 'email',
      sourceEmailId: parsedInquiry.originalEmailId,
      sourceMetadata: {
        connectionId: _connectionId,
        platformType: parsedInquiry.platformType,
        receivedDate: parsedInquiry.receivedDate,
        tenantEmail: parsedInquiry.tenantEmail,
        tenantPhone: parsedInquiry.tenantPhone,
        message: parsedInquiry.message,
        propertyReference: parsedInquiry.propertyReference,
        propertyAddress: parsedInquiry.propertyAddress,
        parsingErrors: parsedInquiry.parsingErrors
      }
    });

    // Trigger pre-qualification workflow
    await this.workflowOrchestrator.processNewInquiry(inquiry);

    return inquiry.id;
  }

  /**
   * Get processing statistics for a connection
   */
  async getProcessingStats(connectionId: string, dateRange?: DateRange): Promise<EmailStats> {
    let query = `
      SELECT 
        COUNT(*) as total_processed,
        COUNT(CASE WHEN processing_status = 'success' THEN 1 END) as successful,
        COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed,
        platform_type,
        MAX(processed_at) as last_sync
      FROM processed_emails
      WHERE connection_id = $1
    `;

    const params: any[] = [connectionId];

    if (dateRange) {
      query += ` AND processed_at BETWEEN $2 AND $3`;
      params.push(dateRange.startDate, dateRange.endDate);
    }

    query += ` GROUP BY platform_type`;

    const result = await this.pool.query(query, params);

    // Aggregate results
    let totalEmailsProcessed = 0;
    let successfulExtractions = 0;
    let failedParsing = 0;
    const platformBreakdown: Record<string, number> = {};
    let lastSyncTime: Date | undefined;

    for (const row of result.rows) {
      const count = parseInt(row.total_processed);
      totalEmailsProcessed += count;
      successfulExtractions += parseInt(row.successful);
      failedParsing += parseInt(row.failed);

      if (row.platform_type) {
        platformBreakdown[row.platform_type] = count;
      }

      if (row.last_sync) {
        const syncTime = new Date(row.last_sync);
        if (!lastSyncTime || syncTime > lastSyncTime) {
          lastSyncTime = syncTime;
        }
      }
    }

    return {
      totalEmailsProcessed,
      successfulExtractions,
      failedParsing,
      platformBreakdown,
      lastSyncTime
    };
  }

  /**
   * Close connections (for graceful shutdown)
   */
  async close(): Promise<void> {
    await this.workflowOrchestrator.close();
  }
}
