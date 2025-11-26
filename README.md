# Rentema - Rental Property Management System

Rentema is a customizable application designed to streamline the tenant acquisition process across multiple rental listing platforms (Zillow, TurboTenant, Facebook Marketplace, etc.). The system automates pre-qualification messaging, video call scheduling, and property tour coordination.

## Features

- Multi-platform integration (Zillow, TurboTenant, Facebook Marketplace)
- **Email integration for automatic inquiry capture from Gmail**
- Automated pre-qualification messaging
- Customizable qualification criteria
- Video call scheduling with Google Meet integration
- Property tour coordination
- Centralized inquiry dashboard
- Message template customization
- Test mode for development

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Redis 6+
- Google Cloud Console account (for Gmail integration)

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

## Email Integration Setup

Rentema can automatically capture rental inquiries from your Gmail account. This requires setting up OAuth 2.0 credentials through Google Cloud Console.

### Google Cloud Console Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Note your Project ID

2. **Enable Gmail API**
   - In the Google Cloud Console, navigate to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

3. **Configure OAuth Consent Screen**
   - Navigate to "APIs & Services" > "OAuth consent screen"
   - Select "External" user type (unless you have a Google Workspace)
   - Fill in the required fields:
     - App name: "Rentema"
     - User support email: Your email
     - Developer contact email: Your email
   - Add scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.modify`
   - Add test users (your Gmail account)
   - Save and continue

4. **Create OAuth 2.0 Credentials**
   - Navigate to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Select "Web application"
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/email/callback` (for development)
     - `https://yourdomain.com/api/email/callback` (for production)
   - Click "Create"
   - **Save the Client ID and Client Secret**

### Environment Variables Configuration

Add the following variables to your `.env` file:

```bash
# Gmail OAuth Configuration
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/email/callback

# Encryption key for storing OAuth tokens (generate a random 32-character string)
ENCRYPTION_KEY=your_32_character_encryption_key_here
```

**Important Security Notes:**
- Never commit your `.env` file to version control
- Use a strong, randomly generated encryption key
- In production, use environment-specific redirect URIs
- Store credentials securely (use a secrets manager in production)

### Testing Email Integration

1. Start the application
2. Navigate to the Email Connection page in the UI
3. Click "Connect Gmail"
4. Authorize Rentema to access your Gmail account
5. Use the Test Mode to verify email parsing with sample emails

For detailed user instructions, see the [Email Integration User Guide](docs/EMAIL_INTEGRATION_GUIDE.md).

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

- **Email Integration**: See [Email Integration User Guide](docs/EMAIL_INTEGRATION_GUIDE.md)
- **Rental Automation Spec**: See `.kiro/specs/rental-automation/` directory
- **Email Integration Spec**: See `.kiro/specs/email-integration/` directory
- **Database Setup**: See [PostgreSQL Setup Guide](POSTGRESQL_SETUP.md)
- **Redis Setup**: See [Redis Setup Guide](REDIS_SETUP.md)

## License

MIT
