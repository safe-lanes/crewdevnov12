# Seafarer Performance Management System - Documentation

## Quick Start

This documentation provides comprehensive coverage of the Seafarer Performance Management System (SPMS), a maritime crew management application designed to streamline seafarer and vessel management operations.

## Documentation Index

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture, technology stack, and design patterns |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Complete database schema with 52 tables documented |
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | All 253 API endpoints with request/response formats |
| [BUSINESS_LOGIC.md](./BUSINESS_LOGIC.md) | Business rules, workflows, and feature documentation |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment procedures and environment configuration |
| [TESTING_STRATEGY.md](./TESTING_STRATEGY.md) | Testing approach and coverage analysis |
| [RECOMMENDATIONS.md](./RECOMMENDATIONS.md) | Improvement recommendations and technical debt |

## Project Overview

### Purpose
The Seafarer Performance Management System is a comprehensive maritime crew management platform that:
- Manages seafarer profiles, certifications, and employment records
- Tracks vessel assignments and crew rotations
- Monitors work/rest hours compliance (MLC/STCW regulations)
- Handles crew appraisals and performance reviews
- Manages promotions and career progression
- Tracks training certifications and requirements
- Monitors drugs and alcohol testing compliance
- Supports recruitment and candidate processing

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, shadcn/ui |
| **Data Grid** | AG Grid Enterprise, AG Charts Enterprise |
| **State Management** | TanStack Query v5, Zustand |
| **Forms** | React Hook Form, Zod validation |
| **Routing** | Wouter |
| **Backend** | Express.js, TypeScript |
| **Database** | PostgreSQL with Drizzle ORM |
| **Platform** | Replit (development and deployment) |

### Key Metrics

| Metric | Count |
|--------|-------|
| API Endpoints | 253 |
| Database Tables | 52 |
| Frontend Modules | 13 |
| Lines of Code (Backend Core) | ~20,000 |

## Project Structure

```
project-root/
├── client/                    # Frontend React application
│   └── src/
│       ├── components/        # Reusable UI components
│       │   └── ui/           # shadcn/ui components
│       ├── modules/          # Feature modules
│       │   ├── admin/        # Admin configuration
│       │   ├── crew-pool/    # Crew database management
│       │   ├── crewing/      # Appraisals and crew forms
│       │   ├── drugs-alcohol/# D&A testing
│       │   ├── promotions/   # Promotion management
│       │   ├── recruitment/  # Candidate applications
│       │   ├── rest-hours/   # Work/rest compliance
│       │   ├── rotation/     # Crew rotation planning
│       │   ├── vessel/       # Vessel operations
│       │   └── accounts/     # Wage and payroll (WIP)
│       ├── hooks/            # Custom React hooks
│       ├── stores/           # Zustand state stores
│       ├── lib/              # Utilities and query client
│       └── types/            # TypeScript type definitions
├── server/                   # Backend Express application
│   ├── routes.ts            # API route definitions (~9,900 lines)
│   ├── storage.ts           # Storage interface (~8,300 lines)
│   ├── database.ts          # PostgreSQL database storage
│   ├── complianceEngine.ts  # Oil major compliance logic
│   └── migrationRunner.ts   # Database migration system
├── shared/                   # Shared code between frontend/backend
│   ├── schema.ts            # Drizzle ORM schema (~2,200 lines)
│   ├── crew-mapping.ts      # Crew data transformations
│   └── date-utils.ts        # Date utilities
├── migrations/              # SQL migration files (57 migrations)
└── docs/                    # This documentation folder
```

## Core Concepts

### Module-First Architecture
The application is organized into feature modules, each responsible for a specific domain:
- Each module has its own routes, components, and state
- Modules communicate via shared APIs and stores
- Code splitting via React.lazy() for optimal loading

### Master Data System
Reference data is managed through a centralized master data system:
- **Internal Masters (001-024)**: Managed via Admin module
- **External Masters**: Fetched from SAIL ERP API (nationalities, vessels, etc.)

### Vessel ID Convention
- Backend uses UUID format vessel IDs from Master 014
- Frontend displays human-readable vessel names
- Translation layer converts between formats automatically

### Rest Hours Compliance
Critical maritime compliance feature tracking:
- Daily work/rest hour recordings
- 8 violation types (MLC/STCW regulations)
- Rolling window calculations (24hr, 48hr, 7-day)
- NC (Non-Conformity) report generation

## Getting Started

### Development Environment
```bash
# Start the development server
npm run dev

# Database migrations (if needed)
npm run db:push

# Type checking
npx tsc --noEmit
```

### Environment Variables
Key environment variables (see DEPLOYMENT.md for complete list):
- `DATABASE_URL` - PostgreSQL connection string
- `VITE_AG_GRID_LICENSE_KEY` - AG Grid Enterprise license

## Support

For technical questions or issues:
1. Check the relevant documentation section
2. Review the replit.md file for project-specific notes
3. Check migration files for database-related issues
