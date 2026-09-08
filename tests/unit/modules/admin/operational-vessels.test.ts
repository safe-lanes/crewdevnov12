import { describe, expect, it } from "vitest";
import { isOperationalVessel } from "../../../../client/src/modules/admin/utils/operationalVessels";

describe("isOperationalVessel", () => {
  it("keeps active, non-deleted vessels", () => {
    expect(isOperationalVessel({ isActive: true, isDeleted: false })).toBe(true);
  });

  it.each([
    { isActive: false, isDeleted: false },
    { is_active: "false", is_deleted: "false" },
    { isActive: true, isDeleted: true },
    { is_active: "1", is_deleted: "1" },
    { isArchived: true },
    { is_archived: "true" },
    { archivedAt: "2026-09-08T00:00:00.000Z" },
    { archived_at: "2026-09-08T00:00:00.000Z" },
    { status: "Archived" },
    { status: "Deleted" },
    { status: "Inactive" },
  ])("rejects non-operational vessel shape %#", (vessel) => {
    expect(isOperationalVessel(vessel)).toBe(false);
  });

  it("rejects rows without an explicit active status", () => {
    expect(isOperationalVessel({ vesselUuid: "vessel-1", vessel: "Legacy Vessel" })).toBe(false);
  });

  it("accepts supported active aliases", () => {
    expect(isOperationalVessel({ active: "yes", deleted: "no" })).toBe(true);
    expect(isOperationalVessel({ status: "Active" })).toBe(true);
  });
});