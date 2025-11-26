import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { authMiddleware, validateJwtSecret } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import { sanitizeAll } from './middleware/sanitization';
import { validateEncryptionKey } from '../database/encryption';
import authRoutes from './routes/auth';
import propertyRoutes from './routes/properties';
import platformRoutes from './routes/platforms';
import qualificationRoutes from './routes/qualification';
import inquiryRoutes from './routes/inquiries';
import schedulingRoutes from './routes/scheduling';
import templateRoutes from './routes/templates';
import testRoutes from './routes/test';
import emailRoutes from './routes/email';
import { createPublicQuestionnaireRouter } from './routes/publicQuestionnaire';
import { createPublicBookingRouter } from './routes/publicBooking';
import { getDatabasePool } from '../database/connection';

export function createServer(): Express {
  const app = express();

  // Security middleware
  app.use(helmet());
  
  // CORS configuration
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }));

  // Body parser middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Input sanitization middleware (applied to all routes)
  app.use(sanitizeAll);

  // Rate limiting (excluding public routes)
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for public routes
      return req.path.startsWith('/api/public/');
    },
  });
  app.use('/api/', limiter);

  // Health check endpoint (no auth required)
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Auth routes (no auth required for login)
  app.use('/api/auth', authRoutes);

  // Public routes (no auth required)
  const pool = getDatabasePool();
  app.use('/api/public/questionnaire', createPublicQuestionnaireRouter(pool));
  app.use('/api/public/booking', createPublicBookingRouter(pool));

  // Email routes (callback has no auth, others require auth - handled in route file)
  app.use('/api/email', emailRoutes);

  // API routes (with JWT authentication)
  app.use('/api/properties', authMiddleware, propertyRoutes);
  app.use('/api/platforms', authMiddleware, platformRoutes);
  app.use('/api/properties', authMiddleware, qualificationRoutes);
  app.use('/api/inquiries', authMiddleware, inquiryRoutes);
  app.use('/api/scheduling', authMiddleware, schedulingRoutes);
  app.use('/api/templates', authMiddleware, templateRoutes);
  app.use('/api/test', authMiddleware, testRoutes);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
}

export function startServer(port: number = 3000): Express {
  // Validate security configuration
  console.log('Validating security configuration...');
  const jwtValid = validateJwtSecret();
  const encryptionValid = validateEncryptionKey();
  
  if (!jwtValid || !encryptionValid) {
    console.warn('⚠️  Security configuration warnings detected. Please review the warnings above.');
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Cannot start server in production with default security keys.');
      process.exit(1);
    }
  } else {
    console.log('✓ Security configuration validated');
  }

  const app = createServer();
  
  app.listen(port, () => {
    console.log(`Rentema API server listening on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  return app;
}
