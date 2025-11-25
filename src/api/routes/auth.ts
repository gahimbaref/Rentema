import { Router, Response } from 'express';
import { AuthRequest, generateToken, refreshToken, verifyToken } from '../middleware/auth';
import { ValidationError, UnauthorizedError } from '../middleware/errorHandler';
import { sanitizeEmail, validateLength } from '../middleware/sanitization';

const router = Router();

/**
 * POST /api/auth/login
 * Login endpoint (simplified - in production, verify against user database)
 */
router.post('/login', async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, managerId } = req.body;

    // Validate inputs
    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    // Sanitize email
    const sanitizedEmail = sanitizeEmail(email);
    validateLength(password, 8, 128, 'Password');

    // TODO: In production, verify credentials against user database
    // For now, this is a simplified implementation for development
    // You should:
    // 1. Hash the password using bcrypt
    // 2. Query the database for the user
    // 3. Compare hashed passwords
    // 4. Retrieve user role from database

    // Simplified validation (REPLACE IN PRODUCTION)
    if (!managerId) {
      throw new ValidationError('Manager ID is required');
    }

    // Generate token with default role
    const token = generateToken(sanitizedEmail, managerId, 'manager');

    res.json({
      token,
      expiresIn: '24h',
      user: {
        email: sanitizedEmail,
        managerId,
        role: 'manager'
      }
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof UnauthorizedError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Login failed' });
    }
  }
});

/**
 * POST /api/auth/refresh
 * Refresh token endpoint
 */
router.post('/refresh', async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new ValidationError('Token is required');
    }

    const newToken = refreshToken(token);

    if (!newToken) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    const payload = verifyToken(newToken);

    res.json({
      token: newToken,
      expiresIn: '24h',
      user: payload
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof UnauthorizedError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Token refresh failed' });
    }
  }
});

/**
 * POST /api/auth/verify
 * Verify token endpoint
 */
router.post('/verify', async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;

    if (!token) {
      throw new ValidationError('Token is required');
    }

    const payload = verifyToken(token);

    if (!payload) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    res.json({
      valid: true,
      user: payload
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof UnauthorizedError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Token verification failed' });
    }
  }
});

export default router;
