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
    },
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
});