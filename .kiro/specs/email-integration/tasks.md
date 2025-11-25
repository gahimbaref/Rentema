# Implementation Plan

- [x] 1. Set up Gmail API integration and OAuth infrastructure




  - Install googleapis npm package for Gmail API access
  - Configure OAuth 2.0 credentials in Google Cloud Console
  - Create environment variables for OAuth client ID and secret
  - _Requirements: 1.1, 1.2_

- [x] 2. Implement OAuth Manager for Gmail authentication





  - [x] 2.1 Create OAuthManager class with token exchange and storage


    - Implement getAuthorizationUrl() to generate OAuth consent URL
    - Implement exchangeCodeForTokens() to exchange auth code for tokens
    - Implement token encryption using existing encryption utilities
    - Store encrypted tokens in database
    - _Requirements: 1.1, 1.2_


  - [x] 2.2 Write property test for OAuth token round-trip

    - **Property 1: OAuth token storage round-trip**
    - **Validates: Requirements 1.2**


  - [x] 2.3 Implement token refresh and verification

    - Implement refreshAccessToken() with automatic retry logic
    - Implement verifyConnection() to test Gmail API access
    - Handle token expiration and refresh failures
    - _Requirements: 1.3, 2.4, 2.5_

  - [x] 2.4 Write property tests for connection verification and cleanup



    - **Property 2: Email connection verification**
    - **Property 4: Credential cleanup on disconnect**
    - **Validates: Requirements 1.3, 1.5**

  - [x] 2.5 Implement connection management


    - Implement revokeAccess() to disconnect and clean up credentials
    - Create database schema for email_connections table
    - _Requirements: 1.4, 1.5_

- [x] 3. Create database schema for email integration





  - [x] 3.1 Add email_connections table


    - Fields: id, manager_id, email_address, access_token, refresh_token, token_expiry, is_active, last_poll_time, created_at, updated_at
    - Add foreign key to property_managers table
    - _Requirements: 1.2, 1.4_

  - [x] 3.2 Add processed_emails table


    - Fields: id, connection_id, email_id, from, subject, received_date, platform_type, inquiry_id, processing_status, parsing_errors, processed_at
    - Add indexes on email_id and connection_id for efficient lookups
    - _Requirements: 5.5, 7.5_

  - [x] 3.3 Add platform_patterns table


    - Fields: id, platform_type, sender_pattern, subject_pattern, body_patterns, priority, is_active, created_at, updated_at
    - Seed with default patterns for Facebook, Zillow, Craigslist, TurboTenant
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.4 Add email_filter_configs table


    - Fields: id, connection_id, sender_whitelist, subject_keywords, exclude_senders, exclude_subject_keywords, created_at, updated_at
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 3.5 Extend inquiries table for email source tracking


    - Add columns: source_type, source_email_id, source_metadata
    - Add index on source_email_id for duplicate detection
    - _Requirements: 5.5, 7.1, 7.2, 7.3_

- [x] 4. Implement Platform Matcher for email identification





  - [x] 4.1 Create PlatformMatcher class


    - Implement identifyPlatform() using regex pattern matching
    - Load platform patterns from database
    - Return platform type and confidence score
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.2 Write unit tests for platform identification


    - Test Facebook Marketplace email identification
    - Test Zillow email identification
    - Test Craigslist email identification
    - Test TurboTenant email identification
    - Test unknown email handling
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.3 Write property test for unknown email skipping


    - **Property 9: Unknown email skipping**
    - **Validates: Requirements 3.5**

  - [x] 4.4 Implement pattern management methods


    - Implement addPlatformPattern() for adding new patterns
    - Implement getPlatformPatterns() for retrieving patterns
    - Support pattern priority ordering
    - _Requirements: 3.6_

- [ ] 5. Implement Email Parser for data extraction
  - [ ] 5.1 Create EmailParser class with platform-specific parsers
    - Implement parseEmail() dispatcher based on platform type
    - Create parser for Facebook Marketplace emails
    - Create parser for Zillow emails
    - Create parser for Craigslist emails
    - Create parser for TurboTenant emails
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 5.2 Write property tests for field extraction
    - **Property 10: Tenant name extraction**
    - **Property 11: Message content extraction**
    - **Property 12: Property reference extraction**
    - **Property 13: Contact information extraction**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [ ] 5.3 Implement graceful error handling for parsing
    - Handle missing required fields
    - Create partial inquiries with available data
    - Flag inquiries for manual review
    - Store parsing errors
    - _Requirements: 4.5_

  - [ ] 5.4 Write property test for graceful partial parsing
    - **Property 14: Graceful partial parsing**
    - **Validates: Requirements 4.5**

  - [ ] 5.5 Implement testParse() for test mode
    - Parse email without creating inquiry
    - Return extracted fields and errors
    - _Requirements: 8.2, 8.3, 8.4_

