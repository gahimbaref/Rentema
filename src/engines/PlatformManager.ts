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
    // Create appropriate adapter
    const adapter = this.createAdapter(credentials.platformType);

    // Attempt connection
    const result = await adapter.connect(credentials);

    if (!result.success) {
      throw new Error(result.error || 'Failed to connect to platform');
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
  }

  /**
   * Verify a platform connection is still active
   */
  async verifyConnection(platformId: string): Promise<boolean> {
    const connection = await this.repository.findById(platformId);
    
    if (!connection) {
      throw new Error('Platform connection not found');
    }

    const adapter = await this.getOrCreateAdapter(connection);
    const isValid = await adapter.verifyConnection();

    // Update verification timestamp
    if (isValid) {
      await this.repository.updateVerificationStatus(platformId, new Date());
    } else {
      await this.repository.updateActiveStatus(platformId, false);
    }

    return isValid;
  }

  /**
   * Disconnect from a platform
   */
  async disconnectPlatform(platformId: string): Promise<void> {
    const connection = await this.repository.findById(platformId);
    
    if (!connection) {
      throw new Error('Platform connection not found');
    }

    // Disconnect adapter if exists
    const adapter = this.adapters.get(platformId);
    if (adapter) {
      await adapter.disconnect();
      this.adapters.delete(platformId);
    }

    // Remove from database
    await this.repository.delete(platformId);
  }

  /**
   * Poll a platform for new inquiries
   */
  async pollInquiries(platformId: string): Promise<PlatformInquiry[]> {
    const connection = await this.repository.findById(platformId);
    
    if (!connection) {
      throw new Error('Platform connection not found');
    }

    if (!connection.isActive) {
      throw new Error('Platform connection is not active');
    }

    const adapter = await this.getOrCreateAdapter(connection);
    return await adapter.pollInquiries();
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
      throw new Error('Platform connection not found');
    }

    if (!connection.isActive) {
      throw new Error('Platform connection is not active');
    }

    const adapter = await this.getOrCreateAdapter(connection);
    
    try {
      await adapter.sendMessage(recipientId, message);
    } catch (error) {
      // Implement retry logic here if needed
      throw error;
    }
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
        throw new Error(`Unsupported platform type: ${platformType}`);
    }
  }

  /**
   * Get adapter for testing purposes (test mode only)
   */
  getAdapter(platformId: string): PlatformAdapter | undefined {
    return this.adapters.get(platformId);
  }
}
