# Rentema Setup Guide

## Step 1: Install Prerequisites

### Node.js and npm
1. Download and install Node.js 18+ from https://nodejs.org/
2. Verify installation:
```bash
node --version
npm --version
```

### PostgreSQL
1. Download and install PostgreSQL 14+ from https://www.postgresql.org/download/
2. Verify installation:
```bash
psql --version
```

### Redis
1. **Windows**: Download Redis from https://github.com/microsoftarchive/redis/releases or use WSL
2. **macOS**: `brew install redis`
3. **Linux**: `sudo apt-get install redis-server`

## Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- TypeScript and ts-node-dev for development
- Express for API server
- PostgreSQL client (pg)
- Redis client
- Bull for message queues
- Jest and fast-check for testing

## Step 3: Configure Environment

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and update with your configuration:
   - Database credentials
   - Redis connection details
   - Encryption keys (generate secure keys for production)
   - JWT secret
   - Zoom API credentials (optional)

## Step 4: Set Up Database

1. Create the database:
```bash
createdb rentema
```

Or using psql:
```bash
psql -U postgres
CREATE DATABASE rentema;
\q
```

2. Run the schema:
```bash
psql -U postgres -d rentema -f database/schema.sql
```

## Step 5: Start Redis

```bash
redis-server
```

Or as a service:
- **macOS**: `brew services start redis`
- **Linux**: `sudo service redis-server start`

## Step 6: Verify Setup

1. Build the project:
```bash
npm run build
```

2. Run tests:
```bash
npm test
```

3. Start development server:
```bash
npm run dev
```

## Troubleshooting

### npm not found
- Ensure Node.js is installed and added to your PATH
- Restart your terminal after installation

### PostgreSQL connection errors
- Verify PostgreSQL service is running
- Check credentials in `.env` file
- Ensure database exists: `psql -U postgres -l`

### Redis connection errors
- Verify Redis service is running: `redis-cli ping` (should return PONG)
- Check Redis host and port in `.env` file

### TypeScript compilation errors
- Ensure all dependencies are installed: `npm install`
- Clear build cache: `rm -rf dist/`

## Next Steps

Once setup is complete, you can:
1. Review the implementation plan in `.kiro/specs/rental-automation/tasks.md`
2. Start implementing features following the task list
3. Run tests frequently to ensure correctness

For detailed architecture and design information, see:
- `.kiro/specs/rental-automation/requirements.md`
- `.kiro/specs/rental-automation/design.md`
