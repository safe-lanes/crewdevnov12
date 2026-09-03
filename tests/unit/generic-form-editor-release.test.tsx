import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GenericFormEditor } from "@/components/GenericFormEditor";

const queryResults = vi.hoisted(() => new Map<string, unknown>());
const apiRequestMock = vi.hoisted(() => vi.fn());

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

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

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

function renderEditor() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <GenericFormEditor
        form={{ id: 99 } as any}
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
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
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
  apiRequestMock.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("GenericFormEditor release workflow", () => {
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
    expect(savedBody.parts[0].structure.sections[0].section_title).toBe("Unsaved release title");
    expect(apiRequestMock).toHaveBeenLastCalledWith(
      "POST",
      "/api/v2/admin/form-versions/42/release",
    );
    expect(editor.querySelector('[data-testid="released-read-only-message"]')).toBeTruthy();
  });
});