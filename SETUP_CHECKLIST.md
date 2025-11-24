# Rentema Setup Checklist

Follow this checklist to get Rentema up and running on your Windows machine.

## ✅ Prerequisites

### 1. Node.js (COMPLETED ✓)
- [x] Node.js 18+ installed
- [x] npm working
- [x] Dependencies installed (`npm install`)

### 2. PostgreSQL (TODO)
- [ ] PostgreSQL 14+ installed
- [ ] PostgreSQL service running
- [ ] `psql` command available in terminal
- [ ] Database `rentema` created
- [ ] Schema loaded

**Instructions:** See `POSTGRESQL_SETUP.md`

**Quick Install:**
1. Download from https://www.postgresql.org/download/windows/
2. Run installer, set password for `postgres` user
3. Add to PATH: `C:\Program Files\PostgreSQL\16\bin`
4. Restart terminal

**Create Database:**
```powershell
psql -U postgres -c "CREATE DATABASE rentema;"
psql -U postgres -d rentema -f database/schema.sql
```

**Test Connection:**
```powershell
npm run test:db
```

### 3. Redis (TODO)
- [ ] Redis installed and running
- [ ] Redis accessible on localhost:6379

**Instructions:** See `REDIS_SETUP.md`

**Recommended: Use WSL2**
```bash
sudo apt update
sudo apt install redis-server -y
sudo service redis-server start
redis-cli ping  # Should return PONG
```

**Test Connection:**
```powershell
npm run test:redis
```

## ✅ Configuration

### 4. Environment Variables (TODO)
- [ ] `.env` file created
- [ ] Database credentials configured
- [ ] Redis settings configured

**Setup:**
```powershell
copy .env.example .env
```

**Edit `.env` with your settings:**
```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=rentema
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password_here
DATABASE_SSL=false

REDIS_HOST=localhost
REDIS_PORT=6379

NODE_ENV=development
PORT=3000
```

## ✅ Verification

### 5. Run Tests (TODO)
- [ ] All unit tests pass
- [ ] Database connection test passes
- [ ] Redis connection test passes

**Commands:**
```powershell
# Run all tests
npm test

# Test database connection
npm run test:db

# Test Redis connection
npm run test:redis
```

## ✅ Final Steps

### 6. Build and Run (TODO)
- [ ] TypeScript compiles successfully
- [ ] Application starts without errors

**Commands:**
```powershell
# Build the project
npm run build

# Run in development mode
npm run dev
```

## Current Status

✅ **Completed:**
- Node.js and npm installed
- Project dependencies installed
- Project structure created
- Testing frameworks configured
- All unit tests passing

⏳ **Next Steps:**
1. Install PostgreSQL (see POSTGRESQL_SETUP.md)
2. Install Redis (see REDIS_SETUP.md)
3. Create .env file
4. Test connections
5. Ready to implement Task 2!

## Quick Start Commands

Once PostgreSQL and Redis are installed:

```powershell
# 1. Create .env file
copy .env.example .env

# 2. Edit .env with your database password

# 3. Create database
psql -U postgres -c "CREATE DATABASE rentema;"

# 4. Load schema
psql -U postgres -d rentema -f database/schema.sql

# 5. Test everything
npm run test:db
npm run test:redis
npm test

# 6. Start development
npm run dev
```

## Troubleshooting

### Node.js PATH Issues
If `npm` is not recognized after restarting terminal:
- Add to PATH: `C:\Program Files\nodejs`
- Restart terminal

### PostgreSQL Connection Issues
- Verify service is running: `Get-Service postgresql*`
- Check credentials in `.env`
- Ensure `DATABASE_SSL=false`

### Redis Connection Issues
- WSL2: `sudo service redis-server start`
- Docker: `docker start rentema-redis`
- Test: `redis-cli ping`

## Need Help?

- **PostgreSQL Setup:** See `POSTGRESQL_SETUP.md`
- **Redis Setup:** See `REDIS_SETUP.md`
- **Project Structure:** See `PROJECT_STRUCTURE.md`
- **General Setup:** See `SETUP.md`

## Next Task

Once all checkboxes are complete, you're ready for:
**Task 2: Implement core data models and database layer**

See `.kiro/specs/rental-automation/tasks.md` for the implementation plan.
