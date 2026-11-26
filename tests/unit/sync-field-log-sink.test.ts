import { describe, it, expect, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { captureChange, setChangeSink } from "../../server/v2/sync/changeCapture";
import { fieldLogSink, diffRow } from "../../server/v2/sync/fieldLogSink";
import { resetSyncConfigCache } from "../../server/v2/sync/syncConfig";
import { resetInstanceIdCache, getEffectiveInstanceId } from "../../server/v2/sync/syncRole";
import { promotionReviewsV2, promoTrainingNeedsV2 } from "../../shared/v2/promotions/schema";

const dialect = new PgDialect();

const SKIP = ["id", "created_at", "updated_at", "is_sync", "file_data"];
const cfg = (table_name: string, category: string, scope_mode = "parent", vessel_column: string | null = null) => ({
  table_name, category, identity_column: "x_uuid", scope_mode, vessel_column, skip_columns: SKIP,
});
const CONFIG_ROWS = [
  cfg("promo_training_needs_v2", "BOTH_EDITABLE"),
  cfg("promotion_reviews_v2", "BOTH_EDITABLE", "crew"),
  cfg("vessel_planning_v2", "BOTH_EDITABLE", "own", "vessel_uuid"),
  cfg("crew_sea_service", "BOTH_EDITABLE", "crew"), // has the DB trigger (see below)
  cfg("appr_office_reviews_v2", "ONE_WAY_SHORE_TO_SHIP"),
];

// An executor that answers the config, trigger and instance-id reads and records inserts.
function fakeExecutor(opts: { failInsert?: boolean } = {}) {
  const inserts: { text: string; params: unknown[] }[] = [];
  return {
    inserts,
    async execute(q: any) {
      const { sql: text, params } = dialect.sqlToQuery(q);
      if (text.includes("FROM sync_table_config")) return { rows: CONFIG_ROWS };
      if (text.includes("FROM pg_trigger")) return { rows: [{ table_name: "crew_sea_service" }] };
      if (text.includes("FROM sync_settings")) return { rows: [{ value: "SHIP-TEST" }] };
      if (text.includes("INSERT INTO sync_field_log")) {
        if (opts.failInsert) throw new Error("insert failed");
        inserts.push({ text, params });
        return { rows: [] };
      }
      throw new Error(`unexpected sql: ${text}`);
    },
  };
}

// Insert params per row: instance, table, row, field, op, old, new, vessel, changedBy.
beforeEach(() => {
  resetSyncConfigCache();
  resetInstanceIdCache();
  setChangeSink(fieldLogSink);
});

describe("diffRow", () => {
  it("insert logs every non-null field, skipping the config's skip columns", () => {
    const rows = diffRow(
      "promo_training_needs_v2",
      null,
      { id: 5, tnUuid: "t1", reviewUuid: "r1", isSync: true, createdAt: new Date(), updatedAt: new Date(), notes: null, isDeleted: false },
      SKIP,
    );
    expect(rows.map((r) => r.field).sort()).toEqual(["is_deleted", "review_uuid", "tn_uuid"]);
    expect(rows.every((r) => r.oldValue === null)).toBe(true);
  });

  it("update logs only changed fields and a soft delete is an is_deleted change", () => {
    const rows = diffRow(
      "promo_training_needs_v2",
      { tnUuid: "t1", isDeleted: false, updatedAt: "a" },
      { tnUuid: "t1", isDeleted: true, updatedAt: "b" },
      SKIP,
    );
    expect(rows).toEqual([{ field: "is_deleted", oldValue: "false", newValue: "true" }]);
  });

  it("serializes dates as ISO and objects as JSON; equal values are not logged", () => {
    const d = new Date("2026-01-02T03:04:05.000Z");
    const rows = diffRow(
      "promo_training_needs_v2",
      { a: { x: 1 }, b: d, c: 1 },
      { a: { x: 2 }, b: new Date(d), c: "1" },
    );
    expect(rows).toEqual([{ field: "a", oldValue: '{"x":1}', newValue: '{"x":2}' }]);
  });

  it("uses the real column name where camel-to-snake would be wrong", () => {
    const rows = diffRow("promotion_reviews_v2", null, { selectedVesselTypeForA23b: "Tanker" });
    expect(rows[0].field).toBe("selected_vessel_type_for_a2_3b");
  });
});

describe("fieldLogSink through captureChange", () => {
  it("writes one log row per changed field with op U on the passed executor", async () => {
    const ex = fakeExecutor();
    await captureChange(ex, {
      table: promoTrainingNeedsV2,
      rowUuid: "t1",
      oldRow: { tnUuid: "t1", reviewUuid: "r1", isDeleted: false },
      newRow: { tnUuid: "t1", reviewUuid: "r1", isDeleted: true },
      actorUuid: "user-1",
    });
    expect(ex.inserts).toHaveLength(1);
    expect(ex.inserts[0].params).toEqual([
      "SHIP-TEST", "promo_training_needs_v2", "t1", "is_deleted", "U", "false", "true", null, "user-1",
    ]);
  });

  it("an insert is op I with old value null, and the actor falls back to 'system'", async () => {
    const ex = fakeExecutor();
    await captureChange(ex, { table: promotionReviewsV2, rowUuid: "r1", oldRow: null, newRow: { reviewUuid: "r1" } });
    expect(ex.inserts[0].params).toEqual(["SHIP-TEST", "promotion_reviews_v2", "r1", "review_uuid", "I", null, "r1", null, "system"]);
  });

  it("stamps vessel_id only for 'own' scoped tables", async () => {
    const ex = fakeExecutor();
    await captureChange(ex, { table: "vessel_planning_v2", rowUuid: "p1", oldRow: null, newRow: { planUuid: "p1", vesselUuid: "v9" } });
    const vesselParams = ex.inserts[0].params.filter((_, i) => i % 9 === 7);
    expect(vesselParams).toEqual(["v9", "v9"]);
  });

  it("does nothing for tables that are not both-editable or not configured", async () => {
    const ex = fakeExecutor();
    await captureChange(ex, { table: "appr_office_reviews_v2", rowUuid: "o1", oldRow: null, newRow: { officeReviewUuid: "o1" } });
    await captureChange(ex, { table: "crew_members_v2", rowUuid: "c1", oldRow: null, newRow: { crewUuid: "c1" } });
    expect(ex.inserts).toHaveLength(0);
  });

  it("skips a table the database trigger already logs (no double rows)", async () => {
    const ex = fakeExecutor();
    await captureChange(ex, { table: "crew_sea_service", rowUuid: "s1", oldRow: null, newRow: { seaUuid: "s1" } });
    expect(ex.inserts).toHaveLength(0);
  });

  it("writes nothing when no field changed", async () => {
    const ex = fakeExecutor();
    const row = { tnUuid: "t1", isDeleted: false };
    await captureChange(ex, { table: promoTrainingNeedsV2, rowUuid: "t1", oldRow: row, newRow: { ...row } });
    expect(ex.inserts).toHaveLength(0);
  });

  it("propagates an insert failure so the caller's transaction rolls back", async () => {
    const ex = fakeExecutor({ failInsert: true });
    await expect(
      captureChange(ex, { table: promoTrainingNeedsV2, rowUuid: "t1", oldRow: null, newRow: { tnUuid: "t1" } }),
    ).rejects.toThrow("insert failed");
  });

  it("is a no-op when no sink is set", async () => {
    setChangeSink(null);
    const ex = fakeExecutor();
    await captureChange(ex, { table: promoTrainingNeedsV2, rowUuid: "t1", oldRow: null, newRow: { tnUuid: "t1" } });
    expect(ex.inserts).toHaveLength(0);
  });
});

describe("getEffectiveInstanceId", () => {
  const dbWith = (value: string | null) => ({
    execute: async () => ({ rows: value === null ? [] : [{ value }] }),
  });

  it("DB value wins over env", async () => {
    process.env.SYNC_INSTANCE_ID = "SHIP-ENV";
    expect(await getEffectiveInstanceId(dbWith("SHIP-DB"))).toBe("SHIP-DB");
  });

  it("falls back to env, and throws when neither is set", async () => {
    process.env.SYNC_INSTANCE_ID = "OFFICE-HQ";
    expect(await getEffectiveInstanceId(dbWith(null))).toBe("OFFICE-HQ");
    resetInstanceIdCache();
    delete process.env.SYNC_INSTANCE_ID;
    await expect(getEffectiveInstanceId(dbWith(null))).rejects.toThrow("NOT configured");
  });

  it("rejects placeholder ids", async () => {
    delete process.env.SYNC_INSTANCE_ID;
    await expect(getEffectiveInstanceId(dbWith("SHIP-VESSELNAME"))).rejects.toThrow("placeholder");
  });
});
