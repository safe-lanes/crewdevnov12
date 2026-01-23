import type {
  CrewEducation,
  CrewEducationAttachment,
  CrewLicense,
  CrewLicenseAttachment,
  CrewTrainingCourse,
  CrewTrainingAttachment,
} from '@shared/v2/crew-pool/types';

export interface CertificateAttachmentFormData {
  attUuid?: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  filePath: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

export interface EducationFormData {
  eduUuid?: string;
  dateOfCompletion: string;
  institution: string;
  subjectsField: string;
  qualifications: string;
  attachments: CertificateAttachmentFormData[];
  isNew?: boolean;
  isDeleted?: boolean;
}

export interface LicenseFormData {
  licUuid?: string;
  licenseId: string;
  certificateDocument: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issuingCountryUuid: string;
  issued: string;
  expiry: string;
  attachments: CertificateAttachmentFormData[];
  isNew?: boolean;
  isDeleted?: boolean;
}

export interface TrainingFormData {
  trainUuid?: string;
  courseId: string;
  trainingCourse: string;
  abbr: string;
  requirement: string;
  certificateNo: string;
  issuingAuthority: string;
  issuingCountryUuid: string;
  issued: string;
  expiry: string;
  attachments: CertificateAttachmentFormData[];
  isNew?: boolean;
  isDeleted?: boolean;
}

export type EducationWithAttachments = CrewEducation & { attachments: CrewEducationAttachment[] };
export type LicenseWithAttachments = CrewLicense & { attachments: CrewLicenseAttachment[] };
export type TrainingWithAttachments = CrewTrainingCourse & { attachments: CrewTrainingAttachment[] };

export function mapEducationAttachmentToForm(att: CrewEducationAttachment): CertificateAttachmentFormData {
  return {
    attUuid: att.attUuid,
    fileName: att.fileName || '',
    fileType: att.fileType || '',
    fileSize: att.fileSize || '',
    filePath: att.filePath || '',
  };
}

export function mapEducationToForm(edu: EducationWithAttachments): EducationFormData {
  return {
    eduUuid: edu.eduUuid,
    dateOfCompletion: edu.dateOfCompletion || '',
    institution: edu.institution || '',
    subjectsField: edu.subjectsField || '',
    qualifications: edu.qualifications || '',
    attachments: edu.attachments.map(mapEducationAttachmentToForm),
  };
}

export function mapEducationsToForm(educations: EducationWithAttachments[]): EducationFormData[] {
  return educations.map(mapEducationToForm);
}

export function mapLicenseAttachmentToForm(att: CrewLicenseAttachment): CertificateAttachmentFormData {
  return {
    attUuid: att.attUuid,
    fileName: att.fileName || '',
    fileType: att.fileType || '',
    fileSize: att.fileSize || '',
    filePath: att.filePath || '',
  };
}

export function mapLicenseToForm(lic: LicenseWithAttachments): LicenseFormData {
  return {
    licUuid: lic.licUuid,
    licenseId: lic.licenseId || '',
    certificateDocument: lic.certificateDocument || '',
    abbr: lic.abbr || '',
    requirement: lic.requirement || '',
    certificateNo: lic.certificateNo || '',
    issuingAuthority: lic.issuingAuthority || '',
    issuingCountryUuid: lic.issuingCountryUuid || '',
    issued: lic.issued || '',
    expiry: lic.expiry || '',
    attachments: lic.attachments.map(mapLicenseAttachmentToForm),
  };
}

export function mapLicensesToForm(licenses: LicenseWithAttachments[]): LicenseFormData[] {
  return licenses.map(mapLicenseToForm);
}

export function mapTrainingAttachmentToForm(att: CrewTrainingAttachment): CertificateAttachmentFormData {
  return {
    attUuid: att.attUuid,
    fileName: att.fileName || '',
    fileType: att.fileType || '',
    fileSize: att.fileSize || '',
    filePath: att.filePath || '',
  };
}

export function mapTrainingToForm(train: TrainingWithAttachments): TrainingFormData {
  return {
    trainUuid: train.trainUuid,
    courseId: train.courseId || '',
    trainingCourse: train.trainingCourse || '',
    abbr: train.abbr || '',
    requirement: train.requirement || '',
    certificateNo: train.certificateNo || '',
    issuingAuthority: train.issuingAuthority || '',
    issuingCountryUuid: train.issuingCountryUuid || '',
    issued: train.issued || '',
    expiry: train.expiry || '',
    attachments: train.attachments.map(mapTrainingAttachmentToForm),
  };
}

export function mapTrainingsToForm(trainings: TrainingWithAttachments[]): TrainingFormData[] {
  return trainings.map(mapTrainingToForm);
}

export function mapFormToEducation(form: EducationFormData): Partial<CrewEducation> {
  return {
    dateOfCompletion: form.dateOfCompletion || undefined,
    institution: form.institution || undefined,
    subjectsField: form.subjectsField || undefined,
    qualifications: form.qualifications || undefined,
  };
}

export function mapFormToLicense(form: LicenseFormData): Partial<CrewLicense> {
  return {
    licenseId: form.licenseId || undefined,
    certificateDocument: form.certificateDocument || undefined,
    abbr: form.abbr || undefined,
    requirement: form.requirement || undefined,
    certificateNo: form.certificateNo || undefined,
    issuingAuthority: form.issuingAuthority || undefined,
    issuingCountryUuid: form.issuingCountryUuid || undefined,
    issued: form.issued || undefined,
    expiry: form.expiry || undefined,
  };
}

export function mapFormToTraining(form: TrainingFormData): Partial<CrewTrainingCourse> {
  return {
    courseId: form.courseId || undefined,
    trainingCourse: form.trainingCourse || undefined,
    abbr: form.abbr || undefined,
    requirement: form.requirement || undefined,
    certificateNo: form.certificateNo || undefined,
    issuingAuthority: form.issuingAuthority || undefined,
    issuingCountryUuid: form.issuingCountryUuid || undefined,
    issued: form.issued || undefined,
    expiry: form.expiry || undefined,
  };
}

export function getEmptyEducationForm(): EducationFormData {
  return {
    dateOfCompletion: '',
    institution: '',
    subjectsField: '',
    qualifications: '',
    attachments: [],
    isNew: true,
  };
}

export function getEmptyLicenseForm(): LicenseFormData {
  return {
    licenseId: '',
    certificateDocument: '',
    abbr: '',
    requirement: '',
    certificateNo: '',
    issuingAuthority: '',
    issuingCountryUuid: '',
    issued: '',
    expiry: '',
    attachments: [],
    isNew: true,
  };
}

export function getEmptyTrainingForm(): TrainingFormData {
  return {
    courseId: '',
    trainingCourse: '',
    abbr: '',
    requirement: '',
    certificateNo: '',
    issuingAuthority: '',
    issuingCountryUuid: '',
    issued: '',
    expiry: '',
    attachments: [],
    isNew: true,
  };
}

export function getEmptyCertificateAttachmentForm(): CertificateAttachmentFormData {
  return {
    fileName: '',
    fileType: '',
    fileSize: '',
    filePath: '',
    isNew: true,
  };
}
