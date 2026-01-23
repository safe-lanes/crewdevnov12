import type {
  CrewPreJoiningMedical,
  CrewMedicalAttachment,
  CrewDoctorVisit,
  CrewDoctorVisitAttachment,
} from '@shared/v2/crew-pool/types';

export interface MedicalAttachmentFormData {
  attUuid?: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  filePath: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

export interface MedicalFormData {
  medUuid?: string;
  vesselUuid: string;
  examinationDate: string;
  clinicHospital: string;
  fitForDuty: string;
  expiryDate: string;
  attachments: MedicalAttachmentFormData[];
  isNew?: boolean;
  isDeleted?: boolean;
}

export interface DoctorVisitFormData {
  visitUuid?: string;
  visitDate: string;
  doctorName: string;
  clinicHospital: string;
  reason: string;
  diagnosis: string;
  treatment: string;
  followUpDate: string;
  attachments: MedicalAttachmentFormData[];
  isNew?: boolean;
  isDeleted?: boolean;
}

export type MedicalWithAttachments = CrewPreJoiningMedical & { attachments: CrewMedicalAttachment[] };
export type DoctorVisitWithAttachments = CrewDoctorVisit & { attachments: CrewDoctorVisitAttachment[] };

export function mapMedicalAttachmentToForm(att: CrewMedicalAttachment): MedicalAttachmentFormData {
  return {
    attUuid: att.attUuid,
    fileName: att.fileName || '',
    fileType: att.fileType || '',
    fileSize: att.fileSize || '',
    filePath: att.filePath || '',
  };
}

export function mapMedicalToForm(med: MedicalWithAttachments): MedicalFormData {
  return {
    medUuid: med.medUuid,
    vesselUuid: med.vesselUuid || '',
    examinationDate: med.examinationDate || '',
    clinicHospital: med.clinicHospital || '',
    fitForDuty: med.fitForDuty || '',
    expiryDate: med.expiryDate || '',
    attachments: med.attachments.map(mapMedicalAttachmentToForm),
  };
}

export function mapMedicalsToForm(medicals: MedicalWithAttachments[]): MedicalFormData[] {
  return medicals.map(mapMedicalToForm);
}

export function mapDoctorVisitAttachmentToForm(att: CrewDoctorVisitAttachment): MedicalAttachmentFormData {
  return {
    attUuid: att.attUuid,
    fileName: att.fileName || '',
    fileType: att.fileType || '',
    fileSize: att.fileSize || '',
    filePath: att.filePath || '',
  };
}

export function mapDoctorVisitToForm(visit: DoctorVisitWithAttachments): DoctorVisitFormData {
  return {
    visitUuid: visit.visitUuid,
    visitDate: visit.visitDate || '',
    doctorName: visit.doctorName || '',
    clinicHospital: visit.clinicHospital || '',
    reason: visit.reason || '',
    diagnosis: visit.diagnosis || '',
    treatment: visit.treatment || '',
    followUpDate: visit.followUpDate || '',
    attachments: visit.attachments.map(mapDoctorVisitAttachmentToForm),
  };
}

export function mapDoctorVisitsToForm(visits: DoctorVisitWithAttachments[]): DoctorVisitFormData[] {
  return visits.map(mapDoctorVisitToForm);
}

export function mapFormToMedical(form: MedicalFormData): Partial<CrewPreJoiningMedical> {
  return {
    vesselUuid: form.vesselUuid || undefined,
    examinationDate: form.examinationDate || undefined,
    clinicHospital: form.clinicHospital || undefined,
    fitForDuty: form.fitForDuty || undefined,
    expiryDate: form.expiryDate || undefined,
  };
}

export function mapFormToDoctorVisit(form: DoctorVisitFormData): Partial<CrewDoctorVisit> {
  return {
    visitDate: form.visitDate || undefined,
    doctorName: form.doctorName || undefined,
    clinicHospital: form.clinicHospital || undefined,
    reason: form.reason || undefined,
    diagnosis: form.diagnosis || undefined,
    treatment: form.treatment || undefined,
    followUpDate: form.followUpDate || undefined,
  };
}

export function getEmptyMedicalForm(): MedicalFormData {
  return {
    vesselUuid: '',
    examinationDate: '',
    clinicHospital: '',
    fitForDuty: '',
    expiryDate: '',
    attachments: [],
    isNew: true,
  };
}

export function getEmptyDoctorVisitForm(): DoctorVisitFormData {
  return {
    visitDate: '',
    doctorName: '',
    clinicHospital: '',
    reason: '',
    diagnosis: '',
    treatment: '',
    followUpDate: '',
    attachments: [],
    isNew: true,
  };
}

export function getEmptyMedicalAttachmentForm(): MedicalAttachmentFormData {
  return {
    fileName: '',
    fileType: '',
    fileSize: '',
    filePath: '',
    isNew: true,
  };
}
