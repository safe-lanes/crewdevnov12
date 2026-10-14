import { describe, it, expect } from "vitest";
import { seaServiceRankLabel } from "../../client/src/modules/crew-pool/seaServicePresentation";
const uuid = "11111111-1111-4111-8111-111111111111";
describe("Imported E1 rank presentation without identity-by-name matching", () => {
  it("renders the canonical UUID and code as their master name", () => {
    const masters = [{ arUuid: uuid, rankId: "R001", name: "Master" }];
    expect(seaServiceRankLabel(uuid, masters)).toBe("Master");
    expect(seaServiceRankLabel("R001", masters)).toBe("Master");
  });
  it("never exposes an unresolved UUID as rank text", () => {
    expect(seaServiceRankLabel(uuid, [])).toBe("Rank unavailable");
  });
  it("keeps old display text only as presentation, not a master identity", () => {
    expect(seaServiceRankLabel("Pumpman", [{ arUuid: uuid, name: "Pumpman" }])).toBe("Pumpman");
  });
});
