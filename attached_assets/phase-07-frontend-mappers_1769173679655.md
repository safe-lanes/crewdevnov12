# Phase 7: Frontend Mappers

## Context
Phases 1-6 are complete. You have:
- Complete backend with API at `/api/v2/crew-pool/...`
- Frontend API layer in `client/src/modules/crew-pool/v2/api/`

## Objective
Create mappers that convert between API response format and form state format. This enables clean separation between API data shape and UI form fields.

## Reference Files (DO NOT MODIFY - use as patterns only)
- Look at existing form components to understand what form fields expect
- `client/src/modules/crew-pool/CrewInfoForm.tsx` - See current form field structure

## Files to Create

### Folder: `client/src/modules/crew-pool/v2/mappers/`

### 1. `crewMembersMapper.ts`

```typescript
import type { CrewMemberV2 } from '@shared/v2/crew-pool/types';

// Form state type (what the UI form uses)
export interface CrewMemberFormData {
  empNo: string;
  employeeId: string;
  firstName: string;
  middleName: string;
  familyName: string;
  gender: string;
  dob: string;  // ISO date string for form
  nationalityUuid: string;
  presentRank: string;
  rankAppliedFor: string;
  status: string;
  reason: string;
  uploadedPhoto: string;
}

// API response → Form data
export function mapCrewMemberToForm(crew: CrewMemberV2): CrewMemberFormData {
  return {
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

// Form data → API request
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

// Empty form state for new crew
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
```

### 2. `crewAssignmentsMapper.ts`

```typescript
import type { CrewAssignment } from '@shared/v2/crew-pool/types';

export interface AssignmentFormData {
  vesselUuid: string;
  isCurrent: boolean;
  signOnDate: string;
  signOffDate: string;
  contractPeriod: string;
  reliefDue: string;
  portOfJoiningUuid: string;
  portOfLeavingUuid: string;
  assignmentType: string;
}

export function mapAssignmentToForm(assignment: CrewAssignment): AssignmentFormData {
  return {
    vesselUuid: assignment.vesselUuid || '',
    isCurrent: assignment.isCurrent || false,
    signOnDate: assignment.signOnDate || '',
    signOffDate: assignment.signOffDate || '',
    contractPeriod: assignment.contractPeriod || '',
    reliefDue: assignment.reliefDue || '',
    portOfJoiningUuid: assignment.portOfJoiningUuid || '',
    portOfLeavingUuid: assignment.portOfLeavingUuid || '',
    assignmentType: assignment.assignmentType || '',
  };
}

export function mapFormToAssignment(form: AssignmentFormData): Partial<CrewAssignment> {
  return {
    vesselUuid: form.vesselUuid || undefined,
    isCurrent: form.isCurrent,
    signOnDate: form.signOnDate || undefined,
    signOffDate: form.signOffDate || undefined,
    contractPeriod: form.contractPeriod || undefined,
    reliefDue: form.reliefDue || undefined,
    portOfJoiningUuid: form.portOfJoiningUuid || undefined,
    portOfLeavingUuid: form.portOfLeavingUuid || undefined,
    assignmentType: form.assignmentType || undefined,
  };
}

export function getEmptyAssignmentForm(): AssignmentFormData {
  return {
    vesselUuid: '',
    isCurrent: false,
    signOnDate: '',
    signOffDate: '',
    contractPeriod: '',
    reliefDue: '',
    portOfJoiningUuid: '',
    portOfLeavingUuid: '',
    assignmentType: '',
  };
}
```

### 3. `personalDetailsMapper.ts`

```typescript
import type { CrewPersonalDetails, CrewAddress } from '@shared/v2/crew-pool/types';

export interface PersonalDetailsFormData {
  height: string;
  weight: string;
  eyeColor: string;
  hairColor: string;
  shoeSize: string;
  boilerSuitSize: string;
  safetyShoeSize: string;
  bloodType: string;
  englishLevel: string;
  additionalLanguages: string;
  religion: string;
}

export interface AddressFormData {
  permanentAddress: string;
  city: string;
  state: string;
  postalCode: string;
  countryUuid: string;
  phoneHome: string;
  phoneMobile: string;
  email: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

export function mapPersonalToForm(personal: CrewPersonalDetails | null): PersonalDetailsFormData {
  return {
    height: personal?.height || '',
    weight: personal?.weight || '',
    eyeColor: personal?.eyeColor || '',
    hairColor: personal?.hairColor || '',
    shoeSize: personal?.shoeSize || '',
    boilerSuitSize: personal?.boilerSuitSize || '',
    safetyShoeSize: personal?.safetyShoeSize || '',
    bloodType: personal?.bloodType || '',
    englishLevel: personal?.englishLevel || '',
    additionalLanguages: personal?.additionalLanguages || '',
    religion: personal?.religion || '',
  };
}

export function mapAddressToForm(address: CrewAddress | null): AddressFormData {
  return {
    permanentAddress: address?.permanentAddress || '',
    city: address?.city || '',
    state: address?.state || '',
    postalCode: address?.postalCode || '',
    countryUuid: address?.countryUuid || '',
    phoneHome: address?.phoneHome || '',
    phoneMobile: address?.phoneMobile || '',
    email: address?.email || '',
    emergencyContactName: address?.emergencyContactName || '',
    emergencyContactPhone: address?.emergencyContactPhone || '',
  };
}

export function mapFormToPersonal(form: PersonalDetailsFormData): Partial<CrewPersonalDetails> {
  return {
    height: form.height || undefined,
    weight: form.weight || undefined,
    eyeColor: form.eyeColor || undefined,
    hairColor: form.hairColor || undefined,
    shoeSize: form.shoeSize || undefined,
    boilerSuitSize: form.boilerSuitSize || undefined,
    safetyShoeSize: form.safetyShoeSize || undefined,
    bloodType: form.bloodType || undefined,
    englishLevel: form.englishLevel || undefined,
    additionalLanguages: form.additionalLanguages || undefined,
    religion: form.religion || undefined,
  };
}

export function mapFormToAddress(form: AddressFormData): Partial<CrewAddress> {
  return {
    permanentAddress: form.permanentAddress || undefined,
    city: form.city || undefined,
    state: form.state || undefined,
    postalCode: form.postalCode || undefined,
    countryUuid: form.countryUuid || undefined,
    phoneHome: form.phoneHome || undefined,
    phoneMobile: form.phoneMobile || undefined,
    email: form.email || undefined,
    emergencyContactName: form.emergencyContactName || undefined,
    emergencyContactPhone: form.emergencyContactPhone || undefined,
  };
}
```

