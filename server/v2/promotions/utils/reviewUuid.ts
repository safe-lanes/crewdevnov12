import { v5 as uuidv5 } from "uuid";

/**
 * A promotion review's review_uuid, worked out from the crew member and the
 * target rank, so the office and every vessel give the same review the same
 * id when each one creates it on its own (PRD-01).
 *
 * uuid v5 over the name `<crewMemberId>|<rank>`; the id is trimmed and the
 * rank is trimmed and lower-cased. Never change the namespace or the name
 * format: stored review uuids would stop matching.
 */
export const PROMOTION_REVIEW_UUID_NAMESPACE = "8c1f4a52-3d7e-5b9a-a6c0-2e4b7d91f3a8";

export function promotionReviewUuid(crewMemberId: string, promotionToRank: string): string {
  const crew = String(crewMemberId ?? "").trim();
  const rank = String(promotionToRank ?? "").trim().toLowerCase();
  if (!crew || !rank) throw new Error("A promotion review needs a crew member and a target rank to get its id");
  return uuidv5(`${crew}|${rank}`, PROMOTION_REVIEW_UUID_NAMESPACE);
}
