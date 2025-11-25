# Security Features

This document outlines the security features implemented in Rentema.

## Authentication & Authorization

### JWT Authentication
- All API endpoints (except `/health` and `/api/auth/*`) require JWT authentication
- Tokens are passed via the `Authorization: Bearer <token>` header
- Tokens expire after 24 hours (configurable via `JWT_EXPIRATION` env variable)
- Token refresh endpoint available at `/api/auth/refresh`

### Role-Based Access Control (RBAC)
Three user roles are supported:
- **admin**: Full access to all resources
- **manager**: Access to own resources (default role)
- **viewer**: Read-only access

Use the `requireRole()` middleware to restrict endpoints by role:
```typescript
router.get('/admin-only', requireRole('admin'), handler);
router.get('/manager-or-admin', requireRole('manager', 'admin'), handler);
```

### Resource Ownership
The `requireOwnership` middleware ensures users can only access their own resources (admins can access all resources).

## Encryption

### Credential Encryption
Platform credentials are encrypted at rest using **AES-256-GCM**:
- Authenticated encryption with Galois/Counter Mode
- Random initialization vector (IV) for each encryption
- Authentication tag for integrity verification
- Key derivation using PBKDF2 with 100,000 iterations

**Configuration:**
```bash
# Generate a secure encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Set in .env
ENCRYPTION_KEY=your-generated-key-here
ENCRYPTION_SALT=your-salt-here
```

### JWT Secret
JWT tokens are signed using HS256 algorithm with a secret key.

**Configuration:**
```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Set in .env
JWT_SECRET=your-generated-secret-here
```

## Input Sanitization

All user inputs are automatically sanitized to prevent injection attacks:

### Automatic Sanitization
The `sanitizeAll` middleware is applied globally and sanitizes:
- Request body
- Query parameters
- Route parameters

### Sanitization Functions
- `sanitizeString()`: Removes null bytes, control characters, and trims whitespace
- `sanitizeHtml()`: Escapes HTML entities to prevent XSS
- `sanitizeEmail()`: Validates and normalizes email addresses
- `sanitizePhone()`: Validates and normalizes phone numbers
- `sanitizeUrl()`: Validates URLs and restricts to HTTP/HTTPS protocols
- `validateNoSqlInjection()`: Checks for SQL injection patterns (defense-in-depth)

### SQL Injection Prevention
Primary defense: **Parameterized queries** are used throughout the application.
Secondary defense: Input validation and sanitization.

## Error Handling

### Comprehensive Error Classes
Domain-specific error classes for better error handling:
- `ValidationError` (400): Invalid input data
- `UnauthorizedError` (401): Authentication failure
- `ForbiddenError` (403): Authorization failure
- `NotFoundError` (404): Resource not found
- `ConflictError` (409): Resource conflict (e.g., double-booking)
- `PlatformConnectionError` (502): External platform failures
- `MessageDeliveryError` (502): Message delivery failures
- `SchedulingConflictError` (409): Scheduling conflicts
- `WorkflowStateError` (422): Invalid workflow state

### Error Response Format
```json
{
  "error": "Error message",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "details": { /* optional error details */ }
}
```

In development mode, stack traces are included in error responses.

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- **Window**: 15 minutes
- **Max requests**: 100 per IP address per window
- Returns 429 (Too Many Requests) when limit exceeded

## Security Headers

Helmet middleware is used to set secure HTTP headers:
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- And more...

## CORS Configuration

CORS is configured to allow cross-origin requests:
- Origin: Configurable via `CORS_ORIGIN` env variable (defaults to `*`)
- Credentials: Enabled

## Production Security Checklist

Before deploying to production:

1. **Set secure environment variables:**
   - [ ] `ENCRYPTION_KEY` (32+ characters)
   - [ ] `ENCRYPTION_SALT` (unique salt)
   - [ ] `JWT_SECRET` (64+ characters)
   - [ ] `NODE_ENV=production`

2. **Configure CORS:**
   - [ ] Set `CORS_ORIGIN` to your frontend domain

3. **Database security:**
   - [ ] Use SSL/TLS for database connections
   - [ ] Set `DATABASE_SSL=true`
   - [ ] Use strong database passwords

4. **Redis security:**
   - [ ] Enable Redis authentication
   - [ ] Use TLS for Redis connections

5. **HTTPS:**
   - [ ] Deploy behind HTTPS (use reverse proxy like nginx)
   - [ ] Redirect HTTP to HTTPS

6. **Monitoring:**
   - [ ] Set up logging and monitoring
   - [ ] Configure alerts for security events

## Security Validation

The server performs security validation on startup:
- Checks if default encryption keys are being used
- Validates JWT secret strength
- Prevents startup in production with default keys

## Reporting Security Issues

If you discover a security vulnerability, please email security@rentema.com (or your security contact).

Do not create public GitHub issues for security vulnerabilities.
