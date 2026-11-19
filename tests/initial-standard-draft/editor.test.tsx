import React, { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GenericFormEditor } from "../../client/src/components/GenericFormEditor";
import { FormEditorFactory } from "../../client/src/components/FormEditorFactory";
import { standardInitialVersionLabel } from "../../client/src/modules/admin/formsListVersions";
import { StandardVersionCell } from "../../client/src/modules/admin/components/StandardVersionCell";

const mocks = vi.hoisted(() => ({ api: vi.fn(), invalidate: vi.fn(), toast: vi.fn() }));
vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => mocks.api(...args),
  queryClient: { invalidateQueries: (...args: unknown[]) => mocks.invalidate(...args) },
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));
vi.mock("@/contexts/PermissionsContext", () => ({ usePermissions: () => ({ permissions: [], isLoading: false }) }));
vi.mock("@/lib/crewUser", () => ({ getCrewUserId: () => undefined }));
const version = { id: 42, fvUuid: "draft-42", formId: 99, rankGroupId: 7,
  versionNo: "01", versionDate: "17-Nov-2026", status: "draft" };
const part = { formPartUuid: "part-42", formVersionUuid: "draft-42", partCode: "MAIN", partTitle: "Configuration", partType: "configurable", sortOrder: 0 };
let versions: any[], structures: any, initFailure: boolean, loseResponse: boolean, queryFailure: boolean;
let clients: QueryClient[];
const response = (data: unknown) => ({ ok: true, status: 200, json: async () => structuredClone(data) });
const initialCalls = () => mocks.api.mock.calls.filter(c => c[0] === "POST" && c[1].endsWith("/initial-draft"));
function setupTransport() {
  mocks.api.mockImplementation(async (method: string, url: string, data: any) => {
    if (method === "GET" && url.includes("/rank-groups/form/")) return response([{ id: 7, formId: 99, name: "Deck" }]);
    if (method === "GET" && /\/forms\/99\/versions/.test(url)) {
      if (queryFailure) throw new Error("Versions inaccessible");
      return response(versions);
    }
    if (method === "POST" && url.endsWith("/initial-draft")) {
      if (initFailure) throw new Error('500: {"error":"internal-uuid"}');
      if (!versions.length) versions = [structuredClone(version)];
      if (loseResponse) { loseResponse = false; throw new Error("response lost"); }
      return response(versions[0]);
    }
    if (method === "POST" && url.endsWith("/forms/99/versions")) {
      const next = { ...version, id: 43, fvUuid: "draft-43", versionNo: "02" };
      versions.push(next);
      return response(next);
    }
    if (method === "GET" && url.includes("/parts?")) {
      const fvUuid = new URL(url, "http://fixture").searchParams.get("formVersionUuid")!;
      return response([{ ...part, formVersionUuid: fvUuid, formPartUuid: fvUuid.replace("draft", "part") }]);
    }
    if (method === "GET" && url.endsWith("/structure")) return response(structures);
    if (method === "PUT" && url.endsWith("/structures")) {
      structures = structuredClone(data.parts[0].structure);
      return response({ form_version_uuid: "draft-42", parts: [
        { form_part_uuid: "part-42", ...structures },
      ] });
    }
    if (method === "POST" && url.endsWith("/release")) {
      versions[0] = { ...versions[0], status: "released", releasedAt: "2026-11-17T10:00:00Z" };
      return response(versions[0]);
    }
    return response([]);
  });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => mocks.api("GET", url)));
}
beforeEach(() => {
  versions = []; structures = { sections: [], option_sets: [] };
  initFailure = false; loseResponse = false; queryFailure = false; clients = [];
  mocks.api.mockReset(); mocks.toast.mockReset(); mocks.invalidate.mockReset();
  setupTransport();
});
afterEach(() => { cleanup(); clients.forEach(c => c.clear()); vi.unstubAllGlobals(); });
function open(category = "briefing", overrides: any = {}, factory = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  clients.push(client);
  const props = {
    form: { id: 99, name: "Crew Briefing Form", category } as any,
    formName: "Crew Briefing Form", rankGroupName: "Deck", rankGroupId: 7,
    onSave: vi.fn(), onClose: vi.fn(), ...overrides,
  };
  const Component = factory ? FormEditorFactory : GenericFormEditor;
  const view = render(<StrictMode><QueryClientProvider client={client}><Component {...props} /></QueryClientProvider></StrictMode>);
  return { ...view, client, props };
}
const saveButton = () => screen.getByTestId("button-save-form-structure") as HTMLButtonElement;
async function ready() {
  await waitFor(() => expect(saveButton()).not.toBeDisabled());
}
describe("complete production editor first-time workflow", () => {
  it.each(["briefing", "debriefing", "interview"])("opens the explicitly requested %s release instead of a newer draft", async category => {
    versions = [{ ...version, id: 41, fvUuid: "release-41", status: "released" },
      { ...version, versionNo: "02" }];
    open(category, { initialVersionId: 41 });
    await screen.findByTestId("button-edit-as-new-draft");
    expect(screen.queryByTestId("button-save-form-structure")).not.toBeInTheDocument();
    expect(initialCalls()).toHaveLength(0);
    expect(mocks.api.mock.calls.filter(c => c[0] !== "GET")).toHaveLength(0);
  });
  it.each(["briefing", "debriefing", "interview"])("opens the %s draft selected from the version cell through the real factory", async category => {
    versions = [{ ...version, id: 41, fvUuid: "release-41", status: "released" }, { ...version }];
    function List() {
      const [selected, setSelected] = React.useState<number>();
      return selected === undefined
        ? <StandardVersionCell versions={versions} rankGroupId={7} onOpenDraft={v => setSelected(v.id)} />
        : <FormEditorFactory form={{ id: 99, name: "Fixture", category } as any} formName="Fixture"
          rankGroupId={7} rankGroupName="Deck" standardOpening={{ versionId: selected, rankGroupId: 7 }}
          onSave={vi.fn()} onClose={vi.fn()} />;
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    clients.push(client);
    render(<QueryClientProvider client={client}><List /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Open Draft" }));
    await ready();
    expect(screen.getByTestId("select-form-version").textContent).toContain("Draft");
    expect(initialCalls()).toHaveLength(0);
    expect(mocks.api.mock.calls.filter(c => c[0] !== "GET")).toHaveLength(0);
  });
  it.each([
    { versions: [], versionId: 41 },
    { versions: [{ ...version, rankGroupId: 8 }], versionId: 42 },
    { versions: [{ ...version, formId: 100 }], versionId: 42 },
    { versions: [{ ...version }], versionId: null },
  ])("blocks stale or wrong-owner factory navigation without writes %#", async fixture => {
    versions = fixture.versions;
    open("briefing", { standardOpening: { versionId: fixture.versionId, rankGroupId: 7 } }, true);
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(mocks.api.mock.calls.filter(c => c[0] !== "GET")).toHaveLength(0);
  });
  it("recovers a failed factory lookup using Retry without initializing a draft", async () => {
    versions = [{ ...version, status: "released" }];
    queryFailure = true;
    open("briefing", { standardOpening: { versionId: 42, rankGroupId: 7 } }, true);
    await screen.findByRole("alert");
    queryFailure = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByTestId("button-edit-as-new-draft");
    expect(mocks.api.mock.calls.filter(c => c[0] !== "GET")).toHaveLength(0);
  });
  it("preserves resumable first-draft initialization through versionless factory navigation", async () => {
    open("briefing", { standardOpening: { versionId: null, rankGroupId: 7 } }, true);
    await ready();
    expect(initialCalls()).toHaveLength(1);
  });
  it("retains an explicit released selection when a newer version arrives", async () => {
    versions = [{ ...version, id: 41, fvUuid: "release-41", status: "released" }];
    const view = open("briefing", { initialVersionId: 41 });
    await screen.findByTestId("button-edit-as-new-draft");
    versions.push({ ...version, versionNo: "02" });
    await view.client.invalidateQueries({ queryKey: ["/api/v2/admin/forms/99/versions"] });
    expect(screen.getByTestId("select-form-version").textContent).toContain("Released");
    expect(screen.queryByTestId("button-save-form-structure")).not.toBeInTheDocument();
  });
  it("rejects removal of the selected version rather than falling back to a newer draft", async () => {
    versions = [{ ...version, id: 41, fvUuid: "release-41", status: "released" }];
    const view = open("briefing", { initialVersionId: 41 });
    await screen.findByTestId("button-edit-as-new-draft");
    versions = [{ ...version, versionNo: "02" }];
    await view.client.invalidateQueries({ queryKey: ["/api/v2/admin/forms/99/versions"] });
    await screen.findByRole("alert");
    expect(screen.queryByTestId("button-save-form-structure")).not.toBeInTheDocument();
    expect(initialCalls()).toHaveLength(0);
  });
  it("does not make an explicitly opened draft editable in read-only mode", async () => {
    versions = [{ ...version }];
    open("briefing", { initialVersionId: 42, readOnly: true });
    await screen.findByTestId("select-form-version");
    expect(screen.queryByTestId("button-save-form-structure")).not.toBeInTheDocument();
    expect(mocks.api.mock.calls.filter(c => c[0] !== "GET")).toHaveLength(0);
  });
  it("keeps Company Form navigation outside the new Standard Form opening gate", async () => {
    versions = [{ ...version }];
    open("dynamic", { standardOpening: { versionId: 999, rankGroupId: 7 } }, true);
    await screen.findByTestId("select-form-version");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.api.mock.calls.filter(c => c[0] !== "GET")).toHaveLength(0);
  });
  it("waits for delayed opening verification and ignores it after the editor closes", async () => {
    versions = [{ ...version }];
    let unlock!: () => void;
    const normal = mocks.api.getMockImplementation()!;
    mocks.api.mockImplementation(async (method, url, data) => {
      if (method === "GET" && url.endsWith("/versions")) await new Promise<void>(resolve => { unlock = resolve; });
      return normal(method, url, data);
    });
    const view = open("briefing", { standardOpening: { versionId: 42, rankGroupId: 7 } }, true);
    await screen.findByText("Loading form version…");
    await waitFor(() => expect(unlock).toBeTypeOf("function"));
    view.unmount(); unlock();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(mocks.api.mock.calls.filter(c => c[0] !== "GET")).toHaveLength(0);
    expect(view.props.onSave).not.toHaveBeenCalled();
  });
  it.each(["briefing", "debriefing", "interview"])("configures %s through the factory without templates, saves, reopens and releases", async category => {
    const view = open(category, {}, true);
    await ready();
    expect(initialCalls()).toHaveLength(1);
    expect(initialCalls()[0][2]).toEqual({ rankGroupId: 7 });
    const addSection = screen.getByTestId("button-add-first-section");
    fireEvent.click(addSection);
    const title = await screen.findByTestId("input-section-title-1");
    fireEvent.change(title, { target: { value: "Test Section" } });
    fireEvent.click(screen.getByTestId("button-add-point-1"));
    fireEvent.change(await screen.findByTestId("textarea-point-text-1-1"), { target: { value: "Test Point" } });
    fireEvent.click(saveButton());
    await waitFor(() => expect(view.props.onSave).toHaveBeenCalled());
    expect(structures.sections[0]).toMatchObject({ section_title: "Test Section", questions: [{ question_text: "Test Point" }] });
    view.unmount();
    open(category);
    await ready();
    expect(await screen.findByDisplayValue("Test Section")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Test Point")).toBeInTheDocument();
    expect(initialCalls()).toHaveLength(1);
    fireEvent.click(screen.getByTestId("button-release-version"));
    fireEvent.click(await screen.findByTestId("button-confirm-release"));
    await waitFor(() => expect(versions[0].status).toBe("released"));
    await waitFor(() => expect(screen.getByTestId("button-edit-as-new-draft")).toBeInTheDocument());
    expect(structures.sections[0].questions[0].question_text).toBe("Test Point");
    fireEvent.click(screen.getByTestId("button-edit-as-new-draft"));
    await ready();
    expect(versions).toHaveLength(2);
    expect(versions[1]).toMatchObject({ status: "draft", versionNo: "02" });
    expect(screen.getByDisplayValue("Test Point")).toBeInTheDocument();
    expect(initialCalls()).toHaveLength(1);
  });
  it("reconciles a lost create response without a second POST", async () => {
    loseResponse = true;
    open();
    await ready();
    expect(initialCalls()).toHaveLength(1);
    expect(versions).toHaveLength(1);
    expect(mocks.toast).not.toHaveBeenCalled();
  });
  it("shows a safe failed-initialization message, stays unsaved, and retries safely", async () => {
    initFailure = true;
    open();
    await screen.findByText(/initial draft could not be confirmed/);
    expect(screen.queryByTestId("button-save-form-structure")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-edit-as-new-draft")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("internal-uuid");
    expect(mocks.toast).not.toHaveBeenCalled();
    initFailure = false;
    fireEvent.click(screen.getByTestId("retry-initial-standard-draft"));
    await ready();
    expect(versions).toHaveLength(1);
  });
  it("does not interpret a failed version query as an empty form or initialize it", async () => {
    queryFailure = true;
    open();
    await screen.findByText(/Form versions could not be loaded/);
    expect(initialCalls()).toHaveLength(0);
    expect(screen.queryByTestId("button-save-form-structure")).not.toBeInTheDocument();
  });
  it.each([{ readOnly: true }, { initialPreview: true }, { rankGroupId: undefined, rankGroupName: undefined },
    { form: { id: 99, category: "briefing", archivedAt: "2026-11-01" } }])("never initializes a non-editable/preview/ungrouped context %j", async overrides => {
    open("briefing", overrides, true);
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(initialCalls()).toHaveLength(0);
  });
  it.each(["appraisal", "promotion", "dynamic", "future-category"])("never invokes scoped initialization for %s", async category => {
    // Direct editor mount ensures even a misleading form name cannot opt in.
    open(category);
    await new Promise(resolve => setTimeout(resolve, 80));
    expect(initialCalls()).toHaveLength(0);
  });
  it("resumes an existing draft unchanged without calling initialization", async () => {
    versions = [{ ...version, configuration: '{"userEdits":true}' }];
    open();
    await ready();
    expect(initialCalls()).toHaveLength(0);
    expect(versions[0].configuration).toBe('{"userEdits":true}');
  });
  it("ignores a delayed initialization response after closing the editor", async () => {
    let finish!: () => void;
    const normal = mocks.api.getMockImplementation()!;
    mocks.api.mockImplementation(async (method, url, data) => {
      if (method === "POST" && url.endsWith("/initial-draft")) await new Promise<void>(resolve => { finish = resolve; });
      return normal(method, url, data);
    });
    const view = open();
    await waitFor(() => expect(initialCalls()).toHaveLength(1));
    view.unmount();
    finish();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(view.props.onSave).not.toHaveBeenCalled();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("does not write after closing while the reconciliation GET is pending", async () => {
    let finish!: () => void, reads = 0;
    const normal = mocks.api.getMockImplementation()!;
    mocks.api.mockImplementation(async (method, url, data) => {
      if (method === "GET" && url.includes("/forms/99/versions") && ++reads === 2) {
        await new Promise<void>(resolve => { finish = resolve; });
      }
      return normal(method, url, data);
    });
    const view = open();
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    view.unmount(); finish();
    await new Promise(resolve => setTimeout(resolve, 40));
    expect(initialCalls()).toHaveLength(0);
  });
  it("loads a version released by another editor before initialization without creating anything", async () => {
    let reads = 0;
    const normal = mocks.api.getMockImplementation()!;
    mocks.api.mockImplementation(async (method, url, data) => {
      if (method === "GET" && url.includes("/forms/99/versions") && ++reads === 2) {
        versions = [{ ...version, status: "released" }];
      }
      return normal(method, url, data);
    });
    open();
    await screen.findByTestId("button-edit-as-new-draft");
    expect(initialCalls()).toHaveLength(0);
    expect(screen.queryByTestId("button-save-form-structure")).not.toBeInTheDocument();
  });
});

describe("initial version display stays explicitly scoped", () => {
  it.each(["briefing", "debriefing", "interview"])("%s displays a v00 placeholder, then the real stored number", category => {
    expect(standardInitialVersionLabel(category, "")).toBe("v00");
    expect(standardInitialVersionLabel(category, "01")).toBe("v01");
    expect(standardInitialVersionLabel(category, "09")).toBe("v09");
  });
  it.each(["appraisal", "promotion", "dynamic", "other", undefined])("leaves %s unchanged", category => {
    expect(standardInitialVersionLabel(category, "")).toBe("No versions");
    expect(standardInitialVersionLabel(category, "07")).toBe("v07");
  });
});
