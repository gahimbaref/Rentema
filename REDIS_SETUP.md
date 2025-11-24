# Redis Setup Guide for Windows

## Overview

Redis is used by Rentema for caching and message queues. On Windows, you have a few options.

## Option 1: Redis on Windows (Memurai) - Recommended

Memurai is a Redis-compatible server for Windows.

### Installation

1. Go to https://www.memurai.com/get-memurai
2. Download Memurai (free for development)
3. Run the installer
4. Accept defaults and complete installation
5. Memurai will start automatically as a Windows service

### Verify Installation

```powershell
# Test connection (Memurai runs on port 6379 by default)
redis-cli ping
```

Should return: `PONG`

## Option 2: WSL (Windows Subsystem for Linux)

If you have WSL installed, you can run native Redis.

### Installation

```bash
# In WSL terminal
sudo apt-get update
sudo apt-get install redis-server

# Start Redis
sudo service redis-server start

# Verify
redis-cli ping
```

## Option 3: Docker

If you have Docker Desktop installed:

```powershell
# Pull Redis image
docker pull redis:latest

# Run Redis container
docker run -d -p 6379:6379 --name rentema-redis redis:latest

# Verify
docker exec -it rentema-redis redis-cli ping
```

## Option 4: Redis for Windows (Legacy)

Microsoft archived Redis port for Windows:

1. Go to https://github.com/microsoftarchive/redis/releases
2. Download `Redis-x64-3.0.504.msi`
3. Run installer
4. Complete installation
5. Redis will start as a Windows service

## Verify Redis is Running

```powershell
# Test connection
redis-cli ping
```

If you get "command not found", add Redis to PATH:
- Memurai: `C:\Program Files\Memurai\`
- Legacy Redis: `C:\Program Files\Redis\`

## Configure Rentema

Update your `.env` file:

```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Test Redis Connection

Create a simple test file to verify Redis works with Node.js:

```javascript
// test-redis.js
const { createClient } = require('redis');

async function testRedis() {
  const client = createClient({
    socket: {
      host: 'localhost',
      port: 6379
    }
  });

  client.on('error', (err) => console.error('Redis error:', err));

  await client.connect();
  console.log('✅ Connected to Redis');

  await client.set('test', 'Hello Redis!');
  const value = await client.get('test');
  console.log('✅ Test value:', value);

  await client.quit();
  console.log('✅ Redis test complete');
}

testRedis().catch(console.error);
```

Run it:
```powershell
node test-redis.js
```

## Troubleshooting

### "redis-cli: command not found"
- Redis is not in PATH
- Add Redis bin directory to PATH
- Or use full path: `"C:\Program Files\Memurai\redis-cli.exe" ping`

### "Could not connect to Redis"
- Check if Redis service is running:
  - Open Services (Win + R, type `services.msc`)
  - Look for "Redis" or "Memurai"
  - Ensure it's "Running"
- Check firewall settings
- Verify port 6379 is not blocked

### "ECONNREFUSED"
- Redis server is not running
- Start the service manually
- Check if another application is using port 6379

## Redis Commands Reference

```powershell
# Connect to Redis CLI
redis-cli

# Inside redis-cli:
PING                    # Test connection
SET key value          # Set a value
GET key                # Get a value
KEYS *                 # List all keys
FLUSHALL               # Clear all data (careful!)
INFO                   # Server information
EXIT                   # Exit redis-cli
```

## Next Steps

After Redis is set up:
1. ✅ Redis installed and running
2. ✅ `.env` configured with Redis settings
3. → Test the connection with Node.js
4. → Start implementing Rentema features
