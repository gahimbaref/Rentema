# Rentema Project Structure

## Overview

This document describes the organization of the Rentema codebase.

## Directory Structure

```
rentema/
├── .kiro/                          # Kiro specifications
│   └── specs/
│       └── rental-automation/
│           ├── requirements.md     # Feature requirements (EARS format)
│           ├── design.md          # System design and architecture
│           └── tasks.md           # Implementation task list
│
├── database/                       # Database files
│   ├── schema.sql                 # PostgreSQL schema definition
│   └── README.md                  # Database setup instructions
│
├── src/                           # Source code
│   ├── api/                       # API layer
│   │   └── index.ts              # API routes and controllers
│   │
│   ├── database/                  # Data access layer
│   │   ├── connection.ts         # Database and Redis connections
│   │   └── index.ts              # Database exports
│   │
│   ├── engines/                   # Business logic engines
│   │   └── index.ts              # (To be implemented)
│   │   # Future: PlatformManager, QualificationEngine,
│   │   #         SchedulingEngine, MessagingEngine, etc.
│   │
│   ├── models/                    # Data models and interfaces
│   │   └── index.ts              # (To be implemented)
│   │   # Future: Property, Inquiry, Question, etc.
│   │
│   ├── utils/                     # Utility functions
│   │   └── index.ts              # (To be implemented)
│   │
│   └── index.ts                   # Application entry point
│
├── tests/                         # Test files
│   ├── unit/                      # Unit tests
│   │   └── .gitkeep
│   │
│   ├── integration/               # Integration tests
│   │   └── .gitkeep
│   │
│   ├── property/                  # Property-based tests
│   │   ├── .gitkeep
│   │   └── example.property.test.ts
│   │
│   └── setup.test.ts             # Setup verification tests
│
├── .env.example                   # Example environment variables
├── .gitignore                     # Git ignore rules
├── jest.config.js                 # Jest configuration
├── package.json                   # Node.js dependencies and scripts
├── PROJECT_STRUCTURE.md           # This file
├── README.md                      # Project overview
├── SETUP.md                       # Setup instructions
└── tsconfig.json                  # TypeScript configuration
```

## Key Components (To Be Implemented)

### Engines (Business Logic)

1. **Platform Manager** - Handles integration with listing platforms
2. **Qualification Engine** - Evaluates tenant responses
3. **Scheduling Engine** - Manages appointments and availability
4. **Messaging Engine** - Handles message delivery
5. **Template Engine** - Manages message templates
6. **Workflow Orchestrator** - Coordinates the automation workflow

### Models (Data Structures)

- Property
- Inquiry
- Question
- Response
- Appointment
- Message
- MessageTemplate
- AvailabilitySchedule
- PlatformConnection

### API Layer

RESTful API endpoints for:
- Property management
- Platform connections
- Pre-qualification configuration
- Inquiry management
- Scheduling
- Template management

## Testing Strategy

### Unit Tests (`tests/unit/`)
- Test individual functions and components in isolation
- Mock external dependencies
- Focus on business logic correctness

### Integration Tests (`tests/integration/`)
- Test component interactions
- Use real database connections (test database)
- Verify end-to-end workflows

### Property-Based Tests (`tests/property/`)
- Use fast-check library
- Test universal properties across random inputs
- Minimum 100 iterations per property
- Tag format: `**Feature: rental-automation, Property {number}: {description}**`

## Configuration Files

### `tsconfig.json`
TypeScript compiler configuration with strict mode enabled

### `jest.config.js`
Jest test framework configuration for TypeScript

### `.env.example`
Template for environment variables (copy to `.env`)

### `package.json`
Node.js project configuration with scripts:
- `npm run dev` - Development server
- `npm run build` - Production build
- `npm test` - Run tests
- `npm run test:coverage` - Generate coverage report

## Development Workflow

1. Review task list in `.kiro/specs/rental-automation/tasks.md`
2. Implement features incrementally
3. Write tests (unit + property-based)
4. Verify against requirements and design documents
5. Run tests frequently to ensure correctness

## Next Steps

Follow the implementation plan in `tasks.md` to build out:
1. Data models and database layer
2. Business logic engines
3. API endpoints
4. Dashboard UI
5. Integration with external services
