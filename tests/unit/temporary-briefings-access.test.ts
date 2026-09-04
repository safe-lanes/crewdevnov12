import { describe, expect, it } from "vitest";
import { canAccessTemporaryBriefings } from "@/modules/admin/temporaryBriefingsAccess";

describe("temporary Briefings client access", () => {
  it.each([
    "Office",
    "office",
    " OFFICE ",
    "oFfIcE",
  ])("allows office user type %j", (userType) => {
    expect(canAccessTemporaryBriefings(userType)).toBe(true);
  });

  it.each([
    "Ship",
    "ship",
    " SHIP ",
    "",
    "Admin",
    null,
    undefined,
  ])("denies non-office user type %j", (userType) => {
    expect(canAccessTemporaryBriefings(userType)).toBe(false);
  });
});