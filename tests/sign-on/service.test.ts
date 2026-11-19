// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { crewAssignments, crewSeaService } from "../../shared/v2/crew-pool/schema";
import { vesselPlanningV2 } from "../../shared/v2/vessel/schema";
import { masterVessels } from "../../shared/schema";

const state = vi.hoisted(() => ({
  db: null as any,
  lifecycle: vi.fn(), finish: vi.fn(), history: vi.fn(), find: vi.fn(),
}));
vi.mock("../../server/v2/db", () => ({ getDb: () => state.db }));
vi.mock("../../server/v2/vessel/repositories", () => ({
  vesselPlanningRepository: { findByPlanUuid: (...args: any[]) => state.find(...args) },
  vesselPlanningAttachmentsRepository: {},
}));
vi.mock("../../server/v2/company-forms/stageResolutionService", () => ({
  checkLifecycle: (...args: any[]) => state.lifecycle(...args),
  finishLifecycle: (...args: any[]) => state.finish(...args),
  checkReliefTransition: vi.fn(), deferStageCycle: vi.fn(),
}));
vi.mock("../../server/v2/company-forms/subjects/crewAssignmentHistory", () => ({
  captureJoiningHistory: (...args: any[]) => state.history(...args),
}));
vi.mock("../../server/v2/crew-pool/services/crewMembersService", () => ({
  crewMembersService: { getByUuid: vi.fn().mockResolvedValue(null) },
}));
import { vesselPlanningService } from "../../server/v2/vessel/services/vesselPlanningService";
import { vesselPlanningController } from "../../server/v2/vessel/controllers/vesselPlanningController";

let directory: string;
let pool: Pool;
const tables = [crewAssignments, crewSeaService, vesselPlanningV2, masterVessels];
const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
const day = "2025-01-10";

beforeAll(async () => {
  // Independent PostgreSQL cluster, no application DB, migrations, or reset scripts.
  directory = mkdtempSync(join(tmpdir(), "sign-on-regression-"));
  execFileSync("initdb", ["-D", join(directory, "data"), "-U", "signon_test", "-A", "trust", "--no-locale"], { stdio: "pipe" });
  execFileSync("pg_ctl", ["-D", join(directory, "data"), "-l", join(directory, "postgres.log"),
    "-o", `-k ${directory} -p 55442 -c listen_addresses=''`, "-w", "start"], { stdio: "pipe" });
  pool = new Pool({ host: directory, port: 55442, user: "signon_test", database: "postgres" });
  state.db = drizzle(pool);
  // Real column definitions/defaults; does not claim to exercise deployment migrations.
  for (const table of tables) {
    const config = getTableConfig(table);
    const columns = config.columns.map((column: any) => {
      let definition = `${quote(column.name)} ${column.getSQLType()}`;
      if (column.primary) definition += " PRIMARY KEY";
      else if (column.isUnique) definition += " UNIQUE";
      if (column.notNull) definition += " NOT NULL";
      if (column.default !== undefined && !/serial/i.test(column.getSQLType())) {
        if (typeof column.default === "string") definition += ` DEFAULT '${column.default.replaceAll("'", "''")}'`;
        else if (typeof column.default === "boolean" || typeof column.default === "number") definition += ` DEFAULT ${column.default}`;
        else if (column.dataType === "date") definition += " DEFAULT now()";
      }
      return definition;
    });
    await pool.query(`CREATE TABLE ${quote(config.name)} (${columns.join(",")})`);
  }
}, 60000);
afterAll(async () => {
  if (pool) await pool.end();
  if (directory) {
    try { execFileSync("pg_ctl", ["-D", join(directory, "data"), "-m", "immediate", "-w", "stop"], { stdio: "pipe" }); }
    finally { rmSync(directory, { recursive: true, force: true }); }
  }
});
beforeEach(async () => {
  vi.restoreAllMocks();
  await pool.query(`TRUNCATE ${tables.map(t => quote(getTableConfig(t).name)).join(",")} RESTART IDENTITY`);
  state.lifecycle.mockReset().mockResolvedValue({ event_uuid: "event-test" });
  state.finish.mockReset().mockResolvedValue(undefined);
  state.history.mockReset().mockResolvedValue(undefined);
  state.find.mockReset().mockImplementation(async (plan: string) =>
    (await state.db.select().from(vesselPlanningV2).where(eq(vesselPlanningV2.planUuid, plan)))[0]);
  vi.spyOn(vesselPlanningService, "checkSignOnConflict").mockResolvedValue({ hasConflict: false } as any);
  await state.db.insert(crewAssignments).values({
    assignUuid: "assign-test", crewUuid: "crew-test", vesselUuid: "vessel-test",
    assignmentType: "Planned", isCurrent: false, signOnDate: day,
  });
  await state.db.insert(vesselPlanningV2).values({
    planUuid: "plan-test", vesselUuid: "vessel-test", rankId: "rank-test", rank: "Master",
    relieverCrewUuid: "crew-test", relieverAssignUuid: "assign-test",
    relieverSignOnDate: day, joiningStatus: "Confirmed", isArchived: false,
  });
});
async function snapshot() {
  return {
    plans: (await pool.query("SELECT * FROM vessel_planning_v2 ORDER BY id")).rows,
    assignments: (await pool.query("SELECT * FROM crew_assignments ORDER BY id")).rows,
    sea: (await pool.query("SELECT * FROM crew_sea_service ORDER BY id")).rows,
  };
}

