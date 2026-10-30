import { readFileSync } from "fs";
import { join } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { v5 as uuidv5 } from "uuid";

// APD-56: an appraisal stored its type as a display name and could store the
// vessel as a name. Names change and differ per server, so both are now stored
// as master keys: appraisal_type = master_appraisal_types.id, vessel =
// master_vessels.vessel_uuid. A name sent by an older client is turned into
// the key; a new value that matches nothing is refused (400).

const { getDbMock } = vi.hoisted(() => ({ getDbMock: vi.fn() }));
vi.mock("@server/v2/db", () => ({ getDb: getDbMock }));

import {
  MasterReferenceError,
  appraisalTypeName,
  pickAppraisalTypeId,
  resolveAppraisalTypeRef,
  resolveAppraisalVesselRef,
  type AppraisalTypeRow,
} from "@server/v2/appraisals/utils/masterRefs";

const MID_TERM = "e7b845e9-ad8e-5b03-8fb6-c2d4fb103097";
const SPECIAL = "905187e4-0c28-52aa-8767-a8e683ef784e";
const RETIRED = "11111111-2222-4333-8444-555555555555";
const OLD_MID_TERM = "99999999-2222-4333-8444-555555555555";
const GAS_MIA = "744535d0-841a-11ed-aa7c-7003bca91a86";

const row = (id: string, entryId: string, name: string, extra: Partial<AppraisalTypeRow> = {}): AppraisalTypeRow =>
  ({ id, entryId, name, sortOrder: 0, isActive: true, isDeleted: false, ...extra });

const TYPES: AppraisalTypeRow[] = [
  row(MID_TERM, "AT002", "Mid Term", { sortOrder: 2 }),
  row(SPECIAL, "AT003", "Special", { sortOrder: 3 }),
  row(RETIRED, "AT009", "Retired Type", { isActive: false, isDeleted: true }),
  // A deleted row with the same name as a live one: the live one wins.
  row(OLD_MID_TERM, "AT005", "mid term", { isActive: false, isDeleted: true, sortOrder: 1 }),
];

describe("appraisal type: the master id is stored (pickAppraisalTypeId)", () => {
  it("keeps an id, in any case", () => {
    expect(pickAppraisalTypeId(MID_TERM, undefined, TYPES)).toBe(MID_TERM);
    expect(pickAppraisalTypeId(SPECIAL.toUpperCase(), undefined, TYPES)).toBe(SPECIAL);
  });

  it("turns a name into its id, ignoring case and spaces, live type first", () => {
    expect(pickAppraisalTypeId("Mid Term", undefined, TYPES)).toBe(MID_TERM);
    expect(pickAppraisalTypeId("  mid TERM ", undefined, TYPES)).toBe(MID_TERM);
  });

  it("still accepts the id of a deleted type", () => {
    expect(pickAppraisalTypeId(RETIRED, undefined, TYPES)).toBe(RETIRED);
  });

  it("keeps an unchanged stored value, even a legacy name with no master row", () => {
    expect(pickAppraisalTypeId("Annual", "Annual", TYPES)).toBe("Annual");
    expect(pickAppraisalTypeId(" Annual ", "Annual", TYPES)).toBe("Annual");
  });

  it("refuses a new value that matches nothing", () => {
    expect(() => pickAppraisalTypeId("Annual", MID_TERM, TYPES)).toThrow(MasterReferenceError);
    expect(() => pickAppraisalTypeId("Nonsense", undefined, TYPES)).toThrow(/Appraisal type "Nonsense" was not found/);
    expect(() => pickAppraisalTypeId("00000000-0000-4000-8000-000000000000", undefined, TYPES)).toThrow(MasterReferenceError);
  });

  it("leaves an empty type empty (a draft may not have one yet)", () => {
    expect(pickAppraisalTypeId("", undefined, TYPES)).toBe("");
    expect(pickAppraisalTypeId(null, undefined, TYPES)).toBe("");
    expect(pickAppraisalTypeId("  ", MID_TERM, TYPES)).toBe("");
  });
});

describe("appraisal type name for display (appraisalTypeName)", () => {
  const names = new Map(TYPES.map((t) => [t.id.toLowerCase(), t.name]));
  it("shows a stored id as its current name, a legacy name as stored", () => {
    expect(appraisalTypeName(MID_TERM, names)).toBe("Mid Term");
    expect(appraisalTypeName(RETIRED, names)).toBe("Retired Type");
    expect(appraisalTypeName("Annual", names)).toBe("Annual");
    expect(appraisalTypeName(null, names)).toBe("");
  });
});

describe("resolveAppraisalTypeRef reads the master only when the value changes", () => {
  beforeEach(() => getDbMock.mockReset());

  it("looks up a changed value", async () => {
    getDbMock.mockReturnValue({ select: () => ({ from: async () => TYPES }) });
    await expect(resolveAppraisalTypeRef("special", MID_TERM)).resolves.toBe(SPECIAL);
    expect(getDbMock).toHaveBeenCalledTimes(1);
  });

  it("skips the lookup for an unchanged or empty value", async () => {
    await expect(resolveAppraisalTypeRef("Annual", "Annual")).resolves.toBe("Annual");
    await expect(resolveAppraisalTypeRef("", MID_TERM)).resolves.toBe("");
    expect(getDbMock).not.toHaveBeenCalled();
  });
});

