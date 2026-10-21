import { describe, expect, it } from "vitest";
import { trainingComplianceCases } from "../fixtures/trainingComplianceCases";
import { calculateTrainingCompliance } from "@server/v2/shared/training-compliance/calculator";
import { TRAINING_COMPLIANCE_VERSION } from "@server/v2/shared/training-compliance/types";

describe("review table: one executable assertion set per business case", () => {
  it.each(trainingComplianceCases)("$title", test => {
    const before = JSON.stringify(test.input);
    const result = calculateTrainingCompliance(test.input), course = result.courses[0];
    expect(result.status).toBe(test.complete ? "complete" : "incomplete");
    expect(course?.state ?? null).toBe(test.state);
    expect(course?.chosenCertificate?.certificateUuid ?? null).toBe(test.chosen);
    expect(result.contractEnd).toBe(test.end);
    expect(result.calculationVersion).toBe(TRAINING_COMPLIANCE_VERSION);
    if (test.issue) expect(result.issues.map(i => i.code)).toContain(test.issue);
    if (!test.complete) {
      expect(result.summary.mandatory.status).toBe("incomplete");
      expect(result.summary.recommended.status).toBe("incomplete");
    }
    expect(JSON.stringify(test.input)).toBe(before);
  });
});
