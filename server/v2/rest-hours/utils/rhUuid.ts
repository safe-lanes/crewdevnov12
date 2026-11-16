import { v5 as uuidv5 } from "uuid";

/**
 * Deterministic row ids for the Rest Hours summary tables (RH-02), so the
 * office and every vessel give the same vessel-month / comment / crew-month
 * row the same uuid when each creates it on its own.
 *
 * uuid v5 over `<table tag>|<parts...>`; every part is trimmed and
 * lower-cased. Never change the namespace, the tags or the part order: stored
 * uuids would stop matching.
 */
export const RH_NATURAL_KEY_UUID_NAMESPACE = "5d0a7b1e-9c42-5f3b-8e6d-1a4c2b7f9e30";

function norm(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function required(label: string, value: unknown): string {
  const v = norm(value);
  if (!v) throw new Error(`${label} is required to build a Rest Hours row id`);
  return v;
}

function build(tag: string, parts: string[]): string {
  return uuidv5(`${tag}|${parts.join("|")}`, RH_NATURAL_KEY_UUID_NAMESPACE);
}

/** rh_vessel_records_v2: one row per vessel and month. */
export function rhVesselMonthUuid(vesselId: string, monthValue: string): string {
  return build("vessel-month", [required("Vessel ID", vesselId), required("Month value", monthValue)]);
}

/** rh_vessel_violation_comments_v2: one row per vessel and month. */
export function rhVesselCommentUuid(vesselId: string, monthValue: string): string {
  return build("vessel-comment", [required("Vessel ID", vesselId), required("Month value", monthValue)]);
}

/** rh_office_violation_comments_v2: one row per vessel and month. */
export function rhOfficeCommentUuid(vesselId: string, monthValue: string): string {
  return build("office-comment", [required("Vessel ID", vesselId), required("Month value", monthValue)]);
}

/** rh_crew_records_v2: one row per vessel, crew member, month and rank (rank may be empty). */
export function rhCrewMonthRankUuid(
  vesselId: string,
  crewMemberId: string,
  monthValue: string,
  rank: string | null | undefined,
): string {
  return build("crew-month-rank", [
    required("Vessel ID", vesselId),
    required("Crew member ID", crewMemberId),
    required("Month value", monthValue),
    norm(rank),
  ]);
}
