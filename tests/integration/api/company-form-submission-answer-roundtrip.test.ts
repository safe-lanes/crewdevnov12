import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Client } from "pg";
import { randomUUID } from "crypto";
import type { Server } from "http";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  CompanySubmissionRenderer,
  mapCompanySubmissionForm,
  saveCompanySubmissionDraft,
} from "../../../client/src/components/configured-form/companySubmissionContract";
import type { CompanyFormSubmissionRenderContract } from "../../../shared/v2/forms-engine/submissionRenderContract";
import companyFormSubmissionsRoutes from "@server/v2/company-forms/routes";

const TEST_SECRET = "company-form-answer-roundtrip-test-secret";
const SUFFIX = randomUUID().replaceAll("-", "").slice(0, 14);
const u = () => randomUUID();
const db = new Client({ connectionString: process.env.DATABASE_URL });

const freeTextAnswers = [
  { code: "TEXT_TRUE", value: "true" },
  { code: "TEXT_FALSE", value: "false" },
  { code: "TEXT_NULL", value: "null" },
  { code: "TEXT_NUMBER", value: "42" },
  { code: "TEXT_QUOTED", value: '"literal quoted text"' },
  { code: "TEXT_ARRAY", value: '["alpha","beta"]' },
  { code: "TEXT_OBJECT", value: '{"answer":true}' },
] as const;

const checkboxAnswers = [
  { code: "CHECKBOX_TRUE", value: true },
  { code: "CHECKBOX_FALSE", value: false },
] as const;

const dateAnswer = { code: "DATE_VALUE", value: "2026-06-21" } as const;
const numberAnswer = { code: "NUMBER_VALUE", value: "42.5" } as const;
const optionalCommentOnly = {
  code: "OPTIONAL_COMMENT_ONLY",
  comment: "Comment saved before an answer exists.",
} as const;
const optionValues = ["choice-a", "choice-b"] as const;
const multiSelectAnswer = { code: "MULTI_SELECT", value: [...optionValues] };
type RoundTripAnswerValue = string | boolean | string[] | null;
type RoundTripDraftAnswer = {
  questionUuid: string;
  value: RoundTripAnswerValue;
  comment?: string;
};

let server: Server | undefined;
let officeUserId = 0;
let officeRoleUuid = "";
let crewUuid = "";
let assignmentUuid = "";
let formUuid = "";
let formVersionUuid = "";
let partUuid = "";
let sectionUuid = "";
let optionSetUuid = "";
let submissionUuid = "";
let questionUuids: string[] = [];
const questionUuidByCode: Record<string, string> = {};
const previousJwtSecret = process.env.JWT_SECRET;
const previousAuthBypass = process.env.AUTH_BYPASS;

function bearerToken(userId: number): string {
  return jwt.sign(
    { id: userId, domain: "test", userType: "Office" },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

function call(method: "get" | "post" | "put", path: string, body?: unknown) {
  let query = (request(server!) as any)[method](path)
    .set("Authorization", `Bearer ${bearerToken(officeUserId)}`);
  if (body !== undefined) query = query.send(body);
  return query;
}

function expectedAnswerValues(): Record<string, RoundTripAnswerValue> {
  return Object.fromEntries([
    ...freeTextAnswers,
    ...checkboxAnswers,
    dateAnswer,
    numberAnswer,
    { code: optionalCommentOnly.code, value: null },
    multiSelectAnswer,
  ].map(({ code, value }) => [questionUuidByCode[code], value]));
}

function answerValuesByQuestion(contract: CompanyFormSubmissionRenderContract) {
  return Object.fromEntries(contract.answers.map((answer) => [answer.questionUuid, answer.answerValue]));
}

function expectedStoredValues(values: Record<string, RoundTripAnswerValue>) {
  return Object.fromEntries(Object.entries(values).map(([questionUuid, value]) => [
    questionUuid,
    value === null ? null : Array.isArray(value) ? JSON.stringify(value) : String(value),
  ]));
}

function createClientFetchShim(beforeDispatch?: (input: {
  method: "get" | "post" | "put";
  path: string;
  body: any;
}) => Promise<void>) {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), "http://company-form.test");
    const method = (init?.method ?? "GET").toLowerCase() as "get" | "post" | "put";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    await beforeDispatch?.({ method, path: url.pathname, body });
    const response = await call(method, url.pathname, body);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.res.statusMessage ?? "",
      text: async () => response.text ?? "",
      json: async () => response.body,
    } as Response;
  };
}

