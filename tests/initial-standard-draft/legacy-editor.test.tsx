import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FormEditor } from "../../client/src/components/FormEditor";
import { PromotionFormEditor } from "../../client/src/components/PromotionFormEditor";
import { openStandardDraft, standardDraftError } from "../../client/src/lib/standardDraftWorkflow";
import { TooltipProvider } from "../../client/src/components/ui/tooltip";
import { FormEditorFactory } from "../../client/src/components/FormEditorFactory";
import { StandardVersionCell } from "../../client/src/modules/admin/components/StandardVersionCell";

const state = vi.hoisted(() => ({ api: vi.fn(), toast: vi.fn(), client: null as any }));
vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: any[]) => state.api(...args),
  queryClient: {
    invalidateQueries: (...args: any[]) => state.client.invalidateQueries(...args),
    setQueryData: (...args: any[]) => state.client.setQueryData(...args),
  },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: state.toast }) }));

let rows: any[], category: string, failEntry: boolean, failSave: boolean, loseEntry: boolean, wrongAck: boolean;
let hold: (() => Promise<void>) | undefined;
const response = (value: unknown) => ({ ok: true, json: async () => structuredClone(value) });
const sourceConfig = () => JSON.stringify(category === "appraisal"
  ? { competenceAssessments: [{ id: "navigation", assessmentCriteria: "Navigation", weight: 100, effectiveness: "" }], behaviouralAssessments: [], trainings: [], targets: [], hiddenFields: [], hiddenSections: [], futureSetting: "keep" }
  : { higherLicenseIds: [], ageMin: 24, ageMax: null, otherCriteria: [], cesTests: [], checklistSections: [], futureSetting: "keep" });
const postCalls = () => state.api.mock.calls.filter(c => c[0] === "POST" && /\/versions$/.test(c[1]));
const releaseCalls = () => state.api.mock.calls.filter(c => c[1].endsWith("/release"));
beforeEach(() => {
  category = "appraisal"; failEntry = failSave = loseEntry = wrongAck = false; hold = undefined;
  rows = [];
  state.toast.mockReset(); state.api.mockReset();
  state.client = new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: 0, queryFn: async ({ queryKey }) => (await state.api("GET", queryKey[0])).json() },
    mutations: { retry: false },
  } });
  state.api.mockImplementation(async (method: string, url: string, body: any) => {
    if (method === "GET") {
      if (url.includes("/rank-groups")) return response([{ id: 7, formId: 99, name: "Deck", configuration: sourceConfig() }]);
      if (url.includes("/forms/99/versions")) return response(rows);
      return response([]);
    }
    if (method === "POST" && /\/versions$/.test(url)) {
      if (body.draftIntent === "open") {
        if (hold) await hold();
        if (failEntry) throw new Error('409: {"error":"Cannot copy internal-version-uuid"}');
        if (!rows.find(v => v.status === "draft")) rows.push({
          ...rows[0], id: 42, fvUuid: "draft-42", versionNo: "10", status: "draft",
        });
        if (loseEntry) { loseEntry = false; throw new Error("Network response lost"); }
      } else {
        if (failSave) throw new Error('400: {"error":"SQL internal-version-uuid"}');
        rows = rows.map(v => v.status === "draft" ? { ...v, ...body } : v);
      }
      const draft = rows.find(v => v.status === "draft");
      return response(wrongAck ? { ...draft, formId: 100 } : draft);
    }
    if (method === "POST" && url.endsWith("/release")) {
      rows = rows.map(v => v.id === 42 ? { ...v, status: "released" } : v);
      return response(rows.find(v => v.id === 42));
    }
    if (method === "DELETE") {
      rows = rows.filter(v => !url.endsWith(`/${v.id}`));
      return response({});
    }
    return response({});
  });
});
afterEach(() => { cleanup(); state.client.clear(); });
function open(kind: string, overrides = {}) {
  category = kind;
  if (!rows.length) rows = [{ id: 41, formId: 99, rankGroupId: 7, fvUuid: "source-41",
    versionNo: "09", versionDate: "01-Nov-2026", status: "released",
    configuration: sourceConfig(), sharedConfig: '{"appraisalTypeOptions":["Annual"],"futureShared":"keep"}' }];
  const Editor = kind === "appraisal" ? FormEditor : PromotionFormEditor;
  const props = { form: { id: 99, category: kind, name: "Fixture", versionNo: "09" } as any,
    rankGroupName: "Deck", useV2: true, onSave: vi.fn(), onClose: vi.fn(), ...overrides };
  const view = render(<QueryClientProvider client={state.client}><TooltipProvider><Editor {...props} /></TooltipProvider></QueryClientProvider>);
  return { ...view, props, Editor };
}
async function enter() {
  const button = await screen.findByRole("button", { name: /Edit as new draft/i });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.click(button);
  return button;
}
const exit = () => screen.getByRole("button", { name: /Exit Config/i });
async function expectReleasedSelection(kind: string) {
  await waitFor(() => {
    const select = screen.getByTestId(kind === "appraisal" ? "select-form-version" : "select-viewing-version");
    if (kind === "promotion") expect((select as HTMLSelectElement).value).toBe("id:41");
    else expect(select.textContent).toContain("Released");
  });
}
async function editVisibleSetting(kind: string) {
  const input = await screen.findByDisplayValue(kind === "appraisal" ? "Navigation" : "24");
  fireEvent.change(input, { target: { value: kind === "appraisal" ? "Updated navigation" : "25" } });
  return input;
}

