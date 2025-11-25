import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { OAuthManager } from '../../engines/OAuthManager';
import { EmailInquiryService } from '../../engines/EmailInquiryService';
import { EmailFilterService } from '../../engines/EmailFilterService';
import { EmailParser } from '../../engines/EmailParser';
import { PlatformMatcher } from '../../engines/PlatformMatcher';
import { getPool } from '../../database/connection';

const router = Router();

// POST /email/connect - Initiate OAuth flow
router.post('/connect', authMiddleware, async (req: AuthRequest, res: Response, next) => {
  try {
    const oauthManager = new OAuthManager();
    // Pass manager ID in state parameter for callback
    const authUrl = oauthManager.getAuthorizationUrl(req.managerId!);

    res.json({
      authorizationUrl: authUrl,
      message: 'Redirect user to this URL to authorize Gmail access'
    });
  } catch (error) {
    next(error);
  }
});

// GET /email/callback - OAuth callback handler (no auth required - called by Google)
router.get('/callback', async (req, res: Response, next) => {
  try {
    const { code, state } = req.query;

    if (!code || typeof code !== 'string') {
      throw new ValidationError('Authorization code is required');
    }

    if (!state || typeof state !== 'string') {
      throw new ValidationError('State parameter (manager ID) is required');
    }

    const managerId = state;
    const oauthManager = new OAuthManager();
    const connection = await oauthManager.exchangeCodeForTokens(code, managerId);

    // Redirect back to the frontend with success
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/email-connection?success=true&email=${encodeURIComponent(connection.emailAddress)}`);
  } catch (error) {
    // Redirect back to frontend with error
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.redirect(`${frontendUrl}/email-connection?success=false&error=${encodeURIComponent(errorMessage)}`);
  }
});

// DELETE /email/disconnect - Revoke email connection
router.delete('/disconnect', authMiddleware, async (req: AuthRequest, res: Response, next) => {
  try {
    const pool = getPool();
    
    // Find active connection for this manager
    const result = await pool.query(
      'SELECT id FROM email_connections WHERE manager_id = $1 AND is_active = true',
      [req.managerId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('No active email connection found');
    }

    const connectionId = result.rows[0].id;
    const oauthManager = new OAuthManager();
    await oauthManager.revokeAccess(connectionId);

    res.json({
      message: 'Email connection disconnected successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /email/status - Get connection status
router.get('/status', authMiddleware, async (req: AuthRequest, res: Response, next) => {
  try {
    const pool = getPool();
    
    // Find active connection for this manager
    const result = await pool.query(
      'SELECT id, email_address, is_active, last_poll_time, created_at FROM email_connections WHERE manager_id = $1 AND is_active = true',
      [req.managerId]
    );

    if (result.rows.length === 0) {
      res.json({
        connected: false,
        message: 'No active email connection'
      });
      return;
    }

    const connection = result.rows[0];

    res.json({
      connected: true,
      emailAddress: connection.email_address,
      lastPollTime: connection.last_poll_time,
      createdAt: connection.created_at
    });
  } catch (error) {
    next(error);
  }
});

// POST /email/sync - Manual sync trigger
router.post('/sync', authMiddleware, async (req: AuthRequest, res: Response, next) => {
  try {
    const pool = getPool();
    
    // Find active connection for this manager
    const result = await pool.query(
      'SELECT id FROM email_connections WHERE manager_id = $1 AND is_active = true',
      [req.managerId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('No active email connection found');
    }

    const connectionId = result.rows[0].id;
    
    // First, poll Gmail for new emails
    const { InquiryPollingService } = await import('../../engines/InquiryPollingService');
    const pollingService = new InquiryPollingService();
    await pollingService.pollNow(connectionId);
    
    // Then process the fetched emails
    const emailInquiryService = new EmailInquiryService(pool);
    const processingResult = await emailInquiryService.processNewEmails(connectionId);

    res.json({
      message: 'Email sync completed',
      emailsProcessed: processingResult.emailsProcessed,
      inquiriesCreated: processingResult.inquiriesCreated,
      inquiriesUnmatched: processingResult.inquiriesUnmatched,
      errors: processingResult.errors
    });
  } catch (error) {
    next(error);
  }
});

// GET /email/filters - Get filter configuration
router.get('/filters', authMiddleware, async (req: AuthRequest, res: Response, next) => {
  try {
    const pool = getPool();
    
    // Find active connection for this manager
    const result = await pool.query(
      'SELECT id FROM email_connections WHERE manager_id = $1 AND is_active = true',
      [req.managerId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('No active email connection found');
    }

    const connectionId = result.rows[0].id;
    const emailFilterService = new EmailFilterService(pool);
    const filters = await emailFilterService.getFilters(connectionId);

    res.json(filters);
  } catch (error) {
    next(error);
  }
});

// PUT /email/filters - Update filter configuration
router.put('/filters', authMiddleware, async (req: AuthRequest, res: Response, next) => {
  try {
    const { senderWhitelist, subjectKeywords, excludeSenders, excludeSubjectKeywords } = req.body;

    // Validation
    if (senderWhitelist && !Array.isArray(senderWhitelist)) {
      throw new ValidationError('senderWhitelist must be an array');
    }
    if (subjectKeywords && !Array.isArray(subjectKeywords)) {
      throw new ValidationError('subjectKeywords must be an array');
    }
    if (excludeSenders && !Array.isArray(excludeSenders)) {
      throw new ValidationError('excludeSenders must be an array');
    }
    if (excludeSubjectKeywords && !Array.isArray(excludeSubjectKeywords)) {
      throw new ValidationError('excludeSubjectKeywords must be an array');
    }

    const pool = getPool();
    
    // Find active connection for this manager
    const result = await pool.query(
      'SELECT id FROM email_connections WHERE manager_id = $1 AND is_active = true',
      [req.managerId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('No active email connection found');
    }

    const connectionId = result.rows[0].id;
    const emailFilterService = new EmailFilterService(pool);
    
    await emailFilterService.saveFilters(connectionId, {
      senderWhitelist: senderWhitelist || [],
      subjectKeywords: subjectKeywords || [],
      excludeSenders: excludeSenders || [],
      excludeSubjectKeywords: excludeSubjectKeywords || []
    });

    res.json({
      message: 'Email filters updated successfully'
    });
  } catch (error) {
    next(error);
  }
});

// GET /email/stats - Get processing statistics
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response, next) => {
  try {
    const { startDate, endDate } = req.query;

    const pool = getPool();
    
    // Find active connection for this manager
    const result = await pool.query(
      'SELECT id FROM email_connections WHERE manager_id = $1 AND is_active = true',
      [req.managerId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('No active email connection found');
    }

    const connectionId = result.rows[0].id;
    const emailInquiryService = new EmailInquiryService(pool);
    
    let dateRange;
    if (startDate && endDate) {
      dateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };
    }

    const stats = await emailInquiryService.getProcessingStats(connectionId, dateRange);

    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// POST /email/test-parse - Test mode parsing
router.post('/test-parse', authMiddleware, async (req: AuthRequest, res: Response, next) => {
  try {
    const { from, subject, body, platformType } = req.body;

    // Validation
    if (!from || typeof from !== 'string') {
      throw new ValidationError('from (sender email) is required');
    }
    if (!subject || typeof subject !== 'string') {
      throw new ValidationError('subject is required');
    }
    if (!body || typeof body !== 'string') {
      throw new ValidationError('body is required');
    }

    const pool = getPool();
    const platformMatcher = new PlatformMatcher(pool);
    const emailParser = new EmailParser();

    // Create RawEmail object
    const rawEmail = {
      id: 'test-' + Date.now(),
      from,
      subject,
      body,
      receivedDate: new Date()
    };

    // Identify platform if not provided
    let detectedPlatformType = platformType;
    if (!detectedPlatformType) {
      const platformMatch = await platformMatcher.identifyPlatform(rawEmail);
      detectedPlatformType = platformMatch.platformType;
    }

    // Parse email
    const parseResult = await emailParser.testParse(rawEmail, detectedPlatformType);

    res.json({
      platformType: detectedPlatformType,
      ...parseResult
    });
  } catch (error) {
    next(error);
  }
});

export default router;
