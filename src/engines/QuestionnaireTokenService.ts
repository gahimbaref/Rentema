import { Pool } from 'pg';
import { QuestionnaireTokenRepository, QuestionnaireToken } from '../database/repositories/QuestionnaireTokenRepository';
import { logger } from '../utils/logger';

export interface TokenValidation {
  isValid: boolean;
  inquiryId?: string;
  error?: 'expired' | 'used' | 'not_found';
}

export class QuestionnaireTokenService {
  private tokenRepo: QuestionnaireTokenRepository;

  constructor(pool: Pool) {
    this.tokenRepo = new QuestionnaireTokenRepository(pool);
  }

  async generateToken(inquiryId: string, expiresInDays: number = 7): Promise<QuestionnaireToken> {
    logger.info('Generating questionnaire token', { inquiryId, expiresInDays });

    const token = await this.tokenRepo.create(inquiryId, expiresInDays);

    logger.info('Questionnaire token generated', {
      inquiryId,
      token: token.token,
      expiresAt: token.expiresAt,
    });

    return token;
  }

  async validateToken(token: string): Promise<TokenValidation> {
    const tokenData = await this.tokenRepo.findByToken(token);

    if (!tokenData) {
      logger.warn('Token not found', { token });
      return {
        isValid: false,
        error: 'not_found',
      };
    }

    if (tokenData.isUsed) {
      logger.warn('Token already used', { token, usedAt: tokenData.usedAt });
      return {
        isValid: false,
        inquiryId: tokenData.inquiryId,
        error: 'used',
      };
    }

    if (new Date() > tokenData.expiresAt) {
      logger.warn('Token expired', { token, expiresAt: tokenData.expiresAt });
      return {
        isValid: false,
        inquiryId: tokenData.inquiryId,
        error: 'expired',
      };
    }

    logger.info('Token validated successfully', { token, inquiryId: tokenData.inquiryId });

    return {
      isValid: true,
      inquiryId: tokenData.inquiryId,
    };
  }

  async markTokenUsed(token: string): Promise<void> {
    logger.info('Marking token as used', { token });
    await this.tokenRepo.markAsUsed(token);
  }

  async regenerateToken(inquiryId: string): Promise<QuestionnaireToken> {
    logger.info('Regenerating token for inquiry', { inquiryId });

    // Generate new token (old one will remain in DB but won't be used)
    const newToken = await this.tokenRepo.create(inquiryId, 7);

    logger.info('Token regenerated', {
      inquiryId,
      newToken: newToken.token,
      expiresAt: newToken.expiresAt,
    });

    return newToken;
  }

  async cleanupExpiredTokens(): Promise<number> {
    logger.info('Cleaning up expired tokens');
    const count = await this.tokenRepo.deleteExpired();
    logger.info('Expired tokens cleaned up', { count });
    return count;
  }
}
