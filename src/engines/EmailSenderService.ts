import { google } from 'googleapis';
import { Pool } from 'pg';
import { SentEmailLogRepository } from '../database/repositories/SentEmailLogRepository';
import { EmailTemplateRepository } from '../database/repositories/EmailTemplateRepository';
import { logger } from '../utils/logger';

export interface SendEmailParams {
  connectionId: string;
  to: string;
  subject: string;
  htmlBody: string;
  plainTextBody?: string;
  replyTo?: string;
  inReplyTo?: string;
}

export interface SentEmail {
  id: string;
  messageId: string;
  to: string;
  subject: string;
  sentAt: Date;
  status: 'sent' | 'failed';
}

export interface TemplateData {
  inquiryId: string;
  tenantName: string;
  propertyAddress: string;
  managerName?: string;
  managerEmail?: string;
  managerPhone?: string;
  questionnaireLink?: string;
  expirationDate?: string;
  timeSlots?: Array<{ time: string; bookingLink: string }>;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentDuration?: string;
  videoCallLink?: string;
  cancellationLink?: string;
  [key: string]: any;
}

export class EmailSenderService {
  private sentEmailLogRepo: SentEmailLogRepository;
  private templateRepo: EmailTemplateRepository;
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
    this.sentEmailLogRepo = new SentEmailLogRepository(pool);
    this.templateRepo = new EmailTemplateRepository(pool);
  }

  private async getConnectionTokens(connectionId: string): Promise<{ accessToken: string; refreshToken: string }> {
    const result = await this.pool.query(
      'SELECT access_token, refresh_token FROM email_connections WHERE id = $1',
      [connectionId]
    );

    if (result.rows.length === 0) {
      throw new Error('Email connection not found');
    }

    const { access_token, refresh_token } = result.rows[0];
    
    // Decrypt tokens
    const { decryptCredentials } = await import('../database/encryption');
    const accessTokenData = decryptCredentials(access_token);
    const refreshTokenData = decryptCredentials(refresh_token);
    
    return { 
      accessToken: accessTokenData.token, 
      refreshToken: refreshTokenData.token 
    };
  }

  async sendEmail(params: SendEmailParams, inquiryId?: string): Promise<SentEmail> {
    try {
      // Get OAuth tokens for the connection
      const tokens = await this.getConnectionTokens(params.connectionId);
      
      if (!tokens) {
        throw new Error('No OAuth tokens found for connection');
      }

      // Create Gmail API client
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      // Create email message
      const message = this.createMimeMessage(params);
      const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      // Send email
      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      const sentEmail: SentEmail = {
        id: response.data.id || '',
        messageId: response.data.id || '',
        to: params.to,
        subject: params.subject,
        sentAt: new Date(),
        status: 'sent',
      };

      // Log the sent email
      if (inquiryId) {
        await this.sentEmailLogRepo.create({
          inquiryId,
          connectionId: params.connectionId,
          emailType: 'questionnaire', // Will be overridden by caller
          toAddress: params.to,
          subject: params.subject,
          gmailMessageId: response.data.id || undefined,
          status: 'sent',
        });
      }

      logger.info('Email sent successfully', {
        to: params.to,
        subject: params.subject,
        messageId: response.data.id,
      });

      return sentEmail;
    } catch (error: any) {
      logger.error('Failed to send email', {
        error: error.message,
        to: params.to,
        subject: params.subject,
      });

      // Log the failure
      if (inquiryId) {
        await this.sentEmailLogRepo.create({
          inquiryId,
          connectionId: params.connectionId,
          emailType: 'questionnaire',
          toAddress: params.to,
          subject: params.subject,
          status: 'failed',
          error: error.message,
        });
      }

      throw error;
    }
  }


  private createMimeMessage(params: SendEmailParams): string {
    const boundary = '----=_Part_' + Date.now();
    const plainText = params.plainTextBody || this.htmlToPlainText(params.htmlBody);

    let message = [
      `To: ${params.to}`,
      `Subject: ${params.subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];

    if (params.replyTo) {
      message.push(`Reply-To: ${params.replyTo}`);
    }

    if (params.inReplyTo) {
      message.push(`In-Reply-To: ${params.inReplyTo}`);
      message.push(`References: ${params.inReplyTo}`);
    }

    message.push('');
    message.push(`--${boundary}`);
    message.push('Content-Type: text/plain; charset=UTF-8');
    message.push('');
    message.push(plainText);
    message.push('');
    message.push(`--${boundary}`);
    message.push('Content-Type: text/html; charset=UTF-8');
    message.push('');
    message.push(params.htmlBody);
    message.push('');
    message.push(`--${boundary}--`);

    return message.join('\r\n');
  }

  private htmlToPlainText(html: string): string {
    // Simple HTML to plain text conversion
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  async sendTemplatedEmail(
    managerId: string,
    templateType: 'questionnaire' | 'qualified_scheduling' | 'disqualified_rejection' | 'appointment_confirmation',
    data: TemplateData,
    connectionId: string
  ): Promise<SentEmail> {
    // Get template
    const template = await this.templateRepo.findByManagerAndType(managerId, templateType);
    
    if (!template) {
      throw new Error(`No template found for type: ${templateType}`);
    }

    // Render template with data
    const subject = this.renderTemplate(template.subject, data);
    const htmlBody = this.renderTemplate(template.htmlBody, data);
    const plainTextBody = this.renderTemplate(template.plainTextBody, data);

    // Send email
    return this.sendEmail(
      {
        connectionId,
        to: data.tenantEmail || '',
        subject,
        htmlBody,
        plainTextBody,
      },
      data.inquiryId
    );
  }

  private renderTemplate(template: string, data: TemplateData): string {
    let rendered = template;

    // Replace all {{variable}} placeholders
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      
      // Special handling for timeSlots array
      if (key === 'timeSlots' && Array.isArray(value)) {
        const timeSlotsHtml = value.map((slot: any) => 
          `<a href="${slot.bookingLink}" style="display: block; padding: 15px; margin: 10px 0; background: #f8f9ff; border: 2px solid #667eea; border-radius: 8px; text-decoration: none; color: #333; text-align: center; font-weight: 500;">${slot.time}</a>`
        ).join('\n');
        rendered = rendered.replace(placeholder, timeSlotsHtml);
      } else {
        rendered = rendered.replace(placeholder, String(value || ''));
      }
    }

    return rendered;
  }

  async getEmailStatus(emailId: string): Promise<{ status: string; error?: string }> {
    // Query the sent_email_logs table
    const result = await this.pool.query(
      'SELECT status, error FROM sent_email_logs WHERE gmail_message_id = $1',
      [emailId]
    );

    if (result.rows.length === 0) {
      return { status: 'unknown' };
    }

    return {
      status: result.rows[0].status,
      error: result.rows[0].error || undefined,
    };
  }
}