// Builds the vessel query with a real (unconnected) Drizzle builder, records
// the rendered SQL, and resolves it with `rows`.
let queries: { sql: string; params: unknown[] }[] = [];
function fakeDb(rows: unknown[]) {
  const real = drizzle.mock();
  return {
    select(fields: any) {
      let builder: any = real.select(fields);
      const proxy: any = new Proxy({}, {
        get(_t, prop) {
          if (prop === "then") {
            queries.push(builder.toSQL());
            return (resolve: (r: unknown[]) => void) => resolve(rows);
          }
          return (...args: unknown[]) => {
            builder = builder[prop](...args);
            return proxy;
          };
        },
      });
      return proxy;
    },
  };
}

describe("vessel: master_vessels.vessel_uuid is stored (resolveAppraisalVesselRef)", () => {
  beforeEach(() => {
    queries = [];
    getDbMock.mockReset();
  });

  it("turns a name into the vessel_uuid, matching case-insensitively and trimmed", async () => {
    getDbMock.mockReturnValue(fakeDb([{ vesselUuid: GAS_MIA }]));
    await expect(resolveAppraisalVesselRef("  gas MIA ")).resolves.toBe(GAS_MIA);
    expect(queries[0].sql).toContain('lower(trim("master_vessels"."vessel")) = $1');
    expect(queries[0].params).toContain("gas mia");
    // vessel_uuid is not unique: live, then active, then newest.
    expect(queries[0].sql).toMatch(/order by "master_vessels"\."is_deleted" asc, "master_vessels"\."is_active" desc, "master_vessels"\."id" desc limit \$\d/);
  });

  it("checks a UUID against vessel_uuid and returns the stored spelling", async () => {
    getDbMock.mockReturnValue(fakeDb([{ vesselUuid: GAS_MIA }]));
    await expect(resolveAppraisalVesselRef(GAS_MIA.toUpperCase())).resolves.toBe(GAS_MIA);
    expect(queries[0].sql).toContain('lower("master_vessels"."vessel_uuid") = $1');
  });

  it("refuses a new vessel that matches nothing", async () => {
    getDbMock.mockReturnValue(fakeDb([]));
    await expect(resolveAppraisalVesselRef("Ghost Ship")).rejects.toThrow(MasterReferenceError);
  });

  it("keeps an unchanged stored value and maps empty to null, without a lookup", async () => {
    await expect(resolveAppraisalVesselRef("Old Name", "Old Name")).resolves.toBe("Old Name");
    await expect(resolveAppraisalVesselRef("", GAS_MIA)).resolves.toBeNull();
    expect(getDbMock).not.toHaveBeenCalled();
  });
});

describe("migration 0273", () => {
  const sql = readFileSync(join(__dirname, "../../migrations/0273_appraisal_master_refs.sql"), "utf8");

  it("gives the four built-in types fixed uuid v5 ids (never change them)", () => {
    const ns = uuidv5("safelanes.crewing.master_appraisal_types", uuidv5.URL);
    expect(sql).toContain(ns);
    for (const entryId of ["AT001", "AT002", "AT003", "AT004"]) {
      expect(sql).toContain(`('${entryId}', '${uuidv5(entryId, ns)}'::uuid)`);
    }
    expect(uuidv5("AT002", ns)).toBe(MID_TERM);
  });

  it("fixes the ids before converting appraisal type names to them", () => {
    const fixIds = sql.indexOf("UPDATE master_appraisal_types");
    const backfill = sql.indexOf("UPDATE appraisal_results_v2 ar\n    SET appraisal_type");
    expect(fixIds).toBeGreaterThan(-1);
    expect(backfill).toBeGreaterThan(fixIds);
  });

  it("lifts the 0196 pin check only around the backfills and re-adds it as 0196 defines it", () => {
    const drop = sql.indexOf("DROP CONSTRAINT IF EXISTS appraisal_results_v2_submitted_form_version_pin_check");
    const readd = sql.indexOf("ADD CONSTRAINT appraisal_results_v2_submitted_form_version_pin_check");
    const backfill = sql.indexOf("UPDATE appraisal_results_v2 ar\n    SET appraisal_type");
    const vessel = sql.indexOf("UPDATE appraisal_results_v2 ar\n    SET vessel");
    expect(drop).toBeGreaterThan(sql.indexOf("UPDATE master_appraisal_types"));
    expect(backfill).toBeGreaterThan(drop);
    expect(readd).toBeGreaterThan(vessel);

    const check = (text: string, at: number) =>
      text.slice(text.indexOf("CHECK (", at), text.indexOf("NOT VALID", at) + "NOT VALID".length).replace(/\s+/g, " ");
    const original = readFileSync(join(__dirname, "../../migrations/0196_enforce_form_version_pin_contract.sql"), "utf8");
    const originalAt = original.indexOf("ADD CONSTRAINT appraisal_results_v2_submitted_form_version_pin_check");
    expect(check(sql, readd)).toBe(check(original, originalAt));
  });
});

describe("every appraisal write resolves the keys and a miss is a 400 (source guard)", () => {
  const service = readFileSync(join(__dirname, "../../server/v2/appraisals/services/appraisalResultsService.ts"), "utf8");
  const controller = readFileSync(join(__dirname, "../../server/v2/appraisals/controllers/appraisalResultsController.ts"), "utf8");

  it("create, save draft and Stage 1 resolve type and vessel", () => {
    expect(service.match(/resolveAppraisalTypeRef\(/g)).toHaveLength(3);
    expect(service.match(/resolveAppraisalVesselRef\(/g)).toHaveLength(3);
    expect(service).not.toMatch(/stageUpdate\.vessel = data\.vessel;/);
    expect(service).not.toMatch(/appraisalType: auditData\.appraisalType \|\| ""/);
  });

  it("create, update, Stage 1 and Stage 2 answer 400", () => {
    expect(controller.match(/error instanceof MasterReferenceError/g)).toHaveLength(4);
  });
});
