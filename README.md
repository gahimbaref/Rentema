# Rentema - Rental Property Management System

Rentema is a customizable application designed to streamline the tenant acquisition process across multiple rental listing platforms (Zillow, TurboTenant, Facebook Marketplace, etc.). The system automates pre-qualification messaging, video call scheduling, and property tour coordination.

## Features

- Multi-platform integration (Zillow, TurboTenant, Facebook Marketplace)
- Automated pre-qualification messaging
- Customizable qualification criteria
- Video call scheduling with Zoom integration
- Property tour coordination
- Centralized inquiry dashboard
- Message template customization
- Test mode for development

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
# Create PostgreSQL database
createdb rentema

# Run schema
psql -U postgres -d rentema -f database/schema.sql
```

5. Start Redis:
```bash
redis-server
```

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Project Structure

```
rentema/
├── src/
│   ├── api/          # API routes and controllers
│   ├── database/     # Database connection and repositories
│   ├── engines/      # Business logic engines
│   ├── models/       # Data models and interfaces
│   ├── utils/        # Utility functions
│   └── index.ts      # Application entry point
├── tests/
│   ├── unit/         # Unit tests
│   ├── integration/  # Integration tests
│   └── property/     # Property-based tests
├── database/
│   ├── schema.sql    # Database schema
│   └── README.md     # Database setup instructions
└── package.json
```

## Testing

The project uses Jest for unit testing and fast-check for property-based testing.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Documentation

See the `.kiro/specs/rental-automation/` directory for detailed requirements, design, and implementation plan.

## License

MIT
