import type { CrewAssignment } from '@shared/v2/crew-pool/types';

export interface AssignmentFormData {
  assignUuid?: string;
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
    assignUuid: assignment.assignUuid,
    vesselUuid: assignment.vesselUuid || '',
    isCurrent: assignment.isCurrent || false,
    signOnDate: assignment.signOnDate || '',
    signOffDate: assignment.signOffDate || '',
    contractPeriod: assignment.contractPeriod || '',
    reliefDue: assignment.reliefDue || '',
    portOfJoiningUuid: assignment.portOfJoiningUuid || '',
    portOfLeavingUuid: assignment.portOfLeavingUuid || '',
    assignmentType: assignment.assignmentType || 'primary',
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
    assignmentType: 'primary',
  };
}
