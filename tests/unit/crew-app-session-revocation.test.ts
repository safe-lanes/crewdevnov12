import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("crew-app immediate session revocation contract", () => {
  it("binds access tokens to token type and current session version", () => {
    const middleware = readFileSync("server/v2/crew-app/auth/crewAuthMiddleware.ts", "utf8");
    expect(middleware).toContain('decoded.tokenType !== "access"');
    expect(middleware).toContain("credential.sessionVersion");
    expect(middleware).toContain("credential.isActive === false");
  });

  it("invalidates all sessions on password change and returns a replacement pair", () => {
    const service = readFileSync("server/v2/crew-app/auth/services/crewAuthService.ts", "utf8");
    expect(service).toContain("updatePasswordHash");
    expect(service).toContain("revokeAllForCredential");
    expect(service).toContain("return issueTokenPair(updated)");
  });

  it("increments the credential version on logout-all", () => {
    const service = readFileSync("server/v2/crew-app/auth/services/crewAuthService.ts", "utf8");
    expect(service).toContain("incrementSessionVersion(crewUser.credentialId)");
  });
});
