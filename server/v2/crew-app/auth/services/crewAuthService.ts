import jwt, { type SignOptions } from "jsonwebtoken";
import bcrypt from "bcrypt";
import { createHash } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";
import { runInCrewAppTenant } from "../../tenantContext";
import { getDb } from "../../../db";
import { CrewCredentialsRepository, CrewRefreshTokensRepository } from "../repositories";
import { crewMembersV2 } from "../../../../../shared/v2/crew-pool/schema";
import type {
  AppCrewCredential,
  CrewLoginRequest,
  CrewLogoutRequest,
  CrewRefreshRequest,
  CrewSetPasswordRequest,
} from "../../../../../shared/v2/crew-app/types";
import { emitCrewSecurityEvent } from "../../monitoring/securityEvents";
import { crewMfaService } from "./crewMfaService";

// Isolated from the legacy web auth (server/middleware/authMiddleware.ts /
// tenantMiddleware.ts): own secrets, own token shapes, own tenant resolution.
// Never import those files or JWT_SECRET here.

const crewCredentialsRepository = new CrewCredentialsRepository();
const crewRefreshTokensRepository = new CrewRefreshTokensRepository();

const ACCESS_TOKEN_SECRET = process.env.CREW_APP_ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.CREW_APP_REFRESH_TOKEN_SECRET;

