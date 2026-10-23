import {
  HEADER_FIELDS,
  SECTION_FIELDS,
  SECTION_KEYS,
  sameValue,
  type AppraisalChangeRow,
  type AppraisalChanges,
  type AppraisalSectionChanges,
  type AppraisalSectionKey,
} from "@shared/v2/appraisals/appraisalChanges";

// An appraisal's header fields and section rows at one point in time.
export interface AppraisalSnapshot {
  header: Record<string, unknown>;
  sections: Partial<Record<AppraisalSectionKey, any[]>>;
}

// What the server holds for an appraisal, taken from the GET response when the
// form loads it. Part A lives in appraisalData; type, date, ratings and status
// are top-level fields of the response.
export function snapshotFromServer(appraisal: Record<string, any>, appraisalData: Record<string, any>): AppraisalSnapshot {
  const header: Record<string, unknown> = {};
  for (const field of HEADER_FIELDS) {
    header[field] = appraisal?.[field] !== undefined ? appraisal[field] : appraisalData?.[field];
  }
  const sections: Partial<Record<AppraisalSectionKey, any[]>> = {};
  for (const key of SECTION_KEYS) {
    sections[key] = Array.isArray(appraisalData?.[key]) ? appraisalData[key] : [];
  }
  return { header, sections };
}

// The change set from `base` (as loaded) to `current` (the form now): changed
// header fields, new rows with all their fields, changed rows with only the
// changed fields, and the uuids of removed rows. Every current row must carry
// a uuid. A field the row does not carry (undefined) is left out, so the
// server keeps its stored value.
export function buildAppraisalChanges(
  base: AppraisalSnapshot,
  current: AppraisalSnapshot,
  options: { skipSections?: readonly AppraisalSectionKey[] } = {},
): AppraisalChanges {
  const changes: AppraisalChanges = {};

  const header: Record<string, string | null> = {};
  for (const field of HEADER_FIELDS) {
    const value = current.header[field];
    if (value !== undefined && !sameValue(value, base.header[field])) {
      header[field] = value === null ? null : String(value);
    }
  }
  if (Object.keys(header).length > 0) changes.header = header;

  const sections: Partial<Record<AppraisalSectionKey, AppraisalSectionChanges>> = {};
  for (const key of SECTION_KEYS) {
    if (options.skipSections?.includes(key)) continue;

    const baseByUuid = new Map<string, any>();
    for (const row of base.sections[key] ?? []) {
      if (row?.uuid) baseByUuid.set(row.uuid, row);
    }

    const rows: AppraisalChangeRow[] = [];
    const kept = new Set<string>();
    for (const row of current.sections[key] ?? []) {
      if (!row?.uuid) throw new Error(`A ${key} row has no uuid.`);
      kept.add(row.uuid);
      const prior = baseByUuid.get(row.uuid);
      const out: AppraisalChangeRow = { uuid: row.uuid };
      for (const field of SECTION_FIELDS[key]) {
        const value = row[field];
        if (value === undefined) continue;
        if (!prior || !sameValue(value, prior[field])) out[field] = value;
      }
      if (!prior || Object.keys(out).length > 1) rows.push(out);
    }

    const deleted = Array.from(baseByUuid.keys()).filter((uuid) => !kept.has(uuid));
    if (rows.length > 0 || deleted.length > 0) {
      sections[key] = deleted.length > 0 ? { rows, deleted } : { rows };
    }
  }
  if (Object.keys(sections).length > 0) changes.sections = sections;

  return changes;
}
