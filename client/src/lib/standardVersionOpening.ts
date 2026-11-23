/** Optional identity-based navigation; omitted by legacy/unrelated entry points. */
export type StandardVersionOpening = { versionId: number | null; rankGroupId: number | null };

export const isStandardVersionCategory = (category: unknown) =>
  ["appraisal", "promotion", "briefing", "debriefing", "interview"].includes(String(category));

export function editorVersionKey(row: { id?: number; versionNo: string }, explicit: boolean) {
  return explicit && row.id !== undefined ? `id:${row.id}` : row.versionNo;
}

export function editorVersionMatches(row: { id?: number; versionNo: string }, key: string) {
  return key.startsWith("id:") ? key === `id:${row.id}` : row.versionNo === key;
}