describe.each(["appraisal", "promotion"])("%s real editor draft acknowledgements", kind => {
  it("opens an explicitly requested release when a same-number draft exists", async () => {
    category = kind;
    rows = [{ id: 41, formId: 99, rankGroupId: 7, fvUuid: "source-41",
      versionNo: "09", versionDate: "01-Nov-2026", status: "released", configuration: sourceConfig() },
      { id: 42, formId: 99, rankGroupId: 7, fvUuid: "draft-42",
        versionNo: "09", versionDate: "02-Nov-2026", status: "draft", configuration: sourceConfig() }];
    open(kind, { initialVersionId: 41 });
    await waitFor(() => expect(screen.getByRole("button", { name: /Edit as new draft/i })).not.toBeDisabled());
    expect(screen.queryByRole("button", { name: /Exit Config/i })).not.toBeInTheDocument();
    expect(postCalls()).toHaveLength(0);
    expect(screen.getByTestId("button-release-version")).toBeDisabled();
    await expectReleasedSelection(kind);
  });
  it("opens the draft selected in the list through the factory without saving it", async () => {
    category = kind;
    rows = [{ id: 41, formId: 99, rankGroupId: 7, fvUuid: "release-41", versionNo: "09",
      versionDate: "01-Nov-2026", status: "released", configuration: sourceConfig() },
      { id: 42, formId: 99, rankGroupId: 7, fvUuid: "draft-42", versionNo: "09",
        versionDate: "02-Nov-2026", status: "draft", configuration: sourceConfig().replace("Navigation", "Draft navigation").replace('"ageMin":24', '"ageMin":25') }];
    function List() {
      const [selected, setSelected] = React.useState<number>();
      const name = kind === "appraisal" ? "Crew Appraisal Form" : "Promotion Review Form";
      return selected === undefined ? <StandardVersionCell versions={rows} rankGroupId={7} onOpenDraft={v => setSelected(v.id)} />
        : <FormEditorFactory form={{ id: 99, name, category: kind } as any} formName={name}
          rankGroupName="Deck" rankGroupId={7} useV2 standardOpening={{ versionId: selected, rankGroupId: 7 }}
          onClose={vi.fn()} onSave={vi.fn()} />;
    }
    render(<QueryClientProvider client={state.client}><TooltipProvider><List /></TooltipProvider></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Open Draft" }));
    await waitFor(() => expect(exit()).not.toBeDisabled());
    await screen.findByDisplayValue(kind === "appraisal" ? "Draft navigation" : "25");
    expect(postCalls()).toHaveLength(0);
  });
  it("keeps explicit selection on refetch and opens historical versions by identity", async () => {
    const view = open(kind, { initialVersionId: 41 });
    await expectReleasedSelection(kind);
    rows.push({ ...rows[0], id: 42, versionNo: "10", status: "draft" });
    await state.client.invalidateQueries();
    await waitFor(() => expect(screen.getByRole("button", { name: /Edit as new draft/i })).not.toBeDisabled());
    expect(screen.queryByRole("button", { name: /Exit Config/i })).not.toBeInTheDocument();
    expect(postCalls()).toHaveLength(0);
    view.unmount();
  });
  it("stops rather than switching drafts if its explicitly selected version disappears", async () => {
    open(kind, { initialVersionId: 41 });
    await expectReleasedSelection(kind);
    rows = [{ ...rows[0], id: 42, versionNo: "10", status: "draft" }];
    await state.client.invalidateQueries();
    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: /Exit Config/i })).not.toBeInTheDocument();
    expect(postCalls()).toHaveLength(0);
  });
  it("keeps explicitly opened archived or read-only contexts non-editable", async () => {
    open(kind, { initialVersionId: 41, readOnly: true });
    await expectReleasedSelection(kind);
    expect(screen.getByRole("button", { name: /Edit as new draft/i })).toBeDisabled();
    expect(screen.getByTestId("button-release-version")).toBeDisabled();
    expect(postCalls()).toHaveLength(0);
  });
  it("preserves confirmed save and release after explicit released-version opening", async () => {
    open(kind, { initialVersionId: 41 });
    await enter();
    await waitFor(() => expect(exit()).not.toBeDisabled());
    await editVisibleSetting(kind);
    fireEvent.click(screen.getByTestId(kind === "appraisal" ? "button-save-draft" : "button-save-form"));
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Draft saved" })));
    fireEvent.click(screen.getByRole("button", { name: /Release Ver/i }));
    await waitFor(() => expect(rows.find(v => v.id === 42).status).toBe("released"));
    await waitFor(() => expect(screen.getByRole("button", { name: /Edit as new draft/i })).not.toBeDisabled());
    expect(screen.queryByRole("button", { name: /Exit Config/i })).not.toBeInTheDocument();
  });
  it("selects a historical released version without a refetch overriding it", async () => {
    const view = open(kind, { initialVersionId: 41 });
    await expectReleasedSelection(kind);
    rows.push({ ...rows[0], id: 43, fvUuid: "release-43", versionNo: "10" });
    await state.client.invalidateQueries();
    if (kind === "promotion") {
      fireEvent.change(screen.getByTestId("select-viewing-version"), { target: { value: "id:43" } });
    } else {
      fireEvent.keyDown(screen.getByTestId("select-form-version"), { key: "ArrowDown" });
      fireEvent.click(await screen.findByRole("option", { name: /v10/ }));
    }
    await state.client.invalidateQueries();
    await waitFor(() => {
      if (kind === "promotion") expect((screen.getByTestId("select-viewing-version") as HTMLSelectElement).value).toBe("id:43");
      else expect(screen.getByTestId("select-form-version").textContent).toContain("v10");
    });
    expect(postCalls()).toHaveLength(0);
    view.unmount();
  });
  it("confirms unsaved changes before leaving an explicitly opened draft", async () => {
    open(kind, { initialVersionId: 41 });
    await enter();
    await waitFor(() => expect(exit()).not.toBeDisabled());
    await editVisibleSetting(kind);
    fireEvent.click(exit());
    await screen.findByText("Leave draft without saving?");
    expect(rows.find(v => v.id === 42).status).toBe("draft");
    expect(releaseCalls()).toHaveLength(0);
  });
  it("returns to the released version after explicitly discarding a saved draft", async () => {
    open(kind, { initialVersionId: 41 });
    await enter();
    await waitFor(() => expect(exit()).not.toBeDisabled());
    fireEvent.click(screen.getByTestId(kind === "appraisal" ? "button-discard-ver" : "button-discard-version"));
    fireEvent.click(await screen.findByRole("button", { name: kind === "appraisal" ? "Yes" : "Discard" }));
    await waitFor(() => expect(rows.some(v => v.id === 42)).toBe(false));
    await expectReleasedSelection(kind);
    expect(rows[0].status).toBe("released");
    expect(releaseCalls()).toHaveLength(0);
  });
  it("waits for acknowledgement, saves, reopens and releases the confirmed draft", async () => {
    let unlock!: () => void;
    hold = () => new Promise<void>(resolve => { unlock = resolve; });
    const view = open(kind);
    const button = await enter();
    fireEvent.click(button);
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    expect(button).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Exit Config/i })).not.toBeInTheDocument();
    hold = undefined; unlock();
    await waitFor(() => expect(exit()).not.toBeDisabled());
    expect(state.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Draft saved" }));
    await editVisibleSetting(kind);
    fireEvent.click(screen.getByTestId(kind === "appraisal" ? "button-save-draft" : "button-save-form"));
    await waitFor(() => expect(postCalls()).toHaveLength(2));
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Draft saved" })));
    expect(JSON.parse(rows[1].configuration).futureSetting).toBe("keep");
    expect(kind === "appraisal" ? JSON.parse(rows[1].configuration).competenceAssessments[0].assessmentCriteria
      : JSON.parse(rows[1].configuration).ageMin).toBe(kind === "appraisal" ? "Updated navigation" : 25);
    expect(JSON.parse(rows[1].sharedConfig).futureShared).toBe("keep");
    expect(JSON.parse(rows[1].sharedConfig).appraisalTypeOptions).toEqual(["Annual"]);
    view.unmount();
    open(kind);
    await waitFor(() => expect(screen.getByRole("button", { name: /Release Ver/i })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: /Release Ver/i }));
    await waitFor(() => expect(releaseCalls()).toHaveLength(1));
    expect(releaseCalls()[0][1]).toContain("/42/release");
    expect(rows[0].status).toBe("released");
    expect(rows[0].versionNo).toBe("09");
    expect(rows[1].status).toBe("released");
  });
  it("keeps the released view and hides raw technical details on entry failure", async () => {
    failEntry = true;
    open(kind); await enter();
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Draft not confirmed" })));
    expect(screen.getByRole("button", { name: /Edit as new draft/i })).not.toBeDisabled();
    expect(screen.queryByRole("button", { name: /Exit Config/i })).not.toBeInTheDocument();
    expect(releaseCalls()).toHaveLength(0);
    expect(JSON.stringify(state.toast.mock.calls)).not.toMatch(/internal-version-uuid|Cannot copy|SQL/);
  });
  it("reconciles a lost creation response without another write", async () => {
    loseEntry = true;
    open(kind); await enter();
    await waitFor(() => expect(exit()).not.toBeDisabled());
    expect(postCalls()).toHaveLength(1);
    expect(rows.filter(v => v.status === "draft")).toHaveLength(1);
  });
  it("does not release a cached draft when saving fails", async () => {
    open(kind); await enter();
    await waitFor(() => expect(exit()).not.toBeDisabled());
    const edited = await editVisibleSetting(kind);
    failSave = true;
    fireEvent.click(screen.getByRole("button", { name: /Release Ver/i }));
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Draft not confirmed" })));
    expect(releaseCalls()).toHaveLength(0);
    expect(rows[1].status).toBe("draft");
    expect((edited as HTMLInputElement).value).toBe(kind === "appraisal" ? "Updated navigation" : "25");
    expect(exit()).not.toBeDisabled();
  });
  it("rejects mismatched save acknowledgement instead of releasing a cached ID", async () => {
    open(kind); await enter();
    await waitFor(() => expect(exit()).not.toBeDisabled());
    wrongAck = true;
    fireEvent.click(screen.getByRole("button", { name: /Release Ver/i }));
    await waitFor(() => expect(state.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Draft not confirmed" })));
    expect(releaseCalls()).toHaveLength(0);
  });
  it("ignores a late creation response after the editor closes", async () => {
    let unlock!: () => void;
    hold = () => new Promise<void>(resolve => { unlock = resolve; });
    const view = open(kind); await enter();
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    view.unmount(); hold = undefined; unlock();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(state.toast).not.toHaveBeenCalled();
    expect(releaseCalls()).toHaveLength(0);
  });
  it("does not apply a late response to another form context", async () => {
    let unlock!: () => void;
    hold = () => new Promise<void>(resolve => { unlock = resolve; });
    const view = open(kind); await enter();
    await waitFor(() => expect(postCalls()).toHaveLength(1));
    view.rerender(<QueryClientProvider client={state.client}><TooltipProvider><view.Editor {...view.props}
      form={{ ...view.props.form, id: 100 }} rankGroupName="Different" /></TooltipProvider></QueryClientProvider>);
    hold = undefined; unlock();
    await new Promise(resolve => setTimeout(resolve, 30));
    expect(state.toast).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Exit Config/i })).not.toBeInTheDocument();
    expect(releaseCalls()).toHaveLength(0);
  });
});
describe("scoped workflow safety", () => {
  it("does not write if authoritative version loading fails", async () => {
    state.api.mockRejectedValue(new Error('403: {"error":"secret-internal"}'));
    await expect(openStandardDraft("/api/v2/admin/forms/99/versions", { formId: 99, rankGroupId: 7 }, () => true)).rejects.toThrow();
    expect(postCalls()).toHaveLength(0);
  });
  it("does not expose raw API details through its error presentation", () => {
    for (const status of [400, 401, 403, 409, 500]) {
      expect(standardDraftError(new Error(`${status}: {"error":"internal-uuid SQL"}`))).not.toMatch(/internal-uuid|SQL|\{/);
    }
  });
});