- [ ] 6. Implement Property Matcher for linking inquiries
  - [ ] 6.1 Create PropertyMatcher class
    - Implement matchProperty() for reference-based matching
    - Implement matchByAddress() with fuzzy matching
    - Use Levenshtein distance for address similarity
    - Return match confidence scores
    - _Requirements: 5.1, 5.2, 5.3_

  - [ ] 6.2 Write property tests for property matching
    - **Property 15: Property matching attempt**
    - **Property 16: Matched inquiry linking**
    - **Property 17: Unmatched inquiry creation**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [ ] 6.3 Implement address normalization
    - Remove punctuation and extra whitespace
    - Standardize abbreviations (St, Street, Ave, Avenue)
    - Handle case insensitivity
    - _Requirements: 5.1_

- [ ] 7. Implement Email Filter Service
  - [ ] 7.1 Create EmailFilterService class
    - Implement saveFilters() to store filter configuration
    - Implement getFilters() to retrieve filters
    - Implement applyFilters() to check email against filters
    - Implement getDefaultFilters() with common platform senders
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [ ] 7.2 Write property tests for filter application
    - **Property 20: Filter application**
    - **Property 21: Filter update propagation**
    - **Validates: Requirements 6.3, 6.4**

  - [ ] 7.3 Create default filter configurations
    - Add default sender patterns for Facebook, Zillow, Craigslist, TurboTenant
    - Add default subject keywords for rental inquiries
    - _Requirements: 6.5_

- [ ] 8. Implement Email Poller for periodic checking
  - [ ] 8.1 Create EmailPoller class
    - Implement pollNow() to fetch unread emails from last 7 days
    - Use Gmail API messages.list with query filters
    - Implement message retrieval and parsing
    - Mark processed emails as read
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 8.2 Write property tests for polling behavior
    - **Property 5: Poll message filtering**
    - **Property 6: Duplicate prevention through marking**
    - **Validates: Requirements 2.2, 2.3**

  - [ ] 8.3 Implement scheduled polling with node-cron
    - Set up 5-minute polling interval
    - Implement startPolling() and stopPolling()
    - Track polling status and last poll time
    - _Requirements: 2.1_

  - [ ] 8.4 Implement error handling and retry logic
    - Handle token expiration with automatic refresh
    - Implement exponential backoff for failures
    - Track consecutive failures
    - _Requirements: 2.4, 2.5_

  - [ ] 8.5 Write property tests for error handling
    - **Property 7: Token refresh on expiration**
    - **Property 8: Notification on refresh failure**
    - **Validates: Requirements 2.4, 2.5**

- [ ] 9. Implement Email Inquiry Service for orchestration
  - [ ] 9.1 Create EmailInquiryService class
    - Implement processNewEmails() to coordinate polling and parsing
    - Integrate with PlatformMatcher, EmailParser, PropertyMatcher
    - Check for duplicate emails using email_id
    - Create inquiries in database
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 9.2 Write property tests for inquiry creation
    - **Property 18: Workflow trigger on creation**
    - **Property 19: Email ID storage for deduplication**
    - **Validates: Requirements 5.4, 5.5**

  - [ ] 9.3 Implement integration with Workflow Orchestrator
    - Trigger pre-qualification workflow for new inquiries
    - Pass inquiry data to existing workflow
    - _Requirements: 5.4_

  - [ ] 9.4 Implement statistics tracking
    - Track total emails processed
    - Track successful vs failed parsing
    - Track platform breakdown
    - Implement getProcessingStats()
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 9.5 Write property tests for statistics accuracy
    - **Property 34: Statistics accuracy - total processed**
    - **Property 35: Statistics accuracy - successful extractions**
    - **Property 36: Statistics accuracy - failed parsing**
    - **Property 37: Last sync tracking**
    - **Property 38: Platform breakdown accuracy**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

