import { RawEmail, PlatformType } from './PlatformMatcher';
import { logger } from '../utils/logger';

export interface ParsedInquiry {
  tenantName?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  message: string;
  propertyReference?: string;
  propertyAddress?: string;
  platformType: string;
  originalEmailId: string;
  receivedDate: Date;
  parsingErrors: string[];
}

export interface ParseResult {
  success: boolean;
  extractedFields: Record<string, any>;
  missingFields: string[];
  errors: string[];
}

/**
 * Email Parser
 * Extracts structured inquiry data from email content based on platform type
 */
export class EmailParser {
  /**
   * Parse an email and extract inquiry data based on platform type
   */
  async parseEmail(email: RawEmail, platformType: PlatformType): Promise<ParsedInquiry> {
    const startTime = Date.now();
    
    logger.debug('Starting email parsing', {
      emailId: email.id,
      platformType,
      operation: 'email_parse'
    });

    const baseInquiry: ParsedInquiry = {
      message: '',
      platformType,
      originalEmailId: email.id,
      receivedDate: email.receivedDate,
      parsingErrors: []
    };

    // Dispatch to platform-specific parser
    let result: ParsedInquiry;
    switch (platformType) {
      case 'facebook':
        result = this.parseFacebookEmail(email, baseInquiry);
        break;
      case 'zillow':
        result = this.parseZillowEmail(email, baseInquiry);
        break;
      case 'craigslist':
        result = this.parseCraigslistEmail(email, baseInquiry);
        break;
      case 'turbotenant':
        result = this.parseTurboTenantEmail(email, baseInquiry);
        break;
      case 'direct':
        result = this.parseDirectEmail(email, baseInquiry);
        break;
      case 'unknown':
        baseInquiry.parsingErrors.push('Unknown platform type - cannot parse');
        result = baseInquiry;
        break;
      default:
        baseInquiry.parsingErrors.push(`Unsupported platform type: ${platformType}`);
        result = baseInquiry;
        break;
    }

    const duration = Date.now() - startTime;
    
    if (result.parsingErrors.length > 0) {
      logger.warn('Email parsing completed with errors', {
        emailId: email.id,
        platformType,
        operation: 'email_parse',
        errors: result.parsingErrors,
        duration
      });
    } else {
      logger.info('Email parsing successful', {
        emailId: email.id,
        platformType,
        operation: 'email_parse',
        extractedFields: {
          tenantName: !!result.tenantName,
          tenantEmail: !!result.tenantEmail,
          tenantPhone: !!result.tenantPhone,
          message: !!result.message,
          propertyReference: !!result.propertyReference
        },
        duration
      });
    }

    return result;
  }

  /**
   * Test parse an email without creating an inquiry
   * Returns extracted fields and errors for testing
   */
  async testParse(email: RawEmail, platformType: PlatformType): Promise<ParseResult> {
    const parsed = await this.parseEmail(email, platformType);
    
    const extractedFields: Record<string, any> = {};
    const missingFields: string[] = [];

    // Check which fields were extracted
    if (parsed.tenantName) {
      extractedFields.tenantName = parsed.tenantName;
    } else {
      missingFields.push('tenantName');
    }

    if (parsed.tenantEmail) {
      extractedFields.tenantEmail = parsed.tenantEmail;
    }

    if (parsed.tenantPhone) {
      extractedFields.tenantPhone = parsed.tenantPhone;
    }

    if (parsed.message) {
      extractedFields.message = parsed.message;
    } else {
      missingFields.push('message');
    }

    if (parsed.propertyReference) {
      extractedFields.propertyReference = parsed.propertyReference;
    }

    if (parsed.propertyAddress) {
      extractedFields.propertyAddress = parsed.propertyAddress;
    }

    return {
      success: parsed.parsingErrors.length === 0,
      extractedFields,
      missingFields,
      errors: parsed.parsingErrors
    };
  }

  /**
   * Parse Facebook Marketplace inquiry email
   */
  private parseFacebookEmail(email: RawEmail, baseInquiry: ParsedInquiry): ParsedInquiry {
    const result = { ...baseInquiry };

    try {
      // Extract tenant name from subject or body
      // Facebook format: "New message from [Name]" or "[Name] sent you a message"
      const nameMatch = email.subject.match(/(?:from|message from)\s+([^:]+)/i) ||
                       email.subject.match(/^([^:]+)\s+sent you/i);
      if (nameMatch) {
        result.tenantName = nameMatch[1].trim();
      }

      // Extract message content from body
      // Remove HTML tags and extract the actual message
      const cleanBody = this.stripHtml(email.body);
      
      // Facebook emails often have the message after certain markers
      const messageMatch = cleanBody.match(/(?:message|wrote):\s*(.+?)(?:\n\n|View on Facebook|Reply to)/is);
      if (messageMatch) {
        result.message = messageMatch[1].trim();
      } else {
        // Fallback: use the first substantial paragraph
        const paragraphs = cleanBody.split('\n\n').filter(p => p.trim().length > 20);
        if (paragraphs.length > 0) {
          result.message = paragraphs[0].trim();
        }
      }

      // Extract property reference from subject
      // Facebook format often includes listing title
      const propertyMatch = email.subject.match(/about\s+(.+?)(?:\s*-\s*|\s*$)/i);
      if (propertyMatch) {
        result.propertyReference = propertyMatch[1].trim();
      }

      // Try to extract email from body
      const emailMatch = cleanBody.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        result.tenantEmail = emailMatch[1];
      }

      // Try to extract phone from body
      const phoneMatch = cleanBody.match(/(\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4})/);
      if (phoneMatch) {
        result.tenantPhone = phoneMatch[1].replace(/\s+/g, '');
      }

