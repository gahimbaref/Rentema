# Requirements Document

## Introduction

The Email Integration feature enables Rentema to automatically capture rental inquiries from email notifications sent by listing platforms (Facebook Marketplace, Zillow, Craigslist, etc.). By monitoring a user's email account, Rentema can extract inquiry details and trigger automated workflows without requiring direct API access to each platform.

## Glossary

- **Email Provider**: The email service (Gmail, Outlook) that the user connects to Rentema
- **Inquiry Email**: An email notification from a listing platform about a prospective tenant inquiry
- **Email Parser**: Component that extracts structured data from inquiry emails
- **OAuth Flow**: Secure authorization process where users grant Rentema permission to access their email
- **Email Polling**: Periodic checking of email account for new inquiry messages
- **Platform Pattern**: Rules for identifying and parsing emails from specific platforms

## Requirements

### Requirement 1

**User Story:** As a property manager, I want to connect my Gmail account to Rentema, so that inquiry emails are automatically captured.

#### Acceptance Criteria

1. WHEN a property manager initiates email connection, THEN Rentema SHALL redirect to Google OAuth authorization
2. WHEN OAuth authorization is granted, THEN Rentema SHALL store the access token securely with encryption
3. WHEN the access token is stored, THEN Rentema SHALL verify email access by reading the user's email address
4. WHEN email connection is established, THEN Rentema SHALL display connection status with the connected email address
5. WHEN a property manager disconnects email, THEN Rentema SHALL revoke the access token and delete stored credentials

### Requirement 2

**User Story:** As a property manager, I want Rentema to automatically check my email for new inquiries, so that I don't miss any potential tenants.

#### Acceptance Criteria

1. WHEN email connection is active, THEN Rentema SHALL poll the email account every 5 minutes for new messages
2. WHEN polling occurs, THEN Rentema SHALL only retrieve unread messages from the last 7 days
3. WHEN new inquiry emails are found, THEN Rentema SHALL mark them as read to prevent duplicate processing
4. WHEN polling fails due to token expiration, THEN Rentema SHALL attempt to refresh the access token automatically
5. WHEN token refresh fails, THEN Rentema SHALL notify the property manager to reconnect their email

### Requirement 3

**User Story:** As a property manager, I want Rentema to recognize inquiry emails from different platforms, so that all my listings are covered.

#### Acceptance Criteria

1. WHEN an email from Facebook Marketplace is detected, THEN Rentema SHALL identify it as a Facebook inquiry
2. WHEN an email from Zillow is detected, THEN Rentema SHALL identify it as a Zillow inquiry
3. WHEN an email from TurboTenant is detected, THEN Rentema SHALL identify it as a TurboTenant inquiry
4. WHEN an email from Craigslist is detected, THEN Rentema SHALL identify it as a Craigslist inquiry
5. WHEN an email cannot be identified as an inquiry, THEN Rentema SHALL skip processing that email
6. Rentema SHALL support adding new platform patterns without code changes through configuration

### Requirement 4

**User Story:** As a property manager, I want Rentema to extract tenant information from inquiry emails, so that inquiries are created automatically.

#### Acceptance Criteria

1. WHEN an inquiry email is parsed, THEN Rentema SHALL extract the prospective tenant's name from the email
2. WHEN an inquiry email is parsed, THEN Rentema SHALL extract the inquiry message content
3. WHEN an inquiry email is parsed, THEN Rentema SHALL extract the property address or listing reference
4. WHEN an inquiry email is parsed, THEN Rentema SHALL extract the tenant's contact information if available
5. WHEN required fields cannot be extracted, THEN Rentema SHALL create an inquiry with available data and flag it for review

### Requirement 5

**User Story:** As a property manager, I want extracted inquiries to match my properties in Rentema, so that automation workflows are triggered correctly.

#### Acceptance Criteria

1. WHEN an inquiry is extracted, THEN Rentema SHALL attempt to match the property address to existing properties
2. WHEN a property match is found, THEN Rentema SHALL create an inquiry linked to that property
3. WHEN no property match is found, THEN Rentema SHALL create an unmatched inquiry for manual assignment
4. WHEN an inquiry is created from email, THEN Rentema SHALL trigger the pre-qualification workflow
5. WHEN an inquiry is created, THEN Rentema SHALL store the original email ID to prevent duplicate processing

### Requirement 6

**User Story:** As a property manager, I want to configure which emails Rentema monitors, so that I can control what gets processed.

#### Acceptance Criteria

1. WHEN configuring email monitoring, THEN Rentema SHALL allow the property manager to specify sender email filters
2. WHEN configuring email monitoring, THEN Rentema SHALL allow the property manager to specify subject line keywords
3. WHEN an email does not match configured filters, THEN Rentema SHALL skip processing that email
4. WHEN filters are updated, THEN Rentema SHALL apply new filters to subsequent email polling
5. Rentema SHALL provide default filters for common rental platforms

### Requirement 7

**User Story:** As a property manager, I want to see which inquiries came from email, so that I can track the source of my leads.

#### Acceptance Criteria

1. WHEN displaying an inquiry, THEN Rentema SHALL indicate if the inquiry originated from email
2. WHEN displaying an inquiry from email, THEN Rentema SHALL show the platform that sent the email
3. WHEN displaying an inquiry from email, THEN Rentema SHALL show the date and time the email was received
4. WHEN viewing inquiry history, THEN Rentema SHALL allow filtering by source type including email
5. WHEN an inquiry has parsing errors, THEN Rentema SHALL display the original email content for manual review

### Requirement 8

**User Story:** As a property manager, I want to test email integration without connecting my real email, so that I can verify it works correctly.

#### Acceptance Criteria

1. WHEN in test mode, THEN Rentema SHALL allow uploading sample inquiry emails for parsing
2. WHEN a sample email is uploaded, THEN Rentema SHALL parse and display extracted data without creating an inquiry
3. WHEN testing email parsing, THEN Rentema SHALL show which fields were successfully extracted
4. WHEN testing email parsing, THEN Rentema SHALL show any parsing errors or warnings
5. Rentema SHALL provide sample inquiry emails from common platforms for testing

### Requirement 9

**User Story:** As a property manager, I want to manually trigger email checking, so that I can immediately process new inquiries without waiting.

#### Acceptance Criteria

1. WHEN viewing email connection settings, THEN Rentema SHALL provide a manual sync button
2. WHEN manual sync is triggered, THEN Rentema SHALL immediately check for new inquiry emails
3. WHEN manual sync is in progress, THEN Rentema SHALL display sync status to the property manager
4. WHEN manual sync completes, THEN Rentema SHALL display the number of new inquiries found
5. WHEN manual sync fails, THEN Rentema SHALL display specific error messages to help troubleshoot

### Requirement 10

**User Story:** As a property manager, I want to see email integration statistics, so that I can understand how well it's working.

#### Acceptance Criteria

1. WHEN viewing email integration dashboard, THEN Rentema SHALL display total emails processed
2. WHEN viewing email integration dashboard, THEN Rentema SHALL display successful inquiry extractions
3. WHEN viewing email integration dashboard, THEN Rentema SHALL display failed parsing attempts
4. WHEN viewing email integration dashboard, THEN Rentema SHALL display last sync time and status
5. WHEN viewing email integration dashboard, THEN Rentema SHALL display breakdown by platform
