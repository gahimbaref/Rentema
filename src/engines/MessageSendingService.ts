import { Pool } from 'pg';
import { PlatformManager } from './PlatformManager';
import { MessageRepository } from '../database/repositories/MessageRepository';

interface SendMessageOptions {
  maxRetries?: number;
  retryDelayMs?: number;
}

/**
 * Message Sending Service
 * Handles message sending through platforms with retry logic
 */
export class MessageSendingService {
  private platformManager: PlatformManager;
  private messageRepository: MessageRepository;

  constructor(pool: Pool) {
    this.platformManager = new PlatformManager(pool);
    this.messageRepository = new MessageRepository(pool);
  }

  /**
   * Send a message through a platform with retry logic
   */
  async sendMessage(
    inquiryId: string,
    platformId: string,
    recipientId: string,
    content: string,
    options: SendMessageOptions = {}
  ): Promise<void> {
    const { maxRetries = 3, retryDelayMs = 1000 } = options;

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        // Attempt to send message
        await this.platformManager.sendMessage(platformId, recipientId, content);

        // Store message as sent
        await this.messageRepository.create({
          inquiryId,
          direction: 'outbound',
          content,
          status: 'sent'
        });

        return; // Success
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt < maxRetries) {
          // Wait before retrying with exponential backoff
          const delay = retryDelayMs * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed, store as failed
    await this.messageRepository.create({
      inquiryId,
      direction: 'outbound',
      content,
      status: 'failed'
    });

    throw new Error(
      `Failed to send message after ${maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Send a message with platform-specific formatting
   */
  async sendFormattedMessage(
    inquiryId: string,
    platformId: string,
    recipientId: string,
    content: string,
    platformType: string,
    options?: SendMessageOptions
  ): Promise<void> {
    // Apply platform-specific formatting
    const formattedContent = this.formatMessageForPlatform(content, platformType);

    // Send with retry logic
    await this.sendMessage(inquiryId, platformId, recipientId, formattedContent, options);
  }

  /**
   * Format message content for specific platform
   */
  private formatMessageForPlatform(content: string, platformType: string): string {
    switch (platformType) {
      case 'zillow':
        // Zillow-specific formatting (if needed)
        return content;
      case 'turbotenant':
        // TurboTenant-specific formatting (if needed)
        return content;
      case 'facebook':
        // Facebook-specific formatting (if needed)
        return content;
      case 'test':
        // Test mode - no special formatting
        return content;
      default:
        return content;
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
