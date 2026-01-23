import type { CrewDocument, CrewDocumentAttachment } from '@shared/v2/crew-pool/types';

export interface AttachmentFormData {
  attUuid?: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  filePath: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

export interface DocumentFormData {
  docUuid?: string;
  documentId: string;
  documentName: string;
  number: string;
  issued: string;
  expiry: string;
  issuingAuthority: string;
  issuingCountryUuid: string;
  attachments: AttachmentFormData[];
  isNew?: boolean;
  isDeleted?: boolean;
}

export type DocumentWithAttachments = CrewDocument & { attachments: CrewDocumentAttachment[] };

export function mapAttachmentToForm(att: CrewDocumentAttachment): AttachmentFormData {
  return {
    attUuid: att.attUuid,
    fileName: att.fileName || '',
    fileType: att.fileType || '',
    fileSize: att.fileSize || '',
    filePath: att.filePath || '',
  };
}

export function mapDocumentToForm(doc: DocumentWithAttachments): DocumentFormData {
  return {
    docUuid: doc.docUuid,
    documentId: doc.documentId || '',
    documentName: doc.documentName || '',
    number: doc.number || '',
    issued: doc.issued || '',
    expiry: doc.expiry || '',
    issuingAuthority: doc.issuingAuthority || '',
    issuingCountryUuid: doc.issuingCountryUuid || '',
    attachments: doc.attachments.map(mapAttachmentToForm),
  };
}

export function mapDocumentsToForm(docs: DocumentWithAttachments[]): DocumentFormData[] {
  return docs.map(mapDocumentToForm);
}

export function mapFormToDocument(form: DocumentFormData): Partial<CrewDocument> {
  return {
    documentId: form.documentId || undefined,
    documentName: form.documentName || undefined,
    number: form.number || undefined,
    issued: form.issued || undefined,
    expiry: form.expiry || undefined,
    issuingAuthority: form.issuingAuthority || undefined,
    issuingCountryUuid: form.issuingCountryUuid || undefined,
  };
}

export function getEmptyDocumentForm(): DocumentFormData {
  return {
    documentId: '',
    documentName: '',
    number: '',
    issued: '',
    expiry: '',
    issuingAuthority: '',
    issuingCountryUuid: '',
    attachments: [],
    isNew: true,
  };
}

export function getEmptyAttachmentForm(): AttachmentFormData {
  return {
    fileName: '',
    fileType: '',
    fileSize: '',
    filePath: '',
    isNew: true,
  };
}
