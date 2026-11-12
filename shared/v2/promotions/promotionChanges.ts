import { v5 as uuidv5 } from "uuid";
import { z } from "zod";
import { sameValue } from "../appraisals/appraisalChanges";

// A promotion review's child lists, as the form saves them (PRD-02 / PRD-03).
// Every save sends only what changed: new rows, changed fields and the uuids of
// removed rows. Rows are matched by uuid, never by position or a counter.
export const PROMO_SECTION_KEYS = [
  "cesTests",
  "trainingNeeds",
  "trainingComments",
  "criteriaComments",
  "approvers",
  "partAApprovers",
  "selectedApprovers",
] as const;
export type PromoSectionKey = (typeof PROMO_SECTION_KEYS)[number];

// Rows users add and remove freely. The browser gives each one a random uuid
// when it is added, and every row sent must carry it.
export const PROMO_USER_ROW_SECTIONS = ["trainingNeeds", "trainingComments", "criteriaComments", "approvers"] as const;

// One row per key per review: a CES test per test position, a Part A or
// selected approver per user. Their uuid is promoRowUuid(review, section, key),
// so ship and office give the same row the same uuid.
export const PROMO_ROW_KEY = {
  cesTests: "testId",
  partAApprovers: "approverId",
  selectedApprovers: "approverId",
} as const;
export type PromoKeyedSection = keyof typeof PROMO_ROW_KEY;

// The fields each section saves. Keys of keyed sections are included: a new
// row carries its key, a changed row only the fields that changed.
export const PROMO_SECTION_FIELDS: Record<PromoSectionKey, readonly string[]> = {
  cesTests: ["testId", "description", "date", "minScore", "score", "result"],
  trainingNeeds: ["training", "correspondingInDB", "identifiedByUuid", "category", "status", "completionDate"],
  // trainingUuid: the uuid of the training row the comment belongs to.
  trainingComments: ["trainingUuid", "user", "text"],
  criteriaComments: ["criteriaCode", "user", "text"],
  approvers: ["date", "approver", "status", "approval", "comments"],
  // approverId: the approver's user uuid.
  partAApprovers: ["approverId", "date", "approver", "status", "approval", "comments"],
  selectedApprovers: ["approverId", "approver"],
};

export type PromoChangeRow = { uuid?: string } & Record<string, unknown>;

export interface PromoSectionChanges {
  rows: PromoChangeRow[];
  // Uuids of rows the user removed.
  deleted?: string[];
}

export type PromotionChanges = Partial<Record<PromoSectionKey, PromoSectionChanges>>;

// The `changes` of a save request. A user row must carry the uuid the browser
// gave it; a keyed row carries its uuid or its key.
const rowUuidSchema = z.string().min(1).max(64);
const userRowSectionSchema = z.object({
  rows: z.array(z.object({ uuid: rowUuidSchema }).passthrough()),
  deleted: z.array(rowUuidSchema).optional(),
});
const keyedRowSectionSchema = (key: string) => z.object({
  rows: z.array(
    z.object({ uuid: rowUuidSchema.optional() }).passthrough().refine(
      (row: Record<string, unknown>) => !!row.uuid || String(row[key] ?? "").trim() !== "",
      { message: `A row needs a uuid or a ${key}.` },
    ),
  ),
  deleted: z.array(rowUuidSchema).optional(),
});
export const promotionChangesSchema = z.object({
  cesTests: keyedRowSectionSchema(PROMO_ROW_KEY.cesTests).optional(),
  trainingNeeds: userRowSectionSchema.optional(),
  trainingComments: userRowSectionSchema.optional(),
  criteriaComments: userRowSectionSchema.optional(),
  approvers: userRowSectionSchema.optional(),
  partAApprovers: keyedRowSectionSchema(PROMO_ROW_KEY.partAApprovers).optional(),
  selectedApprovers: keyedRowSectionSchema(PROMO_ROW_KEY.selectedApprovers).optional(),
}).strict();

// A save from a form older than PRD-02 sends these whole lists; it is refused.
export const LEGACY_LIST_FIELDS = [
  "cesTestsData",
  "trainingNeeds",
  "criteriaComments",
  "approvalData",
  "selectedApproversForSubmission",
] as const;

// Fixed namespace for keyed promotion row uuids. Never change it: stored rows
// depend on it. (= v5("safelanes.crewing.promotion_child_rows", URL))
const PROMO_ROW_NAMESPACE = "89ed21b2-ce08-5dd2-befc-5a92da8e2bb5";

export function promoRowUuid(reviewUuid: string, section: PromoKeyedSection, key: string): string {
  return uuidv5(`${reviewUuid}:${section}:${String(key).trim()}`, PROMO_ROW_NAMESPACE);
}

// One row per review and criteria code (promo_criteria_status_v2), and one per
// review (promo_suitability_v2) (PRD-09). Ship and office derive the same uuid
// for the same row, so a row made on both sides is one row after sync.
export function criteriaStatusUuid(reviewUuid: string, criteriaCode: string): string {
  return uuidv5(`${reviewUuid}:criteriaStatus:${String(criteriaCode).trim()}`, PROMO_ROW_NAMESPACE);
}

