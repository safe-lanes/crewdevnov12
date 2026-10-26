import { describe, expect, it } from "vitest";
import { frozenDocumentReference, type FrozenDocumentInput } from "../../shared/v2/forms-engine/documentEvidence";

describe("frozen Company Form document reference", () => {
  it("keeps the signing-time short reference", () => {
    expect(frozenDocumentReference({
      header: { documentReference: "CF-2026-000123" },
    } as FrozenDocumentInput)).toBe("CF-2026-000123");
  });
  it("uses only frozen source facts for legacy references without mutating evidence", () => {
    const input = { header: {}, source: {
      recordUuid: "0b4e24e7-c0e4-46b6-b158-950cd3d6df0b", completedAt: "2026-10-20T04:57:14Z",
    } } as FrozenDocumentInput;
    const before = JSON.stringify(input);
    expect(frozenDocumentReference(input)).toBe("CF-2026-0b4e24e7-c0e4-46b6-b158-950cd3d6df0b");
    expect(JSON.stringify(input)).toBe(before);
  });
});
