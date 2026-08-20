import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  vi,
} from 'vitest';
import {
  PromotionGuardError,
  PromotionReviewsService,
} from '../../../server/v2/promotions/services/promotionReviewsService';
import { vesselRevisionsService } from '../../../server/v2/admin/services/vesselRevisionsService';
import { getDb } from '../../../server/v2/db';
import {
  crewAssignments,
  crewMembersV2,
} from '../../../shared/v2/crew-pool/schema';
import { vesselPlanningV2 } from '../../../shared/v2/vessel/schema';
import { vesselPlanningService } from '../../../server/v2/vessel/services/vesselPlanningService';
import { and, eq, inArray } from 'drizzle-orm';
import { findNextPromotionRank } from '../../../client/src/modules/promotions/promotionUtils';

const API_BASE = 'http://localhost:5000';

describe('Promotions API Integration', () => {
  let testHierarchyId: number;
  const createdReviewUuids: string[] = [];

  beforeAll(async () => {
    const healthCheck = await fetch(`${API_BASE}/api/health`);
    if (!healthCheck.ok) {
      throw new Error('Server not running');
    }
  });

  afterAll(async () => {
    await Promise.all(
      createdReviewUuids.map((reviewUuid) =>
        fetch(`${API_BASE}/api/v2/promotions/reviews/${reviewUuid}`, {
          method: 'DELETE',
        }),
      ),
    );
  });

  describe('Task 493 selected Position safeguards', () => {
    it('collapses numbered hierarchy Positions into one base-rank promotion step', () => {
      const result = findNextPromotionRank('OS_2', [{
        rankPath: JSON.stringify([
          'OS_1',
          'OS_2',
          'OS_3',
          'AB_1',
          'AB_2',
          'AB_3',
        ]),
      } as any]);

      expect(result).toEqual({
        nextRank: 'AB',
        hasPath: true,
      });
    });

    it('fails closed when a stored hierarchy rank path is malformed', () => {
      const result = findNextPromotionRank('OS', [{
        rankPath: 'not-json',
      } as any]);

      expect(result).toEqual({
        nextRank: null,
        hasPath: false,
      });
    });

    it('saves and reloads selectedPosition while keeping promotionToRank as the base rank', async () => {
      const crewMemberId = `T493-POS-${Date.now()}`;
      const createResponse = await fetch(`${API_BASE}/api/v2/promotions/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewMemberId,
          promotionToRank: 'AB',
          promotionTiming: 'on-board',
          selectedPosition: 'AB_2',
          status: 'draft',
        }),
      });

      expect(createResponse.status).toBe(201);
      const created = await createResponse.json();
      createdReviewUuids.push(created.reviewUuid);
      expect(created.promotionToRank).toBe('AB');
      expect(created.selectedPosition).toBe('AB_2');

      const reloadResponse = await fetch(
        `${API_BASE}/api/v2/promotions/reviews/by-uuid/${created.reviewUuid}`,
      );
      expect(reloadResponse.status).toBe(200);
      const reloaded = await reloadResponse.json();
      expect(reloaded.promotionToRank).toBe('AB');
      expect(reloaded.selectedPosition).toBe('AB_2');
    });

    it('does not clear selectedPosition when Part A or Part B omits it', async () => {
      const crewMemberId = `T493-PRESERVE-${Date.now()}`;
      const createResponse = await fetch(`${API_BASE}/api/v2/promotions/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewMemberId,
          promotionToRank: 'AB',
          promotionTiming: 'on-board',
          selectedPosition: 'AB_3',
          status: 'draft',
        }),
      });
      expect(createResponse.status).toBe(201);
      const created = await createResponse.json();
      createdReviewUuids.push(created.reviewUuid);

      const partAResponse = await fetch(
        `${API_BASE}/api/v2/promotions/reviews/${created.reviewUuid}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partANotes: 'Task 493 Part A preservation check' }),
        },
      );
      expect(partAResponse.status).toBe(200);
      const afterPartA = await partAResponse.json();
      expect(afterPartA.selectedPosition).toBe('AB_3');

      const partBResponse = await fetch(
        `${API_BASE}/api/v2/promotions/reviews/${created.reviewUuid}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ partBNotes: 'Task 493 Part B preservation check' }),
        },
      );
      expect(partBResponse.status).toBe(200);
      const afterPartB = await partBResponse.json();
      expect(afterPartB.selectedPosition).toBe('AB_3');
    });

    it('clears a stale selectedPosition when a draft changes to Prior Joining', async () => {
      const crewMemberId = `T493-PRIOR-${Date.now()}`;
      const createResponse = await fetch(`${API_BASE}/api/v2/promotions/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewMemberId,
          promotionToRank: 'AB',
          promotionTiming: 'on-board',
          selectedPosition: 'AB_1',
          status: 'draft',
        }),
      });
      expect(createResponse.status).toBe(201);
      const created = await createResponse.json();
      createdReviewUuids.push(created.reviewUuid);

      const updateResponse = await fetch(
        `${API_BASE}/api/v2/promotions/reviews/${created.reviewUuid}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promotionTiming: 'prior-joining' }),
        },
      );
      expect(updateResponse.status).toBe(200);
      const updated = await updateResponse.json();
      expect(updated.selectedPosition).toBeNull();
    });

    it('rejects Promotion Type changes after Part B has been submitted', async () => {
      const crewMemberId = `T493-TIMING-${Date.now()}`;
      const createResponse = await fetch(`${API_BASE}/api/v2/promotions/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          crewMemberId,
          promotionToRank: 'AB',
          promotionTiming: 'on-board',
          selectedPosition: 'AB_2',
          status: 'approved',
        }),
      });
      expect(createResponse.status).toBe(201);
      const created = await createResponse.json();
      createdReviewUuids.push(created.reviewUuid);

      const updateResponse = await fetch(
        `${API_BASE}/api/v2/promotions/reviews/${created.reviewUuid}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ promotionTiming: 'prior-joining' }),
        },
      );
      expect(updateResponse.status).toBe(400);
      const error = await updateResponse.json();
      expect(error.error).toBe(
        'Promotion Type cannot be changed after Part B has been submitted.',
      );
    });
  });

  describe('Task 493 onboard Position guard coverage', () => {
    const fixtureSuffix = `${Date.now()}-${process.pid}`;
    const crewMemberId = `T493-GUARD-${fixtureSuffix}`;
    const crewUuid = `task-493-promotee-${fixtureSuffix}`;
    const assignmentUuid = `task-493-assignment-${fixtureSuffix}`;
    const vesselUuid = 'task-493-vessel';

    beforeAll(async () => {
      const db = getDb();
      await db.insert(crewMembersV2).values({
        crewUuid,
        empNo: crewMemberId,
        firstName: 'Task',
        familyName: 'Guard',
        status: 'Active',
      });
      await db.insert(crewAssignments).values({
        assignUuid: assignmentUuid,
        crewUuid,
        vesselUuid,
        isCurrent: true,
      });
    });

    afterAll(async () => {
      const db = getDb();
      await db
        .delete(crewAssignments)
        .where(eq(crewAssignments.assignUuid, assignmentUuid));
      await db
        .delete(crewMembersV2)
        .where(eq(crewMembersV2.crewUuid, crewUuid));
    });

    const planningRow = (overrides: Record<string, unknown>) => ({
      planUuid: 'plan-default',
      vesselUuid,
      rankId: 'rank-default',
      rank: 'OS_1',
      crewStatus: 'primary',
      crewUuid: null,
      signOnDate: null,
      signOffDate: null,
      isDeleted: false,
      archivedAt: null,
      ...overrides,
    });

    const currentPromoteeRow = () => planningRow({
      planUuid: 'plan-current',
      rankId: 'rank-os-1',
      rank: 'OS_1',
      crewStatus: 'primary',
      crewUuid,
      signOnDate: '2026-01-01',
    });

    const targetPrimaryRow = () => planningRow({
      planUuid: 'plan-target-primary',
      rankId: 'rank-ab-2',
      rank: 'AB_2',
      crewStatus: 'primary',
      crewUuid: null,
    });

    const exactPositionRelieverRow = () => planningRow({
      planUuid: 'plan-current-reliever',
      rankId: 'rank-os-1',
      rank: 'OS_1',
      crewStatus: 'secondary',
      crewUuid: 'task-493-exact-reliever',
      signOnDate: '2026-01-01',
    });

    const createGuardHarness = (rows: any[]) => {
      const service = new PromotionReviewsService();
      vi.spyOn(vesselRevisionsService, 'getRanksByVesselId').mockResolvedValue([
        { displayRole: 'OS_1' },
        { displayRole: 'OS_2' },
        { displayRole: 'AB_1' },
        { displayRole: 'AB_2' },
        { displayRole: 'AB_3' },
      ]);
      vi.spyOn(service as any, 'getActivePlanningRows').mockResolvedValue(rows);
      return service as any;
    };

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('requires an exact Position when the vessel has multiple target Positions', async () => {
      const service = createGuardHarness([
        currentPromoteeRow(),
        exactPositionRelieverRow(),
        targetPrimaryRow(),
      ]);

      await expect(service.resolveOnboardPromotionContext({
        crewMemberId,
        promotionToRank: 'AB',
        selectedPosition: null,
      })).rejects.toThrow('Please select a position before completing the promotion.');
    });

    it('rejects a Position outside the target base-rank family', async () => {
      const service = createGuardHarness([
        currentPromoteeRow(),
        exactPositionRelieverRow(),
        targetPrimaryRow(),
      ]);

      await expect(service.resolveOnboardPromotionContext({
        crewMemberId,
        promotionToRank: 'AB',
        selectedPosition: 'OS_2',
      })).rejects.toThrow(
        'The selected position "OS_2" is not configured for the target rank',
      );
    });

    it('blocks a selected Position with both a signed-on Primary and Secondary', async () => {
      const service = createGuardHarness([
        currentPromoteeRow(),
        exactPositionRelieverRow(),
        targetPrimaryRow(),
        planningRow({
          planUuid: 'plan-target-occupied-primary',
          rankId: 'rank-ab-2',
          rank: 'AB_2',
          crewStatus: 'primary',
          crewUuid: 'task-493-target-primary',
          signOnDate: '2026-01-01',
        }),
        planningRow({
          planUuid: 'plan-target-occupied-secondary',
          rankId: 'rank-ab-2',
          rank: 'AB_2',
          crewStatus: 'secondary',
          crewUuid: 'task-493-target-secondary',
          signOnDate: '2026-01-01',
        }),
      ]);

      await expect(service.resolveOnboardPromotionContext({
        crewMemberId,
        promotionToRank: 'AB',
        selectedPosition: 'AB_2',
      })).rejects.toThrow(
        'Neither a Primary nor Secondary position is available',
      );
    });

    it('accepts another signed-on Secondary at the exact current Position', async () => {
      const service = createGuardHarness([
        currentPromoteeRow(),
        exactPositionRelieverRow(),
        targetPrimaryRow(),
      ]);

      const context = await service.resolveOnboardPromotionContext({
        crewMemberId,
        promotionToRank: 'AB',
        selectedPosition: 'AB_2',
      });

      expect(context).toMatchObject({
        currentPlanUuid: 'plan-current',
        currentPosition: 'OS_1',
        targetPosition: 'AB_2',
        targetPlanUuid: 'plan-target-primary',
        targetRankId: 'rank-ab-2',
      });
    });

    it('accepts signed-on coverage in a sibling Position of the current base-rank family', async () => {
      const service = createGuardHarness([
        currentPromoteeRow(),
        planningRow({
          planUuid: 'plan-current-family-coverage',
          rankId: 'rank-os-2',
          rank: 'OS_2',
          crewStatus: 'primary',
          crewUuid: 'task-493-family-coverage',
          signOnDate: '2026-01-01',
        }),
        targetPrimaryRow(),
      ]);

      await expect(service.resolveOnboardPromotionContext({
        crewMemberId,
        promotionToRank: 'AB',
        selectedPosition: 'AB_2',
      })).resolves.toMatchObject({
        targetPosition: 'AB_2',
      });
    });

    it('ignores future sign-ons when validating current-rank coverage', async () => {
      const service = createGuardHarness([
        currentPromoteeRow(),
        planningRow({
          planUuid: 'plan-current-future-reliever',
          rankId: 'rank-os-1',
          rank: 'OS_1',
          crewStatus: 'secondary',
          crewUuid: 'task-493-future-reliever',
          signOnDate: '2099-01-01',
        }),
        targetPrimaryRow(),
      ]);

      await expect(service.resolveOnboardPromotionContext({
        crewMemberId,
        promotionToRank: 'AB',
        selectedPosition: 'AB_2',
      })).rejects.toThrow(
        "A reliever must be assigned and signed onboard for the crew member's current rank",
      );
    });

    it('takes rankId and planUuid from the same explicit target Primary row', async () => {
      const service = createGuardHarness([
        currentPromoteeRow(),
        exactPositionRelieverRow(),
        planningRow({
          planUuid: 'plan-target-secondary-first',
          rankId: 'wrong-secondary-rank-id',
          rank: 'AB_2',
          crewStatus: 'secondary',
          crewUuid: 'task-493-future-target-secondary',
          signOnDate: '2099-01-01',
        }),
        targetPrimaryRow(),
      ]);

      await expect(service.resolveOnboardPromotionContext({
        crewMemberId,
        promotionToRank: 'AB',
        selectedPosition: 'AB_2',
      })).resolves.toMatchObject({
        targetPlanUuid: 'plan-target-primary',
        targetRankId: 'rank-ab-2',
      });
    });

    it('serializes same-vessel same-Position callbacks with the database advisory lock', async () => {
      const service = new PromotionReviewsService() as any;
      const lockContext = {
        vesselUuid,
        currentPlanUuid: 'plan-current',
        currentPosition: 'OS_1',
        targetPosition: 'AB_2',
        targetRankId: 'rank-ab-2',
        targetPlanUuid: 'plan-target-primary',
      };
      let activeCallbacks = 0;
      let maximumConcurrentCallbacks = 0;

      const runLocked = () => service.withOnboardPositionLock(
        lockContext,
        async () => {
          activeCallbacks += 1;
          maximumConcurrentCallbacks = Math.max(
            maximumConcurrentCallbacks,
            activeCallbacks,
          );
          await new Promise((resolve) => setTimeout(resolve, 75));
          activeCallbacks -= 1;
        },
      );

      await Promise.all([runLocked(), runLocked()]);
      expect(maximumConcurrentCallbacks).toBe(1);
    });
  });

  describe('Onboard promotion old Position rank-change sign-off', () => {
    const fixtureSuffix = `${Date.now()}-${process.pid}`;
    const vesselUuid = `promotion-signoff-vessel-${fixtureSuffix}`;
    const oldPrimaryPlanUuid = `promotion-signoff-old-primary-${fixtureSuffix}`;
    const siblingPrimaryPlanUuid = `promotion-signoff-sibling-primary-${fixtureSuffix}`;
    const exactSecondaryOldPrimaryPlanUuid = `promotion-signoff-exact-old-primary-${fixtureSuffix}`;
    const exactSecondaryPlanUuid = `promotion-signoff-exact-secondary-${fixtureSuffix}`;
    const planUuids = [
      oldPrimaryPlanUuid,
      siblingPrimaryPlanUuid,
      exactSecondaryOldPrimaryPlanUuid,
      exactSecondaryPlanUuid,
    ];

    afterAll(async () => {
      const db = getDb();
      await db
        .delete(vesselPlanningV2)
        .where(inArray(vesselPlanningV2.planUuid, planUuids));
    });

    it('archives the exact old Position and leaves it vacant when no exact Secondary exists', async () => {
      const db = getDb();
      await db.insert(vesselPlanningV2).values([
        {
          planUuid: oldPrimaryPlanUuid,
          vesselUuid,
          rankId: 'promotion-signoff-os-1',
          rank: 'OS_1',
          crewUuid: `promotion-signoff-promotee-${fixtureSuffix}`,
          crewStatus: 'primary',
          signOnDate: '2026-01-01',
        },
        {
          planUuid: siblingPrimaryPlanUuid,
          vesselUuid,
          rankId: 'promotion-signoff-os-2',
          rank: 'OS_2',
          crewUuid: `promotion-signoff-sibling-${fixtureSuffix}`,
          crewStatus: 'primary',
          signOnDate: '2026-01-01',
        },
      ]);

      await vesselPlanningService.signOffForRankChange(oldPrimaryPlanUuid, {
        signOffDate: '2026-08-20',
      });

      const [oldPosition] = await db
        .select()
        .from(vesselPlanningV2)
        .where(eq(vesselPlanningV2.planUuid, oldPrimaryPlanUuid));
      const [siblingPosition] = await db
        .select()
        .from(vesselPlanningV2)
        .where(eq(vesselPlanningV2.planUuid, siblingPrimaryPlanUuid));
      const activeOldPositionRows = await db
        .select()
        .from(vesselPlanningV2)
        .where(
          and(
            eq(vesselPlanningV2.vesselUuid, vesselUuid),
            eq(vesselPlanningV2.rank, 'OS_1'),
            eq(vesselPlanningV2.isDeleted, false),
            eq(vesselPlanningV2.isArchived, false),
          ),
        );

      expect(oldPosition).toMatchObject({
        signOffDate: '2026-08-20',
        reliefStatus: 'Signed Off',
        isArchived: true,
      });
      expect(activeOldPositionRows).toHaveLength(0);
      expect(siblingPosition).toMatchObject({
        crewStatus: 'primary',
        isArchived: false,
      });
    });

    it('continues promoting an exact old-Position Secondary to Primary', async () => {
      const db = getDb();
      await db.insert(vesselPlanningV2).values([
        {
          planUuid: exactSecondaryOldPrimaryPlanUuid,
          vesselUuid,
          rankId: 'promotion-signoff-exact-os-1',
          rank: 'OS_1',
          crewUuid: `promotion-signoff-exact-primary-${fixtureSuffix}`,
          crewStatus: 'primary',
          signOnDate: '2026-01-01',
        },
        {
          planUuid: exactSecondaryPlanUuid,
          vesselUuid,
          rankId: 'promotion-signoff-exact-os-1',
          rank: 'OS_1',
          crewUuid: `promotion-signoff-exact-secondary-${fixtureSuffix}`,
          crewStatus: 'secondary',
          signOnDate: '2026-01-01',
        },
      ]);

      await vesselPlanningService.signOffForRankChange(
        exactSecondaryOldPrimaryPlanUuid,
        { signOffDate: '2026-08-20' },
      );

      const [oldPosition] = await db
        .select()
        .from(vesselPlanningV2)
        .where(eq(vesselPlanningV2.planUuid, exactSecondaryOldPrimaryPlanUuid));
      const [exactSecondary] = await db
        .select()
        .from(vesselPlanningV2)
        .where(eq(vesselPlanningV2.planUuid, exactSecondaryPlanUuid));

      expect(oldPosition).toMatchObject({
        signOffDate: '2026-08-20',
        reliefStatus: 'Signed Off',
        isArchived: true,
      });
      expect(exactSecondary).toMatchObject({
        crewStatus: 'primary',
        isArchived: false,
      });
    });
  });

  describe('POST /api/promotion-hierarchies', () => {
    it('should create new promotion hierarchy', async () => {
      const hierarchy = {
        groupName: `Deck Officers ${Date.now()}`,
        rankPath: JSON.stringify(['Third Officer', 'Second Officer', 'Chief Officer', 'Master']),
        isActive: true
      };

      const response = await fetch(`${API_BASE}/api/promotion-hierarchies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hierarchy)
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.id).toBeDefined();
      testHierarchyId = data.id;
    });

    it('should return 400 for missing required fields', async () => {
      const incomplete = {
        groupName: 'Incomplete Group'
      };

      const response = await fetch(`${API_BASE}/api/promotion-hierarchies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incomplete)
      });

      expect(response.status).toBe(400);
    });

    it('should accept hierarchy with array rank path', async () => {
      const hierarchyWithPath = {
        groupName: `Engine Officers ${Date.now()}`,
        rankPath: ['Oiler', 'AB', 'Fourth Engineer', 'Third Engineer'],
        isActive: true
      };

      const response = await fetch(`${API_BASE}/api/promotion-hierarchies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hierarchyWithPath)
      });

      expect(response.status).toBe(201);
    });
  });

  describe('GET /api/promotion-hierarchies', () => {
    it('should list all promotion hierarchies', async () => {
      const response = await fetch(`${API_BASE}/api/promotion-hierarchies`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return hierarchy with groupName', async () => {
      const response = await fetch(`${API_BASE}/api/promotion-hierarchies`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      if (data.length > 0) {
        expect(data[0]).toHaveProperty('groupName');
      }
    });
  });

  describe('GET /api/promotion-hierarchies/:id', () => {
    it('should get hierarchy by id if exists', async () => {
      if (testHierarchyId) {
        const response = await fetch(`${API_BASE}/api/promotion-hierarchies/${testHierarchyId}`);
        expect([200, 404]).toContain(response.status);
      } else {
        expect(true).toBe(true);
      }
    });

    it('should return 404 for non-existent hierarchy', async () => {
      const response = await fetch(`${API_BASE}/api/promotion-hierarchies/99999`);
      expect(response.status).toBe(404);
    });
  });

  describe('PATCH /api/promotion-hierarchies/:id', () => {
    it('should update hierarchy', async () => {
      const createRes = await fetch(`${API_BASE}/api/promotion-hierarchies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: `Update Test ${Date.now()}`,
          rankPath: JSON.stringify(['AB', 'Bosun']),
          isActive: true
        })
      });

      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      const response = await fetch(
        `${API_BASE}/api/promotion-hierarchies/${created.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false })
        }
      );

      expect(response.status).toBe(200);
      const updated = await response.json();
      expect(updated.isActive).toBe(false);
    });

    it('should return 404 for non-existent hierarchy', async () => {
      const response = await fetch(
        `${API_BASE}/api/promotion-hierarchies/99999`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: false })
        }
      );

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/promotion-hierarchies/:id', () => {
    it('should delete hierarchy', async () => {
      const createRes = await fetch(`${API_BASE}/api/promotion-hierarchies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: `Delete Test ${Date.now()}`,
          rankPath: JSON.stringify(['OS', 'AB']),
          isActive: true
        })
      });

      expect(createRes.status).toBe(201);
      const created = await createRes.json();

      const response = await fetch(
        `${API_BASE}/api/promotion-hierarchies/${created.id}`,
        { method: 'DELETE' }
      );

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/promotions', () => {
    it('should list all promotions', async () => {
      const response = await fetch(`${API_BASE}/api/promotions`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await fetch(`${API_BASE}/api/promotions?status=draft`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });

  describe('GET /api/promotions/:id', () => {
    it('should return 404 for non-existent promotion', async () => {
      const response = await fetch(`${API_BASE}/api/promotions/99999`);
      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/promotions/crew/:crewMemberId', () => {
    it('should get promotions for specific crew member', async () => {
      const response = await fetch(`${API_BASE}/api/promotions/crew/A000001`);
      
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    });
  });
});
