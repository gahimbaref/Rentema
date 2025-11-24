import Bull, { Queue, Job } from 'bull';
import { Pool } from 'pg';
import { PlatformManager } from './PlatformManager';
import { InquiryRepository } from '../database/repositories/InquiryRepository';
import { PlatformInquiry } from './PlatformAdapter';

interface PollJobData {
  platformId: string;
}

/**
 * Inquiry Polling Service
 * Manages background jobs to poll platforms for new inquiries
 */
export class InquiryPollingService {
  private queue: Queue<PollJobData>;
  private platformManager: PlatformManager;
  private inquiryRepository: InquiryRepository;

  constructor(pool: Pool, redisUrl?: string) {
    this.platformManager = new PlatformManager(pool);
    this.inquiryRepository = new InquiryRepository(pool);

    // Create Bull queue for polling jobs
    this.queue = new Bull<PollJobData>('inquiry-polling', redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');

    // Set up job processor
    this.queue.process(async (job: Job<PollJobData>) => {
      return await this.processPollJob(job.data);
    });
  }

  /**
   * Start polling a platform at regular intervals
   */
  async startPolling(platformId: string, intervalMinutes: number = 5): Promise<void> {
    // Add repeating job
    await this.queue.add(
      { platformId },
      {
        repeat: {
          every: intervalMinutes * 60 * 1000 // Convert to milliseconds
        },
        jobId: `poll-${platformId}` // Unique job ID to prevent duplicates
      }
    );
  }

  /**
   * Stop polling a platform
   */
  async stopPolling(platformId: string): Promise<void> {
    const jobId = `poll-${platformId}`;
    await this.queue.removeRepeatable({
      jobId,
      every: 5 * 60 * 1000 // Default interval
    });
  }

  /**
   * Process a single poll job
   */
  private async processPollJob(data: PollJobData): Promise<{ inquiriesFound: number }> {
    const { platformId } = data;

    try {
      // Poll platform for new inquiries
      const platformInquiries = await this.platformManager.pollInquiries(platformId);

      // Normalize and store inquiries
      for (const platformInquiry of platformInquiries) {
        await this.normalizeAndStoreInquiry(platformId, platformInquiry);
      }

      return { inquiriesFound: platformInquiries.length };
    } catch (error) {
      console.error(`Error polling platform ${platformId}:`, error);
      throw error;
    }
  }

  /**
   * Normalize platform-specific inquiry data to internal format and store
   */
  private async normalizeAndStoreInquiry(
    platformId: string,
    platformInquiry: PlatformInquiry
  ): Promise<void> {
    // Check if inquiry already exists
    const existing = await this.inquiryRepository.findByExternalId(
      platformInquiry.externalId,
      platformId
    );

    if (existing) {
      // Inquiry already processed
      return;
    }

    // Create new inquiry
    await this.inquiryRepository.create({
      propertyId: platformInquiry.propertyId,
      platformId,
      externalInquiryId: platformInquiry.externalId,
      prospectiveTenantId: platformInquiry.prospectiveTenantId,
      prospectiveTenantName: platformInquiry.prospectiveTenantName,
      status: 'new'
    });
  }

  /**
   * Close the queue and cleanup
   */
  async close(): Promise<void> {
    await this.queue.close();
  }

  /**
   * Get the queue for testing purposes
   */
  getQueue(): Queue<PollJobData> {
    return this.queue;
  }
}
