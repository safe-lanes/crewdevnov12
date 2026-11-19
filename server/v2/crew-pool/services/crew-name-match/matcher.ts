export const RULE_VERSION = '1.0.0';
export const MAX_CANDIDATE_ROWS = 100000;
export class CrewMatchCapacityError extends Error {}
export const OUTCOMES = ['Active', 'Terminated', 'Not Found', 'Ambiguous', 'Review Required'] as const;
export type Outcome = typeof OUTCOMES[number];
export interface CrewIdentity {
  crewUuid: string;
  empNo: string | null;
  firstName: string | null;
  middleName: string | null;
  familyName: string | null;
  status: string | null;
  isActive: boolean | null;
  archivedAt: Date | string | null;
  isDeleted: boolean | null;
}
export interface NameInput { row: number; name: string; error?: string }
export interface Candidate {
  crew: CrewIdentity;
  name: string;
  methods: string[];
  status: 'Active' | 'Terminated' | 'Review Required';
  reason: string;
}
export interface MatchResult {
  input: NameInput;
  outcome: Outcome;
  candidates: Candidate[];
  reason: string;
  warnings: string[];
}
export const normalizeName = (name: string) => name.normalize('NFC').trim().replace(/\s+/gu, ' ').toUpperCase();
const terminated = new Set(['TERMINATED', 'TERMINATED - NFR', 'TERMINATED EMPLOYMENT', 'TERMINATED EMPLOYMENT - NFR']);
const active = new Set(['ACTIVE', 'ON BOARD', 'ON LEAVE']);

export function classifyCrew(crew: CrewIdentity): Pick<Candidate, 'status' | 'reason'> {
  if (!crew.empNo?.trim()) return { status: 'Review Required', reason: 'Missing Employee ID (emp_no).' };
  if (crew.archivedAt) return { status: 'Review Required', reason: 'Archived SAIL record; not classified as active or terminated.' };
  const status = normalizeName(crew.status ?? '');
  if (terminated.has(status)) return {
    status: 'Terminated',
    reason: crew.isActive === false ? 'Recognized current termination status.' : 'Current termination status takes precedence; active flag is inconsistent or missing.',
  };
  if (active.has(status) && crew.isActive === true) return { status: 'Active', reason: 'Recognized active status and active flag.' };
  return { status: 'Review Required', reason: 'Inactive, unknown, missing, or conflicting current status/active flag; no status inferred.' };
}

export function matchCrewNames(inputs: NameInput[], crews: CrewIdentity[]): MatchResult[] {
  const index = new Map<string, Map<string, Candidate>>();
  for (const crew of crews) {
    if (crew.isDeleted !== false) continue;
    const join = (parts: (string | null)[]) => parts.map(p => p?.trim()).filter(Boolean).join(' ');
    const name = join([crew.firstName, crew.middleName, crew.familyName]);
    // Some legacy/imported records store the whole name in first_name. In
    // that layout, report the explicit fallback method rather than misleadingly
    // labelling the same value as a direct/reverse structured-name match.
    const firstNameOnly = !crew.middleName?.trim() && !crew.familyName?.trim();
    const firstNameWords = crew.firstName?.trim().split(/\s+/u).filter(Boolean) ?? [];
    const variants: [string, string][] = firstNameOnly
      ? [
        ['First Name Only', crew.firstName?.trim() ?? ''],
        // Reverse the complete stored token order only. This is not a fuzzy
        // match and does not attempt to guess surname/middle-name boundaries.
        ...(firstNameWords.length >= 2
          ? [['First Name Only Reverse', firstNameWords.reverse().join(' ')]] as [string, string][]
          : []),
      ]
      : [
        ['Direct', name],
        ['Reverse', join([crew.familyName, crew.firstName, crew.middleName])],
      ];
    for (const [method, variant] of variants) {
      const key = normalizeName(variant);
      if (!key) continue;
      const candidates = index.get(key) ?? new Map<string, Candidate>();
      const existing = candidates.get(crew.crewUuid);
      if (existing) { if (!existing.methods.includes(method)) existing.methods.push(method); }
      else candidates.set(crew.crewUuid, { crew, name, methods: [method], ...classifyCrew(crew) });
      index.set(key, candidates);
    }
  }
  const occurrences = new Map<string, number>();
  for (const input of inputs) if (!input.error) {
    const key = normalizeName(input.name);
    occurrences.set(key, (occurrences.get(key) ?? 0) + 1);
  }
  let totalCandidates = 0;
  const results: MatchResult[] = inputs.map(input => {
    const key = normalizeName(input.name);
    const warnings = !input.error && (occurrences.get(key) ?? 0) > 1 ? ['Repeated normalized input name; row retained.'] : [];
    if (input.error || !key) return { input, outcome: 'Review Required', candidates: [], reason: input.error ?? 'Blank crew name.', warnings };
    totalCandidates += index.get(key)?.size ?? 0;
    if (totalCandidates > MAX_CANDIDATE_ROWS) throw new CrewMatchCapacityError('Too many candidate rows for one report. Split the input workbook; no partial results generated.');
    const candidates = Array.from(index.get(key)?.values() ?? []).sort((a, b) =>
      (a.crew.empNo ?? '').localeCompare(b.crew.empNo ?? '') || a.crew.crewUuid.localeCompare(b.crew.crewUuid));
    if (!candidates.length) return { input, outcome: 'Not Found', candidates, reason: 'No configured exact name match in the eligible SAIL dataset. This does not prove absence from SAIL.', warnings };
    if (candidates.length > 1) return { input, outcome: 'Ambiguous', candidates, reason: 'Multiple distinct crew records match. No employee selected.', warnings };
    return { input, outcome: candidates[0].status, candidates, reason: candidates[0].reason, warnings };
  });
  const employeeCounts = new Map<string, number>();
  for (const result of results) if (result.candidates.length === 1) {
    const id = result.candidates[0].crew.empNo;
    if (id) employeeCounts.set(id, (employeeCounts.get(id) ?? 0) + 1);
  }
  for (const result of results) if (result.candidates.length === 1 && (employeeCounts.get(result.candidates[0].crew.empNo ?? '') ?? 0) > 1) {
    result.warnings.push('Multiple input rows resolve to this Employee ID. Check folder-renaming collisions; do not silently merge.');
  }
  return results;
}