- [ ] 10. Create API endpoints for email integration
  - [ ] 10.1 Create /api/email/connect endpoint
    - POST endpoint to initiate OAuth flow
    - Return authorization URL
    - _Requirements: 1.1_

  - [ ] 10.2 Create /api/email/callback endpoint
    - GET endpoint for OAuth callback
    - Exchange code for tokens
    - Store connection in database
    - _Requirements: 1.2, 1.3_

  - [ ] 10.3 Create /api/email/disconnect endpoint
    - DELETE endpoint to revoke connection
    - Clean up credentials
    - _Requirements: 1.5_

  - [ ] 10.4 Create /api/email/status endpoint
    - GET endpoint to retrieve connection status
    - Return email address and last poll time
    - _Requirements: 1.4, 10.4_

  - [ ] 10.5 Create /api/email/sync endpoint
    - POST endpoint for manual sync
    - Trigger immediate polling
    - Return sync results
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 10.6 Write property tests for manual sync
    - **Property 30: Manual sync execution**
    - **Property 32: Sync completion results**
    - **Property 33: Sync error messaging**
    - **Validates: Requirements 9.2, 9.4, 9.5**

  - [ ] 10.7 Create /api/email/filters endpoint
    - GET/PUT endpoints for filter configuration
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 10.8 Create /api/email/stats endpoint
    - GET endpoint for dashboard statistics
    - Return processing metrics and platform breakdown
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 10.9 Create /api/email/test-parse endpoint
    - POST endpoint for test mode parsing
    - Accept sample email content
    - Return parsed fields without creating inquiry
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ] 10.10 Write property tests for test mode
    - **Property 27: Test mode non-persistence**
    - **Property 28: Test mode field display**
    - **Property 29: Test mode error display**
    - **Validates: Requirements 8.2, 8.3, 8.4**

- [ ] 11. Implement inquiry source tracking and display
  - [ ] 11.1 Update InquiryRepository to handle email source
    - Store source_type, source_email_id, source_metadata
    - Retrieve source information with inquiries
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 11.2 Write property tests for source tracking
    - **Property 22: Email source indication**
    - **Property 23: Platform source display**
    - **Property 24: Email received date tracking**
    - **Property 26: Original email preservation**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.5**

  - [ ] 11.3 Update inquiry filtering to support source type
    - Add source_type filter to inquiry queries
    - _Requirements: 7.4_

  - [ ] 11.4 Write property test for source filtering
    - **Property 25: Source type filtering**
    - **Validates: Requirements 7.4**

- [ ] 12. Create frontend UI for email integration
  - [ ] 12.1 Create EmailConnectionPage component
    - Display connection status and email address
    - Show "Connect Gmail" button when not connected
    - Show "Disconnect" button when connected
    - Display last sync time
    - _Requirements: 1.1, 1.4, 1.5_

  - [ ] 12.2 Create EmailFiltersForm component
    - Form for sender whitelist configuration
    - Form for subject keyword configuration
    - Form for exclusion rules
    - Load and save filter configuration
    - _Requirements: 6.1, 6.2_

  - [ ] 12.3 Create EmailStatsCard component
    - Display total emails processed
    - Display successful vs failed parsing
    - Display platform breakdown chart
    - Display last sync status
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ] 12.4 Create ManualSyncButton component
    - Trigger manual sync on click
    - Show loading state during sync
    - Display sync results in modal
    - Show error messages on failure
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 12.5 Create TestEmailParser component
    - Text area for pasting sample email
    - Parse button to trigger test parsing
    - Display extracted fields
    - Display parsing errors
    - Provide sample emails for testing
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [ ] 12.6 Update InquiryDetailsPage to show email source
    - Display email source indicator
    - Show platform that sent email
    - Show email received date
    - Show original email content for errors
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [ ] 12.7 Update InquiriesPage to support source filtering
    - Add source type filter dropdown
    - Filter inquiries by email source
    - _Requirements: 7.4_

- [ ] 13. Add sample emails and default patterns
  - [ ] 13.1 Create sample email templates
    - Sample Facebook Marketplace inquiry email
    - Sample Zillow inquiry email
    - Sample Craigslist inquiry email
    - Sample TurboTenant inquiry email
    - _Requirements: 8.5_

  - [ ] 13.2 Seed default platform patterns
    - Facebook: sender pattern for facebookmail.com
    - Zillow: sender pattern for zillow.com
    - Craigslist: sender pattern for craigslist.org
    - TurboTenant: sender pattern for turbotenant.com
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.5_

- [ ] 14. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Add monitoring and error tracking
  - [ ] 15.1 Add structured logging for email operations
    - Log OAuth operations with correlation IDs
    - Log polling operations with timing
    - Log parsing successes and failures
    - Log API errors with details
    - _Requirements: All_

  - [ ] 15.2 Implement error notification system
    - Send notifications for token refresh failures
    - Send notifications for consecutive polling failures
    - Send notifications for high parsing failure rates
    - _Requirements: 2.5_

- [ ] 16. Documentation and deployment
  - [ ] 16.1 Update README with email integration setup
    - Document Google Cloud Console setup
    - Document OAuth credential configuration
    - Document environment variables
    - _Requirements: All_

  - [ ] 16.2 Create user guide for email integration
    - How to connect Gmail account
    - How to configure filters
    - How to use test mode
    - How to interpret statistics
    - _Requirements: All_

  - [ ] 16.3 Add database migration scripts
    - Migration for email_connections table
    - Migration for processed_emails table
    - Migration for platform_patterns table
    - Migration for email_filter_configs table
    - Migration for inquiries table updates
    - _Requirements: All_

- [ ] 17. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
