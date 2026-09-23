import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Client } from "pg";
import { randomUUID } from "crypto";
import type { Server } from "http";
import { vesselPlanningRepository } from "@server/v2/vessel/repositories";
import { rotationDeployService } from "@server/v2/rotation/services";

const TEST_SECRET = "reliever-unassign-test-secret";
const ACTOR_ID = 990312;
const u = () => randomUUID();

let db: Client;
let server: Server;
const planUuids: string[] = [];
const assignUuids: string[] = [];
const crewUuids: string[] = [];
const entryUuids: string[] = [];

function token(): string {
  return jwt.sign(
    { id: ACTOR_ID, domain: "test", userType: "Admin" },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

async function insert(table: string, row: Record<string, unknown>) {
  const columns = Object.keys(row);
  const values = Object.values(row);
  const params = columns.map((_, index) => `$${index + 1}`).join(", ");
  await db.query(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${params})`,
    values,
  );
}

async function seedPlanning(relieverCrewUuid: string | null) {
  const planUuid = u();
  const vesselUuid = u();
  const rankId = `R-${planUuid}`;
  const rank = "Test Officer";
  planUuids.push(planUuid);
  await insert("vessel_planning_v2", {
    plan_uuid: planUuid,
    vessel_uuid: vesselUuid,
    rank_id: rankId,
    rank,
    reliever_crew_uuid: relieverCrewUuid,
    joining_status: "Planned",
    reliever_sign_on_date: "2026-10-01",
    joining_port_uuid: u(),
    planned_confirmed_date: "2026-09-23",
    travel_start_date: "2026-09-30",
    reliever_contract_period_months: 4,
    reliever_contract_end_range_start_months: 3,
    reliever_contract_end_range_end_months: 5,
    deployment_checklist_completed: true,
    applicable_docs_checked: true,
  });
  return { planUuid, vesselUuid, rankId, rank };
}

async function seedAssignment(
  crewUuid: string,
  vesselUuid: string,
  assignmentType = "Planned",
) {
  const assignUuid = u();
  assignUuids.push(assignUuid);
  await insert("crew_assignments", {
    assign_uuid: assignUuid,
    crew_uuid: crewUuid,
    vessel_uuid: vesselUuid,
    assignment_type: assignmentType,
    is_current: assignmentType === "OnBoard",
    is_deleted: false,
  });
  return assignUuid;
}

async function seedDeployableEntry(
  vesselUuid: string,
  rankId: string,
  rank: string,
) {
  const crewUuid = u();
  const entryUuid = u();
  crewUuids.push(crewUuid);
  entryUuids.push(entryUuid);
  await insert("crew_members_v2", {
    crew_uuid: crewUuid,
    emp_no: `EMP-${crewUuid}`,
    first_name: "Concurrent",
    family_name: "Reliever",
  });
  await insert("rotation_entries_v2", {
    entry_uuid: entryUuid,
    draft_uuid: u(),
    vessel_uuid: vesselUuid,
    rank_id: rankId,
    rank,
    crew_uuid: crewUuid,
    sign_on_date: "2026-10-02",
    contract_period: 4,
    proposal_status: "Pending",
    is_deleted: false,
  });
  return { crewUuid, entryUuid };
}

const clearRelieverPayload = {
  relieverCrewUuid: null,
  joiningStatus: null,
  relieverSignOnDate: null,
  joiningPortUuid: null,
  plannedConfirmedDate: null,
  travelStartDate: null,
  relieverContractPeriodMonths: null,
  relieverContractEndRangeStartMonths: null,
  relieverContractEndRangeEndMonths: null,
  deploymentChecklistCompleted: null,
  applicableDocsChecked: null,
  auditUserUuid: "spoofed-client-actor",
};

async function unassign(planUuid: string) {
  return request(server)
    .patch(`/api/v2/vessel/planning/${planUuid}`)
    .set("Authorization", `Bearer ${token()}`)
    .send(clearRelieverPayload);
}

beforeAll(async () => {
  db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  process.env.JWT_SECRET = TEST_SECRET;
  delete process.env.AUTH_BYPASS;
  const { authMiddleware } = await import("@server/middleware/authMiddleware");
  const { default: vesselRouter } = await import("@server/v2/vessel/routes");

  const app = express();
  app.use(express.json());
  app.use(authMiddleware);
  app.use("/api/v2/vessel", vesselRouter);
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  if (entryUuids.length > 0) {
    await db.query(
      "DELETE FROM rotation_archive_v2 WHERE entry_uuid = ANY($1::text[])",
      [entryUuids],
    );
    await db.query(
      "DELETE FROM rotation_entries_v2 WHERE entry_uuid = ANY($1::text[])",
      [entryUuids],
    );
  }
  if (assignUuids.length > 0) {
    await db.query(
      "DELETE FROM crew_assignments WHERE assign_uuid = ANY($1::text[])",
      [assignUuids],
    );
  }
  if (planUuids.length > 0) {
    await db.query(
      "DELETE FROM vessel_planning_v2 WHERE plan_uuid = ANY($1::text[])",
      [planUuids],
    );
  }
  if (crewUuids.length > 0) {
    await db.query(
      "DELETE FROM crew_members_v2 WHERE crew_uuid = ANY($1::text[])",
      [crewUuids],
    );
  }
  await db.end();
});

describe("reliever assignment cancellation on planning unassign", () => {
  it("closes one Planned assignment, preserves other states, and is idempotent", async () => {
    const crewUuid = u();
    const { planUuid, vesselUuid } = await seedPlanning(crewUuid);
    const plannedAssignUuid = await seedAssignment(crewUuid, vesselUuid);
    const onboardAssignUuid = await seedAssignment(
      crewUuid,
      vesselUuid,
      "OnBoard",
    );
    const otherVesselAssignUuid = await seedAssignment(crewUuid, u());

    const first = await unassign(planUuid);
    expect(first.status).toBe(200);

    const planning = await db.query(
      `SELECT reliever_crew_uuid, joining_status, reliever_sign_on_date,
              joining_port_uuid, planned_confirmed_date, travel_start_date,
              reliever_contract_period_months,
              reliever_contract_end_range_start_months,
              reliever_contract_end_range_end_months,
              deployment_checklist_completed, applicable_docs_checked,
              updated_by_uuid
         FROM vessel_planning_v2 WHERE plan_uuid = $1`,
      [planUuid],
    );
    expect(planning.rows[0]).toEqual({
      reliever_crew_uuid: null,
      joining_status: null,
      reliever_sign_on_date: null,
      joining_port_uuid: null,
      planned_confirmed_date: null,
      travel_start_date: null,
      reliever_contract_period_months: null,
      reliever_contract_end_range_start_months: null,
      reliever_contract_end_range_end_months: null,
      deployment_checklist_completed: null,
      applicable_docs_checked: null,
      updated_by_uuid: String(ACTOR_ID),
    });

    const cancelled = await db.query(
      `SELECT assignment_type, is_current, reason, updated_by_uuid, is_deleted,
              updated_at
         FROM crew_assignments WHERE assign_uuid = $1`,
      [plannedAssignUuid],
    );
    expect(cancelled.rows[0]).toMatchObject({
      assignment_type: "Cancelled",
      is_current: false,
      reason: "Unassigned before joining",
      updated_by_uuid: String(ACTOR_ID),
      is_deleted: false,
    });

    const onboard = await db.query(
      `SELECT assignment_type, is_current, reason, updated_by_uuid
         FROM crew_assignments WHERE assign_uuid = $1`,
      [onboardAssignUuid],
    );
    expect(onboard.rows[0]).toEqual({
      assignment_type: "OnBoard",
      is_current: true,
      reason: null,
      updated_by_uuid: null,
    });
    const otherVessel = await db.query(
      `SELECT assignment_type, is_current, reason, updated_by_uuid
         FROM crew_assignments WHERE assign_uuid = $1`,
      [otherVesselAssignUuid],
    );
    expect(otherVessel.rows[0]).toEqual({
      assignment_type: "Planned",
      is_current: false,
      reason: null,
      updated_by_uuid: null,
    });

    const firstUpdatedAt = cancelled.rows[0].updated_at;
    const second = await unassign(planUuid);
    expect(second.status).toBe(200);
    const afterSecond = await db.query(
      `SELECT assignment_type, is_current, reason, updated_by_uuid, is_deleted,
              updated_at
         FROM crew_assignments WHERE assign_uuid = $1`,
      [plannedAssignUuid],
    );
    expect(afterSecond.rows[0]).toEqual(cancelled.rows[0]);
    expect(afterSecond.rows[0].updated_at).toEqual(firstUpdatedAt);
  });

  it("succeeds when no Planned assignment exists", async () => {
    const crewUuid = u();
    const { planUuid, vesselUuid } = await seedPlanning(crewUuid);
    const cancelledAssignUuid = await seedAssignment(
      crewUuid,
      vesselUuid,
      "Cancelled",
    );

    const response = await unassign(planUuid);
    expect(response.status).toBe(200);
    const assignment = await db.query(
      `SELECT assignment_type, is_current, reason, updated_by_uuid
         FROM crew_assignments WHERE assign_uuid = $1`,
      [cancelledAssignUuid],
    );
    expect(assignment.rows[0]).toEqual({
      assignment_type: "Cancelled",
      is_current: false,
      reason: null,
      updated_by_uuid: null,
    });
  });

  it("closes none and warns with every UUID when Planned matches are ambiguous", async () => {
    const crewUuid = u();
    const { planUuid, vesselUuid } = await seedPlanning(crewUuid);
    const firstAssignUuid = await seedAssignment(crewUuid, vesselUuid);
    const secondAssignUuid = await seedAssignment(crewUuid, vesselUuid);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const response = await unassign(planUuid);
      expect(response.status).toBe(200);
      const assignments = await db.query(
        `SELECT assign_uuid, assignment_type, reason, updated_by_uuid
           FROM crew_assignments
          WHERE assign_uuid = ANY($1::text[])
          ORDER BY assign_uuid`,
        [[firstAssignUuid, secondAssignUuid]],
      );
      expect(assignments.rows).toEqual(
        [firstAssignUuid, secondAssignUuid]
          .sort()
          .map((assignUuid) => ({
            assign_uuid: assignUuid,
            assignment_type: "Planned",
            reason: null,
            updated_by_uuid: null,
          })),
      );
      expect(warning).toHaveBeenCalledWith(
        expect.stringContaining("multiple Planned assignments"),
        expect.objectContaining({
          planUuid,
          crewUuid,
          vesselUuid,
          assignUuids: expect.arrayContaining([
            firstAssignUuid,
            secondAssignUuid,
          ]),
        }),
      );
    } finally {
      warning.mockRestore();
    }
  });

  it("rolls the assignment cancellation back when planning update fails", async () => {
    const crewUuid = u();
    const { planUuid, vesselUuid } = await seedPlanning(crewUuid);
    const assignUuid = await seedAssignment(crewUuid, vesselUuid);
    const update = vi
      .spyOn(vesselPlanningRepository, "update")
      .mockRejectedValueOnce(new Error("forced planning failure"));

    try {
      const response = await unassign(planUuid);
      expect(response.status).toBe(500);
      const assignment = await db.query(
        `SELECT assignment_type, reason, updated_by_uuid
           FROM crew_assignments WHERE assign_uuid = $1`,
        [assignUuid],
      );
      expect(assignment.rows[0]).toEqual({
        assignment_type: "Planned",
        reason: null,
        updated_by_uuid: null,
      });
      const planning = await db.query(
        "SELECT reliever_crew_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1",
        [planUuid],
      );
      expect(planning.rows[0].reliever_crew_uuid).toBe(crewUuid);
    } finally {
      update.mockRestore();
    }
  });

  it("serializes deploy and unassign so deployment cannot leave an orphan Planned row", async () => {
    const { planUuid, vesselUuid, rankId, rank } =
      await seedPlanning(null);
    const { crewUuid, entryUuid } = await seedDeployableEntry(
      vesselUuid,
      rankId,
      rank,
    );
    let markPlanningUpdated!: () => void;
    let releaseDeployment!: () => void;
    const planningUpdated = new Promise<void>((resolve) => {
      markPlanningUpdated = resolve;
    });
    const deploymentCanFinish = new Promise<void>((resolve) => {
      releaseDeployment = resolve;
    });
    const originalUpdate =
      vesselPlanningRepository.update.bind(vesselPlanningRepository);
    const update = vi
      .spyOn(vesselPlanningRepository, "update")
      .mockImplementationOnce(async (...args) => {
        const result = await originalUpdate(...args);
        markPlanningUpdated();
        await deploymentCanFinish;
        return result;
      });

    try {
      const deployment = rotationDeployService.deployEntry(
        entryUuid,
        "deploy-user",
        "deploy-user",
      );
      await planningUpdated;

      const unassignRequest = unassign(planUuid);
      const completedBeforeDeploy = await Promise.race([
        unassignRequest.then(() => true),
        new Promise<boolean>((resolve) =>
          setTimeout(() => resolve(false), 100),
        ),
      ]);
      expect(completedBeforeDeploy).toBe(false);

      releaseDeployment();
      const [deployResult, response] = await Promise.all([
        deployment,
        unassignRequest,
      ]);
      expect(deployResult).toMatchObject({ success: true, planUuid });
      expect(response.status).toBe(200);

      const assignments = await db.query(
        `SELECT assign_uuid, assignment_type, is_current, reason, is_deleted
           FROM crew_assignments
          WHERE crew_uuid = $1 AND vessel_uuid = $2
          ORDER BY id`,
        [crewUuid, vesselUuid],
      );
      expect(assignments.rows).toHaveLength(1);
      expect(assignments.rows[0]).toMatchObject({
        assignment_type: "Cancelled",
        is_current: false,
        reason: "Unassigned before joining",
        is_deleted: false,
      });
      assignUuids.push(assignments.rows[0].assign_uuid);

      const planning = await db.query(
        "SELECT reliever_crew_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1",
        [planUuid],
      );
      expect(planning.rows[0].reliever_crew_uuid).toBeNull();
    } finally {
      releaseDeployment();
      update.mockRestore();
    }
  });
});