/**
 * Crewing module exports
 * Re-exports all public components, hooks, types, and services
 */

// Pages - using original UI components
export { CrewingListPage } from './pages/CrewingListPage';

// Components
export { CrewForm } from './components/CrewForm';
export { CrewTable } from './components/CrewTable';

// Hooks
export * from './hooks/useCrew';

// Services
export * from './services/crew.api';

// Types
export * from './types/crew.types';

// Validation schemas
export { 
  crewMemberSchema, 
  appraisalSchema, 
  crewSearchSchema,
  trainingRecordSchema,
  targetSettingSchema,
  competenceAssessmentSchema,
  behaviouralAssessmentSchema
} from './validation/crew.schema';