import { describe, expect, it } from "vitest";
import {
  isOperationalVessel,
  sortVesselOptionsByLabel,
} from "../../../../client/src/modules/admin/utils/operationalVessels";

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

describe("sortVesselOptionsByLabel", () => {
  it("sorts labels case-insensitively with natural number ordering", () => {
    const options = [
      { value: "10", label: "Vessel 10" },
      { value: "2", label: "vessel 2" },
      { value: "alpha", label: "Alpha" },
      { value: "1", label: "Vessel 1" },
    ];

    expect(sortVesselOptionsByLabel(options).map(option => option.value)).toEqual([
      "alpha",
      "1",
      "2",
      "10",
    ]);
  });

  it("does not mutate the source option array", () => {
    const options = [
      { value: "b", label: "Bravo" },
      { value: "a", label: "Alpha" },
    ];

    const sorted = sortVesselOptionsByLabel(options);

    expect(sorted).not.toBe(options);
    expect(options.map(option => option.value)).toEqual(["b", "a"]);
  });

  it("sorts vessel groups and individual vessels by the same displayed label", () => {
    const options = [
      { value: "vessel-z", label: "Zulu", type: "vessel" },
      { value: "group-b", label: "Bravo Group", type: "group" },
      { value: "vessel-a", label: "Alpha", type: "vessel" },
    ];

    expect(sortVesselOptionsByLabel(options).map(option => option.value)).toEqual([
      "vessel-a",
      "group-b",
      "vessel-z",
    ]);
  });
});