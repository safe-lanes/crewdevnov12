import { describe, expect, it } from "vitest";
import { companyFormErrorMessage, safeCompanyFormFactReason, safeCompanyFormReason } from "@/lib/companyFormErrors";

describe("Company Form safe error presentation", () => {
  it("never surfaces HTTP-prefixed JSON or its identifiers", () => {
    const message = companyFormErrorMessage(
      new Error('422: {"message":"record abc123 failed","submissionUuid":"abc123"}'),
      "save",
    );
    expect(message).toBe("Your form changes could not be saved. Check your connection and try again.");
    expect(message).not.toMatch(/422|abc123|submissionUuid|record/);
    expect(message).toMatch(/try again/);
  });

  it("never surfaces SQL or stack diagnostics", () => {
    const sqlError = companyFormErrorMessage(
      new Error("500: ERROR: relation company_form_submissions does not exist"),
      "load",
    );
    const stackReason = safeCompanyFormReason("TypeError: failed\n    at repository.save (/srv/app.js:22:9)");
    expect(sqlError).toBe("Company form details could not be loaded. Check your connection and try again.");
    expect(sqlError).not.toMatch(/500|relation|company_form_submissions/);
    expect(stackReason).not.toMatch(/TypeError|repository|srv|22/);
    expect(stackReason).toMatch(/Retry|ask an administrator/);
  });

  it("maps allowlisted structured business refusals to useful next steps", () => {
    expect(companyFormErrorMessage(
      new Error('409: {"code":"REQUIRED_ANSWERS_MISSING","message":"raw internal detail"}'),
      "submit",
    )).toBe("Complete the required answers before submitting this form.");
    expect(companyFormErrorMessage(
      new Error('409: {"code":"WITNESS_REQUIRED"}'),
      "sign",
    )).toContain("confirm the seafarer is present");
    expect(companyFormErrorMessage(
      new Error('409: {"code":"RANK_NOT_ELIGIBLE","rankUuid":"private-id"}'),
      "start",
    )).toBe("The rank could not be verified. Ask an administrator to check the assignment's contract rank and crew record, then try again.");
  });

  it("allows explicit safe assignment guidance and masks unknown backend reasons", () => {
    expect(companyFormErrorMessage(
      new Error("No exact onboard assignment is linked to this planning row. An administrator must reconcile the assignment before forms can be opened."),
      "verifyAssignment",
    )).toContain("Ask an administrator to reconcile");
    const unknownReason = safeCompanyFormReason({ reason: "SQLSTATE 23505: duplicate key" });
    expect(unknownReason).toBe("The form stage check needs attention. Retry the check or ask an administrator for help.");
    expect(unknownReason).toMatch(/Retry|ask an administrator/);
  });

  it("maps structured stage-check evidence and masks raw backend evidence", () => {
    const stageReason = safeCompanyFormReason({ failure_reason: { code: "STAGE_CHECK_INCOMPLETE" } });
    const rawReason = safeCompanyFormReason('500: {"error":"SQL query failed for assignment 3f7a"}');
    expect(stageReason).toBe("The required form stage check is not complete. Complete or retry the check before starting this form.");
    expect(stageReason).toMatch(/Complete or retry/);
    expect(rawReason).toBe("The form stage check could not record a safe explanation. Retry the check or ask an administrator for help.");
    expect(rawReason).not.toMatch(/500|SQL|assignment 3f7a/);
  });

  it("preserves allowlisted applicability release refusals without exposing payload text", () => {
    const beforeRelease = companyFormErrorMessage(
      new Error('400: {"error":"Effective-from date 2026-05-01 is earlier than release date 2026-05-08; a rule cannot claim applicability before it existed and requirements are never resolved retrospectively"}'),
      "release",
    );
    expect(beforeRelease).toBe("This applicability date is earlier than the version's release date. Choose On release or a date on or after release; rules cannot apply retrospectively.");

    const codedRefusal = Object.assign(new Error("Internal SQL detail"), { code: "EFFECTIVE_DATE_BEFORE_RELEASE" });
    expect(companyFormErrorMessage(codedRefusal, "release")).toBe(beforeRelease);

    const rawRefusal = companyFormErrorMessage(
      new Error('400: {"error":"Effective-from date rejected for assignment 9ac1; SQL detail omitted"}'),
      "release",
    );
    expect(rawRefusal).toBe("This form version could not be released. Review the draft requirements and try again.");
    expect(rawRefusal).not.toMatch(/400|assignment 9ac1|SQL detail/);
  });

  it("explains known missing facts specifically and never labels them as stage failures", () => {
    expect(safeCompanyFormFactReason("Source reference has no unique eligible master match"))
      .toMatch(/does not match exactly one eligible master record/);
    expect(safeCompanyFormFactReason("Contract rank is UNRESOLVED"))
      .toMatch(/contract rank could not be matched to a unique rank master/);
    const unknownFact = safeCompanyFormFactReason("Postgres error: private record 99");
    expect(unknownFact).toMatch(/crew fact could not be verified.*administrator/i);
    expect(unknownFact).not.toMatch(/stage check|Postgres|private record/);
  });
});
