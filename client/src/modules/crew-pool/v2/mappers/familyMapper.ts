import type { CrewFamilyInfo, CrewChild, CrewNextOfKin } from '@shared/v2/crew-pool/types';

export interface FamilyInfoFormData {
  famUuid?: string;
  maritalStatus: string;
  numDependentChildren: string;
  fatherName: string;
  motherName: string;
  spouseFirstName: string;
  spouseMiddleName: string;
  spouseFamilyName: string;
  spouseDob: string;
}

export interface ChildFormData {
  childUuid?: string;
  firstName: string;
  middleName: string;
  familyName: string;
  dob: string;
  gender: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

export interface NextOfKinFormData {
  nokUuid?: string;
  firstName: string;
  middleName: string;
  familyName: string;
  telephone: string;
  email: string;
  address: string;
  relationship: string;
}

export function mapFamilyToForm(family: CrewFamilyInfo | null): FamilyInfoFormData {
  return {
    famUuid: family?.famUuid,
    maritalStatus: family?.maritalStatus || '',
    numDependentChildren: family?.numDependentChildren || '',
    fatherName: family?.fatherName || '',
    motherName: family?.motherName || '',
    spouseFirstName: family?.spouseFirstName || '',
    spouseMiddleName: family?.spouseMiddleName || '',
    spouseFamilyName: family?.spouseFamilyName || '',
    spouseDob: family?.spouseDob || '',
  };
}

export function mapChildToForm(child: CrewChild): ChildFormData {
  return {
    childUuid: child.childUuid,
    firstName: child.firstName || '',
    middleName: child.middleName || '',
    familyName: child.familyName || '',
    dob: child.dob || '',
    gender: child.gender || '',
  };
}

export function mapChildrenToForm(children: CrewChild[]): ChildFormData[] {
  return children.map(mapChildToForm);
}

export function mapNextOfKinToForm(nok: CrewNextOfKin | null): NextOfKinFormData {
  return {
    nokUuid: nok?.nokUuid,
    firstName: nok?.firstName || '',
    middleName: nok?.middleName || '',
    familyName: nok?.familyName || '',
    telephone: nok?.telephone || '',
    email: nok?.email || '',
    address: nok?.address || '',
    relationship: nok?.relationship || '',
  };
}

export function mapFormToFamily(form: FamilyInfoFormData): Partial<CrewFamilyInfo> {
  return {
    maritalStatus: form.maritalStatus || undefined,
    numDependentChildren: form.numDependentChildren || undefined,
    fatherName: form.fatherName || undefined,
    motherName: form.motherName || undefined,
    spouseFirstName: form.spouseFirstName || undefined,
    spouseMiddleName: form.spouseMiddleName || undefined,
    spouseFamilyName: form.spouseFamilyName || undefined,
    spouseDob: form.spouseDob || undefined,
  };
}

export function mapFormToChild(form: ChildFormData): Partial<CrewChild> {
  return {
    firstName: form.firstName || undefined,
    middleName: form.middleName || undefined,
    familyName: form.familyName || undefined,
    dob: form.dob || undefined,
    gender: form.gender || undefined,
  };
}

export function mapFormToNextOfKin(form: NextOfKinFormData): Partial<CrewNextOfKin> {
  return {
    firstName: form.firstName || undefined,
    middleName: form.middleName || undefined,
    familyName: form.familyName || undefined,
    telephone: form.telephone || undefined,
    email: form.email || undefined,
    address: form.address || undefined,
    relationship: form.relationship || undefined,
  };
}

export function getEmptyFamilyForm(): FamilyInfoFormData {
  return {
    maritalStatus: '',
    numDependentChildren: '',
    fatherName: '',
    motherName: '',
    spouseFirstName: '',
    spouseMiddleName: '',
    spouseFamilyName: '',
    spouseDob: '',
  };
}

export function getEmptyChildForm(): ChildFormData {
  return {
    firstName: '',
    middleName: '',
    familyName: '',
    dob: '',
    gender: '',
    isNew: true,
  };
}

export function getEmptyNextOfKinForm(): NextOfKinFormData {
  return {
    firstName: '',
    middleName: '',
    familyName: '',
    telephone: '',
    email: '',
    address: '',
    relationship: '',
  };
}
