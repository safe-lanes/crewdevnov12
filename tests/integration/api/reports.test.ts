import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import { getDb } from '../../../server/v2/db';
import { crewMembersV2 } from '../../../shared/v2/crew-pool/schema';
import { vesselPlanningV2 } from '../../../shared/v2/vessel/schema';
import { masterVessels } from '../../../shared/schema';

const API_BASE = 'http://localhost:5000';

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('Reports API Integration', () => {
  const fixtureSuffix = `${Date.now()}-${process.pid}`;
  const vesselAUuid = `report-sign-ons-vessel-a-${fixtureSuffix}`;
  const vesselBUuid = `report-sign-ons-vessel-b-${fixtureSuffix}`;
  const vesselAName = `Report Sign-Ons Vessel A ${fixtureSuffix}`;
  const vesselBName = `Report Sign-Ons Vessel B ${fixtureSuffix}`;
  const onboardCrewUuid = `report-sign-ons-onboard-${fixtureSuffix}`;
  const today = new Date().toISOString().slice(0, 10);
  const timestampLocalDate = addDays(today, 7);
  const timestampStoredDate = `${addDays(timestampLocalDate, -1)}T18:30:00.000Z`;

  const crewFixtures = [
    { key: 'onboard', empNo: `ONBOARD-${fixtureSuffix}`, firstName: 'Onboard', familyName: 'Crew' },
    { key: 'past', empNo: `PAST-${fixtureSuffix}`, firstName: 'Past', familyName: 'Planned' },
    { key: 'today', empNo: `TODAY-${fixtureSuffix}`, firstName: 'Today', familyName: 'Confirmed' },
    { key: 'boundary', empNo: `BOUNDARY-${fixtureSuffix}`, firstName: 'Boundary', familyName: 'Transit' },
    { key: 'timestamp', empNo: `TIMESTAMP-${fixtureSuffix}`, firstName: 'Timestamp', familyName: 'Planned' },
    { key: 'vessel-b', empNo: `VESSEL-B-${fixtureSuffix}`, firstName: 'Vessel', familyName: 'Filtered' },
    { key: 'after', empNo: `AFTER-${fixtureSuffix}`, firstName: 'After', familyName: 'Window' },
    { key: 'blank', empNo: `BLANK-${fixtureSuffix}`, firstName: 'Blank', familyName: 'Date' },
    { key: 'invalid', empNo: `INVALID-${fixtureSuffix}`, firstName: 'Invalid', familyName: 'Date' },
    { key: 'invalid-timestamp', empNo: `INVALID-TIMESTAMP-${fixtureSuffix}`, firstName: 'Invalid', familyName: 'Timestamp' },
    { key: 'proposed', empNo: `PROPOSED-${fixtureSuffix}`, firstName: 'Proposed', familyName: 'Status' },
    { key: 'signed-on', empNo: `SIGNED-${fixtureSuffix}`, firstName: 'Signed', familyName: 'On' },
    { key: 'unsupported', empNo: `UNSUPPORTED-${fixtureSuffix}`, firstName: 'Unsupported', familyName: 'Status' },
    { key: 'archived-reliever', empNo: `ARCHIVED-${fixtureSuffix}`, firstName: 'Archived', familyName: 'Reliever' },
    { key: 'archived-parent', empNo: `ARCHIVED-PARENT-${fixtureSuffix}`, firstName: 'Visible', familyName: 'Reliever' },
    { key: 'deleted-reliever', empNo: `DELETED-${fixtureSuffix}`, firstName: 'Deleted', familyName: 'Reliever' },
    { key: 'deleted-plan', empNo: `DELETED-PLAN-${fixtureSuffix}`, firstName: 'Deleted', familyName: 'Plan' },
  ].map((crew) => ({
    ...crew,
    crewUuid: `report-sign-ons-${crew.key}-${fixtureSuffix}`,
  }));

  const crewByKey = Object.fromEntries(crewFixtures.map((crew) => [crew.key, crew]));
  const planUuids: string[] = [];

  beforeAll(async () => {
    const healthCheck = await fetch(`${API_BASE}/api/health`);
    if (!healthCheck.ok) {
      throw new Error('Server not running');
    }

    const db = getDb();

    await db.insert(masterVessels).values([
      { vesselUuid: vesselAUuid, vessel: vesselAName },
      { vesselUuid: vesselBUuid, vessel: vesselBName },
    ]);

    await db.insert(crewMembersV2).values(
      crewFixtures.map((crew) => ({
        crewUuid: crew.crewUuid,
        empNo: crew.empNo,
        firstName: crew.firstName,
        familyName: crew.familyName,
        status: 'Active',
        isDeleted: crew.key === 'deleted-reliever',
      })),
    );

    const planningRow = (
      key: string,
      joiningStatus: string | null,
      relieverSignOnDate: string | null,
      overrides: Record<string, unknown> = {},
    ) => {
      const planUuid = `report-sign-ons-plan-${key}-${fixtureSuffix}`;
      planUuids.push(planUuid);
      return {
        planUuid,
        vesselUuid: vesselAUuid,
        rankId: `report-sign-ons-rank-${key}`,
        rank: 'AB_1',
        crewUuid: onboardCrewUuid,
        crewStatus: 'primary',
        relieverCrewUuid: crewByKey[key]?.crewUuid ?? null,
        relieverSignOnDate,
        joiningStatus,
        isArchived: false,
        isRelieverArchived: false,
        isDeleted: false,
        ...overrides,
      };
    };

    await db.insert(vesselPlanningV2).values([
      planningRow('past', 'Planned', addDays(today, -3)),
      planningRow('today', 'Confirmed', today),
      planningRow('archived-parent', 'Planned', addDays(today, 5), { isArchived: true }),
      planningRow('vessel-b', 'Confirmed', addDays(today, 10), { vesselUuid: vesselBUuid }),
      planningRow('boundary', 'In Transit', addDays(today, 30)),
      planningRow('timestamp', 'Planned', timestampStoredDate),
      planningRow('after', 'Planned', addDays(today, 31)),
      planningRow('blank', 'Planned', null),
      planningRow('invalid', 'Planned', 'not-a-date'),
      planningRow('invalid-timestamp', 'Planned', `${addDays(today, 8)}T99:99:99.000Z`),
      planningRow('proposed', 'Proposed', today),
      planningRow('signed-on', 'Signed On', today),
      planningRow('unsupported', 'Ready', today),
      planningRow('archived-reliever', 'Planned', today, { isRelieverArchived: true }),
      planningRow('deleted-reliever', 'Planned', today),
      planningRow('deleted-plan', 'Planned', today, { isDeleted: true }),
    ]);
  });

  afterAll(async () => {
    const db = getDb();
    await db
      .delete(vesselPlanningV2)
      .where(inArray(vesselPlanningV2.planUuid, planUuids));
    await db
      .delete(crewMembersV2)
      .where(inArray(crewMembersV2.crewUuid, crewFixtures.map((crew) => crew.crewUuid)));
    await db
      .delete(masterVessels)
      .where(inArray(masterVessels.vesselUuid, [vesselAUuid, vesselBUuid]));
  });

  async function runReport(filters: Record<string, unknown>) {
    const response = await fetch(`${API_BASE}/api/v2/reports/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reportId: 'rot-planned-sign-ons',
        filters,
        page: 1,
        pageSize: 100,
      }),
    });

    expect(response.status).toBe(200);
    return response.json();
  }

  it('returns the requested columns, reliever identity, statuses, dates, and default order', async () => {
    const data = await runReport({ withinDays: 30, vessel: vesselAName });

    expect(data.columns.map((column: { key: string }) => column.key)).toEqual([
      'empNo',
      'name',
      'presentRank',
      'vesselName',
      'signOnStatus',
      'plannedSignOnDate',
    ]);
    expect(data.rows.map((row: { empNo: string }) => row.empNo)).toEqual([
      crewByKey.past.empNo,
      crewByKey.today.empNo,
      crewByKey['archived-parent'].empNo,
      crewByKey.timestamp.empNo,
      crewByKey.boundary.empNo,
    ]);
    expect(data.rows.map((row: { signOnStatus: string }) => row.signOnStatus)).toEqual([
      'Planned',
      'Confirmed',
      'Planned',
      'Planned',
      'In Transit',
    ]);
    expect(data.rows.map((row: { empNo: string }) => row.empNo)).not.toContain(
      crewByKey.onboard.empNo,
    );
    expect(data.rows.find((row: { empNo: string; plannedSignOnDate: string }) => row.empNo === crewByKey.timestamp.empNo)?.plannedSignOnDate)
      .toBe(timestampLocalDate);
    expect(data.rows.map((row: { empNo: string }) => row.empNo)).not.toContain(
      crewByKey['invalid-timestamp'].empNo,
    );
    expect(data.total).toBe(5);
  });

  it('applies the Vessel filter', async () => {
    const vesselAData = await runReport({ withinDays: 30, vessel: vesselAName });
    const vesselBData = await runReport({ withinDays: 30, vessel: vesselBName });

    expect(vesselAData.rows.map((row: { empNo: string }) => row.empNo)).toEqual([
      crewByKey.past.empNo,
      crewByKey.today.empNo,
      crewByKey['archived-parent'].empNo,
      crewByKey.timestamp.empNo,
      crewByKey.boundary.empNo,
    ]);
    expect(vesselAData.total).toBe(5);
    expect(vesselBData.rows.map((row: { empNo: string }) => row.empNo)).toEqual([
      crewByKey['vessel-b'].empNo,
    ]);
    expect(vesselBData.total).toBe(1);
  });

  it('includes overdue rows and today when Within is zero', async () => {
    const data = await runReport({ withinDays: 0, vessel: vesselAName });

    expect(data.rows.map((row: { empNo: string }) => row.empNo)).toEqual([
      crewByKey.past.empNo,
      crewByKey.today.empNo,
    ]);
    expect(data.total).toBe(2);
  });
});
