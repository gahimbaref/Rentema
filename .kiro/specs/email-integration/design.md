# Email Integration Design Document

## Overview

The Email Integration feature extends Rentema's inquiry capture capabilities by monitoring a property manager's email account for rental inquiry notifications from listing platforms. This enables Rentema to automatically process inquiries from platforms that don't provide direct API access or webhooks (such as Facebook Marketplace and Craigslist), as well as provide a backup channel for platforms with API integrations.

The system uses OAuth 2.0 to securely access the user's Gmail account, periodically polls for new inquiry emails, identifies the source platform using pattern matching, extracts structured data from email content, and creates inquiries that feed into Rentema's existing automated workflow.

This design integrates seamlessly with the existing Platform Manager architecture, treating email as another inquiry source alongside direct platform integrations.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Email Provider"
        GMAIL[Gmail API]
    end
    
    subgraph "Email Integration Layer"
        OAUTH[OAuth Manager]
        POLLER[Email Poller]
        PARSER[Email Parser]
        MATCHER[Platform Matcher]
    end
    
    subgraph "Existing Rentema Core"
        PM[Platform Manager]
        WF[Workflow Orchestrator]
        DB[(Database)]
    end
    
    subgraph "User Interface"
        CONFIG[Email Config UI]
        DASH[Dashboard]
    end
    
    CONFIG --> OAUTH
    OAUTH --> GMAIL
    POLLER --> GMAIL
    POLLER --> PARSER
    PARSER --> MATCHER
    MATCHER --> PM
    PM --> WF
    WF --> DB
    DASH --> DB
```

### Technology Stack

- **Gmail API**: Google's official API for email access with OAuth 2.0
- **OAuth 2.0**: Secure authorization using Google's OAuth flow
- **Email Parsing**: Custom parsers for each platform's email format
- **Pattern Matching**: Regular expressions and heuristics for platform identification
- **Encryption**: AES-256 for storing OAuth tokens
- **Scheduling**: Node-cron or Bull queue for periodic polling
- **Testing**: Jest for unit tests, fast-check for property-based testing

## Components and Interfaces

### 1. OAuth Manager

Handles Google OAuth 2.0 flow for Gmail access.

**Responsibilities:**
- Initiate OAuth authorization flow
- Exchange authorization code for access/refresh tokens
- Store tokens securely with encryption
- Refresh expired access tokens automatically
- Revoke tokens on disconnection

**Interface:**
```typescript
interface OAuthManager {
  getAuthorizationUrl(): string;
  exchangeCodeForTokens(code: string, managerId: string): Promise<EmailConnection>;
  refreshAccessToken(connectionId: string): Promise<void>;
  revokeAccess(connectionId: string): Promise<void>;
  verifyConnection(connectionId: string): Promise<EmailVerification>;
}

