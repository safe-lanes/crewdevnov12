import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CompanySubmissionRenderer,
  fetchCompanySubmissionForm,
  mapCompanySubmissionForm,
  saveCompanySubmissionDraft,
  type CompanySubmissionRenderView,
} from "../../client/src/components/configured-form/companySubmissionContract";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const submissionUuid = "2ac2cb2e-3bb0-48cb-9158-19608956cc17";

function formContract(overrides: Partial<CompanySubmissionRenderView> = {}): CompanySubmissionRenderView {
  return {
    submission: {
      submissionUuid,
      subjectType: "crew_assignment",
      subjectRef: "assignment-a",
      formUuid: "form-a",
      formVersionUuid: "version-a",
      stageKey: "before_joining",
      status: "in_progress",
      createdAt: "2026-05-01",
      completedAt: null,
      canEdit: true,
      canVoid: false,
      voidedAt: null,
      voidedByUuid: null,
      voidedByName: null,
      voidReason: null,
      voidedPreviousStatus: null,
      replacedBySubmissionUuid: null,
      replacesSubmissionUuid: null,
      systemSnapshotAt: null,
      systemSnapshotEvent: null,
    },
    signatureMethodOptions: {},
    form: {
      formName: "Pinned declaration",
      description: null,
      category: "dynamic",
      archivedAt: null,
    },
    version: {
      formVersionUuid: "version-a",
      versionNo: "01",
      versionDate: "2026-05-01",
      status: "released",
      stageKey: "before_joining",
      stageLabel: "Before joining",
      releasedAt: "2026-05-01",
    },
    systemFields: [{
      key: "seafarer_name",
      label: "Seafarer name",
      source: "subject",
      value: "Alex & <Crew>",
      valueOrigin: "current_subject",
    }],
    optionSets: [{
      optionSetUuid: "named-set",
      setName: "Declarations",
      lowEndLabel: null,
      highEndLabel: null,
      sortOrder: 0,
      options: [
        { optionUuid: "option-b", optionLabel: "B option", optionValue: "b", sortOrder: 1 },
        { optionUuid: "option-a", optionLabel: "A option", optionValue: "a", sortOrder: 0 },
      ],
    }],
    parts: [{
      formPartUuid: "part-fixed",
      partCode: "A",
      partTitle: "Generic fixed Company Form part",
      partType: "fixed",
      isOfficeOnly: false,
      sortOrder: 0,
      sections: [{
        sectionUuid: "section-a",
        sectionCode: "A1",
        sectionTitle: "Declaration",
        applicableVesselTypes: [],
        responsibleMode: "not_applicable",
        responsibleRoleUuid: null,
        responsibleRole: null,
        responsibleDepartment: null,
        commentBoxRequired: false,
        signatureOfficerRequired: false,
        signatureSeafarerRequired: false,
        requiresSubmission: true,
        isApplicable: true,
        defaultOptionSetUuid: null,
        layoutPreference: "list",
        effectiveLayout: "list",
        sortOrder: 0,
        questions: [
          {
            questionUuid: "content-question",
            questionCode: "A1.1",
            questionText: "Read these instructions",
            contentHtml: "<p>Follow the company policy.</p>",
            systemFieldKey: null,
            responseType: "content",
            isMandatory: false,
            commentEnabled: false,
            optionSetUuid: null,
            sortOrder: 0,
            options: [],
            systemField: null,
          },
          {
            questionUuid: "system-question",
            questionCode: "A1.2",
            questionText: "Old stale field label",
            contentHtml: null,
            systemFieldKey: "seafarer_name",
            responseType: "system_field",
            isMandatory: false,
            commentEnabled: false,
            optionSetUuid: null,
            sortOrder: 1,
            options: [],
            systemField: {
              key: "seafarer_name",
              label: "Seafarer name",
              source: "subject",
              value: "Alex & <Crew>",
              valueOrigin: "current_subject",
            },
          },
          {
            questionUuid: "single-question",
            questionCode: "A1.3",
            questionText: "Select the declaration",
            contentHtml: null,
            systemFieldKey: null,
            responseType: "single_select",
            isMandatory: false,
            commentEnabled: true,
            optionSetUuid: "named-set",
            sortOrder: 2,
            options: [
              { optionUuid: "option-b", optionLabel: "B option", optionValue: "b", sortOrder: 1 },
              { optionUuid: "option-a", optionLabel: "A option", optionValue: "a", sortOrder: 0 },
            ],
            systemField: null,
          },
          {
            questionUuid: "free-text-question",
            questionCode: "A1.4",
            questionText: "Additional notes",
            contentHtml: null,
            systemFieldKey: null,
            responseType: "free_text",
            isMandatory: false,
            commentEnabled: false,
            optionSetUuid: null,
            sortOrder: 3,
            options: [],
            systemField: null,
          },
        ],
      }],
    }],
    states: [{
      sectionUuid: "section-a",
      sectionStateUuid: "state-a",
      status: "not_started",
      sectionComment: "Section note",
      submittedByUuid: null,
      submittedByName: null,
      submittedAt: null,
      signatures: [],
    }],
    answers: [{
      answerUuid: "answer-a",
      questionUuid: "single-question",
      answerValue: "b",
      answerComment: "Signed after review",
      createdAt: null,
      updatedAt: null,
    }],
    systemSnapshotAt: null,
    systemSnapshotEvent: null,
    systemValuesChanged: null,
    systemValuesComparisonError: false,
    systemValuesChangedNotice: null,
    voidedReplacement: null,
    replacementHistory: [],
    ...overrides,
  };
}

function withSecondPart(contract = formContract()): CompanySubmissionRenderView {
  return {
    ...contract,
    parts: [
      ...contract.parts,
      {
        formPartUuid: "part-b",
        partCode: "B",
        partTitle: "Additional declarations",
        partType: "configurable",
        isOfficeOnly: false,
        sortOrder: 1,
        sections: [{
          sectionUuid: "section-b",
          sectionCode: "B1",
          sectionTitle: "Additional details",
          applicableVesselTypes: [],
          responsibleMode: "not_applicable",
          responsibleRoleUuid: null,
          responsibleRole: null,
          responsibleDepartment: null,
          commentBoxRequired: false,
          signatureOfficerRequired: false,
          signatureSeafarerRequired: false,
        requiresSubmission: true,
        isApplicable: true,
          defaultOptionSetUuid: null,
          layoutPreference: "list",
          effectiveLayout: "list",
          sortOrder: 0,
          questions: [{
            questionUuid: "second-part-question",
            questionCode: "B1.1",
            questionText: "Additional part answer",
            contentHtml: null,
            systemFieldKey: null,
            responseType: "free_text",
            isMandatory: false,
            commentEnabled: true,
            optionSetUuid: null,
            sortOrder: 0,
            options: [],
            systemField: null,
          }],
        }],
      },
    ],
    states: [
      ...contract.states,
      {
        sectionUuid: "section-b",
        sectionStateUuid: "state-b",
        status: "not_started",
        sectionComment: null,
        submittedByUuid: null,
        submittedByName: null,
        submittedAt: null,
        signatures: [],
      },
    ],
  };
}

function losslessAnswerContract(): CompanySubmissionRenderView {
  const contract = formContract();
  const part = contract.parts[0];
  const section = part.sections[0];
  const cases = [
    { questionUuid: "text-true", responseType: "free_text" as const, answerValue: "true" },
    { questionUuid: "text-false", responseType: "free_text" as const, answerValue: "false" },
    { questionUuid: "text-quoted", responseType: "free_text" as const, answerValue: '"quoted answer"' },
    { questionUuid: "text-array", responseType: "free_text" as const, answerValue: '["a","b"]' },
    { questionUuid: "checkbox-answer", responseType: "checkbox" as const, answerValue: "true" },
    { questionUuid: "checkbox-false-answer", responseType: "checkbox" as const, answerValue: "false" },
    { questionUuid: "multi-answer", responseType: "multi_select" as const, answerValue: '["a","b"]' },
    { questionUuid: "date-answer", responseType: "date" as const, answerValue: "2025-03-09" },
    { questionUuid: "number-answer", responseType: "number" as const, answerValue: "12.50" },
  ];
  return {
    ...contract,
    parts: [{
      ...part,
      sections: [{
        ...section,
        questions: [
          ...section.questions,
          ...cases.map((entry, index) => ({
            questionUuid: entry.questionUuid,
            questionCode: `A1.${index + 5}`,
            questionText: entry.questionUuid,
            contentHtml: null,
            systemFieldKey: null,
            responseType: entry.responseType,
            isMandatory: false,
            commentEnabled: false,
            optionSetUuid: entry.responseType === "multi_select" ? "named-set" : null,
            sortOrder: index + 4,
            options: entry.responseType === "multi_select" ? contract.optionSets[0].options : [],
            systemField: null,
          })),
        ],
      }],
      voidedReplacement: null,
    }],
    answers: [
      ...contract.answers,
      ...cases.map((entry) => ({
        answerUuid: `answer-${entry.questionUuid}`,
        questionUuid: entry.questionUuid,
        answerValue: entry.answerValue,
        answerComment: null,
        createdAt: null,
        updatedAt: null,
      })),
    ],
  };
}

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;
let activeQueryClient: QueryClient | null = null;

