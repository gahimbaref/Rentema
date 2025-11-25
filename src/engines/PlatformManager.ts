import { Pool } from 'pg';
import { PlatformConnectionRepository } from '../database/repositories/PlatformConnectionRepository';
import { PlatformConnection } from '../models';
import { 
  PlatformAdapter, 
  PlatformCredentials, 
  ConnectionResult, 
  PlatformInquiry,
  TestPlatformAdapter 
} from './PlatformAdapter';
import { 
  PlatformConnectionError, 
  PlatformAuthenticationError,
  MessageDeliveryError,
  NotFoundError,
  ValidationError 
} from '../api/middleware/errorHandler';

/**
 * Platform Manager
 * Manages connections to external listing platforms and handles inquiry polling and messaging
 */
export class PlatformManager {
  private repository: PlatformConnectionRepository;
  private adapters: Map<string, PlatformAdapter> = new Map();

  constructor(pool: Pool) {
    this.repository = new PlatformConnectionRepository(pool);
  }

  /**
   * Connect to a platform and store credentials securely
   */
  async connectPlatform(
    managerId: string,
    credentials: PlatformCredentials
  ): Promise<{ connection: PlatformConnection; result: ConnectionResult }> {
    try {
      // Create appropriate adapter
      const adapter = this.createAdapter(credentials.platformType);

      // Attempt connection
      const result = await adapter.connect(credentials);

      if (!result.success) {
        throw new PlatformAuthenticationError(credentials.platformType);
      }

      // Store connection in database with encrypted credentials
      const connection = await this.repository.create({
        managerId,
        platformType: credentials.platformType,
        credentials,
        isActive: true,
        lastVerified: new Date()
      });

      // Store adapter for future use
      this.adapters.set(connection.id, adapter);

      return { connection, result };
    } catch (error) {
      if (error instanceof PlatformAuthenticationError) {
        throw error;
      }
      throw new PlatformConnectionError(credentials.platformType, {
        originalError: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Verify a platform connection is still active
   */
  async verifyConnection(platformId: string): Promise<boolean> {
    const connection = await this.repository.findById(platformId);
    
    if (!connection) {
      throw new NotFoundError('Platform connection not found');
    }

    try {
      const adapter = await this.getOrCreateAdapter(connection);
      const isValid = await adapter.verifyConnection();

      // Update verification timestamp
      if (isValid) {
        await this.repository.updateVerificationStatus(platformId, new Date());
      } else {
        await this.repository.updateActiveStatus(platformId, false);
      }

      return isValid;
    } catch (error) {
      // Mark connection as inactive on verification failure
      await this.repository.updateActiveStatus(platformId, false);
      throw new PlatformConnectionError(connection.platformType, {
        originalError: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Disconnect from a platform
   */
  async disconnectPlatform(platformId: string): Promise<void> {
    const connection = await this.repository.findById(platformId);
    
    if (!connection) {
      throw new NotFoundError('Platform connection not found');
    }

    try {
      // Disconnect adapter if exists
      const adapter = this.adapters.get(platformId);
      if (adapter) {
        await adapter.disconnect();
        this.adapters.delete(platformId);
      }

      // Remove from database
      await this.repository.delete(platformId);
    } catch (error) {
      throw new PlatformConnectionError(connection.platformType, {
        action: 'disconnect',
        originalError: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Poll a platform for new inquiries
   */
  async pollInquiries(platformId: string): Promise<PlatformInquiry[]> {
    const connection = await this.repository.findById(platformId);
    
    if (!connection) {
      throw new NotFoundError('Platform connection not found');
    }

    if (!connection.isActive) {
      throw new ValidationError('Platform connection is not active');
    }

    try {
      const adapter = await this.getOrCreateAdapter(connection);
      return await adapter.pollInquiries();
    } catch (error) {
      throw new PlatformConnectionError(connection.platformType, {
        action: 'poll_inquiries',
        originalError: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send a message through a platform
   */
  async sendMessage(
    platformId: string,
    recipientId: string,
    message: string
  ): Promise<void> {
    const connection = await this.repository.findById(platformId);
    
    if (!connection) {
      throw new NotFoundError('Platform connection not found');
    }

    if (!connection.isActive) {
      throw new ValidationError('Platform connection is not active');
    }

    const adapter = await this.getOrCreateAdapter(connection);
    
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await adapter.sendMessage(recipientId, message);
        return; // Success
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Message delivery attempt ${attempt}/${maxRetries} failed:`, lastError.message);
        
        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new MessageDeliveryError(connection.platformType, {
      recipientId,
      attempts: maxRetries,
      lastError: lastError?.message
    });
  }

  /**
   * Get all platform connections for a manager
   */
  async getConnections(managerId: string): Promise<PlatformConnection[]> {
    return await this.repository.findByManagerId(managerId);
  }

  /**
   * Get or create an adapter for a platform connection
   */
  private async getOrCreateAdapter(connection: PlatformConnection): Promise<PlatformAdapter> {
    let adapter = this.adapters.get(connection.id);

    if (!adapter) {
      adapter = this.createAdapter(connection.platformType);
      await adapter.connect({
        platformType: connection.platformType as any,
        ...connection.credentials
      });
      this.adapters.set(connection.id, adapter);
    }

    return adapter;
  }

  /**
   * Create an adapter based on platform type
   */
  private createAdapter(platformType: string): PlatformAdapter {
    switch (platformType) {
      case 'test':
        return new TestPlatformAdapter();
      case 'zillow':
      case 'turbotenant':
      case 'facebook':
        // For now, return test adapter for unimplemented platforms
        // TODO: Implement actual platform adapters
        return new TestPlatformAdapter();
      default:
        throw new ValidationError(`Unsupported platform type: ${platformType}`);
    }
  }

  /**
   * Get adapter for testing purposes (test mode only)
   */
  getAdapter(platformId: string): PlatformAdapter | undefined {
    return this.adapters.get(platformId);
  }
}
