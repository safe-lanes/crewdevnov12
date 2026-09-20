export interface D3Identity {
  id: string;
  courseId?: string;
  companyId?: string;
  trainUuid?: string;
  matrixDefault?: boolean;
}

export interface D3Master {
  id: number;
  companyId: string;
  trainingLabel: string;
  abr?: string | null;
  requirement?: string | null;
}

export function d3CourseKey(
  row: Partial<D3Identity>,
  masters: readonly Pick<D3Master, 'id' | 'companyId'>[],
): string {
  const id = (row.courseId || row.companyId || '').trim();
  if (!id) return '';

  return (
    masters.find(master => master.companyId === id)?.companyId ||
    masters.find(master => String(master.id) === id)?.companyId ||
    id
  );
}

export function d3RankId(
  value: string,
  ranks: readonly { id: number | string; rank: string }[],
  normalize: (rank: string) => string,
): number | null {
  if (!value.trim()) return null;

  const matches = ranks.filter(
    rank => rank.rank.trim().toLowerCase() === value.trim().toLowerCase(),
  );

  const candidates = matches.length
    ? matches
    : ranks.filter(
        rank =>
          normalize(rank.rank).trim().toLowerCase() ===
          normalize(value).trim().toLowerCase(),
      );

  const ids = [...new Set(candidates.map(rank => Number(rank.id)))];

  return ids.length === 1 && Number.isFinite(ids[0]) ? ids[0] : null;
}

export function missingD3Defaults(
  rows: readonly D3Identity[],
  masters: readonly D3Master[],
  requirements: readonly {
    companyTrainingId: number;
    rankId: number;
    status: string | null;
  }[],
  rankId: number,
  suppressed: ReadonlySet<string>,
  prefix: string,
) {
  const existing = new Set(
    rows.map(row => d3CourseKey(row, masters)).filter(Boolean),
  );
  const rowIds = new Set(rows.map(row => row.id));

  const required = new Set(
    requirements
      .filter(
        requirement =>
          Number(requirement.rankId) === rankId &&
          (requirement.status === 'M' || requirement.status === 'R'),
      )
      .map(requirement => Number(requirement.companyTrainingId)),
  );

  return masters.flatMap((master, index) => {
    if (
      !required.has(Number(master.id)) ||
      !master.companyId ||
      !master.trainingLabel ||
      existing.has(master.companyId) ||
      suppressed.has(master.companyId)
    ) {
      return [];
    }

    existing.add(master.companyId);

    let id = prefix + master.id;
    for (let suffix = 1; rowIds.has(id); suffix++) {
      id = prefix + master.id + '-' + suffix;
    }
    rowIds.add(id);

    return [{
      id,
      courseId: master.companyId,
      companyId: master.companyId,
      trainingCourse: master.trainingLabel,
      abbr: master.abr || '',
      requirement: master.requirement || '',
      certificateNo: '',
      issuingAuthority: '',
      issued: '',
      expiry: '',
      fromDatabase: true,
      matrixDefault: true,
      sortOrder: index,
    }];
  });
}

export function mergeD3LocalRows<T extends D3Identity>(
  serverRows: T[],
  localRows: T[],
  masters: readonly Pick<D3Master, 'id' | 'companyId'>[],
  deleted: ReadonlySet<string>,
): T[] {
  const server = serverRows.filter(
    row => !row.trainUuid || !deleted.has(row.trainUuid),
  );

  const keys = new Set(
    server.map(row => d3CourseKey(row, masters)).filter(Boolean),
  );
  const ids = new Set(server.map(row => row.id));

  const locals = localRows.filter(row => {
    if (
      ids.has(row.id) ||
      (row.matrixDefault && keys.has(d3CourseKey(row, masters)))
    ) {
      return false;
    }

    ids.add(row.id);
    return true;
  });

  return [...server, ...locals];
}

export function d3RowsForSave<T extends D3Identity>(
  rows: T[],
  canEdit: boolean,
): T[] {
  return canEdit
    ? rows
    : rows.filter(row => !row.matrixDefault || Boolean(row.trainUuid));
}

// Private form-state metadata. JSON serialization does not include symbol keys.
export const D3_HYDRATION_COMMIT = Symbol('d3-hydration-commit');

let nextD3SessionNumber = 0;

export function createD3Session(open: boolean, crewKey: string | null) {
  const number = ++nextD3SessionNumber;

  return {
    open,
    crewKey,
    prefix: `TRN-MATRIX-${number}-`,
    suppressed: new Set<string>(),
    deletedUuids: new Set<string>(),
    pendingDeletes: new Set<string>(),
  };
}

export type D3Session = ReturnType<typeof createD3Session>;

export interface D3CreateTicket {
  completion: Promise<void>;
  finish: () => void;
}

export function createD3CreateRegistry() {
  const active = new Set<D3CreateTicket>();

  return {
    begin(): D3CreateTicket {
      let resolve!: () => void;

      const completion = new Promise<void>(done => {
        resolve = done;
      });

      const ticket: D3CreateTicket = {
        completion,
        finish: () => {
          if (active.delete(ticket)) {
            resolve();
          }
        },
      };

      active.add(ticket);
      return ticket;
    },

    pending(): Promise<void>[] {
      return [...active].map(ticket => ticket.completion);
    },
  };
}

export type D3CreateRegistry = ReturnType<typeof createD3CreateRegistry>;

export async function loadD3Handoff<
  T extends { crewUuid?: string; id?: string },
>(
  registry: D3CreateRegistry,
  crewKey: string | null,
  isCurrent: () => boolean,
  loadProfile: (crewKey: string) => Promise<T>,
): Promise<{ profile: T | null } | undefined> {
  await Promise.all(registry.pending());

  if (!isCurrent()) return undefined;

  if (!crewKey) {
    return { profile: null };
  }

  const profile = await loadProfile(crewKey);

  if (!isCurrent()) return undefined;

  if ((profile.crewUuid || profile.id) !== crewKey) {
    throw new Error('The loaded profile does not match the selected crew.');
  }

  return { profile };
}