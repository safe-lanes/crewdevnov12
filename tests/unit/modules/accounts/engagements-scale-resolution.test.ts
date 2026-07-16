import { describe, it, expect } from "vitest";
import {
  resolveVesselTypeContext,
  resolveScaleOutcome,
  resolveScaleForStart,
} from "../../../../server/v2/accounts/services/engagementsService";
import type { AccWageScaleV2 } from "../../../../shared/v2/accounts/types";

/**
 * Regression tests for payroll-sync wage-scale resolution.
 *
 * Root cause fixed: master_vessels.vessel_type stores the type NAME
 * ('LPG Tanker') while acc_wage_scales_v2.vessel_type_uuid stores the
 * canonical master_vessel_types.vt_uuid — a strict equality between the two
 * made typed scales unreachable. Resolution now canonicalizes the vessel's
 * type name to vt_uuid before comparing.
 */

const LPG_UUID = "A58B8ABD-DD34-4E44-8737-BA7E9AFD10A3";
const BULK_UUID = "B0000000-0000-0000-0000-000000000001";

const masterTypes = [
  { vtUuid: LPG_UUID, vesselType: "LPG Tanker" },
  { vtUuid: BULK_UUID, vesselType: "Bulk Carrier" },
];

function scale(partial: Partial<AccWageScaleV2>): AccWageScaleV2 {
  return {
    scaleUuid: "s-default",
    scaleName: "scale",
    vesselTypeUuid: null,
    vesselGroupUuid: null,
    currency: "USD",
    effectiveFrom: "2025-01-01",
    effectiveTo: "2026-12-31",
    status: "active",
    ...partial,
  } as AccWageScaleV2;
}

const lpgScale = scale({ scaleUuid: "s-lpg", vesselTypeUuid: LPG_UUID });
const fleetScale = scale({ scaleUuid: "s-fleet" });

describe("resolveVesselTypeContext", () => {
  it("maps a stored type name to the canonical vt_uuid (case-insensitive)", () => {
    expect(resolveVesselTypeContext("LPG Tanker", masterTypes)).toEqual({
      typeName: "LPG Tanker",
      vesselTypeUuid: LPG_UUID,
      unmatched: false,
    });
    expect(
      resolveVesselTypeContext("lpg tanker", masterTypes).vesselTypeUuid,
    ).toBe(LPG_UUID);
    expect(
      resolveVesselTypeContext("  LPG Tanker  ", masterTypes).vesselTypeUuid,
    ).toBe(LPG_UUID);
  });

  it("accepts a value that is already the vt_uuid", () => {
    const ctx = resolveVesselTypeContext(LPG_UUID.toLowerCase(), masterTypes);
    expect(ctx.vesselTypeUuid).toBe(LPG_UUID);
    expect(ctx.typeName).toBe("LPG Tanker");
    expect(ctx.unmatched).toBe(false);
  });

  it("flags an unknown type name as unmatched without crashing", () => {
    expect(resolveVesselTypeContext("Unknown Type", masterTypes)).toEqual({
      typeName: "Unknown Type",
      vesselTypeUuid: null,
      unmatched: true,
    });
  });

  it("treats null/empty type as no-type (not unmatched)", () => {
    expect(resolveVesselTypeContext(null, masterTypes).unmatched).toBe(false);
    expect(resolveVesselTypeContext("  ", masterTypes).unmatched).toBe(false);
  });
});

describe("resolveScaleOutcome", () => {
  it("(a) vessel with a matching typed scale resolves that scale (not fleet-wide)", () => {
    const ctx = resolveVesselTypeContext("LPG Tanker", masterTypes);
    const out = resolveScaleOutcome([lpgScale, fleetScale], ctx, "2026-06-01");
    expect(out.scale?.scaleUuid).toBe("s-lpg");
    expect(out.errorReason).toBeUndefined();
    expect(out.usedFleetWideForUnmatchedType).toBe(false);
  });

  it("(b) vessel of a different type falls through to fleet-wide when one is active", () => {
    const ctx = resolveVesselTypeContext("Bulk Carrier", masterTypes);
    const out = resolveScaleOutcome([lpgScale, fleetScale], ctx, "2026-06-01");
    expect(out.scale?.scaleUuid).toBe("s-fleet");
    expect(out.errorReason).toBeUndefined();
  });

  it("(c) errors when neither a typed nor a fleet-wide scale exists", () => {
    const ctx = resolveVesselTypeContext("Bulk Carrier", masterTypes);
    const out = resolveScaleOutcome([lpgScale], ctx, "2026-06-01");
    expect(out.scale).toBeUndefined();
    expect(out.errorReason).toBe(
      "no active wage scale for vessel type 'Bulk Carrier' or fleet-wide at 2026-06-01",
    );
  });

  it("(d) unmatched type name uses fleet-wide with a warning flag", () => {
    const ctx = resolveVesselTypeContext("Unknown Type", masterTypes);
    const out = resolveScaleOutcome([lpgScale, fleetScale], ctx, "2026-06-01");
    expect(out.scale?.scaleUuid).toBe("s-fleet");
    expect(out.usedFleetWideForUnmatchedType).toBe(true);
    expect(out.errorReason).toBeUndefined();
  });

  it("(d) unmatched type name with no fleet-wide scale errors with the explanatory message", () => {
    const ctx = resolveVesselTypeContext("Unknown Type", masterTypes);
    const out = resolveScaleOutcome([lpgScale], ctx, "2026-06-01");
    expect(out.scale).toBeUndefined();
    expect(out.errorReason).toBe(
      'vessel type "Unknown Type" not found in vessel-type master and no active fleet-wide wage scale at 2026-06-01',
    );
  });

  it("ignores scales outside their effective window", () => {
    const expired = scale({
      scaleUuid: "s-old",
      vesselTypeUuid: LPG_UUID,
      effectiveTo: "2025-12-31",
    });
    const ctx = resolveVesselTypeContext("LPG Tanker", masterTypes);
    const out = resolveScaleOutcome([expired, fleetScale], ctx, "2026-06-01");
    expect(out.scale?.scaleUuid).toBe("s-fleet");
  });
});

describe("resolveScaleForStart (canonical uuid comparison)", () => {
  it("matches typed scales strictly by vt_uuid", () => {
    expect(
      resolveScaleForStart([lpgScale, fleetScale], LPG_UUID, "2026-06-01")
        ?.scaleUuid,
    ).toBe("s-lpg");
    // A raw name never matches a uuid-keyed scale — falls to fleet-wide.
    expect(
      resolveScaleForStart([lpgScale, fleetScale], "LPG Tanker", "2026-06-01")
        ?.scaleUuid,
    ).toBe("s-fleet");
  });

  it("prefers the newest effective typed scale", () => {
    const older = scale({
      scaleUuid: "s-lpg-old",
      vesselTypeUuid: LPG_UUID,
      effectiveFrom: "2024-01-01",
    });
    expect(
      resolveScaleForStart([older, lpgScale], LPG_UUID, "2026-06-01")
        ?.scaleUuid,
    ).toBe("s-lpg");
  });
});
