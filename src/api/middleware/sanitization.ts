import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errorHandler';

/**
 * Sanitize string input to prevent injection attacks
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return sanitized;
}

/**
 * Sanitize HTML to prevent XSS attacks
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') {
    return input;
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate and sanitize email addresses
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    throw new ValidationError('Email must be a string');
  }

  const sanitized = sanitizeString(email).toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    throw new ValidationError('Invalid email format');
  }

  return sanitized;
}

/**
 * Validate and sanitize phone numbers
 */
export function sanitizePhone(phone: string): string {
  if (typeof phone !== 'string') {
    throw new ValidationError('Phone number must be a string');
  }

  // Remove all non-digit characters except + at the start
  let sanitized = phone.replace(/[^\d+]/g, '');
  
  // Ensure + is only at the start
  if (sanitized.includes('+')) {
    const parts = sanitized.split('+');
    sanitized = '+' + parts.join('');
  }

  // Basic validation: should have at least 10 digits
  const digitCount = sanitized.replace(/\D/g, '').length;
  if (digitCount < 10 || digitCount > 15) {
    throw new ValidationError('Invalid phone number format');
  }

  return sanitized;
}

/**
 * Sanitize URL to prevent injection
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') {
    throw new ValidationError('URL must be a string');
  }

  const sanitized = sanitizeString(url);

  // Only allow http and https protocols
  try {
    const parsed = new URL(sanitized);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new ValidationError('Only HTTP and HTTPS URLs are allowed');
    }
    return parsed.toString();
  } catch (error) {
    throw new ValidationError('Invalid URL format');
  }
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize the key as well
      const sanitizedKey = sanitizeString(key);
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Middleware to sanitize request body
 */
export function sanitizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
}

/**
 * Middleware to sanitize query parameters
 */
export function sanitizeQuery(req: Request, _res: Response, next: NextFunction): void {
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  next();
}

/**
 * Middleware to sanitize route parameters
 */
export function sanitizeParams(req: Request, _res: Response, next: NextFunction): void {
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}

/**
 * Combined sanitization middleware for all inputs
 */
export function sanitizeAll(req: Request, res: Response, next: NextFunction): void {
  sanitizeBody(req, res, () => {
    sanitizeQuery(req, res, () => {
      sanitizeParams(req, res, next);
    });
  });
}

/**
 * Validate and sanitize SQL-like inputs to prevent SQL injection
 * This is a defense-in-depth measure; parameterized queries are the primary defense
 */
export function validateNoSqlInjection(input: string): void {
  if (typeof input !== 'string') {
    return;
  }

  // Check for common SQL injection patterns
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(--|\;|\/\*|\*\/)/,
    /(\bOR\b.*=.*)/i,
    /(\bAND\b.*=.*)/i,
    /(UNION.*SELECT)/i,
  ];

  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      throw new ValidationError('Input contains potentially malicious content');
    }
  }
}

/**
 * Validate input length
 */
export function validateLength(input: string, min: number, max: number, fieldName: string = 'Input'): void {
  if (typeof input !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  if (input.length < min) {
    throw new ValidationError(`${fieldName} must be at least ${min} characters`);
  }

  if (input.length > max) {
    throw new ValidationError(`${fieldName} must not exceed ${max} characters`);
  }
}
