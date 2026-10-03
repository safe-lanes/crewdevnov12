import { describe, expect, it } from "vitest";
import { commandPolicy, deriveCommandType } from "../../server/v2/crew-app/erp-commands/commandPolicy";
import { assertTransition, canTransition } from "../../server/v2/crew-app/erp-commands/commandStateMachine";
import { canonicalHash, canonicalMatches } from "../../server/v2/crew-app/erp-commands/canonical";

describe("crew ERP command safety policy", () => {
  it.each([
    ["particulars", "update", "UPDATE_CREW_PARTICULARS"],
    ["documents", "update", "UPDATE_DOCUMENTS"],
    ["sea-service", "update", "UPDATE_SEA_SERVICE"],
  ])("allowlists stable update %s", (section, action, type) => {
    expect(deriveCommandType(section, action)).toBe(type);
    expect(commandPolicy(type)).toMatchObject({ automated: true, classification: "SAFE_WITH_RECONCILIATION" });
  });

  it.each([
    ["documents", "create", "UNSAFE_CREATE_NO_IDEMPOTENCY_KEY"],
    ["visas", "delete", "NON_ATOMIC_FILE_DELETE"],
    ["vessel-types", "update", "NON_TRANSACTIONAL_REPLACEMENT"],
    ["personal", "update", "UNSAFE_CREATE_NO_IDEMPOTENCY_KEY"],
  ])("prevents unsupported %s/%s from automatic execution", (section, action, reason) => {
    expect(commandPolicy(deriveCommandType(section, action))).toMatchObject({ automated: false, reasonCode: reason });
  });

  it("rejects arbitrary state transitions and terminal reprocessing", () => {
    expect(canTransition("queued", "leased")).toBe(true);
    expect(canTransition("applied", "leased")).toBe(false);
    expect(() => assertTransition("queued", "applied")).toThrow(/Invalid ERP command transition/);
  });

  it("compares only approved fields with stable string/date/null normalization", () => {
    expect(canonicalMatches(
      { name: " Alice ", expiry: "2030-01-02T10:20:30Z", note: undefined },
      { name: "Alice", expiry: new Date("2030-01-02T00:00:00Z"), serverMetadata: "ignored" },
    )).toBe(true);
    expect(canonicalHash({ b: " x ", a: null })).toBe(canonicalHash({ a: "", b: "x" }));
  });
});
