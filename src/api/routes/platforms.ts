import { Router, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { PlatformManager } from '../../engines/PlatformManager';
import { getPool } from '../../database/connection';
import { PlatformCredentials } from '../../engines/PlatformAdapter';

const router = Router();

// POST /platforms - Connect platform
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { platformType, apiKey, accessToken, refreshToken } = req.body;

    // Validation
    if (!platformType || typeof platformType !== 'string') {
      throw new ValidationError('Platform type is required');
    }

    const validPlatforms = ['zillow', 'turbotenant', 'facebook', 'test'];
    if (!validPlatforms.includes(platformType)) {
      throw new ValidationError(`Invalid platform type. Must be one of: ${validPlatforms.join(', ')}`);
    }

    const credentials: PlatformCredentials = {
      platformType: platformType as any,
      apiKey,
      accessToken,
      refreshToken,
    };

    const pool = getPool();
    const platformManager = new PlatformManager(pool);

    const { connection, result } = await platformManager.connectPlatform(
      req.managerId!,
      credentials
    );

    res.status(201).json({
      connection,
      connectionResult: result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /platforms - List connections
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const pool = getPool();
    const platformManager = new PlatformManager(pool);

    const connections = await platformManager.getConnections(req.managerId!);

    // Remove sensitive credential data from response
    const sanitizedConnections = connections.map(conn => ({
      id: conn.id,
      managerId: conn.managerId,
      platformType: conn.platformType,
      isActive: conn.isActive,
      lastVerified: conn.lastVerified,
      createdAt: conn.createdAt,
    }));

    res.json(sanitizedConnections);
  } catch (error) {
    next(error);
  }
});

// GET /platforms/:id/verify - Verify connection
router.get('/:id/verify', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const pool = getPool();
    const platformManager = new PlatformManager(pool);

    // Get connection to verify ownership
    const connections = await platformManager.getConnections(req.managerId!);
    const connection = connections.find(c => c.id === id);

    if (!connection) {
      throw new NotFoundError('Platform connection not found');
    }

    const isValid = await platformManager.verifyConnection(id);

    res.json({
      platformId: id,
      isValid,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /platforms/:id - Disconnect platform
router.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    const pool = getPool();
    const platformManager = new PlatformManager(pool);

    // Get connection to verify ownership
    const connections = await platformManager.getConnections(req.managerId!);
    const connection = connections.find(c => c.id === id);

    if (!connection) {
      throw new NotFoundError('Platform connection not found');
    }

    await platformManager.disconnectPlatform(id);

    res.json({ message: 'Platform disconnected successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
