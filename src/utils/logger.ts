/**
 * Structured logging utility for Rentema
 * Provides consistent logging format with correlation IDs and context
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface LogContext {
  correlationId?: string;
  managerId?: string;
  connectionId?: string;
  emailId?: string;
  inquiryId?: string;
  platformType?: string;
  operation?: string;
  duration?: number;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    message: string;
    stack?: string;
    code?: string;
  };
}

class Logger {
  private minLevel: LogLevel;

  constructor() {
    // Set minimum log level from environment or default to INFO
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    this.minLevel = this.parseLogLevel(envLevel) || LogLevel.INFO;
  }

  private parseLogLevel(level?: string): LogLevel | null {
    switch (level) {
      case 'debug': return LogLevel.DEBUG;
      case 'info': return LogLevel.INFO;
      case 'warn': return LogLevel.WARN;
      case 'error': return LogLevel.ERROR;
      default: return null;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const minIndex = levels.indexOf(this.minLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  private formatLog(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    };

    if (error) {
      entry.error = {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      };
    }

    const formatted = this.formatLog(entry);

    // Output to appropriate stream
    if (level === LogLevel.ERROR) {
      console.error(formatted);
    } else if (level === LogLevel.WARN) {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Generate a correlation ID for tracking related operations
   */
  generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a child logger with preset context
   */
  child(baseContext: LogContext): ChildLogger {
    return new ChildLogger(this, baseContext);
  }
}

/**
 * Child logger that includes base context in all log calls
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private baseContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.baseContext, ...context };
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    this.parent.warn(message, this.mergeContext(context), error);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    this.parent.error(message, this.mergeContext(context), error);
  }
}

// Export singleton instance
export const logger = new Logger();