if (!ACCESS_TOKEN_SECRET) {
  throw new Error(
    "CREW_APP_ACCESS_TOKEN_SECRET is not set. This is required for the crew mobile app auth module and must be distinct from JWT_SECRET.",
  );
}
if (!REFRESH_TOKEN_SECRET) {
  throw new Error(
    "CREW_APP_REFRESH_TOKEN_SECRET is not set. This is required for the crew mobile app auth module and must be distinct from JWT_SECRET and from CREW_APP_ACCESS_TOKEN_SECRET.",
  );
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
const ACCESS_TOKEN_TTL = (process.env.CREW_APP_ACCESS_TOKEN_TTL || "15m") as SignOptions["expiresIn"];
const REFRESH_TOKEN_TTL = "45d";
const REFRESH_TOKEN_TTL_MS = 45 * 24 * 60 * 60 * 1000;
const BCRYPT_SALT_ROUNDS = 12;
// Computed once at startup, purely so the "identifier not found" login path
// can burn a comparable amount of time to a real bcrypt.compare() below —
// otherwise the two paths are timing-distinguishable, letting an attacker
// enumerate valid identifiers even though both return the same error text.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("timing-equalization-only-never-a-real-password", BCRYPT_SALT_ROUNDS);

interface CrewAccessTokenPayload {
  sub: number;
  crewId: string;
  domain: string;
  userType: string;
  mustResetPassword: boolean;
  sessionVersion: number;
  tokenType: "access";
}

interface CrewRefreshTokenPayload extends Omit<CrewAccessTokenPayload, "tokenType"> {
  tokenType: "refresh";
  jti: string;
  iat?: number;
  exp?: number;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function issueTokenPair(
  credential: AppCrewCredential,
  deviceId?: string | null,
  deviceLabel?: string | null,
): Promise<{ accessToken: string; refreshToken: string }> {
  const payload: CrewAccessTokenPayload = {
    sub: credential.id,
    crewId: credential.crewUuid,
    domain: credential.domain,
    userType: credential.userType,
    mustResetPassword: credential.mustResetPassword ?? false,
    sessionVersion: credential.sessionVersion ?? 0,
    tokenType: "access",
  };

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET!, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign({ ...payload, tokenType: "refresh", jti: uuidv4() }, REFRESH_TOKEN_SECRET!, {
    expiresIn: REFRESH_TOKEN_TTL,
  });

  await crewRefreshTokensRepository.insert({
    crewCredentialId: credential.id,
    tokenHash: hashToken(refreshToken),
    deviceId: deviceId ?? null,
    deviceLabel: deviceLabel ?? null,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    revokedAt: null,
  });

  return { accessToken, refreshToken };
}

async function toCrewSummary(credential: AppCrewCredential) {
  const db = getDb();
  const rows = await db
    .select({ firstName: crewMembersV2.firstName, familyName: crewMembersV2.familyName })
    .from(crewMembersV2)
    .where(eq(crewMembersV2.crewUuid, credential.crewUuid))
    .limit(1);
  const name = rows[0];

  return {
    crewUuid: credential.crewUuid,
    empNo: credential.empNo,
    mobile: credential.mobile,
    email: credential.email,
    userType: credential.userType,
    firstName: name?.firstName ?? null,
    familyName: name?.familyName ?? null,
  };
}

export const crewAuthService = {
  async login(data: CrewLoginRequest) {
    const { identifier, password, domain, deviceId, deviceLabel, mfaCode } = data;
    return runInCrewAppTenant(domain, async () => {
        const credential = await crewCredentialsRepository.findByIdentifierAndDomain(identifier, domain);

        // Same generic error for "not found" and "wrong password" — no user enumeration.
        // The dummy compare below equalizes timing with the real bcrypt.compare()
        // further down, so the two cases aren't distinguishable by response latency.
        if (!credential || credential.isActive === false) {
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
          throw new Error("Invalid credentials");
        }

        if (credential.lockedUntil && credential.lockedUntil.getTime() > Date.now()) {
          throw new Error(`Account locked until ${credential.lockedUntil.toISOString()}. Try again later.`);
        }

        const passwordMatches = await bcrypt.compare(password, credential.passwordHash);
        if (!passwordMatches) {
          const attempts = await crewCredentialsRepository.incrementFailedAttempts(credential.id);
          if (attempts >= MAX_FAILED_ATTEMPTS) {
            await crewCredentialsRepository.lockAccount(credential.id, new Date(Date.now() + LOCKOUT_DURATION_MS));
            emitCrewSecurityEvent({ event: "account_lockout", actorId: credential.id, tenantId: credential.domain, resourceType: "crew_credential", result: "warning", reasonCode: "failed_attempt_threshold" });
          }
          throw new Error("Invalid credentials");
        }

        if (credential.mfaEnabled) {
          if (!mfaCode) throw new Error("MFA required");
          if (!(await crewMfaService.verify(credential, mfaCode))) {
            const attempts = await crewCredentialsRepository.incrementFailedAttempts(credential.id);
            if (attempts >= MAX_FAILED_ATTEMPTS) {
              await crewCredentialsRepository.lockAccount(credential.id, new Date(Date.now() + LOCKOUT_DURATION_MS));
              emitCrewSecurityEvent({ event: "account_lockout", actorId: credential.id, tenantId: credential.domain, resourceType: "crew_credential", result: "warning", reasonCode: "invalid_mfa_threshold" });
            }
            emitCrewSecurityEvent({ event: "login_failure", actorId: credential.id, tenantId: credential.domain, resourceType: "crew_credential", result: "denied", reasonCode: "invalid_mfa" });
            throw new Error("Invalid MFA code");
          }
        }

        if (credential.mustResetPassword) {
          const consumed = await crewCredentialsRepository.consumeTemporaryPassword(credential.id);
          if (!consumed) throw new Error("Invalid credentials");
        }

        if (credential.failedLoginAttempts || credential.lockedUntil) {
          await crewCredentialsRepository.clearLockout(credential.id);
        }
        await crewCredentialsRepository.updateLastLogin(credential.id);

        const { accessToken, refreshToken } = await issueTokenPair(credential, deviceId, deviceLabel);

        return {
          accessToken,
          refreshToken,
          mustResetPassword: credential.mustResetPassword ?? false,
          crew: await toCrewSummary(credential),
        };
      });
  },

  async refresh(data: CrewRefreshRequest) {
    const { refreshToken, deviceId } = data;

    let decoded: CrewRefreshTokenPayload;
    try {
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET!, { algorithms: ["HS256"] }) as unknown as CrewRefreshTokenPayload;
    } catch {
      throw new Error("Invalid refresh token");
    }

    if (decoded.tokenType !== "refresh") throw new Error("Invalid refresh token");
    return runInCrewAppTenant(decoded.domain, async () => {
        const tokenHash = hashToken(refreshToken);
        const consumed = await crewRefreshTokensRepository.consumeIfActive(tokenHash);

        if (!consumed) {
          // This token was already rotated once before — reuse/replay. Kill the whole
          // session family and force a fresh login, per standard refresh-token-reuse mitigation.
          await crewRefreshTokensRepository.revokeAllForCredential(decoded.sub);
          emitCrewSecurityEvent({ event: "refresh_token_reuse", actorId: decoded.sub, tenantId: decoded.domain, resourceType: "crew_session", result: "warning", reasonCode: "rotated_token_replayed" });
          throw new Error("Invalid refresh token");
        }

        if (consumed.expiresAt.getTime() < Date.now()) {
          throw new Error("Invalid refresh token");
        }

        // The token was issued to a specific device. A refresh presented with a
        // different (or missing) deviceId than the one on record means someone
        // other than the original device has this refresh token — treat it the
        // same as reuse/replay and kill the whole session family.
        if (consumed.deviceId && consumed.deviceId !== deviceId) {
          await crewRefreshTokensRepository.revokeAllForCredential(decoded.sub);
          emitCrewSecurityEvent({ event: "refresh_token_reuse", actorId: decoded.sub, tenantId: decoded.domain, resourceType: "crew_session", result: "warning", reasonCode: "device_mismatch" });
          throw new Error("Invalid refresh token");
        }

        const credential = await crewCredentialsRepository.findById(decoded.sub);
        if (!credential || credential.isActive === false) {
          throw new Error("Invalid refresh token");
        }
        if ((credential.sessionVersion ?? 0) !== decoded.sessionVersion) throw new Error("Invalid refresh token");
        if (credential.mustResetPassword) {
          await crewRefreshTokensRepository.revokeAllForCredential(credential.id);
          throw new Error("Invalid refresh token");
        }

        return issueTokenPair(credential, deviceId ?? consumed.deviceId, consumed.deviceLabel);
      });
  },

  /** Runs inside the tenant context already established by crewAuthMiddleware. */
  async logout(data: CrewLogoutRequest, crewUser: { credentialId: number }): Promise<void> {
    if (data.allDevices) {
      await crewRefreshTokensRepository.revokeAllForCredential(crewUser.credentialId);
      await crewCredentialsRepository.incrementSessionVersion(crewUser.credentialId);
      emitCrewSecurityEvent({ event: "session_revoke", actorId: crewUser.credentialId, resourceType: "crew_session", result: "success", reasonCode: "logout_all_devices" });
      return;
    }
    if (data.refreshToken) {
      await crewRefreshTokensRepository.revokeByHashForCredential(
        hashToken(data.refreshToken),
        crewUser.credentialId,
      );
    }
  },

  /** Runs inside the tenant context already established by crewAuthMiddleware. */
  async setPassword(data: CrewSetPasswordRequest, crewUser: { credentialId: number }): Promise<{ accessToken: string; refreshToken: string }> {
    const credential = await crewCredentialsRepository.findById(crewUser.credentialId);
    if (!credential) {
      throw new Error("Invalid credentials");
    }

    const matches = await bcrypt.compare(data.currentPassword, credential.passwordHash);
    if (!matches) {
      throw new Error("Current password is incorrect");
    }

    const passwordHash = await bcrypt.hash(data.newPassword, BCRYPT_SALT_ROUNDS);
    await crewCredentialsRepository.updatePasswordHash(credential.id, passwordHash);
    await crewRefreshTokensRepository.revokeAllForCredential(credential.id);
    const updated = await crewCredentialsRepository.findById(credential.id);
    if (!updated) throw new Error("Invalid credentials");
    return issueTokenPair(updated);
  },

  async beginMfa(crewUser: { credentialId: number }) {
    const credential = await crewCredentialsRepository.findById(crewUser.credentialId);
    if (!credential) throw new Error("Invalid credentials");
    if (credential.mfaEnabled) throw new Error("MFA already enabled");
    return crewMfaService.begin(credential);
  },

  async confirmMfa(code: string, crewUser: { credentialId: number }) {
    const credential = await crewCredentialsRepository.findById(crewUser.credentialId);
    if (!credential) throw new Error("Invalid credentials");
    const recoveryCodes = await crewMfaService.confirm(credential, code);
    emitCrewSecurityEvent({ event: "mfa_enabled", actorId: credential.id, tenantId: credential.domain, resourceType: "crew_credential", result: "success", reasonCode: "totp_enrolled" });
    return { recoveryCodes };
  },
};