function mount(node: React.ReactNode) {
  activeContainer = document.createElement("div");
  document.body.appendChild(activeContainer);
  activeRoot = createRoot(activeContainer);
  activeQueryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  act(() => activeRoot?.render(
    <QueryClientProvider client={activeQueryClient!}>{node}</QueryClientProvider>,
  ));
  return activeContainer;
}

afterEach(() => {
  act(() => activeRoot?.unmount());
  activeQueryClient?.clear();
  activeRoot = null;
  activeQueryClient = null;
  activeContainer?.remove();
  activeContainer = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Company Form submission renderer contract", () => {
  it("maps pinned generic fixed parts, Content/System values, named options, answers and comments without a Standard registry", () => {
    const model = mapCompanySubmissionForm(formContract());
    expect(model.parts).toHaveLength(1);
    expect(model.parts[0]).toMatchObject({
      formPartUuid: "part-fixed",
      partType: "configurable",
      partTitle: "Generic fixed Company Form part",
    });
    expect(model.structures["part-fixed"][0].questions[0]).toMatchObject({
      response_type: "content",
      content_html: "<p>Follow the company policy.</p>",
    });
    expect(model.structures["part-fixed"][0].questions[1]).toMatchObject({
      response_type: "content",
      question_text: "Seafarer name",
      content_html: "<p>Alex &amp; &lt;Crew&gt;</p>",
    });
    expect(model.structures["part-fixed"][0].questions[2].options.map((option) => option.option_label))
      .toEqual(["A option", "B option"]);
    expect(model.answers["single-question"]).toBe("b");
    expect(model.answerComments["single-question"]).toBe("Signed after review");
    expect(model.sectionComments["section-a"]).toBe("Section note");
  });

  it("refuses cross-stage content in operational viewers while G3 remains unscoped", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(formContract()), {
      status: 200, headers: { "content-type": "application/json" },
    })));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid}
      entryStage={{ stageKey: "at_sign_off", submissionUuids: [submissionUuid] }} />);
    await waitFor(() => expect(activeContainer!.textContent).toContain("Open full history in crew profile G3"));
    expect(activeContainer!.querySelector('[data-testid="company-submission-metadata"]')).toBeNull();
  });

  it("fetches and renders the pinned form through the submission endpoint and exposes answer editing", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({
        url: String(input),
        method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (method === "PUT") return new Response(null, { status: 204 });
      return new Response(JSON.stringify(formContract()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));
    const changed = vi.fn();
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} onAnswerChange={changed} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(calls).toEqual([{
      url: `/api/v2/company-form-submissions/${submissionUuid}/form`,
      method: "GET",
      body: undefined,
    }]);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="configured-form-live"]')).not.toBeNull());
    expect(activeContainer?.querySelector('[data-testid="configured-form-content"]')?.textContent)
      .toContain("Follow the company policy.");
    expect(activeContainer?.querySelector('[data-testid="preview-content-content-question"]')?.textContent)
      .toContain("Follow the company policy.");
    expect(activeContainer?.querySelector('[data-testid="preview-content-system-question"]')?.textContent)
      .toContain("Alex & <Crew>");
    expect(activeContainer?.querySelector('[data-testid="preview-response-single-question"]')?.textContent)
      .toContain("B option");

    const input = activeContainer?.querySelector('[data-testid="preview-response-free-text-question"]');
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { value: "Additional crew notes" } });
    expect(changed).toHaveBeenCalledWith("free-text-question", "Additional crew notes");
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toEqual({
      url: `/api/v2/company-form-submissions/${submissionUuid}/sections/section-a/answers`,
      method: "PUT",
      body: {
        answers: [{ questionUuid: "free-text-question", value: "Additional crew notes" }],
      },
    });
    expect(calls.some((call) => call.url.includes("/api/v2/admin/"))).toBe(false);
  });

  it("hides unsupported Company section submission while keeping Save Draft available", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(formContract()), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} onAnswerChange={vi.fn()} />);

    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="configured-form-live"]')).not.toBeNull());
    const buttons = [...activeContainer!.querySelectorAll("button")];
    expect(buttons.some((button) => button.textContent?.trim() === "Save draft")).toBe(true);
    expect(buttons.some((button) => button.textContent?.trim() === "Submit")).toBe(false);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("edits and persists server-authorized drafts without an optional answer notification callback", async () => {
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({
        url: String(input),
        method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (method === "PUT") return new Response(null, { status: 204 });
      return new Response(JSON.stringify(formContract()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);

    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="preview-response-free-text-question"]')).not.toBeNull());
    const input = activeContainer!.querySelector('[data-testid="preview-response-free-text-question"]')!;
    expect(input).toHaveProperty("readOnly", false);
    fireEvent.change(input, { target: { value: "Saved without a notification callback" } });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toEqual({
      url: `/api/v2/company-form-submissions/${submissionUuid}/sections/section-a/answers`,
      method: "PUT",
      body: {
        answers: [{ questionUuid: "free-text-question", value: "Saved without a notification callback" }],
      },
    });
    expect(calls.some((call) => call.url.includes("/api/v2/admin/"))).toBe(false);
  });

  it("keeps server-denied drafts read-only even with an answer notification callback", async () => {
    const contract = formContract();
    contract.submission.canEdit = false;
    const fetch = vi.fn(async () => new Response(JSON.stringify(contract), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetch);
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} onAnswerChange={vi.fn()} />);

    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="preview-response-free-text-question"]')).not.toBeNull());
    expect(activeContainer!.querySelector('[data-testid="preview-response-free-text-question"]')).toHaveProperty("readOnly", true);
    const buttons = [...activeContainer!.querySelectorAll("button")];
    expect(buttons.some((button) => ["Save draft", "Submit"].includes(button.textContent?.trim() ?? ""))).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("navigates to later pinned parts, renders them and saves edits to that part's section", async () => {
    const contract = withSecondPart();
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({
        url: String(input),
        method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (method === "PUT") return new Response(null, { status: 204 });
      return new Response(JSON.stringify(contract), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));
    const changed = vi.fn();
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} onAnswerChange={changed} />);

    await waitFor(() => expect(activeContainer?.querySelector('[aria-label="Company Form parts"]')).not.toBeNull());
    expect(activeContainer?.textContent).toContain("Follow the company policy.");
    fireEvent.click(activeContainer!.querySelector('[aria-label="Company Form parts"] button:nth-child(2)')!);

    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="preview-response-second-part-question"]')).not.toBeNull());
    const input = activeContainer!.querySelector('[data-testid="preview-response-second-part-question"]')!;
    fireEvent.change(input, { target: { value: "Part B response" } });
    expect(changed).toHaveBeenCalledWith("second-part-question", "Part B response");
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toEqual({
      url: `/api/v2/company-form-submissions/${submissionUuid}/sections/section-b/answers`,
      method: "PUT",
      body: {
        answers: [{ questionUuid: "second-part-question", value: "Part B response" }],
      },
    });
  });

  it("lets read-only viewers navigate and view every pinned part", async () => {
    const contract = withSecondPart();
    contract.submission.canEdit = false;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(contract), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);

    await waitFor(() => expect(activeContainer?.querySelector('[aria-label="Company Form parts"]')).not.toBeNull());
    expect(activeContainer?.textContent).toContain("Follow the company policy.");
    fireEvent.click(activeContainer!.querySelector('[aria-label="Company Form parts"] button:nth-child(2)')!);

    const input = await waitFor(() => activeContainer?.querySelector('[data-testid="preview-response-second-part-question"]'));
    expect(input).not.toBeNull();
    expect(input).toHaveProperty("readOnly", true);
    expect(activeContainer?.textContent).toContain("Additional details");
  });

  it("persists comments on unanswered optional questions, including from Save Draft", async () => {
    const contract = withSecondPart();
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({
        url: String(input),
        method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (method === "PUT") return new Response(null, { status: 204 });
      return new Response(JSON.stringify(contract), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} onAnswerChange={vi.fn()} />);

    await waitFor(() => expect(activeContainer?.querySelector('[aria-label="Company Form parts"]')).not.toBeNull());
    fireEvent.click(activeContainer!.querySelector('[aria-label="Company Form parts"] button:nth-child(2)')!);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="button-preview-comment-second-part-question"]')).not.toBeNull());
    fireEvent.click(activeContainer!.querySelector('[data-testid="button-preview-comment-second-part-question"]')!);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="preview-comment-second-part-question"]')).not.toBeNull());
    fireEvent.change(activeContainer!.querySelector('[data-testid="preview-comment-second-part-question"]')!, {
      target: { value: "Optional comment without an answer" },
    });

    await waitFor(() => expect(calls).toHaveLength(2));
    const expectedAnswer = {
      questionUuid: "second-part-question",
      value: null,
      comment: "Optional comment without an answer",
    };
    expect(calls[1]).toMatchObject({
      url: `/api/v2/company-form-submissions/${submissionUuid}/sections/section-b/answers`,
      method: "PUT",
      body: { answers: [expectedAnswer] },
    });

    const saveDraftButton = [...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.trim().toLowerCase() === "save draft");
    expect(saveDraftButton).toBeDefined();
    fireEvent.click(saveDraftButton!);
    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[2]).toMatchObject({
      method: "PUT",
      body: { answers: [expectedAnswer], sectionComment: "" },
    });
  });

  it.each([
    ["completed", false],
    ["in_progress", true],
    ["in_progress", false],
  ] as const)("uses server-declared editability for completed and draft submissions (%s)", (status, canEdit) => {
    const original = formContract();
    const model = mapCompanySubmissionForm({
      ...original,
      submission: {
        ...original.submission,
        status,
        canEdit,
      },
    });
    expect(model.readOnly).toBe(!canEdit);
  });

  it("surfaces permission refusals rather than disguising them as missing configuration", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({
        error: "forbidden",
        message: "You do not have permission to view this Company Form.",
      }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);
    await waitFor(() => expect(activeContainer?.querySelector('[role="alert"]')).not.toBeNull());

    const alert = activeContainer?.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("403");
    expect(alert?.textContent).toContain("forbidden");
    expect(alert?.textContent).toContain("You do not have permission");
    expect(alert?.textContent).not.toContain("configuration");
    expect(calls).toEqual([`/api/v2/company-form-submissions/${submissionUuid}/form`]);
  });

  it("surfaces permission refusals from draft saves", async () => {
    const calls: Array<{ url: string; method: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: String(input), method });
      if (method === "PUT") {
        return new Response(JSON.stringify({
          error: "forbidden",
          message: "You do not have permission to edit this Company Form.",
        }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify(formContract()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} onAnswerChange={vi.fn()} />);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="preview-response-free-text-question"]')).not.toBeNull());
    fireEvent.change(
      activeContainer!.querySelector('[data-testid="preview-response-free-text-question"]')!,
      { target: { value: "Attempted draft" } },
    );

    await waitFor(() => expect(activeContainer?.querySelector('[role="alert"]')?.textContent).toContain("403"));
    expect(activeContainer?.querySelector('[role="alert"]')?.textContent).toContain("You do not have permission to edit");
    expect(calls).toEqual([
      { url: `/api/v2/company-form-submissions/${submissionUuid}/form`, method: "GET" },
      { url: `/api/v2/company-form-submissions/${submissionUuid}/sections/section-a/answers`, method: "PUT" },
    ]);
    expect(calls.some((call) => call.url.includes("/api/v2/admin/"))).toBe(false);
  });

  it("serializes same-section edits, preserves latest errors, and flushes Save Draft after queued answers", async () => {
    let storedContract = formContract();
    const calls: Array<{
      url: string;
      method: string;
      body?: {
        answers: Array<{ questionUuid: string; value: string | string[] | boolean | null }>;
        sectionComment?: string;
      };
    }> = [];
    const deferredResolvers: Array<(response: Response) => void> = [];
    let putCount = 0;
    const persistBody = (body: NonNullable<typeof calls[number]["body"]>) => {
      const existingQuestionUuids = new Set(storedContract.answers.map((answer) => answer.questionUuid));
      const storedValue = (value: string | string[] | boolean | null) => value === null
        ? null
        : Array.isArray(value)
          ? JSON.stringify(value)
          : String(value);
      storedContract = {
        ...storedContract,
        answers: [
          ...storedContract.answers.map((answer) => {
          const update = body.answers.find((candidate) => candidate.questionUuid === answer.questionUuid);
          if (!update) return answer;
          return {
            ...answer,
              answerValue: storedValue(update.value),
              answerComment: update.comment ?? null,
          };
          }),
          ...body.answers
            .filter((answer) => !existingQuestionUuids.has(answer.questionUuid))
            .map((answer) => ({
              answerUuid: `answer-${answer.questionUuid}`,
              questionUuid: answer.questionUuid,
              answerValue: storedValue(answer.value),
              answerComment: answer.comment ?? null,
              createdAt: null,
              updatedAt: null,
            })),
        ],
      };
    };
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url: String(input), method, body });
      if (method !== "PUT") {
        return new Response(JSON.stringify(storedContract), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      putCount += 1;
      if (putCount === 1) {
        return new Response(JSON.stringify({
          error: "forbidden",
          message: "Initial draft refused.",
        }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
      }
      if (putCount === 5) {
        persistBody(body);
        return new Response(null, { status: 204 });
      }
      return new Promise<Response>((resolve) => deferredResolvers.push(resolve));
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} onAnswerChange={vi.fn()} />);

    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="preview-response-free-text-question"]')).not.toBeNull());
    const input = activeContainer!.querySelector('[data-testid="preview-response-free-text-question"]');
    fireEvent.change(input!, { target: { value: "initial failure" } });
    await waitFor(() => expect(activeContainer?.querySelector('[role="alert"]')?.textContent).toContain("Initial draft refused"));

    fireEvent.change(input!, { target: { value: "older pending value" } });
    await waitFor(() => expect(calls).toHaveLength(3));
    fireEvent.change(input!, { target: { value: "latest value" } });
    const saveDraftButton = [...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.trim().toLowerCase() === "save draft");
    expect(saveDraftButton).toBeDefined();
    fireEvent.click(saveDraftButton!);
    expect(calls).toHaveLength(3);

    deferredResolvers[0](new Response(JSON.stringify({
      error: "server_error",
      message: "Earlier queued update failed.",
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    }));
    await waitFor(() => expect(calls).toHaveLength(4));
    expect(calls[3].body).toEqual({
      answers: [{ questionUuid: "free-text-question", value: "latest value" }],
    });
    expect(calls).toHaveLength(4);

    persistBody(calls[3].body!);
    deferredResolvers[1](new Response(null, { status: 204 }));
    await waitFor(() => expect(calls).toHaveLength(5));
    expect(calls[4].body).toEqual({
      answers: [{ questionUuid: "single-question", value: "b", comment: "Signed after review" }, {
        questionUuid: "free-text-question",
        value: "latest value",
      }],
      sectionComment: "Section note",
    });
    expect(activeContainer?.querySelector('[role="alert"]')?.textContent).toContain("Initial draft refused");

    deferredResolvers[2](new Response(JSON.stringify({
      error: "forbidden",
      message: "Latest draft refused.",
    }), {
      status: 403,
      headers: { "content-type": "application/json" },
    }));
    await waitFor(() => expect(activeContainer?.querySelector('[role="alert"]')?.textContent).toContain("Latest draft refused"));

    const currentInput = activeContainer!.querySelector('[data-testid="preview-response-free-text-question"]')!;
    fireEvent.change(currentInput, { target: { value: "recovered latest value" } });
    await waitFor(() => expect(calls).toHaveLength(6));
    await waitFor(() => expect(activeContainer?.querySelector('[role="alert"]')).toBeNull());
    expect(calls[5].body).toEqual({
      answers: [{ questionUuid: "free-text-question", value: "recovered latest value" }],
    });
    expect(storedContract.answers.find((answer) => answer.questionUuid === "free-text-question")?.answerValue)
      .toBe("recovered latest value");
  });

  it("round-trips scalar strings and typed checkbox/multi-select answers losslessly across save and reload", async () => {
    const initialContract = losslessAnswerContract();
    let storedContract = initialContract;
    const writes: unknown[] = [];
    const expectedAnswers = [
      { questionUuid: "text-true", value: "true" },
      { questionUuid: "text-false", value: "false" },
      { questionUuid: "text-quoted", value: '"quoted answer"' },
      { questionUuid: "text-array", value: '["a","b"]' },
      { questionUuid: "checkbox-answer", value: true },
      { questionUuid: "checkbox-false-answer", value: false },
      { questionUuid: "multi-answer", value: ["a", "b"] },
      { questionUuid: "date-answer", value: "2025-03-09" },
      { questionUuid: "number-answer", value: "12.50" },
    ] as const;

    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method || init.method === "GET") {
        return new Response(JSON.stringify(storedContract), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      const body = JSON.parse(String(init.body)) as {
        answers: Array<{ questionUuid: string; value: string | string[] | boolean }>;
      };
      writes.push(body);
      storedContract = {
        ...storedContract,
        answers: storedContract.answers.map((answer) => {
          const update = body.answers.find((candidate) => candidate.questionUuid === answer.questionUuid);
          if (!update) return answer;
          return {
            ...answer,
            answerValue: Array.isArray(update.value)
              ? JSON.stringify(update.value)
              : String(update.value),
          };
        }),
      };
      return new Response(null, { status: 204 });
    }));

    const beforeSave = mapCompanySubmissionForm(await fetchCompanySubmissionForm(submissionUuid));
    expect(beforeSave.answers).toMatchObject(Object.fromEntries(
      expectedAnswers.map((answer) => [answer.questionUuid, answer.value]),
    ));
    await saveCompanySubmissionDraft(submissionUuid, "section-a", { answers: expectedAnswers });

    const afterReload = mapCompanySubmissionForm(await fetchCompanySubmissionForm(submissionUuid));
    expect(afterReload.answers).toMatchObject(Object.fromEntries(
      expectedAnswers.map((answer) => [answer.questionUuid, answer.value]),
    ));
    const reloadAnswers = expectedAnswers.map((answer) => {
      const value = afterReload.answers[answer.questionUuid];
      if (value === undefined) throw new Error(`Missing reloaded answer ${answer.questionUuid}`);
      return { questionUuid: answer.questionUuid, value };
    });
    await saveCompanySubmissionDraft(submissionUuid, "section-a", { answers: reloadAnswers });

    expect(writes).toEqual([
      { answers: expectedAnswers },
      { answers: expectedAnswers },
    ]);
  });

  it("clears date and number answers as null and reloads them as blank controls", async () => {
    let storedContract = losslessAnswerContract();
    const calls: Array<{ url: string; method: string; body?: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) as {
        answers: Array<{ questionUuid: string; value: string | string[] | boolean | null }>;
      } : undefined;
      calls.push({ url: String(input), method, body });
      if (method === "PUT") {
        storedContract = {
          ...storedContract,
          answers: storedContract.answers.map((answer) => {
            const update = body?.answers.find((candidate) => candidate.questionUuid === answer.questionUuid);
            if (!update) return answer;
            return {
              ...answer,
              answerValue: update.value === null
                ? null
                : Array.isArray(update.value)
                  ? JSON.stringify(update.value)
                  : String(update.value),
            };
          }),
        };
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify(storedContract), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} onAnswerChange={vi.fn()} />);

    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="preview-response-date-answer"]')).not.toBeNull());
    const dateInput = activeContainer?.querySelector('[data-testid="preview-response-date-answer"]');
    const numberInput = activeContainer?.querySelector('[data-testid="preview-response-number-answer"]');
    expect(dateInput).toHaveProperty("value", "2025-03-09");
    expect(numberInput).toHaveProperty("value", "12.50");
    fireEvent.change(dateInput!, { target: { value: "" } });
    fireEvent.change(numberInput!, { target: { value: "" } });

    await waitFor(() => expect(calls).toHaveLength(3));
    expect(calls[1].body).toEqual({
      answers: [{ questionUuid: "date-answer", value: null }],
    });
    expect(calls[2].body).toEqual({
      answers: [{ questionUuid: "number-answer", value: null }],
    });
    expect(storedContract.answers.find((answer) => answer.questionUuid === "date-answer")?.answerValue).toBeNull();
    expect(storedContract.answers.find((answer) => answer.questionUuid === "number-answer")?.answerValue).toBeNull();

    act(() => activeRoot?.unmount());
    activeRoot = null;
    activeQueryClient?.clear();
    activeQueryClient = null;
    activeContainer?.remove();
    activeContainer = null;
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} onAnswerChange={vi.fn()} />);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="preview-response-date-answer"]')).not.toBeNull());
    expect(activeContainer!.querySelector('[data-testid="preview-response-date-answer"]')).toHaveProperty("value", "");
    expect(activeContainer!.querySelector('[data-testid="preview-response-number-answer"]')).toHaveProperty("value", "");
    expect(calls.filter((call) => call.method === "GET")).toHaveLength(2);
  });

  it("surfaces corrupt typed persisted answers instead of silently coercing them", async () => {
    const contract = losslessAnswerContract();
    const corrupted: CompanySubmissionRenderView = {
      ...contract,
      answers: contract.answers.map((answer) => answer.questionUuid === "multi-answer"
        ? { ...answer, answerValue: "[1, true]" }
        : answer),
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(corrupted), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);

    await waitFor(() => expect(activeContainer?.querySelector('[role="alert"]')?.textContent)
      .toContain("Corrupt persisted multi_select answer"));
  });

  it("waits for queued answer saves before submitting, then refetches persisted completion", async () => {
    let stored = formContract();
    stored.parts[0].sections[0].canSubmit = true;
    let resolveFirstDraft!: (response: Response) => void;
    let resolveSectionSubmit!: (response: Response) => void;
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (method === "GET") {
        return new Response(JSON.stringify(stored), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (method === "PUT") {
        if (calls.filter((call) => call.method === "PUT").length === 1) {
          return new Promise<Response>((resolve) => { resolveFirstDraft = resolve; });
        }
        return new Response(null, { status: 204 });
      }
      if (method === "POST") {
        stored = {
          ...stored,
          submission: { ...stored.submission, status: "completed", canEdit: false },
          states: stored.states.map((state) => ({ ...state, status: "submitted" })),
          parts: stored.parts.map((part) => ({
            ...part,
            sections: part.sections.map((section) => ({ ...section, canSubmit: false })),
          })),
        };
        return new Promise<Response>((resolve) => { resolveSectionSubmit = resolve; });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }));

    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="preview-response-free-text-question"]')).not.toBeNull());
    fireEvent.change(activeContainer!.querySelector('[data-testid="preview-response-free-text-question"]')!, {
      target: { value: "Declaration response" },
    });
    await waitFor(() => expect(calls.filter((call) => call.method === "PUT")).toHaveLength(1));

    fireEvent.click([...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "Submit")!);
    await waitFor(() => expect(document.querySelector('[role="alertdialog"]')).not.toBeNull());
    fireEvent.click([...document.querySelectorAll('[role="alertdialog"] button')]
      .find((button) => button.textContent?.trim() === "Submit")!);
    await waitFor(() => expect(calls.filter((call) => call.method === "PUT")).toHaveLength(1));
    expect(calls.some((call) => call.method === "POST")).toBe(false);

    await act(async () => {
      resolveFirstDraft(new Response(null, { status: 204 }));
    });
    await waitFor(() => expect(calls.some((call) => call.method === "POST")).toBe(true));
    expect(calls.filter((call) => call.method === "PUT")).toHaveLength(2);
    const pendingSubmit = [...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Submitting…"));
    expect(pendingSubmit).toBeDefined();
    expect(pendingSubmit).toHaveProperty("disabled", true);
    fireEvent.click(pendingSubmit!);
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(1);
    expect(calls.find((call) => call.method === "POST")).toMatchObject({
      url: `/api/v2/company-form-submissions/${submissionUuid}/sections/section-a/submit`,
      body: undefined,
    });
    await act(async () => {
      resolveSectionSubmit(new Response(JSON.stringify({ status: "completed" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));
    });
    await waitFor(() => expect(calls.filter((call) => call.method === "GET")).toHaveLength(2));
    expect(activeContainer?.textContent).toContain("Complete");
    expect(activeContainer!.querySelector('[data-testid="preview-response-free-text-question"]')).toHaveProperty("readOnly", true);
  });

  it("does not offer section submission for a purely informational Company section", async () => {
    const contract = formContract();
    contract.parts[0].sections[0].requiresSubmission = false;
    contract.parts[0].sections[0].questions = contract.parts[0].sections[0].questions
      .filter((question) => question.responseType === "content" || question.responseType === "system_field");
    contract.answers = [];
    contract.submission.canEdit = true;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(contract), {
      status: 200,
      headers: { "content-type": "application/json" },
    })));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);

    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="configured-form-live"]')).not.toBeNull());
    expect(activeContainer?.textContent).toContain("Informational");
    expect([...activeContainer!.querySelectorAll("button")].some((button) =>
      ["Submit", "Save draft"].includes(button.textContent?.trim() ?? ""))).toBe(false);
  });

  it("shows the exact changed-record notice and navigates to the linked void replacement", async () => {
    const voidedUuid = "827cb116-6c78-4f1b-9ae5-fc4327085fdd";
    const contract = formContract({
      submission: {
        ...formContract().submission,
        submissionUuid: voidedUuid,
        status: "voided",
        canEdit: false,
        voidReason: "Corrected source details",
        replacedBySubmissionUuid: submissionUuid,
        replacesSubmissionUuid: "571a155b-3790-4f18-a17b-6a8b38ecff9f",
      },
      systemValuesChanged: true,
      systemValuesChangedNotice: "The record has changed since signing began. This declaration shows the values at the time of first signature.",
      voidedReplacement: {
        label: "Voided — replaced by",
        submissionUuid,
      },
      replacementHistory: [
        { direction: "replaced_by", label: "Voided — replaced by", submissionUuid, targetLabel: "Replacement declaration — 03-Oct-2026 — Test Seafarer" },
        { direction: "replaces", label: "Replaces a voided submission", submissionUuid: "571a155b-3790-4f18-a17b-6a8b38ecff9f" },
      ],
    });
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      return new Response(JSON.stringify(url.includes(voidedUuid)
        ? contract
        : formContract()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));
    mount(<CompanySubmissionRenderer submissionUuid={voidedUuid} />);

    await waitFor(() => expect(activeContainer?.textContent).toContain("The record has changed since signing began. This declaration shows the values at the time of first signature."));
    expect(activeContainer?.textContent).toContain("Voided — replaced by");
    expect(activeContainer?.textContent).toContain("Replaces a voided submission");
    expect(activeContainer?.textContent).toContain("Reason: Corrected source details");
    fireEvent.click([...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Replacement declaration — 03-Oct-2026"))!);
    await waitFor(() => expect(calls).toContain(`/api/v2/company-form-submissions/${submissionUuid}/form`));
  });

  it("deletes a signature by its section-signature UUID rather than its attachment asset UUID", async () => {
    const sectionSignatureUuid = "20f66d4d-cd8e-40b4-9ef8-663f2b4d8d13";
    const attachmentAssetUuid = "6da6bcd3-0bd7-4fb3-8a6a-7da0d9c9db43";
    const signed = formContract();
    signed.parts[0].sections[0].signatureOfficerRequired = true;
    signed.states[0].signatures = [{
      sectionSignatureUuid,
      signatureType: "officer",
      signerName: "Office witness",
      signerRank: null,
      witnessName: null,
      signedAt: "2026-06-01T12:00:00.000Z",
      signedByUuid: "actor-office",
      signatureMethod: "officer",
      attachment: {
        assetUuid: attachmentAssetUuid,
        fileName: "signature.png",
        fileType: "image/png",
        fileSize: "128",
        rawUrl: `/api/v2/company-form-submissions/${submissionUuid}/attachments/${attachmentAssetUuid}/raw`,
      },
    }];
    let stored = signed;
    const calls: Array<{ method: string; url: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      calls.push({ method, url });
      if (method === "GET" && url.endsWith("/raw")) {
        return new Response(new Blob(["png"]), { status: 200, headers: { "content-type": "image/png" } });
      }
      if (method === "GET") {
        return new Response(JSON.stringify(stored), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (method === "DELETE") {
        stored = {
          ...stored,
          states: stored.states.map((state) => ({ ...state, signatures: [] })),
        };
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);

    await waitFor(() => expect([...activeContainer!.querySelectorAll("button")]
      .some((button) => button.textContent?.includes("Remove signature"))).toBe(true));
    fireEvent.click([...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Remove signature"))!);

    const deleteUrl = `/api/v2/company-form-submissions/${submissionUuid}/sections/section-a/signatures/${sectionSignatureUuid}`;
    await waitFor(() => expect(calls).toContainEqual({ method: "DELETE", url: deleteUrl }));
    expect(calls.some((call) => call.method === "DELETE" && call.url.includes(attachmentAssetUuid))).toBe(false);
  });

  it("persists a successful signature before showing its frozen values and changed-record notice", async () => {
    const contract = formContract();
    contract.signatureMethodOptions = { officer: [{ method: "officer", label: "Company representative" }] };
    contract.parts[0].sections[0].signatureOfficerRequired = true;
    contract.parts[0].sections[0].canSign = { officer: true };
    let stored = contract;
    const calls: Array<{ method: string; url: string; body?: Record<string, unknown> }> = [];
    const signatureUuid = "20f66d4d-cd8e-40b4-9ef8-663f2b4d8d13";
    const assetUuid = "6da6bcd3-0bd7-4fb3-8a6a-7da0d9c9db43";
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D));
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,c2lnbmF0dXJl");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
      calls.push({ method, url, body });
      if (method === "GET" && url.endsWith("/raw")) {
        return new Response(new Blob(["png"]), { status: 200, headers: { "content-type": "image/png" } });
      }
      if (method === "GET") {
        return new Response(JSON.stringify(stored), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "PUT") return new Response(null, { status: 204 });
      if (method === "POST") {
        expect(body).toEqual({
          signatureType: "officer",
          method: "officer",
          data: "data:image/png;base64,c2lnbmF0dXJl",
        });
        stored = {
          ...stored,
          systemValuesChanged: true,
          systemValuesChangedNotice: "The record has changed since signing began. This declaration shows the values at the time of first signature.",
          systemFields: stored.systemFields.map((field) => ({
            ...field,
            value: "Frozen Seafarer",
            valueOrigin: "frozen_snapshot",
          })),
          parts: stored.parts.map((part) => ({
            ...part,
            sections: part.sections.map((section) => ({
              ...section,
              questions: section.questions.map((question) => question.systemField
                ? {
                  ...question,
                  systemField: { ...question.systemField, value: "Frozen Seafarer", valueOrigin: "frozen_snapshot" },
                }
                : question),
            })),
          })),
          states: stored.states.map((state) => ({
            ...state,
            signatures: [{
              sectionSignatureUuid: signatureUuid,
              signatureType: "officer",
              signerName: "Server-derived office signer",
              signerRank: null,
              witnessName: null,
              signedAt: "2026-06-01T12:00:00.000Z",
              signedByUuid: "office-actor",
              signatureMethod: "officer",
              attachment: {
                assetUuid,
                fileName: "signature.png",
                fileType: "image/png",
                fileSize: "128",
                rawUrl: `/api/v2/company-form-submissions/${submissionUuid}/attachments/${assetUuid}/raw`,
              },
            }],
          })),
        };
        return new Response(JSON.stringify({}), { status: 201, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="live-signature-officer-section-a"]')).not.toBeNull());
    const canvas = activeContainer!.querySelector("canvas[aria-label='Signature canvas']")!;
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 1, clientY: 1 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.click([...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Save signature"))!);

    await waitFor(() => expect(calls.some((call) => call.method === "POST")).toBe(true));
    await waitFor(() => expect(activeContainer?.textContent).toContain("The record has changed since signing began. This declaration shows the values at the time of first signature."));
    expect(activeContainer?.querySelector('[data-testid="preview-content-system-question"]')?.textContent)
      .toContain("Frozen Seafarer");
    await waitFor(() => expect(activeContainer?.textContent).toContain("Server-derived office signer"));
    expect(calls.filter((call) => call.method === "GET" && call.url.endsWith("/form"))).toHaveLength(2);
    expect(activeContainer!.querySelector('[data-testid="preview-response-free-text-question"]')).toHaveProperty("readOnly", false);
  });

  it("preserves newer edits and explicit clears in another section across a signature refetch and an older autosave acknowledgement", async () => {
    const contract = withSecondPart();
    contract.signatureMethodOptions = { officer: [{ method: "officer", label: "Company representative" }] };
    contract.parts[0].sections[0].signatureOfficerRequired = true;
    contract.parts[0].sections[0].canSign = { officer: true };
    const sectionB = contract.parts[1].sections[0];
    sectionB.commentBoxRequired = true;
    sectionB.questions.push({
      questionUuid: "cleared-answer-question",
      questionCode: "B1.2",
      questionText: "Answer to clear",
      contentHtml: null,
      systemFieldKey: null,
      responseType: "free_text",
      isMandatory: false,
      commentEnabled: false,
      optionSetUuid: null,
      sortOrder: 1,
      options: [],
      systemField: null,
    });
    contract.states.find((state) => state.sectionUuid === "section-b")!.sectionComment = "Saved section comment";
    contract.answers.push({
      answerUuid: "answer-second-part",
      questionUuid: "second-part-question",
      answerValue: "Saved B answer",
      answerComment: "Saved point comment",
      createdAt: null,
      updatedAt: null,
    }, {
      answerUuid: "answer-cleared",
      questionUuid: "cleared-answer-question",
      answerValue: "Previously saved answer",
      answerComment: null,
      createdAt: null,
      updatedAt: null,
    });
    const signatureUuid = "62b783bd-6503-4b8b-ac45-8a37397d1672";
    const assetUuid = "b1ba6d88-eb1b-4c91-85a7-bf022bff166e";
    const calls: Array<{ method: string; url: string; body?: Record<string, unknown> }> = [];
    const sectionBWrites: Array<Record<string, unknown>> = [];
    let firstSectionBBody: Record<string, unknown> | undefined;
    let releaseFirstSectionBWrite: (() => void) | undefined;
    let releaseSignatureRefetch: (() => void) | undefined;
    let formGetCount = 0;
    let completedSectionBWrites = 0;
    const applyDraft = (body: Record<string, unknown>, sectionUuid: string) => {
      const answers = body.answers as Array<{
        questionUuid: string;
        value: ConfiguredFormAnswerValue | null;
        comment?: string;
      }>;
      for (const answer of answers) {
        let stored = contract.answers.find((item) => item.questionUuid === answer.questionUuid);
        if (!stored) {
          stored = {
            answerUuid: `answer-${answer.questionUuid}`,
            questionUuid: answer.questionUuid,
            answerValue: null,
            answerComment: null,
            createdAt: null,
            updatedAt: null,
          };
          contract.answers.push(stored);
        }
        stored.answerValue = answer.value === null ? null : String(answer.value);
        if (answer.comment !== undefined) stored.answerComment = answer.comment;
      }
      if (body.sectionComment !== undefined) {
        contract.states.find((state) => state.sectionUuid === sectionUuid)!.sectionComment = body.sectionComment as string;
      }
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D));
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,c2lnbmF0dXJl");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
      calls.push({ method, url, body });
      if (method === "GET" && url.endsWith("/raw")) {
        return new Response(new Blob(["png"]), { status: 200, headers: { "content-type": "image/png" } });
      }
      if (method === "GET") {
        formGetCount += 1;
        const snapshot = JSON.stringify(contract);
        if (formGetCount === 2) {
          return new Promise<Response>((resolve) => {
            releaseSignatureRefetch = () => resolve(new Response(snapshot, {
              status: 200,
              headers: { "content-type": "application/json" },
            }));
          });
        }
        return new Response(snapshot, { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "PUT" && url.endsWith("/sections/section-b/answers")) {
        const write = body!;
        sectionBWrites.push(write);
        if (sectionBWrites.length === 1) {
          firstSectionBBody = write;
          return new Promise<Response>((resolve) => {
            releaseFirstSectionBWrite = () => {
              applyDraft(write, "section-b");
              completedSectionBWrites += 1;
              resolve(new Response(null, { status: 204 }));
            };
          });
        }
        applyDraft(write, "section-b");
        completedSectionBWrites += 1;
        return new Response(null, { status: 204 });
      }
      if (method === "PUT") {
        applyDraft(body!, "section-a");
        return new Response(null, { status: 204 });
      }
      if (method === "POST") {
        contract.states[0].signatures = [{
          sectionSignatureUuid: signatureUuid,
          signatureType: "officer",
          signerName: "Saved office signer",
          signerRank: null,
          witnessName: null,
          signedAt: "2026-06-01T12:00:00.000Z",
          signedByUuid: "office-actor",
          signatureMethod: "officer",
          attachment: {
            assetUuid,
            fileName: "signature.png",
            fileType: "image/png",
            fileSize: "128",
            rawUrl: `/api/v2/company-form-submissions/${submissionUuid}/attachments/${assetUuid}/raw`,
          },
        }];
        return new Response(JSON.stringify({}), { status: 201, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);

    await waitFor(() => expect(activeContainer?.querySelector('[aria-label="Company Form parts"]')).not.toBeNull());
    fireEvent.click(activeContainer!.querySelector('[aria-label="Company Form parts"] button:nth-child(2)')!);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="preview-response-second-part-question"]')).not.toBeNull());
    fireEvent.change(activeContainer!.querySelector('[data-testid="preview-response-second-part-question"]')!, {
      target: { value: "First in-flight answer" },
    });
    await waitFor(() => expect(sectionBWrites).toHaveLength(1));
    fireEvent.change(activeContainer!.querySelector('[data-testid="preview-response-second-part-question"]')!, {
      target: { value: "Newest B answer" },
    });
    fireEvent.change(activeContainer!.querySelector('[data-testid="preview-response-cleared-answer-question"]')!, {
      target: { value: "" },
    });
    fireEvent.click(activeContainer!.querySelector('[data-testid="button-preview-comment-second-part-question"]')!);
    fireEvent.click(activeContainer!.querySelector('[data-testid="preview-comment-display-second-part-question"]')!);
    fireEvent.change(activeContainer!.querySelector('[data-testid="preview-comment-second-part-question"]')!, {
      target: { value: "" },
    });
    fireEvent.change(activeContainer!.querySelector('[data-testid="preview-section-comment-input-section-b"]')!, {
      target: { value: "" },
    });

    expect(firstSectionBBody).toEqual({
      answers: [{ questionUuid: "second-part-question", value: "First in-flight answer", comment: "Saved point comment" }],
    });
    expect(sectionBWrites).toHaveLength(1);
    fireEvent.click(activeContainer!.querySelector('[aria-label="Company Form parts"] button:nth-child(1)')!);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="live-signature-officer-section-a"]')).not.toBeNull());
    const canvas = activeContainer!.querySelector("canvas[aria-label='Signature canvas']")!;
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 1, clientY: 1 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.click([...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Save signature"))!);
    await waitFor(() => expect(releaseSignatureRefetch).toBeTypeOf("function"));

    releaseFirstSectionBWrite!();
    await waitFor(() => expect(completedSectionBWrites).toBe(5));
    releaseSignatureRefetch!();
    await waitFor(() => expect(activeContainer?.textContent).toContain("Saved office signer"));

    fireEvent.click(activeContainer!.querySelector('[aria-label="Company Form parts"] button:nth-child(2)')!);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="preview-response-second-part-question"]')).toHaveProperty("value", "Newest B answer"));
    expect(activeContainer!.querySelector('[data-testid="preview-response-cleared-answer-question"]')).toHaveProperty("value", "");
    expect(activeContainer!.querySelector('[data-testid="preview-section-comment-input-section-b"]')).toHaveProperty("value", "");
    fireEvent.click(activeContainer!.querySelector('[data-testid="button-preview-comment-second-part-question"]')!);
    expect(activeContainer!.querySelector('[data-testid="preview-comment-second-part-question"]')).toHaveProperty("value", "");

    expect(activeContainer!.querySelector('[data-testid="preview-response-second-part-question"]')).toHaveProperty("value", "Newest B answer");
    expect(activeContainer!.querySelector('[data-testid="preview-response-cleared-answer-question"]')).toHaveProperty("value", "");
    expect(activeContainer!.querySelector('[data-testid="preview-section-comment-input-section-b"]')).toHaveProperty("value", "");
    expect(activeContainer!.querySelector('[data-testid="preview-comment-second-part-question"]')).toHaveProperty("value", "");

    fireEvent.click([...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "Save draft")!);
    await waitFor(() => expect(sectionBWrites).toHaveLength(6));
    expect(sectionBWrites[5]).toEqual({
      answers: [
        { questionUuid: "second-part-question", value: "Newest B answer", comment: "" },
        { questionUuid: "cleared-answer-question", value: "" },
      ],
      sectionComment: "",
    });
    expect(completedSectionBWrites).toBe(6);
    expect(contract.answers.find((answer) => answer.questionUuid === "second-part-question"))
      .toMatchObject({ answerValue: "Newest B answer", answerComment: "" });
    expect(contract.answers.find((answer) => answer.questionUuid === "cleared-answer-question")?.answerValue).toBe("");
    expect(contract.states.find((state) => state.sectionUuid === "section-b")?.sectionComment).toBe("");
  });

  it("discards uncommitted overlays when a parent submission is voided", async () => {
    const contract = withSecondPart();
    contract.submission.canVoid = true;
    const sectionB = contract.parts[1].sections[0];
    sectionB.commentBoxRequired = true;
    contract.states.find((state) => state.sectionUuid === "section-b")!.sectionComment = "Persisted section note";
    contract.answers.push({
      answerUuid: "answer-second-part",
      questionUuid: "second-part-question",
      answerValue: "Persisted B answer",
      answerComment: "Persisted B comment",
      createdAt: null,
      updatedAt: null,
    });
    let rejectPendingBSave: (() => void) | undefined;
    let sectionBWriteCount = 0;
    let formGetCount = 0;
    const calls: Array<{ method: string; url: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      calls.push({ method, url });
      if (method === "GET") {
        formGetCount += 1;
        return new Response(JSON.stringify(contract), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "PUT" && url.endsWith("/sections/section-b/answers")) {
        sectionBWriteCount += 1;
        if (contract.submission.status !== "in_progress") {
          return new Response(JSON.stringify({ message: "This submission is voided." }), { status: 403 });
        }
        return new Promise<Response>((_resolve, reject) => {
          rejectPendingBSave = () => reject(new Error("This submission is voided."));
        });
      }
      if (method === "POST" && url.endsWith("/void")) {
        contract.submission.status = "voided";
        contract.submission.canEdit = false;
        contract.submission.canVoid = false;
        contract.submission.voidReason = "The declaration was superseded.";
        contract.submission.voidedAt = "2026-06-03T12:00:00.000Z";
        contract.submission.voidedByName = "Server captured officer";
        contract.submission.voidedByDesignation = "Crewing Representative";
        contract.submission.voidedPreviousStatus = "in_progress";
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);

    await waitFor(() => expect(activeContainer?.querySelector('[aria-label="Company Form parts"]')).not.toBeNull());
    fireEvent.click(activeContainer!.querySelector('[aria-label="Company Form parts"] button:nth-child(2)')!);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="preview-response-second-part-question"]')).not.toBeNull());
    fireEvent.change(activeContainer!.querySelector('[data-testid="preview-response-second-part-question"]')!, {
      target: { value: "Uncommitted B answer" },
    });
    await waitFor(() => expect(rejectPendingBSave).toBeTypeOf("function"));
    fireEvent.click(activeContainer!.querySelector('[data-testid="button-preview-comment-second-part-question"]')!);
    fireEvent.click(activeContainer!.querySelector('[data-testid="preview-comment-display-second-part-question"]')!);
    fireEvent.change(activeContainer!.querySelector('[data-testid="preview-comment-second-part-question"]')!, {
      target: { value: "Uncommitted B comment" },
    });
    fireEvent.change(activeContainer!.querySelector('[data-testid="preview-section-comment-input-section-b"]')!, {
      target: { value: "Uncommitted B section note" },
    });

    fireEvent.click(activeContainer!.querySelector('[aria-label="Company Form parts"] button:nth-child(1)')!);
    fireEvent.change(activeContainer!.querySelector("#company-form-void-reason")!, {
      target: { value: "The declaration was superseded." },
    });
    fireEvent.click([...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.trim() === "Void submission")!);
    await waitFor(() => expect(formGetCount).toBe(2));
    await waitFor(() => expect(activeContainer?.textContent).toContain("Voided submission"));
    expect(activeContainer?.textContent).toContain("Voided by Server captured officer · Crewing Representative");
    expect(activeContainer?.textContent).toContain("03-Jun-2026 12:00:00 UTC");
    expect(activeContainer?.querySelector('[data-testid="select-preview-vessel-type"]')).toBeNull();

    fireEvent.click(activeContainer!.querySelector('[aria-label="Company Form parts"] button:nth-child(2)')!);
    const answerInput = activeContainer!.querySelector('[data-testid="preview-response-second-part-question"]')!;
    await waitFor(() => expect(answerInput).toHaveProperty("value", "Persisted B answer"));
    expect(answerInput).toHaveProperty("readOnly", true);
    expect(activeContainer!.querySelector('[data-testid="preview-section-comment-readonly-section-b"]')?.textContent)
      .toBe("Persisted section note");

    rejectPendingBSave!();
    await waitFor(() => expect(sectionBWriteCount).toBe(3));
    await waitFor(() => expect(activeContainer?.textContent).not.toContain("This submission is voided."));
    expect(activeContainer!.querySelector('[data-testid="preview-response-second-part-question"]')).toHaveProperty("value", "Persisted B answer");
    expect(activeContainer!.querySelector('[data-testid="preview-section-comment-readonly-section-b"]')?.textContent)
      .toBe("Persisted section note");
    expect(contract.answers.find((answer) => answer.questionUuid === "second-part-question"))
      .toMatchObject({ answerValue: "Persisted B answer", answerComment: "Persisted B comment" });
  });

  it("shows persisted values for a section submitted elsewhere while other sections remain editable", async () => {
    const contract = withSecondPart();
    contract.signatureMethodOptions = { officer: [{ method: "officer", label: "Company representative" }] };
    contract.parts[0].sections[0].signatureOfficerRequired = true;
    contract.parts[0].sections[0].canSign = { officer: true };
    contract.parts[1].sections[0].commentBoxRequired = true;
    contract.states.find((state) => state.sectionUuid === "section-b")!.sectionComment = "Persisted section note";
    contract.answers.push({
      answerUuid: "answer-second-part",
      questionUuid: "second-part-question",
      answerValue: "Persisted B answer",
      answerComment: "Persisted B comment",
      createdAt: null,
      updatedAt: null,
    });
    const signatureUuid = "12b2f768-e019-4fdd-8961-460360a38da8";
    const assetUuid = "4b2d98cf-cf9c-42a1-8e53-11ad1b8c13df";
    let rejectPendingBSave: (() => void) | undefined;
    let sectionBWriteCount = 0;
    let formGetCount = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D));
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,c2lnbmF0dXJl");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
      if (method === "GET" && url.endsWith("/raw")) {
        return new Response(new Blob(["png"]), { status: 200, headers: { "content-type": "image/png" } });
      }
      if (method === "GET") {
        formGetCount += 1;
        return new Response(JSON.stringify(contract), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "PUT" && url.endsWith("/sections/section-b/answers")) {
        sectionBWriteCount += 1;
        if (sectionBWriteCount === 1) {
          return new Promise<Response>((_resolve, reject) => {
            rejectPendingBSave = () => reject(new Error("This section has already been submitted."));
          });
        }
        return new Response(JSON.stringify({ message: "This section has already been submitted." }), { status: 403 });
      }
      if (method === "PUT") return new Response(null, { status: 204 });
      if (method === "POST") {
        contract.states[0].signatures = [{
          sectionSignatureUuid: signatureUuid,
          signatureType: "officer",
          signerName: "Saved office signer",
          signerRank: null,
          witnessName: null,
          signedAt: "2026-06-03T12:00:00.000Z",
          signedByUuid: "office-actor",
          signatureMethod: "officer",
          attachment: {
            assetUuid,
            fileName: "signature.png",
            fileType: "image/png",
            fileSize: "128",
            rawUrl: `/api/v2/company-form-submissions/${submissionUuid}/attachments/${assetUuid}/raw`,
          },
        }];
        contract.states.find((state) => state.sectionUuid === "section-b")!.status = "submitted";
        return new Response(JSON.stringify({}), { status: 201, headers: { "content-type": "application/json" } });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);

    await waitFor(() => expect(activeContainer?.querySelector('[aria-label="Company Form parts"]')).not.toBeNull());
    fireEvent.click(activeContainer!.querySelector('[aria-label="Company Form parts"] button:nth-child(2)')!);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="preview-response-second-part-question"]')).not.toBeNull());
    fireEvent.change(activeContainer!.querySelector('[data-testid="preview-response-second-part-question"]')!, {
      target: { value: "Uncommitted B answer" },
    });
    await waitFor(() => expect(rejectPendingBSave).toBeTypeOf("function"));
    fireEvent.click(activeContainer!.querySelector('[data-testid="button-preview-comment-second-part-question"]')!);
    fireEvent.click(activeContainer!.querySelector('[data-testid="preview-comment-display-second-part-question"]')!);
    fireEvent.change(activeContainer!.querySelector('[data-testid="preview-comment-second-part-question"]')!, {
      target: { value: "Uncommitted B comment" },
    });
    fireEvent.change(activeContainer!.querySelector('[data-testid="preview-section-comment-input-section-b"]')!, {
      target: { value: "Uncommitted B section note" },
    });

    fireEvent.click(activeContainer!.querySelector('[aria-label="Company Form parts"] button:nth-child(1)')!);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="live-signature-officer-section-a"]')).not.toBeNull());
    const canvas = activeContainer!.querySelector("canvas[aria-label='Signature canvas']")!;
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 1, clientY: 1 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.click([...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Save signature"))!);
    await waitFor(() => expect(formGetCount).toBe(2));
    await waitFor(() => expect(activeContainer?.textContent).toContain("Saved office signer"));

    fireEvent.click(activeContainer!.querySelector('[aria-label="Company Form parts"] button:nth-child(2)')!);
    const answerInput = activeContainer!.querySelector('[data-testid="preview-response-second-part-question"]')!;
    await waitFor(() => expect(answerInput).toHaveProperty("value", "Persisted B answer"));
    expect(answerInput).toHaveProperty("readOnly", true);
    expect(activeContainer?.textContent).toContain("Submitted");
    expect(activeContainer!.querySelector('[data-testid="preview-section-comment-readonly-section-b"]')?.textContent)
      .toBe("Persisted section note");

    fireEvent.click(activeContainer!.querySelector('[aria-label="Company Form parts"] button:nth-child(1)')!);
    expect(activeContainer!.querySelector('[data-testid="preview-response-free-text-question"]')).toHaveProperty("readOnly", false);
    rejectPendingBSave!();
    await waitFor(() => expect(sectionBWriteCount).toBe(3));
    expect(activeContainer?.textContent).not.toContain("This section has already been submitted.");
    expect(contract.submission.status).toBe("in_progress");
  });

  it("keeps a rejected signature transient and reports the server error without freezing stale client state", async () => {
    const contract = formContract();
    contract.signatureMethodOptions = { officer: [{ method: "officer", label: "Company representative" }] };
    contract.parts[0].sections[0].signatureOfficerRequired = true;
    contract.parts[0].sections[0].canSign = { officer: true };
    const calls: Array<{ method: string; url: string }> = [];
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      clearRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D));
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,c2lnbmF0dXJl");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      calls.push({ method, url });
      if (method === "GET") return new Response(JSON.stringify(contract), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
      if (method === "PUT") return new Response(null, { status: 204 });
      if (method === "POST") return new Response(JSON.stringify({
        error: "forbidden",
        message: "Only an authorized officer may sign this section.",
      }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
      throw new Error(`Unexpected request: ${method} ${url}`);
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="live-signature-officer-section-a"]')).not.toBeNull());
    const canvas = activeContainer!.querySelector("canvas[aria-label='Signature canvas']")!;
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 1, clientY: 1 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.click([...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Save signature"))!);

    await waitFor(() => expect(activeContainer?.textContent).toContain("Only an authorized officer may sign this section."));
    expect(calls.filter((call) => call.method === "GET" && call.url.endsWith("/form"))).toHaveLength(1);
    expect(activeContainer?.textContent).not.toContain("Server-derived office signer");
    expect(activeContainer?.textContent).not.toContain("record has changed since signing began");
    expect(activeContainer?.querySelector('[data-testid="live-signature-officer-section-a"]')).not.toBeNull();
  });

  it("refreshes a cached exact original on reciprocal navigation without resolving a latest version", async () => {
    const targetUuid = "cached-original";
    const source = formContract({ replacementHistory: [{
      direction: "replaces", label: "Replaces a voided submission", submissionUuid: targetUuid,
      targetLabel: "Actual original — Created 01-May-2026 — Voided by Saved Office",
    }] });
    const stale = formContract({ submission: { ...source.submission, submissionUuid: targetUuid, status: "voided" }, replacementHistory: [] });
    const fresh = { ...stale, replacementHistory: [{
      direction: "replaced_by" as const, label: "Voided — replaced by", submissionUuid,
      targetLabel: "Actual replacement — Declaration 03-Oct-2026 — Voided by Saved Office",
    }] };
    const fetch = vi.fn(async (input: RequestInfo | URL) =>
      new Response(JSON.stringify(String(input).includes(targetUuid) ? fresh : source), {
        status: 200, headers: { "content-type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetch);
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);
    await waitFor(() => expect(activeContainer?.textContent).toContain("Actual original"));
    activeQueryClient!.setDefaultOptions({ queries: { retry: false, staleTime: Infinity, gcTime: Infinity } });
    activeQueryClient!.setQueryData(["company-form-submission-form", targetUuid], stale);
    const link = [...activeContainer!.querySelectorAll("button")].find(b => b.textContent === source.replacementHistory![0].targetLabel)!;
    fireEvent.click(link);
    await waitFor(() => expect(activeContainer?.textContent).toContain(fresh.replacementHistory[0].targetLabel));
    expect(fetch.mock.calls.some(([url]) => String(url) === `/api/v2/company-form-submissions/${targetUuid}/form`)).toBe(true);
    expect(fetch.mock.calls.every(([url]) => !String(url).includes("/admin/"))).toBe(true);
  });

  it("keeps a late signature-only viewer answer-locked and saves only the missing Vessel Management signature", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({
      beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(), clearRect: vi.fn(),
    }) as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,dGVzdA==");
    const contract = formContract();
    contract.submission.canEdit = false;
    contract.submission.canVoid = false;
    contract.submission.stageKey = "at_sign_off";
    contract.version.stageKey = "at_sign_off";
    contract.version.stageLabel = "At sign-off";
    const section = contract.parts[0].sections[0];
    section.canEdit = false;
    section.canSubmit = false;
    section.signatureVesselManagementRequired = true;
    section.canSign = { officer: false, seafarer: false, vessel_management: true };
    contract.signatureMethodOptions = { vessel_management: [{ method: "vessel_management", label: "Vessel Management" }] };
    const calls: Array<{ method: string; url: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET", url = String(input);
      calls.push({ method, url });
      return new Response(JSON.stringify(method === "POST" ? {} : contract), { status: method === "POST" ? 201 : 200,
        headers: { "content-type": "application/json" } });
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} requestContext={{ crewUuid: "exact-crew" }} />);
    await waitFor(() => expect(activeContainer?.querySelector('[data-testid="live-signature-vessel_management-section-a"]')).not.toBeNull());
    expect(activeContainer!.querySelector('[data-testid="preview-response-free-text-question"]')).toHaveProperty("readOnly", true);
    expect(activeContainer!.textContent).toContain("At sign-off");
    for (const label of ["Save draft", "Submit", "Remove signature", "Void submission"]) {
      expect([...activeContainer!.querySelectorAll("button")].some(button => button.textContent === label)).toBe(false);
    }
    const canvas = activeContainer!.querySelector("canvas[aria-label='Signature canvas']")!;
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 1, clientY: 1 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    fireEvent.click([...activeContainer!.querySelectorAll("button")].find(button => button.textContent?.includes("Save signature"))!);
    await waitFor(() => expect(calls.some(call => call.method === "POST")).toBe(true));
    expect(calls.filter(call => call.method !== "GET")).toEqual([{ method: "POST",
      url: `/api/v2/company-form-submissions/${submissionUuid}/sections/section-a/signatures?crewUuid=exact-crew` }]);
  });

  it("requires explicit retirement confirmation and cancellation performs no write", async () => {
    const current = formContract();
    current.submission.stageKey = "on_board";
    current.submission.canVoid = true;
    current.form.archivedAt = "2026-10-03T09:36:28.067Z";
    let writes = 0;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        writes++;
        expect(JSON.parse(String(init.body))).toEqual({
          reason: "Test retirement", retirementConfirmedAt: current.form.archivedAt,
        });
        current.submission.status = "voided";
        current.submission.canVoid = false;
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify(current), { headers: { "content-type": "application/json" } });
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);
    await waitFor(() => expect(activeContainer?.querySelector("#company-form-void-reason")).not.toBeNull());
    fireEvent.change(activeContainer!.querySelector("#company-form-void-reason")!, { target: { value: "Test retirement" } });
    const voidButton = [...activeContainer!.querySelectorAll("button")].find(b => b.textContent === "Void submission")!;
    fireEvent.click(voidButton);
    const warning = "This form has been retired. Voiding will not allow a replacement on this form.";
    await waitFor(() => expect(document.body.textContent).toContain(warning));
    expect(writes).toBe(0);
    fireEvent.click([...document.body.querySelectorAll("button")].find(b => b.textContent === "Cancel")!);
    await waitFor(() => expect(document.body.textContent).not.toContain(warning));
    expect(writes).toBe(0);
    expect(current.submission.status).toBe("in_progress");
    fireEvent.click(voidButton);
    await waitFor(() => expect(document.body.textContent).toContain(warning));
    fireEvent.click([...document.body.querySelectorAll("button")].find(b => b.textContent === "Confirm void")!);
    await waitFor(() => expect(activeContainer?.textContent).toContain("No replacement — form retired"));
    expect(writes).toBe(1);
  });

  it.each([
    { retired: true, replacement: null, stage: "on_board", expected: true },
    { retired: true, replacement: "related-id", stage: "on_board", expected: false },
    { retired: false, replacement: null, stage: "on_board", expected: false },
    { retired: true, replacement: null, stage: "before_joining", expected: false },
  ])("limits the retired placeholder to the correct history state: %j", async ({ retired, replacement, stage, expected }) => {
    const current = formContract();
    current.submission.status = "voided";
    current.submission.stageKey = stage;
    current.submission.replacedBySubmissionUuid = replacement;
    current.form.archivedAt = retired ? "2026-10-03T09:36:28.067Z" : null;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(current), {
      headers: { "content-type": "application/json" },
    })));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);
    await waitFor(() => expect(activeContainer?.textContent).toContain("Voided"));
    expect(activeContainer?.textContent?.includes("No replacement — form retired")).toBe(expected);
  });

  it("checks fresh server retirement state before writing, rather than the initial render", async () => {
    const current = formContract();
    current.submission.stageKey = "on_board";
    current.submission.canVoid = true;
    let reads = 0;
    let writes = 0;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") { writes++; return new Response(null, { status: 204 }); }
      reads++;
      if (reads > 1) current.form.archivedAt = "2026-10-03T10:00:00.000Z";
      return new Response(JSON.stringify(current), { headers: { "content-type": "application/json" } });
    }));
    mount(<CompanySubmissionRenderer submissionUuid={submissionUuid} />);
    await waitFor(() => expect(activeContainer?.querySelector("#company-form-void-reason")).not.toBeNull());
    fireEvent.change(activeContainer!.querySelector("#company-form-void-reason")!, { target: { value: "Intervening archive" } });
    fireEvent.click([...activeContainer!.querySelectorAll("button")].find(b => b.textContent === "Void submission")!);
    await waitFor(() => expect(document.body.textContent).toContain("This form has been retired. Voiding will not allow a replacement on this form."));
    expect(writes).toBe(0);
  });

  it("requires a void reason, shows server denial, then voids and follows both sides of a replacement", async () => {
    const voidedUuid = "827cb116-6c78-4f1b-9ae5-fc4327085fdd";
    const replacementUuid = "c94d1113-a414-4519-8e66-46c1aeb337e5";
    const previousUuid = "571a155b-3790-4f18-a17b-6a8b38ecff9f";
    const initial = formContract({
      submission: { ...formContract().submission, submissionUuid: voidedUuid, canEdit: true },
    });
    initial.submission.canVoid = true;
    const replacement = formContract({
      submission: {
        ...formContract().submission,
        submissionUuid: replacementUuid,
        replacesSubmissionUuid: voidedUuid,
      },
      replacementHistory: [{
        direction: "replaces",
        label: "Replaces a voided submission",
        submissionUuid: voidedUuid,
      }],
    });
    replacement.submission.canVoid = true;
    let storedVoided: CompanySubmissionRenderView | undefined;
    let voidAttempts = 0;
    const calls: Array<{ method: string; url: string; body?: unknown }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (method === "GET") {
        if (url.includes(voidedUuid)) return new Response(JSON.stringify(storedVoided ?? initial), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
        if (url.includes(replacementUuid)) return new Response(JSON.stringify(replacement), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.endsWith(`/${voidedUuid}/void`)) {
        expect(body).toEqual({ reason: "Corrected source details" });
        voidAttempts += 1;
        if (voidAttempts === 1) return new Response(JSON.stringify({
          error: "forbidden",
          message: "Office crewing authorization is required.",
        }), {
          status: 403,
          headers: { "content-type": "application/json" },
        });
        storedVoided = {
          ...initial,
          submission: {
            ...initial.submission,
            status: "voided",
            canEdit: false,
            canVoid: false,
            voidReason: "Corrected source details",
            voidedAt: "2026-06-02T13:00:00.000Z",
            replacedBySubmissionUuid: replacementUuid,
            replacesSubmissionUuid: previousUuid,
          },
          voidedReplacement: {
            label: "Voided — replaced by",
            submissionUuid: replacementUuid,
          },
          replacementHistory: [
            { direction: "replaced_by", label: "Voided — replaced by", submissionUuid: replacementUuid, targetLabel: "Replacement declaration — 03-Oct-2026 — Test Seafarer" },
            { direction: "replaces", label: "Replaces a voided submission", submissionUuid: previousUuid },
          ],
        };
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected request: ${method} ${url}`);
    }));
    mount(<CompanySubmissionRenderer submissionUuid={voidedUuid} />);
    await waitFor(() => expect(activeContainer?.querySelector("#company-form-void-reason")).not.toBeNull());
    const reasonInput = activeContainer!.querySelector("#company-form-void-reason")!;
    const voidButton = [...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Void submission"))!;
    expect(voidButton).toHaveProperty("disabled", true);
    expect(calls.some((call) => call.method === "POST")).toBe(false);

    fireEvent.change(reasonInput, { target: { value: "  Corrected source details  " } });
    fireEvent.click(voidButton);
    await waitFor(() => expect(activeContainer?.textContent).toContain("Office crewing authorization is required."));
    expect(activeContainer?.querySelector("#company-form-void-reason")).toHaveProperty("value", "  Corrected source details  ");
    fireEvent.click(voidButton);
    await waitFor(() => expect(activeContainer?.textContent).toContain("Reason: Corrected source details"));
    expect(activeContainer?.textContent).toContain("Voided — replaced by");
    expect(activeContainer?.textContent).toContain("Replaces a voided submission");
    expect(calls.filter((call) => call.method === "POST")).toHaveLength(2);

    fireEvent.click([...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Replacement declaration — 03-Oct-2026"))!);
    await waitFor(() => expect(calls).toContainEqual({
      method: "GET",
      url: `/api/v2/company-form-submissions/${replacementUuid}/form`,
      body: undefined,
    }));
    await waitFor(() => expect(activeContainer?.textContent).toContain("Replaces a voided submission"));
    fireEvent.click([...activeContainer!.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("Open linked declaration — historical label unavailable"))!);
    await waitFor(() => expect(activeContainer?.textContent).toContain("Voided — replaced by"));
    expect(activeContainer?.textContent).toContain("Replacement declaration — 03-Oct-2026");
    expect(activeContainer?.textContent).not.toContain(replacementUuid);
  });
});