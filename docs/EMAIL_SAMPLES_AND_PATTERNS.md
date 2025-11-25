# Email Samples and Platform Patterns

This document describes the sample emails and platform patterns used for email integration testing and identification.

## Overview

The email integration feature uses:
1. **Platform Patterns** - Rules to identify which platform sent an email
2. **Sample Emails** - Test data for validating email parsing without connecting real accounts

## Platform Patterns

Platform patterns are stored in the `platform_patterns` table and used by the `PlatformMatcher` to identify the source of inquiry emails.

### Pattern Structure

Each pattern includes:
- **Platform Type**: The platform identifier (facebook, zillow, craigslist, turbotenant)
- **Sender Pattern**: Regex pattern to match the sender's email address
- **Subject Pattern**: Optional regex pattern to match the subject line
- **Priority**: Used when multiple patterns match (higher priority wins)
- **Active Status**: Whether the pattern is currently in use

### Default Patterns

#### Facebook Marketplace
- **Sender Pattern**: `@facebookmail\.com$`
- **Subject Pattern**: `marketplace|inquiry|message|interested|listing`
- **Description**: Matches emails from Facebook's notification system about marketplace inquiries
- **Example Sender**: `notification@facebookmail.com`

#### Zillow
- **Sender Pattern**: `@zillow\.com$`
- **Subject Pattern**: `inquiry|rental|contact|property|listing`
- **Description**: Matches emails from Zillow's rental inquiry system
- **Example Sender**: `noreply@zillow.com`

#### Craigslist
- **Sender Pattern**: `@craigslist\.org$`
- **Subject Pattern**: `reply|inquiry|re:`
- **Description**: Matches emails from Craigslist's anonymized reply system
- **Example Sender**: `reply-abc123def456@craigslist.org`

#### TurboTenant
- **Sender Pattern**: `@turbotenant\.com$`
- **Subject Pattern**: `application|inquiry|message|rental`
- **Description**: Matches emails from TurboTenant's rental application system
- **Example Sender**: `notifications@turbotenant.com`

## Sample Emails

Sample emails are provided for testing the email parsing functionality without connecting to a real email account.

### Available Samples

#### 1. Facebook Marketplace (Standard)
- **Key**: `facebook`
- **Tests**: Basic Facebook inquiry parsing
- **Features**: Tenant name, contact info, property reference, message content

#### 2. Zillow (Standard)
- **Key**: `zillow`
- **Tests**: Structured Zillow inquiry parsing
- **Features**: Formatted contact information, property address, detailed message

#### 3. Craigslist (Standard)
- **Key**: `craigslist`
- **Tests**: Craigslist anonymized email parsing
- **Features**: Anonymized sender, property reference in subject, contact info in body

#### 4. TurboTenant (Standard)
- **Key**: `turbotenant`
- **Tests**: TurboTenant application inquiry parsing
- **Features**: Structured applicant information, property details, professional message

#### 5. Facebook Marketplace (HTML)
- **Key**: `facebookHtml`
- **Tests**: HTML email parsing and stripping
- **Features**: HTML formatted content, tests stripHtml functionality

#### 6. Zillow (Minimal)
- **Key**: `zillowMinimal`
- **Tests**: Graceful handling of minimal information
- **Features**: Anonymous sender, minimal details, tests partial parsing

#### 7. Craigslist (Brief)
- **Key**: `craigslistShort`
- **Tests**: Very brief inquiry handling
- **Features**: Minimal message content, tests required field validation

#### 8. TurboTenant (Detailed)
- **Key**: `turbotenantDetailed`
- **Tests**: Comprehensive information extraction
- **Features**: Extensive applicant details, multiple data points

## Usage

### Testing Email Parsing

1. **Via UI**: Use the Test Mode page to load sample emails and test parsing
2. **Via API**: POST to `/api/email/test-parse` with sample email data
3. **Via Code**: Import from `src/data/sampleEmails.ts`

```typescript
import { getSampleEmail } from '../data/sampleEmails';

const sample = getSampleEmail('facebook');
const result = await emailParser.testParse({
  id: 'test-123',
  from: sample.from,
  subject: sample.subject,
  body: sample.body,
  receivedDate: new Date()
}, 'facebook');
```

### Seeding Platform Patterns

Platform patterns are automatically seeded when running database migrations via `database/schema.sql`.

To manually seed patterns:

```bash
npx ts-node scripts/seed-platform-patterns.ts
```

Or programmatically:

```typescript
import { seedPlatformPatterns } from '../database/seeds/platformPatterns';
import { getPool } from '../database/connection';

const pool = getPool();
await seedPlatformPatterns(pool);
```

## Adding New Patterns

To add support for a new platform:

1. **Add Pattern to Seeds**:
   - Edit `src/database/seeds/platformPatterns.ts`
   - Add new pattern to `DEFAULT_PLATFORM_PATTERNS` array

2. **Add Parser Logic**:
   - Edit `src/engines/EmailParser.ts`
   - Add new case to `parseEmail()` switch statement
   - Implement platform-specific parsing method

3. **Add Sample Email**:
   - Edit `src/data/sampleEmails.ts`
   - Add sample email to `SAMPLE_EMAILS` object

4. **Update UI**:
   - Edit `client/src/components/TestEmailParser.tsx`
   - Add sample to component if needed

5. **Run Seed Script**:
   ```bash
   npx ts-node scripts/seed-platform-patterns.ts
   ```

## Pattern Matching Logic

The `PlatformMatcher` uses the following logic:

1. Load all active patterns from database, ordered by priority
2. For each pattern:
   - Test sender email against `senderPattern` regex
   - If subject pattern exists, test subject against `subjectPattern` regex
   - If both match (or only sender if no subject pattern), return platform type
3. If no patterns match, return 'unknown'

## Testing Considerations

- **HTML Stripping**: Test with HTML-formatted emails to ensure proper content extraction
- **Minimal Data**: Test with emails missing optional fields to verify graceful degradation
- **Edge Cases**: Test with very brief messages, anonymous senders, etc.
- **Pattern Conflicts**: Ensure patterns don't overlap (e.g., similar sender domains)
- **Regex Safety**: All patterns use anchored regex to prevent partial matches

## Maintenance

- Review patterns quarterly to ensure they match current platform email formats
- Update sample emails if platforms change their email templates
- Monitor parsing errors in production to identify needed pattern updates
- Test new patterns thoroughly before deploying to production