export function suitabilityUuid(reviewUuid: string): string {
  return uuidv5(`${reviewUuid}:suitability`, PROMO_ROW_NAMESPACE);
}

function isKeyed(section: PromoSectionKey): section is PromoKeyedSection {
  return Object.prototype.hasOwnProperty.call(PROMO_ROW_KEY, section);
}

const isBlank = (v: unknown) => v === undefined || v === null || v === "";

// How a row is recognised between the baseline and the form: its key for a
// keyed row (its uuid when the key is empty), else its uuid.
function rowKey(section: PromoSectionKey, row: PromoChangeRow): string | undefined {
  if (isKeyed(section)) {
    const key = row[PROMO_ROW_KEY[section]];
    if (!isBlank(key)) return `key:${String(key).trim()}`;
  }
  return row.uuid ? `uuid:${row.uuid}` : undefined;
}

// One section's change set from `base` (as last loaded or saved) to `current`
// (the form now). Both are lists of rows in the saved shape: `uuid` plus the
// section's fields.
// - A new row carries its non-empty fields; it is left out if it has none.
// - A changed row carries only the changed fields.
// - A row in `base` and not in `current` goes into `deleted`.
// A row is matched to the baseline by its key (keyed rows), else by its uuid.
// A keyed row takes the uuid of its baseline row, then its own, then
// promoRowUuid when the review uuid is known. A user row must carry its uuid.
//
// `rows` is `current` with those uuids filled in and duplicates dropped: what
// the server holds for this section once the save succeeds.
export function buildSectionChanges(
  section: PromoSectionKey,
  base: readonly PromoChangeRow[] | undefined,
  current: readonly PromoChangeRow[],
  reviewUuid: string | null | undefined,
): { changes?: PromoSectionChanges; rows: PromoChangeRow[] } {
  const fields = PROMO_SECTION_FIELDS[section];
  const baseRows = base ?? [];
  const baseByKey = new Map<string, PromoChangeRow>();
  const baseByUuid = new Map<string, PromoChangeRow>();
  for (const row of baseRows) {
    const k = rowKey(section, row);
    if (k && !baseByKey.has(k)) baseByKey.set(k, row);
    if (row.uuid && !baseByUuid.has(row.uuid)) baseByUuid.set(row.uuid, row);
  }

  const rows: PromoChangeRow[] = [];
  const resolved: PromoChangeRow[] = [];
  const seen = new Set<string>();
  const matched = new Set<PromoChangeRow>();
  for (const row of current) {
    if (!isKeyed(section) && !row.uuid) throw new Error(`A ${section} row has no uuid.`);
    const k = rowKey(section, row);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    let prior = baseByKey.get(k);
    if (prior && matched.has(prior)) prior = undefined;
    if (!prior && row.uuid) {
      const byUuid = baseByUuid.get(row.uuid);
      if (byUuid && !matched.has(byUuid)) prior = byUuid;
    }
    if (prior) matched.add(prior);

    let uuid = prior?.uuid ?? row.uuid;
    if (!uuid && isKeyed(section) && reviewUuid) {
      uuid = promoRowUuid(reviewUuid, section, String(row[PROMO_ROW_KEY[section]]));
    }
    resolved.push(uuid ? { ...row, uuid } : { ...row });

    const out: PromoChangeRow = uuid ? { uuid } : {};
    let sent = 0;
    for (const field of fields) {
      const value = row[field];
      if (value === undefined) continue;
      if (prior ? !sameValue(value, prior[field]) : !isBlank(value)) {
        out[field] = value;
        sent++;
      }
    }
    if (sent > 0) rows.push(out);
  }

  const deleted = baseRows
    .filter((row) => !matched.has(row) && !!row.uuid)
    .map((row) => row.uuid as string)
    .filter((uuid, i, all) => all.indexOf(uuid) === i && !resolved.some((r) => r.uuid === uuid));

  if (rows.length === 0 && deleted.length === 0) return { rows: resolved };
  return { changes: deleted.length > 0 ? { rows, deleted } : { rows }, rows: resolved };
}

// The change set for every section in `current`, plus the rows each section
// holds after the save (`saved`). Sections left out of `current` are not
// saved by this request.
export function buildPromotionChanges(
  base: Partial<Record<PromoSectionKey, readonly PromoChangeRow[]>>,
  current: Partial<Record<PromoSectionKey, readonly PromoChangeRow[]>>,
  reviewUuid: string | null | undefined,
): { changes: PromotionChanges; saved: Partial<Record<PromoSectionKey, PromoChangeRow[]>> } {
  const changes: PromotionChanges = {};
  const saved: Partial<Record<PromoSectionKey, PromoChangeRow[]>> = {};
  for (const section of PROMO_SECTION_KEYS) {
    const rows = current[section];
    if (!rows) continue;
    const result = buildSectionChanges(section, base[section], rows, reviewUuid);
    saved[section] = result.rows;
    if (result.changes) changes[section] = result.changes;
  }
  return { changes, saved };
}

