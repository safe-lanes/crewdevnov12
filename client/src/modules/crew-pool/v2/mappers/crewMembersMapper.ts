import type { CrewMemberV2 } from '@shared/v2/crew-pool/types';

export interface CrewMemberFormData {
  crewUuid?: string;
  empNo: string;
  employeeId: string;
  firstName: string;
  middleName: string;
  familyName: string;
  gender: string;
  dob: string;
  nationalityUuid: string;
  presentRank: string;
  rankAppliedFor: string;
  status: string;
  reason: string;
  uploadedPhoto: string;
}

export function mapCrewMemberToForm(crew: CrewMemberV2): CrewMemberFormData {
  return {
    crewUuid: crew.crewUuid,
    empNo: crew.empNo || '',
    employeeId: crew.employeeId || '',
    firstName: crew.firstName || '',
    middleName: crew.middleName || '',
    familyName: crew.familyName || '',
    gender: crew.gender || '',
    dob: crew.dob || '',
    nationalityUuid: crew.nationalityUuid || '',
    presentRank: crew.presentRank || '',
    rankAppliedFor: crew.rankAppliedFor || '',
    status: crew.status || 'active',
    reason: crew.reason || '',
    uploadedPhoto: crew.uploadedPhoto || '',
  };
}

export function mapFormToCrewMember(form: CrewMemberFormData): Partial<CrewMemberV2> {
  return {
    empNo: form.empNo || undefined,
    employeeId: form.employeeId || undefined,
    firstName: form.firstName || undefined,
    middleName: form.middleName || undefined,
    familyName: form.familyName || undefined,
    gender: form.gender || undefined,
    dob: form.dob || undefined,
    nationalityUuid: form.nationalityUuid || undefined,
    presentRank: form.presentRank || undefined,
    rankAppliedFor: form.rankAppliedFor || undefined,
    status: form.status || undefined,
    reason: form.reason || undefined,
    uploadedPhoto: form.uploadedPhoto || undefined,
  };
}

export function getEmptyCrewMemberForm(): CrewMemberFormData {
  return {
    empNo: '',
    employeeId: '',
    firstName: '',
    middleName: '',
    familyName: '',
    gender: '',
    dob: '',
    nationalityUuid: '',
    presentRank: '',
    rankAppliedFor: '',
    status: 'active',
    reason: '',
    uploadedPhoto: '',
  };
}
