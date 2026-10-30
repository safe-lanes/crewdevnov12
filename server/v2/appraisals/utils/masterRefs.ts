import { and, asc, desc, isNotNull, sql } from "drizzle-orm";
import { getDb } from "../../db";
import { masterAppraisalTypes, masterVessels } from "../../../../shared/schema";

// APD-56: an appraisal refers to master data by key, never by name, so the
// value means the same on the office and on every vessel:
//   appraisal_type -> master_appraisal_types.id
//   vessel         -> master_vessels.vessel_uuid
// A save may still send a name (an older client, or the form's fallback when
// the master list is empty); it is turned into the key here. A new value that
// matches nothing is refused. A value equal to what is already stored is kept,
// so a legacy name the 0273 backfill could not match (e.g. "Annual") does not
// block saving that appraisal.

export class MasterReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MasterReferenceError";
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AppraisalTypeRow {
  id: string;
  entryId: string;
  name: string;
  sortOrder: number | null;
  isActive: boolean | null;
  isDeleted: boolean | null;
}

const text = (value: unknown) => (value == null ? "" : String(value).trim());

// All types, inactive and deleted included: an appraisal keeps the type it
// was given even after the type is retired.
export async function loadAppraisalTypes(): Promise<AppraisalTypeRow[]> {
  return getDb()
    .select({
      id: masterAppraisalTypes.id,
      entryId: masterAppraisalTypes.entryId,
      name: masterAppraisalTypes.name,
      sortOrder: masterAppraisalTypes.sortOrder,
      isActive: masterAppraisalTypes.isActive,
      isDeleted: masterAppraisalTypes.isDeleted,
    })
    .from(masterAppraisalTypes);
}

// id -> current name, for showing a stored id.
export async function loadAppraisalTypeNames(): Promise<Map<string, string>> {
  const rows = await loadAppraisalTypes();
  return new Map(rows.map((r) => [String(r.id).toLowerCase(), r.name]));
}

// The stored id's current name; a legacy name (or an unknown id) is shown as stored.
export function appraisalTypeName(value: string | null | undefined, names: Map<string, string>): string {
  const raw = value ?? "";
  return names.get(raw.trim().toLowerCase()) ?? raw;
}

// Same order as the 0273 backfill: live types first, then active, then list order.
function compareTypes(a: AppraisalTypeRow, b: AppraisalTypeRow): number {
  return (Number(!!a.isDeleted) - Number(!!b.isDeleted))
    || (Number(b.isActive !== false) - Number(a.isActive !== false))
    || ((a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    || a.entryId.localeCompare(b.entryId);
}

// The appraisal_type to store for `value`. '' stays '' (a draft may not have a type yet).
export function pickAppraisalTypeId(value: unknown, existing: unknown, rows: AppraisalTypeRow[]): string {
  const v = text(value);
  if (!v) return "";
  if (existing != null && v === text(existing)) return String(existing);

  if (UUID_RE.test(v)) {
    const byId = rows.find((r) => String(r.id).toLowerCase() === v.toLowerCase());
    if (byId) return String(byId.id);
  }
  const byName = rows
    .filter((r) => text(r.name).toLowerCase() === v.toLowerCase())
    .sort(compareTypes)[0];
  if (byName) return String(byName.id);

  throw new MasterReferenceError(`Appraisal type "${v}" was not found.`);
}

export async function resolveAppraisalTypeRef(value: unknown, existing?: unknown): Promise<string> {
  const v = text(value);
  // Empty or unchanged needs no lookup.
  const unchanged = !v || (existing != null && v === text(existing));
  return pickAppraisalTypeId(value, existing, unchanged ? [] : await loadAppraisalTypes());
}

// The vessel to store for `value`: its master_vessels.vessel_uuid. '' -> null.
// vessel_uuid is not unique, so one row is picked: live, then active, then
// newest (same order as vesselNameExpr in reports/handlers/_shared.ts).
export async function resolveAppraisalVesselRef(value: unknown, existing?: unknown): Promise<string | null> {
  const v = text(value);
  if (!v) return null;
  if (existing != null && v === text(existing)) return String(existing);

  const match = UUID_RE.test(v)
    ? sql`lower(${masterVessels.vesselUuid}) = ${v.toLowerCase()}`
    : sql`lower(trim(${masterVessels.vessel})) = ${v.toLowerCase()}`;
  const [row] = await getDb()
    .select({ vesselUuid: masterVessels.vesselUuid })
    .from(masterVessels)
    .where(and(isNotNull(masterVessels.vesselUuid), match))
    .orderBy(asc(masterVessels.isDeleted), desc(masterVessels.isActive), desc(masterVessels.id))
    .limit(1);
  if (row?.vesselUuid) return row.vesselUuid;

  throw new MasterReferenceError(`Vessel "${v}" was not found.`);
}
