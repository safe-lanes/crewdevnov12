export type SeaServiceRankMaster = { arUuid: string; rankId?: string; name: string };
export function seaServiceRankLabel(reference: string, masters: SeaServiceRankMaster[]): string {
  const matches = masters.filter(r => r.arUuid === reference || r.rankId === reference);
  if (matches.length === 1) return matches[0].name;
  if (/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(reference)) return "Rank unavailable";
  // Legacy display text stays display text; never use it to resolve identity.
  return reference || "—";
}
