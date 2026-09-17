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

interface CrewAccessTokenPayload {
  sub: number;
  crewId: string;
  domain: string;
  userType: string;
  mustResetPassword: boolean;
}

interface CrewRefreshTokenPayload extends CrewAccessTokenPayload {
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
  };

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET!, { expiresIn: ACCESS_TOKEN_TTL });
  const refreshToken = jwt.sign({ ...payload, jti: uuidv4() }, REFRESH_TOKEN_SECRET!, {
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
    const { identifier, password, domain, deviceId, deviceLabel } = data;
    return runInCrewAppTenant(domain, async () => {
        const credential = await crewCredentialsRepository.findByIdentifierAndDomain(identifier, domain);

        // Same generic error for "not found" and "wrong password" — no user enumeration.
        if (!credential || credential.isActive === false) {
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
          }
          throw new Error("Invalid credentials");
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
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET!) as unknown as CrewRefreshTokenPayload;
    } catch {
      throw new Error("Invalid refresh token");
    }

    return runInCrewAppTenant(decoded.domain, async () => {
        const tokenHash = hashToken(refreshToken);
        const consumed = await crewRefreshTokensRepository.consumeIfActive(tokenHash);

        if (!consumed) {
          // This token was already rotated once before — reuse/replay. Kill the whole
          // session family and force a fresh login, per standard refresh-token-reuse mitigation.
          await crewRefreshTokensRepository.revokeAllForCredential(decoded.sub);
          console.warn(`[crewAuthService] Refresh token reuse detected for credential ${decoded.sub}`);
          throw new Error("Invalid refresh token");
        }

        if (consumed.expiresAt.getTime() < Date.now()) {
          throw new Error("Invalid refresh token");
        }

        const credential = await crewCredentialsRepository.findById(decoded.sub);
        if (!credential || credential.isActive === false) {
          throw new Error("Invalid refresh token");
        }
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
  async setPassword(data: CrewSetPasswordRequest, crewUser: { credentialId: number }): Promise<void> {
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
  },
};
