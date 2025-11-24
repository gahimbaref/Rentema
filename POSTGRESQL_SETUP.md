# PostgreSQL Setup Guide for Windows

## Step 1: Download PostgreSQL

1. Go to https://www.postgresql.org/download/windows/
2. Click on "Download the installer" (by EDB)
3. Download the latest version (PostgreSQL 16 or 15) for Windows x86-64

## Step 2: Install PostgreSQL

1. **Run the installer** (postgresql-16.x-windows-x64.exe)

2. **Installation Directory**: Accept default `C:\Program Files\PostgreSQL\16`

3. **Select Components**: Check all:
   - ✅ PostgreSQL Server
   - ✅ pgAdmin 4 (GUI tool)
   - ✅ Stack Builder (optional)
   - ✅ Command Line Tools

4. **Data Directory**: Accept default `C:\Program Files\PostgreSQL\16\data`

5. **Set Password**: 
   - Enter a password for the `postgres` superuser
   - **IMPORTANT**: Remember this password! You'll need it.
   - Example: `postgres` (for development only)

6. **Port**: Accept default `5432`

7. **Locale**: Accept default (your system locale)

8. **Complete Installation**: Click Next and Finish

## Step 3: Verify Installation

Open a **new** PowerShell or Command Prompt window:

```powershell
# Check if psql is available
psql --version
```

If you get "command not found", add PostgreSQL to your PATH:

### Add PostgreSQL to PATH (if needed)

1. Press `Win + X` and select "System"
2. Click "Advanced system settings"
3. Click "Environment Variables"
4. Under "System variables", find "Path" and click "Edit"
5. Click "New" and add: `C:\Program Files\PostgreSQL\16\bin`
6. Click OK on all dialogs
7. **Restart your terminal**

## Step 4: Create the Rentema Database

### Option 1: Using Command Line

```powershell
# Connect to PostgreSQL (will prompt for password)
psql -U postgres

# Once connected, create the database
CREATE DATABASE rentema;

# Verify it was created
\l

# Exit psql
\q
```

### Option 2: Using pgAdmin 4

1. Open pgAdmin 4 from Start Menu
2. Enter your master password (if prompted)
3. Expand "Servers" → "PostgreSQL 16"
4. Enter the password you set during installation
5. Right-click "Databases" → "Create" → "Database"
6. Name: `rentema`
7. Click "Save"

## Step 5: Run the Schema

Once the database is created, run the schema file:

```powershell
# Navigate to your project
cd C:\Projects\Rentema

# Run the schema (will prompt for password)
psql -U postgres -d rentema -f database/schema.sql
```

You should see output like:
```
CREATE EXTENSION
CREATE TABLE
CREATE TABLE
...
CREATE INDEX
CREATE FUNCTION
CREATE TRIGGER
```

## Step 6: Verify Database Setup

```powershell
# Connect to the rentema database
psql -U postgres -d rentema

# List all tables
\dt

# You should see tables like:
# - properties
# - inquiries
# - questions
# - responses
# - appointments
# - etc.

# Exit
\q
```

## Step 7: Configure Environment Variables

Update your `.env` file with your PostgreSQL credentials:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=rentema
DATABASE_USER=postgres
DATABASE_PASSWORD=your_password_here
```

## Troubleshooting

### "psql: command not found"
- PostgreSQL bin directory is not in PATH
- Add `C:\Program Files\PostgreSQL\16\bin` to PATH (see above)
- Restart your terminal

### "password authentication failed"
- Check your password in `.env` matches the one you set during installation
- Try resetting the postgres user password

### "database does not exist"
- Make sure you created the `rentema` database first
- Use `psql -U postgres -l` to list all databases

### Port 5432 already in use
- Another PostgreSQL instance might be running
- Check Task Manager for postgres.exe processes
- Or change the port in both PostgreSQL config and `.env`

## Quick Reference Commands

```powershell
# Connect to PostgreSQL
psql -U postgres

# Connect to specific database
psql -U postgres -d rentema

# List databases
psql -U postgres -l

# Run SQL file
psql -U postgres -d rentema -f database/schema.sql

# Backup database
pg_dump -U postgres rentema > backup.sql

# Restore database
psql -U postgres -d rentema < backup.sql
```

## Next Steps

After PostgreSQL is set up:
1. ✅ PostgreSQL installed
2. ✅ Database `rentema` created
3. ✅ Schema applied
4. ✅ `.env` configured
5. → Set up Redis (see REDIS_SETUP.md)
6. → Start implementing features
