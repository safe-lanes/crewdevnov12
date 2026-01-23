import type { CrewSeaService, CrewSeaServiceAttachment } from '@shared/v2/crew-pool/types';

export interface SeaServiceAttachmentFormData {
  attUuid?: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  filePath: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

export interface SeaServiceFormData {
  seaUuid?: string;
  serviceType: string;
  vesselName: string;
  vesselUuid: string;
  vesselTypeUuid: string;
  deadweight: string;
  engineTypePower: string;
  ownerOperator: string;
  rank: string;
  fromDate: string;
  toDate: string;
  periodMonths: string;
  experienceCategories: string[];
  attachments: SeaServiceAttachmentFormData[];
  isNew?: boolean;
  isDeleted?: boolean;
}

export type SeaServiceWithAttachments = CrewSeaService & { attachments: CrewSeaServiceAttachment[] };

export function mapSeaServiceAttachmentToForm(att: CrewSeaServiceAttachment): SeaServiceAttachmentFormData {
  return {
    attUuid: att.attUuid,
    fileName: att.fileName || '',
    fileType: att.fileType || '',
    fileSize: att.fileSize || '',
    filePath: att.filePath || '',
  };
}

export function mapSeaServiceToForm(service: SeaServiceWithAttachments): SeaServiceFormData {
  return {
    seaUuid: service.seaUuid,
    serviceType: service.serviceType || '',
    vesselName: service.vesselName || '',
    vesselUuid: service.vesselUuid || '',
    vesselTypeUuid: service.vesselTypeUuid || '',
    deadweight: service.deadweight || '',
    engineTypePower: service.engineTypePower || '',
    ownerOperator: service.ownerOperator || '',
    rank: service.rank || '',
    fromDate: service.fromDate || '',
    toDate: service.toDate || '',
    periodMonths: service.periodMonths || '',
    experienceCategories: service.experienceCategories || [],
    attachments: service.attachments.map(mapSeaServiceAttachmentToForm),
  };
}

export function mapSeaServicesToForm(services: SeaServiceWithAttachments[]): SeaServiceFormData[] {
  return services.map(mapSeaServiceToForm);
}

export function mapFormToSeaService(form: SeaServiceFormData): Partial<CrewSeaService> {
  return {
    serviceType: form.serviceType || undefined,
    vesselName: form.vesselName || undefined,
    vesselUuid: form.vesselUuid || undefined,
    vesselTypeUuid: form.vesselTypeUuid || undefined,
    deadweight: form.deadweight || undefined,
    engineTypePower: form.engineTypePower || undefined,
    ownerOperator: form.ownerOperator || undefined,
    rank: form.rank || undefined,
    fromDate: form.fromDate || undefined,
    toDate: form.toDate || undefined,
    periodMonths: form.periodMonths || undefined,
    experienceCategories: form.experienceCategories.length > 0 ? form.experienceCategories : undefined,
  };
}

export function getEmptySeaServiceForm(): SeaServiceFormData {
  return {
    serviceType: '',
    vesselName: '',
    vesselUuid: '',
    vesselTypeUuid: '',
    deadweight: '',
    engineTypePower: '',
    ownerOperator: '',
    rank: '',
    fromDate: '',
    toDate: '',
    periodMonths: '',
    experienceCategories: [],
    attachments: [],
    isNew: true,
  };
}

export function getEmptySeaServiceAttachmentForm(): SeaServiceAttachmentFormData {
  return {
    fileName: '',
    fileType: '',
    fileSize: '',
    filePath: '',
    isNew: true,
  };
}