      // Validate required fields
      if (!result.message || result.message.trim().length === 0) {
        result.parsingErrors.push('Could not extract message content');
      }

    } catch (error) {
      result.parsingErrors.push(`Facebook parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Parse Zillow inquiry email
   */
  private parseZillowEmail(email: RawEmail, baseInquiry: ParsedInquiry): ParsedInquiry {
    const result = { ...baseInquiry };

    try {
      const cleanBody = this.stripHtml(email.body);

      // Extract tenant name
      // Zillow format: "Name: John Doe" or "From: John Doe"
      const nameMatch = cleanBody.match(/(?:Name|From):\s*([^\n]+)/i);
      if (nameMatch) {
        const extracted = nameMatch[1].trim();
        // Stop at Email: or other field markers
        const cleanName = extracted.split(/\s*(?:Email|Phone|Message):/i)[0].trim();
        if (cleanName) {
          result.tenantName = cleanName;
        }
      }

      // Extract email
      const emailMatch = cleanBody.match(/(?:Email|E-mail):\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i) ||
                        cleanBody.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        result.tenantEmail = emailMatch[1].trim();
      }

      // Extract phone
      const phoneMatch = cleanBody.match(/(?:Phone|Tel):\s*(\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4})/i) ||
                        cleanBody.match(/(\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4})/);
      if (phoneMatch) {
        result.tenantPhone = phoneMatch[1].trim().replace(/\s+/g, '');
      }

      // Extract message
      // Zillow format: "Message:" followed by the content
      const messageMatch = cleanBody.match(/Message:\s*(.+?)(?:\n\n|Property:|View listing|$)/is);
      if (messageMatch) {
        result.message = messageMatch[1].trim();
      } else {
        // Fallback: look for substantial text blocks
        const lines = cleanBody.split('\n').filter(l => l.trim().length > 30);
        if (lines.length > 0) {
          result.message = lines[0].trim();
        }
      }

      // Extract property address
      // Zillow format: "Property: [address]" or in subject line
      const addressMatch = cleanBody.match(/Property:\s*([^\n]+)/i) ||
                          email.subject.match(/(?:for|about)\s+(.+?)(?:\s*-\s*|\s*$)/i);
      if (addressMatch) {
        result.propertyAddress = addressMatch[1].trim();
        result.propertyReference = addressMatch[1].trim();
      }

      // Validate required fields
      if (!result.message || result.message.trim().length === 0) {
        result.parsingErrors.push('Could not extract message content');
      }

    } catch (error) {
      result.parsingErrors.push(`Zillow parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Parse Craigslist inquiry email
   */
  private parseCraigslistEmail(email: RawEmail, baseInquiry: ParsedInquiry): ParsedInquiry {
    const result = { ...baseInquiry };

    try {
      const cleanBody = this.stripHtml(email.body);

      // Extract tenant name from email address or body
      // Craigslist often anonymizes, so name might be in signature
      const nameMatch = cleanBody.match(/(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:\n|$)/m);
      if (nameMatch) {
        result.tenantName = nameMatch[1].trim();
      } else {
        // Try to extract from email sender
        const fromMatch = email.from.match(/^([^<@]+)/);
        if (fromMatch) {
          result.tenantName = fromMatch[1].trim();
        }
      }

      // Extract email - Craigslist uses anonymized emails, but might include real email in body
      const emailMatch = cleanBody.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        result.tenantEmail = emailMatch[1];
      }

      // Extract phone
      const phoneMatch = cleanBody.match(/(\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4})/);
      if (phoneMatch) {
        result.tenantPhone = phoneMatch[1].replace(/\s+/g, '');
      }

      // Extract message - Craigslist emails are usually straightforward
      // The main body is the message, excluding headers and footers
      const lines = cleanBody.split('\n');
      const contentLines = lines.filter(line => {
        const trimmed = line.trim();
        return trimmed.length > 0 && 
               !trimmed.startsWith('From:') &&
               !trimmed.startsWith('Reply to:') &&
               !trimmed.toLowerCase().includes('craigslist');
      });
      
      if (contentLines.length > 0) {
        result.message = contentLines.join('\n').trim();
      }

      // Extract property reference from subject
      // Craigslist format: "Reply to: [listing title]"
      const propertyMatch = email.subject.match(/(?:Reply to|Re):\s*(.+?)(?:\s*-\s*|\s*$)/i);
      if (propertyMatch) {
        result.propertyReference = propertyMatch[1].trim();
      }

      // Validate required fields
      if (!result.message) {
        result.parsingErrors.push('Could not extract message content');
      }

    } catch (error) {
      result.parsingErrors.push(`Craigslist parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Parse TurboTenant inquiry email
   */
  private parseTurboTenantEmail(email: RawEmail, baseInquiry: ParsedInquiry): ParsedInquiry {
    const result = { ...baseInquiry };

    try {
      const cleanBody = this.stripHtml(email.body);

      // Extract tenant name
      // TurboTenant format: "Name: John Doe"
      const nameMatch = cleanBody.match(/(?:Name|Applicant):\s*([^\n]+)/i);
      if (nameMatch) {
        result.tenantName = nameMatch[1].trim();
      }

      // Extract email
      const emailMatch = cleanBody.match(/(?:Email|Contact):\s*([^\n]+)/i) ||
                        cleanBody.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        result.tenantEmail = emailMatch[1].trim();
      }

      // Extract phone
      const phoneMatch = cleanBody.match(/(?:Phone|Mobile):\s*([^\n]+)/i) ||
                        cleanBody.match(/(\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4})/);
      if (phoneMatch) {
        result.tenantPhone = phoneMatch[1].trim().replace(/\s+/g, '');
      }

      // Extract message
      const messageMatch = cleanBody.match(/(?:Message|Comments?):\s*(.+?)(?:\n\n|Property|Listing|$)/is);
      if (messageMatch) {
        result.message = messageMatch[1].trim();
      } else {
        // Fallback: use substantial text blocks
        const paragraphs = cleanBody.split('\n\n').filter(p => p.trim().length > 20);
        if (paragraphs.length > 0) {
          result.message = paragraphs[0].trim();
        }
      }

      // Extract property address
      const addressMatch = cleanBody.match(/(?:Property|Listing|Address):\s*([^\n]+)/i) ||
                          email.subject.match(/(?:for|about)\s+(.+?)(?:\s*-\s*|\s*$)/i);
      if (addressMatch) {
        result.propertyAddress = addressMatch[1].trim();
        result.propertyReference = addressMatch[1].trim();
      }

      // Validate required fields
      if (!result.message) {
        result.parsingErrors.push('Could not extract message content');
      }

    } catch (error) {
      result.parsingErrors.push(`TurboTenant parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Parse direct inquiry email (not from a specific platform)
   * Uses generic patterns to extract information
   */
  private parseDirectEmail(email: RawEmail, baseInquiry: ParsedInquiry): ParsedInquiry {
    const result = { ...baseInquiry };

    try {
      const cleanBody = this.stripHtml(email.body);
      const fullText = `${email.subject}\n${cleanBody}`;

      // Extract tenant name from sender email or body
      // Try to get name from email address first
      const fromMatch = email.from.match(/^([^<]+)<([^>]+)>$/);
      if (fromMatch && fromMatch[1].trim()) {
        result.tenantName = fromMatch[1].trim();
      } else {
        // Try to find name in body
        const namePatterns = [
          /(?:my name is|i am|i'm|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i,
          /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m,
          /(?:from|regards|sincerely|thanks),?\s*\n?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i
        ];
        
        for (const pattern of namePatterns) {
          const match = cleanBody.match(pattern);
          if (match && match[1]) {
            result.tenantName = match[1].trim();
            break;
          }
        }
      }

      // Extract email from sender or body
      const emailMatch = email.from.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) {
        result.tenantEmail = emailMatch[1];
      } else {
        // Try to find email in body
        const bodyEmailMatch = cleanBody.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (bodyEmailMatch) {
          result.tenantEmail = bodyEmailMatch[1];
        }
      }

      // Extract phone number
      const phonePatterns = [
        /(?:phone|call|contact|mobile|cell)[\s:]*(\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4})/i,
        /(\+?1?\s*\(?[0-9]{3}\)?[\s.-]?[0-9]{3}[\s.-]?[0-9]{4})/
      ];
      
      for (const pattern of phonePatterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
          result.tenantPhone = match[1].replace(/\s+/g, '');
          break;
        }
      }

      // Extract property address
      const addressPatterns = [
        /(?:property|apartment|unit|address|located|at)\s*:?\s*([0-9]+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Circle|Cir|Place|Pl)[A-Za-z0-9\s,.-]*)/i,
        /([0-9]+\s+[A-Za-z0-9\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Circle|Cir|Place|Pl)[^.!?\n]*)/i
      ];
      
      for (const pattern of addressPatterns) {
        const match = fullText.match(pattern);
        if (match && match[1]) {
          result.propertyAddress = match[1].trim();
          break;
        }
      }

      // Use the entire email body as the message
      result.message = cleanBody.trim();

      // Validate required fields
      if (!result.message || result.message.trim().length === 0) {
        result.parsingErrors.push('Could not extract message content');
      }

      if (!result.tenantEmail) {
        result.parsingErrors.push('Could not extract tenant email address');
      }

    } catch (error) {
      result.parsingErrors.push(`Direct email parsing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Strip HTML tags from email body
   */
  private stripHtml(html: string): string {
    // Remove script and style tags with their content
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');
    
    // Decode HTML entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/\n\s+/g, '\n');
    text = text.trim();
    
    return text;
  }
}
