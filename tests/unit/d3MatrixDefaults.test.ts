import { describe, it, expect } from 'vitest';
import {
  d3CourseKey,
  d3TrainingName,
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

  it('recognizes canonical and legacy identities and manual names', () => {
    expect(
      make([{ id: 'saved', courseId: '1' }]).map(row => row.courseId),
    ).toEqual(['B']);

    expect(
      make([{ id: 'manual', trainingCourse: 'Alpha' }]).map(row => row.courseId),
    ).toEqual(['B']);

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
describe('D3 configured rank labels', () => {
  const ranks = [
    { id: 3, rank: 'Second Officer', label: '2nd Officer' },
    { id: 4, rank: 'Third Officer', label: '3rd Officer' },
    { id: 6, rank: 'Second Engineer', label: '2nd Engineer' },
    { id: 7, rank: 'Third Engineer', label: '3rd Engineer' },
    { id: 8, rank: 'Fourth Engineer', label: '4th Engineer' },
    { id: 15, rank: 'Able Bodied Seaman', label: 'AB' },
    { id: 16, rank: 'Ordinary Seaman', label: 'OS' },
  ];
  const normalize = (value: string) => value.replace(/_\d+$/, '');

  it.each(ranks)('matches $label and its numbered positions', rank => {
    expect(d3RankId(rank.label, ranks, normalize)).toBe(rank.id);
    expect(d3RankId(rank.rank, ranks, normalize)).toBe(rank.id);
    expect(d3RankId(rank.label + '_1', ranks, normalize)).toBe(rank.id);
    expect(d3RankId(rank.label + '_2', ranks, normalize)).toBe(rank.id);
    expect(d3RankId(` ${rank.label.toLowerCase()} `, ranks, normalize)).toBe(rank.id);
  });

  it('uses configured labels rather than a fixed list of aliases', () => {
    expect(d3RankId('Custom Role', [
      { id: 30, rank: 'Custom Master', label: 'Custom Role' },
    ], normalize)).toBe(30);
    expect(d3RankId('A/B', ranks, normalize)).toBeNull();
  });

  it('keeps exact and normalized master-name matches ahead of labels', () => {
    const conflicting = [...ranks, { id: 90, rank: 'AB' }];
    expect(d3RankId('AB', conflicting, normalize)).toBe(90);
    expect(d3RankId('AB_1', conflicting, normalize)).toBe(90);
  });

  it('does not use labels to override ambiguous existing name matches', () => {
    const ambiguous = [
      ...ranks,
      { id: 90, rank: 'AB' },
      { id: 91, rank: 'AB' },
    ];
    expect(d3RankId('AB', ambiguous, normalize)).toBeNull();
    expect(d3RankId('AB_1', ambiguous, normalize)).toBeNull();
  });

  it('rejects labels identifying different ranks, including normalized collisions', () => {
    const ambiguous = [...ranks, { id: 90, rank: 'Other', label: 'AB' }];
    expect(d3RankId('AB', ambiguous, normalize)).toBeNull();
    expect(d3RankId('AB_1', ambiguous, normalize)).toBeNull();
    expect(d3RankId('AB', [
      ...ranks, { id: 90, rank: 'Other', label: 'AB_2' },
    ], normalize)).toBeNull();
  });

  it('retains unique numeric-ID checks and ignores absent or blank labels', () => {
    expect(d3RankId('AB', [...ranks, {
      id: '15', rank: 'Same ID', label: 'AB',
    }], normalize)).toBe(15);
    expect(d3RankId('AB', [
      { id: 'invalid', rank: 'Other', label: 'AB' },
    ], normalize)).toBeNull();
    expect(d3RankId('AB', [
      { id: Infinity, rank: 'Other', label: 'AB' },
    ], normalize)).toBeNull();
    expect(d3RankId('AB', [
      { id: 'invalid', rank: 'AB' }, ...ranks,
    ], normalize)).toBeNull();
    expect(d3RankId('Unknown', [
      { id: 90, rank: 'Other' },
      { id: 91, rank: 'Another', label: '   ' },
    ], normalize)).toBeNull();
    expect(d3RankId('   ', ranks, normalize)).toBeNull();
  });

  it('selects only the resolved rank courses without duplicating existing courses', () => {
    const rankId = d3RankId('AB_2', ranks, normalize);
    expect(rankId).toBe(15);
    const requirements = [
      { companyTrainingId: 1, rankId: 15, status: 'M' },
      { companyTrainingId: 2, rankId: 15, status: 'R' },
      { companyTrainingId: 3, rankId: 15, status: 'N' },
      { companyTrainingId: 3, rankId: 16, status: 'M' },
    ];
    const select = (rows: any[], suppressed = new Set<string>()) =>
      missingD3Defaults(rows, masters, requirements, rankId!, suppressed, 'TEST-');
    const defaults = select([]);
    expect(defaults.map(row => row.courseId)).toEqual(['A', 'B']);
    expect(select(defaults)).toEqual([]);
    expect(select([], new Set(['A'])).map(row => row.courseId)).toEqual(['B']);
    const existing = { id: 'saved', courseId: 'A', certificateNo: 'KEEP' };
    expect(select([existing]).map(row => row.courseId)).toEqual(['B']);
    expect(existing.certificateNo).toBe('KEEP');
  });
});

describe('D3 full-name duplicate prevention', () => {
  it('normalizes only case and whitespace and keeps blank names empty', () => {
    expect(d3TrainingName('  Advanced\t Oil  Training\n')).toBe('advanced oil training');
    expect(d3TrainingName()).toBe('');
    expect(d3TrainingName('   ')).toBe('');
    expect(d3TrainingName('Oil/Chemical')).not.toBe(d3TrainingName('Oil Chemical'));
    expect(d3TrainingName('Basic Oil')).not.toBe(d3TrainingName('Advanced Oil'));
    expect(d3TrainingName('Basic Oil')).not.toBe(d3TrainingName('Basic Chemical'));
  });

  it.each([undefined, 'OLD', '999', 'C'])('blocks the same name with ID %s', courseId => {
    expect(make([{ id: 'existing', courseId, trainingCourse: '  ALPHA  ' }])
      .map(row => row.courseId)).toEqual(['B']);
  });

  it('does not require abbreviation or requirement to match', () => {
    expect(make([{
      id: 'existing', courseId: 'OLD', trainingCourse: 'Alpha',
      abbr: 'DIFFERENT', requirement: 'Different requirement',
    }]).map(row => row.courseId)).toEqual(['B']);
  });

  it('does not match blank names or partial names', () => {
    for (const trainingCourse of [undefined, '', '   ', 'Alph', 'Alpha Refresher']) {
      expect(make([{ id: 'existing', trainingCourse }])).toHaveLength(2);
    }
    expect(make([{ id: 'existing', courseId: 'A', trainingCourse: '' }])
      .map(row => row.courseId)).toEqual(['B']);
  });

  it('blocks same-name additions in one pass and on repeat without changing suppression', () => {
    const aliases = [masters[0], { ...masters[1], trainingLabel: ' ALPHA ' }];
    const select = (rows: any[], suppressed = new Set<string>()) =>
      missingD3Defaults(rows, aliases, matrix, 10, suppressed, 'TEST-');
    const first = select([]);
    expect(first.map(row => row.courseId)).toEqual(['A']);
    expect(select(first)).toEqual([]);
    expect(select([], new Set(['A'])).map(row => row.courseId)).toEqual(['B']);
  });

  it('preserves existing duplicates, expired certificate details and attachments', () => {
    const row = {
      id: 'saved', trainUuid: 'u1', courseId: 'OLD', trainingCourse: 'Alpha',
      certificateNo: 'KEEP', expiry: '2000-01-01', attachments: [{ id: 'file' }],
    };
    const rows = [row, { ...row, id: 'saved2', trainUuid: 'u2' }];
    const before = JSON.stringify(rows);
    expect(make(rows).map(course => course.courseId)).toEqual(['B']);
    expect(JSON.stringify(rows)).toBe(before);
    expect(rows[0]).toBe(row);
  });

  it('leaves merging unchanged and retains same-name unsaved edits with different IDs', () => {
    const saved = { id: 'saved', courseId: 'OLD', trainingCourse: 'Alpha', trainUuid: 'u1' };
    const local = { ...make()[0], certificateNo: 'UNSAVED', attachments: [{ id: 'file' }] };
    const result = mergeD3LocalRows([saved], [local], masters, new Set());
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(saved);
    expect(result[1]).toBe(local);
  });
});