### 4. `documentsMapper.ts` (Pattern for section mappers)

```typescript
import type { CrewDocument, CrewDocumentAttachment } from '@shared/v2/crew-pool/types';

export interface DocumentFormData {
  docUuid?: string;  // Present when editing
  documentType: string;
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  issueCountryUuid: string;
  issuePlace: string;
  remarks: string;
  attachments: AttachmentFormData[];
}

export interface AttachmentFormData {
  attUuid?: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  isNew?: boolean;  // Flag for new attachments not yet saved
}

export type DocumentWithAttachments = CrewDocument & { attachments: CrewDocumentAttachment[] };

export function mapDocumentToForm(doc: DocumentWithAttachments): DocumentFormData {
  return {
    docUuid: doc.docUuid,
    documentType: doc.documentType || '',
    documentNumber: doc.documentNumber || '',
    issueDate: doc.issueDate || '',
    expiryDate: doc.expiryDate || '',
    issueCountryUuid: doc.issueCountryUuid || '',
    issuePlace: doc.issuePlace || '',
    remarks: doc.remarks || '',
    attachments: doc.attachments.map(att => ({
      attUuid: att.attUuid,
      fileName: att.fileName,
      filePath: att.filePath,
      fileType: att.fileType,
      fileSize: att.fileSize,
    })),
  };
}

export function mapFormToDocument(form: DocumentFormData): Partial<CrewDocument> {
  return {
    documentType: form.documentType || undefined,
    documentNumber: form.documentNumber || undefined,
    issueDate: form.issueDate || undefined,
    expiryDate: form.expiryDate || undefined,
    issueCountryUuid: form.issueCountryUuid || undefined,
    issuePlace: form.issuePlace || undefined,
    remarks: form.remarks || undefined,
  };
}

export function getEmptyDocumentForm(): DocumentFormData {
  return {
    documentType: '',
    documentNumber: '',
    issueDate: '',
    expiryDate: '',
    issueCountryUuid: '',
    issuePlace: '',
    remarks: '',
    attachments: [],
  };
}
```

### All Mappers to Create

| File | Converts |
|------|----------|
| `crewMembersMapper.ts` | CrewMemberV2 ↔ Form |
| `crewAssignmentsMapper.ts` | CrewAssignment ↔ Form |
| `personalDetailsMapper.ts` | Personal + Address ↔ Form |
| `familyMapper.ts` | Family + Children + NOK ↔ Form |
| `documentsMapper.ts` | Documents + Attachments ↔ Form |
| `visasMapper.ts` | Visas + Attachments ↔ Form |
| `certificatesMapper.ts` | Education + Licenses + Training ↔ Form |
| `seaServiceMapper.ts` | Sea Service ↔ Form |
| `medicalMapper.ts` | Medicals + Doctor Visits ↔ Form |

### 5. `index.ts`

```typescript
export * from './crewMembersMapper';
export * from './crewAssignmentsMapper';
export * from './personalDetailsMapper';
export * from './familyMapper';
export * from './documentsMapper';
export * from './visasMapper';
export * from './certificatesMapper';
export * from './seaServiceMapper';
export * from './medicalMapper';
```

## Key Patterns

### 1. Always provide default empty strings
```typescript
// API → Form: use empty string for nulls
firstName: crew.firstName || ''

// Form → API: convert empty to undefined  
firstName: form.firstName || undefined
```

### 2. Include UUID in form data for edits
```typescript
export interface DocumentFormData {
  docUuid?: string;  // Present when editing, undefined for new
  // ... other fields
}
```

### 3. Handle attachments separately
```typescript
// Attachments have isNew flag to track unsaved items
attachments: AttachmentFormData[];

interface AttachmentFormData {
  attUuid?: string;  // Present when saved
  isNew?: boolean;   // True for new uploads
  // ... file info
}
```

### 4. Provide empty form factory
```typescript
export function getEmptyDocumentForm(): DocumentFormData {
  return { /* all empty values */ };
}
```

## Validation Steps

1. TypeScript compiles without errors
2. All mappers handle null/undefined gracefully
3. Form types match what UI components expect
4. Empty form factories return valid default state

## DO NOT
- Forget to handle null from API
- Skip the empty form factory functions
- Mix up API types and form types
- Forget to export from index.ts

## Success Criteria
- [ ] 9 mapper files created
- [ ] All handle null/undefined safely
- [ ] Form types defined for each section
- [ ] Empty form factories provided
- [ ] index.ts exports all mappers
