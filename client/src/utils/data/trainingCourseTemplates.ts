export interface TrainingCourseTemplate {
  id: string;
  companyId?: string; // Company ID from Admin > Training Matrix > Company
  name: string;
  abbr: string;
  requirement: string;
}

export const TRAINING_COURSE_TEMPLATES: TrainingCourseTemplate[] = [];

export function mapApiResponseToTrainingCourseTemplates(
  apiData: Array<{
    entryId?: string;
    id?: string | number;
    name?: string;
    shortCode?: string;
    description?: string;
  }>
): TrainingCourseTemplate[] {
  return apiData.map((item, index) => ({
    id: item.entryId || item.id?.toString() || `tc-${index + 1}`,
    name: item.name || '',
    abbr: item.shortCode || '',
    requirement: item.description || '',
  }));
}
