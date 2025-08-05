# Crewing Module

The crewing module handles crew member management and their performance appraisals within the seafarer performance management system.

## Overview

This module provides a complete solution for managing crew members including:
- Creating, editing, and viewing crew member profiles
- Managing performance appraisals and ratings
- Searching and filtering crew members
- Bulk operations and data export

## Structure

```
modules/crewing/
├── pages/
│   ├── CrewingListPage.tsx     # Main crew listing and search
│   ├── CrewingAddPage.tsx      # Add new crew member
│   └── CrewingEditPage.tsx     # Edit existing crew member
├── components/
│   ├── CrewForm.tsx            # Reusable crew member form
│   └── CrewTable.tsx           # AG Grid table for crew data
├── services/
│   └── crew.api.ts             # API service functions
├── validation/
│   └── crew.schema.ts          # Zod validation schemas
├── hooks/
│   └── useCrew.ts              # Custom React Query hooks
├── types/
│   └── crew.types.ts           # TypeScript type definitions
├── README.md                   # This file
└── index.ts                    # Module exports
```

## Pages

### CrewingListPage
- Displays all crew members in an AG Grid table
- Provides search and filtering capabilities
- Shows performance ratings and vessel information
- Supports bulk operations

### CrewingAddPage
- Form for creating new crew members
- Validates all required fields
- Integrates with the crew API service

### CrewingEditPage
- Form for updating existing crew members
- Pre-populates with current data
- Prevents editing of crew ID

## Components

### CrewForm
Reusable form component that handles both create and edit scenarios:
- React Hook Form integration
- Zod validation
- Responsive design
- Loading states

### CrewTable
AG Grid-based table with advanced features:
- Sorting and filtering
- Performance rating display
- Action buttons (edit, view, delete)
- Export capabilities

## Data Flow

1. **Data Fetching**: Uses TanStack Query hooks for caching and synchronization
2. **Form Submission**: Validates with Zod schemas before API calls
3. **State Management**: Query client handles optimistic updates and cache invalidation
4. **Error Handling**: Consistent error display with toast notifications

## API Integration

The module communicates with the backend through standardized REST endpoints:
- `GET /api/crew-members` - Fetch crew list
- `POST /api/crew-members` - Create crew member
- `GET /api/crew-members/:id` - Fetch single crew member
- `PATCH /api/crew-members/:id` - Update crew member
- `DELETE /api/crew-members/:id` - Delete crew member

## Validation

Uses Zod schemas for:
- Form validation
- API request validation
- Type safety

## Performance

- Query caching with TanStack Query
- Lazy loading of large datasets
- Optimized AG Grid configuration
- Image optimization for avatars/photos

## Future Enhancements

- Bulk import/export functionality
- Advanced reporting and analytics
- Integration with vessel management
- Mobile-optimized views
- Real-time notifications