describe("actual sign-on service with isolated PostgreSQL", () => {
  it.each([undefined, "", "bad", "2025-02-30", "9999-12-31"])("rejects invalid date %s before any writes or lifecycle capture", async date => {
    const before = await snapshot();
    await expect(vesselPlanningService.signOnReliever("plan-test", { signOnDate: date }))
      .rejects.toMatchObject({ code: "SIGN_ON_VALIDATION" });
    expect(await snapshot()).toEqual(before);
    expect(state.find).not.toHaveBeenCalled();
    expect(state.history).not.toHaveBeenCalled();
  });
  it("signs into a vacant primary position and creates exactly one company sea service", async () => {
    const result = await vesselPlanningService.signOnReliever("plan-test", { signOnDate: day });
    expect(result).toMatchObject({ crewUuid: "crew-test", crewStatus: "primary", signOnDate: day, relieverCrewUuid: null, relieverSignOnDate: null, signOnWarnings: [] });
    const saved = await snapshot();
    expect(saved.assignments[0]).toMatchObject({ assignment_type: "OnBoard", is_current: true, sign_on_date: day });
    expect(saved.sea).toHaveLength(1);
    expect(saved.sea[0]).toMatchObject({ crew_uuid: "crew-test", from_date: day, service_type: "company" });
    await expect(vesselPlanningService.signOnReliever("plan-test", { signOnDate: day })).rejects.toThrow("No reliever");
    expect(await snapshot()).toEqual(saved);
  });
  it("creates a secondary when incumbent is onboard without replacing the incumbent", async () => {
    await state.db.update(vesselPlanningV2).set({ crewUuid: "incumbent", signOnDate: "2024-12-01" })
      .where(eq(vesselPlanningV2.planUuid, "plan-test"));
    await vesselPlanningService.signOnReliever("plan-test", { signOnDate: day });
    const saved = await snapshot();
    expect(saved.plans).toHaveLength(2);
    expect(saved.plans[0]).toMatchObject({ crew_uuid: "incumbent", sign_on_date: "2024-12-01", reliever_crew_uuid: null });
    expect(saved.plans[1]).toMatchObject({ crew_uuid: "crew-test", crew_status: "secondary", sign_on_date: day });
    expect(saved.assignments[0]).toMatchObject({ is_current: true, assignment_type: "OnBoard" });
  });
  it("rolls back sign-on if a transactional lifecycle prerequisite rejects", async () => {
    const before = await snapshot();
    state.lifecycle.mockRejectedValue(new Error("lifecycle prerequisite rejected"));
    await expect(vesselPlanningService.signOnReliever("plan-test", { signOnDate: day })).rejects.toThrow("prerequisite");
    expect(await snapshot()).toEqual(before);
    expect(state.finish).not.toHaveBeenCalled();
  });
  it("keeps a committed sign-on successful when post-commit lifecycle completion fails", async () => {
    state.finish.mockRejectedValue(new Error("post-commit failure"));
    const result = await vesselPlanningService.signOnReliever("plan-test", { signOnDate: day });
    expect(result.signOnWarnings).toEqual([expect.stringContaining("Joining forms follow-up")]);
    expect((await snapshot()).assignments[0].is_current).toBe(true);
  });
  it("rejects changed assignment links without changes", async () => {
    await state.db.update(crewAssignments).set({ crewUuid: "other-crew" });
    const before = await snapshot();
    await expect(vesselPlanningService.signOnReliever("plan-test", { signOnDate: day })).rejects.toThrow("Linked reliever assignment");
    expect(await snapshot()).toEqual(before);
  });
  it("preserves the existing cross-vessel conflict safeguard", async () => {
    vi.mocked(vesselPlanningService.checkSignOnConflict).mockResolvedValue({ hasConflict: true, conflictVesselName: "Other Vessel" } as any);
    const before = await snapshot();
    await expect(vesselPlanningService.signOnReliever("plan-test", { signOnDate: day })).rejects.toMatchObject({ code: "SIGN_ON_CONFLICT" });
    expect(await snapshot()).toEqual(before);
  });
  it("allows only one concurrent sign-on to promote the assignment", async () => {
    const results = await Promise.allSettled([
      vesselPlanningService.signOnReliever("plan-test", { signOnDate: day }),
      vesselPlanningService.signOnReliever("plan-test", { signOnDate: day }),
    ]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
    expect((await snapshot()).sea).toHaveLength(1);
    expect(state.lifecycle).toHaveBeenCalledTimes(1);
  });
  it("returns HTTP 400 for omitted dates on both sign-on controller paths, with no writes", async () => {
    const before = await snapshot();
    for (const action of ["signOnReliever", "updateRelieverStatus"] as const) {
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      await vesselPlanningController[action]({
        params: { planUuid: "plan-test" }, body: { joiningStatus: "Signed On" },
      } as any, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Sign On Date is required." });
    }
    expect(await snapshot()).toEqual(before);
  });
});
