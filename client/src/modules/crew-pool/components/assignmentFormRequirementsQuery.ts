import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type RequirementHistory = { event: string; recorded_at?: string | null; actor_uuid?: string | null; reason?: string | null };
export type AssignmentFormRequirement = {
  requirement_uuid: string;
  form_name: string;
  form_version_uuid: string;
  stage_key: string;
  status: string;
  mandatory: boolean;
  version_no?: string | number | null;
  unresolved_reason?: string | null;
  current_submission_uuid?: string | null;
  history?: RequirementHistory[];
  existing_form?: { submissionUuid: string; origin?: string; status?: string } | null;
};
export type StageCheck = {
  stage_key: string;
  cycle_uuid: string;
  deferred: boolean;
  event_uuid: string;
  outcome: "PENDING" | "FAILED" | "COMPLETED" | "DEFERRED" | string;
  reason?: string | null;
  recorded_at?: string | null;
};
export type StageCheckFailure = { stage_key: string; evidence: unknown };
export type AssignmentFormRequirementsResponse = {
  runs: Array<{ stage_key: string; outcome: string; evidence?: unknown; recorded_at?: string | null; failure_reason?: string | null }>;
  requirements: AssignmentFormRequirement[];
  outstandingEligible: boolean;
  stageChecks?: {
    enforcementEnabled: boolean;
    completedAt: string | null;
    canRetry: boolean;
    stages: StageCheck[];
    failures: StageCheckFailure[];
  };
};

export function assignmentFormRequirementsQuery(subjectRef: string) {
  return {
    queryKey: ["assignment-form-requirements", subjectRef] as const,
    retry: false as const,
    queryFn: async (): Promise<AssignmentFormRequirementsResponse> => (await apiRequest(
      "GET",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${encodeURIComponent(subjectRef)}/requirements`,
    )).json(),
  };
}

export function useAssignmentFormRequirements(subjectRef: string, enabled = Boolean(subjectRef)) {
  return useQuery<AssignmentFormRequirementsResponse>({
    ...assignmentFormRequirementsQuery(subjectRef),
    enabled: enabled && Boolean(subjectRef),
  });
}

export function stageCheckFor(response: AssignmentFormRequirementsResponse | undefined, stageKey: string) {
  return response?.stageChecks?.stages.find((stage) => stage.stage_key === stageKey);
}

export function stageCheckBlocksActions(response: AssignmentFormRequirementsResponse | undefined, stageKey: string) {
  if (!response?.stageChecks?.enforcementEnabled) return false;
  const stage = stageCheckFor(response, stageKey);
  return !stage || stage.deferred || stage.outcome !== "COMPLETED";
}
