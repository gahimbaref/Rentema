import { Pool } from 'pg';
import Queue from 'bull';
import { MessageRepository } from '../database/repositories/MessageRepository';
import { PlatformManager } from './PlatformManager';
import { Message } from '../models';

export interface OutgoingMessage {
  inquiryId: string;
  platformId: string;
  recipientId: string;
  content: string;
  priority: 'high' | 'normal' | 'low';
}

export interface ReminderRequest {
  inquiryId: string;
  platformId: string;
  recipientId: string;
  content: string;
  scheduledTime: Date;
}

interface MessageJobData {
  inquiryId: string;
  platformId: string;
  recipientId: string;
  content: string;
}

/**
 * Messaging Engine
 * Handles message queueing, delivery, and conversation history tracking
 */
export class MessagingEngine {
  private messageQueue: Queue.Queue<MessageJobData>;
  private reminderQueue: Queue.Queue<MessageJobData>;
  private messageRepository: MessageRepository;
  private platformManager: PlatformManager;

  constructor(pool: Pool, redisUrl: string = 'redis://localhost:6379') {
    this.messageRepository = new MessageRepository(pool);
    this.platformManager = new PlatformManager(pool);

    // Initialize Bull queues
    this.messageQueue = new Queue<MessageJobData>('messages', redisUrl);
    this.reminderQueue = new Queue<MessageJobData>('reminders', redisUrl);

    // Set up message delivery worker
    this.setupMessageWorker();
    this.setupReminderWorker();
  }

  /**
   * Queue a message for delivery with priority support
   */
  async sendMessage(message: OutgoingMessage): Promise<void> {
    const jobData: MessageJobData = {
      inquiryId: message.inquiryId,
      platformId: message.platformId,
      recipientId: message.recipientId,
      content: message.content
    };

    // Map priority to Bull priority (lower number = higher priority)
    const priorityMap = {
      high: 1,
      normal: 5,
      low: 10
    };

    await this.messageQueue.add(jobData, {
      priority: priorityMap[message.priority],
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
  }

  /**
   * Get conversation history for an inquiry
   */
  async getConversationHistory(inquiryId: string): Promise<Message[]> {
    return await this.messageRepository.findByInquiryId(inquiryId);
  }

  /**
   * Schedule a reminder message for future delivery
   */
  async scheduleReminder(reminder: ReminderRequest): Promise<void> {
    const jobData: MessageJobData = {
      inquiryId: reminder.inquiryId,
      platformId: reminder.platformId,
      recipientId: reminder.recipientId,
      content: reminder.content
    };

    const delay = reminder.scheduledTime.getTime() - Date.now();

    if (delay > 0) {
      await this.reminderQueue.add(jobData, {
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000
        }
      });
    } else {
      // If scheduled time is in the past, send immediately
      await this.sendMessage({
        inquiryId: reminder.inquiryId,
        platformId: reminder.platformId,
        recipientId: reminder.recipientId,
        content: reminder.content,
        priority: 'high'
      });
    }
  }

  /**
   * Set up worker to process queued messages
   */
  private setupMessageWorker(): void {
    this.messageQueue.process(async (job) => {
      const { inquiryId, platformId, recipientId, content } = job.data;

      try {
        // Send message through platform
        await this.platformManager.sendMessage(platformId, recipientId, content);

        // Store message as sent
        await this.messageRepository.create({
          inquiryId,
          direction: 'outbound',
          content,
          status: 'sent'
        });
      } catch (error) {
        // Store message as failed
        await this.messageRepository.create({
          inquiryId,
          direction: 'outbound',
          content,
          status: 'failed'
        });

        throw error; // Re-throw to trigger retry
      }
    });
  }

  /**
   * Set up worker to process scheduled reminders
   */
  private setupReminderWorker(): void {
    this.reminderQueue.process(async (job) => {
      const { inquiryId, platformId, recipientId, content } = job.data;

      try {
        // Send reminder through platform
        await this.platformManager.sendMessage(platformId, recipientId, content);

        // Store reminder as sent
        await this.messageRepository.create({
          inquiryId,
          direction: 'outbound',
          content,
          status: 'sent'
        });
      } catch (error) {
        // Store reminder as failed
        await this.messageRepository.create({
          inquiryId,
          direction: 'outbound',
          content,
          status: 'failed'
        });

        throw error; // Re-throw to trigger retry
      }
    });
  }

  /**
   * Close queue connections (for graceful shutdown)
   */
  async close(): Promise<void> {
    await this.messageQueue.close();
    await this.reminderQueue.close();
  }
}
