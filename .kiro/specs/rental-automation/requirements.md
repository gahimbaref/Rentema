# Requirements Document

## Introduction

Rentema is a customizable application designed to streamline the tenant acquisition process across multiple rental listing platforms (Zillow, TurboTenant, Facebook Marketplace, etc.). The system automates pre-qualification messaging, video call scheduling, and property tour coordination to help property managers efficiently screen and schedule prospective tenants without manual intervention for each inquiry.

## Glossary

- **Rentema**: The application that manages automated tenant communications and scheduling
- **Listing Platform**: External services where rental properties are advertised (e.g., Zillow, TurboTenant, Facebook Marketplace)
- **Prospective Tenant**: An individual who has expressed interest in renting a property
- **Pre-qualification**: The process of collecting basic tenant information to determine rental eligibility
- **Property Manager**: The user of the system who owns or manages rental properties
- **Tour**: An in-person or virtual showing of a rental property
- **Video Call**: A scheduled Zoom or similar video conference with a prospective tenant

## Requirements

### Requirement 1

**User Story:** As a property manager, I want to connect multiple listing platforms to the system, so that I can manage all tenant inquiries from a single interface.

#### Acceptance Criteria

1. WHEN a property manager adds a new listing platform connection, THEN Rentema SHALL store the platform credentials securely
2. WHEN a listing platform is connected, THEN Rentema SHALL verify the connection status and display confirmation to the property manager
3. WHEN multiple platforms are connected, THEN Rentema SHALL maintain separate configurations for each platform
4. WHEN a platform connection fails, THEN Rentema SHALL notify the property manager with specific error details

### Requirement 2

**User Story:** As a property manager, I want to create and manage property listings within the system, so that I can associate automated workflows with specific properties.

#### Acceptance Criteria

1. WHEN a property manager creates a new property listing, THEN Rentema SHALL store property details including address, rent amount, bedrooms, bathrooms, and availability date
2. WHEN a property listing is created, THEN Rentema SHALL assign a unique identifier to the property
3. WHEN a property manager updates property details, THEN Rentema SHALL persist the changes immediately
4. WHEN a property manager deletes a property, THEN Rentema SHALL archive the property and associated inquiry history rather than permanently removing data

### Requirement 3

**User Story:** As a property manager, I want to customize pre-qualification questions for each property, so that I can collect relevant information based on specific property requirements.

#### Acceptance Criteria

1. WHEN a property manager defines pre-qualification questions, THEN Rentema SHALL store the questions with their expected response types (text, number, yes/no, multiple choice)
2. WHEN pre-qualification questions are saved, THEN Rentema SHALL associate them with the specific property
3. WHEN a property manager edits pre-qualification questions, THEN Rentema SHALL apply changes only to new inquiries while preserving historical responses
4. Rentema SHALL support at least ten customizable questions per property

### Requirement 4

**User Story:** As a property manager, I want the system to automatically send pre-qualification messages to new inquiries, so that I can screen tenants without manual intervention.

#### Acceptance Criteria

1. WHEN a new inquiry is received from any connected listing platform, THEN Rentema SHALL detect the inquiry within five minutes
2. WHEN an inquiry is detected, THEN Rentema SHALL send the first pre-qualification question to the prospective tenant through the originating platform
3. WHEN a prospective tenant responds to a question, THEN Rentema SHALL send the next question in the sequence within two minutes
4. WHEN all pre-qualification questions are answered, THEN Rentema SHALL store the complete response set with timestamps
5. IF a prospective tenant does not respond within 24 hours, THEN Rentema SHALL send a follow-up reminder message

### Requirement 5

**User Story:** As a property manager, I want to define qualification criteria that automatically evaluate tenant responses, so that I can focus only on qualified candidates.

#### Acceptance Criteria

1. WHEN a property manager sets qualification criteria, THEN Rentema SHALL store rules that evaluate tenant responses (e.g., minimum income, credit score threshold, no eviction history)
2. WHEN all pre-qualification responses are collected, THEN Rentema SHALL evaluate the responses against the qualification criteria
3. WHEN a prospective tenant meets all qualification criteria, THEN Rentema SHALL mark the inquiry as qualified
4. WHEN a prospective tenant fails any qualification criterion, THEN Rentema SHALL mark the inquiry as disqualified and send a polite rejection message
5. WHEN an inquiry is marked as qualified, THEN Rentema SHALL notify the property manager

### Requirement 6

**User Story:** As a property manager, I want the system to automatically schedule video calls with qualified tenants, so that I can conduct initial screenings efficiently.

#### Acceptance Criteria

