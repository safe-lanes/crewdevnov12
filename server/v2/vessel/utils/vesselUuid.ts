import { deterministicUuid } from "@shared/v2/uuid/deterministicUuid";

/**
 * Deterministic row ids for Vessel Planning (VS-02), so the office and every
 * vessel give the same secondary planning row the same uuid when each creates
 * it on its own (a retry or a double sync then lands on one row).
 *
 * uuid v5 over `<tag>|<parts...>`; every part is trimmed and lower-cased.
 * Never change the namespace, the tags or the part order: stored uuids would
 * stop matching.
 */
export const VESSEL_NATURAL_KEY_UUID_NAMESPACE = "b3f1c6a2-47d8-5e09-9a1b-6c2e8d4f7a15";

function required(label: string, value: unknown): string {
  const v = String(value ?? "").trim();
  if (!v) throw new Error(`${label} is required to build a Vessel Planning row id`);
  return v;
}

/**
 * Secondary (relief) planning row created at sign-on: one row per reliever
 * assignment, vessel and rank. The assignment uuid is part of the key so a
 * genuine re-join (a new assignment) gets a new row.
 */
export function secondaryPlanUuid(assignUuid: string, vesselUuid: string, rank: string | null | undefined): string {
  return deterministicUuid(
    VESSEL_NATURAL_KEY_UUID_NAMESPACE,
    "secondary-plan",
    required("Assignment uuid", assignUuid),
    required("Vessel uuid", vesselUuid),
    required("Rank", rank),
  );
}