interface EmailConnection {
  id: string;
  managerId: string;
  emailAddress: string;
  accessToken: string; // encrypted
  refreshToken: string; // encrypted
  tokenExpiry: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface EmailVerification {
  isValid: boolean;
  emailAddress?: string;
  error?: string;
}
```

### 2. Email Poller

Periodically checks email account for new inquiry messages.

**Responsibilities:**
- Poll Gmail API on configured interval (default: 5 minutes)
- Retrieve only unread messages from last 7 days
- Apply configured filters (sender, subject keywords)
- Mark processed emails as read
- Handle polling errors and token refresh
- Track last poll time and statistics

**Interface:**
```typescript
interface EmailPoller {
  startPolling(connectionId: string): void;
  stopPolling(connectionId: string): void;
  pollNow(connectionId: string): Promise<PollResult>;
  getPollingStatus(connectionId: string): PollingStatus;
}

interface PollResult {
  emailsFound: number;
  emailsProcessed: number;
  emailsSkipped: number;
  errors: string[];
  timestamp: Date;
}

interface PollingStatus {
  isActive: boolean;
  lastPollTime?: Date;
  nextPollTime?: Date;
  consecutiveFailures: number;
}
```

### 3. Platform Matcher

Identifies which listing platform sent an email.

**Responsibilities:**
- Match email sender and subject against platform patterns
- Support configurable platform patterns
- Provide confidence scores for matches
- Handle ambiguous or unknown senders

**Interface:**
```typescript
interface PlatformMatcher {
  identifyPlatform(email: RawEmail): PlatformMatch;
  addPlatformPattern(pattern: PlatformPattern): Promise<void>;
  getPlatformPatterns(): Promise<PlatformPattern[]>;
}

interface RawEmail {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedDate: Date;
}

interface PlatformMatch {
  platformType: 'facebook' | 'zillow' | 'craigslist' | 'turbotenant' | 'unknown';
  confidence: number; // 0-1
  matchedPattern?: string;
}

interface PlatformPattern {
  id: string;
  platformType: string;
  senderPattern: string; // regex
  subjectPattern?: string; // regex
  priority: number;
  isActive: boolean;
}
```

### 4. Email Parser

Extracts structured inquiry data from email content.

**Responsibilities:**
- Parse email body based on platform type
- Extract tenant name, message, property reference
- Extract contact information when available
- Handle various email formats (HTML, plain text)
- Provide fallback for unparseable fields

**Interface:**
```typescript
interface EmailParser {
  parseEmail(email: RawEmail, platformType: string): Promise<ParsedInquiry>;
  testParse(email: RawEmail): Promise<ParseResult>;
}

interface ParsedInquiry {
  tenantName?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  message: string;
  propertyReference?: string;
  propertyAddress?: string;
  platformType: string;
  originalEmailId: string;
  receivedDate: Date;
  parsingErrors: string[];
}

interface ParseResult {
  success: boolean;
  extractedFields: Record<string, any>;
  missingFields: string[];
  errors: string[];
}
```

### 5. Property Matcher

Matches extracted property references to existing properties.

**Responsibilities:**
- Match property address or reference to database
- Use fuzzy matching for address variations
- Handle unmatched properties
- Provide match confidence scores

**Interface:**
```typescript
interface PropertyMatcher {
  matchProperty(propertyReference: string, managerId: string): Promise<PropertyMatch>;
  matchByAddress(address: string, managerId: string): Promise<PropertyMatch>;
}

interface PropertyMatch {
  matched: boolean;
  propertyId?: string;
  confidence: number;
  matchedAddress?: string;
}
```

### 6. Email Inquiry Service

Orchestrates the email-to-inquiry conversion process.

**Responsibilities:**
- Coordinate polling, parsing, and inquiry creation
- Prevent duplicate inquiry creation
- Track processing statistics
- Handle errors gracefully
- Integrate with existing Platform Manager

**Interface:**
```typescript
interface EmailInquiryService {
  processNewEmails(connectionId: string): Promise<ProcessingResult>;
  createInquiryFromEmail(parsedInquiry: ParsedInquiry, managerId: string): Promise<string>;
  getProcessingStats(connectionId: string, dateRange?: DateRange): Promise<EmailStats>;
}

interface ProcessingResult {
  emailsProcessed: number;
  inquiriesCreated: number;
  inquiriesUnmatched: number;
  errors: ProcessingError[];
}

interface ProcessingError {
  emailId: string;
  error: string;
  timestamp: Date;
}

interface EmailStats {
  totalEmailsProcessed: number;
  successfulExtractions: number;
  failedParsing: number;
  platformBreakdown: Record<string, number>;
  lastSyncTime?: Date;
}
```

### 7. Email Filter Configuration

Manages user-defined filters for email processing.

**Responsibilities:**
- Store and retrieve filter rules
- Apply filters during email polling
- Provide default filters for common platforms
- Validate filter syntax

**Interface:**
```typescript
interface EmailFilterService {
  saveFilters(connectionId: string, filters: EmailFilters): Promise<void>;
  getFilters(connectionId: string): Promise<EmailFilters>;
  applyFilters(email: RawEmail, filters: EmailFilters): boolean;
  getDefaultFilters(): EmailFilters;
}

interface EmailFilters {
  senderWhitelist: string[]; // email addresses or domains
  subjectKeywords: string[];
  excludeSenders: string[];
  excludeSubjectKeywords: string[];
}
```

## Data Models

### Email Connection

```typescript
interface EmailConnection {
  id: string;
  managerId: string;
  emailAddress: string;
  accessToken: string; // encrypted
  refreshToken: string; // encrypted
  tokenExpiry: Date;
  isActive: boolean;
  lastPollTime?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Processed Email

```typescript
interface ProcessedEmail {
  id: string;
  connectionId: string;
  emailId: string; // Gmail message ID
  from: string;
  subject: string;
  receivedDate: Date;
  platformType: string;
  inquiryId?: string;
  processingStatus: 'success' | 'failed' | 'skipped';
  parsingErrors?: string[];
  processedAt: Date;
}
```

### Platform Pattern

```typescript
interface PlatformPattern {
  id: string;
  platformType: string;
  senderPattern: string;
  subjectPattern?: string;
  bodyPatterns?: Record<string, string>; // field name -> regex
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Email Filters

```typescript
interface EmailFilterConfig {
  id: string;
  connectionId: string;
  senderWhitelist: string[];
  subjectKeywords: string[];
  excludeSenders: string[];
  excludeSubjectKeywords: string[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Inquiry Extension

Extend existing Inquiry model to track email source:

```typescript
interface Inquiry {
  // ... existing fields
  sourceType: 'platform_api' | 'email' | 'manual';
  sourceEmailId?: string;
  sourceMetadata?: Record<string, any>;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: OAuth token storage round-trip
*For any* valid OAuth access and refresh tokens, storing them encrypted and then retrieving them should return equivalent token data
**Validates: Requirements 1.2**

### Property 2: Email connection verification
*For any* stored OAuth tokens, verifying the connection should successfully retrieve the user's email address from Gmail API
**Validates: Requirements 1.3**

### Property 3: Connection status display
*For any* established email connection, retrieving the connection should return the active status and associated email address
**Validates: Requirements 1.4**

### Property 4: Credential cleanup on disconnect
*For any* active email connection, disconnecting should remove all stored credentials and mark the connection as inactive
**Validates: Requirements 1.5**

### Property 5: Poll message filtering
*For any* polling operation, all retrieved messages should be unread and have received dates within the last 7 days
**Validates: Requirements 2.2**

### Property 6: Duplicate prevention through marking
*For any* processed email, marking it as read should prevent it from being retrieved in subsequent polls
**Validates: Requirements 2.3**

### Property 7: Token refresh on expiration
*For any* polling operation that encounters an expired token error, the system should attempt to refresh the access token
**Validates: Requirements 2.4**

### Property 8: Notification on refresh failure
*For any* token refresh failure, the system should create a notification for the property manager
**Validates: Requirements 2.5**

### Property 9: Unknown email skipping
*For any* email that doesn't match any platform patterns, the system should skip processing and not create an inquiry
**Validates: Requirements 3.5**

### Property 10: Tenant name extraction
*For any* inquiry email containing a tenant name, parsing should extract and include the name in the parsed result
**Validates: Requirements 4.1**

### Property 11: Message content extraction
*For any* inquiry email, parsing should extract the message content
**Validates: Requirements 4.2**

### Property 12: Property reference extraction
*For any* inquiry email containing property information, parsing should extract the property address or listing reference
**Validates: Requirements 4.3**

### Property 13: Contact information extraction
*For any* inquiry email containing contact information, parsing should extract the tenant's email or phone number
**Validates: Requirements 4.4**

### Property 14: Graceful partial parsing
*For any* inquiry email where required fields cannot be extracted, the system should create an inquiry with available data and flag it for review
**Validates: Requirements 4.5**

### Property 15: Property matching attempt
*For any* extracted inquiry with property information, the system should attempt to match it against existing properties
**Validates: Requirements 5.1**

### Property 16: Matched inquiry linking
*For any* successful property match, the created inquiry should be linked to the matched property ID
**Validates: Requirements 5.2**

### Property 17: Unmatched inquiry creation
*For any* inquiry that doesn't match an existing property, the system should create an unmatched inquiry flagged for manual assignment
**Validates: Requirements 5.3**

### Property 18: Workflow trigger on creation
*For any* inquiry created from email, the pre-qualification workflow should be triggered
**Validates: Requirements 5.4**

### Property 19: Email ID storage for deduplication
*For any* created inquiry from email, the original email ID should be stored, and processing the same email ID again should not create a duplicate inquiry
**Validates: Requirements 5.5**

### Property 20: Filter application
*For any* email that doesn't match configured sender or subject filters, the system should skip processing that email
**Validates: Requirements 6.3**

### Property 21: Filter update propagation
*For any* filter configuration update, subsequent polling operations should apply the new filters
**Validates: Requirements 6.4**

### Property 22: Email source indication
*For any* inquiry created from email, retrieving the inquiry should indicate email as the source type
**Validates: Requirements 7.1**

### Property 23: Platform source display
*For any* inquiry created from email, retrieving the inquiry should include the platform that sent the email
**Validates: Requirements 7.2**

### Property 24: Email received date tracking
*For any* inquiry created from email, retrieving the inquiry should include the date and time the email was received
**Validates: Requirements 7.3**

### Property 25: Source type filtering
*For any* set of inquiries with mixed sources, filtering by source type 'email' should return only inquiries that originated from email
**Validates: Requirements 7.4**

### Property 26: Original email preservation
*For any* inquiry with parsing errors, the original email content should be stored and retrievable for manual review
**Validates: Requirements 7.5**

### Property 27: Test mode non-persistence
*For any* sample email parsed in test mode, the system should extract and display data without creating an inquiry in the database
**Validates: Requirements 8.2**

### Property 28: Test mode field display
*For any* test mode parsing operation, the results should show which fields were successfully extracted
**Validates: Requirements 8.3**

### Property 29: Test mode error display
*For any* test mode parsing operation with errors, the results should display all parsing errors and warnings
**Validates: Requirements 8.4**

### Property 30: Manual sync execution
*For any* manual sync trigger, the system should immediately poll for new emails without waiting for the scheduled interval
**Validates: Requirements 9.2**

### Property 31: Sync status feedback
*For any* manual sync operation in progress, the system should provide real-time status updates
**Validates: Requirements 9.3**

### Property 32: Sync completion results
*For any* completed manual sync, the system should display the number of new inquiries found and created
**Validates: Requirements 9.4**

### Property 33: Sync error messaging
*For any* failed manual sync, the system should display specific error messages indicating the failure reason
**Validates: Requirements 9.5**

### Property 34: Statistics accuracy - total processed
*For any* email connection, the dashboard statistics for total emails processed should equal the count of all processed emails for that connection
**Validates: Requirements 10.1**

### Property 35: Statistics accuracy - successful extractions
*For any* email connection, the dashboard statistics for successful extractions should equal the count of emails that resulted in created inquiries
**Validates: Requirements 10.2**

### Property 36: Statistics accuracy - failed parsing
*For any* email connection, the dashboard statistics for failed parsing should equal the count of emails with processing status 'failed'
**Validates: Requirements 10.3**

### Property 37: Last sync tracking
*For any* email connection, the dashboard should display the timestamp and status of the most recent polling operation
**Validates: Requirements 10.4**

### Property 38: Platform breakdown accuracy
*For any* email connection, the dashboard platform breakdown should correctly group processed emails by identified platform type
**Validates: Requirements 10.5**

## Error Handling

### OAuth and Authentication Errors

- **Authorization Denied**: When user denies OAuth permission, display clear message and allow retry
- **Token Expiration**: Automatically attempt token refresh; notify user only if refresh fails
- **Invalid Credentials**: Mark connection as inactive and prompt user to reconnect
- **API Quota Exceeded**: Implement exponential backoff and notify user of temporary service interruption
- **Network Failures**: Retry with exponential backoff up to 3 attempts; log failures for monitoring

### Email Polling Errors

- **Connection Timeout**: Retry with exponential backoff; skip current poll cycle if timeout persists
- **Rate Limiting**: Respect Gmail API rate limits; adjust polling frequency dynamically if needed
- **Malformed Email Data**: Log error details; skip problematic email and continue processing others
- **Partial Email Retrieval**: Process successfully retrieved emails; retry failed retrievals on next poll

### Parsing Errors

- **Unrecognized Format**: Create inquiry with raw email content; flag for manual review
- **Missing Required Fields**: Create partial inquiry with available data; flag for completion
- **Invalid Data Types**: Use fallback values; log validation errors for pattern improvement
- **HTML Parsing Failures**: Fall back to plain text extraction; preserve original for manual review

### Property Matching Errors

- **Multiple Matches**: Use highest confidence match; flag inquiry for verification
- **No Matches**: Create unmatched inquiry; provide property selection UI for manual assignment
- **Ambiguous Address**: Store all potential matches; prompt user to select correct property

### Integration Errors

- **Workflow Trigger Failure**: Log error; retry workflow initiation; alert if retry fails
- **Database Errors**: Use transactions to maintain consistency; rollback on failure
- **Duplicate Detection Failure**: Check email ID before creating inquiry; skip if already processed

## Testing Strategy

### Unit Testing

Rentema will use Jest as the primary unit testing framework. Unit tests will focus on:

- **OAuth flow components**: Test token exchange, refresh, and revocation logic
- **Email parsing logic**: Test extraction of fields from various email formats
- **Platform matching**: Test pattern matching against different sender/subject combinations
- **Property matching**: Test address matching with various formats and fuzzy matching
- **Filter application**: Test email filtering with different filter configurations
- **Error handling**: Test graceful degradation for various error scenarios
- **Statistics calculation**: Test accuracy of dashboard metrics

Unit tests should mock external dependencies (Gmail API, database) to test logic in isolation.

### Property-Based Testing

Rentema will use **fast-check** as the property-based testing library for TypeScript/Node.js. Property-based tests will verify universal properties across randomly generated inputs.

**Configuration**: Each property-based test should run a minimum of 100 iterations to ensure thorough coverage of the input space.

**Tagging**: Each property-based test MUST include a comment tag explicitly referencing the correctness property from this design document using the format: `**Feature: email-integration, Property {number}: {property_text}**`

**Property Test Coverage**:
- Round-trip properties for token storage (Property 1)
- Connection verification and cleanup (Properties 2, 3, 4)
- Email filtering and deduplication (Properties 5, 6, 19, 20, 21)
- Parsing and extraction (Properties 10, 11, 12, 13, 14)
- Property matching and inquiry creation (Properties 15, 16, 17, 18)
- Source tracking and display (Properties 22, 23, 24, 25, 26)
- Test mode behavior (Properties 27, 28, 29)
- Manual sync operations (Properties 30, 31, 32, 33)
- Statistics accuracy (Properties 34, 35, 36, 37, 38)

Property-based tests should generate realistic random data:
- Valid OAuth tokens with various expiration times
- Email messages with different formats (HTML, plain text, mixed)
- Various sender addresses and subject lines
- Property addresses with different formats
- Filter configurations with various patterns

### Integration Testing

Integration tests will verify:
- End-to-end OAuth flow with Google (using test accounts)
- Email polling and processing pipeline
- Integration with existing Platform Manager and Workflow Orchestrator
- Database operations for storing connections, emails, and inquiries
- Error recovery and retry mechanisms

### Test Mode

The system includes a test mode (Requirement 8) that allows testing email parsing without connecting to Gmail:
- Upload sample emails in various formats
- Test parsing logic without creating inquiries
- Validate extraction patterns for different platforms
- Provide immediate feedback on parsing success/failure

## Implementation Notes

### Security Considerations

- **Token Encryption**: OAuth tokens must be encrypted at rest using AES-256 with unique keys per connection
- **Secure Token Storage**: Store encryption keys separately from encrypted data (use environment variables or key management service)
- **Token Scope Limitation**: Request minimal Gmail API scopes (readonly for email access)
- **HTTPS Only**: All OAuth redirects and API calls must use HTTPS
- **Token Rotation**: Implement automatic token refresh before expiration
- **Audit Logging**: Log all OAuth operations and email access for security monitoring
- **Rate Limiting**: Implement rate limiting on email processing to prevent abuse

### Gmail API Considerations

- **API Quotas**: Gmail API has daily quotas; implement quota monitoring and graceful degradation
- **Batch Operations**: Use batch requests when possible to reduce API calls
- **Partial Responses**: Request only needed fields to reduce bandwidth and improve performance
- **Push Notifications**: Consider Gmail push notifications (Pub/Sub) as alternative to polling for real-time updates
- **History API**: Use Gmail History API for efficient incremental sync instead of full message retrieval

### Scalability Considerations

- **Polling Distribution**: Distribute polling across time to avoid thundering herd
- **Background Jobs**: Use Bull queue for email processing to handle high volumes
- **Database Indexing**: Index email_id, connection_id, and processed_at fields for efficient queries
- **Caching**: Cache platform patterns and filter configurations in Redis
- **Horizontal Scaling**: Design stateless polling service that can be horizontally scaled

### Platform Pattern Management

- **Pattern Storage**: Store platform patterns in database for easy updates without code changes
- **Pattern Priority**: Support priority ordering for patterns to handle overlapping matches
- **Pattern Testing**: Provide UI for testing patterns against sample emails
- **Pattern Versioning**: Track pattern changes for debugging and rollback
- **Community Patterns**: Consider allowing users to share and import patterns

### Property Matching Strategy

- **Fuzzy Matching**: Use Levenshtein distance or similar algorithm for address matching
- **Normalization**: Normalize addresses (remove punctuation, standardize abbreviations) before matching
- **Confidence Thresholds**: Set minimum confidence threshold for automatic matching
- **Learning**: Track manual corrections to improve matching algorithm over time
- **Multiple Properties**: Handle cases where manager has multiple properties at same address

### Monitoring and Observability

- **Polling Metrics**: Track polling frequency, success rate, and latency
- **Parsing Metrics**: Monitor parsing success rate by platform
- **Error Tracking**: Log and alert on parsing failures and API errors
- **Performance Monitoring**: Track email processing time and throughput
- **User Analytics**: Track feature adoption and usage patterns

### Future Enhancements

- **Multi-Provider Support**: Extend to support Outlook, Yahoo, and other email providers
- **Smart Scheduling**: Adjust polling frequency based on inquiry volume patterns
- **ML-Based Parsing**: Use machine learning to improve parsing accuracy over time
- **Automated Pattern Discovery**: Automatically detect new platform email formats
- **Reply Detection**: Parse tenant replies to automated messages
- **Attachment Handling**: Extract information from email attachments (PDFs, images)



## Email-Based Pre-Qualification and Scheduling

### Overview

This extension enables Rentema to send pre-qualification questionnaires and scheduling links via email to prospective tenants who inquire through email. The system automatically evaluates responses, qualifies tenants, and facilitates appointment booking through one-click email links.

### Architecture Extension

```mermaid
graph TB
    subgraph "Email Workflow"
        INQUIRY[Email Inquiry]
        SENDER[Email Sender]
        FORM[Public Questionnaire Form]
        EVAL[Qualification Evaluator]
        SCHED[Scheduling Link Generator]
        BOOK[Appointment Booker]
    end
    
    subgraph "Gmail API"
        SEND[Send Email]
    end
    
    subgraph "Existing Core"
        WF[Workflow Orchestrator]
        QE[Qualification Engine]
        SE[Scheduling Engine]
    end
    
    INQUIRY --> WF
    WF --> SENDER
    SENDER --> SEND
    SEND --> |Email with form link| FORM
    FORM --> |Responses| EVAL
    EVAL --> QE
    QE --> |Qualified| SCHED
    SCHED --> SEND
    SEND --> |Email with time slots| BOOK
    BOOK --> SE
```

### New Components

### 8. Email Sender Service

Sends emails via Gmail API using the connected account.

**Responsibilities:**
- Send emails through Gmail API
- Render email templates with variable substitution
- Track sent emails and delivery status
- Handle sending errors and retries
- Support HTML and plain text formats

**Interface:**
```typescript
interface EmailSenderService {
  sendEmail(params: SendEmailParams): Promise<SentEmail>;
  sendTemplatedEmail(templateType: string, data: TemplateData): Promise<SentEmail>;
  getEmailStatus(emailId: string): Promise<EmailStatus>;
}

interface SendEmailParams {
  connectionId: string;
  to: string;
  subject: string;
  htmlBody: string;
  plainTextBody?: string;
  replyTo?: string;
  inReplyTo?: string; // For threading
}

interface SentEmail {
  id: string;
  messageId: string; // Gmail message ID
  to: string;
  subject: string;
  sentAt: Date;
  status: 'sent' | 'failed';
}

interface TemplateData {
  inquiryId: string;
  tenantName: string;
  propertyAddress: string;
  questionnaireLink?: string;
  availableSlots?: TimeSlot[];
  [key: string]: any;
}
```

### 9. Questionnaire Token Service

Manages secure tokens for public questionnaire access.

**Responsibilities:**
- Generate unique secure tokens for inquiries
- Validate tokens and check expiration
- Track token usage and prevent reuse
- Handle token expiration (7 days default)

**Interface:**
```typescript
interface QuestionnaireTokenService {
  generateToken(inquiryId: string, expiresIn?: number): Promise<QuestionnaireToken>;
  validateToken(token: string): Promise<TokenValidation>;
  markTokenUsed(token: string): Promise<void>;
  regenerateToken(inquiryId: string): Promise<QuestionnaireToken>;
}

interface QuestionnaireToken {
  token: string;
  inquiryId: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

interface TokenValidation {
  isValid: boolean;
  inquiryId?: string;
  error?: 'expired' | 'used' | 'not_found';
}
```

### 10. Public Questionnaire Handler

Serves public questionnaire forms and processes submissions.

**Responsibilities:**
- Serve public questionnaire page (no auth required)
- Load inquiry-specific questions
- Validate form submissions
- Save responses to database
- Trigger qualification evaluation
- Display confirmation to tenant

**Interface:**
```typescript
interface PublicQuestionnaireHandler {
  getQuestionnaire(token: string): Promise<QuestionnaireView>;
  submitQuestionnaire(token: string, responses: QuestionnaireResponses): Promise<SubmissionResult>;
}

interface QuestionnaireView {
  inquiryId: string;
  propertyAddress: string;
  propertyDetails: {
    bedrooms?: number;
    bathrooms?: number;
    rent?: number;
  };
  questions: Question[];
}

interface QuestionnaireResponses {
  responses: Array<{
    questionId: string;
    value: any;
  }>;
}

interface SubmissionResult {
  success: boolean;
  message: string;
  nextStep?: 'qualified' | 'disqualified' | 'pending';
}
```

### 11. Scheduling Link Generator

Generates unique links for appointment booking.

**Responsibilities:**
- Generate available time slots based on manager's schedule
- Create unique booking links for each time slot
- Validate slot availability before generating links
- Handle timezone conversions
- Track link generation and usage

**Interface:**
```typescript
interface SchedulingLinkGenerator {
  generateSchedulingLinks(inquiryId: string, options?: SchedulingOptions): Promise<SchedulingLinks>;
  validateBookingLink(token: string): Promise<BookingLinkValidation>;
  bookAppointment(token: string): Promise<Appointment>;
}

interface SchedulingOptions {
  appointmentType: 'video_call' | 'tour';
  daysAhead?: number; // Default: 7
  minSlotsToShow?: number; // Default: 5
  duration?: number; // Minutes, default: 30
}

interface SchedulingLinks {
  inquiryId: string;
  slots: Array<{
    startTime: Date;
    endTime: Date;
    bookingToken: string;
    bookingUrl: string;
  }>;
  expiresAt: Date;
}

interface BookingLinkValidation {
  isValid: boolean;
  slotInfo?: {
    startTime: Date;
    endTime: Date;
    appointmentType: string;
  };
  error?: 'expired' | 'already_booked' | 'not_found';
}
```

### 12. Email Workflow Orchestrator

Coordinates the email-based qualification and scheduling workflow.

**Responsibilities:**
- Send questionnaire email when inquiry is created
- Process questionnaire submissions
- Evaluate qualification automatically
- Send scheduling email to qualified tenants
- Send rejection email to disqualified tenants
- Track workflow progress and status
- Handle workflow errors and retries

**Interface:**
```typescript
interface EmailWorkflowOrchestrator {
  startEmailWorkflow(inquiryId: string): Promise<void>;
  handleQuestionnaireSubmission(inquiryId: string, responses: QuestionnaireResponses): Promise<void>;
  handleQualificationResult(inquiryId: string, result: QualificationResult): Promise<void>;
  handleAppointmentBooked(inquiryId: string, appointmentId: string): Promise<void>;
  getWorkflowStatus(inquiryId: string): Promise<WorkflowStatus>;
  resendQuestionnaire(inquiryId: string): Promise<void>;
}

interface WorkflowStatus {
  inquiryId: string;
  currentStage: 'questionnaire_sent' | 'questionnaire_completed' | 'qualified' | 'disqualified' | 'scheduling_sent' | 'appointment_booked';
  questionnaireSentAt?: Date;
  questionnaireCompletedAt?: Date;
  qualificationResult?: 'qualified' | 'disqualified';
  schedulingEmailSentAt?: Date;
  appointmentBookedAt?: Date;
  errors: string[];
}
```

## Extended Data Models

### Questionnaire Token

```typescript
interface QuestionnaireToken {
  id: string;
  inquiryId: string;
  token: string; // UUID or secure random string
  expiresAt: Date;
  isUsed: boolean;
  usedAt?: Date;
  createdAt: Date;
}
```

### Sent Email Log

```typescript
interface SentEmailLog {
  id: string;
  inquiryId: string;
  connectionId: string;
  emailType: 'questionnaire' | 'qualified_scheduling' | 'disqualified_rejection' | 'appointment_confirmation';
  to: string;
  subject: string;
  gmailMessageId?: string;
  status: 'sent' | 'failed';
  error?: string;
  sentAt: Date;
}
```

### Booking Token

```typescript
interface BookingToken {
  id: string;
  inquiryId: string;
  token: string;
  slotStartTime: Date;
  slotEndTime: Date;
  appointmentType: 'video_call' | 'tour';
  isUsed: boolean;
  usedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}
```

### Email Template

```typescript
interface EmailTemplate {
  id: string;
  managerId: string;
  templateType: 'questionnaire' | 'qualified_scheduling' | 'disqualified_rejection' | 'appointment_confirmation';
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  variables: string[]; // List of supported variables like {{tenantName}}, {{propertyAddress}}
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Additional Correctness Properties

### Property 39: Questionnaire email sending
*For any* email inquiry that is created, the system should send a questionnaire email with a valid token link
**Validates: Requirements 11.1, 11.2**

### Property 40: Unique token generation
*For any* questionnaire link generated, the token should be unique and not previously used
**Validates: Requirements 11.3**

### Property 41: Token expiration enforcement
*For any* questionnaire token accessed after 7 days, the system should reject it as expired
**Validates: Requirements 18.1, 18.2**

### Property 42: Questionnaire display completeness
*For any* valid questionnaire token, accessing the form should display all configured questions for that property
**Validates: Requirements 12.1, 11.4**

### Property 43: Response validation
*For any* questionnaire submission, all required fields must be completed before acceptance
**Validates: Requirements 12.3**

### Property 44: Response persistence
*For any* submitted questionnaire, all responses should be saved and linked to the inquiry
**Validates: Requirements 12.4**

### Property 45: Automatic qualification evaluation
*For any* completed questionnaire, the system should automatically evaluate responses against qualification criteria
**Validates: Requirements 13.1**

### Property 46: Status update on evaluation
*For any* completed evaluation, the inquiry status should be updated to either "qualified" or "disqualified"
**Validates: Requirements 13.2**

### Property 47: Scheduling trigger on qualification
*For any* tenant marked as qualified, the scheduling workflow should be automatically triggered
**Validates: Requirements 13.3**

### Property 48: Rejection email on disqualification
*For any* tenant marked as disqualified, a polite rejection email should be sent
**Validates: Requirements 13.4**

### Property 49: Available slots generation
*For any* qualified tenant, the scheduling email should contain at least 5 available time slots within the next 7 days
**Validates: Requirements 14.2, 14.3**

### Property 50: Unique booking links
*For any* time slot in a scheduling email, each should have a unique booking token and URL
**Validates: Requirements 14.4**

### Property 51: Slot booking atomicity
*For any* booking link clicked, only one appointment should be created even if clicked multiple times
**Validates: Requirements 15.2**

### Property 52: Booking confirmation emails
*For any* successfully booked appointment, both tenant and manager should receive confirmation emails
**Validates: Requirements 15.3, 15.4**

### Property 53: Slot unavailability after booking
*For any* booked time slot, that slot should not appear in scheduling emails for other tenants
**Validates: Requirements 15.5**

### Property 54: Template variable substitution
*For any* email sent using a template, all variables should be replaced with actual values
**Validates: Requirements 16.5**

### Property 55: Workflow status tracking
*For any* inquiry in the email workflow, the current stage and timestamps should be accurately tracked
**Validates: Requirements 17.1, 17.2, 17.3, 17.4**

### Property 56: Token regeneration
*For any* expired questionnaire link, regenerating should create a new token with a fresh expiration time
**Validates: Requirements 18.5**

## Email Template System

### Template Variables

All email templates support the following variables:

**Common Variables:**
- `{{tenantName}}` - Prospective tenant's name
- `{{propertyAddress}}` - Property address
- `{{managerName}}` - Property manager's name
- `{{managerEmail}}` - Property manager's email
- `{{managerPhone}}` - Property manager's phone

**Questionnaire Email:**
- `{{questionnaireLink}}` - Link to questionnaire form
- `{{expirationDate}}` - When the link expires

**Scheduling Email:**
- `{{timeSlot1}}`, `{{timeSlot2}}`, etc. - Available time slots with booking links
- `{{appointmentType}}` - Type of appointment (video call or tour)

**Appointment Confirmation:**
- `{{appointmentDate}}` - Date of appointment
- `{{appointmentTime}}` - Time of appointment
- `{{appointmentDuration}}` - Duration in minutes
- `{{videoCallLink}}` - Link to video call (if applicable)
- `{{cancellationLink}}` - Link to cancel appointment

### Default Templates

The system provides default templates for each email type:

1. **Questionnaire Email**: Friendly introduction, explanation of pre-qualification, link to form
2. **Qualified Scheduling Email**: Congratulations message, available time slots with one-click booking
3. **Disqualified Rejection Email**: Polite rejection, encouragement to apply for other properties
4. **Appointment Confirmation**: Appointment details, preparation instructions, contact information

## Public Routes

### Questionnaire Routes (No Authentication)

```
GET  /public/questionnaire/:token
POST /public/questionnaire/:token/submit
```

### Booking Routes (No Authentication)

```
GET  /public/booking/:token
POST /public/booking/:token/confirm
```

These routes are publicly accessible and do not require authentication. Security is provided through:
- Unique, unguessable tokens (UUID v4)
- Token expiration (7 days)
- One-time use enforcement
- Rate limiting to prevent abuse

## Integration with Existing Workflow

The email-based workflow integrates with the existing WorkflowOrchestrator:

1. **Inquiry Creation**: When an email inquiry is created, check if it's from email source
2. **Workflow Selection**: If email source, use EmailWorkflowOrchestrator instead of platform messaging
3. **Qualification Engine**: Reuse existing QualificationEngine for evaluation
4. **Scheduling Engine**: Reuse existing SchedulingEngine for slot generation and booking
5. **Status Tracking**: Update inquiry status through existing InquiryRepository

## Security Considerations

### Token Security

- **Token Generation**: Use cryptographically secure random tokens (UUID v4 or better)
- **Token Storage**: Store hashed tokens in database, compare hashes on validation
- **Token Expiration**: Enforce strict expiration (7 days default)
- **One-Time Use**: Mark tokens as used after first successful use
- **Rate Limiting**: Limit token validation attempts to prevent brute force

### Public Form Security

- **CSRF Protection**: Implement CSRF tokens for form submissions
- **Input Validation**: Sanitize all user inputs to prevent XSS
- **Rate Limiting**: Limit form submissions per IP address
- **Captcha**: Consider adding captcha for spam prevention
- **Content Security Policy**: Implement strict CSP headers

### Email Security

- **SPF/DKIM**: Ensure proper email authentication
- **Link Validation**: Validate all links before including in emails
- **Unsubscribe**: Provide unsubscribe mechanism for automated emails
- **Bounce Handling**: Handle bounced emails gracefully

## Performance Considerations

### Email Sending

- **Batch Processing**: Queue emails for batch sending to respect Gmail API limits
- **Retry Logic**: Implement exponential backoff for failed sends
- **Async Processing**: Send emails asynchronously to avoid blocking
- **Template Caching**: Cache compiled templates in memory

### Public Forms

- **CDN**: Serve static form assets via CDN
- **Caching**: Cache questionnaire data with short TTL
- **Database Indexing**: Index token fields for fast lookups
- **Connection Pooling**: Use connection pooling for database queries

### Scheduling Links

- **Slot Caching**: Cache available slots for short periods
- **Concurrent Booking**: Use database locks to prevent double-booking
- **Link Generation**: Generate links on-demand rather than pre-generating

## Testing Strategy Extension

### Additional Unit Tests

- Email template rendering with variable substitution
- Token generation and validation logic
- Questionnaire form validation
- Scheduling link generation
- Booking conflict detection

### Additional Property-Based Tests

- Token uniqueness and expiration (Properties 40, 41)
- Response validation and persistence (Properties 43, 44)
- Qualification evaluation (Properties 45, 46)
- Slot generation and booking (Properties 49, 50, 51, 52, 53)
- Template variable substitution (Property 54)
- Workflow status tracking (Property 55)

### Integration Tests

- End-to-end email workflow from inquiry to appointment
- Public form submission and processing
- Email sending via Gmail API
- Concurrent booking attempts
- Token expiration and regeneration

### User Acceptance Testing

- Test complete workflow with real email addresses
- Verify email deliverability and formatting
- Test mobile responsiveness of public forms
- Validate appointment booking flow
- Test error scenarios and user feedback

## Implementation Priority

### Phase 1: Email Sending Foundation
1. Email Sender Service
2. Email template system
3. Gmail API integration for sending

### Phase 2: Questionnaire System
1. Questionnaire Token Service
2. Public questionnaire form (frontend)
3. Public questionnaire handler (backend)
4. Form submission processing

### Phase 3: Qualification Automation
1. Email Workflow Orchestrator
2. Integration with Qualification Engine
3. Automatic evaluation on submission

### Phase 4: Scheduling System
1. Scheduling Link Generator
2. Booking token management
3. Public booking confirmation page
4. Appointment creation

### Phase 5: Polish and Optimization
1. Email template customization UI
2. Workflow status tracking
3. Error handling and retries
4. Performance optimization
5. Comprehensive testing
