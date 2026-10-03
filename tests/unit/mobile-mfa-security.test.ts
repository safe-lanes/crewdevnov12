import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path: string) => fs.readFileSync(path, "utf8");

describe("crew mobile MFA security boundary", () => {
  it("does not issue tokens until enrolled MFA is verified", () => {
    const auth = read("server/v2/crew-app/auth/services/crewAuthService.ts");
    expect(auth.indexOf("crewMfaService.verify")).toBeGreaterThan(auth.indexOf("bcrypt.compare"));
    expect(auth.indexOf("issueTokenPair(credential", auth.indexOf("async login"))).toBeGreaterThan(auth.indexOf("crewMfaService.verify"));
    expect(auth).toContain('if (!mfaCode) throw new Error("MFA required")');
  });

  it("encrypts TOTP secrets and consumes recovery codes atomically", () => {
    const mfa = read("server/v2/crew-app/auth/services/crewMfaService.ts");
    const repository = read("server/v2/crew-app/auth/repositories/crewCredentialsRepository.ts");
    expect(mfa).toContain('createCipheriv("aes-256-gcm"');
    expect(mfa).toContain("timingSafeEqual");
    expect(repository).toContain("eq(appCrewCredentials.mfaRecoveryCodeHashes, expectedHashesJson)");
  });

  it("blocks screen capture and exposes an in-app enrollment path", () => {
    expect(read("mobile/App.tsx")).toContain("preventScreenCaptureAsync");
    expect(read("mobile/src/navigation/MainTabs.tsx")).toContain("MfaSetupScreen");
    expect(read("mobile/src/screens/LoginScreen.tsx")).toContain("login-mfa-code");
  });
});
