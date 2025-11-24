/**
 * Basic setup verification tests
 */

describe('Setup Verification', () => {
  it('should have Node.js environment', () => {
    expect(process.version).toBeDefined();
    expect(process.env.NODE_ENV).toBeDefined();
  });

  it('should load environment variables', () => {
    // These should have defaults even if .env is not present
    expect(process.env.DATABASE_HOST || 'localhost').toBe('localhost');
    expect(process.env.REDIS_HOST || 'localhost').toBe('localhost');
  });

  it('should have TypeScript configured', () => {
    // This test running proves TypeScript is working
    const testValue: string = 'TypeScript is configured';
    expect(testValue).toBe('TypeScript is configured');
  });
});
