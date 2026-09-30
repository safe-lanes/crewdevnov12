import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Client } from "pg";
import { randomUUID } from "crypto";
import { readFile } from "fs/promises";
import { join } from "path";
import ExcelJS from "exceljs";
import type { Server } from "http";
import { vesselPlanningRepository } from "@server/v2/vessel/repositories";
import { rotationDeployService } from "@server/v2/rotation/services";
import { importCrewAssignments } from "@server/v2/vessel/services/vesselCrewListImportService";

const TEST_SECRET = "reliever-unassign-test-secret";
const ACTOR_ID = 990312;
const u = () => randomUUID();

let db: Client;
let server: Server;
const planUuids: string[] = [];
const assignUuids: string[] = [];
const crewUuids: string[] = [];
const entryUuids: string[] = [];
const importedVesselUuids: string[] = [];

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
  planUuid?: string,
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
  if (planUuid) {
    await db.query(
      "UPDATE vessel_planning_v2 SET reliever_assign_uuid = $1 WHERE plan_uuid = $2",
      [assignUuid, planUuid],
    );
  }
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

async function makeAssignmentsSheet(
  employeeId: string,
  vesselName: string,
  rank: string,
  signOnDate = "2026-10-02",
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Assignments");
  sheet.addRow([
    "Employee ID", "Vessel Name", "IMO", "Rank", "Position",
    "Sign On Date", "Contract Period (Months)", "Relief Due Date",
    "Port of Joining", "Assignment Type", "Joining Status", "Reliever Rank",
  ]);
  sheet.addRow([
    employeeId, vesselName, "", rank, rank, signOnDate, 4, "",
    "", "Secondary", "Planned", rank,
  ]);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function seedImportVessel(vesselUuid: string) {
  const vesselName = `Import-${vesselUuid}`;
  importedVesselUuids.push(vesselUuid);
  await insert("master_vessels", { vessel_uuid: vesselUuid, vessel: vesselName });
  return vesselName;
}

async function seedImportCrew() {
  const crewUuid = u();
  const employeeId = `EMP-${crewUuid}`;
  crewUuids.push(crewUuid);
  await insert("crew_members_v2", {
    crew_uuid: crewUuid,
    emp_no: employeeId,
    first_name: "Imported",
    family_name: "Reliever",
  });
  return { crewUuid, employeeId };
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
  if (planUuids.length > 0) {
    await db.query(
      "DELETE FROM vessel_planning_v2 WHERE plan_uuid = ANY($1::text[])",
      [planUuids],
    );
  }
  if (assignUuids.length > 0) {
    await db.query(
      "DELETE FROM crew_assignments WHERE assign_uuid = ANY($1::text[])",
      [assignUuids],
    );
  }
  if (crewUuids.length > 0) {
    await db.query(
      "DELETE FROM crew_members_v2 WHERE crew_uuid = ANY($1::text[])",
      [crewUuids],
    );
  }
  if (importedVesselUuids.length > 0) {
    await db.query(
      "DELETE FROM master_vessels WHERE vessel_uuid = ANY($1::text[])",
      [importedVesselUuids],
    );
  }
  await db.end();
});

