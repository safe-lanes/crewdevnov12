export interface TravelDocumentTemplate {
  id: string;
  name: string;
}

export const TRAVEL_DOCUMENT_TEMPLATES: TravelDocumentTemplate[] = [
  { id: 'DOC001', name: 'Passport' },
  { id: 'DOC002', name: "Seaman's Book" },
  { id: 'DOC003', name: "Flag's Seaman Book" },
];

export function mapApiResponseToTravelDocumentTemplates(
  apiResponse: Array<{ entryId?: string; entry_id?: string; name: string }>
): TravelDocumentTemplate[] {
  return apiResponse.map(item => ({
    id: item.entryId || item.entry_id || '',
    name: item.name || '',
  }));
}
