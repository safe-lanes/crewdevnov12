import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GenericFormEditor } from "@/components/GenericFormEditor";

const queryResults = vi.hoisted(() => new Map<string, unknown>());
const apiRequestMock = vi.hoisted(() => vi.fn());
const permissionState = vi.hoisted(() => ({
  permissions: [] as Array<{ menuName: string; canview?: boolean; canedit?: boolean }>,
}));
const toastMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey?: unknown[] }) => ({
    data: queryResults.get(String(options.queryKey?.[0])) ?? [],
    isLoading: false,
    refetch: vi.fn(async () => undefined),
  }),
}));

vi.mock("@/lib/queryClient", () => ({
  apiRequest: apiRequestMock,
}));

vi.mock("@/contexts/PermissionsContext", () => ({
  usePermissions: () => ({ permissions: permissionState.permissions, isLoading: false }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
});

const draft = {
  id: 42,
  fvUuid: "draft-version",
  formId: 99,
  rankGroupId: 7,
  versionNo: "01",
  versionDate: "01-Jan-2026",
  status: "draft",
};

const released = {
  ...draft,
  status: "released",
  releasedAt: "2026-09-03T00:00:00.000Z",
};

function response(json: unknown) {
  return {
    ok: true,
    json: async () => json,
  };
}

function structureResponse(title = "Navigation readiness") {
  return {
    sections: [{
      section_code: "B1",
      section_title: title,
      applicable_vessel_types: [],
      responsible_mode: "not_applicable",
      comment_box_required: false,
      signature_required: false,
      questions: [{
        question_code: "B1.1",
        question_text: "Bridge team briefing completed",
        response_type: "free_text",
        is_mandatory: false,
        comment_enabled: true,
        options: [],
      }],
    }],
  };
}

function savedStructures(body: any) {
  return response({
    form_version_uuid: "draft-version",
    parts: body.parts.map((part: any) => ({
      form_version_uuid: "draft-version",
      form_part_uuid: part.form_part_uuid,
      ...part.structure,
    })),
  });
}

function renderEditor(formValue: any = { id: 99 }) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <GenericFormEditor
        form={formValue as any}
        formName="Crew Briefing Form"
        rankGroupName="Deck"
        configurableParts={[{
          formPartUuid: "part-b",
          partCode: "B",
          partTitle: "Deck briefing",
          partType: "configurable",
        }]}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );
  });
  const editor = document.body.querySelector<HTMLElement>('[data-testid="generic-form-editor"]');
  if (!editor) throw new Error("Generic editor did not render");
  return editor;
}