describe("reliever assignment cancellation on planning unassign", () => {
  it("closes one Planned assignment, preserves other states, and is idempotent", async () => {
    const crewUuid = u();
    const { planUuid, vesselUuid } = await seedPlanning(crewUuid);
    const plannedAssignUuid = await seedAssignment(crewUuid, vesselUuid, "Planned", planUuid);
    const onboardAssignUuid = await seedAssignment(
      crewUuid,
      vesselUuid,
      "OnBoard",
    );
    const otherVesselAssignUuid = await seedAssignment(crewUuid, u());

    const first = await unassign(planUuid);
    expect(first.status).toBe(200);

    const planning = await db.query(
      `SELECT reliever_crew_uuid, reliever_assign_uuid, joining_status, reliever_sign_on_date,
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
      reliever_assign_uuid: null,
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

  it("does not clear an unlinked legacy reliever with no Planned assignment", async () => {
    const crewUuid = u();
    const { planUuid, vesselUuid } = await seedPlanning(crewUuid);
    const cancelledAssignUuid = await seedAssignment(
      crewUuid,
      vesselUuid,
      "Cancelled",
    );

    const response = await unassign(planUuid);
    expect(response.status).toBe(409);
    const planning = await db.query(
      "SELECT reliever_crew_uuid, reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1",
      [planUuid],
    );
    expect(planning.rows[0]).toEqual({ reliever_crew_uuid: crewUuid, reliever_assign_uuid: null });
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

  it("uses only the linked assignment even when multiple Planned assignments match the crew/vessel", async () => {
    const crewUuid = u();
    const { planUuid, vesselUuid } = await seedPlanning(crewUuid);
    const firstAssignUuid = await seedAssignment(crewUuid, vesselUuid, "Planned", planUuid);
    const secondAssignUuid = await seedAssignment(crewUuid, vesselUuid);

      const response = await unassign(planUuid);
      expect(response.status).toBe(200);
      const assignments = await db.query(
        `SELECT assign_uuid, assignment_type, reason, updated_by_uuid
           FROM crew_assignments
          WHERE assign_uuid = ANY($1::text[])
          ORDER BY assign_uuid`,
        [[firstAssignUuid, secondAssignUuid]],
      );
      expect(assignments.rows).toEqual([
        { assign_uuid: firstAssignUuid, assignment_type: "Cancelled", reason: "Unassigned before joining", updated_by_uuid: String(ACTOR_ID) },
        { assign_uuid: secondAssignUuid, assignment_type: "Planned", reason: null, updated_by_uuid: null },
      ].sort((a, b) => a.assign_uuid.localeCompare(b.assign_uuid)));
  });

  it("rolls the assignment cancellation back when planning update fails", async () => {
    const crewUuid = u();
    const { planUuid, vesselUuid } = await seedPlanning(crewUuid);
    const assignUuid = await seedAssignment(crewUuid, vesselUuid, "Planned", planUuid);
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
        "SELECT reliever_crew_uuid, reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1",
        [planUuid],
      );
      expect(planning.rows[0].reliever_crew_uuid).toBe(crewUuid);
      expect(planning.rows[0].reliever_assign_uuid).toBe(assignUuid);
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
        "SELECT reliever_crew_uuid, reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1",
        [planUuid],
      );
      expect(planning.rows[0].reliever_crew_uuid).toBeNull();
      expect(planning.rows[0].reliever_assign_uuid).toBeNull();
    } finally {
      releaseDeployment();
      update.mockRestore();
    }
  });

  it("Deploy links the new assignment when the position is occupied and the popup opens it by UUID", async () => {
    const { planUuid, vesselUuid, rankId, rank } = await seedPlanning(null);
    await db.query("UPDATE vessel_planning_v2 SET crew_uuid = $1 WHERE plan_uuid = $2", [u(), planUuid]);
    const { crewUuid, entryUuid } = await seedDeployableEntry(vesselUuid, rankId, rank);
    const result = await rotationDeployService.deployEntry(entryUuid, "deploy-user");
    expect(result).toMatchObject({ success: true, planUuid });
    const planning = await db.query(
      "SELECT reliever_crew_uuid, reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1",
      [planUuid],
    );
    expect(planning.rows[0].reliever_crew_uuid).toBe(crewUuid);
    const assignUuid = planning.rows[0].reliever_assign_uuid;
    expect(assignUuid).toBeTruthy();
    assignUuids.push(assignUuid);
    const assignment = await db.query(
      "SELECT crew_uuid, vessel_uuid, assignment_type FROM crew_assignments WHERE assign_uuid = $1",
      [assignUuid],
    );
    expect(assignment.rows[0]).toEqual({ crew_uuid: crewUuid, vessel_uuid: vesselUuid, assignment_type: "Planned" });
    const opened = await request(server)
      .get(`/api/v2/vessel/planning/${planUuid}/reliever-assignment/${assignUuid}`)
      .set("Authorization", `Bearer ${token()}`);
    expect(opened.status).toBe(200);
    expect(opened.body.assignUuid).toBe(assignUuid);
    const wrongId = await request(server)
      .get(`/api/v2/vessel/planning/${planUuid}/reliever-assignment/${u()}`)
      .set("Authorization", `Bearer ${token()}`);
    expect(wrongId.status).toBe(404);
  });

  it("Deploy creates the same direct link in a vacant position and does not reuse a cancelled assignment", async () => {
    const vesselUuid = u();
    const rankId = u();
    const rank = `Vacant-${rankId}`;
    const { crewUuid, entryUuid } = await seedDeployableEntry(vesselUuid, rankId, rank);
    const previous = await seedAssignment(crewUuid, vesselUuid, "Cancelled");
    const result = await rotationDeployService.deployEntry(entryUuid, "deploy-user");
    expect(result.success).toBe(true);
    planUuids.push(result.planUuid!);
    const planning = await db.query(
      "SELECT reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1",
      [result.planUuid],
    );
    expect(planning.rows[0].reliever_assign_uuid).toBeTruthy();
    expect(planning.rows[0].reliever_assign_uuid).not.toBe(previous);
    assignUuids.push(planning.rows[0].reliever_assign_uuid);
  });

  it("unassign and replacement keep the cancelled assignment as history while linking a fresh one", async () => {
    const { planUuid, vesselUuid, rankId, rank } = await seedPlanning(null);
    const first = await seedDeployableEntry(vesselUuid, rankId, rank);
    expect((await rotationDeployService.deployEntry(first.entryUuid, "deploy-user")).success).toBe(true);
    const old = await db.query(
      "SELECT reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1",
      [planUuid],
    );
    const oldAssignUuid = old.rows[0].reliever_assign_uuid;
    assignUuids.push(oldAssignUuid);
    expect((await unassign(planUuid)).status).toBe(200);

    const replacement = await seedDeployableEntry(vesselUuid, rankId, rank);
    expect((await rotationDeployService.deployEntry(replacement.entryUuid, "deploy-user")).success).toBe(true);
    const current = await db.query(
      "SELECT reliever_crew_uuid, reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1",
      [planUuid],
    );
    expect(current.rows[0].reliever_crew_uuid).toBe(replacement.crewUuid);
    const newAssignUuid = current.rows[0].reliever_assign_uuid;
    expect(newAssignUuid).not.toBe(oldAssignUuid);
    assignUuids.push(newAssignUuid);
    const assignments = await db.query(
      "SELECT assign_uuid, assignment_type FROM crew_assignments WHERE assign_uuid = ANY($1::text[])",
      [[oldAssignUuid, newAssignUuid]],
    );
    expect(Object.fromEntries(assignments.rows.map(row => [row.assign_uuid, row.assignment_type]))).toEqual({
      [oldAssignUuid]: "Cancelled",
      [newAssignUuid]: "Planned",
    });
  });

  it("opens and unassigns the exact assignment created by vessel crew-list import", async () => {
    const { planUuid, vesselUuid, rank } = await seedPlanning(null);
    const vesselName = await seedImportVessel(vesselUuid);
    const { crewUuid, employeeId } = await seedImportCrew();
    const sheet = await makeAssignmentsSheet(employeeId, vesselName, rank);
    const imported = await importCrewAssignments(sheet, "import-user");
    expect(imported).toMatchObject({ success: true, secondaryAssignedCount: 1 });
    const planning = await db.query(
      "SELECT reliever_crew_uuid, reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1",
      [planUuid],
    );
    expect(planning.rows[0].reliever_crew_uuid).toBe(crewUuid);
    const assignUuid = planning.rows[0].reliever_assign_uuid;
    expect(assignUuid).toBeTruthy();
    assignUuids.push(assignUuid);
    const opened = await request(server)
      .get(`/api/v2/vessel/planning/${planUuid}/reliever-assignment/${assignUuid}`)
      .set("Authorization", `Bearer ${token()}`);
    expect(opened.status).toBe(200);
    expect(opened.body).toMatchObject({ assignUuid, crewUuid, vesselUuid, assignmentType: "Planned" });
    expect((await unassign(planUuid)).status).toBe(200);
    const history = await db.query(
      "SELECT assignment_type FROM crew_assignments WHERE assign_uuid = $1", [assignUuid],
    );
    expect(history.rows[0].assignment_type).toBe("Cancelled");
  });

  it("re-import safely replaces a Rotation-linked reliever and keeps the previous assignment history", async () => {
    const { planUuid, vesselUuid, rankId, rank } = await seedPlanning(null);
    const vesselName = await seedImportVessel(vesselUuid);
    const first = await seedDeployableEntry(vesselUuid, rankId, rank);
    expect((await rotationDeployService.deployEntry(first.entryUuid, "deploy-user")).success).toBe(true);
    const previous = await db.query(
      "SELECT reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1", [planUuid],
    );
    const previousUuid = previous.rows[0].reliever_assign_uuid;
    assignUuids.push(previousUuid);
    const next = await seedImportCrew();
    const sheet = await makeAssignmentsSheet(next.employeeId, vesselName, rank);
    const imported = await importCrewAssignments(sheet, "import-user");
    expect(imported).toMatchObject({ success: true, secondaryAssignedCount: 1 });
    const planning = await db.query(
      "SELECT reliever_crew_uuid, reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1", [planUuid],
    );
    const nextUuid = planning.rows[0].reliever_assign_uuid;
    assignUuids.push(nextUuid);
    expect(planning.rows[0].reliever_crew_uuid).toBe(next.crewUuid);
    expect(nextUuid).not.toBe(previousUuid);
    const assignments = await db.query(
      "SELECT assign_uuid, assignment_type FROM crew_assignments WHERE assign_uuid = ANY($1::text[])",
      [[previousUuid, nextUuid]],
    );
    expect(Object.fromEntries(assignments.rows.map(row => [row.assign_uuid, row.assignment_type]))).toEqual({
      [previousUuid]: "Cancelled", [nextUuid]: "Planned",
    });
    const repeated = await importCrewAssignments(sheet, "import-user");
    expect(repeated).toMatchObject({ success: true, alreadyImportedCount: 1 });
    const same = await db.query(
      "SELECT reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1", [planUuid],
    );
    expect(same.rows[0].reliever_assign_uuid).toBe(nextUuid);
    expect((await unassign(planUuid)).status).toBe(200);
  });

  it("rejects replacement of an unlinked legacy reliever without leaving a new orphan assignment", async () => {
    const oldCrewUuid = u();
    const { planUuid, vesselUuid, rank } = await seedPlanning(oldCrewUuid);
    const vesselName = await seedImportVessel(vesselUuid);
    const next = await seedImportCrew();
    const sheet = await makeAssignmentsSheet(next.employeeId, vesselName, rank);
    const imported = await importCrewAssignments(sheet, "import-user");
    expect(imported.success).toBe(false);
    expect(imported.errors.join(" ")).toContain("no verified assignment link");
    const planning = await db.query(
      "SELECT reliever_crew_uuid, reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1", [planUuid],
    );
    expect(planning.rows[0]).toEqual({ reliever_crew_uuid: oldCrewUuid, reliever_assign_uuid: null });
    const assignments = await db.query(
      "SELECT assign_uuid FROM crew_assignments WHERE crew_uuid = $1 AND vessel_uuid = $2",
      [next.crewUuid, vesselUuid],
    );
    expect(assignments.rows).toHaveLength(0);
  });

  it("does not reuse a Planned assignment owned by another reliever planning slot", async () => {
    const crew = await seedImportCrew();
    const owner = await seedPlanning(crew.crewUuid);
    const vesselName = await seedImportVessel(owner.vesselUuid);
    const otherPlanUuid = u();
    const otherRank = `Other-${otherPlanUuid}`;
    planUuids.push(otherPlanUuid);
    await insert("vessel_planning_v2", {
      plan_uuid: otherPlanUuid, vessel_uuid: owner.vesselUuid,
      rank_id: otherRank, rank: otherRank,
    });
    const assignmentUuid = await seedAssignment(crew.crewUuid, owner.vesselUuid, "Planned", owner.planUuid);
    await db.query(
      "UPDATE crew_assignments SET sign_on_date = $1 WHERE assign_uuid = $2",
      ["2026-10-02", assignmentUuid],
    );
    const sheet = await makeAssignmentsSheet(crew.employeeId, vesselName, otherRank);
    const imported = await importCrewAssignments(sheet, "import-user");
    expect(imported.success).toBe(false);
    expect(imported.errors.join(" ")).toContain("already linked to planning");
    const other = await db.query(
      "SELECT reliever_crew_uuid, reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = $1",
      [otherPlanUuid],
    );
    expect(other.rows[0]).toEqual({ reliever_crew_uuid: null, reliever_assign_uuid: null });
  });

  it("leaves both shared-candidate legacy plans unlinked after forward-only ownership migration", async () => {
    const original = await readFile(join(process.cwd(), "migrations/0217_link_reliever_assignments.sql"), "utf8");
    const repair = await readFile(join(process.cwd(), "migrations/0218_enforce_unique_reliever_assignment_link.sql"), "utf8");
    await db.query("BEGIN");
    try {
      await db.query("DROP INDEX uq_vessel_planning_reliever_assign_uuid");
      const crewUuid = u();
      const first = await seedPlanning(crewUuid);
      const second = await seedPlanning(crewUuid);
      await db.query("UPDATE vessel_planning_v2 SET vessel_uuid = $1 WHERE plan_uuid = $2",
        [first.vesselUuid, second.planUuid]);
      await seedAssignment(crewUuid, first.vesselUuid);
      await db.query(original);
      await db.query(repair);
      const linked = await db.query(
        "SELECT reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = ANY($1::text[])",
        [[first.planUuid, second.planUuid]],
      );
      expect(linked.rows).toHaveLength(2);
      expect(linked.rows.every(row => row.reliever_assign_uuid === null)).toBe(true);
      const index = await db.query(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_vessel_planning_reliever_assign_uuid'",
      );
      expect(index.rows[0].indexdef).toContain("UNIQUE");
    } finally {
      await db.query("ROLLBACK");
    }
  });

  it("backfills only exact-one legacy matches and reports zero/multiple matches without inventing links", async () => {
    const migration = await readFile(join(process.cwd(), "migrations/0217_link_reliever_assignments.sql"), "utf8");
    const notices: string[] = [];
    const onNotice = (notice: { message?: string }) => notices.push(notice.message || "");
    db.on("notice", onNotice);
    await db.query("BEGIN");
    try {
      const singleCrew = u(), zeroCrew = u(), multipleCrew = u();
      const single = await seedPlanning(singleCrew);
      const zero = await seedPlanning(zeroCrew);
      const multiple = await seedPlanning(multipleCrew);
      const match = await seedAssignment(singleCrew, single.vesselUuid);
      await seedAssignment(multipleCrew, multiple.vesselUuid);
      await seedAssignment(multipleCrew, multiple.vesselUuid);

      await db.query(migration);
      const rows = await db.query(
        "SELECT plan_uuid, reliever_assign_uuid FROM vessel_planning_v2 WHERE plan_uuid = ANY($1::text[])",
        [[single.planUuid, zero.planUuid, multiple.planUuid]],
      );
      expect(Object.fromEntries(rows.rows.map(r => [r.plan_uuid, r.reliever_assign_uuid]))).toEqual({
        [single.planUuid]: match,
        [zero.planUuid]: null,
        [multiple.planUuid]: null,
      });
      expect(notices.join(" ")).toContain(`plan_uuid=${zero.planUuid}`);
      expect(notices.join(" ")).toContain("zero matches");
      expect(notices.join(" ")).toContain(`plan_uuid=${multiple.planUuid}`);
      expect(notices.join(" ")).toContain("multiple matches");
      await db.query(migration);
      expect(notices.join(" ")).toContain("0 linked");
    } finally {
      await db.query("ROLLBACK");
      db.off("notice", onNotice);
    }
  });
});