1. WHEN a prospective tenant is marked as qualified, THEN Rentema SHALL send a message offering available video call time slots
2. WHEN a prospective tenant selects a time slot, THEN Rentema SHALL create a Zoom meeting and send calendar invitations to both parties
3. WHEN a video call is scheduled, THEN Rentema SHALL store the meeting details including date, time, and Zoom link
4. WHEN a scheduled video call is within 24 hours, THEN Rentema SHALL send reminder messages to both the property manager and prospective tenant
5. IF a time slot conflict occurs, THEN Rentema SHALL prevent double-booking and offer alternative times

### Requirement 7

**User Story:** As a property manager, I want to schedule property tours with prospective tenants, so that I can show properties to interested and qualified candidates.

#### Acceptance Criteria

1. WHEN a property manager enables tour scheduling for a property, THEN Rentema SHALL allow prospective tenants to request tour appointments
2. WHEN a prospective tenant requests a tour, THEN Rentema SHALL present available time slots based on the property manager's availability calendar
3. WHEN a tour is scheduled, THEN Rentema SHALL send confirmation messages with property address and appointment details to both parties
4. WHEN a tour is scheduled, THEN Rentema SHALL add the appointment to the property manager's calendar
5. WHEN a tour is within two hours of the scheduled time, THEN Rentema SHALL send reminder notifications to both parties

### Requirement 8

**User Story:** As a property manager, I want to view and manage all tenant inquiries in a centralized dashboard, so that I can track the status of each prospective tenant.

#### Acceptance Criteria

1. WHEN a property manager accesses the dashboard, THEN Rentema SHALL display all inquiries grouped by property
2. WHEN displaying inquiries, THEN Rentema SHALL show inquiry status (new, pre-qualifying, qualified, disqualified, scheduled, toured)
3. WHEN a property manager selects an inquiry, THEN Rentema SHALL display the complete conversation history and collected responses
4. WHEN a property manager filters inquiries, THEN Rentema SHALL support filtering by property, status, and date range
5. Rentema SHALL update inquiry statuses in real-time as automated workflows progress

### Requirement 9

**User Story:** As a property manager, I want to manually override automated decisions, so that I can handle special cases or exceptions.

#### Acceptance Criteria

1. WHEN a property manager views a disqualified inquiry, THEN Rentema SHALL provide an option to manually mark the inquiry as qualified
2. WHEN a property manager manually qualifies an inquiry, THEN Rentema SHALL proceed with the automated scheduling workflow
3. WHEN a property manager cancels a scheduled appointment, THEN Rentema SHALL send cancellation notifications to the prospective tenant
4. WHEN a property manager adds notes to an inquiry, THEN Rentema SHALL store and display the notes with timestamps

### Requirement 10

**User Story:** As a property manager, I want to customize message templates for each automation stage, so that I can maintain my preferred communication style and branding.

#### Acceptance Criteria

1. WHEN a property manager edits a message template, THEN Rentema SHALL support template variables for personalization (tenant name, property address, time slots)
2. WHEN a message template is saved, THEN Rentema SHALL validate that all required template variables are present
3. WHEN the system sends automated messages, THEN Rentema SHALL replace template variables with actual values
4. Rentema SHALL provide default templates for pre-qualification, scheduling, reminders, and rejection messages
5. WHEN a property manager resets a template, THEN Rentema SHALL restore the default template content

### Requirement 11

**User Story:** As a property manager, I want to set my availability for video calls and tours, so that the system only offers time slots when I am available.

#### Acceptance Criteria

1. WHEN a property manager defines availability, THEN Rentema SHALL store recurring weekly schedules with specific time blocks
2. WHEN a property manager blocks specific dates or times, THEN Rentema SHALL exclude those periods from available scheduling options
3. WHEN generating available time slots, THEN Rentema SHALL only offer times that fall within the property manager's availability
4. WHEN a property manager updates availability, THEN Rentema SHALL apply changes to future scheduling requests immediately
5. Rentema SHALL support different availability schedules for video calls versus property tours

### Requirement 12

**User Story:** As a property manager, I want the system to work even when I have no active rental properties, so that I can configure and test the system before acquiring properties.

#### Acceptance Criteria

1. WHEN a property manager has zero properties, THEN Rentema SHALL allow creation of test or placeholder properties
2. WHEN using test properties, THEN Rentema SHALL support all configuration features including pre-qualification questions and message templates
3. WHEN a property manager simulates an inquiry, THEN Rentema SHALL execute the complete automated workflow without requiring actual platform connections
4. Rentema SHALL clearly distinguish between test mode and production mode operations