async function saveThroughClientSerializer(answers: readonly RoundTripDraftAnswer[]): Promise<void> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createClientFetchShim();
  try {
    await saveCompanySubmissionDraft(submissionUuid, sectionUuid, { answers });
  } finally {
    globalThis.fetch = originalFetch;
  }
}

describe.sequential("Company Form answer round-trip through the client mapper", () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    delete process.env.AUTH_BYPASS;
    await db.connect();

    const { authMiddleware } = await import("@server/middleware/authMiddleware");
    const app = express();
    app.use(express.json());
    app.use(authMiddleware);
    // Deliberately mount no Admin routes: the Crew Database grant alone must
    // support the complete saved -> render -> mapper -> save -> render path.
    app.use("/api/v2/company-form-submissions", companyFormSubmissionsRoutes);
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", resolve);
    });

    officeRoleUuid = u();
    const roleName = `CF Answer Roundtrip ${SUFFIX}`;
    await db.query(
      `INSERT INTO adm_rolemaster_ac (ruid, assigned_role, roletype, is_active, is_deleted)
       VALUES ($1, $2, 'Office', true, false)`,
      [officeRoleUuid, roleName],
    );
    const user = await db.query(
      "INSERT INTO master_users (user_type, role) VALUES ('Office', $1) RETURNING id",
      [roleName],
    );
    officeUserId = Number(user.rows[0].id);

    const menu = await db.query(
      `SELECT muid FROM adm_menumaster_ac
       WHERE name = 'Crew Database' AND is_active = true AND is_deleted = false`,
    );
    if (menu.rowCount !== 1) throw new Error("Expected one active Crew Database menu.");
    await db.query(
      `INSERT INTO adm_roleaccess_ac
         (rauid, role_id, menu_id, canview, cancreate, canedit, candelete, is_deleted)
       VALUES ($1, $2, $3, true, true, true, false, false)`,
      [u(), officeRoleUuid, menu.rows[0].muid],
    );
    const formsGrants = await db.query(
      `SELECT count(*)::int AS total
       FROM adm_roleaccess_ac access
       JOIN adm_menumaster_ac menu ON menu.muid = access.menu_id
       WHERE access.role_id = $1
         AND access.is_deleted = false
         AND menu.name <> 'Crew Database'`,
      [officeRoleUuid],
    );
    expect(formsGrants.rows[0].total).toBe(0);

    crewUuid = u();
    assignmentUuid = u();
    await db.query(
      `INSERT INTO crew_members_v2 (crew_uuid, emp_no, first_name, family_name, is_deleted)
       VALUES ($1, $2, 'Roundtrip', $3, false)`,
      [crewUuid, `CF-RT-${SUFFIX}`, SUFFIX],
    );
    await db.query(
      `INSERT INTO crew_assignments
         (assign_uuid, crew_uuid, assignment_type, is_current, is_deleted)
       VALUES ($1, $2, 'Planned', false, false)`,
      [assignmentUuid, crewUuid],
    );

    formUuid = u();
    formVersionUuid = u();
    partUuid = u();
    sectionUuid = u();
    optionSetUuid = u();
    const form = await db.query(
      `INSERT INTO adm_forms_v2
         (form_uuid, name, category, rank_group, version_no, version_date, subject_type, is_deleted)
       VALUES ($1, $2, 'dynamic', 'Answer round-trip', '01', '2026-01-01', 'crew_assignment', false)
       RETURNING id`,
      [formUuid, `CF Answer Roundtrip ${SUFFIX}`],
    );
    await db.query(
      `INSERT INTO adm_form_versions_v2
         (fv_uuid, form_id, version_no, version_date, status, stage_key, is_deleted, released_at)
       VALUES ($1, $2, '01', '2026-01-01', 'released', 'before_joining', false, NOW())`,
      [formVersionUuid, form.rows[0].id],
    );
    await db.query(
      `INSERT INTO frm_form_parts
         (form_part_uuid, form_uuid, form_version_uuid, part_code, part_title,
          part_type, is_office_only, sort_order, is_deleted)
       VALUES ($1, $2, $3, 'PART', 'Answer round-trip part', 'configurable', false, 0, false)`,
      [partUuid, formUuid, formVersionUuid],
    );
    await db.query(
      `INSERT INTO frm_sections
         (section_uuid, form_version_uuid, form_part_uuid, section_code, section_title,
          responsible_mode, comment_box_required, signature_officer_required,
          signature_seafarer_required, layout_preference, sort_order, is_deleted)
       VALUES ($1, $2, $3, 'ANSWERS', 'Answer round-trip section',
               'not_applicable', false, false, false, 'list', 0, false)`,
      [sectionUuid, formVersionUuid, partUuid],
    );
    await db.query(
      `INSERT INTO frm_option_sets
         (option_set_uuid, form_version_uuid, set_name, low_end_label, high_end_label,
          sort_order, is_deleted)
       VALUES ($1, $2, $3, NULL, NULL, 0, false)`,
      [optionSetUuid, formVersionUuid, `Roundtrip choices ${SUFFIX}`],
    );
    for (const [sortOrder, optionValue] of optionValues.entries()) {
      await db.query(
        `INSERT INTO frm_options
           (option_uuid, option_set_uuid, option_label, option_value, sort_order, is_deleted)
         VALUES ($1, $2, $3, $3, $4, false)`,
        [u(), optionSetUuid, optionValue, sortOrder],
      );
    }

    const questionDefinitions = [
      ...freeTextAnswers.map(({ code }) => ({ code, responseType: "free_text", optionSet: null })),
      ...checkboxAnswers.map(({ code }) => ({ code, responseType: "checkbox", optionSet: null })),
      { code: dateAnswer.code, responseType: "date", optionSet: null },
      { code: numberAnswer.code, responseType: "number", optionSet: null },
      { code: optionalCommentOnly.code, responseType: "free_text", optionSet: null },
      { code: multiSelectAnswer.code, responseType: "multi_select", optionSet: optionSetUuid },
    ];
    for (const [sortOrder, question] of questionDefinitions.entries()) {
      const questionUuid = u();
      questionUuids.push(questionUuid);
      questionUuidByCode[question.code] = questionUuid;
      await db.query(
        `INSERT INTO frm_questions
           (question_uuid, section_uuid, question_code, question_text, response_type,
            is_mandatory, comment_enabled, option_set_uuid, sort_order, is_deleted)
         VALUES ($1, $2, $3, $4, $5, false, true, $6, $7, false)`,
        [
          questionUuid,
          sectionUuid,
          question.code,
          question.code,
          question.responseType,
          question.optionSet,
          sortOrder,
        ],
      );
    }
  }, 30000);

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => error ? reject(error) : resolve()));
    }
    try {
      if (submissionUuid) {
        await db.query("DELETE FROM frm_answers WHERE submission_uuid = $1", [submissionUuid]);
        await db.query("DELETE FROM frm_section_states WHERE submission_uuid = $1", [submissionUuid]);
        await db.query("DELETE FROM frm_company_submission_assignments WHERE submission_uuid = $1", [submissionUuid]);
        await db.query("DELETE FROM frm_company_submissions WHERE submission_uuid = $1", [submissionUuid]);
      }
      if (questionUuids.length) {
        await db.query("DELETE FROM frm_questions WHERE question_uuid = ANY($1::text[])", [questionUuids]);
      }
      if (sectionUuid) await db.query("DELETE FROM frm_sections WHERE section_uuid = $1", [sectionUuid]);
      if (partUuid) await db.query("DELETE FROM frm_form_parts WHERE form_part_uuid = $1", [partUuid]);
      if (optionSetUuid) {
        await db.query("DELETE FROM frm_options WHERE option_set_uuid = $1", [optionSetUuid]);
        await db.query("DELETE FROM frm_option_sets WHERE option_set_uuid = $1", [optionSetUuid]);
      }
      if (formVersionUuid) {
        await db.query("DELETE FROM adm_form_versions_v2 WHERE fv_uuid = $1", [formVersionUuid]);
      }
      if (formUuid) await db.query("DELETE FROM adm_forms_v2 WHERE form_uuid = $1", [formUuid]);
      if (assignmentUuid) await db.query("DELETE FROM crew_assignments WHERE assign_uuid = $1", [assignmentUuid]);
      if (crewUuid) await db.query("DELETE FROM crew_members_v2 WHERE crew_uuid = $1", [crewUuid]);
      if (officeUserId) await db.query("DELETE FROM master_users WHERE id = $1", [officeUserId]);
      if (officeRoleUuid) {
        await db.query("DELETE FROM adm_roleaccess_ac WHERE role_id = $1", [officeRoleUuid]);
        await db.query("DELETE FROM adm_rolemaster_ac WHERE ruid = $1", [officeRoleUuid]);
      }
    } finally {
      await db.end();
      if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousJwtSecret;
      if (previousAuthBypass === undefined) delete process.env.AUTH_BYPASS;
      else process.env.AUTH_BYPASS = previousAuthBypass;
    }
  });

  it("round-trips text, booleans, and multi-select values through the saved form mapper", async () => {
    const started = await call(
      "post",
      `/api/v2/company-form-submissions/subjects/crew_assignment/${assignmentUuid}/submissions`,
      { formUuid, formVersionUuid },
    );
    expect(started.status).toBe(201);
    submissionUuid = started.body.submissionUuid;

    const expected = expectedAnswerValues();
    const initialSave = await call(
      "put",
      `/api/v2/company-form-submissions/${submissionUuid}/sections/${sectionUuid}/answers`,
      {
        answers: Object.entries(expected).map(([questionUuid, value]) => ({
          questionUuid,
          value,
          ...(questionUuid === questionUuidByCode[optionalCommentOnly.code]
            ? { comment: optionalCommentOnly.comment }
            : {}),
        })),
      },
    );
    expect(initialSave.status).toBe(204);

    const firstRead = await call("get", `/api/v2/company-form-submissions/${submissionUuid}/form`);
    expect(firstRead.status).toBe(200);
    expect(answerValuesByQuestion(firstRead.body)).toEqual(expectedStoredValues(expected));

    const rendererModel = mapCompanySubmissionForm(firstRead.body);
    const mappedExpected = Object.fromEntries(
      Object.entries(expected).filter(([, value]) => value !== null),
    );
    expect(rendererModel.answers).toEqual(mappedExpected);
    expect(rendererModel.answerComments[questionUuidByCode[optionalCommentOnly.code]])
      .toBe(optionalCommentOnly.comment);

    await saveThroughClientSerializer([
      ...Object.entries(rendererModel.answers).map(([questionUuid, value]) => ({ questionUuid, value })),
      {
        questionUuid: questionUuidByCode[optionalCommentOnly.code],
        value: null,
        comment: rendererModel.answerComments[questionUuidByCode[optionalCommentOnly.code]],
      },
    ]);

    const changedOptionalComment = "Updated comment before an answer exists.";
    let releaseFirstDraft!: () => void;
    let signalFirstDraftStarted!: () => void;
    const firstDraftGate = new Promise<void>((resolve) => {
      releaseFirstDraft = resolve;
    });
    const firstDraftStartedSignal = new Promise<void>((resolve) => {
      signalFirstDraftStarted = resolve;
    });
    let secondDraftDispatched = false;
    const originalFetch = globalThis.fetch;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    globalThis.fetch = createClientFetchShim(async ({ method, body }) => {
      if (method !== "put") return;
      if (body.answers.some((answer: RoundTripDraftAnswer) => answer.value === "queue-first")) {
        signalFirstDraftStarted();
        await firstDraftGate;
      }
      if (body.answers.some((answer: RoundTripDraftAnswer) => answer.value === "queue-second")) {
        secondDraftDispatched = true;
      }
    });
    let mounted: ReturnType<typeof render> | undefined;
    try {
      mounted = render(React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(CompanySubmissionRenderer, {
          submissionUuid,
          onAnswerChange: () => undefined,
        }),
      ));
      const dateInput = await screen.findByTestId(`preview-response-${questionUuidByCode[dateAnswer.code]}`);
      const numberInput = screen.getByTestId(`preview-response-${questionUuidByCode[numberAnswer.code]}`);
      expect((dateInput as HTMLInputElement).value).toBe(dateAnswer.value);
      expect((numberInput as HTMLInputElement).value).toBe(numberAnswer.value);

      fireEvent.change(dateInput, { target: { value: "" } });
      fireEvent.change(numberInput, { target: { value: "" } });

      const optionalQuestionUuid = questionUuidByCode[optionalCommentOnly.code];
      fireEvent.click(screen.getByTestId(`button-preview-comment-${optionalQuestionUuid}`));
      fireEvent.click(screen.getByTestId(`preview-comment-display-${optionalQuestionUuid}`));
      fireEvent.change(screen.getByTestId(`preview-comment-${optionalQuestionUuid}`), {
        target: { value: changedOptionalComment },
      });

      await waitFor(async () => {
        const rows = await db.query(
          `SELECT question.question_code, answer.answer_value, answer.answer_comment
           FROM frm_answers answer
           JOIN frm_questions question ON question.question_uuid = answer.question_uuid
           WHERE answer.submission_uuid = $1 AND answer.is_deleted = false`,
          [submissionUuid],
        );
        const byCode = Object.fromEntries(rows.rows.map((row) => [row.question_code, row]));
        expect(byCode[dateAnswer.code]?.answer_value).toBeNull();
        expect(byCode[numberAnswer.code]?.answer_value).toBeNull();
        expect(byCode[optionalCommentOnly.code]?.answer_value).toBeNull();
        expect(byCode[optionalCommentOnly.code]?.answer_comment).toBe(changedOptionalComment);
      });

      const queuedTextInput = screen.getByTestId(`preview-response-${questionUuidByCode.TEXT_TRUE}`);
      fireEvent.change(queuedTextInput, { target: { value: "queue-first" } });
      await firstDraftStartedSignal;
      fireEvent.change(queuedTextInput, { target: { value: "queue-second" } });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(secondDraftDispatched).toBe(false);
      releaseFirstDraft();
      await waitFor(async () => {
        const row = await db.query(
          `SELECT answer_value FROM frm_answers
           WHERE submission_uuid = $1 AND question_uuid = $2 AND is_deleted = false`,
          [submissionUuid, questionUuidByCode.TEXT_TRUE],
        );
        expect(row.rows[0]?.answer_value).toBe("queue-second");
      });
    } finally {
      releaseFirstDraft();
      mounted?.unmount();
      queryClient.clear();
      globalThis.fetch = originalFetch;
    }

    const clearedValues = {
      ...expected,
      [questionUuidByCode[dateAnswer.code]]: null,
      [questionUuidByCode[numberAnswer.code]]: null,
      [questionUuidByCode.TEXT_TRUE]: "queue-second",
    };
    const mappedClearedExpected = Object.fromEntries(
      Object.entries(clearedValues).filter(([, value]) => value !== null),
    );
    const secondRead = await call("get", `/api/v2/company-form-submissions/${submissionUuid}/form`);
    expect(secondRead.status).toBe(200);
    expect(answerValuesByQuestion(secondRead.body)).toEqual(expectedStoredValues(clearedValues));
    const mappedAfterClear = mapCompanySubmissionForm(secondRead.body);
    expect(mappedAfterClear.answers).toEqual(mappedClearedExpected);
    expect(mappedAfterClear.answerComments[questionUuidByCode[optionalCommentOnly.code]])
      .toBe(changedOptionalComment);

    await saveThroughClientSerializer([
      ...Object.entries(mappedAfterClear.answers).map(([questionUuid, value]) => ({ questionUuid, value })),
      { questionUuid: questionUuidByCode[dateAnswer.code], value: null },
      { questionUuid: questionUuidByCode[numberAnswer.code], value: null },
      {
        questionUuid: questionUuidByCode[optionalCommentOnly.code],
        value: null,
        comment: mappedAfterClear.answerComments[questionUuidByCode[optionalCommentOnly.code]],
      },
    ]);

    const finalRead = await call("get", `/api/v2/company-form-submissions/${submissionUuid}/form`);
    expect(finalRead.status).toBe(200);
    expect(answerValuesByQuestion(finalRead.body)).toEqual(expectedStoredValues(clearedValues));
    const mappedFinal = mapCompanySubmissionForm(finalRead.body);
    expect(mappedFinal.answers).toEqual(mappedClearedExpected);
    expect(mappedFinal.answerComments[questionUuidByCode[optionalCommentOnly.code]])
      .toBe(changedOptionalComment);

    const persisted = await db.query(
      `SELECT question.question_code, answer.answer_value, answer.answer_comment
       FROM frm_answers answer
       JOIN frm_questions question ON question.question_uuid = answer.question_uuid
       WHERE answer.submission_uuid = $1 AND answer.is_deleted = false`,
      [submissionUuid],
    );
    expect(Object.fromEntries(persisted.rows.map((row) => [
      row.question_code,
      { answerValue: row.answer_value, answerComment: row.answer_comment },
    ])))
      .toEqual(Object.fromEntries([
        ...freeTextAnswers.map(({ code, value }) => [
          code,
          {
            answerValue: code === "TEXT_TRUE" ? "queue-second" : value,
            answerComment: null,
          },
        ]),
        ...checkboxAnswers.map(({ code, value }) => [code, { answerValue: String(value), answerComment: null }]),
        [dateAnswer.code, { answerValue: null, answerComment: null }],
        [numberAnswer.code, { answerValue: null, answerComment: null }],
        [optionalCommentOnly.code, { answerValue: null, answerComment: changedOptionalComment }],
        [multiSelectAnswer.code, { answerValue: JSON.stringify(multiSelectAnswer.value), answerComment: null }],
      ]));
  });
});