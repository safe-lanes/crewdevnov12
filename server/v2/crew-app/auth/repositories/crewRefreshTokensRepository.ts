import { eq, and, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getDb } from "../../../db";
import { appCrewRefreshTokens } from "../../../../../shared/v2/crew-app/schema";
import type {
  AppCrewRefreshToken,
  InsertAppCrewRefreshToken,
} from "../../../../../shared/v2/crew-app/types";

export class CrewRefreshTokensRepository {
  async insert(
    data: Omit<InsertAppCrewRefreshToken, "refreshTokenUuid">,
  ): Promise<AppCrewRefreshToken> {
    const db = getDb();
    const results = await db
      .insert(appCrewRefreshTokens)
      .values({ ...data, refreshTokenUuid: uuidv4() })
      .returning();
    return results[0];
  }

  async findByTokenHash(tokenHash: string): Promise<AppCrewRefreshToken | undefined> {
    const db = getDb();
    const results = await db
      .select()
      .from(appCrewRefreshTokens)
      .where(eq(appCrewRefreshTokens.tokenHash, tokenHash))
      .limit(1);
    return results[0];
  }

  /**
   * Atomically marks a token row as revoked only if it wasn't already revoked.
   * Returns the row if this call was the one that consumed it, undefined if it
   * was already revoked (i.e. reuse/replay of an already-rotated token).
   */
  async consumeIfActive(tokenHash: string): Promise<AppCrewRefreshToken | undefined> {
    const db = getDb();
    const results = await db
      .update(appCrewRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(appCrewRefreshTokens.tokenHash, tokenHash), isNull(appCrewRefreshTokens.revokedAt)))
      .returning();
    return results[0];
  }

  async revokeAllForCredential(crewCredentialId: number): Promise<void> {
    const db = getDb();
    await db
      .update(appCrewRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(appCrewRefreshTokens.crewCredentialId, crewCredentialId),
          isNull(appCrewRefreshTokens.revokedAt),
        ),
      );
  }

  /** Scoped to the caller's own credential id so one user can't revoke another's token. */
  async revokeByHashForCredential(tokenHash: string, crewCredentialId: number): Promise<void> {
    const db = getDb();
    await db
      .update(appCrewRefreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(appCrewRefreshTokens.tokenHash, tokenHash),
          eq(appCrewRefreshTokens.crewCredentialId, crewCredentialId),
          isNull(appCrewRefreshTokens.revokedAt),
        ),
      );
  }
}
