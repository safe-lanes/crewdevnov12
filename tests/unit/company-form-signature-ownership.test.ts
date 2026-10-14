import { describe, expect, it } from "vitest";
import { ownsCompanyFormSignature } from "../../server/v2/company-forms/signatureOwnership";
describe("Company Form signer-or-recorded-witness removal ownership", () => {
  it("allows the actual signer or recorded witness, not another actor", () => {
    const signature = { signedByUuid: "trusted-signer", witnessUserId: 12 };
    expect(ownsCompanyFormSignature(signature, 5, "trusted-signer")).toBe(true);
    expect(ownsCompanyFormSignature(signature, 12, "office-witness")).toBe(true);
    expect(ownsCompanyFormSignature(signature, 13, "different-user")).toBe(false);
    expect(ownsCompanyFormSignature({ signedByUuid: "12" }, 12)).toBe(true);
  });
});
