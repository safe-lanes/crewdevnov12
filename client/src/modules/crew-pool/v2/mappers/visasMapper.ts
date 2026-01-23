import type { CrewVisa, CrewVisaAttachment } from '@shared/v2/crew-pool/types';

export interface VisaAttachmentFormData {
  attUuid?: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  filePath: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

export interface VisaFormData {
  visaUuid?: string;
  countryUuid: string;
  serialNo: string;
  issued: string;
  expiry: string;
  visaType: string;
  attachments: VisaAttachmentFormData[];
  isNew?: boolean;
  isDeleted?: boolean;
}

export type VisaWithAttachments = CrewVisa & { attachments: CrewVisaAttachment[] };

export function mapVisaAttachmentToForm(att: CrewVisaAttachment): VisaAttachmentFormData {
  return {
    attUuid: att.attUuid,
    fileName: att.fileName || '',
    fileType: att.fileType || '',
    fileSize: att.fileSize || '',
    filePath: att.filePath || '',
  };
}

export function mapVisaToForm(visa: VisaWithAttachments): VisaFormData {
  return {
    visaUuid: visa.visaUuid,
    countryUuid: visa.countryUuid || '',
    serialNo: visa.serialNo || '',
    issued: visa.issued || '',
    expiry: visa.expiry || '',
    visaType: visa.visaType || '',
    attachments: visa.attachments.map(mapVisaAttachmentToForm),
  };
}

export function mapVisasToForm(visas: VisaWithAttachments[]): VisaFormData[] {
  return visas.map(mapVisaToForm);
}

export function mapFormToVisa(form: VisaFormData): Partial<CrewVisa> {
  return {
    countryUuid: form.countryUuid || undefined,
    serialNo: form.serialNo || undefined,
    issued: form.issued || undefined,
    expiry: form.expiry || undefined,
    visaType: form.visaType || undefined,
  };
}

export function getEmptyVisaForm(): VisaFormData {
  return {
    countryUuid: '',
    serialNo: '',
    issued: '',
    expiry: '',
    visaType: '',
    attachments: [],
    isNew: true,
  };
}

export function getEmptyVisaAttachmentForm(): VisaAttachmentFormData {
  return {
    fileName: '',
    fileType: '',
    fileSize: '',
    filePath: '',
    isNew: true,
  };
}
