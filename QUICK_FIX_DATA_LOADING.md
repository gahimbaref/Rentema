# Quick Fix: "Failed to Load Data" Issue

## The Problem
The application shows "Failed to load data" because either:
1. You're not logged in
2. The database isn't running
3. There's no data in the database

## Quick Solutions

### Solution 1: Check if you're logged in
1. Open http://localhost:3000/login
2. Log in with your credentials
3. If you don't have an account, you need to create a manager first

### Solution 2: Create a test manager account
Run this command to create a test manager:

```bash
npx tsx scripts/create-test-manager.ts
```

This will create a manager with:
- Email: test@example.com
- Password: password123

### Solution 3: Check if PostgreSQL is running
```bash
# Windows - Check if PostgreSQL service is running
sc query postgresql-x64-14

# If not running, start it:
net start postgresql-x64-14
```

### Solution 4: Check if backend is responding
Open your browser console (F12) and look for:
- Red network errors (backend not running)
- 401 errors (not logged in)
- 500 errors (database issue)

### Solution 5: Restart both servers
```bash
# Stop both servers (Ctrl+C in both terminals)

# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend  
cd client
npm run dev
```

### Solution 6: Check backend logs
Look at the backend terminal for errors like:
- "Database connection failed"
- "ECONNREFUSED"
- "Authentication failed"

## Testing the Fix

1. Go to http://localhost:3000/login
2. Log in with test@example.com / password123
3. Navigate to Properties or Inquiries page
4. Data should now load

## Still Having Issues?

Check the browser console (F12 → Console tab) for specific error messages and share them for more targeted help.
