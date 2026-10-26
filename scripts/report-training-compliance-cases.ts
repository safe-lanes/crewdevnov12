/** Pure synthetic calculation evidence; no database import, HTTP or fixtures written. */
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { trainingComplianceCases } from "../tests/fixtures/trainingComplianceCases";
import { calculateTrainingCompliance } from "../server/v2/shared/training-compliance/calculator";
import { TRAINING_COMPLIANCE_VERSION } from "../server/v2/shared/training-compliance/types";
import { civilDate } from "../server/v2/shared/training-compliance/dates";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const date = (value: string | null) => {
  if (!value) return "Not set";
  if (!civilDate(value)) return `${value} (invalid)`;
  const [y, m, d] = value.split("-");
  return `${d}-${months[Number(m) - 1] ?? m}-${y}`;
};
const escape = (value: string) => value.replaceAll("|", "\\|").replaceAll("\n", " ");
const results = trainingComplianceCases.map((test, index) => {
  const result = calculateTrainingCompliance(test.input), course = result.courses[0];
  assert.equal(result.status, test.complete ? "complete" : "incomplete", test.title);
  assert.equal(course?.state ?? null, test.state, test.title);
  assert.equal(course?.chosenCertificate?.certificateUuid ?? null, test.chosen, test.title);
  assert.equal(result.contractEnd, test.end, test.title);
  if (test.summary) assert.equal(result.summary.mandatory.status, test.summary, test.title);
  if (test.issue) assert.ok(result.issues.some(i => i.code === test.issue), test.title);
  const held = test.input.certificates?.map(c =>
    `${c.number}: ${date(c.issued)} → ${c.expiry ? date(c.expiry) : "no expiry"}`).join("; ") ?? "Could not read certificates";
  const flags = [...new Set(result.issues.map(i => i.message))].join("; ");
  const fields = [String(index + 1), test.review ?? "Unchanged", test.title,
    !test.input.contractRankUuid ? "Undetermined (rank missing)"
      : test.input.matrix?.requirements[0]?.name ?? "Undetermined (matrix unavailable)",
    held || "None", date(test.input.plannedJoiningDate),
    result.contractEnd ? date(result.contractEnd) : test.issue === "CONTRACT_END_NOT_SET" ? "Contract end not set" : "Cannot calculate",
    course?.state ?? `Incomplete — ${test.title}`,
    flags || "None",
    course?.chosenCertificate ? `${course.chosenCertificate.number} (${course.isEquivalent ? "equivalent" : "direct"})` : "None"];
  return { case: test.title, result, tableRow: `| ${fields.map(escape).join(" | ")} |` };
});
const table = `# Training compliance calculation review\n\nCalculation version **${TRAINING_COMPLIANCE_VERSION}**. Changed rows are marked **Changed**; additional cases are marked **Added**. Synthetic policy: Basic fire fighting explicitly accepts Advanced fire fighting. The further Advanced-to-Specialist link does not make Specialist acceptable for Basic.\n\nCertificate dates below are **issued → expiry**. Incomplete is a check status, not a sixth course state. Without contract end, Valid means valid at joining only, never full-contract validity. Warnings do not make a check incomplete; a known gap still takes precedence over warnings.\n\n| # | Review | Case | Required course | Certificates held (issued → expiry) | Joining | Contract end | Result | Flags | Chosen certificate |\n|---|---|---|---|---|---|---|---|---|---|\n${results.map(r => r.tableRow).join("\n")}\n`;
await mkdir("generated-artifacts/training-slice3-v1.1", { recursive: true });
await writeFile("generated-artifacts/training-slice3-v1.1/case-table.md", table);
await writeFile("generated-artifacts/training-slice3-v1.1/case-table.json", JSON.stringify(results, null, 2));
console.log(table);
