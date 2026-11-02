import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

// Execute the actual source handlers, not reimplementations. Their surrounding
// screen dependencies are spies; the real modal is covered in DOM/browser tests.
// This covers cancellation even on screens without registered preview examples.
const cases = [
  ["components/wage/ElementLineRow.tsx", "Are you sure you want to delete", "deleteLine", ["crew", "line"]],
  ["components/company-forms/CompanyFormApplicabilityEditor.tsx", "Changing this mode", "setDraft", ["manual_only"]],
  ["components/company-forms/CompanyFormApplicabilityEditor.tsx", "Discard unsaved applicability", "onSettingsClose", []],
  ["modules/training-retention/components/Training.tsx", "Delete this training need?", "deleteMutation", [{ sourceRefUuid: "need" }]],
  ["components/dialogs/PromotionHierarchyDialog.tsx", "hierarchy?", "deleteMutation", []],
  ["components/form-editor-parts/PartG.tsx", "Enter comment:", "updateTrainingFollowup", []],
  ["modules/recruitment/RecruitmentModule_v2.tsx", "Are you sure you want to delete", "deleteMutation", []],
  ["components/configured-form/CompanyPdfActions.tsx", "Record that this PDF", "runAction", []],
  ["components/configured-form/CompanyPdfActions.tsx", "Record that the void notice", "runAction", []],
  ["modules/vessel/components/ReliefStatusEditDialog_v2.tsx", "Discard unsaved changes?", "onOpenChange", [false]],
  ["modules/admin/AdminModule.tsx", "Are you sure you want to delete the form", "deleteFormMutation", [{ id: 1, name: "Fixture" }]],
  ["modules/admin/AdminModule.tsx", "Existing submissions will stay readable", "archiveCompanyMutation", []],
  ["modules/admin/TrainingEquivalentsEditor.tsx", "switch vessel?", "setActiveVesselId", []],
  ["modules/admin/TrainingEquivalentsEditor.tsx", "view another revision?", "setRevisionUuid", ["revision-next"]],
  ["modules/accounts/pages/WageScalesPage.tsx", "Delete draft", "removeScale", [{ scaleName: "Fixture", scaleUuid: "scale" }]],
  ["modules/accounts/pages/CbaReferencePage.tsx", "Delete CBA reference", "removeReference", [{ cbaName: "Fixture", cbaRefUuid: "cba" }]],
  ["modules/accounts/pages/PayElementsPage.tsx", "This performs a soft-delete.", "removeElement", [{ name: "Fixture", payElementUuid: "pay" }]],
] as const;

function sourceHandler(file: string, marker: string) {
  const fileName = path.resolve("client/src", file);
  const source = ts.createSourceFile(fileName, fs.readFileSync(fileName, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let handler: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ["ask", "requestText"].includes(node.expression.getText(source))
      && node.arguments[0]?.getText(source).includes(marker)) {
      let parent: ts.Node = node;
      while (!ts.isArrowFunction(parent) && !ts.isFunctionExpression(parent)) parent = parent.parent;
      handler = parent;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  if (!handler) throw Error(`Confirmation handler missing: ${file}: ${marker}`);
  const compiled = ts.transpileModule(`exports.handler = (${handler.getText(source)});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React },
  }).outputText;
  return (environment: Record<string, unknown>) => {
    const exports: { handler?: (...args: any[]) => Promise<unknown> } = {};
    // Test-only evaluation with explicit lexical dependencies, never user input.
    new Function("environment", "exports", `with(environment) { ${compiled} }`)(environment, exports);
    return exports.handler!;
  };
}

describe("every converted confirmation/prompt continuation", () => {
  it.each(cases)("%s / %s cancels without touching anything and confirms once", async (file, marker, effectName, args) => {
    const compile = sourceHandler(file, marker);
    for (const accepted of [false, true]) {
      const effect = vi.fn();
      const setters = Object.fromEntries([
        "setDraft", "setSaveError", "onSettingsClose", "setTrainingFollowupComments",
        "updateTrainingFollowup", "onOpenChange", "setActiveVesselId", "setRevisionUuid", "setOpenCourseUuid",
      ].map(name => [name, vi.fn()]));
      const environment: Record<string, any> = {
        ...setters,
        ask: vi.fn().mockResolvedValue(accepted),
        requestText: vi.fn().mockResolvedValue(accepted ? "Updated comment" : null),
        locked: false, saving: false, isDirty: true, dirty: true, formIsDirty: true,
        baseline: "{}", draft: { mode: "conditional", sets: [{ conditions: ["fixture"] }], obligation: "optional", effectiveKind: "specific_date", specificDate: "2030-01-01" },
        line: { id: "line", name: "Fixture" }, crewId: "crew",
        form: { id: 1, name: "Fixture" }, hierarchy: { id: 1, groupName: "Fixture" },
        params: { data: { recCanUuid: "candidate", firstName: "Fixture", familyName: "Candidate", fileNo: "TEST" } },
        followup: { id: "followup", comment: "Original" }, trainingFollowupComments: {},
        status: { fileSha256: "frozen-hash" }, revisionUuid: "old", vesselId: "next", latestVessel: { current: "next" },
        toast: vi.fn(), queryClient: { invalidateQueries: vi.fn() }, LIST_KEY: ["fixture"],
        parseApiError: vi.fn(),
        deleteLine: vi.fn(), runAction: vi.fn(), deleteMutation: { mutate: vi.fn() },
        deleteFormMutation: { mutate: vi.fn() }, archiveCompanyMutation: { mutate: vi.fn() },
        accountsApiV2: { wageScales: { remove: vi.fn() }, cbaReference: { remove: vi.fn() }, payElements: { remove: vi.fn() } },
      };
      if (effectName === "removeScale") environment.accountsApiV2.wageScales.remove = effect;
      else if (effectName === "removeReference") environment.accountsApiV2.cbaReference.remove = effect;
      else if (effectName === "removeElement") environment.accountsApiV2.payElements.remove = effect;
      else if (effectName.endsWith("Mutation")) environment[effectName].mutate = effect;
      else environment[effectName] = effect;
      await compile(environment)(...args);
      expect(environment.ask.mock.calls.length + environment.requestText.mock.calls.length).toBe(1);
      expect(effect).toHaveBeenCalledTimes(accepted ? 1 : 0);
      if (!accepted) {
        for (const setter of Object.values(setters)) expect(setter).not.toHaveBeenCalled();
        expect(environment.toast).not.toHaveBeenCalled();
        expect(environment.queryClient.invalidateQueries).not.toHaveBeenCalled();
      }
    }
  });
});
