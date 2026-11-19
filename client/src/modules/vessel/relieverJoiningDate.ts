type RelieverRow = {
  crewUuid?: string | null;
  relieverCrewUuid?: string | null;
  relieverCrewId?: string | null;
  relieverSignOnDate?: string | null;
  signOnDate?: string | null;
};

/** A separate secondary row may supply its own date, never the incumbent's. */
export function relieverJoiningDate(row: RelieverRow): string | undefined {
  if (row.relieverSignOnDate) return row.relieverSignOnDate;
  const relieverUuid = row.relieverCrewUuid || row.relieverCrewId;
  if (relieverUuid && row.crewUuid === relieverUuid) return row.signOnDate || undefined;
  return undefined;
}