// ---- Checklist (PRD-14) ----------------------------------------------------
// A checklist point is one row per review, section and point. Its uuid is
// derived, so ship and office make the same row and a verification added on
// either side hangs off the same parent. Never change the format: stored rows
// depend on it.
export function checklistPointUuid(reviewUuid: string, sectionId: string, pointId: string): string {
  return uuidv5(`${reviewUuid}:checklist:${String(sectionId).trim()}:${String(pointId).trim()}`, PROMO_ROW_NAMESPACE);
}

// The verifications and comments of one point, as the checklist saves them.
// Verification rows: verifierName, rank, date. Comment rows: userName, rank,
// text, date and verificationId (the verification an empty comment belongs to).
export const CHECKLIST_VERIFICATION_FIELDS = ["verifierName", "rank", "date"] as const;
export const CHECKLIST_COMMENT_FIELDS = ["userName", "rank", "text", "date", "verificationId"] as const;

export interface ChecklistPointChanges {
  sectionId: string;
  pointId: string;
  // Used only when the point's row has to be created.
  sectionTitle?: string;
  text?: string;
  completed?: boolean;
  verifications?: PromoSectionChanges;
  comments?: PromoSectionChanges;
}
export interface ChecklistChanges {
  points: ChecklistPointChanges[];
}

const checklistListSchema = z.object({
  rows: z.array(z.object({ uuid: rowUuidSchema }).passthrough()),
  deleted: z.array(rowUuidSchema).optional(),
});
export const checklistChangesSchema = z.object({
  points: z.array(z.object({
    sectionId: z.string().min(1).max(200),
    pointId: z.string().min(1).max(200),
    sectionTitle: z.string().optional(),
    text: z.string().optional(),
    completed: z.boolean().optional(),
    verifications: checklistListSchema.optional(),
    comments: checklistListSchema.optional(),
  }).strict()),
}).strict();

type ChecklistPointLike = {
  id: string;
  text?: string;
  completed?: boolean;
  verifications?: PromoChangeRow[];
  comments?: PromoChangeRow[];
};
type ChecklistSectionLike = { id: string; title?: string; assessmentPoints?: ChecklistPointLike[] };

// Change set of one list of rows (matched by `id`) from `base` to `current`.
function diffChecklistRows(
  fields: readonly string[],
  base: readonly PromoChangeRow[] | undefined,
  current: readonly PromoChangeRow[] | undefined,
): PromoSectionChanges | undefined {
  const baseRows = base ?? [];
  const baseById = new Map<string, PromoChangeRow>();
  for (const row of baseRows) if (row.id) baseById.set(String(row.id), row);
  const rows: PromoChangeRow[] = [];
  const seen = new Set<string>();
  for (const row of current ?? []) {
    const id = row.id ? String(row.id) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const prior = baseById.get(id);
    const out: PromoChangeRow = { uuid: id };
    let sent = 0;
    for (const field of fields) {
      const value = row[field];
      if (value === undefined) continue;
      if (prior ? !sameValue(value, prior[field]) : true) {
        out[field] = value;
        sent++;
      }
    }
    // A new row is sent even when every field is empty: it exists for its id.
    if (sent > 0 || !prior) rows.push(out);
  }
  const deleted = [...baseById.keys()].filter((id) => !seen.has(id));
  if (rows.length === 0 && deleted.length === 0) return undefined;
  return deleted.length > 0 ? { rows, deleted } : { rows };
}

// The checklist change set from the sections as last loaded (`base`) to the
// sections now. Only points with a change are listed.
export function buildChecklistChanges(
  base: readonly ChecklistSectionLike[] | null | undefined,
  current: readonly ChecklistSectionLike[],
): ChecklistChanges {
  const basePoints = new Map<string, ChecklistPointLike>();
  for (const s of base ?? []) {
    for (const p of s.assessmentPoints ?? []) basePoints.set(`${s.id}\u0000${p.id}`, p);
  }
  const points: ChecklistPointChanges[] = [];
  for (const s of current) {
    for (const p of s.assessmentPoints ?? []) {
      const prior = basePoints.get(`${s.id}\u0000${p.id}`);
      const verifications = diffChecklistRows(CHECKLIST_VERIFICATION_FIELDS, prior?.verifications, p.verifications);
      const comments = diffChecklistRows(CHECKLIST_COMMENT_FIELDS, prior?.comments, p.comments);
      const completedChanged = !!p.completed !== !!prior?.completed;
      if (!verifications && !comments && !completedChanged) continue;
      const out: ChecklistPointChanges = { sectionId: s.id, pointId: p.id, sectionTitle: s.title ?? "", text: p.text ?? "" };
      if (completedChanged) out.completed = !!p.completed;
      if (verifications) out.verifications = verifications;
      if (comments) out.comments = comments;
      points.push(out);
    }
  }
  return { points };
}

export function isEmptyPromotionChanges(changes: PromotionChanges | undefined): boolean {
  return !changes || Object.keys(changes).length === 0;
}
