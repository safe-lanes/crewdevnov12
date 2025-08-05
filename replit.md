# Seafarer Performance Management System

## Project Overview

A comprehensive seafarer performance management system that leverages advanced form configuration, responsive design, and intuitive user experience for maritime professionals. The system has been refactored to use a module-first architecture for better maintainability and scalability.

## Architecture

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript  
- **Database**: PostgreSQL with Drizzle ORM
- **UI Components**: shadcn/ui + Tailwind CSS
- **Data Tables**: AG Grid Enterprise
- **State Management**: TanStack Query v5
- **Form Management**: React Hook Form + Zod validation
- **Routing**: Wouter

### Module Structure

The application follows a module-first architecture:

```
client/src/
├── app/                    # Application root and routing
├── modules/               # Feature modules
│   ├── crewing/          # Crew management module
│   └── admin/            # Administration module
├── components/           # Shared components
│   ├── common/          # Pure UI components
│   ├── layout/          # Layout components
│   ├── feedback/        # Error handling & loading states
│   ├── form/            # Form field components
│   └── ui/              # shadcn/ui components
├── utils/               # Utility functions
│   ├── data/           # Static data and constants
│   ├── http.ts         # HTTP client
│   ├── format.ts       # Data formatting utilities
│   └── validation.ts   # Common validation functions
├── hooks/              # Global React hooks
├── lib/                # Third-party library configs
├── styles/             # Global styles
└── types/              # Global type definitions
```

## Recent Changes (January 2025)

### Major Refactoring - Module-First Architecture
- **Date**: January 5, 2025
- **Changes**:
  - Restructured entire codebase to module-first architecture
  - Created reusable form components (TextField, SelectField, DateField, TextAreaField)
  - Implemented comprehensive error handling with AppErrorBoundary
  - Added normalized HTTP client with consistent error handling
  - Created crewing module with full CRUD operations
  - Added layout components (Header, PageLayout)
  - Implemented comprehensive validation utilities
  - Added data formatting and utility functions
  - Updated TypeScript path aliases for better imports

### Key Features Implemented
- **Crew Management**: Complete CRUD operations for crew members
- **Performance Ratings**: Visual rating badges with color coding
- **Advanced Filtering**: Search and filter by multiple criteria
- **Form Validation**: Zod-based validation with user-friendly error messages
- **Error Handling**: Global error boundary with retry functionality
- **Loading States**: Consistent loading indicators throughout the app
- **Responsive Design**: Mobile-first approach with responsive tables

## User Preferences

### Code Style
- Use functional components with hooks
- Prefer TypeScript strict mode
- Use async/await over promise chains
- Implement consistent error handling
- Follow naming conventions: PascalCase for components, camelCase for functions

### Communication Style  
- Be concise and professional
- Focus on technical accuracy
- Provide clear implementation details
- Document architectural decisions

## Development Guidelines

### File Organization
- Group related functionality into modules
- Use index.ts files for clean exports
- Keep components focused and reusable
- Separate concerns (validation, API, UI)

### Error Handling
- Use AppErrorBoundary for React error catching
- Implement consistent API error handling
- Provide user-friendly error messages
- Log errors for debugging

### Performance
- Use TanStack Query for data caching
- Implement loading states for better UX
- Optimize AG Grid configurations
- Use React.memo for expensive components

## API Endpoints

### Crew Management
- `GET /api/crew-members` - List crew members with filtering
- `POST /api/crew-members` - Create new crew member
- `GET /api/crew-members/:id` - Get crew member details
- `PATCH /api/crew-members/:id` - Update crew member
- `DELETE /api/crew-members/:id` - Delete crew member

### Appraisals
- `GET /api/appraisals` - List appraisals with filtering
- `POST /api/appraisals` - Create new appraisal
- `GET /api/appraisals/:id` - Get appraisal details
- `PATCH /api/appraisals/:id` - Update appraisal
- `DELETE /api/appraisals/:id` - Delete appraisal

## Database Schema

Key entities:
- `crew_members` - Personnel information
- `appraisal_results` - Performance evaluations
- `forms` - Appraisal form templates
- `users` - System users
- `rank_groups` - Rank classifications

## Deployment

The application is configured for Replit deployment with:
- Automatic workflow management
- Environment variable configuration
- PostgreSQL database integration
- Production-ready error handling

## Future Roadmap

- [ ] Real-time notifications
- [ ] Bulk import/export functionality
- [ ] Advanced reporting dashboard
- [ ] Mobile application
- [ ] Integration with vessel management systems
- [ ] Multi-language support