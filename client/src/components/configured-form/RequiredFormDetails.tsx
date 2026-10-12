import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { usePermissions } from "@/contexts/PermissionsContext";
import { ConfiguredFormRenderer } from "./ConfiguredFormRenderer";
import { CompanySubmissionRenderer, mapCompanySubmissionForm } from "./companySubmissionContract";
import { AssignmentFormRequirements } from "@/modules/crew-pool/components/AssignmentFormRequirements";
import { useAssignmentFormRequirements } from "@/modules/crew-pool/components/assignmentFormRequirementsQuery";
import type { CompanyFormSubmissionRenderContract } from "@shared/v2/forms-engine/submissionRenderContract";
import { useState } from "react";

export function RequiredFormDetails({ subjectRef, requirementUuid, onBack }: {
  subjectRef: string; requirementUuid: string; onBack: () => void;
}) {
  const { canCompanyFormAction } = usePermissions();
  const [opened, setOpened] = useState<string | null>(null);
  const requirements = useAssignmentFormRequirements(subjectRef);
  const requirement = requirements.data?.requirements.find(r => r.requirement_uuid === requirementUuid);
  const saved = opened ?? requirement?.current_submission_uuid;
  const definition = useQuery({
    queryKey: ["company-form-pinned-requirement", subjectRef, requirementUuid],
    enabled: canCompanyFormAction("view") && !saved,
    retry: false,
    queryFn: async () => (await (await apiRequest("GET",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${encodeURIComponent(subjectRef)}/requirements/${encodeURIComponent(requirementUuid)}/definition`))
      .json()) as CompanyFormSubmissionRenderContract,
  });
  if (!canCompanyFormAction("view")) return <p>Company Forms View permission is required to open this form.</p>;
  if (saved) return <CompanySubmissionRenderer submissionUuid={saved} onBack={onBack} />;
  if (definition.isLoading) return <p role="status">Loading the pinned form version…</p>;
  if (!definition.data || definition.isError) return <p role="alert">This form could not be loaded. Close this window and retry, or ask the office to review its requirement.</p>;
  try {
    const model = mapCompanySubmissionForm(definition.data);
    return <div className="space-y-3">
      <ConfiguredFormRenderer mode="preview" companyForm formTitle={model.title} formVersionLabel={model.versionLabel}
        subjectType={model.subjectType} parts={model.parts} structures={model.structures} roles={model.roles}
        departments={model.departments} vesselTypes={model.vesselTypes} />
      <AssignmentFormRequirements subjectRef={subjectRef} requirementUuid={requirementUuid}
        stageKey={definition.data.version.stageKey ?? undefined}
        allowStart={canCompanyFormAction("fill_in")} onOpenSubmission={setOpened} />
    </div>;
  } catch {
    return <p role="alert">This pinned form version could not be displayed. Ask the office to review its configuration.</p>;
  }
}
