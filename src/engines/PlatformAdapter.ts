export type PlatformType = 'zillow' | 'turbotenant' | 'facebook' | 'test';

export interface PlatformCredentials {
  platformType: PlatformType;
  apiKey?: string;
  accessToken?: string;
  refreshToken?: string;
  [key: string]: any;
}

export interface ConnectionResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface PlatformInquiry {
  externalId: string;
  propertyId: string;
  prospectiveTenantId: string;
  prospectiveTenantName?: string;
  message: string;
  timestamp: Date;
}

/**
 * Platform Adapter Interface
 * Defines the contract for integrating with external listing platforms
 */
export interface PlatformAdapter {
  /**
   * Connect to the platform using provided credentials
   */
  connect(credentials: PlatformCredentials): Promise<ConnectionResult>;

  /**
   * Send a message to a prospective tenant through the platform
   */
  sendMessage(recipientId: string, message: string): Promise<void>;

  /**
   * Poll the platform for new inquiries
   */
  pollInquiries(): Promise<PlatformInquiry[]>;

  /**
   * Verify the connection is still active
   */
  verifyConnection(): Promise<boolean>;

  /**
   * Disconnect from the platform
   */
  disconnect(): Promise<void>;
}

/**
 * Test Mode Platform Adapter
 * Used for development and testing without requiring actual platform connections
 */
export class TestPlatformAdapter implements PlatformAdapter {
  private connected: boolean = false;
  private simulatedInquiries: PlatformInquiry[] = [];
  private sentMessages: Array<{ recipientId: string; message: string; timestamp: Date }> = [];

  async connect(credentials: PlatformCredentials): Promise<ConnectionResult> {
    if (credentials.platformType !== 'test') {
      return {
        success: false,
        error: 'Invalid platform type for TestPlatformAdapter'
      };
    }

    this.connected = true;

    return {
      success: true,
      message: 'Connected to test platform'
    };
  }

  async sendMessage(recipientId: string, message: string): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to platform');
    }

    this.sentMessages.push({
      recipientId,
      message,
      timestamp: new Date()
    });
  }

  async pollInquiries(): Promise<PlatformInquiry[]> {
    if (!this.connected) {
      throw new Error('Not connected to platform');
    }

    // Return and clear simulated inquiries
    const inquiries = [...this.simulatedInquiries];
    this.simulatedInquiries = [];
    return inquiries;
  }

  async verifyConnection(): Promise<boolean> {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  // Test helper methods
  simulateInquiry(inquiry: PlatformInquiry): void {
    this.simulatedInquiries.push(inquiry);
  }

  getSentMessages(): Array<{ recipientId: string; message: string; timestamp: Date }> {
    return [...this.sentMessages];
  }

  clearSentMessages(): void {
    this.sentMessages = [];
  }
}
