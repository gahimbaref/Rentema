# Database Setup

## PostgreSQL Setup

### Installation

Install PostgreSQL on your system:
- **macOS**: `brew install postgresql`
- **Ubuntu**: `sudo apt-get install postgresql postgresql-contrib`
- **Windows**: Download from https://www.postgresql.org/download/windows/

### Create Database

```bash
# Start PostgreSQL service
# macOS: brew services start postgresql
# Ubuntu: sudo service postgresql start

# Create database
createdb rentema

# Or using psql
psql -U postgres
CREATE DATABASE rentema;
\q
```

### Run Schema

```bash
psql -U postgres -d rentema -f database/schema.sql
```

## Redis Setup

### Installation

Install Redis on your system:
- **macOS**: `brew install redis`
- **Ubuntu**: `sudo apt-get install redis-server`
- **Windows**: Use WSL or download from https://redis.io/download

### Start Redis

```bash
# macOS
brew services start redis

# Ubuntu
sudo service redis-server start

# Or run in foreground
redis-server
```

### Verify Redis

```bash
redis-cli ping
# Should return: PONG
```

## Environment Configuration

Copy `.env.example` to `.env` and update with your database credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual configuration values.
