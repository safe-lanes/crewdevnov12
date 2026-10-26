import type { ComplianceResult, CourseResult } from "../shared/training-compliance/types";
import { civilDate } from "../shared/training-compliance/dates";

export type SuggestionStatus = "SUGGESTED" | "CONFIRMED" | "DISMISSED" | "CLOSED" | "WITHDRAWN";
export function needsSuggestion(course: CourseResult): boolean {
  return course.complete && course.obligation === "mandatory"
    && ["Not held", "Expired at joining", "Expires during contract"].includes(course.state ?? "");
}
export function suggestionTarget(course: CourseResult, check: ComplianceResult): string | null {
  if (course.state !== "Expires during contract") return check.joiningDate;
  const expiry = course.chosenCertificate?.expiry;
  if (!expiry || !civilDate(expiry)) return null;
  const day = new Date(`${expiry}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}
export function qualifyingCertificate(course: CourseResult): string | null {
  // Unknown expiry, unknown issue/invalid expiry which hides a gap, and an
  // expiry during contract cannot close a need. Equivalents use the calculator.
  return course.complete && ["Valid", "Valid, no expiry"].includes(course.state ?? "")
    && course.validAtJoining === true
    ? course.chosenCertificate?.certificateUuid ?? null : null;
}
