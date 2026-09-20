import { describe, it, expect } from 'vitest';
import {
  d3CourseKey,
  d3RankId,
  missingD3Defaults,
  mergeD3LocalRows,
  d3RowsForSave,
} from '../../client/src/modules/crew-pool/utils/d3MatrixDefaults';

const masters = [
  {
    id: 1,
    companyId: 'A',
    trainingLabel: 'Alpha',
    abr: 'AL',
    requirement: 'Company value',
  },
  { id: 2, companyId: 'B', trainingLabel: 'Beta' },
  { id: 3, companyId: 'C', trainingLabel: 'Gamma' },
];

const matrix = [
  { companyTrainingId: 1, rankId: 10, status: 'M' },
  { companyTrainingId: 2, rankId: 10, status: 'R' },
  { companyTrainingId: 3, rankId: 10, status: 'N' },
  { companyTrainingId: 3, rankId: 20, status: 'M' },
];

const make = (
  rows: any[] = [],
  suppressed = new Set<string>(),
  rankId = 10,
) =>
  missingD3Defaults(
    rows,
    masters,
    matrix,
    rankId,
    suppressed,
    'TRN-MATRIX-1-',
  );

describe('D3 Matrix defaults', () => {
  it('adds only current-rank M/R courses and retains company Requirement', () => {
    const rows = make();

    expect(rows.map(row => row.courseId)).toEqual(['A', 'B']);
    expect(rows[0].requirement).toBe('Company value');
    expect(rows[0].certificateNo).toBe('');
    expect(rows[0].issued).toBe('');
    expect(rows[0].expiry).toBe('');
  });

  it('recognizes canonical and legacy identities, not manual names', () => {
    expect(
      make([{ id: 'saved', courseId: '1' }]).map(row => row.courseId),
    ).toEqual(['B']);

    expect(
      make([{ id: 'manual', trainingCourse: 'Alpha' }]),
    ).toHaveLength(2);

    expect(
      d3CourseKey(
        { courseId: '1' },
        [
          { ...masters[0], companyId: '1' },
          { ...masters[1], id: 1 },
        ],
      ),
    ).toBe('1');
  });

  it('does not duplicate expired courses or change their details', () => {
    const row = {
      id: 'saved',
      courseId: 'A',
      certificateNo: 'KEEP',
      expiry: '2000-01-01',
      attachments: [{ id: 'file' }],
    };

    expect(make([row]).map(course => course.courseId)).toEqual(['B']);
    expect(row.certificateNo).toBe('KEEP');
    expect(row.attachments).toEqual([{ id: 'file' }]);
  });

  it('appends new-rank courses without removing previous-rank courses', () => {
    const existing = make();
    const additions = make(existing, new Set(), 20);

    expect(existing.map(row => row.courseId)).toEqual(['A', 'B']);
    expect(additions.map(row => row.courseId)).toEqual(['C']);
  });

  it('is idempotent and avoids local-ID collisions', () => {
    const rows = make([{ id: 'TRN-1' }]);

    expect(rows[0].id).toBe('TRN-MATRIX-1-1');
    expect(make(rows)).toHaveLength(0);

    expect(
      make([{
        id: 'TRN-MATRIX-1-1',
        courseId: 'different-course',
      }])[0].id,
    ).toBe('TRN-MATRIX-1-1-1');
  });

  it('suppresses additions only for the supplied session suppression set', () => {
    expect(
      make([], new Set(['A'])).map(row => row.courseId),
    ).toEqual(['B']);

    expect(make().map(row => row.courseId)).toEqual(['A', 'B']);
  });

  it('requires a unique rank match', () => {
    const ranks = [{ id: 10, rank: 'Officer' }];

    expect(d3RankId(' officer ', ranks, value => value.trim())).toBe(10);
    expect(d3RankId('', ranks, value => value)).toBeNull();
    expect(d3RankId('Unknown', ranks, value => value)).toBeNull();

    expect(
      d3RankId(
        'Officer',
        [...ranks, { id: 20, rank: 'Officer' }],
        value => value,
      ),
    ).toBeNull();
  });

  it('preserves local certificate and attachment objects during merge', () => {
    const local = {
      ...make()[0],
      certificateNo: 'KEEP',
      attachments: [{ id: 'file' }],
    };

    expect(
      mergeD3LocalRows([], [local], masters, new Set())[0],
    ).toBe(local);
  });

  it('retains historical server rows and rejects deleted UUIDs', () => {
    const server = [
      { id: 's1', trainUuid: 'u1', courseId: 'A' },
      { id: 's2', trainUuid: 'u2', courseId: 'A' },
    ];
    const manual = { id: 'manual' };

    expect(
      mergeD3LocalRows(
        server,
        [make()[0], manual],
        masters,
        new Set(),
      ).map(row => row.id),
    ).toEqual(['s1', 's2', 'manual']);

    expect(
      mergeD3LocalRows(
        server,
        [],
        masters,
        new Set(['u1']),
      ).map(row => row.id),
    ).toEqual(['s2']);
  });

  it('excludes only unsaved automatic rows when D3 is read-only', () => {
    const automatic = make()[0];
    const rows = [
      automatic,
      { id: 'manual' },
      { ...automatic, id: 'saved', trainUuid: 'u1' },
    ];

    expect(
      d3RowsForSave(rows, false).map(row => row.id),
    ).toEqual(['manual', 'saved']);

    expect(d3RowsForSave(rows, true)).toBe(rows);
  });
});