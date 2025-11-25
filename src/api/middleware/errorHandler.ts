import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  details?: any;
  isOperational?: boolean;
}

/**
 * Central error handler middleware
 */
export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error details
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    details: err.details,
  };
  
  if (err.statusCode && err.statusCode >= 500) {
    console.error('Server Error:', errorLog);
  } else {
    console.warn('Client Error:', errorLog);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  // Don't expose internal error details in production
  const response: any = {
    error: message,
    timestamp: new Date().toISOString(),
  };

  if (err.details && (process.env.NODE_ENV === 'development' || err.isOperational)) {
    response.details = err.details;
  }

  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base class for operational errors (expected errors that should be handled)
 */
export class OperationalError extends Error {
  statusCode: number;
  details?: any;
  isOperational = true;

  constructor(message: string, statusCode: number, details?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 - Validation Error
 */
export class ValidationError extends OperationalError {
  constructor(message: string, details?: any) {
    super(message, 400, details);
  }
}

/**
 * 401 - Unauthorized Error
 */
export class UnauthorizedError extends OperationalError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * 403 - Forbidden Error
 */
export class ForbiddenError extends OperationalError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * 404 - Not Found Error
 */
export class NotFoundError extends OperationalError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

/**
 * 409 - Conflict Error
 */
export class ConflictError extends OperationalError {
  constructor(message: string, details?: any) {
    super(message, 409, details);
  }
}

/**
 * 422 - Unprocessable Entity Error
 */
export class UnprocessableEntityError extends OperationalError {
  constructor(message: string, details?: any) {
    super(message, 422, details);
  }
}

/**
 * 429 - Too Many Requests Error
 */
export class RateLimitError extends OperationalError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

/**
 * 500 - Internal Server Error
 */
export class InternalServerError extends Error {
  statusCode = 500;
  isOperational = false;

  constructor(message: string = 'Internal server error', public details?: any) {
    super(message);
    this.name = 'InternalServerError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 502 - Bad Gateway Error (for external service failures)
 */
export class ExternalServiceError extends OperationalError {
  constructor(service: string, message?: string) {
    super(message || `External service error: ${service}`, 502, { service });
  }
}

/**
 * 503 - Service Unavailable Error
 */
export class ServiceUnavailableError extends OperationalError {
  constructor(message: string = 'Service temporarily unavailable') {
    super(message, 503);
  }
}

// ============================================================================
// Domain-Specific Error Classes
// ============================================================================

/**
 * Platform Integration Errors
 */
export class PlatformConnectionError extends ExternalServiceError {
  constructor(platform: string, details?: any) {
    super(platform, `Failed to connect to platform: ${platform}`);
    this.details = { ...this.details, ...details };
  }
}

export class PlatformAuthenticationError extends ExternalServiceError {
  constructor(platform: string) {
    super(platform, `Authentication failed for platform: ${platform}`);
  }
}

export class MessageDeliveryError extends ExternalServiceError {
  constructor(platform: string, details?: any) {
    super(platform, `Failed to deliver message via ${platform}`);
    this.details = { ...this.details, ...details };
  }
}

/**
 * Scheduling Errors
 */
export class SchedulingConflictError extends ConflictError {
  constructor(message: string = 'Scheduling conflict detected', details?: any) {
    super(message, details);
  }
}

export class AvailabilityError extends ValidationError {
  constructor(message: string = 'Invalid availability configuration', details?: any) {
    super(message, details);
  }
}

/**
 * Workflow Errors
 */
export class WorkflowStateError extends UnprocessableEntityError {
  constructor(message: string, currentState?: string) {
    super(message, { currentState });
  }
}

export class QualificationError extends ValidationError {
  constructor(message: string, details?: any) {
    super(message, details);
  }
}

/**
 * Data Errors
 */
export class DatabaseError extends InternalServerError {
  constructor(message: string = 'Database operation failed', details?: any) {
    super(message, details);
  }
}

export class EncryptionError extends InternalServerError {
  constructor(message: string = 'Encryption/decryption failed') {
    super(message);
  }
}