function click(element: HTMLElement) {
  act(() => element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
}

async function flushAsyncWork() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("Native input value setter is unavailable");
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function setup(initialStructure = structureResponse()) {
  queryResults.set("/api/v2/admin/rank-groups", [{ id: 7, name: "Deck", formId: 99 }]);
  queryResults.set("/api/v2/admin/forms/99/versions", [draft]);
  queryResults.set("admin-form-version-parts", [{
    formPartUuid: "version-part-b",
    formVersionUuid: draft.fvUuid,
    partCode: "B",
    partTitle: "Deck briefing",
    partType: "configurable",
  }]);
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/parts?formVersionUuid=")) {
      return response(queryResults.get("admin-form-version-parts"));
    }
    if (url.includes("/structure")) return response(initialStructure);
    return response({});
  }));
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  queryResults.clear();
  permissionState.permissions = [];
  apiRequestMock.mockReset();
  toastMock.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GenericFormEditor release workflow", () => {
  it.each([
    { action: "save", status: 400, body: { error: "Invalid form structures", details: [
      { path: ["parts", 0, "structure", "sections", 0, "questions", 0, "options"], message: "System fields cannot contain answer options" },
      { path: ["parts", 0, "structure", "sections", 0, "responsible_department"], message: "responsible_department must be empty when responsible_mode is role" },
    ] }, count: 2 },
    { action: "release", status: 400, body: { error: 'Section "Navigation readiness" requires at least one permitted vessel role. Section "Navigation readiness" requires submission but has no responsible party. Assign a role, department, or seafarer.' }, count: 2 },
    { action: "save", status: 500, body: { error: "server_error" }, count: 1 },
  ])("keeps $action refusal ($status) visible as $count readable list items", async ({ action, status, body, count }) => {
    setup();
    permissionState.permissions = [{ menuName: "Forms", canview: true, canedit: true }];
    queryResults.set("/api/v2/admin/forms/99/versions", [{ ...draft, rankGroupId: null, stageKey: "before_joining" }]);
    queryResults.set("/api/v2/admin/forms/99/subject-stages", [{ subjectType: "crew_assignment", stageKey: "before_joining", label: "Before joining", sortOrder: 1 }]);
    apiRequestMock.mockImplementation(async (method: string, url: string) => {
      if (method !== "GET") throw new Error(`${status}: ${JSON.stringify(body)}`);
      if (url.endsWith("/structure")) return response(structureResponse());
      if (url.includes("/parts?")) return response(queryResults.get("admin-form-version-parts"));
      if (url.endsWith("/applicability")) return response({ mode: "manual_only", sets: [] });
      return response([]);
    });
    const editor = renderEditor({ id: 99, category: "dynamic", subjectType: "crew_assignment" });
    await flushAsyncWork();
    await flushAsyncWork();
    if (action === "release") {
      click(editor.querySelector<HTMLElement>('[data-testid="button-release-version"]')!);
      click(document.body.querySelector<HTMLElement>('[data-testid="button-confirm-release"]')!);
    } else {
      click(editor.querySelector<HTMLElement>('[data-testid="button-save-form-structure"]')!);
    }
    await flushAsyncWork();
    await flushAsyncWork();
    const problems = editor.querySelector<HTMLElement>('[data-testid="text-form-save-error"]')!;
    expect(problems).not.toBeNull();
    expect(problems.getAttribute("role")).toBe("alert");
    expect(problems.querySelectorAll("li")).toHaveLength(count);
    expect(problems.textContent).not.toMatch(/responsible_department|responsible_mode|400:|500:|server_error/);
    if (status === 400) {
      expect(problems.textContent).toContain("Section 1.1");
      expect(problems.textContent).not.toMatch(/could not be (saved|released)/);
    } else expect(problems.textContent).toContain("Form settings could not be saved");
  });

  it("turns comments off with a notice when changing a point to a system field", async () => {
    setup();
    apiRequestMock.mockImplementation(async (_method: string, url: string) => response(
      url.endsWith("/structure") ? structureResponse() : [],
    ));
    queryResults.set("/api/v2/admin/forms/99/versions", [{ ...draft, rankGroupId: null }]);
    permissionState.permissions = [{ menuName: "Forms", canview: true, canedit: true }];
    const editor = renderEditor({ id: 99, category: "dynamic", subjectType: "crew_assignment" });
    await flushAsyncWork();
    await flushAsyncWork();
    const trigger = editor.querySelector<HTMLElement>('[data-testid="select-response-type-1-1"]')!;
    Object.assign(trigger, { hasPointerCapture: () => false, releasePointerCapture: () => undefined });
    act(() => trigger.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0, pointerType: "mouse" })));
    await flushAsyncWork();
    click(Array.from(document.body.querySelectorAll<HTMLElement>('[role="option"]'))
      .find(option => option.textContent === "System Field")!);
    await flushAsyncWork();
    const comment = editor.querySelector<HTMLElement>('[data-testid="checkbox-point-comment-1-1"]')!;
    expect(comment).not.toBeNull();
    expect(comment.getAttribute("data-state")).toBe("unchecked");
    expect(comment.hasAttribute("disabled")).toBe(true);
    expect(comment.parentElement?.title).toBe("System fields display a value the system already holds and cannot take a comment.");
    expect(toastMock).toHaveBeenCalledWith({
      title: "Comments turned off",
      description: "System fields display a value the system already holds and cannot take a comment.",
    });
  });

  it("opens legacy released system fields safely in builder and preview without saving or releasing them", async () => {
    const legacy = structureResponse();
    Object.assign(legacy.sections[0].questions[0], {
      response_type: "system_field", system_field_key: "rank", comment_enabled: true,
      question_text: "Rank",
    });
    setup(legacy);
    apiRequestMock.mockImplementation(async (_method: string, url: string) => response(
      url.endsWith("/structure") ? legacy : [],
    ));
    queryResults.set("/api/v2/admin/forms/99/versions", [{ ...released, rankGroupId: null }]);
    const editor = renderEditor({ id: 99, category: "dynamic", subjectType: "crew_assignment" });
    await flushAsyncWork();
    await flushAsyncWork();
    const comment = editor.querySelector<HTMLElement>('[data-testid="checkbox-point-comment-1-1"]')!;
    expect(comment).not.toBeNull();
    expect(comment.hasAttribute("disabled")).toBe(true);
    expect(comment.getAttribute("data-state")).toBe("unchecked");
    click(editor.querySelector<HTMLElement>('[data-testid="button-preview-mode"]')!);
    await flushAsyncWork();
    expect(document.body.querySelector('[data-testid="configured-form-preview"]')).not.toBeNull();
    expect(apiRequestMock.mock.calls.filter(([method]) => ["PUT", "POST", "DELETE"].includes(method))).toEqual([]);
    expect(legacy.sections[0].questions[0].comment_enabled).toBe(true);
  });

  it("renders while versions have not loaded and no stage selection exists", () => {
    setup();
    queryResults.set("/api/v2/admin/forms/99/versions", []);
    const editor = renderEditor({ id: 99, category: "dynamic", subjectType: "crew_assignment" });
    expect(editor).toBeTruthy();
  });

  it("loads stage options from the subject registry and keeps an unselected stage draft-only", async () => {
    setup();
    queryResults.set("/api/v2/admin/forms/99/subject-stages", [{
      subjectType: "future_subject_type",
      stageKey: "registry_checkpoint",
      label: "Registry checkpoint",
      sortOrder: 1,
    }]);

    const editor = renderEditor({ id: 99, category: "dynamic", subjectType: "future_subject_type" });
    await flushAsyncWork();
    await flushAsyncWork();

    const stageTrigger = editor.querySelector<HTMLElement>('[data-testid="select-company-form-stage"]');
    if (!stageTrigger) throw new Error("Company Form stage selector did not render");
    click(stageTrigger);
    await flushAsyncWork();
    expect(document.body.textContent).toContain("Registry checkpoint");
    click(stageTrigger);
    await flushAsyncWork();

    click(editor.querySelector<HTMLElement>('[data-testid="button-release-version"]')!);
    expect(editor.textContent).toContain("Select a subject stage before releasing");
    expect(document.body.querySelector('[data-testid="button-confirm-release"]')).toBeNull();
  });

  it("disables release while applicability is dirty and gives a save-first instruction", async () => {
    setup();
    permissionState.permissions = [{ menuName: "Forms", canview: true, canedit: true }];
    apiRequestMock.mockImplementation(async (method: string, url: string) => {
      if (method === "GET" && url.endsWith("/applicability")) {
        return response({
          versionUuid: "draft-version",
          mode: "all",
          obligation: "mandatory",
          effectiveKind: "on_release",
          specificDate: null,
          effectiveFrom: null,
          copiedFromVersionUuid: null,
          sets: [],
        });
      }
      if (method === "GET" && url.endsWith("/rule-dimensions")) {
        return response([{
          key: "nationality",
          label: "Nationality",
          kind: "scalar",
          operators: ["in"],
          available: true,
          choices: [{ id: "in", label: "Indian" }],
        }]);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const editor = renderEditor({ id: 99, category: "dynamic", subjectType: "crew_assignment" });
    await flushAsyncWork();
    await flushAsyncWork();
    await flushAsyncWork();

    click(editor.querySelector<HTMLElement>('[data-testid="button-toggle-applicability-settings"]')!);
    await flushAsyncWork();
    click(document.body.querySelector<HTMLElement>("#applicability-conditional")!);
    await flushAsyncWork();
    const releaseButton = editor.querySelector<HTMLButtonElement>('[data-testid="button-release-version"]');
    if (!releaseButton) throw new Error("Release button did not render");
    expect(releaseButton).toBeDisabled();
    expect(editor.querySelector('[data-testid="release-applicability-save-first"]')?.textContent).toContain("Save any applicability changes");
    expect(editor.querySelector('[data-testid="company-form-header-settings-scroll"]')).toBeNull();
    expect(editor.querySelector('[data-testid="company-form-applicability-summary"]')).toBeTruthy();
    expect(editor.querySelector('[data-testid="company-form-applicability-editor"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="company-form-applicability-window"]')).toBeTruthy();
    expect(apiRequestMock).not.toHaveBeenCalledWith("POST", expect.stringContaining("/release"));
  });

  it("confirms a draft release and switches the editor to released read-only mode", async () => {
    setup();
    apiRequestMock.mockResolvedValue(response(released));

    const editor = renderEditor();
    await flushAsyncWork();
    await flushAsyncWork();

    const releaseButton = editor.querySelector<HTMLButtonElement>('[data-testid="button-release-version"]');
    if (!releaseButton) throw new Error("Release button did not render");
    expect(releaseButton).not.toBeDisabled();

    click(releaseButton);
    expect(document.body.textContent).toContain("This version will become permanent and cannot be edited.");

    const confirmButton = document.body.querySelector<HTMLButtonElement>('[data-testid="button-confirm-release"]');
    if (!confirmButton) throw new Error("Release confirmation button did not render");
    click(confirmButton);
    await flushAsyncWork();
    await flushAsyncWork();

    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/v2/admin/form-versions/42/release",
    );
    expect(editor.querySelector('[data-testid="select-form-version"]')?.textContent).toContain("Released");
    expect(editor.querySelector('[data-testid="released-read-only-message"]')).toBeTruthy();
    expect(editor.querySelector('[data-testid="button-edit-as-new-draft"]')).toBeTruthy();
    expect(editor.querySelector<HTMLButtonElement>('[data-testid="button-release-version"]')).toBeDisabled();
  });

  it("saves dirty structure before releasing the numeric version returned by the draft", async () => {
    setup();
    const requestOrder: string[] = [];
    let savedBody: any;
    apiRequestMock.mockImplementation(async (method: string, url: string, body?: any) => {
      if (method === "GET" && url.includes("/parts?formVersionUuid=")) {
        return response([{
          formPartUuid: "version-part-b",
          formVersionUuid: "draft-version",
          partCode: "B",
          partTitle: "Deck briefing",
          partType: "configurable",
        }]);
      }
      if (method === "GET" && url.endsWith("/structure")) return response(structureResponse());
      if (method === "PUT" && url === "/api/v2/admin/form-versions/draft-version/structures") {
        requestOrder.push("save");
        savedBody = body;
        return savedStructures(body);
      }
      if (method === "POST" && url === "/api/v2/admin/form-versions/42/release") {
        requestOrder.push("release");
        return response(released);
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    });

    const editor = renderEditor();
    await flushAsyncWork();
    await flushAsyncWork();
    await flushAsyncWork();
    await flushAsyncWork();

    const sectionTitle = editor.querySelector<HTMLInputElement>('[data-testid="input-section-title-1"]');
    if (!sectionTitle) throw new Error("Section title input did not render");
    setInputValue(sectionTitle, "Unsaved release title");
    await flushAsyncWork();

    click(editor.querySelector<HTMLElement>('[data-testid="button-release-version"]')!);
    click(document.body.querySelector<HTMLElement>('[data-testid="button-confirm-release"]')!);
    await flushAsyncWork();
    await flushAsyncWork();
    await flushAsyncWork();

    expect(requestOrder).toEqual(["save", "release"]);
    expect(savedBody.parts[0].form_part_uuid).toBe("version-part-b");
    expect(savedBody.parts[0].structure.sections[0].section_title).toBe("Unsaved release title");
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      "POST",
      "/api/v2/admin/form-versions/42/release",
    );
    expect(editor.querySelector('[data-testid="released-read-only-message"]')).toBeTruthy();
  });
});