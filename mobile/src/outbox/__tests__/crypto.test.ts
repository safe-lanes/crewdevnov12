import { openRecord, sealRecord } from "../crypto";

describe("outbox authenticated encryption", () => {
  const key = new Uint8Array(32).fill(7);
  const nonce = new Uint8Array(12).fill(3);
  const value = { passport: "SECRET-PASSPORT", mobile: "+123" };

  it("14. stored payload is ciphertext rather than readable PII", () => {
    const sealed = sealRecord(key, nonce, "local-1", value);
    expect(JSON.stringify(sealed)).not.toContain("SECRET-PASSPORT");
    expect(openRecord(key, sealed)).toEqual(value);
  });

  it("15. a lost or wrong device key fails closed", () => {
    const sealed = sealRecord(key, nonce, "local-1", value);
    expect(() => openRecord(new Uint8Array(32).fill(8), sealed)).toThrow();
  });

  it("16. corrupted authenticated ciphertext fails closed", () => {
    const sealed = sealRecord(key, nonce, "local-1", value);
    sealed.ciphertext = `${sealed.ciphertext.slice(0, -2)}00`;
    expect(() => openRecord(key, sealed)).toThrow();
  });
});
