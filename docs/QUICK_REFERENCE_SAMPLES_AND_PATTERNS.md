# Quick Reference: Sample Emails & Platform Patterns

## Sample Emails Location
`src/data/sampleEmails.ts`

## Platform Patterns Location
- Database: `database/schema.sql` (auto-seeded)
- Code: `src/database/seeds/platformPatterns.ts`
- Seed Script: `scripts/seed-platform-patterns.ts`

## Quick Usage

### Get a Sample Email
```typescript
import { getSampleEmail } from '../data/sampleEmails';
const sample = getSampleEmail('facebook');
```

### Get All Samples
```typescript
import { getAllSampleEmails } from '../data/sampleEmails';
const samples = getAllSampleEmails();
```

### Get Samples by Platform
```typescript
import { getSampleEmailsByPlatform } from '../data/sampleEmails';
const facebookSamples = getSampleEmailsByPlatform('facebook');
```

### Validate Pattern
```typescript
import { validateSenderPattern } from '../database/seeds/platformPatterns';
const isValid = validateSenderPattern('notification@facebookmail.com', 'facebook');
```

### Seed Patterns Manually
```bash
npx ts-node scripts/seed-platform-patterns.ts
```

## Available Sample Keys
- `facebook` - Standard Facebook Marketplace inquiry
- `zillow` - Standard Zillow inquiry
- `craigslist` - Standard Craigslist inquiry
- `turbotenant` - Standard TurboTenant inquiry
- `facebookHtml` - HTML formatted Facebook email
- `zillowMinimal` - Minimal information Zillow email
- `craigslistShort` - Very brief Craigslist inquiry
- `turbotenantDetailed` - Detailed TurboTenant application

## Platform Patterns

| Platform | Sender Domain | Example |
|----------|--------------|---------|
| Facebook | `@facebookmail.com` | `notification@facebookmail.com` |
| Zillow | `@zillow.com` | `noreply@zillow.com` |
| Craigslist | `@craigslist.org` | `reply-abc123@craigslist.org` |
| TurboTenant | `@turbotenant.com` | `notifications@turbotenant.com` |

## Testing

Run pattern tests:
```bash
npm test -- tests/unit/platformPatterns.test.ts
```

Run sample email tests:
```bash
npm test -- tests/unit/sampleEmails.test.ts
```

Run both:
```bash
npm test -- tests/unit/platformPatterns.test.ts tests/unit/sampleEmails.test.ts
```

## Documentation
Full documentation: `docs/EMAIL_SAMPLES_AND_PATTERNS.md`
