// Browser-only verification harness. Loaded by an intercepted document in the
// verifier, never registered as an application route or included in production.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { useAppDialog } from "../../client/src/hooks/use-app-dialog";
import "../../client/src/index.css";

declare global {
  interface Window { dialogReview: any; dialogReviewCase: any }
}

function Review() {
  const { ask, notify, requestText, dialog } = useAppDialog();
  const [outcome, setOutcome] = useState("Not run");
  const entry = window.dialogReviewCase;
  window.dialogReview = {
    start: async () => {
      setOutcome("Waiting for decision");
      const changes: string[] = [];
      const mark = (name: string) => (..._args: unknown[]) => { changes.push(name); };
      const environment = {
        ask, notify, requestText, locked: false, saving: false, isDirty: true, dirty: true, formIsDirty: true,
        baseline: "{}", draft: { mode: "conditional", sets: [{ conditions: ["fixture"] }], obligation: "optional", effectiveKind: "specific_date", specificDate: "2030-01-01" },
        line: { id: "line", name: "Fixture pay element" }, crewId: "crew",
        form: { id: 1, name: "Fixture form" }, hierarchy: { id: 1, groupName: "Fixture hierarchy" },
        params: { data: { recCanUuid: "candidate", firstName: "Fixture", familyName: "Candidate", fileNo: "TEST-001" } },
        followup: { id: "followup", comment: "Existing fixture comment" }, trainingFollowupComments: {},
        status: { fileSha256: "frozen-hash" }, revisionUuid: "old", vesselId: "next", latestVessel: { current: "next" },
        setDraft: mark("draft"), setSaveError: mark("error"), onSettingsClose: mark("close"),
        setTrainingFollowupComments: mark("comments"), updateTrainingFollowup: mark("comment"),
        onOpenChange: mark("open"), setActiveVesselId: mark("vessel"), setRevisionUuid: mark("revision"), setOpenCourseUuid: mark("course"),
        deleteLine: mark("delete"), runAction: mark("handover"), deleteMutation: { mutate: mark("delete") },
        deleteFormMutation: { mutate: mark("delete") }, archiveCompanyMutation: { mutate: mark("archive") },
        accountsApiV2: { wageScales: { remove: mark("delete") }, cbaReference: { remove: mark("delete") }, payElements: { remove: mark("delete") } },
        toast: () => {}, queryClient: { invalidateQueries: () => {} }, LIST_KEY: ["fixture"], parseApiError: () => {},
        title: "Rest Hours",
      };
      const exports: any = {};
      new Function("environment", "exports", `with(environment) { ${entry.compiled} }`)(environment, exports);
      await exports.handler(...entry.args);
      setOutcome(changes.length ? `Confirmed: ${changes.join(", ")}` : "Cancelled: unchanged");
      return changes;
    },
  };
  return <main className="p-8">
    <h1 className="text-xl font-semibold">{entry.screen}</h1>
    <p className="mt-2 text-sm text-slate-600">Isolated client-handler verification. Synthetic values only; no API requests.</p>
    <button className="mt-5 rounded border px-4 py-2" onClick={() => void window.dialogReview.start()}>Open confirmation</button>
    <p role="status" className="mt-4">{outcome}</p>
    {dialog}
  </main>;
}
createRoot(document.getElementById("root")!).render(<Review />);
