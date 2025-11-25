import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from './errorHandler';

export type UserRole = 'admin' | 'manager' | 'viewer';

export interface AuthRequest extends Request {
  userId?: string;
  managerId?: string;
  userRole?: UserRole;
}

export interface TokenPayload {
  userId: string;
  managerId: string;
  role?: UserRole;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRATION: string | number = process.env.JWT_EXPIRATION || '24h';

/**
 * Validate JWT secret is properly configured
 */
export function validateJwtSecret(): boolean {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
    console.warn('WARNING: Using default JWT secret. Set JWT_SECRET environment variable in production.');
    return false;
  }
  if (JWT_SECRET.length < 32) {
    console.warn('WARNING: JWT secret should be at least 32 characters for optimal security.');
    return false;
  }
  return true;
}

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);

    // Development mode: accept dev tokens
    if (process.env.NODE_ENV === 'development' && token.startsWith('dev-token-')) {
      req.userId = 'dev-user-id';
      req.managerId = '00000000-0000-0000-0000-000000000001'; // Test manager ID from migrations
      req.userRole = 'admin';
      next();
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
      req.userId = decoded.userId;
      req.managerId = decoded.managerId;
      req.userRole = decoded.role || 'manager'; // Default to manager for backward compatibility
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      throw new UnauthorizedError('Authentication failed');
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Authentication error' });
    }
  }
}

/**
 * Role-based authorization middleware factory
 * Creates middleware that checks if user has required role
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.userRole) {
        throw new UnauthorizedError('User role not found');
      }

      if (!allowedRoles.includes(req.userRole)) {
        throw new ForbiddenError(`Access denied. Required role: ${allowedRoles.join(' or ')}`);
      }

      next();
    } catch (error) {
      if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Authorization error' });
      }
    }
  };
}

/**
 * Middleware to check if user owns the resource
 * Validates that the managerId in the request matches the authenticated user's managerId
 */
export function requireOwnership(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const resourceManagerId = req.params.managerId || req.body.managerId || req.query.managerId;

    if (!resourceManagerId) {
      // If no managerId in request, allow (will be set to authenticated user's managerId)
      next();
      return;
    }

    if (req.managerId !== resourceManagerId) {
      // Admin can access any resource
      if (req.userRole === 'admin') {
        next();
        return;
      }
      throw new ForbiddenError('Access denied. You can only access your own resources.');
    }

    next();
  } catch (error) {
    if (error instanceof ForbiddenError) {
      res.status(error.statusCode).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Authorization error' });
    }
  }
}

/**
 * Generate JWT token
 */
export function generateToken(userId: string, managerId: string, role: UserRole = 'manager'): string {
  const payload: TokenPayload = { userId, managerId, role };
  const options: SignOptions = { 
    expiresIn: JWT_EXPIRATION as any
  };
  return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Refresh token (generate new token with same payload but extended expiration)
 */
export function refreshToken(token: string): string | null {
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }
  return generateToken(payload.userId, payload.managerId, payload.role);
}
