# Rentema Client

React + TypeScript frontend for the Rentema rental automation system.

## Setup

Install dependencies:

```bash
cd client
npm install
```

## Development

Start the development server:

```bash
npm run dev
```

The development server will start on http://localhost:3000 and proxy API requests to http://localhost:5000.

Make sure the backend server is running on port 5000 before starting the client.

## Build

Build for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Preview Production Build

```bash
npm run preview
```

## Project Structure

- `src/api/` - API client and type definitions
  - `client.ts` - Axios client with interceptors
  - `types.ts` - TypeScript interfaces for API data
  - `index.ts` - API endpoint functions
- `src/components/` - Reusable React components
  - `Layout.tsx` - Main layout with navigation
  - `PropertyForm.tsx` - Property create/edit form
  - `PlatformForm.tsx` - Platform connection form
  - `QuestionBuilder.tsx` - Pre-qualification question builder
  - `CriteriaEditor.tsx` - Qualification criteria editor
  - `AvailabilityEditor.tsx` - Availability schedule editor
- `src/pages/` - Page components for each route
  - `PropertiesPage.tsx` - Property list and management
  - `PropertyDetailsPage.tsx` - Individual property details
  - `PlatformsPage.tsx` - Platform connections
  - `QualificationConfigPage.tsx` - Pre-qualification configuration
  - `InquiriesPage.tsx` - Inquiry dashboard with filters
  - `InquiryDetailsPage.tsx` - Inquiry details with conversation history
  - `SchedulingPage.tsx` - Availability and appointments
  - `TemplatesPage.tsx` - Message template editor
  - `TestModePage.tsx` - Test mode interface
- `src/App.tsx` - Main application component with routing
- `src/main.tsx` - Application entry point

## Features

### Property Management
- Create, edit, and archive properties
- View property details
- Configure pre-qualification questions and criteria

### Platform Connections
- Connect to listing platforms (Zillow, TurboTenant, Facebook, Test)
- Verify connections
- Manage platform credentials

### Inquiry Management
- View all inquiries grouped by property
- Filter by property, status, and date range
- View conversation history
- Manual override controls (qualify, disqualify, cancel)
- Add notes to inquiries

### Scheduling
- Set availability for video calls and tours
- Separate schedules for different appointment types
- View and cancel appointments

### Templates
- Edit message templates for all workflow stages
- Insert variables into templates
- Preview templates
- Reset to defaults

### Test Mode
- Create test properties
- Simulate inquiries
- Test workflows without real platform connections
