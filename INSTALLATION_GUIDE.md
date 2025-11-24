# Rentema Installation Guide

Complete step-by-step guide to set up Rentema on Windows.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] PostgreSQL 14+ installed
- [ ] Redis installed (Memurai or alternative)
- [ ] Git installed (optional)

## Step-by-Step Installation

### 1. Install Node.js ✅ COMPLETED

You already have Node.js v24.11.1 installed!

### 2. Install PostgreSQL

Follow the detailed guide in **POSTGRESQL_SETUP.md**

**Quick steps:**
1. Download from https://www.postgresql.org/download/windows/
2. Run installer, set password for `postgres` user
3. Add to PATH: `C:\Program Files\PostgreSQL\16\bin`
4. Restart terminal

**Create database:**
```powershell
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE rentema;

# Exit
\q

# Run schema
psql -U postgres -d rentema -f database/schema.sql
```

### 3. Install Redis

Follow the detailed guide in **REDIS_SETUP.md**

**Recommended: Memurai**
1. Download from https://www.memurai.com/get-memurai
2. Install (runs as Windows service automatically)
3. Verify: `redis-cli ping` (should return PONG)

### 4. Configure Environment

```powershell
# Copy example environment file
cp .env.example .env
```

Edit `.env` with your settings:
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=rentema
DATABASE_USER=postgres
DATABASE_PASSWORD=your_postgres_password

REDIS_HOST=localhost
REDIS_PORT=6379

NODE_ENV=development
PORT=3000
```

### 5. Install Dependencies ✅ COMPLETED

You already ran `npm install` successfully!

### 6. Verify Setup

Run the verification script:

```powershell
npm run verify
```

This will check:
- ✅ Environment variables configured
- ✅ PostgreSQL connection
- ✅ Database schema loaded
- ✅ Redis connection

## Common Issues

### PostgreSQL Issues

**"psql: command not found"**
- Add `C:\Program Files\PostgreSQL\16\bin` to PATH
- Restart terminal

**"password authentication failed"**
- Check password in `.env` matches PostgreSQL password
- Try: `psql -U postgres` and enter password manually

**"database does not exist"**
- Create it: `psql -U postgres -c "CREATE DATABASE rentema;"`

### Redis Issues

**"redis-cli: command not found"**
- Install Memurai or Redis
- Add to PATH if needed

**"ECONNREFUSED"**
- Start Redis/Memurai service
- Check Services app (Win + R → `services.msc`)

### Node.js Issues

**"npm: command not found"**
- Add `C:\Program Files\nodejs` to PATH
- Restart terminal

## Verification Checklist

Run these commands to verify everything works:

```powershell
# Check Node.js
node --version          # Should show v24.11.1

# Check npm
npm --version           # Should show 11.6.2

# Check PostgreSQL
psql --version          # Should show PostgreSQL version

# Check Redis
redis-cli ping          # Should return PONG

# Check project setup
npm test                # Should pass all tests

# Verify connections
npm run verify          # Should show all ✅
```

## Next Steps

Once everything is verified:

1. **Review the specs:**
   - `.kiro/specs/rental-automation/requirements.md`
   - `.kiro/specs/rental-automation/design.md`
   - `.kiro/specs/rental-automation/tasks.md`

2. **Start implementing features:**
   - Open `tasks.md` in Kiro
   - Click "Start task" on Task 2

3. **Run development server:**
   ```powershell
   npm run dev
   ```

4. **Run tests frequently:**
   ```powershell
   npm test
   ```

## Getting Help

- **PostgreSQL**: See POSTGRESQL_SETUP.md
- **Redis**: See REDIS_SETUP.md
- **Project Structure**: See PROJECT_STRUCTURE.md
- **General Setup**: See SETUP.md

## Quick Reference

```powershell
# Development
npm run dev              # Start dev server
npm test                 # Run tests
npm run build            # Build for production

# Database
psql -U postgres -d rentema                    # Connect to database
psql -U postgres -d rentema -f database/schema.sql  # Run schema

# Redis
redis-cli                # Connect to Redis
redis-cli ping           # Test connection

# Verification
npm run verify           # Check all connections
```

## Success! 🎉

When `npm run verify` shows all green checkmarks, you're ready to start building Rentema!
